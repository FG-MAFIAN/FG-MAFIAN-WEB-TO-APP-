export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const configured = Boolean(url && anonKey && /^https:\/\//.test(url));
  return res.status(200).json({ configured, url: configured ? url : null, anonKey: configured ? anonKey : null });
}
