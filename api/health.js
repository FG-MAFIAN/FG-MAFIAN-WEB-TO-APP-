const getEnv = req => req?.env || process.env;

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  const env = getEnv(req);
  const missing = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'].filter(key => !env[key]);
  return res.status(200).json({
    ok: true,
    service: 'AppForge',
    buildReady: missing.length === 0,
    missingBuildSettings: missing,
    optionalRateLimitConfigured: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
  });
}
