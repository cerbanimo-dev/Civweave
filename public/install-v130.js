(()=>{
'use strict';
const VERSION='1.0.30';
let installPrompt=null;
let registration=null;
const $=selector=>document.querySelector(selector);
const help=message=>{$('#install-help').textContent=message};
function standalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
function installGuidance(){
  const button=$('#install-app');
  if(standalone()){button.disabled=true;button.textContent='Commonweave is installed';help('This window is already running as the installed local app.');return}
  if(installPrompt){button.disabled=false;button.textContent='Install Commonweave';help('Ready to install the offline-first local campus.');return}
  const ua=navigator.userAgent.toLowerCase();
  if(/iphone|ipad|ipod/.test(ua)){button.disabled=true;help('On iPhone or iPad, use Share → Add to Home Screen.');return}
  button.disabled=false;button.textContent='Install instructions';help('Your browser may place Install app in the address bar or browser menu once the offline shell is ready.');
}
async function retireLegacy(){
  if(!('serviceWorker'in navigator))return;
  const regs=await navigator.serviceWorker.getRegistrations();
  const legacy=regs.filter(reg=>{const scope=new URL(reg.scope).pathname;const script=reg.active?.scriptURL||'';return scope.startsWith('/app/')||scope.startsWith('/campus/')||/\/services\//.test(scope)||/service-worker-v12[67]\.js|\/app\/service-worker\.js/.test(script)});
  await Promise.allSettled(legacy.map(reg=>reg.unregister()));
}
async function register(){
  if(!('serviceWorker'in navigator)){help('This browser cannot install the offline app. The downloadable seed remains available.');return}
  await retireLegacy();
  registration=await navigator.serviceWorker.register(`/service-worker.js?v=${VERSION}`,{scope:'/',updateViaCache:'none'});
  registration.addEventListener('updatefound',()=>{
    const worker=registration.installing;
    worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){help('An update is ready. Tap Check for update to apply it.');$('#check-update').classList.add('primary')}});
  });
  await navigator.serviceWorker.ready;
  await registration.update().catch(()=>{});
  installGuidance();
}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installGuidance()});
addEventListener('appinstalled',()=>{installPrompt=null;installGuidance()});
$('#install-app').addEventListener('click',async()=>{
  if(installPrompt){installPrompt.prompt();const result=await installPrompt.userChoice;help(result.outcome==='accepted'?'Commonweave installation started.':'Installation was left for later.');installPrompt=null;installGuidance();return}
  help('Use the browser’s Install app command. On iPhone or iPad, use Share → Add to Home Screen.');
});
$('#check-update').addEventListener('click',async()=>{
  try{
    help('Checking the host for a newer local shell…');
    await registration?.update();
    if(registration?.waiting){registration.waiting.postMessage({type:'SKIP_WAITING'});help('Applying the update…');navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});return}
    const release=await fetch(`/loom/version.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.json());
    help(`Host reports v${release.version}. Your offline shell will update when a new worker is available.`);
  }catch{help('The hub is unavailable. The installed local copy remains usable.')}
});
async function status(){
  $('#local-mode').textContent=standalone()?'installed PWA':'installer website';
  try{
    const health=await fetch(`/api/health?t=${Date.now()}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()});
    $('#hub-name').textContent=health.name||'Commonweave Host Node';
    $('#hub-status').textContent='online';
    $('#hub-status').className='is-online';
    $('#hub-build').textContent=health.appVersion||health.build||'unknown';
  }catch{
    $('#hub-name').textContent='Host unavailable';
    $('#hub-status').textContent='offline';
    $('#hub-status').className='is-offline';
    $('#hub-build').textContent='local app unaffected';
  }
}
register().catch(error=>help(`Offline installer could not start: ${error.message}`));
status();
})();