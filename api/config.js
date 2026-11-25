export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const url = String(process.env.SUPABASE_URL || '').trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  const missing = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!anonKey) missing.push('SUPABASE_ANON_KEY');
  const validUrl = /^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(url);
  const configured = missing.length === 0 && validUrl;
  return res.status(200).json({
    configured, missing,
    url: configured ? url.replace(/\/$/, '') : null,
    anonKey: configured ? anonKey : null,
    reason: !validUrl && url ? 'SUPABASE_URL must be your Supabase project URL, such as https://project-ref.supabase.co' : undefined
  });
}
