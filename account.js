import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const $ = id => document.getElementById(id);
let supabase = null, mode = 'login', verifyingSignup = false, pendingEmail = '';
async function reportPrivateError(source, error) { try { const session = supabase ? (await supabase.auth.getSession()).data.session : null; if (session) await fetch('/api/log',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({source,message:String(error?.stack||error?.message||error||'Unknown error').slice(0,1200),path:location.pathname})}); } catch {} }
function message(text, error = false) {
  $('authMessage').textContent = text;
  $('authMessage').style.color = error ? '#b42318' : '';
}
function setMode(next) {
  mode = next; verifyingSignup = false;
  $('showLogin').className = `btn ${mode === 'login' ? 'btn-primary' : 'btn-ghost'}`;
  $('showSignup').className = `btn ${mode === 'signup' ? 'btn-primary' : 'btn-ghost'}`;
  $('displayNameWrap').classList.toggle('hidden', mode !== 'signup');
  $('otpWrap').classList.add('hidden');
  $('resendCode').classList.add('hidden');
  $('passwordWrap').classList.remove('hidden');
  $('password').required = true;
  $('authSubmit').textContent = mode === 'login' ? 'Sign in' : 'Create account';
  $('password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
}
async function init() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    const config = await response.json();
    if (!config.configured) { message('Something went wrong. Please try again later.', true); $('authSubmit').disabled = true; return; }
    supabase = createClient(config.url, config.anonKey);
    const { data } = await supabase.auth.getSession();
    if (data.session) await showProfile(data.session.user);
    supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { if (session?.user) showProfile(session.user); else hideProfile(); }, 0);
    });
  } catch { message('Something went wrong. Please try again later.', true); }
}
async function showProfile(user) {
  try { localStorage.setItem('fgmafian_welcome_done', '1'); } catch {}
  currentUser = user;
  $('authCard').classList.add('hidden'); $('profileCard').classList.remove('hidden');
  $('profileEmail').textContent = user.email || '';
  const { data: profile, error } = await supabase.from('profiles').select('display_name,plan,is_blocked').eq('id', user.id).maybeSingle();
  if (error) { message('Something went wrong. Please try again later.', true); return; }
  if (profile?.is_blocked) { await supabase.auth.signOut(); message('This account is unavailable. Please contact support.', true); return; }
  $('profileName').textContent = profile?.display_name || user.user_metadata?.display_name || 'Welcome';
  $('profilePlan').textContent = profile?.plan === 'premium' ? 'Premium' : 'Free';
  const session = (await supabase.auth.getSession()).data.session;
  try {
    const check = await fetch('/api/admin', { headers: { Authorization: `Bearer ${session.access_token}` } });
    $('adminLink').classList.toggle('hidden', !check.ok);
    $('profileRole').textContent = check.ok ? 'Owner' : 'Member';
  } catch { $('adminLink').classList.add('hidden'); $('profileRole').textContent = 'Member'; }
  const { data: projects, error: projectsError } = await supabase.from('projects').select('id,name,package_id,site_url,created_at,settings').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
  if (projectsError) { $('savedProjects').textContent = 'Something went wrong. Please try again.'; return; }
  $('projectCount').textContent = String(projects.length);
  $('savedProjects').replaceChildren();
  projects.forEach(p => {
    const item = document.createElement('div'); item.className = 'saved-project';
    const name = document.createElement('b'); name.textContent = p.name;
    const detail = document.createElement('small'); detail.textContent = `${p.package_id} · ${new Date(p.created_at).toLocaleDateString()}`;
    item.append(name, detail); $('savedProjects').append(item);
  });
  if (!projects.length) $('savedProjects').textContent = 'Your saved apps will appear here after your first build.';
}
function hideProfile() { currentUser = null; $('profileCard').classList.add('hidden'); $('authCard').classList.remove('hidden'); }
$('showLogin').addEventListener('click', () => setMode('login'));
$('showSignup').addEventListener('click', () => setMode('signup'));
$('authForm').addEventListener('submit', async event => {
  event.preventDefault(); if (!supabase) return;
  $('authSubmit').disabled = true; message('Please wait…');
  try {
    const email = verifyingSignup ? pendingEmail : $('email').value.trim();
    if (verifyingSignup) {
      const token = $('emailCode').value.trim();
      if (!/^\d{6,8}$/.test(token)) { message('Enter the verification code from your email.', true); return; }
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
      if (error) throw error;
      message('Email verified. Your account is ready.');
      $('otpWrap').classList.add('hidden'); $('resendCode').classList.add('hidden');
      return;
    }
    const password = $('password').value;
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: $('displayName').value.trim() } } });
      if (error) throw error;
      pendingEmail = email; verifyingSignup = true;
      $('otpWrap').classList.remove('hidden'); $('resendCode').classList.remove('hidden');
      $('passwordWrap').classList.add('hidden'); $('password').required = false;
      $('authSubmit').textContent = 'Verify email';
      message('We sent a verification code to your email. Enter it below to finish creating your account.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      message('Signed in successfully.');
    }
  } catch (error) {
    console.error('Account flow error:', error); reportPrivateError('account', error);
    message('Something went wrong. Please check your details and try again.', true);
  } finally { $('authSubmit').disabled = false; }
});
$('resendCode').addEventListener('click', async () => {
  if (!supabase || !pendingEmail) return;
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email: pendingEmail });
    if (error) throw error;
    message('A new verification code has been sent.');
  } catch (error) { console.error('Verification resend error:', error); reportPrivateError('email-verification', error); message('Something went wrong. Please try again later.', true); }
});
$('signOut').addEventListener('click', async () => { await supabase?.auth.signOut(); hideProfile(); });
const requestedMode = location.hash === '#signup' ? 'signup' : 'login';
setMode(requestedMode); init();
