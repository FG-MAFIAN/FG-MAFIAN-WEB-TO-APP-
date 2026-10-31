(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const noBuild = $('noBuild');
  const list = $('buildList');
  if (!noBuild || !list) return;

  function loadBuilds() {
    try {
      const rows = JSON.parse(localStorage.getItem('fgmafian_build_history') || '[]');
      return Array.isArray(rows) ? rows.filter(item => item && (item.runId || item.buildId)) : [];
    } catch { return []; }
  }
  function saveBuilds(rows) {
    try { localStorage.setItem('fgmafian_build_history', JSON.stringify(rows.slice(0, 20))); } catch {}
  }
  let builds = loadBuilds();
  if (!builds.length) {
    try {
      const latest = JSON.parse(localStorage.getItem('fgmafian_latest_build') || 'null');
      if (latest && (latest.runId || latest.buildId)) { builds = [latest]; saveBuilds(builds); }
    } catch {}
  }

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function render() {
    noBuild.classList.toggle('hidden', builds.length > 0);
    list.classList.toggle('hidden', builds.length === 0);
    list.replaceChildren();
    builds.forEach((build, index) => {
      const card = element('article', 'glass', undefined);
      card.style.cssText = 'padding:20px;margin:0 0 16px;border-radius:8px';
      const top = element('p', 'eyebrow', index === 0 ? 'LATEST BUILD' : `PREVIOUS BUILD ${index + 1}`);
      const name = element('h3', '', build.appName || 'Your app');
      const time = element('p', 'muted', `${build.siteUrl || ''} • Started ${build.startedAt ? new Date(build.startedAt).toLocaleString() : 'time unavailable'}`);
      const status = element('h3', '', statusLabel(build.status));
      status.dataset.status = '1';
      const message = element('p', 'muted', build.message || 'Checking build status…');
      message.dataset.message = '1';
      card.append(top, name, time, status, message);
      if (build.downloadUrl && build.status === 'success') {
        const link = element('a', 'btn btn-primary', 'Download APK');
        link.href = build.downloadUrl; link.setAttribute('download', 'fg-mafian-app.apk');
        card.append(link);
      } else if (build.runUrl && ['failure', 'cancelled'].includes(build.status)) {
        const link = element('a', 'btn btn-ghost', 'View build logs');
        link.href = build.runUrl; link.target = '_blank'; link.rel = 'noopener';
        card.append(link);
      }
      card.dataset.buildId = build.buildId || String(build.runId);
      list.append(card);
    });
  }
  function statusLabel(status) {
    return ({ queued: 'Queued', waiting: 'Queued', requested: 'Queued', in_progress: 'Building APK…', success: 'APK ready', failure: 'Build failed', cancelled: 'Build cancelled' })[status] || 'Checking build status…';
  }
  async function readResponse(response) {
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error(`Server returned an invalid response (HTTP ${response.status}).`); }
    if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
    return data;
  }
  async function refreshOne(build) {
    const query = build.runId ? `run_id=${encodeURIComponent(build.runId)}` : `build_id=${encodeURIComponent(build.buildId)}`;
    const response = await fetch(`/api/status?${query}`, { cache: 'no-store' });
    const data = await readResponse(response);
    if (data.runId) build.runId = data.runId;
    build.status = data.status;
    build.message = data.message || '';
    build.runUrl = data.runUrl || build.runUrl;
    if (data.downloadUrl) build.downloadUrl = data.downloadUrl;
  }
  let busy = false;
  async function refreshAll() {
    if (busy) return;
    busy = true;
    try {
      const pending = builds.filter(item => ['queued', 'waiting', 'requested', 'in_progress', undefined].includes(item.status));
      await Promise.all(pending.map(async build => {
        try { await refreshOne(build); }
        catch (error) { build.message = error.message || 'Could not refresh this build.'; }
      }));
      saveBuilds(builds); render();
    } finally { busy = false; }
  }
  render();
  refreshAll().then(scheduleRefresh);
  $('refreshBuilds')?.addEventListener('click', refreshAll);
  let pollTimer = null;
  function scheduleRefresh() {
    if (pollTimer) clearTimeout(pollTimer);
    if (builds.some(item => ['queued', 'waiting', 'requested', 'in_progress', undefined].includes(item.status))) {
      pollTimer = setTimeout(async () => { pollTimer = null; await refreshAll(); scheduleRefresh(); }, 15000);
    }
  }
  scheduleRefresh();
})();
