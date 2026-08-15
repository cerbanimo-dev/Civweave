(()=>{
'use strict';

const VERSION='1.0.160';
const ENTRY='/app/installed-entry-v146.html?installed=1&system=civweave';
const BOOTSTRAP_BUILD='installer-bootstrap-v1-local-first';
const BOOTSTRAP_URL=`/service-worker-install-v1.js?v=${VERSION}-${BOOTSTRAP_BUILD}`;
const FULL_WORKER_URL=`/service-worker-v203.js?v=${VERSION}-lightweight-shell-v208&revision=boot-recovery-v426-install-only-pwa-v1`;
const REGISTRATION_TIMEOUT_MS=15000;
const ACTIVATION_TIMEOUT_MS=45000;
const OFFLINE_MANIFEST_URL='/app/offline-package-v208.json';
const PROTECTED_CACHE_PREFIXES=['cwknowledge-','cwupdate-','civweave-model-','civweave-offline-'];

let installPrompt=null;
let registration=null;
let activeWorker=null;
let shellReady=false;
let shellStatus=null;
let shellError=null;
let preparing=false;
let offlineStatus=null;
let offlineBusy=false;

const $=selector=>document.querySelector(selector);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const help=message=>{const node=$('#install-help');if(node)node.textContent=message};

function withTimeout(promise,timeoutMs,message){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{if(settled)return;settled=true;reject(new Error(message))},timeoutMs);
    Promise.resolve(promise).then(value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value)},error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error)});
  });
}
function standalone(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function isIOS(){return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())}
function workerPath(worker){try{return new URL(worker?.scriptURL||'').pathname}catch{return''}}
function isBootstrapWorker(worker){return workerPath(worker)==='/service-worker-install-v1.js'}
function isFullWorker(worker){return workerPath(worker)==='/service-worker-v203.js'}
function formatBytes(bytes){const value=Number(bytes||0);if(!value)return'';if(value<1024*1024)return`${Math.max(1,Math.round(value/1024))} KB`;return`${(value/(1024*1024)).toFixed(value>=10*1024*1024?0:1)} MB`}

function showShell(status={}){
  shellStatus=status;
  const state=$('#package-state'),assets=$('#package-assets'),mode=$('#local-mode');
  if(state)state.textContent=shellReady?'ready':shellError?'failed':preparing?'preparing':'not prepared';
  if(assets){const total=Number(status.assetCount||0),present=Number(status.presentCount||0);assets.textContent=total?`${present}/${total} shell files`:preparing?'checking shell':'starts on install'}
  if(mode)mode.textContent='bootstrap shell · required local campus · optional models, media, and knowledge';
}
function showOffline(status=offlineStatus||{}){
  offlineStatus=status;
  const state=$('#offline-package-state'),assets=$('#offline-package-assets'),button=$('#download-offline-package');
  const failed=Number(status.failedCount||status.failed?.length||0),complete=Number(status.downloaded??status.completed??0),total=Number(status.total||status.discovered||0),size=formatBytes(status.bytes);
  if(state){if(status.running||offlineBusy)state.textContent='downloading';else if(status.ready)state.textContent='ready locally';else if(status.paused)state.textContent='paused';else if(failed)state.textContent=`${failed} file${failed===1?'':'s'} need retry`;else state.textContent=complete?'partially downloaded':'required before install'}
  if(assets){const count=total?`${Math.min(complete,total)}/${total} files`:'not started';assets.textContent=size?`${count} · ${size}`:count}
  if(button){button.disabled=offlineBusy||preparing;if(offlineBusy||status.running)button.textContent=total?`Downloading ${Math.min(complete,total)}/${total}…`:'Preparing local campus…';else if(status.ready)button.textContent='Local campus ready';else if(status.paused||complete)button.textContent='Resume local campus';else if(failed)button.textContent=`Retry ${failed} missing file${failed===1?'':'s'}`;else button.textContent='Download local campus'}
}
function guidance(){
  const button=$('#install-app');if(!button)return;
  if(shellError){button.disabled=false;button.textContent='Reset app shell and retry';help(`The small app shell failed: ${shellError.message}. Saved campus, knowledge, and model data will be preserved.`);return}
  if(preparing){button.disabled=true;button.textContent='Downloading app shell…';help('Downloading the 11-file bootstrap shell. The required local campus follows as a separate visible package.');return}
  if(offlineBusy){button.disabled=true;button.textContent='Building local campus…';help('The local campus is being stored on this device. Civweave will not rely on the network after this package is complete.');return}
  if(standalone()){
    button.disabled=false;
    if(offlineStatus?.ready){button.textContent=`Open Civweave v${VERSION}`;help('Civweave and its local campus are stored on this device. Models, media, and knowledge packs remain optional.');}
    else{button.textContent='Finish local campus';help('The app shell is installed, but the local campus package must finish before Civweave can open without the network.');}
    return;
  }
  button.disabled=false;button.textContent=`Install Civweave v${VERSION}`;
  if(shellReady&&offlineStatus?.ready)help(installPrompt?'The local Civweave package is complete. Install the app now.':'The local Civweave package is complete. Use Install app or Add to Home screen if your browser does not show the prompt.');
  else if(shellReady)help('The bootstrap is ready. The required local campus will download next; models, media, and knowledge packs stay optional.');
  else help('Ready when you are. Civweave will assemble its local package visibly before the browser install prompt.');
}

async function askWorker(worker,type,timeoutMs=12000){
  return new Promise(resolve=>{
    if(!worker)return resolve(null);
    const channel=new MessageChannel(),timer=setTimeout(()=>resolve(null),timeoutMs);
    channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data||null)};
    try{worker.postMessage({type},[channel.port2])}catch{clearTimeout(timer);resolve(null)}
  });
}
function streamWorker(worker,type,onPacket,idleTimeoutMs=30000){
  return new Promise((resolve,reject)=>{
    if(!worker)return reject(new Error('The local-package worker is unavailable.'));
    const channel=new MessageChannel();let timer=null;
    const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>reject(new Error('The local-campus download stopped responding. Tap Resume to continue.')),idleTimeoutMs)};arm();
    channel.port1.onmessage=event=>{arm();const packet=event.data||{};onPacket?.(packet);if(packet.type==='CIVWEAVE_OFFLINE_PACKAGE_STATUS'&&!packet.running){clearTimeout(timer);resolve(packet)}};
    try{worker.postMessage({type},[channel.port2])}catch(error){clearTimeout(timer);reject(error)}
  });
}
async function waitForWorker(predicate,timeoutMs=ACTIVATION_TIMEOUT_MS){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    registration=await navigator.serviceWorker.getRegistration('/');
    const candidate=registration?.waiting||registration?.installing;
    if(registration?.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
    if(candidate?.state==='installed')candidate.postMessage({type:'SKIP_WAITING'});
    if(registration?.active?.state==='activated'&&predicate(registration.active)){activeWorker=registration.active;return activeWorker}
    if(candidate?.state==='redundant')throw new Error('The browser rejected the app worker.');
    await pause(160);
  }
  throw new Error('App worker activation timed out.');
}
async function registerWorker(url,predicate,label){
  if(!('serviceWorker'in navigator))throw new Error('This browser does not support service workers.');
  registration=await withTimeout(navigator.serviceWorker.register(url,{scope:'/',updateViaCache:'none'}),REGISTRATION_TIMEOUT_MS,`${label} registration timed out.`);
  return waitForWorker(predicate);
}
async function confirmShell(worker=activeWorker){
  const status=await askWorker(worker,'GET_DEVICE_PACKAGE_STATUS');
  if(!status||status.type!=='CIVWEAVE_DEVICE_PACKAGE'||!status.ready)throw new Error(`${status?.missing?.length||'Some'} required shell files are missing.`);
  shellReady=true;shellError=null;showShell(status);guidance();return status;
}
async function prepareShell(options={}){
  if(preparing)return;
  preparing=true;shellReady=false;shellError=null;showShell({});guidance();showOffline();
  const update=$('#check-update');if(update){update.disabled=true;update.textContent=options.manual?'Checking release…':'Preparing shell…'}
  try{
    const existing=await navigator.serviceWorker.getRegistration('/');
    let worker=existing?.active&&isFullWorker(existing.active)?existing.active:existing?.active&&isBootstrapWorker(existing.active)?existing.active:null;
    if(!worker){help('Registering the tiny Civweave bootstrap shell…');worker=await registerWorker(BOOTSTRAP_URL,isBootstrapWorker,'Bootstrap shell')}
    activeWorker=worker;await confirmShell(worker);
    if(isFullWorker(worker))await refreshOfflineStatus();
    if(options.manual)help(offlineStatus?.ready?'Local Civweave package is current on this device.':'Shell checked. Complete or resume the required local campus package before installation.');
  }catch(error){shellError=error instanceof Error?error:new Error(String(error));showShell({});help(`App-shell preparation failed: ${shellError.message}`)}
  finally{preparing=false;if(update){update.disabled=false;update.textContent='Check release'}guidance();showOffline()}
}
async function ensureFullWorker(){
  const existing=await navigator.serviceWorker.getRegistration('/');
  if(existing?.active&&isFullWorker(existing.active)){activeWorker=existing.active;return activeWorker}
  help('Preparing the local campus package worker…');
  return registerWorker(FULL_WORKER_URL,isFullWorker,'Local campus package worker');
}
async function refreshOfflineStatus(){
  if(!activeWorker)return null;
  const status=await askWorker(activeWorker,'GET_OFFLINE_PACKAGE_STATUS');
  if(status?.type==='CIVWEAVE_OFFLINE_PACKAGE_STATUS')showOffline(status);
  return status;
}
async function offlineStoragePreflight(){
  try{
    const [response,estimate]=await Promise.all([fetch(`${OFFLINE_MANIFEST_URL}?preflight=${Date.now()}`,{cache:'no-store',headers:{'x-civweave-package':'campus-preflight'}}),navigator.storage?.estimate?.().catch?.(()=>null)||null]);
    if(!response?.ok||!estimate?.quota)return true;
    const manifest=await response.json(),required=Number(manifest?.preflight?.requiredFreeBytes||0),available=Math.max(0,Number(estimate.quota||0)-Number(estimate.usage||0));
    if(required&&available<required){help(`Local campus not started: about ${formatBytes(required-available)} more browser storage is needed.`);return false}
  }catch{}
  return true;
}
async function downloadOfflineCampus(){
  if(offlineBusy||preparing)return offlineStatus;
  offlineBusy=true;showOffline({...(offlineStatus||{}),running:true});guidance();
  let result=offlineStatus;
  try{
    if(!(await offlineStoragePreflight()))return offlineStatus;
    const worker=await ensureFullWorker();activeWorker=worker;
    const current=await refreshOfflineStatus();
    if(current?.ready){result=current;help('The required local campus is already stored on this device.');return result}
    help('Downloading the required code-first local campus. Large visuals, media, knowledge packs, and AI models remain optional.');
    result=await streamWorker(worker,'DOWNLOAD_OFFLINE_PACKAGE',packet=>{if(packet.type==='CIVWEAVE_OFFLINE_PACKAGE_PROGRESS'||packet.type==='CIVWEAVE_OFFLINE_PACKAGE_STATUS')showOffline(packet)});
    showOffline(result);
    if(result?.ready)help(`Local campus ready: ${result.completed}/${result.total} files${result.bytes?` · ${formatBytes(result.bytes)}`:''}. Civweave can now run without its release origin.`);
    else if(result?.paused)help('Local campus paused. Everything already saved remains on the device; resume before installing Civweave.');
    else help(`Local campus stopped with ${result?.failedCount||result?.failed?.length||0} files needing retry. Installation will wait rather than fall back to an online runtime.`);
  }catch(error){help(`${error.message} Files already saved are preserved; Civweave will not substitute an online runtime.`);await refreshOfflineStatus().catch(()=>null);result=offlineStatus}
  finally{offlineBusy=false;showOffline();guidance()}
  return result;
}
async function resetAppShell(){
  help('Removing only Civweave app-shell caches. Saved models, knowledge packs, updates, and local-campus data are preserved.');
  try{
    const regs=await navigator.serviceWorker.getRegistrations();await Promise.allSettled(regs.filter(reg=>{try{return new URL(reg.scope).pathname==='/'}catch{return false}}).map(reg=>reg.unregister()));
    const names=await caches.keys();await Promise.allSettled(names.filter(name=>!PROTECTED_CACHE_PREFIXES.some(prefix=>name.startsWith(prefix))&&(name.startsWith('civweave-install-')||name.startsWith('civweave-shell-')||name.startsWith('civweave-runtime-'))).map(name=>caches.delete(name)));
  }finally{location.reload()}
}
async function ensureLocalPackage(){
  if(!shellReady){await prepareShell({manual:false});if(!shellReady)return false}
  if(offlineStatus?.ready)return true;
  const campus=await downloadOfflineCampus();
  return Boolean(campus?.ready||offlineStatus?.ready);
}
async function installOrOpen(){
  if(shellError)return resetAppShell();
  if(!(await ensureLocalPackage())){help('Civweave installation is waiting for the required local campus package to finish.');return}
  if(standalone()){location.assign(ENTRY);return}
  if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();const choice=await prompt.userChoice.catch(()=>null);if(choice?.outcome==='accepted'){help('Civweave installed with its local campus. Models, media, and knowledge packs remain optional.');const button=$('#install-app');if(button){button.disabled=true;button.textContent='Civweave installed'}}else guidance();return}
  help(isIOS()?'The local package is ready. In Safari, tap Share, then Add to Home Screen.':'The local package is ready. Open the browser menu and choose Install app or Add to Home screen.');
}

addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;guidance()});
addEventListener('appinstalled',()=>{installPrompt=null;help('Civweave is installed with its local campus. Models, media, and knowledge packs remain separate optional downloads.')});
$('#install-app')?.addEventListener('click',installOrOpen);
$('#check-update')?.addEventListener('click',()=>prepareShell({manual:true}));
$('#download-offline-package')?.addEventListener('click',downloadOfflineCampus);
showShell({});showOffline({});guidance();

globalThis.CivweaveInstallerV130=Object.freeze({version:VERSION,prepareShell,resetAppShell,downloadOfflineCampus,ensureLocalPackage,get shellReady(){return shellReady},get localCampusReady(){return Boolean(offlineStatus?.ready)}});
})();
