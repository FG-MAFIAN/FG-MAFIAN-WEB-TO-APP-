import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
(() => {
  const $ = id => document.getElementById(id);
  const list = $('buildList'), noBuild = $('noBuild');
  if (!list || !noBuild) return;
  const generic = 'Something went wrong. Please try again.';
  function node(tag, cls, value) { const el = document.createElement(tag); if (cls) el.className = cls; if (value !== undefined) el.textContent = value; return el; }
  async function start() {
    try {
      const cfg = await fetch('/api/config', {cache:'no-store'}).then(r=>r.json());
      if (!cfg.configured) throw new Error('auth');
      const client = createClient(cfg.url,cfg.anonKey);
      const {data:{session}} = await client.auth.getSession();
      if (!session) { location.replace('/account#login'); return; }
      const {data:rows,error} = await client.from('projects').select('id,name,package_id,site_url,created_at,settings,build_id').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(50);
      if (error) throw error;
      list.replaceChildren();
      noBuild.classList.toggle('hidden',rows.length>0);
      rows.forEach(row=>{
        const card=node('article','saved-project');
        const title=node('b','',row.name);
        const detail=node('small','',`${row.package_id} · ${new Date(row.created_at).toLocaleString()}`);
        const status=node('p','muted','Checking build status…');
        const actions=node('div','hero-actions');
        card.append(title,detail,status,actions); list.append(card);
        const settings=row.settings||{};
        const refresh=async()=>{
          if(!row.build_id) {status.textContent='Saved project';return;}
          try{
            const q=settings.run_id?`run_id=${encodeURIComponent(settings.run_id)}`:`build_id=${encodeURIComponent(row.build_id)}`;
            const res=await fetch('/api/status?'+q,{cache:'no-store'});
            const data=await res.json();
            if(!res.ok) throw new Error();
            status.textContent=({queued:'Waiting to start',in_progress:'Building your app',success:'APK ready',failure:'Build could not be completed',cancelled:'Build cancelled'})[data.status]||'Status unavailable';
            if(data.status==='success'&&data.downloadUrl){
              const link=node('a','btn btn-primary','Download APK');link.href=data.downloadUrl;actions.replaceChildren(link);
            } else if(['failure','cancelled'].includes(data.status)) {
              const retry=node('a','btn btn-ghost','Start another build');retry.href='/create-app';actions.replaceChildren(retry);
            }
            if(data.runId && settings.run_id!==data.runId) {
              await client.from('projects').update({settings:{...settings,run_id:data.runId,status:data.status}}).eq('id',row.id).eq('user_id',session.user.id);
            }
          }catch{status.textContent=generic;}
        };
        refresh();
      });
      if(!rows.length) noBuild.classList.remove('hidden');
    } catch {
      noBuild.classList.remove('hidden');
      noBuild.querySelector('h3').textContent='Sign in to view your apps';
      noBuild.querySelector('p').textContent='Your saved apps and build history are private to your account.';
      const link=noBuild.querySelector('a'); if(link) {link.href='/account#login';link.textContent='Sign in';}
      list.replaceChildren();
    }
  }
  start();
})();
