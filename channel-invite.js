(() => {
  const box = document.getElementById('channelInvite');
  if (!box || location.pathname === '/admin' || location.pathname === '/admin.html') return;

  const closeButtons = [
    document.getElementById('channelInviteClose'),
    document.getElementById('channelInviteLater')
  ].filter(Boolean);

  // Show the invitation on every fresh visit. Dismissal lasts only until
  // this page is left or reloaded; there is no permanent "never show" choice.
  function dismiss() {
    box.hidden = true;
  }

  closeButtons.forEach(button => button.addEventListener('click', dismiss));
  box.hidden = false;
})();