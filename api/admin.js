const json = (res, status, body) => res.status(status).json(body);
const supabaseRequest = async (url, key, path, options = {}) => fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
  ...options,
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return json(res, 405, { error: 'Method not allowed.' }); }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS = '' } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(res, 503, { error: 'Admin service is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(res, 401, { error: 'Sign in with an administrator account.' });
  try {
    const auth = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } });
    if (!auth.ok) return json(res, 401, { error: 'Your session is invalid or expired. Sign in again.' });
    const user = await auth.json();
    const allowed = ADMIN_EMAILS.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!user.email || !allowed.includes(user.email.toLowerCase())) return json(res, 403, { error: 'This account is not listed as a platform administrator.' });
    const root = SUPABASE_URL.replace(/\/$/, '');
    const key = SUPABASE_SERVICE_ROLE_KEY;
    if (req.method === 'GET') {
      const [profilesRes, projectsRes] = await Promise.all([
        supabaseRequest(root, key, 'profiles?select=id,email,display_name,role,plan,is_blocked,created_at&order=created_at.desc&limit=200'),
        supabaseRequest(root, key, 'projects?select=id,user_id,name,package_id,created_at&order=created_at.desc&limit=100')
      ]);
      if (!profilesRes.ok || !projectsRes.ok) throw new Error('Could not load admin data. Run supabase/schema.sql in your Supabase SQL editor.');
      return json(res, 200, { ok: true, admin: user.email, users: await profilesRes.json(), projects: await projectsRes.json() });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (body.action === 'user-update') {
      if (!/^[0-9a-f-]{36}$/i.test(String(body.userId || ''))) return json(res, 400, { error: 'A valid user ID is required.' });
      const patch = {};
      if (['free', 'premium'].includes(body.plan)) patch.plan = body.plan;
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
  
