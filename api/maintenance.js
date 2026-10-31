export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(200).json({ enabled: false, configured: false });
  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/platform_settings?key=eq.maintenance&select=value&limit=1`, { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!response.ok) return res.status(200).json({ enabled: false, configured: false });
    const rows = await response.json();
    return res.status(200).json({ enabled: Boolean(rows[0]?.value?.enabled), message: rows[0]?.value?.message || '' });
  } catch { return res.status(200).json({ enabled: false, configured: false }); }
}
