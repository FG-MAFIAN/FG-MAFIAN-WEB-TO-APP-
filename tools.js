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
  const ok=value.length<=180&&/^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value);
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
})();