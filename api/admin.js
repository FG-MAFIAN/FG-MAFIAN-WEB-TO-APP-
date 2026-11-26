const getEnv = req => req?.env || process.env;
const json = (res, status, body) => res.status(status).json(body);
const supabaseRequest = async (url, key, path, options = {}) => fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
  ...options,
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return json(res, 405, { error: 'Method not allowed.' }); }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS = '' } = getEnv(req);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(res, 503, { error: 'Admin service is not configured. Check the platform environment variables in Cloudflare Pages.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(res, 401, { error: 'Administrator authorization is required.' });
  try {
    const auth = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: getEnv(req).SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } });
    if (!auth.ok) return json(res, 401, { error: 'Administrator authorization is invalid or expired.' });
    const user = await auth.json();
    const allowed = ADMIN_EMAILS.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!user.email || !allowed.includes(user.email.toLowerCase())) return json(res, 403, { error: 'This account is not listed as a platform administrator.' });
    const root = SUPABASE_URL.replace(/\/$/, '');
    const key = SUPABASE_SERVICE_ROLE_KEY;
    if (req.method === 'GET') {
      const [profilesRes, projectsRes, logsRes] = await Promise.all([
        supabaseRequest(root, key, 'profiles?select=id,email,display_name,role,plan,is_blocked,created_at&order=created_at.desc&limit=200'),
        supabaseRequest(root, key, 'projects?select=id,user_id,name,package_id,created_at&order=created_at.desc&limit=100'),
        supabaseRequest(root, key, 'system_logs?select=id,level,source,message,path,created_at,user_id&order=created_at.desc&limit=100'),
        supabaseRequest(root, key, 'app_ratings?select=id,user_id,build_id,app_name,package_id,rating,reason,created_at,profiles(email)&order=created_at.desc&limit=200')
      ]);
      if (!profilesRes.ok || !projectsRes.ok) throw new Error('Could not load admin data. Run supabase/schema.sql in your Supabase SQL editor.');
      return json(res, 200, { ok: true, admin: user.email, users: await profilesRes.json(), projects: await projectsRes.json(), systemLogs: logsRes.ok ? await logsRes.json() : [], ratings: ratingsRes.ok ? await ratingsRes.json() : [], diagnostics: { github: Boolean(getEnv(req).GITHUB_TOKEN && getEnv(req).GITHUB_OWNER && getEnv(req).GITHUB_REPO), supabase: Boolean(getEnv(req).SUPABASE_URL && getEnv(req).SUPABASE_ANON_KEY && getEnv(req).SUPABASE_SERVICE_ROLE_KEY), authConnection: Boolean(getEnv(req).SUPABASE_URL && getEnv(req).SUPABASE_ANON_KEY), downloadTracking: Boolean(getEnv(req).UPSTASH_REDIS_REST_URL && getEnv(req).UPSTASH_REDIS_REST_TOKEN) } });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (body.action === 'user-update') {
      if (!/^[0-9a-f-]{36}$/i.test(String(body.userId || ''))) return json(res, 400, { error: 'A valid user ID is required.' });
      const patch = {};
      if (typeof body.isBlocked === 'boolean') patch.is_blocked = body.isBlocked;
      if (!Object.keys(patch).length) return json(res, 400, { error: 'No valid account changes were supplied.' });
      const update = await supabaseRequest(root, key, `profiles?id=eq.${encodeURIComponent(body.userId)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) });
      if (!update.ok) throw new Error('Could not update this account. Check that the Supabase schema is installed.');
      return json(res, 200, { ok: true, profile: (await update.json())[0] || null });
    }
    if (body.action === 'maintenance') {
      if (typeof body.enabled !== 'boolean') return json(res, 400, { error: 'Maintenance state must be true or false.' });
      const update = await supabaseRequest(root, key, 'platform_settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ key: 'maintenance', value: { enabled: body.enabled, message: String(body.message || 'We are performing maintenance. Please try again soon.').slice(0, 240), updated_by: user.email, updated_at: new Date().toISOString() } }) });
      if (!update.ok) throw new Error('Could not save maintenance settings. Run the supplied Supabase SQL setup first.');
      return json(res, 200, { ok: true, maintenance: body.enabled });
    }
    return json(res, 400, { error: 'Unknown admin action.' });
  } catch (error) {
    console.error('Admin API error:', error);
    return json(res, 500, { error: error.message || 'Admin request failed.' });
  }
  }
  
