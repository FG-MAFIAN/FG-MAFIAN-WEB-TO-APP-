(() => {
 const $=id=>document.getElementById(id);
 function show(id,message){const el=$(id);el.hidden=false;el.textContent=message;}
 function validHttps(value){
  let url;try{url=new URL(value.trim())}catch{return null}
  if(url.protocol!=='https:'||!url.hostname||url.username||url.password||url.hostname==='localhost'||url.hostname.endsWith('.local'))return null;
  return url;
 }
 $('makeQr')?.addEventListener('click',()=>{
  const url=validHttps($('qrValue').value);
  if(!url){show('qrOutput','Enter a valid public HTTPS URL first.');return}
  const output=$('qrOutput');output.hidden=false;output.replaceChildren();
  const image=document.createElement('img');image.alt='QR code for '+url.href;image.src='https://api.qrserver.com/v1/create-qr-code/?size=260x260&data='+encodeURIComponent(url.href);
  const note=document.createElement('p');note.textContent='Scan this code to open: '+url.href;
  const link=document.createElement('a');link.href=image.src;link.target='_blank';link.rel='noopener';link.textContent='Open QR image';
  output.append(image,note,link);
 });
 $('checkPackage')?.addEventListener('click',()=>{
  const value=$('packageValue').value.trim();
  const ok=value.length<=180&&/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value);
  show('packageOutput',ok?'Valid package ID format.':'Invalid format. Use a value such as com.company.myapp.');
 });
 $('checkWebsite')?.addEventListener('click',()=>{
  const url=validHttps($('websiteValue').value);
  show('websiteOutput',url?'Valid public HTTPS URL format: '+url.href+' — the builder can now check it during a build.':'Invalid URL. Enter a public HTTPS address such as https://example.com.');
 });
 $('openPreview')?.addEventListener('click',()=>{
  const url=validHttps($('previewValue').value);
  if(!url){show('previewOutput','Enter a valid public HTTPS URL first.');return}
  const opened=window.open(url.href,'_blank','noopener,noreferrer');
  show('previewOutput',opened?'Website opened in a new tab.':'Your browser blocked the new tab. Allow pop-ups and try again.');
 });

 const iconInput=$('iconSource'),iconWrap=$('iconPreviewWrap'),iconPreview=$('iconSourcePreview'),iconStatus=$('iconStatus');let selectedIcon=null,selectedIconUrl='';
 iconInput?.addEventListener('change',()=>{const file=iconInput.files?.[0];selectedIcon=null;if(selectedIconUrl)URL.revokeObjectURL(selectedIconUrl);if(!file){iconWrap.hidden=true;return}if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8*1024*1024){iconWrap.hidden=false;iconStatus.textContent='Choose a PNG, JPG or WebP image smaller than 8 MB.';return}selectedIconUrl=URL.createObjectURL(file);const image=new Image();image.onload=()=>{selectedIcon=image;iconPreview.src=selectedIconUrl;iconWrap.hidden=false;iconStatus.textContent='Image ready. Choose an output size.'};image.onerror=()=>{iconWrap.hidden=false;iconStatus.textContent='Could not read this image.'};image.src=selectedIconUrl});
 document.querySelectorAll('[data-icon-size]').forEach(button=>button.addEventListener('click',()=>{if(!selectedIcon){iconStatus.textContent='Choose an image first.';return}const size=Number(button.dataset.iconSize),canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');if(!ctx){iconStatus.textContent='Image conversion is unavailable in this browser.';return}const scale=Math.min(size/selectedIcon.width,size/selectedIcon.height),w=selectedIcon.width*scale,h=selectedIcon.height*scale;ctx.clearRect(0,0,size,size);ctx.drawImage(selectedIcon,(size-w)/2,(size-h)/2,w,h);canvas.toBlob(blob=>{if(!blob){iconStatus.textContent='Could not export the PNG.';return}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='android-app-icon-'+size+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);iconStatus.textContent=size+' × '+size+' PNG downloaded.'},'image/png')}));
})();