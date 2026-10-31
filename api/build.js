import { randomUUID, createHash } from 'node:crypto';

const MAX_BODY_BYTES = 145000;
const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const PACKAGE_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function fail(res, status, error) {
  return res.status(status).json({ ok: false, error });
}
function getBody(req) {
  if (Number(req.headers?.['content-length'] || 0) > MAX_BODY_BYTES) {
    throw new Error('Request is too large. Reduce the logo image sizes and try again.');
  }
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) throw new Error('Request is too large.');
    return JSON.parse(req.body);
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new Error('A valid JSON request body is required.');
  if (Buffer.byteLength(JSON.stringify(req.body), 'utf8') > MAX_BODY_BYTES) throw new Error('Request is too large.');
  return req.body;
}
function validate(body) {
  const {
    siteUrl, appName, appId, orientation, themeColor, splashColor, versionName = '1.0.0', versionCode = '1',
    logoData = '', splashLogoData = '', description = '',
    displayMode = 'standalone', pullRefresh = true, navControls = false
  } = body;
  let url;
  if (typeof siteUrl !== 'string' || siteUrl.length > 2048) throw new Error('Website URL must be 2,048 characters or fewer.');
  try { url = new URL(siteUrl); } catch { throw new Error('Enter a valid website URL, including https://.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Use a public HTTPS website URL without a username or password.');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local')) throw new Error('Local website addresses cannot be packaged. Use a public HTTPS website.');
  if (typeof appName !== 'string' || !appName.trim() || appName.trim().length > 40) throw new Error('App name must contain 1–40 characters.');
  if (typeof appId !== 'string' || !PACKAGE_RE.test(appId) || appId.length > 180) throw new Error('Invalid Android package ID. Use a format such as com.company.app.');
  if (typeof versionName !== 'string' || !/^[0-9A-Za-z][0-9A-Za-z._+-]{0,19}$/.test(versionName)) throw new Error('Version name must be 1–20 characters using letters, numbers, dots, underscores, plus or hyphens.');
  if (!/^[1-9][0-9]{0,8}$/.test(String(versionCode))) throw new Error('Version code must be a positive whole number up to 9 digits.');
  if (!['portrait', 'landscape', 'any'].includes(orientation)) throw new Error('Invalid screen orientation.');
  if (!['fullscreen', 'standalone'].includes(displayMode)) throw new Error('Invalid display mode.');
  if (typeof pullRefresh !== 'boolean' || typeof navControls !== 'boolean') throw new Error('Invalid navigation settings.');
  if (!COLOR_RE.test(themeColor) || !COLOR_RE.test(splashColor)) throw new Error('Theme and splash colors must be valid six-digit hex colors.');
  if (typeof description !== 'string' || description.length > 180) throw new Error('App description must be 180 characters or fewer.');
  for (const [label, value] of [['home-screen', logoData], ['opening-screen', splashLogoData]]) {
    if (typeof value !== 'string' || value.length > 31000 || (value && !IMAGE_RE.test(value))) {
      throw new Error(`The ${label} logo is too large or unsupported. Use a PNG, JPG or WebP image under about 22 KB.`);
    }
  }
  return {
    site_url: url.href, app_name: appName.trim(), app_id: appId, version_name: versionName, version_code: String(versionCode), orientation,
    theme_color: themeColor, splash_color: splashColor, logo_data: logoData,
    splash_logo_data: splashLogoData, app_description: description.trim(),
    display_mode: displayMode, pull_refresh: String(pullRefresh),
    nav_controls: String(navControls)
  };
}

function clientKey(req) {
  const realIp = String(req.headers?.['x-real-ip'] || '').trim();
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',').pop().trim();
  const ip = realIp || forwarded || 'unknown';
  return createHash('sha256').update(ip).digest('hex');
}

async function redisCommand(command) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    const error = new Error('Download tracking is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.');
    error.status = 503;
    throw error;
  }
  let response;
  try {
    response = await fetch(UPSTASH_REDIS_REST_URL.replace(/\/+$/, ''), {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command)
    });
  } catch {
    const error = new Error('Could not contact the download tracking service. Please try again later.');
    error.status = 503;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('Could not verify download usage. Please try again later.');
    error.status = 503;
    throw error;
  }
  const payload = await response.json();
  if (payload.error) {
    const error = new Error('Download tracking returned an invalid response.');
    error.status = 503;
    throw error;
  }
  return payload.result;
}

// This is a read-only check. Only a completed, streamed APK download is counted.
async function checkDownloadAllowance(req) {
  const limit = Number.parseInt(process.env.DOWNLOAD_LIMIT_PER_HOUR || '3', 10);
  if (!Number.isInteger(limit) || limit < 0) throw new Error('DOWNLOAD_LIMIT_PER_HOUR must be a non-negative integer.');
  if (limit === 0) return;
  const key = `fgmafian:downloads:${clientKey(req)}`;
  const count = await redisCommand(['ZCOUNT', key, String(Date.now() - 3600000), '+inf']);
  if (Number(count) >= limit) {
    const error = new Error(`Download limit reached. You can download up to ${limit} APKs per hour from this network.`);
    error.status = 429;
    throw error;
  }
}
async function githubRequest(url, token, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'Method not allowed.'); }

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH = 'main' } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) return fail(res, 500, 'Build service is not configured. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO in Vercel.');

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const settingUrl = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/platform_settings?key=eq.maintenance&select=value&limit=1`;
      const setting = await fetch(settingUrl, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
      if (setting.ok) {
        const rows = await setting.json();
        if (rows[0]?.value?.enabled) return fail(res, 503, rows[0]?.value?.message || 'The builder is temporarily in maintenance mode. Please try again later.');
      }
    } catch { return fail(res, 503, 'Could not verify builder availability. Please try again later.'); }
  }

  let inputs;
  try {
    const body = getBody(req);
    inputs = validate(body);
    await checkDownloadAllowance(req);
  } catch (error) {
    return fail(res, error.status || 400, error.message || 'Invalid build request.');
  }

  const buildId = randomUUID();
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/actions/workflows/build-apk.yml/dispatches`;
  try {
    const dispatch = await githubRequest(endpoint, GITHUB_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: GITHUB_BRANCH, inputs: { ...inputs, build_id: buildId } })
    });
    if (!dispatch.ok) {
      const detail = (await dispatch.text()).slice(0, 300);
      return fail(res, 502, `GitHub rejected the build request (HTTP ${dispatch.status}). ${detail}`);
    }

    // workflow_dispatch returns HTTP 204, not a run ID. Match our unique run-name.
    const runsUrl = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/actions/workflows/build-apk.yml/runs?event=workflow_dispatch&per_page=20`;
    let run = null;
    for (let attempt = 0; attempt < 5 && !run; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 450));
      const response = await githubRequest(runsUrl, GITHUB_TOKEN);
      if (!response.ok) continue;
      const data = await response.json();
      run = (data.workflow_runs || []).find(item => item.display_title === `FG MAFIAN APK ${buildId}`);
    }
    return res.status(202).json({
      ok: true, buildId, runId: run?.id || null,
      status: run?.status || 'queued',
      startedAt: run?.created_at || new Date().toISOString(),
      appName: inputs.app_name, siteUrl: inputs.site_url, appId: inputs.app_id,
      message: run ? 'Build started.' : 'Build dispatched. GitHub is registering the workflow; status lookup will attach to this unique build.'
    });
  } catch (error) {
    console.error('Build dispatch error:', error);
    return fail(res, 502, 'Could not contact GitHub to start the APK build. Please try again.');
  }
}

export const config = { maxDuration: 10 };
    
