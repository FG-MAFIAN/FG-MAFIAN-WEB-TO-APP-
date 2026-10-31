const headersFor = token => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) return res.status(500).json({ error: 'Build status is not configured in Vercel.' });

  const runId = String(req.query?.run_id || '');
  const buildId = String(req.query?.build_id || '');
  if ((!/^\d{1,20}$/.test(runId)) && !/^[0-9a-f-]{36}$/i.test(buildId)) {
    return res.status(400).json({ error: 'A valid run_id or build_id is required.' });
  }

  const base = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}`;
  const headers = headersFor(GITHUB_TOKEN);
  try {
    let run = null;
    if (/^\d{1,20}$/.test(runId)) {
      const response = await fetch(`${base}/actions/runs/${runId}`, { headers });
      if (response.status === 404) return res.status(404).json({ error: 'That GitHub build run was not found.' });
      if (!response.ok) return res.status(502).json({ error: `GitHub status lookup failed (HTTP ${response.status}).` });
      run = await response.json();
    } else {
      const response = await fetch(`${base}/actions/workflows/build-apk.yml/runs?event=workflow_dispatch&per_page=50`, { headers });
      if (!response.ok) return res.status(502).json({ error: `GitHub status lookup failed (HTTP ${response.status}).` });
      const payload = await response.json();
      run = (payload.workflow_runs || []).find(item => item.display_title === `FG MAFIAN APK ${buildId}`);
      if (!run) return res.status(200).json({ status: 'queued', buildId, message: 'Waiting for GitHub to register this build.' });
    }

    if (run.path !== '.github/workflows/build-apk.yml' || run.event !== 'workflow_dispatch') {
      return res.status(403).json({ error: 'The requested run does not belong to the FG MAFIAN APK workflow.' });
    }
    const common = { runId: run.id, runUrl: run.html_url, status: run.status };
    if (run.status === 'queued' || run.status === 'waiting' || run.status === 'requested' || run.status === 'pending') {
      return res.status(200).json({ ...common, status: 'queued' });
    }
    if (run.status === 'in_progress') return res.status(200).json({ ...common, status: 'in_progress' });
    if (run.status !== 'completed') return res.status(200).json({ ...common, status: 'in_progress' });

    if (run.conclusion === 'success') {
      return res.status(200).json({ ...common, status: 'success', downloadUrl: `/api/download?run_id=${encodeURIComponent(run.id)}`, message: 'Your APK is ready to download.' });
    }
    if (run.conclusion === 'cancelled') return res.status(200).json({ ...common, status: 'cancelled', message: 'This APK build was cancelled.' });
    return res.status(200).json({ ...common, status: 'failure', message: `The Android build ${run.conclusion || 'failed'}. Open the GitHub Actions logs for details.` });
  } catch (error) {
    console.error('Status lookup error:', error);
    return res.status(502).json({ error: 'Could not contact GitHub to check this build.' });
  }
        }
