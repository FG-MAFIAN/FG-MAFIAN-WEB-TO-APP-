// AppForge Android app builder.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const prefill = new URLSearchParams(location.search);
  for (const [param,id] of [['site','siteUrl'],['name','appName'],['package','packageId']]) { const value=prefill.get(param); if(value && $(id)) $(id).value=value; }
  if (prefill.get('name') && $('previewName')) $('previewName').textContent=prefill.get('name');
  const safeStorage = {
    get(key, fallback = null) { try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
  };
  const maintenanceNotice = document.getElementById('maintenanceNotice');
  if (maintenanceNotice) fetch('/api/maintenance', { cache: 'no-store' }).then(r => r.json()).then(data => {
    if (data.enabled) { maintenanceNotice.textContent = data.message || 'We are performing maintenance. Please try again soon.'; maintenanceNotice.classList.remove('hidden'); }
  }).catch(() => {});

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
    catch { throw new Error('The build service returned an unreadable response. Please try again.'); }
    if (!response.ok) {
      const detail = [data.error, data.message, data.detail].find(value => typeof value === 'string' && value.trim());
      throw new Error(detail ? detail.trim().slice(0, 700) : `Build request failed (HTTP ${response.status}). Please try again.`);
    }
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
  const packageIdInput = $('packageId');
  let packageIdTouched = false;
  function suggestedPackageId() {
    let host = 'website';
    try { host = new URL($('siteUrl')?.value.trim() || '').hostname.replace(/^www\./, '').split('.')[0]; } catch {}
    const name = $('appName')?.value.trim() || 'app';
    const clean = value => {
      let slug = String(value).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 35);
      if (!slug) slug = 'app';
      if (!/^[a-z]/.test(slug)) slug = 'app_' + slug;
      return slug;
    };
    return 'com.appforge.' + clean(host) + '_' + clean(name);
  }
  function updatePackageSuggestion() {
    if (packageIdInput && !packageIdTouched) packageIdInput.value = suggestedPackageId();
  }
  packageIdInput?.addEventListener('input', () => { packageIdTouched = true; });
  updatePackageSuggestion();

  $('siteUrl')?.addEventListener('input', event => {
    if ($('previewUrl')) $('previewUrl').textContent = event.target.value.trim() || 'Your website URL will appear here';
    updatePackageSuggestion();
  });
  function updateSplashPreview() {
    const screen = $('splashPreviewScreen');
    const logo = $('splashPreviewLogo');
    const name = $('splashPreviewName');
    const color = $('splashColor')?.value || '#f8fafc';
    if (screen) screen.style.backgroundColor = color;
    if (name) name.textContent = $('appName')?.value.trim() || 'Your app name';
    if (logo) {
      const imageData = splashLogoData || logoData;
      logo.style.backgroundImage = imageData ? `url("${imageData}")` : '';
      logo.style.backgroundColor = imageData ? 'transparent' : 'rgba(255,255,255,.12)';
      logo.textContent = imageData ? '' : 'A';
      logo.style.backgroundSize = 'contain';
      logo.style.backgroundPosition = 'center';
      logo.style.backgroundRepeat = 'no-repeat';
    }
  }
  $('appName')?.addEventListener('input', event => {
    const name = event.target.value.trim() || 'Your app name';
    if ($('previewName')) $('previewName').textContent = name;
    updateSplashPreview();
    updatePackageSuggestion();
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
    if (!file) { logoData = ''; if ($('iconPreview')) { $('iconPreview').style.backgroundImage = ''; $('iconPreview').textContent = 'A'; $('iconPreview').style.background = $('themeColor')?.value || '#475569'; } updateSplashPreview(); return; }
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
        if ($('buildProgressLabel')) $('buildProgressLabel').textContent = data.status === 'queued' ? 'WAITING FOR BUILDER' : 'BUILD IN PROGRESS';
        if ($('buildProgressLabel')) $('buildProgressLabel').textContent = data.status === 'queued' ? 'WAITING FOR BUILDER' : 'BUILD IN PROGRESS';
        if ($('buildMessage')) $('buildMessage').textContent = 'Your APK is being built. You can leave this page open or close the game; progress will remain visible here.';
        return;
      }
      stopPolling();
      if (data.status === 'success' && data.downloadUrl) {
        closeGame();
        build.downloadUrl = data.downloadUrl; saveBuild(build);
        if ($('buildTitle')) $('buildTitle').textContent = 'Your APK is ready!';
        if ($('buildProgressLabel')) $('buildProgressLabel').textContent = 'BUILD COMPLETE';
        $('result')?.classList.add('build-complete');
        if ($('buildProgressLabel')) $('buildProgressLabel').textContent = 'BUILD COMPLETE';
        $('result')?.classList.add('build-complete');
        if ($('buildMessage')) $('buildMessage').textContent = 'Your APK is ready to download directly to this device.';
        const publicDownloadUrl = new URL(data.downloadUrl, window.location.origin).href;
        build.publicDownloadUrl = publicDownloadUrl; saveBuild(build);
        const link = $('downloadApk');
        if (link) {
          link.href = publicDownloadUrl; link.textContent = 'Download APK';
          link.removeAttribute('target'); link.setAttribute('download', 'appforge-app.apk');
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
        closeGame();
        const cancelled = data.status === 'cancelled';
        if ($('buildTitle')) $('buildTitle').textContent = cancelled ? 'Build cancelled' : 'Build failed';
        if ($('buildProgressLabel')) $('buildProgressLabel').textContent = cancelled ? 'BUILD CANCELLED' : 'BUILD FAILED';
        $('result')?.classList.add('build-complete');
        if ($('buildProgressLabel')) $('buildProgressLabel').textContent = cancelled ? 'BUILD CANCELLED' : 'BUILD FAILED';
        $('result')?.classList.add('build-complete');
        if ($('buildMessage')) $('buildMessage').textContent = data.message || 'Something went wrong. Please try again.';
        const link = $('downloadApk');
        if (link && data.runUrl) {
          link.href = data.runUrl; link.textContent = 'Open build logs on GitHub';
          link.target = '_blank'; link.rel = 'noopener'; link.classList.remove('hidden');
        }
      }
    } catch (error) {
      stopPolling();
      if ($('buildTitle')) $('buildTitle').textContent = 'Build status unavailable';
      if ($('buildMessage')) $('buildMessage').textContent = error?.message || 'Something went wrong. Please try again.';
      toast(error?.message || 'Something went wrong. Please try again.');
    } finally {
      polling = false;
      if (activeBuild && (activeBuild.status === 'queued' || activeBuild.status === 'in_progress' || !activeBuild.status)) {
        if (!pollTimer) pollTimer = setTimeout(() => { pollTimer = null; checkBuild(activeBuild); }, 4000);
      }
    }
  }

  // Tic-Tac-Toe mini-game runs independently while the APK build is polled.
  const gameModal = $('gameModal'), gameOffer = $('gameOffer'), tttGame = $('tttGame');
  const tttBoard = $('tttBoard');
  let tttCells = Array(9).fill(''), tttTurn = 'X', tttOver = false, tttScore = {X:0,O:0};
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function setTttStatus(message){ if($('tttStatus')) $('tttStatus').textContent=message; }
  function renderTtt(){
    if(!tttBoard)return;
    tttBoard.innerHTML='';
    tttCells.forEach((value,index)=>{
      const cell=document.createElement('button');
      cell.type='button';cell.className='ttt-cell'+(value?' is-'+value.toLowerCase():'');
      cell.textContent=value;cell.disabled=Boolean(value)||tttOver;
      cell.setAttribute('aria-label',value?('Cell '+(index+1)+': '+value):('Play cell '+(index+1)));
      cell.addEventListener('click',()=>playTtt(index));
      tttBoard.appendChild(cell);
    });
    if($('tttScore'))$('tttScore').textContent='X '+tttScore.X+' — O '+tttScore.O;
  }
  function resetTtt(){
    tttCells=Array(9).fill('');tttTurn='X';tttOver=false;
    setTttStatus('Your turn: X. Tap any square to play.');
    renderTtt();
  }
  function playTtt(index){
    if(tttOver||tttCells[index])return;
    tttCells[index]=tttTurn;
    const line=wins.find(combo=>combo.every(i=>tttCells[i]===tttTurn));
    if(line){
      tttOver=true;tttScore[tttTurn]++;
      setTttStatus(tttTurn+' wins! Tap NEW GAME to play again.');
    }else if(tttCells.every(Boolean)){
      tttOver=true;setTttStatus("It's a draw! Tap NEW GAME to play again.");
    }else{
      tttTurn=tttTurn==='X'?'O':'X';
      setTttStatus('Your turn: '+tttTurn+'.');
    }
    renderTtt();
  }
  function closeGame(){gameModal?.classList.add('hidden');}
  function openGameOffer(){if(!gameModal)return;gameOffer?.classList.remove('hidden');tttGame?.classList.add('hidden');gameModal.classList.remove('hidden');}
  $('playGameBtn')?.addEventListener('click',()=>{gameOffer?.classList.add('hidden');tttGame?.classList.remove('hidden');resetTtt();});
  $('skipGameBtn')?.addEventListener('click',closeGame);
  $('gameClose')?.addEventListener('click',closeGame);
  $('tttClose')?.addEventListener('click',closeGame);
  $('tttRestart')?.addEventListener('click',resetTtt);
  document.addEventListener('keydown',e=>{if(!gameModal?.classList.contains('hidden')&&e.key==='Escape')closeGame();});
  gameModal?.addEventListener('click',e=>{if(e.target===gameModal)closeGame();});

  const form = $('appForm');
  // App creation is open to everyone; no account or sign-in is required.
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
      const appId = $('packageId')?.value.trim() || 'com.appforge.myapp';
      if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(appId) || appId.length > 180) {
        throw new Error('Package ID must look like com.company.app and use valid letters, numbers or underscores.');
      }
      const description = $('description')?.value.trim() || '';
      const payload = {
        siteUrl, appName, appId, description,
        versionName: $('versionName')?.value.trim() || '1.0.0',
        versionCode: $('versionCode')?.value || '1',
        orientation: $('orientation')?.value || 'portrait',
        themeColor: $('themeColor')?.value || '#475569',
        splashColor: $('splashColor')?.value || '#f8fafc',
        displayMode: $('displayMode')?.value || 'standalone',
        pullRefresh: Boolean($('pullRefresh')?.checked),
        navControls: Boolean($('navControls')?.checked),
        statusBarColor: $('statusBarColor')?.value || '#f8fafc',
        statusBarStyle: $('statusBarStyle')?.value || 'dark',
        allowZoom: Boolean($('allowZoom')?.checked),
        keepScreenOn: Boolean($('keepScreenOn')?.checked),
        preventScreenshots: Boolean($('preventScreenshots')?.checked),
        logoData, splashLogoData
      };
      if ($('result')) { $('result').classList.remove('hidden'); $('result').classList.remove('build-complete'); }
      $('downloadApk')?.classList.add('hidden');
      $('copyPublicDownload')?.classList.add('hidden');
      $('publicDownloadHint')?.classList.add('hidden');
      if ($('buildTitle')) $('buildTitle').textContent = 'Starting your APK build…';
      if ($('buildMessage')) $('buildMessage').textContent = 'Sending your app settings to the secure build service. Build progress will appear here.';

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
      if ($('buildMessage')) $('buildMessage').textContent = data.message || 'Your Android app is being prepared. You can close the game and watch the build status here.';
      openGameOffer();
      checkBuild(build);
    } catch (error) {
      if ($('result')) $('result').classList.remove('hidden');
      if ($('buildTitle')) $('buildTitle').textContent = 'Could not start build';
      if ($('buildMessage')) $('buildMessage').textContent = error?.message || 'Something went wrong. Please try again.';
      toast(error?.message || 'Something went wrong. Please try again.');
    } finally {
      btn.disabled = false;
      if (buttonText) buttonText.textContent = 'Build installable APK';
    }
  });
})();
