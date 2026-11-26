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
    if (!response.ok) throw new Error(typeof data.error === 'string' && data.error.length < 240 ? data.error : `Build request failed (HTTP ${response.status}). Please try again.`);
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
        if ($('buildMessage')) $('buildMessage').textContent = 'GitHub is preparing your Android app. You can follow progress from My Builds.';
        return;
      }
      stopPolling();
      if (data.status === 'success' && data.downloadUrl) {
        closeGame();
        build.downloadUrl = data.downloadUrl; saveBuild(build);
        if ($('buildTitle')) $('buildTitle').textContent = 'Your APK is ready!';
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
        if ($('buildMessage')) $('buildMessage').textContent = 'Something went wrong. Please try again.';
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
        if (!pollTimer) pollTimer = setTimeout(() => { pollTimer = null; checkBuild(activeBuild); }, 10000);
      }
    }
  }

  // Snake mini-game runs independently while the APK build is polled.
  const gameModal = $('gameModal'), gameOffer = $('gameOffer'), snakeGame = $('snakeGame');
  const snakeCanvas = $('snakeCanvas'), snakeContext = snakeCanvas?.getContext('2d');
  let snake=[], snakeFood={x:10,y:8}, snakeDirection={x:1,y:0}, snakeNextDirection={x:1,y:0};
  let snakeTimer=null, snakePoints=0, snakePaused=false;
  const snakeCells=20, snakeCellSize=15;
  function placeSnakeFood(){do{snakeFood={x:Math.floor(Math.random()*snakeCells),y:Math.floor(Math.random()*snakeCells)}}while(snake.some(p=>p.x===snakeFood.x&&p.y===snakeFood.y));}
  function drawSnake(){
    if(!snakeContext)return;const c=snakeContext;c.fillStyle='#061326';c.fillRect(0,0,300,300);c.strokeStyle='rgba(60,145,255,.10)';
    for(let i=0;i<=snakeCells;i++){let p=i*snakeCellSize;c.beginPath();c.moveTo(p,0);c.lineTo(p,300);c.stroke();c.beginPath();c.moveTo(0,p);c.lineTo(300,p);c.stroke();}
    c.fillStyle='#ff5c9a';c.shadowColor='#ff5c9a';c.shadowBlur=12;c.beginPath();c.arc(snakeFood.x*15+7.5,snakeFood.y*15+7.5,5,0,Math.PI*2);c.fill();c.shadowBlur=0;
    snake.forEach((p,i)=>{c.fillStyle=i?'#24a7ff':'#e8fbff';c.shadowColor='#168bff';c.shadowBlur=i?5:12;c.fillRect(p.x*15+1,p.y*15+1,13,13)});c.shadowBlur=0;
  }
  function finishSnake(msg){clearInterval(snakeTimer);snakeTimer=null;if($('snakeStatus'))$('snakeStatus').textContent=msg;}
  function snakeTick(){
    snakeDirection=snakeNextDirection;const h={x:snake[0].x+snakeDirection.x,y:snake[0].y+snakeDirection.y};
    const ate=h.x===snakeFood.x&&h.y===snakeFood.y,body=ate?snake:snake.slice(0,-1);
    if(h.x<0||h.y<0||h.x>=20||h.y>=20||body.some(p=>p.x===h.x&&p.y===h.y)){finishSnake('Game over — tap PLAY AGAIN to restart.');return;}
    snake.unshift(h);if(ate){snakePoints+=10;if($('snakeScore'))$('snakeScore').textContent=String(snakePoints);placeSnakeFood();}else snake.pop();drawSnake();
  }
  function startSnake(){
    clearInterval(snakeTimer);snake=[{x:7,y:10},{x:6,y:10},{x:5,y:10}];snakeDirection={x:1,y:0};snakeNextDirection={x:1,y:0};snakePoints=0;snakePaused=false;
    if($('snakeScore'))$('snakeScore').textContent='0';if($('snakeStatus'))$('snakeStatus').textContent='Use the arrow buttons, swipe, or keyboard arrows.';
    if($('snakePause'))$('snakePause').textContent='PAUSE';placeSnakeFood();drawSnake();snakeTimer=setInterval(snakeTick,125);
  }
  function setSnakeDirection(x,y){if(x===-snakeDirection.x&&y===-snakeDirection.y)return;snakeNextDirection={x,y};}
  function pauseSnake(){
    if(snakePaused){snakePaused=false;if($('snakeStatus'))$('snakeStatus').textContent='Game resumed.';snakeTimer=setInterval(snakeTick,125);if($('snakePause'))$('snakePause').textContent='PAUSE';}
    else if(snakeTimer){snakePaused=true;clearInterval(snakeTimer);snakeTimer=null;if($('snakeStatus'))$('snakeStatus').textContent='Paused.';if($('snakePause'))$('snakePause').textContent='RESUME';}
  }
  function closeGame(){clearInterval(snakeTimer);snakeTimer=null;snakePaused=false;gameModal?.classList.add('hidden');}
  function openGameOffer(){if(!gameModal)return;gameOffer?.classList.remove('hidden');snakeGame?.classList.add('hidden');gameModal.classList.remove('hidden');}
  $('playGameBtn')?.addEventListener('click',()=>{gameOffer?.classList.add('hidden');snakeGame?.classList.remove('hidden');startSnake();});
  $('skipGameBtn')?.addEventListener('click',closeGame);$('gameClose')?.addEventListener('click',closeGame);$('snakeClose')?.addEventListener('click',closeGame);
  $('snakeRestart')?.addEventListener('click',startSnake);$('snakePause')?.addEventListener('click',pauseSnake);
  document.querySelectorAll('[data-snake-dir]').forEach(b=>b.addEventListener('click',()=>{const [x,y]=b.dataset.snakeDir.split(',').map(Number);setSnakeDirection(x,y);}));
  document.addEventListener('keydown',e=>{if(gameModal?.classList.contains('hidden'))return;const k={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};if(k[e.key]){e.preventDefault();setSnakeDirection(...k[e.key]);}if(e.key==='Escape')closeGame();});
  let snakeTouch=null;snakeCanvas?.addEventListener('touchstart',e=>{const t=e.changedTouches[0];snakeTouch={x:t.clientX,y:t.clientY}},{passive:true});
  snakeCanvas?.addEventListener('touchend',e=>{if(!snakeTouch)return;const t=e.changedTouches[0],dx=t.clientX-snakeTouch.x,dy=t.clientY-snakeTouch.y;if(Math.max(Math.abs(dx),Math.abs(dy))>18){if(Math.abs(dx)>Math.abs(dy))setSnakeDirection(dx>0?1:-1,0);else setSnakeDirection(0,dy>0?1:-1);}snakeTouch=null;},{passive:true});
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
