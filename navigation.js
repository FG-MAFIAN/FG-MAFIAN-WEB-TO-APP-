(() => {
  const menu = document.querySelector('.home-menu');
  if (!menu) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'home-menu-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.appendChild(backdrop);
  const summary = menu.querySelector('summary');
  const links = [...menu.querySelectorAll('.home-menu-items a')];
  const current = location.pathname.replace(/\\/$/, '') || '/';
  links.forEach(link => {
    try {
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && (url.pathname.replace(/\\/$/, '') || '/') === current) link.setAttribute('aria-current','page');
    } catch {}
  });
  function setOpen(open) {
    menu.open = open;
    backdrop.classList.toggle('is-visible', open);
    document.body.classList.toggle('home-menu-open', open);
    summary?.setAttribute('aria-expanded', String(open));
  }
  menu.addEventListener('toggle', () => {
    backdrop.classList.toggle('is-visible', menu.open);
    document.body.classList.toggle('home-menu-open', menu.open);
    summary?.setAttribute('aria-expanded', String(menu.open));
  });
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.open) { setOpen(false); summary?.focus(); } });
  links.forEach(link => link.addEventListener('click', () => setOpen(false)));
  summary?.setAttribute('aria-expanded','false');
})();