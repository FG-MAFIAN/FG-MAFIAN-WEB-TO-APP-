import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';

function clientKey(req) {
  const ip = String(
    req.headers?.['cf-connecting-ip'] ||
    req.headers?.['x-real-ip'] ||
    String(req.headers?.['x-forwarded-for'] || '').split(',')[0] ||
    'unknown'
  ).trim();
  return createHash('sha256').update(ip).digest('hex');
}

function downloadLimit() {
  const raw = process.env.DOWNLOAD_LIMIT_PER_HOUR;
  if (raw === undefined || raw === '') return 3;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : 3;
}

async function redisEval(script, keys, args) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) throw new Error('Download tracking is not configured.');
  const response = await fetch(UPSTASH_REDIS_REST_URL.replace(/\/+$/, ''), {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['EVAL', script, String(keys.length), ...keys, ...args.map(String)])
  });
  if (!response.ok) throw new Error('Download tracking failed.');
  const payload = await response.json();
  if (payload.error) throw new Error('Download tracking failed.');
  return payload.result;
}

async function checkDownloadAllowance(req, buildId) {
  const limit = downloadLimit();
  if (limit === 0) return;
  const key = clientKey(req);
  const usageKey = `appforge:downloads:${key}`;
  const onceKey = `appforge:downloaded:${key}:${buildId}`;
  const script = `
    redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
    local already = redis.call('EXISTS', KEYS[2])
    local count = redis.call('ZCARD', KEYS[1])
    return {already, count}
  `;
  const result = await redisEval(script, [usageKey, onceKey], [Date.now() - 3600000]);
  const already = Array.isArray(result) && Number(result[0]) === 1;
  const count = Array.isArray(result) ? Number(result[1]) : 0;
  if (!already && count >= limit) {
    const error = new Error('You have reached the download limit. Please try again in an hour.');
    error.status = 429;
    throw error;
  }
}

async function recordCompletedDownload(req, buildId) {
  const now = Date.now();
  const key = clientKey(req);
  const usageKey = `appforge:downloads:${key}`;
  const onceKey = `appforge:downloaded:${key}:${buildId}`;
  const script = `
    local already = redis.call('SET', KEYS[2], '1', 'NX', 'EX', 2592000)
    if not already then return 0 end
    redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
    redis.call('EXPIRE', KEYS[1], 7200)
    return 1
  `;
  await redisEval(script, [usageKey, onceKey], [now - 3600000, now, buildId]);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) return res.status(503).json({ error: 'Something went wrong. Please try again.' });
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return res.status(503).json({ error: 'Something went wrong. Please try again.' });

  const runId = String(req.query?.run_id || '');
  if (!/^\d{1,20}$/.test(runId)) return res.status(400).json({ error: 'Missing or invalid workflow run ID.' });
  const base = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}`;
  const headers = { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

  try {
    const runResponse = await fetch(`${base}/actions/runs/${runId}`, { headers });
    if (!runResponse.ok) return res.status(runResponse.status === 404 ? 404 : 502).json({ error: runResponse.status === 404 ? 'The requested build was not found.' : 'Something went wrong. Please try again.' });
    const run = await runResponse.json();
    if (run.path !== '.github/workflows/build-apk.yml' || run.event !== 'workflow_dispatch') return res.status(403).json({ error: 'This is not an AppForge APK build.' });
    const prefix = 'AppForge APK ';
    const buildId = String(run.display_title || '').startsWith(prefix) ? String(run.display_title).slice(prefix.length) : '';
    if (!/^[0-9a-f-]{36}$/i.test(buildId)) return res.status(403).json({ error: 'This build could not be verified.' });
    if (run.status !== 'completed' || run.conclusion !== 'success') return res.status(409).json({ error: 'This APK build is not ready yet.' });

    await checkDownloadAllowance(req, buildId);

    const tag = `apk-build-${runId}`;
    const releaseResponse = await fetch(`${base}/releases/tags/${tag}`, { headers });
    if (!releaseResponse.ok) return res.status(releaseResponse.status === 404 ? 404 : 502).json({ error: releaseResponse.status === 404 ? 'The APK release is not available yet. Refresh the build status and try again.' : 'Something went wrong. Please try again.' });
    const release = await releaseResponse.json();
    if (release.draft || release.prerelease || !String(release.body || '').includes(`Workflow Run ID: ${runId}`)) return res.status(403).json({ error: 'The APK release could not be verified.' });
    const asset = (release.assets || []).find(item => item.name === 'appforge-app.apk' && item.state === 'uploaded');
    if (!asset) return res.status(404).json({ error: 'The APK file is missing from this build.' });

    const assetResponse = await fetch(asset.url, { headers: { ...headers, Accept: 'application/octet-stream' }, redirect: 'manual' });
    const location = assetResponse.headers.get('location');
    let apkResponse = assetResponse;
    if ([301, 302, 303, 307, 308].includes(assetResponse.status) && location) {
      const target = new URL(location);
      if (target.protocol !== 'https:') return res.status(502).json({ error: 'The download source could not be verified.' });
      apkResponse = await fetch(target, { redirect: 'follow' });
    }
    if (!apkResponse.ok || !apkResponse.body) return res.status(502).json({ error: 'Something went wrong. Please try again.' });

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="appforge-app.apk"');
    const size = apkResponse.headers.get('content-length');
    if (size) res.setHeader('Content-Length', size);
    await pipeline(Readable.fromWeb(apkResponse.body), res);
    await recordCompletedDownload(req, buildId);
  } catch (error) {
    if (error.status === 429) return res.status(429).json({ error: error.message });
    console.error('APK download error:', error);
    if (!res.headersSent) return res.status(502).json({ error: 'Could not prepare the APK download. Please try again.' });
  }
}
