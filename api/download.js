import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';

function clientKey(req) {
  const realIp = String(req.headers?.['x-real-ip'] || '').trim();
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',').pop().trim();
  return createHash('sha256').update(realIp || forwarded || 'unknown').digest('hex');
}

async function recordCompletedDownload(req, buildId) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) throw new Error('Download tracking is not configured.');
  const now = Date.now();
  const usageKey = `fgmafian:downloads:${clientKey(req)}`;
  const onceKey = `fgmafian:downloaded:${buildId}`;
  // Redis executes this Lua script atomically. A build can be counted only once,
  // even when two download requests finish at nearly the same time.
  const script = `
    local already = redis.call('SET', KEYS[2], '1', 'NX', 'EX', 2592000)
    if not already then return 0 end
    redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
    redis.call('EXPIRE', KEYS[1], 7200)
    return 1
  `;
  const response = await fetch(UPSTASH_REDIS_REST_URL.replace(/\/+$/, ''), {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['EVAL', script, '2', usageKey, onceKey, String(now - 3600000), String(now), buildId])
  });
  if (!response.ok) throw new Error(`Redis download record failed (HTTP ${response.status}).`);
  const payload = await response.json();
  if (payload.error) throw new Error('Redis rejected the download record.');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) return res.status(500).json({ error: 'APK download is not configured. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO in Vercel.' });
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return res.status(503).json({ error: 'Download tracking is not configured. Set the Upstash REST URL and token in Vercel.' });

  const runId = String(req.query?.run_id || '');
  if (!/^\d{1,20}$/.test(runId)) return res.status(400).json({ error: 'Missing or invalid workflow run ID.' });
  const base = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}`;
  const headers = { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  try {
    const runResponse = await fetch(`${base}/actions/runs/${runId}`, { headers });
    if (!runResponse.ok) return res.status(runResponse.status === 404 ? 404 : 502).json({ error: runResponse.status === 404 ? 'The requested workflow run was not found.' : `GitHub workflow lookup failed (HTTP ${runResponse.status}).` });
    const run = await runResponse.json();
    if (run.path !== '.github/workflows/build-apk.yml' || run.event !== 'workflow_dispatch') return res.status(403).json({ error: 'This run is not an FG MAFIAN APK build.' });
    const titlePrefix = 'FG MAFIAN APK ';
    const buildId = String(run.display_title || '').startsWith(titlePrefix) ? String(run.display_title).slice(titlePrefix.length) : '';
    if (!/^[0-9a-f-]{36}$/i.test(buildId)) return res.status(403).json({ error: 'The workflow run is missing its valid unique FG MAFIAN build ID.' });
    if (run.status !== 'completed' || run.conclusion !== 'success') return res.status(409).json({ error: 'This APK build has not completed successfully yet.' });

    const tag = `apk-build-${runId}`;
    const releaseResponse = await fetch(`${base}/releases/tags/${tag}`, { headers });
    if (!releaseResponse.ok) return res.status(releaseResponse.status === 404 ? 404 : 502).json({ error: releaseResponse.status === 404 ? 'The APK release for this build is not available yet. Refresh the build status and try again.' : `GitHub release lookup failed (HTTP ${releaseResponse.status}).` });
    const release = await releaseResponse.json();
    if (release.draft || release.prerelease || !String(release.body || '').includes(`Workflow Run ID: ${runId}`)) return res.status(403).json({ error: 'The release does not match the requested workflow run.' });
    const asset = (release.assets || []).find(item => item.name === 'fg-mafian-app.apk' && item.state === 'uploaded');
    if (!asset) return res.status(404).json({ error: 'The APK file is missing from this build release.' });

    const assetResponse = await fetch(asset.url, { headers: { ...headers, Accept: 'application/octet-stream' }, redirect: 'manual' });
    const location = assetResponse.headers.get('location');
    if ([301, 302, 303, 307, 308].includes(assetResponse.status) && location) {
      // Proxy the signed GitHub CDN response so the server can count only after
      // the complete response has been delivered; never expose the GitHub token.
      const target = new URL(location);
      if (target.protocol !== 'https:') return res.status(502).json({ error: 'GitHub returned an unsafe download redirect.' });
      const cdn = await fetch(target, { redirect: 'follow' });
      if (!cdn.ok || !cdn.body) return res.status(502).json({ error: `GitHub CDN download failed (HTTP ${cdn.status}).` });
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="fg-mafian-app.apk"');
      const size = cdn.headers.get('content-length'); if (size) res.setHeader('Content-Length', size);
      await pipeline(Readable.fromWeb(cdn.body), res);
      await recordCompletedDownload(req, buildId);
      return;
    }
    if (assetResponse.ok && assetResponse.body) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="fg-mafian-app.apk"');
      const size = assetResponse.headers.get('content-length'); if (size) res.setHeader('Content-Length', size);
      await pipeline(Readable.fromWeb(assetResponse.body), res);
      await recordCompletedDownload(req, buildId);
      return;
    }
    return res.status(502).json({ error: `GitHub could not provide the APK download (HTTP ${assetResponse.status}).` });
  } catch (error) {
    console.error('APK download error:', error);
    if (!res.headersSent) return res.status(502).json({ error: 'Could not prepare the APK download. Please try again.' });
    // A stream already ended: logging failure here does not turn a delivered APK
    // into a failed HTTP response. Tracking is retried only on another request.
  }
         }
      
