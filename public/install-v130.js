(()=>{
'use strict';
const VERSION='1.0.4';
const ENTRY='/app/installed-entry-v146.html?system=commonweave';
const WORKER_REVISION='progressive-device-r37';
const ADDITIONS_REVISION='working-campus-additions-v156-r2';
const WORKER_URL=`/service-worker-v156.js?v=${VERSION}-${WORKER_REVISION}-${ADDITIONS_REVISION}`;
const PREPARE_TIMEOUT_MS=20000;
const AUTO_RESET_KEY='commonweave.device-package.auto-reset';
let installPrompt=null;
let registration=null;
let packageReady=false;
let packageStatus=null;
let packageError=null;
let preparing=false;
let checking=false;
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
  $('#package-state').textContent=packageReady?'ready':packageError?'failed':'preparing';
  const missing=Array.isArray(status.missing)?status.missing.length:0;
  const cached=Number(status.presentCount||0)+Number(status.additions?.presentCount||0);
  const total=Number(status.assetCount||0)+Number(status.additions?.assetCount||0);
  $('#package-assets').textContent=packageReady&&total?`${total} boot files ready`:missing?`${missing} boot files missing`:total?`${cached}/${total} boot files`:'checking boot shell';
  $('#local-mode').textContent=standalone()?'installed PWA':'installer browser';
}
function guidance(){
  const button=$('#install-app');
  if(standalone()){
    button.disabled=false;
    button.textContent='Open installed Commonweave';
    help('The installed working campus is ready on this device.');
    return;
  }
  if(packageError){
    button.disabled=false;
    button.textContent='Reset and retry shell';
    help(`Fast shell preparation failed: ${packageError.message}. Tap reset and retry to clear the incomplete worker and start clean.`);
    return;
  }
  if(preparing||!packageReady){
    button.disabled=true;
    button.textContent='Preparing fast shell…';
    help('Preparing the small Working Campus boot shell and additive tools. Realm code and local models cache only when used.');
    return;
  }
  if(installPrompt){
    button.disabled=false;
    button.textContent='Install Commonweave';
    help('The fast local shell is ready. Optional realm and model files download as needed.');
    return;
  }
  button.disabled=false;
  button.textContent=isIOS()?'Show iPhone/iPad instructions':'Show installation instructions';
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
  const legacy=regs.filter(reg=>{
    const scope=new URL(reg.scope).pathname;
    const script=reg.active?.scriptURL||'';
    return scope.startsWith('/app/')||scope.startsWith('/campus/')||/\/services\//.test(scope)||/service-worker-v12[67]\.js|\/app\/service-worker\.js/.test(script);
  });
  await Promise.allSettled(legacy.map(reg=>reg.unregister()));
}
async function resetDevicePackage(){
  help('Removing the failed worker and incomplete shell cache…');
  if('serviceWorker'in navigator){
    const regs=await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(regs.filter(rootScope).map(reg=>reg.unregister()));
  }
  if('caches'in window){
    const keys=await caches.keys();
    await Promise.allSettled(keys.filter(key=>key.startsWith('commonweave-')||key.startsWith('cwext-')).map(key=>caches.delete(key)));
  }
  registration=null;
  await pause(200);
  const next=new URL(location.href);
  next.searchParams.set('package-reset',Date.now().toString(36));
  location.replace(next.href);
}
function askWorker(type){
  return new Promise(resolve=>{
    const worker=registration?.waiting||registration?.active||registration?.installing||navigator.serviceWorker.controller;
    if(!worker)return resolve(null);
    const channel=new MessageChannel();
    const timer=setTimeout(()=>resolve(null),5000);
    channel.port1.onmessage=event=>{
      clearTimeout(timer);
      resolve(event.data||null);
    };
    worker.postMessage({type},[channel.port2]);
  });
}
function waitForWorker(worker){
  if(!worker)return Promise.resolve();
  if(workerWaits.has(worker))return workerWaits.get(worker);
  const promise=new Promise((resolve,reject)=>{
    let done=false;
    let timer=0;
    const finish=error=>{
      if(done)return;
      done=true;
      clearTimeout(timer);
      worker.removeEventListener('statechange',check);
      error?reject(error):resolve();
    };
    const check=()=>{
      if(worker.state==='installed'||worker.state==='activated')finish();
      else if(worker.state==='redundant')finish(new Error('The browser rejected the Commonweave boot shell.'));
    };
    worker.addEventListener('statechange',check);
    timer=setTimeout(()=>finish(new Error('Fast shell preparation timed out.')),PREPARE_TIMEOUT_MS);
    check();
  });
  workerWaits.set(worker,promise);
  return promise;
}
async function confirmReady(){
  const status=await askWorker('GET_DEVICE_PACKAGE_STATUS');
  if(!status||status.type!=='COMMONWEAVE_DEVICE_PACKAGE')throw new Error('The base worker did not return shell readiness.');
  if(!status.ready)throw new Error(`${status.missing?.length||'Some'} base boot files are missing.`);
  const additions=await askWorker('GET_ADDITIONS_STATUS');
  if(!additions||additions.type!=='COMMONWEAVE_ADDITIONS_STATUS')throw new Error('The Working Campus additive layer did not return readiness.');
  const combined={...status,baseWorkerRevision:WORKER_REVISION,additionsRevision:ADDITIONS_REVISION,additions:{...additions,presentCount:additions.assetCount-(additions.missing?.length||0)},missing:[...(status.missing||[]),...(additions.missing||[])]};
  packageReady=Boolean(status.ready&&additions.ready);
  packageError=null;
  showPackage(combined);
  guidance();
  if(!packageReady)throw new Error(`${combined.missing.length||'Some'} boot files are missing.`);
  return combined;
}
async function activateWaitingWorker(){
  if(!registration?.waiting)return;
  registration.waiting.postMessage({type:'SKIP_WAITING'});
  for(let i=0;i<40&&!navigator.serviceWorker.controller;i+=1)await pause(50);
}
async function preparePackage(){
  if(preparing)return;
  preparing=true;
  packageReady=false;
  packageError=null;
  showPackage({});
  guidance();
  try{
    await retireLegacy();
    registration=await navigator.serviceWorker.register(WORKER_URL,{scope:'/',updateViaCache:'none'});
    const worker=registration.installing||registration.waiting||registration.active;
    await waitForWorker(worker);
    await activateWaitingWorker();
    await confirmReady();
    sessionStorage.removeItem(AUTO_RESET_KEY);
  }catch(error){
    if(invalidWorkerState(error)&&sessionStorage.getItem(AUTO_RESET_KEY)!=='1'){
      sessionStorage.setItem(AUTO_RESET_KEY,'1');
      await resetDevicePackage();
      return;
    }
    failPackage(error);
  }finally{
    preparing=false;
    guidance();
  }
}
async function checkUpdate(){
  if(checking)return;
  const button=$('#check-update');
  checking=true;
  if(button){button.disabled=true;button.textContent='Checking…'}
  help('Checking the release marker, boot shell, and additive layer…');
  try{
    registration=registration||await navigator.serviceWorker.getRegistration('/');
    if(!registration){await preparePackage();return}
    await registration.update();
    if(registration.installing)await waitForWorker(registration.installing);
    await activateWaitingWorker();
    await confirmReady();
    help('Commonweave is current. Changed files now refresh behind the visible interface instead of rebuilding the whole offline package.');
  }catch(error){
    failPackage(error);
  }finally{
    checking=false;
    if(button){button.disabled=false;button.textContent='Check release'}
  }
}
async function install(){
  if(packageError){await resetDevicePackage();return}
  if(standalone()){location.assign(ENTRY);return}
  if(!packageReady)return;
  if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;guidance();return}
  if(isIOS())alert('In Safari, tap Share, then Add to Home Screen.');
  else alert('Open your browser menu and choose Install app. The fast local shell is ready.');
}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;guidance()});
addEventListener('appinstalled',()=>{installPrompt=null;help('Commonweave is installed. Open it from your device.');guidance()});
navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(registration&&!preparing)confirmReady().catch(()=>{})});
$('#install-app')?.addEventListener('click',install);
$('#check-update')?.addEventListener('click',checkUpdate);
showPackage({});
guidance();
preparePackage();
})();
