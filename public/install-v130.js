(()=>{
'use strict';
const VERSION='1.0.4';
const ENTRY='/app/installed-entry-v146.html?system=commonweave';
const WORKER_REVISION='device-package-r37-core';
const ADDITIONS_REVISION='working-campus-additions-v157-fast-core';
const WORKER_BUILD=`${VERSION}-${WORKER_REVISION}-${ADDITIONS_REVISION}`;
const WORKER_URL=`/service-worker-v156.js?v=${WORKER_BUILD}`;
const PREPARE_TIMEOUT_MS=120000;
const AUTO_RESET_KEY='commonweave.device-package.auto-reset.fast-core-r37';
let installPrompt=null;
let registration=null;
let packageReady=false;
let packageStatus=null;
let packageError=null;
let preparing=false;
const workerWaits=new WeakMap();
const $=selector=>document.querySelector(selector);
const help=message=>{const node=$('#install-help');if(node)node.textContent=message};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function standalone(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function isIOS(){return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())}
function rootScope(reg){try{const scope=new URL(reg.scope);return scope.origin===location.origin&&scope.pathname==='/'}catch{return false}}
function invalidWorkerState(error){return /invalid state|failed to update a serviceworker|script \('unknown'\)|redundant/i.test(String(error?.message||error||''))}
function workerUrls(reg){return[reg?.installing?.scriptURL,reg?.waiting?.scriptURL,reg?.active?.scriptURL].filter(Boolean)}
function currentWorker(reg){return workerUrls(reg).some(value=>{try{const url=new URL(value);return url.pathname==='/service-worker-v156.js'&&url.searchParams.get('v')===WORKER_BUILD}catch{return false}})}
function showPackage(status={}){
  packageStatus=status;
  $('#package-state').textContent=packageReady?'complete':packageError?'failed':'preparing';
  const missing=Array.isArray(status.missing)?status.missing.length:0;
  const total=Number(status.assetCount||0)+Number(status.additions?.assetCount||0);
  $('#package-assets').textContent=packageReady&&total?`${total} core files`:missing?`${missing} missing files`:total?`${total} core files`:'checking core';
  const model=status.model||{};
  $('#local-mode').textContent=model.ready?`${model.presentCount||model.assetCount||0} model files cached`:'downloads when enabled';
}
function guidance(){
  const button=$('#install-app');
  if(standalone()){button.disabled=false;button.textContent='Open installed Commonweave';help('The installed working campus is ready on this device.');return}
  if(packageError){button.disabled=false;button.textContent='Reset and retry package';help(`Core package preparation failed: ${packageError.message}. Tap reset and retry to remove the failed worker and its incomplete caches.`);return}
  if(preparing||!packageReady){button.disabled=true;button.textContent='Preparing core package…';help('Caching the five software surfaces and their local-first data engines. The optional local model no longer blocks installation.');return}
  if(installPrompt){button.disabled=false;button.textContent='Install Commonweave';help('The fast offline core is ready. The local semantic model can be downloaded later from AI settings.');return}
  button.disabled=false;button.textContent=isIOS()?'Show iPhone/iPad instructions':'Show installation instructions';help(isIOS()?'In Safari, use Share → Add to Home Screen.':'Use the browser’s Install app command if it is not offered automatically.');
}
function failPackage(error){packageReady=false;packageError=error instanceof Error?error:new Error(String(error||'Unknown package error'));showPackage({...packageStatus,error:packageError.message});guidance()}
async function retireLegacy(){
  if(!('serviceWorker'in navigator))return;
  const regs=await navigator.serviceWorker.getRegistrations();
  const legacy=regs.filter(reg=>{const scope=new URL(reg.scope).pathname;const script=reg.active?.scriptURL||reg.waiting?.scriptURL||reg.installing?.scriptURL||'';return scope.startsWith('/app/')||scope.startsWith('/campus/')||/\/services\//.test(scope)||/service-worker-v12[67]\.js|\/app\/service-worker\.js/.test(script)});
  await Promise.allSettled(legacy.map(reg=>reg.unregister()));
}
async function clearPackageCaches(){
  if(!('caches'in window))return;
  const keys=await caches.keys();
  const baseKeys=keys.filter(key=>key.startsWith('commonweave-'));
  const extensionKeys=keys.filter(key=>key.startsWith('cwext-'));
  await Promise.allSettled([...baseKeys,...extensionKeys].map(key=>caches.delete(key)));
}
async function resetDevicePackage(){
  help('Removing the failed or superseded device worker and incomplete package cache…');
  if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.allSettled(regs.filter(rootScope).map(reg=>reg.unregister()))}
  await clearPackageCaches();
  registration=null;
  await pause(350);
  const next=new URL(location.href);next.searchParams.set('package-reset',Date.now().toString(36));location.replace(next.href);
}
async function replaceSupersededRoot(){
  if(!('serviceWorker'in navigator))return false;
  const existing=await navigator.serviceWorker.getRegistration('/');
  if(!existing||currentWorker(existing))return false;
  if(sessionStorage.getItem(AUTO_RESET_KEY)==='1')return false;
  sessionStorage.setItem(AUTO_RESET_KEY,'1');
  help('Replacing an older package worker that can no longer finish this installer…');
  await resetDevicePackage();
  return true;
}
function askWorker(type,timeoutMs=10000){
  return new Promise(resolve=>{
    const worker=registration?.waiting||registration?.active||registration?.installing;
    if(!worker)return resolve(null);
    const channel=new MessageChannel(),timer=setTimeout(()=>resolve(null),timeoutMs);
    channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data||null)};
    worker.postMessage({type},[channel.port2]);
  });
}
function waitForWorker(worker){
  if(!worker)return Promise.resolve();
  if(workerWaits.has(worker))return workerWaits.get(worker);
  const promise=new Promise((resolve,reject)=>{
    let done=false,timer=0;
    const finish=error=>{if(done)return;done=true;clearTimeout(timer);worker.removeEventListener('statechange',check);error?reject(error):resolve()};
    const check=()=>{
      if(worker.state==='installed'||worker.state==='activated')finish();
      else if(worker.state==='redundant')finish(new Error('The browser rejected the core package because one of its required HTML, CSS, JavaScript, or local data files could not be cached.'));
      else help(`Preparing core package · ${worker.state||'working'}…`);
    };
    worker.addEventListener('statechange',check);
    timer=setTimeout(()=>finish(new Error('Core package preparation timed out.')),PREPARE_TIMEOUT_MS);
    check();
  });
  workerWaits.set(worker,promise);
  return promise;
}
async function confirmReady(){
  const status=await askWorker('GET_DEVICE_PACKAGE_STATUS');
  if(!status||status.type!=='COMMONWEAVE_DEVICE_PACKAGE')throw new Error('The device worker did not return core-package readiness.');
  packageReady=Boolean(status.ready);
  if(!packageReady)throw new Error(`${(status.missing||[]).length||'Some'} required core-package files are missing.`);
  const additions=await askWorker('GET_ADDITIONS_STATUS');
  if(!additions||additions.type!=='COMMONWEAVE_ADDITIONS_STATUS')throw new Error('The shared-tools layer did not return package readiness.');
  packageReady=Boolean(packageReady&&additions.ready);
  if(!packageReady)throw new Error(`${(additions.missing||[]).length||'Some'} shared-tool files are missing.`);
  const model=await askWorker('GET_MODEL_PACKAGE_STATUS',3000)||{ready:false,deferred:true,assetCount:0,presentCount:0,missing:[]};
  packageError=null;
  const combined={...status,baseWorkerRevision:WORKER_REVISION,additionsRevision:ADDITIONS_REVISION,additions,model,missing:[...(status.missing||[]),...(additions.missing||[])]};
  showPackage(combined);guidance();return combined;
}
async function preparePackage(){
  if(preparing)return;
  preparing=true;packageReady=false;packageError=null;showPackage({});guidance();
  try{
    if(await replaceSupersededRoot())return;
    await retireLegacy();
    registration=await navigator.serviceWorker.register(WORKER_URL,{scope:'/',updateViaCache:'none'});
    const worker=registration.installing||registration.waiting||registration.active;
    await waitForWorker(worker);
    if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
    for(let i=0;i<50&&!navigator.serviceWorker.controller;i+=1)await pause(100);
    await confirmReady();
    sessionStorage.removeItem(AUTO_RESET_KEY);
  }catch(error){
    if(invalidWorkerState(error)&&sessionStorage.getItem(AUTO_RESET_KEY)!=='1'){sessionStorage.setItem(AUTO_RESET_KEY,'1');await resetDevicePackage();return}
    failPackage(error);
  }finally{preparing=false;guidance()}
}
async function install(){
  if(packageError){await resetDevicePackage();return}
  if(standalone()){location.assign(ENTRY);return}
  if(!packageReady)return;
  if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;guidance();return}
  if(isIOS())alert('In Safari, tap Share, then Add to Home Screen.');else alert('Open your browser menu and choose Install app. The fast offline core is already ready.');
}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;guidance()});
addEventListener('appinstalled',()=>{installPrompt=null;help('Commonweave is installed. Open it from your device.');guidance()});
$('#install-app')?.addEventListener('click',install);
$('#check-update')?.addEventListener('click',()=>{sessionStorage.removeItem(AUTO_RESET_KEY);preparePackage()});
showPackage({});guidance();preparePackage();
})();