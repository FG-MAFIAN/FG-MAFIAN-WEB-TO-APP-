const getEnv = req => req?.env || process.env;
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const configuredUrl = String(getEnv(req).SUPABASE_URL || '').trim();
  const url = configuredUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');
  const anonKey = String(getEnv(req).SUPABASE_ANON_KEY || '').trim();
  const missing = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!anonKey) missing.push('SUPABASE_ANON_KEY');
  const validUrl = /^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(url);
  const configured = missing.length === 0 && validUrl;
  return res.status(200).json({
    configured, missing,
    url: configured ? url : null,
    anonKey: configured ? anonKey : null,
    reason: !validUrl && url ? 'SUPABASE_URL must be your Supabase project URL, such as https://project-ref.supabase.co' : undefined
  });
}
