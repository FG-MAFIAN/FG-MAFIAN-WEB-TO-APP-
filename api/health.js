export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'Method not allowed.' }); }
  const githubConfigured = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO);
  const trackingConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const limit = Number.parseInt(process.env.DOWNLOAD_LIMIT_PER_HOUR || '3', 10);
  const validLimit = Number.isInteger(limit) && limit >= 0;
  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const adminConfigured = Boolean(process.env.ADMIN_EMAILS);
  return res.status(200).json({
    ok: true, ready: githubConfigured && trackingConfigured && validLimit,
    service: 'FG MAFIAN API', workflow: '.github/workflows/build-apk.yml',
    configuration: { github: githubConfigured, atomicDownloadTracking: trackingConfigured,
      downloadLimitPerHour: validLimit ? limit : null, downloadLimitConfigurationValid: validLimit,
      supabaseAccounts: supabaseConfigured, adminAllowlist: adminConfigured },
    endpoints: ['/api/build', '/api/status', '/api/download', '/api/health', '/api/config', '/api/admin', '/api/maintenance']
  });
}
