(() => {
  'use strict';
  document.documentElement.dataset.theme = 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = '#f5f7fa';
})();
