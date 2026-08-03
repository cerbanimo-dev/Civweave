(()=>{
'use strict';
const VERSION='1.0.32';
const ENTRY='/app/installed-entry-v146.html?target=hub';
let installPrompt=null;
let registration=null;
let packageReady=false;
let packageStatus=null;
const $=selector=>document.querySelector(selector);
const help=message=>{$('#install-help').textContent=message};
function standalone(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function isIOS(){return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())}
function showPackage(status={}){
  packageStatus=status;
  $('#package-state').textContent=packageReady?'complete':'preparing';
  $('#package-assets').textContent=Number.isFinite(status.assetCount)?`${status.assetCount} required files`:'complete package';
  $('#local-mode').textContent=standalone()?'installed PWA':'installer browser';
}
function guidance(){
  const button=$('#install-app');
  if(standalone()){button.disabled=false;button.textContent='Open installed Commonweave';help('The installed app is ready on this device.');return}
  if(!packageReady){button.disabled=true;button.textContent='Preparing device package…';help('Downloading and verifying the complete offline package before installation.');return}
  if(installPrompt){button.disabled=false;button.textContent='Install Commonweave';help('The complete local package is ready. Install to enter the campus.');return}
  button.disabled=false;button.textContent=isIOS()?'Show iPhone/iPad instructions':'Show installation instructions';
  help(isIOS()?'In Safari, use Share → Add to Home Screen.':'Use the browser’s Install app command if it is not offered automatically.');
}
async function retireLegacy(){
  if(!('serviceWorker'in navigator))return;
  const regs=await navigator.serviceWorker.getRegistrations();
  const legacy=regs.filter(reg=>{const scope=new URL(reg.scope).pathname;const script=reg.active?.scriptURL||'';return scope.startsWith('/app/')||scope.startsWith('/campus/')||/\/services\//.test(scope)||/service-worker-v12[67]\.js|\/app\/service-worker\.js/.test(script)});
  await Promise.allSettled(legacy.map(reg=>reg.unregister()));
}
function askWorker(type){return new Promise(resolve=>{const worker=registration?.active||registration?.waiting||registration?.installing;if(!worker)return resolve(null);const channel=new MessageChannel(),timer=setTimeout(()=>resolve(null),2500);channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data||null)};worker.postMessage({type},[channel.port2])})}
async function register(){
  if(!('serviceWorker'in navigator)){help('This browser cannot install the offline package. Use the mobile kit or a local host.');return}
  await retireLegacy();
  registration=await navigator.serviceWorker.register(`/service-worker.js?v=${VERSION}-install-only-r26`,{scope:'/',updateViaCache:'none'});
  registration.addEventListener('updatefound',()=>{
    packageReady=false;guidance();
    const worker=registration.installing;
    worker?.addEventListener('statechange',async()=>{if(worker.state==='installed'){if(navigator.serviceWorker.controller)help('A complete updated package is ready to apply.');await confirmReady()}});
  });
  await navigator.serviceWorker.ready;
  await confirmReady();
}
async function confirmReady(){
  packageReady=true;
  const status=await askWorker('GET_DEVICE_PACKAGE_STATUS');
  if(status?.type==='COMMONWEAVE_DEVICE_PACKAGE')packageReady=Boolean(status.ready);
  showPackage(status||{});guidance();
}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;guidance()});
addEventListener('appinstalled',()=>{installPrompt=null;packageReady=true;help('Installed. Launch Commonweave from its new app icon.');$('#install-app').textContent='Installed';$('#install-app').disabled=true});
$('#install-app').addEventListener('click',async()=>{
  if(standalone()){location.assign(ENTRY);return}
  if(!packageReady){help('The device package is still being prepared.');return}
  if(installPrompt){installPrompt.prompt();const result=await installPrompt.userChoice;help(result.outcome==='accepted'?'Installation accepted. Launch the app from its icon when ready.':'Installation was left for later.');installPrompt=null;guidance();return}
  help(isIOS()?'Open this page in Safari, tap Share, then Add to Home Screen.':'Open the browser menu and choose Install app. The browser controls when the native prompt is available.');
});
$('#check-update').addEventListener('click',async()=>{
  try{
    help('Checking the signed release record…');
    await registration?.update();
    const endpoint=new URL('/api/releases/current',location.origin);const release=await fetch(endpoint,{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error(`release gateway returned ${response.status}`);return response.json()});
    help(`Release ${release.appVersion||release.version||'unknown'} is advertised. Package updates are applied only after the complete worker install succeeds.`);
    await confirmReady();
  }catch(error){help(`Release check unavailable: ${error.message}. The prepared local package is unaffected.`)}
});
if(standalone()){location.replace(ENTRY);return}
showPackage();guidance();
register().catch(error=>help(`Device package preparation failed: ${error.message}`));
})();
