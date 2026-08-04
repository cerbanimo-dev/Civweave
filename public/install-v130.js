(()=>{
'use strict';
const VERSION='1.0.4';
const ENTRY='/app/installed-entry-v146.html?system=commonweave';
const WORKER_REVISION='device-package-r34-lean';
const WORKER_URL=`/service-worker.js?v=${VERSION}-${WORKER_REVISION}`;
const PREPARE_TIMEOUT_MS=180000;
const AUTO_RESET_KEY='commonweave.device-package.auto-reset';
let installPrompt=null;
let registration=null;
let packageReady=false;
let packageStatus=null;
let packageError=null;
let preparing=false;
const workerWaits=new WeakMap();
const $=selector=>document.querySelector(selector);
const help=message=>{$('#install-help').textContent=message};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function standalone(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function isIOS(){return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())}
function rootScope(reg){try{const scope=new URL(reg.scope);return scope.origin===location.origin&&scope.pathname==='/'}catch{return false}}
function invalidWorkerState(error){return /invalid state|failed to update a serviceworker|script \('unknown'\)/i.test(String(error?.message||error||''))}
function showPackage(status={}){
  packageStatus=status;
  $('#package-state').textContent=packageReady?'complete':packageError?'failed':'preparing';
  const missing=Array.isArray(status.missing)?status.missing.length:0;
  $('#package-assets').textContent=packageReady&&Number.isFinite(status.assetCount)?`${status.assetCount} required files`:missing?`${missing} missing files`:Number.isFinite(status.assetCount)?`${status.assetCount} required files`:'complete package';
  $('#local-mode').textContent=standalone()?'installed PWA':'installer browser';
}
function guidance(){
  const button=$('#install-app');
  if(standalone()){button.disabled=false;button.textContent='Open installed Commonweave';help('The installed app is ready on this device.');return}
  if(packageError){button.disabled=false;button.textContent='Reset and retry package';help(`Device package preparation failed: ${packageError.message}. Tap reset and retry to remove the failed worker, clear only package caches, and start clean.`);return}
  if(preparing||!packageReady){button.disabled=true;button.textContent='Preparing device package…';help('Downloading and verifying the lean offline software package before installation.');return}
  if(installPrompt){button.disabled=false;button.textContent='Install Commonweave';help('The complete local package is ready. Install to open Commonweave Cabinet Mode.');return}
  button.disabled=false;button.textContent=isIOS()?'Show iPhone/iPad instructions':'Show installation instructions';
  help(isIOS()?'In Safari, use Share → Add to Home Screen.':'Use the browser’s Install app command if it is not offered automatically.');
}
function failPackage(error){
  packageReady=false;
  packageError=error instanceof Error?error:new Error(String(error||'Unknown package error'));
  showPackage({...packageStatus,error:packageError.message});
  guidance();
}
async function retireLegacy(){
  if(!('serviceWorker'in navigator))return;
  const regs=await navigator.serviceWorker.getRegistrations();
  const legacy=regs.filter(reg=>{const scope=new URL(reg.scope).pathname;const script=reg.active?.scriptURL||'';return scope.startsWith('/app/')||scope.startsWith('/campus/')||/\/services\//.test(scope)||/service-worker-v12[67]\.js|\/app\/service-worker\.js/.test(script)});
  await Promise.allSettled(legacy.map(reg=>reg.unregister()));
}
async function resetDevicePackage(){
  help('Removing the failed device worker and incomplete package cache…');
  if('serviceWorker'in navigator){
    const regs=await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(regs.filter(rootScope).map(reg=>reg.unregister()));
  }
  if('caches'in window){
    const keys=await caches.keys();
    await Promise.allSettled(keys.filter(key=>key.startsWith('commonweave-')).map(key=>caches.delete(key)));
  }
  registration=null;
  await pause(350);
  const next=new URL(location.href);
  next.searchParams.set('package-reset',Date.now().toString(36));
  location.replace(next.href);
}
function askWorker(type){return new Promise(resolve=>{const worker=registration?.waiting||registration?.active||registration?.installing;if(!worker)return resolve(null);const channel=new MessageChannel(),timer=setTimeout(()=>resolve(null),5000);channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data||null)};worker.postMessage({type},[channel.port2])})}
function waitForWorker(worker){
  if(!worker)return Promise.resolve();
  if(workerWaits.has(worker))return workerWaits.get(worker);
  const promise=new Promise((resolve,reject)=>{
    let done=false,timer=0;
    const finish=error=>{if(done)return;done=true;clearTimeout(timer);worker.removeEventListener('statechange',check);error?reject(error):resolve()};
    const check=()=>{if(worker.state==='installed'||worker.state==='activated')finish();else if(worker.state==='redundant')finish(new Error('The browser rejected the device package because a required model or application file could not be cached.'))};
    worker.addEventListener('statechange',check);
    timer=setTimeout(()=>finish(new Error('Device package preparation timed out.')),PREPARE_TIMEOUT_MS);
    check();
  });
  workerWaits.set(worker,promise);
  return promise;
}
function readyWorker(){return Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('The service worker did not become ready in time.')),PREPARE_TIMEOUT_MS))])}
async function confirmReady(){
  const status=await askWorker('GET_DEVICE_PACKAGE_STATUS');
  if(status?.type!=='COMMONWEAVE_DEVICE_PACKAGE')throw new Error('The device package worker did not report its readiness.');
  packageReady=Boolean(status.ready);
  packageError=null;
  showPackage(status);
  if(!packageReady){const sample=(status.missing||[]).slice(0,2).join(', ');throw new Error(sample?`The device package is incomplete. Missing: ${sample}`:'The device package is incomplete.')}
  sessionStorage.removeItem(AUTO_RESET_KEY);
  guidance();
  return status;
}
async function preparePackage(){
  if(preparing)return;
  preparing=true;
  packageReady=false;
  packageError=null;
  showPackage();
  guidance();
  try{
    if(!('serviceWorker'in navigator))throw new Error('This browser cannot install the offline package. Use the mobile kit or a local host.');
    await retireLegacy();
    registration=await navigator.serviceWorker.register(WORKER_URL,{scope:'/',updateViaCache:'none'});
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      if(!worker)return;
      packageReady=false;packageError=null;preparing=true;showPackage();guidance();
      waitForWorker(worker).then(confirmReady).catch(failPackage).finally(()=>{preparing=false;guidance()});
    });
    if(registration.installing)await waitForWorker(registration.installing);
    if(!registration.active&&!registration.waiting)await readyWorker();
    await confirmReady();
  }catch(error){
    if(invalidWorkerState(error)&&sessionStorage.getItem(AUTO_RESET_KEY)!==WORKER_REVISION){
      sessionStorage.setItem(AUTO_RESET_KEY,WORKER_REVISION);
      await resetDevicePackage();
      return;
    }
    failPackage(error);
  }finally{preparing=false;guidance()}
}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;guidance()});
addEventListener('appinstalled',()=>{installPrompt=null;packageReady=true;packageError=null;sessionStorage.removeItem(AUTO_RESET_KEY);help('Installed. Launch Commonweave from its new app icon.');$('#install-app').textContent='Installed';$('#install-app').disabled=true});
$('#install-app').addEventListener('click',async()=>{
  if(standalone()){location.assign(ENTRY);return}
  if(packageError){await resetDevicePackage();return}
  if(!packageReady){help('The device package is still being prepared.');return}
  if(installPrompt){installPrompt.prompt();const result=await installPrompt.userChoice;help(result.outcome==='accepted'?'Installation accepted. Launch the app from its icon when ready.':'Installation was left for later.');installPrompt=null;guidance();return}
  help(isIOS()?'Open this page in Safari, tap Share, then Add to Home Screen.':'Open the browser menu and choose Install app. The browser controls when the native prompt is available.');
});
$('#check-update').addEventListener('click',async()=>{
  try{
    help('Checking the signed release record…');
    if(registration?.active)await registration.update();
    const endpoint=new URL('/api/releases/current',location.origin);const release=await fetch(endpoint,{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error(`release gateway returned ${response.status}`);return response.json()});
    help(`Release ${release.appVersion||release.version||'unknown'} is advertised. Package updates are applied only after the complete worker install succeeds.`);
    await confirmReady();
  }catch(error){failPackage(error)}
});
if(standalone()){location.replace(ENTRY);return}
showPackage();guidance();preparePackage();
})();
