const getEnv = req => req?.env || process.env;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(202).json({ ok: true }); }
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = getEnv(req);
  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !token) return res.status(202).json({ ok: true });
  try {
    const root = SUPABASE_URL.replace(/\/$/, '');
    const auth = await fetch(`${root}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
    if (!auth.ok) return res.status(202).json({ ok: true });
    const user = await auth.json();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const message = String(body.message || 'Unspecified client error').slice(0, 1200);
    const source = String(body.source || 'website').slice(0, 80);
    const path = String(body.path || '/').slice(0, 240);
    const result = await fetch(`${root}/rest/v1/system_logs`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ level: 'error', source, message, path, user_id: user.id })
    });
    if (!result.ok) console.error('Could not save a private system log:', result.status);
    return res.status(202).json({ ok: true });
  } catch (error) {
    console.error('Private system log endpoint failed:', error);
    return res.status(202).json({ ok: true });
  }
}
