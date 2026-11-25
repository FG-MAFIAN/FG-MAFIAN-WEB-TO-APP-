import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

(() => {
  const $ = id => document.getElementById(id);
  const list = $('buildList');
  const empty = $('noBuild');
  const refreshButton = $('refreshBuilds');
  if (!list || !empty) return;

  const generic = 'Something went wrong. Please try again.';
  const activeStatuses = new Set(['queued', 'waiting', 'requested', 'pending', 'in_progress']);
  let client = null;
  let session = null;
  let rows = [];
  let refreshTimer = null;
  let refreshing = false;

  function node(tag, cls, value) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (value !== undefined) el.textContent = value;
    return el;
  }

  function statusLabel(status) {
    return ({
      queued: 'Waiting to start',
      waiting: 'Waiting to start',
      requested: 'Waiting to start',
      pending: 'Waiting to start',
      in_progress: 'Building your app',
      success: 'APK ready',
      failure: 'Build failed',
      cancelled: 'Build cancelled'
    })[status] || 'Status unavailable';
  }

  function updateStats(){const total=rows.length,ready=rows.filter(r=>r.settings?.status==='success').length,active=rows.filter(r=>activeStatuses.has(r.settings?.status)).length;const put=(id,n)=>{const e=document.getElementById(id);if(e)e.textContent=String(n)};put('statTotal',total);put('statReady',ready);put('statActive',active);}

  function renderProject(row) {
    const card = node('article', 'saved-project');
    const title = node('b', '', row.name || 'Untitled app');
    const details = node('small', '', `${row.package_id || 'Android app'} · ${new Date(row.created_at).toLocaleString()}`);
    const status = node('p', 'muted', 'Checking build status…');
    const actions = node('div', 'hero-actions');
    card.append(title, details, status, actions);
    list.append(card);

    return async () => {
      const settings = row.settings || {};
      const rebuild = node('a','btn btn-ghost','Edit / rebuild');
      const rebuildUrl = new URL('/create-app', location.origin);
      rebuildUrl.searchParams.set('site', row.site_url || '');
      rebuildUrl.searchParams.set('name', row.name || '');
      rebuildUrl.searchParams.set('package', row.package_id || '');
      rebuild.href = rebuildUrl.pathname + rebuildUrl.search;
      const remove = node('button','btn btn-ghost','Delete');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!confirm('Delete this saved project from your account? This does not cancel a running GitHub build.')) return;
        remove.disabled = true;
        try {
          const { error } = await client.from('projects').delete().eq('id',row.id).eq('user_id',session.user.id);
          if (error) throw error;
          card.remove();
          rows = rows.filter(item => item.id !== row.id);
          updateStats();
          empty.classList.toggle('hidden',rows.length>0);
        } catch { status.textContent = 'Could not delete this project. Please try again.'; remove.disabled = false; }
      });
      actions.append(rebuild,remove);
      if (!row.build_id) {
        status.textContent = 'Saved project · no build has been linked yet';
        const create = node('a', 'btn btn-primary', 'Create APK');
        create.href = '/create-app';
        actions.replaceChildren(create);
        return false;
      }

      try {
        const query = settings.run_id
          ? `run_id=${encodeURIComponent(settings.run_id)}`
          : `build_id=${encodeURIComponent(row.build_id)}`;
        const response = await fetch('/api/status?' + query, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(generic);

        status.textContent = statusLabel(data.status);
        const updatedSettings = { ...settings, status: data.status || 'unknown' };
        if (data.runId) updatedSettings.run_id = data.runId;

        if (data.status === 'success' && data.downloadUrl) {
          const download = node('a', 'btn btn-primary', 'Download APK');
          download.href = data.downloadUrl;
          actions.replaceChildren(download);
          updatedSettings.download_url = data.downloadUrl;
        } else if (['failure', 'cancelled'].includes(data.status)) {
          const retry = node('a', 'btn btn-ghost', 'Build again');
          retry.href = '/create-app';
          actions.replaceChildren(retry);
        } else {
          actions.replaceChildren(node('span', 'fine-print', 'This page checks progress automatically.'));
        }

        if (JSON.stringify(updatedSettings) !== JSON.stringify(settings)) {
          row.settings = updatedSettings;
          updateStats();
          await client.from('projects')
            .update({ settings: updatedSettings })
            .eq('id', row.id)
            .eq('user_id', session.user.id);
        }
        return activeStatuses.has(data.status);
      } catch {
        status.textContent = generic;
        return false;
      }
    };
  }

  async function refreshAll() {
    if (refreshing || !client || !session) return;
    refreshing = true;
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = 'Refreshing…';
    }
    try {
      const checks = Array.from(list.children).map(card => card.__refresh).filter(Boolean);
      const results = await Promise.all(checks.map(check => check()));
      const active = results.some(Boolean);
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = active ? setTimeout(refreshAll, 12000) : null;
    } finally {
      refreshing = false;
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Refresh now';
      }
    }
  }

  async function start() {
    try {
      const configResponse = await fetch('/api/config', { cache: 'no-store' });
      const config = await configResponse.json();
      if (!config.configured) throw new Error('auth');
      client = createClient(config.url, config.anonKey);
      const result = await client.auth.getSession();
      session = result.data.session;
      if (!session) {
        location.replace('/account#login');
        return;
      }

      const { data, error } = await client.from('projects')
        .select('id,name,package_id,site_url,created_at,settings,build_id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      rows = data || [];
      updateStats();
      list.replaceChildren();
      empty.classList.toggle('hidden', rows.length > 0);
      rows.forEach(row => {
        const check = renderProject(row);
        list.lastElementChild.__refresh = check;
      });

      if (!rows.length) {
        empty.classList.remove('hidden');
        const heading = empty.querySelector('h3');
        const paragraph = empty.querySelector('p');
        if (heading) heading.textContent = 'No apps yet';
        if (paragraph) paragraph.textContent = 'Create your first Android app and it will appear here.';
      } else {
        refreshAll();
      }
    } catch {
      empty.classList.remove('hidden');
      const heading = empty.querySelector('h3');
      const paragraph = empty.querySelector('p');
      const link = empty.querySelector('a');
      if (heading) heading.textContent = 'Sign in to view your apps';
      if (paragraph) paragraph.textContent = 'Your saved apps and build history are private to your account.';
      if (link) {
        link.href = '/account#login';
        link.textContent = 'Sign in';
      }
      list.replaceChildren();
    }
  }

  refreshButton?.addEventListener('click', refreshAll);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && rows.length) refreshAll();
  });
  start();
})();
