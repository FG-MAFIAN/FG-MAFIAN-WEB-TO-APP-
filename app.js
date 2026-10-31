// FG MAFIAN Android APK builder frontend.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const safeStorage = {
    get(key, fallback = null) { try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
  };
  let cloudClientPromise;
  function getCloudClient() {
    if (!cloudClientPromise) cloudClientPromise = (async () => {
      try {
        const config = await fetch('/api/config', { cache: 'no-store' }).then(r => r.json());
        if (!config.configured) return null;
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        return createClient(config.url, config.anonKey);
      } catch { return null; }
    })();
    return cloudClientPromise;
  }
  async function saveCloudProject(build) {
    if (!build?.buildId || !build?.appName || !build?.appId || !build?.siteUrl) return;
    const client = await getCloudClient(); if (!client) return;
    const { data } = await client.auth.getSession(); const user = data?.session?.user; if (!user) return;
    await client.from('projects').upsert({
      user_id: user.id, build_id: build.buildId, name: build.appName,
      package_id: build.appId, site_url: build.siteUrl,
      settings: { status: build.status || 'queued', run_id: build.runId || null, download_url: build.publicDownloadUrl || null, version_name: build.versionName || '1.0.0', version_code: build.versionCode || '1' }
    }, { onConflict: 'build_id' });
  }
  const maintenanceNotice = document.getElementById('maintenanceNotice');
  if (maintenanceNotice) fetch('/api/maintenance', { cache: 'no-store' }).then(r => r.json()).then(data => {
    if (data.enabled) { maintenanceNotice.textContent = data.message || 'We are performing maintenance. Please try again soon.'; maintenanceNotice.classList.remove('hidden'); }
  }).catch(() => {});

  const bg = document.querySelector('.bg-video');
  if (bg) {
    bg.muted = true; bg.loop = true; bg.playsInline = true;
    const lowPowerDevice = window.matchMedia?.('(max-width: 850px)').matches || navigator.connection?.saveData;
    // Keep mobile/data-saver browsing light: the CSS backdrop remains visible without decoding video.
    if (lowPowerDevice) {
      bg.pause();
      bg.removeAttribute('autoplay');
      bg.preload = 'none';
    } else {
      const play = () => { try { const p = bg.play(); if (p?.catch) p.catch(() => {}); } catch {} };
      play();
      document.addEventListener('visibilitychange', () => { if (!document.hidden && bg.paused) play(); });
    }
  }

  const welcome = $('welcome');
  if (welcome) {
    if (safeStorage.get('fgmafian_welcome_seen') === '1') welcome.classList.add('dismissed');
    $('continueBtn')?.addEventListener('click', () => {
      safeStorage.set('fgmafian_welcome_seen', '1');
      welcome.classList.add('dismissed');
    });
  }

  let toastTimer;
  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = String(message || 'Something went wrong.');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
  }

  async function readApiResponse(response) {
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch {
      const preview = text.replace(/\s+/g, ' ').slice(0, 180);
      if (response.status === 404) throw new Error('Vercel could not find this API route. Confirm the api folder is at the repository root and redeploy.');
      throw new Error(`The server returned a non-JSON response (HTTP ${response.status}). ${preview || 'Empty response'}`);
    }
    if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
    return data;
  }

  function normalizedUrl(value) {
    let url;
    try { url = new URL(value); } catch { throw new Error('Enter a valid website URL, including https://.'); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
      throw new Error('Enter a public HTTPS website URL without a username or password.');
    }
    return url.href;
  }

  const previewBtn = $('previewBtn');
  previewBtn?.addEventListener('click', () => {
    try { window.open(normalizedUrl($('siteUrl')?.value.trim()), '_blank', 'noopener'); }
    catch (error) { toast(error.message); }
  });
  $('siteUrl')?.addEventListener('input', event => {
    if ($('previewUrl')) $('previewUrl').textContent = event.target.value.trim() || 'Your website URL will appear here';
  });
  function updateSplashPreview() {
    const screen = $('splashPreviewScreen');
    const logo = $('splashPreviewLogo');
    const name = $('splashPreviewName');
    const color = $('splashColor')?.value || '#070914';
    if (screen) screen.style.backgroundColor = color;
    if (name) name.textContent = $('appName')?.value.trim() || 'Your app name';
    if (logo) {
      const imageData = splashLogoData || logoData;
      logo.style.backgroundImage = imageData ? `url("${imageData}")` : '';
      logo.style.backgroundColor = imageData ? 'transparent' : 'rgba(255,255,255,.12)';
      logo.textContent = imageData ? '' : 'FM';
      logo.style.backgroundSize = 'contain';
      logo.style.backgroundPosition = 'center';
      logo.style.backgroundRepeat = 'no-repeat';
    }
  }
  $('appName')?.addEventListener('input', event => {
    const name = event.target.value.trim() || 'Your app name';
    if ($('previewName')) $('previewName').textContent = name;
    updateSplashPreview();
  });
  $('splashColor')?.addEventListener('input', updateSplashPreview);
  $('themeColor')?.addEventListener('input', event => {
    const mark = $('iconPreview');
    if (mark && !logoData) mark.style.background = event.target.value;
  });

  let logoData = '';
  let splashLogoData = '';
  async function compressLogo(file) {
    if (!file) return '';
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error('Choose a PNG, JPG, WebP or SVG image.');
    if (file.size > 8 * 1024 * 1024) throw new Error('Please choose an image smaller than 8 MB.');
    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = sourceUrl;
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Could not read that logo image.')); });
      for (const size of [192, 128, 96, 64]) {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('This browser cannot process the selected image.');
        const scale = Math.min(size / image.width, size / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(image, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
        const result = canvas.toDataURL('image/webp', 0.78);
        if (result.length <= 29000) return result;
      }
      throw new Error('This logo is too large to send safely. Choose a simpler or smaller image.');
    } finally { URL.revokeObjectURL(sourceUrl); }
  }

  $('logoFile')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) { logoData = ''; if ($('iconPreview')) { $('iconPreview').style.backgroundImage = ''; $('iconPreview').textContent = 'FM'; $('iconPreview').style.background = $('themeColor')?.value || '#3978ff'; } updateSplashPreview(); return; }
    try {
      logoData = await compressLogo(file);
      if ($('iconPreview')) {
        $('iconPreview').style.backgroundImage = `url("${logoData}")`;
        $('iconPreview').style.backgroundSize = 'cover';
        $('iconPreview').style.backgroundPosition = 'center';
        $('iconPreview').textContent = '';
      }
      updateSplashPreview();
      toast('Home-screen logo prepared.');
    } catch (error) { logoData = ''; event.target.value = ''; toast(error.message); }
  });

  $('splashLogoFile')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) { splashLogoData = ''; updateSplashPreview(); return; }
    try { splashLogoData = await compressLogo(file); updateSplashPreview(); toast('Opening-screen logo prepared.'); }
    catch (error) { splashLogoData = ''; event.target.value = ''; toast(error.message); }
  });
  updateSplashPreview();

  function readBuilds() {
    try {
      const parsed = JSON.parse(safeStorage.get('fgmafian_build_history', '[]'));
      return Array.isArray(parsed) ? parsed.filter(item => item && (item.runId || item.buildId)) : [];
    } catch { return []; }
  }
  function saveBuild(build) {
    const builds = readBuilds().filter(item => item.buildId !== build.buildId && !(build.runId && String(item.runId || '') === String(build.runId)));
    builds.unshift(build);
    safeStorage.set('fgmafian_build_history', JSON.stringify(builds.slice(0, 20)));
    safeStorage.set('fgmafian_latest_build', JSON.stringify(build));
    saveCloudProject(build).catch(() => {});
  }

  let pollTimer = null;
  let polling = false;
  let activeBuild = null;
  function stopPolling() { if (pollTimer) clearTimeout(pollTimer); pollTimer = null; polling = false; }

  async function checkBuild(build) {
    if (polling || !build) return;
    polling = true;
    try {
      const query = build.runId ? `run_id=${encodeURIComponent(build.runId)}` : `build_id=${encodeURIComponent(build.buildId)}`;
      const response = await fetch(`/api/status?${query}`, { cache: 'no-store' });
      const data = await readApiResponse(response);
      if (data.runId && !build.runId) build.runId = data.runId;
      build.status = data.status;
      build.runUrl = data.runUrl || build.runUrl;
      build.lastCheckedAt = new Date().toISOString();
      saveBuild(build);

      if (data.status === 'queued' || data.status === 'in_progress') {
        if ($('buildTitle')) $('buildTitle').textContent = data.status === 'queued' ? 'Build queued…' : 'Building your APK…';
        if ($('buildMessage')) $('buildMessage').textContent = 'GitHub is preparing your Android app. You can follow progress from My Builds.';
        return;
      }
      stopPolling();
      if (data.status === 'success' && data.downloadUrl) {
        build.downloadUrl = data.downloadUrl; saveBuild(build);
        if ($('buildTitle')) $('buildTitle').textContent = 'Your APK is ready!';
        if ($('buildMessage')) $('buildMessage').textContent = 'Your APK is ready to download directly to this device.';
        const publicDownloadUrl = new URL(data.downloadUrl, window.location.origin).href;
        build.publicDownloadUrl = publicDownloadUrl; saveBuild(build);
        const link = $('downloadApk');
        if (link) {
          link.href = publicDownloadUrl; link.textContent = 'Download APK';
          link.removeAttribute('target'); link.setAttribute('download', 'fg-mafian-app.apk');
          link.classList.remove('hidden');
        }
        const copyLink = $('copyPublicDownload');
        if (copyLink) {
          copyLink.dataset.url = publicDownloadUrl;
          copyLink.classList.remove('hidden');
          copyLink.onclick = async () => {
            try {
              if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(publicDownloadUrl);
              else {
                const field = document.createElement('textarea'); field.value = publicDownloadUrl;
                field.style.position = 'fixed'; field.style.opacity = '0'; document.body.appendChild(field);
                field.select(); const copied = document.execCommand('copy'); field.remove();
                if (!copied) throw new Error('Copy is not supported by this browser.');
              }
              toast('Public download link copied. Anyone with the link can download the APK.');
            } catch { toast('Could not copy automatically. You can copy this link: ' + publicDownloadUrl); }
          };
        }
        $('publicDownloadHint')?.classList.remove('hidden');
        toast('Your APK is ready. You can download it or share its public link.');
      } else {
        const cancelled = data.status === 'cancelled';
        if ($('buildTitle')) $('buildTitle').textContent = cancelled ? 'Build cancelled' : 'Build failed';
        if ($('buildMessage')) $('buildMessage').textContent = data.message || 'The Android build did not complete successfully.';
        const link = $('downloadApk');
        if (link && data.runUrl) {
          link.href = data.runUrl; link.textContent = 'Open build logs on GitHub';
          link.target = '_blank'; link.rel = 'noopener'; link.classList.remove('hidden');
        }
      }
    } catch (error) {
      stopPolling();
      if ($('buildTitle')) $('buildTitle').textContent = 'Build status unavailable';
      if ($('buildMessage')) $('buildMessage').textContent = error.message;
      toast(error.message);
    } finally {
      polling = false;
      if (activeBuild && (activeBuild.status === 'queued' || activeBuild.status === 'in_progress' || !activeBuild.status)) {
        if (!pollTimer) pollTimer = setTimeout(() => { pollTimer = null; checkBuild(activeBuild); }, 10000);
      }
    }
  }

  // Lightweight Tic-Tac-Toe game. It is independent of the APK build process.
  const gameModal = $('gameModal');
  const gameOffer = $('gameOffer');
  const cyberGame = $('cyberGame');
  const gameCells = Array.from(document.querySelectorAll('.tic-cell'));
  let ticBoard = Array(9).fill('');
  let ticLocked = false;
  let gameDifficulty = 'medium';
  const winningLines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  function getWinner(board) {
    for (const [a,b,c] of winningLines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return board.every(Boolean) ? 'draw' : '';
  }
  function renderTicBoard() {
    gameCells.forEach((cell, index) => {
      const mark = ticBoard[index];
      cell.textContent = mark;
      cell.classList.toggle('mark-x', mark === 'X');
      cell.classList.toggle('mark-o', mark === 'O');
      cell.disabled = Boolean(mark) || ticLocked;
    });
  }
  function endTicRound(result) {
    ticLocked = true;
    renderTicBoard();
    const feedback = $('gameFeedback');
    if (feedback) feedback.textContent = result === 'X' ? 'You win! Great game.' : result === 'O' ? 'Computer wins. Try again!' : 'It is a draw! Play again.';
  }
  function getAvailableMoves(board = ticBoard) {
    return board.map((value, index) => value ? -1 : index).filter(index => index >= 0);
  }
  function chooseComputerMove() {
    const available = getAvailableMoves();
    if (!available.length) return -1;

    // Easy: make a legal random move without tactical planning.
    if (gameDifficulty === 'easy') {
      return available[Math.floor(Math.random() * available.length)];
    }

    const findWinningMove = (mark, board = ticBoard) => {
      for (const index of getAvailableMoves(board)) {
        const test = board.slice(); test[index] = mark;
        if (getWinner(test) === mark) return index;
      }
      return -1;
    };

    // Medium: win when possible, block the player's immediate win, otherwise play simply.
    if (gameDifficulty === 'medium') {
      const win = findWinningMove('O');
      if (win >= 0) return win;
      const block = findWinningMove('X');
      if (block >= 0) return block;
      return available.includes(4) ? 4 : available[Math.floor(Math.random() * available.length)];
    }

    // Hard: minimax searches all possible outcomes and chooses the strongest move.
    function minimax(board, isComputerTurn, depth) {
      const result = getWinner(board);
      if (result === 'O') return 10 - depth;
      if (result === 'X') return depth - 10;
      if (result === 'draw') return 0;

      const moves = getAvailableMoves(board);
      if (isComputerTurn) {
        let best = -Infinity;
        for (const index of moves) {
          board[index] = 'O';
          best = Math.max(best, minimax(board, false, depth + 1));
          board[index] = '';
        }
        return best;
      }
      let best = Infinity;
      for (const index of moves) {
        board[index] = 'X';
        best = Math.min(best, minimax(board, true, depth + 1));
        board[index] = '';
      }
      return best;
    }

    let bestScore = -Infinity;
    let bestMoves = [];
    for (const index of available) {
      const test = ticBoard.slice();
      test[index] = 'O';
      const score = minimax(test, false, 1);
      if (score > bestScore) { bestScore = score; bestMoves = [index]; }
      else if (score === bestScore) bestMoves.push(index);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }
  function newTicGame() {
    ticBoard = Array(9).fill('');
    ticLocked = false;
    if ($('gameFeedback')) $('gameFeedback').textContent = 'Your turn — choose any square.';
    renderTicBoard();
  }
  function playTicCell(index) {
    if (ticLocked || ticBoard[index]) return;
    ticBoard[index] = 'X';
    let result = getWinner(ticBoard);
    if (result) { endTicRound(result); return; }
    ticLocked = true;
    renderTicBoard();
    const computerMove = chooseComputerMove();
    if (computerMove >= 0) ticBoard[computerMove] = 'O';
    result = getWinner(ticBoard);
    if (result) endTicRound(result);
    else {
      ticLocked = false;
      renderTicBoard();
      if ($('gameFeedback')) $('gameFeedback').textContent = 'Your turn — choose a square.';
    }
  }
  function closeGame() {
    gameModal?.classList.add('hidden');
  }
  function openGameOffer() {
    if (!gameModal) return;
    gameOffer?.classList.remove('hidden');
    cyberGame?.classList.add('hidden');
    gameModal.classList.remove('hidden');
  }

  function selectGameDifficulty(level) {
    if (!['easy', 'medium', 'hard'].includes(level)) return;
    gameDifficulty = level;
    $('difficultyPicker')?.classList.add('hidden');
    $('gamePlayArea')?.classList.remove('hidden');
    const label = $('gameLevelLabel');
    if (label) label.textContent = `LEVEL: ${level.toUpperCase()}`;
    document.querySelectorAll('.difficulty-btn').forEach(button => {
      const selected = button.dataset.difficulty === level;
      button.classList.toggle('btn-primary', selected);
      button.classList.toggle('btn-ghost', !selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    newTicGame();
  }
  $('playGameBtn')?.addEventListener('click', () => {
    gameOffer?.classList.add('hidden');
    cyberGame?.classList.remove('hidden');
    $('difficultyPicker')?.classList.remove('hidden');
    $('gamePlayArea')?.classList.add('hidden');
  });
  document.querySelectorAll('.difficulty-btn').forEach(button => {
    button.addEventListener('click', () => selectGameDifficulty(button.dataset.difficulty));
  });
  $('changeDifficultyBtn')?.addEventListener('click', () => {
    $('gamePlayArea')?.classList.add('hidden');
    $('difficultyPicker')?.classList.remove('hidden');
  });
  $('startGameBtn')?.addEventListener('click', newTicGame);
  gameCells.forEach((cell, index) => cell.addEventListener('click', () => playTicCell(index)));
  $('skipGameBtn')?.addEventListener('click', closeGame);
  $('gameClose')?.addEventListener('click', closeGame);
  $('doneGameBtn')?.addEventListener('click', closeGame);
  gameModal?.addEventListener('click', event => { if (event.target === gameModal) closeGame(); });

  const form = $('appForm');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const btn = event.submitter || form.querySelector('[type="submit"]');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const buttonText = btn.querySelector('span');
    if (buttonText) buttonText.textContent = 'Starting Android build…';
    stopPolling();
    try {
      const siteUrl = normalizedUrl($('siteUrl')?.value.trim() || '');
      const appName = $('appName')?.value.trim() || '';
      if (!appName) throw new Error('Enter an app name.');
      const appId = $('packageId')?.value.trim() || 'com.fgmafian.myapp';
      if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(appId) || appId.length > 180) {
        throw new Error('Package ID must look like com.company.app and use valid letters, numbers or underscores.');
      }
      const description = $('description')?.value.trim() || '';
      const payload = {
        siteUrl, appName, appId, description,
        versionName: $('versionName')?.value.trim() || '1.0.0',
        versionCode: $('versionCode')?.value || '1',
        orientation: $('orientation')?.value || 'portrait',
        themeColor: $('themeColor')?.value || '#3978ff',
        splashColor: $('splashColor')?.value || '#070914',
        displayMode: $('displayMode')?.value || 'standalone',
        pullRefresh: Boolean($('pullRefresh')?.checked),
        navControls: Boolean($('navControls')?.checked),
        logoData, splashLogoData
      };
      if ($('result')) $('result').classList.remove('hidden');
      $('downloadApk')?.classList.add('hidden');
      $('copyPublicDownload')?.classList.add('hidden');
      $('publicDownloadHint')?.classList.add('hidden');
      if ($('buildTitle')) $('buildTitle').textContent = 'Starting your APK build…';
      if ($('buildMessage')) $('buildMessage').textContent = 'Sending your app settings to the secure build service.';

      const response = await fetch('/api/build', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await readApiResponse(response);
      const build = {
        buildId: data.buildId, runId: data.runId || null,
        startedAt: data.startedAt, appName, siteUrl, appId, versionName: payload.versionName, versionCode: payload.versionCode, status: data.status || 'queued',
        runUrl: null, downloadUrl: null
      };
      saveBuild(build);
      activeBuild = build;
      if ($('buildTitle')) $('buildTitle').textContent = 'Build request accepted';
      if ($('buildMessage')) $('buildMessage').textContent = data.message || 'Your Android app is being prepared. Check My Builds for progress.';
      checkBuild(build);
      openGameOffer();
    } catch (error) {
      if ($('result')) $('result').classList.remove('hidden');
      if ($('buildTitle')) $('buildTitle').textContent = 'Could not start build';
      if ($('buildMessage')) $('buildMessage').textContent = error.message;
      toast(error.message);
    } finally {
      btn.disabled = false;
      if (buttonText) buttonText.textContent = 'Build installable APK';
    }
  });
})();
