(() => {
 const menu=document.querySelector('.home-menu');if(!menu)return;
 const backdrop=document.createElement('button');backdrop.type='button';backdrop.className='home-menu-backdrop';backdrop.setAttribute('aria-label','Close navigation menu');backdrop.tabIndex=-1;document.body.appendChild(backdrop);
 const summary=menu.querySelector('summary'),links=[...menu.querySelectorAll('.home-menu-items a')],current=location.pathname.replace(/\/$/,'')||'/';
 links.forEach(link=>{try{const u=new URL(link.href,location.href);if(u.origin===location.origin&&(u.pathname.replace(/\/$/,'')||'/')===current)link.setAttribute('aria-current','page')}catch{}});
 function setOpen(open){menu.open=open;backdrop.classList.toggle('is-visible',open);document.body.classList.toggle('home-menu-open',open);summary?.setAttribute('aria-expanded',String(open))}
 menu.addEventListener('toggle',()=>{backdrop.classList.toggle('is-visible',menu.open);document.body.classList.toggle('home-menu-open',menu.open);summary?.setAttribute('aria-expanded',String(menu.open))});
 backdrop.addEventListener('click',()=>{setOpen(false);summary?.focus()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){setOpen(false);summary?.focus()}});
 links.forEach(a=>a.addEventListener('click',()=>setOpen(false)));summary?.setAttribute('aria-expanded','false');
})();