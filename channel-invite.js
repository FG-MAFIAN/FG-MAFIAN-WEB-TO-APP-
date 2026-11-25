import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

(() => {
  const box = document.getElementById('channelInvite');
  if (!box || location.pathname === '/admin' || location.pathname === '/admin.html') return;

  const closeButtons = [
    document.getElementById('channelInviteClose'),
    document.getElementById('channelInviteLater')
  ].filter(Boolean);
  const neverButton = document.getElementById('channelInviteNever');
  const lastKey = 'appforge_channel_last';
  const interval = 30 * 60 * 1000;
  let client = null;
  let signedInUser = null;
  let timer = null;

  function neverKey() {
    return signedInUser?.id ? `appforge_channel_never:${signedInUser.id}` : '';
  }

  function isSuppressed() {
    const key = neverKey();
    if (!key) return false;
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
  }

  function syncControls() {
    if (neverButton) neverButton.hidden = !signedInUser;
    if (signedInUser && isSuppressed()) box.hidden = true;
  }

  async function refreshSession() {
    try {
      if (!client) {
        const response = await fetch('/api/config', { cache: 'no-store' });
        const config = await response.json();
        if (config.configured) client = createClient(config.url, config.anonKey);
      }
      if (client) {
        const { data } = await client.auth.getSession();
        signedInUser = data?.session?.user || null;
        client.auth.onAuthStateChange((_event, session) => {
          signedInUser = session?.user || null;
          syncControls();
        });
      }
    } catch {
      signedInUser = null;
    }
    syncControls();
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    let last = 0;
    try { last = Number(localStorage.getItem(lastKey) || 0); } catch {}
    const wait = last ? Math.max(0, interval - (Date.now() - last)) : interval;
    timer = setTimeout(show, wait);
  }

  async function show() {
    await refreshSession();
    if (isSuppressed()) return;
    if (!box.hidden) { schedule(); return; }
    box.hidden = false;
    try { localStorage.setItem(lastKey, String(Date.now())); } catch {}
    schedule();
  }

  function dismiss() {
    box.hidden = true;
  }

  closeButtons.forEach(button => button.addEventListener('click', dismiss));
  neverButton?.addEventListener('click', () => {
    const key = neverKey();
    if (!key) return;
    try { localStorage.setItem(key, '1'); } catch {}
    if (timer) clearTimeout(timer);
    box.hidden = true;
  });

  refreshSession().finally(schedule);
})();
