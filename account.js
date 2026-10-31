import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const $ = id => document.getElementById(id);
let supabase = null, mode = 'login', currentUser = null;
function message(text, error = false) { $('authMessage').textContent = text; $('authMessage').style.color = error ? '#ff8d9a' : ''; }
function setMode(next) { mode = next; $('showLogin').className = `btn ${mode === 'login' ? 'btn-primary' : 'btn-ghost'}`; $('showSignup').className = `btn ${mode === 'signup' ? 'btn-primary' : 'btn-ghost'}`; $('displayNameWrap').classList.toggle('hidden', mode !== 'signup'); $('authSubmit').textContent = mode === 'login' ? 'Sign in' : 'Create account'; $('password').autocomplete = mode === 'login' ? 'current-password' : 'new-password'; }
async function init() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' }); const config = await response.json();
    if (!config.configured) { message('Cloud accounts are not configured yet. Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel.', true); $('authSubmit').disabled = true; return; }
    supabase = createClient(config.url, config.anonKey);
    const { data } = await supabase.auth.getSession(); if (data.session) await showProfile(data.session.user);
    supabase.auth.onAuthStateChange((_event, session) => session ? showProfile(session.user) : hideProfile());
  } catch { message('Could not load account services. Check your deployment configuration.', true); }
}
async function showProfile(user) {
  currentUser = user; $('authCard').classList.add('hidden'); $('profileCard').classList.remove('hidden'); $('profileEmail').textContent = user.email || '';
  const { data: profile } = await supabase.from('profiles').select('display_name,plan,role,is_blocked').eq('id', user.id).maybeSingle();
  if (profile?.is_blocked) { await supabase.auth.signOut(); message('This account has been disabled by the platform administrator.', true); return; }
  $('profileName').textContent = profile?.display_name || user.user_metadata?.display_name || 'Welcome'; $('profilePlan').textContent = profile?.plan === 'premium' ? 'Premium' : 'Free';
  let isAdmin = profile?.role === 'admin';
  try { const check = await fetch('/api/admin', { headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session.access_token}` } }); isAdmin = isAdmin || check.ok; } catch {}
  $('profileRole').textContent = isAdmin ? 'Administrator' : 'User';
  const { data: projects, error } = await supabase.from('projects').select('id,name,package_id,site_url,created_at').order('created_at', { ascending: false }).limit(30);
  if (!error) { $('projectCount').textContent = String(projects.length); $('savedProjects').replaceChildren(); projects.forEach(p => { const item = document.createElement('div'); item.className = 'saved-project'; const name = document.createElement('b'); name.textContent = p.name; const detail = document.createElement('small'); detail.textContent = `${p.package_id} · ${new Date(p.created_at).toLocaleDateString()}`; item.append(name, detail); $('savedProjects').append(item); }); if (!projects.length) $('savedProjects').textContent = 'No saved projects yet. Create an app to get started.'; }
}
function hideProfile() { currentUser = null; $('profileCard').classList.add('hidden'); $('authCard').classList.remove('hidden'); }
$('showLogin').addEventListener('click', () => setMode('login')); $('showSignup').addEventListener('click', () => setMode('signup'));
$('authForm').addEventListener('submit', async event => { event.preventDefault(); if (!supabase) return; $('authSubmit').disabled = true; message('Please wait…'); try { const email = $('email').value.trim(), password = $('password').value; if (mode === 'signup') { const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: $('displayName').value.trim() } } }); if (error) throw error; message(data.session ? 'Account created.' : 'Check your email to confirm your account, then sign in.'); } else { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; message('Signed in successfully.'); } } catch (error) { message(error.message || 'Account request failed.', true); } finally { $('authSubmit').disabled = false; } });
$('signOut').addEventListener('click', async () => { await supabase?.auth.signOut(); hideProfile(); });
setMode('login'); init();
