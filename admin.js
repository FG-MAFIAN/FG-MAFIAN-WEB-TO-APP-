import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const $ = id => document.getElementById(id);
let token = '';
function say(text, error = false) {
  $('adminMessage').textContent = text;
  $('adminMessage').style.color = error ? '#b42318' : '';
}
function node(tag, cls, value) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (value !== undefined) el.textContent = value;
  return el;
}
async function api(method = 'GET', body) {
  const response = await fetch('/api/admin', {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Admin request failed.');
  return data;
}
async function load() {
  const data = await api();
  $('adminUserCount').textContent=String((data.users||[]).length);
  $('adminProjectCount').textContent=String((data.projects||[]).length);
  $('adminLogCount').textContent=String((data.systemLogs||[]).length);
  $('diagnostics').replaceChildren();
  Object.entries(data.diagnostics || {}).forEach(([name, ready]) => {
    const row = node('div', 'admin-user');
    row.append(node('b', '', name.replace(/[A-Z]/g, ' $&')), node('small', '', ready ? 'Configured' : 'Needs setup'));
    $('diagnostics').append(row);
  });
  $('adminUsers').replaceChildren();
  data.users.forEach(user => {
    const row = node('div', 'admin-user');
    const info = node('div');
    info.append(node('b', '', user.display_name || user.email || user.id));
    info.append(node('small', '', `${user.email || ''} · ${user.plan || 'free'} · ${user.is_blocked ? 'Blocked' : 'Active'}`));
    const controls = node('div', 'admin-actions');
    const plan = node('button', 'btn btn-ghost', user.plan === 'premium' ? 'Set Free' : 'Make Premium');
    plan.type = 'button';
    plan.addEventListener('click', () => updateUser(user.id, { plan: user.plan === 'premium' ? 'free' : 'premium' }));
    const block = node('button', 'btn btn-ghost', user.is_blocked ? 'Unblock' : 'Block');
    block.type = 'button';
    block.addEventListener('click', () => updateUser(user.id, { isBlocked: !user.is_blocked }));
    controls.append(plan, block); row.append(info, controls); $('adminUsers').append(row);
  });
  if (!data.users.length) $('adminUsers').textContent = 'No accounts yet.';
  filterUsers();
  $('systemLogs').replaceChildren();
  (data.systemLogs || []).forEach(log => {
    const row = node('div', 'admin-user');
    row.append(node('b', '', log.source || 'Website'));
    row.append(node('small', '', `${new Date(log.created_at).toLocaleString()} · ${log.path || ''}`));
    row.append(node('p', 'muted', log.message || 'No details'));
    $('systemLogs').append(row);
  });
  if (!(data.systemLogs || []).length) $('systemLogs').textContent = 'No error reports have been recorded.';
  $('adminProjects').replaceChildren();
  data.projects.forEach(project => {
    const row = node('div', 'admin-user');
    row.append(node('b', '', project.name), node('small', '', `${project.package_id} · ${project.user_id}`));
    $('adminProjects').append(row);
  });
  if (!data.projects.length) $('adminProjects').textContent = 'No saved projects yet.';
}
function filterUsers(){const q=($('adminUserSearch')?.value||'').trim().toLowerCase();document.querySelectorAll('#adminUsers .admin-user').forEach(row=>{row.hidden=!!q&&!row.textContent.toLowerCase().includes(q)});}
$('adminUserSearch')?.addEventListener('input',filterUsers);
async function updateUser(userId, changes) {
  try { await api('POST', { action: 'user-update', userId, ...changes }); say('Account updated.'); await load(); }
  catch (error) { console.error('Admin account update failed:', error); say('Something went wrong. Please try again.', true); }
}
async function init() {
  try {
    const config = await (await fetch('/api/config', { cache: 'no-store' })).json();
    if (!config.configured) throw new Error('Not configured');
    const supabase = createClient(config.url, config.anonKey);
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('Not signed in');
    token = data.session.access_token;
    await load();
    const maintenance = await (await fetch('/api/maintenance', { cache: 'no-store' })).json();
    $('maintenanceToggle').checked = maintenance.enabled;
    if (maintenance.message) $('maintenanceMessage').value = maintenance.message;
  } catch (error) {
    console.error('Admin dashboard access failed:', error);
    say('This area is restricted.', true);
    $('adminUsers').textContent = 'Admin data unavailable.';
    setTimeout(() => location.replace('/'), 1800);
  }
}
$('reloadAdmin').addEventListener('click', () => load().catch(error => { console.error(error); say('Something went wrong. Please try again.', true); }));
$('saveMaintenance').addEventListener('click', async () => {
  try {
    await api('POST', { action: 'maintenance', enabled: $('maintenanceToggle').checked, message: $('maintenanceMessage').value.trim() });
    say('Maintenance settings saved.');
  } catch (error) { console.error(error); say('Something went wrong. Please try again.', true); }
});
init();
