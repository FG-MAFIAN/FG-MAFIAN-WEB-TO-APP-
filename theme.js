(() => {
  'use strict';
  const root = document.documentElement;
  const key = 'fgmafian_theme';
  const readTheme = () => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'light';
  };
  const applyTheme = theme => {
    root.dataset.theme = theme;
    const button = document.querySelector('.theme-toggle');
    if (button) {
      button.textContent = theme === 'dark' ? '☀ Light mode' : '☾ Dark mode';
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      button.setAttribute('aria-pressed', String(theme === 'light'));
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = theme === 'dark' ? '#070914' : '#f4f7fb';
    }
  };
  const header = document.querySelector('.topbar');
  if (header && !header.querySelector('.theme-toggle')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, next); } catch {}
      applyTheme(next);
    });
    const contact = header.querySelector('.contact-mini');
    if (contact) header.insertBefore(button, contact);
    else header.appendChild(button);
  }
  applyTheme(readTheme());
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', event => {
    let saved = null;
    try { saved = localStorage.getItem(key); } catch {}
    if (saved !== 'light' && saved !== 'dark') applyTheme(event.matches ? 'light' : 'dark');
  });
})();
