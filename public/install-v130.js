(()=>{
'use strict';

const VERSION='1.0.160';
const ENTRY='/app/installed-entry-v146.html?installed=1&system=civweave';
const BOOTSTRAP_BUILD='installer-bootstrap-v1';
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
  if(mode)mode.textContent='bootstrap shell · optional campus · media and models on demand';
}
function showOffline(status=offlineStatus||{}){
  offlineStatus=status;
  const state=$('#offline-package-state'),assets=$('#offline-package-assets'),button=$('#download-offline-package');
  const failed=Number(status.failedCount||status.failed?.length||0),complete=Number(status.downloaded??status.completed??0),total=Number(status.total||status.discovered||0),size=formatBytes(status.bytes);
  if(state){if(status.running||offlineBusy)state.textContent='downloading';else if(status.ready)state.textContent='ready offline';else if(status.paused)state.textContent='paused';else if(failed)state.textContent=`${failed} file${failed===1?'':'s'} need retry`;else state.textContent=complete?'partially downloaded':'not downloaded'}
  if(assets){const count=total?`${Math.min(complete,total)}/${total} files`:'not started';assets.textContent=size?`${count} · ${size}`:count}
  if(button){button.disabled=offlineBusy||preparing;if(offlineBusy||status.running)button.textContent=total?`Downloading ${Math.min(complete,total)}/${total}…`:'Preparing offline campus…';else if(status.ready)button.textContent='Refresh offline campus';else if(status.paused||complete)button.textContent='Resume offline campus';else if(failed)button.textContent=`Retry ${failed} missing file${failed===1?'':'s'}`;else button.textContent='Download offline campus'}
}
function guidance(){
  const button=$('#install-app');if(!button)return;
  if(standalone()){button.disabled=false;button.textContent=`Open Civweave v${VERSION}`;help('Civweave is installed. The campus, knowledge packs, media, and local models remain separate downloads.');return}
  if(shellError){button.disabled=false;button.textContent='Reset app shell and retry';help(`The small app shell failed: ${shellError.message}. Saved campus, knowledge, and model data will be preserved.`);return}
  if(preparing){button.disabled=true;button.textContent='Downloading app shell…';help('Downloading the 11-file bootstrap shell. No campus, media, knowledge pack, or AI model is included.');return}
  button.disabled=false;button.textContent=`Install Civweave v${VERSION}`;
  if(shellReady)help(installPrompt?'The bootstrap shell is ready. Install Civweave now.':'The bootstrap shell is ready. Use Install app or Add to Home screen if your browser does not show the prompt.');
  else help('Ready when you are. Nothing large downloads until you ask for it.');
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
    if(!worker)return reject(new Error('The offline worker is unavailable.'));
    const channel=new MessageChannel();let timer=null;
    const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>reject(new Error('The offline-campus download stopped responding. Tap Resume to continue.')),idleTimeoutMs)};arm();
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
  if(!status||status.type!=='CIVWEAVE_DEVICE_PACKAGE'||!status.ready)throw new Error(`${status?.missing?.length||'Some'} required bootstrap files are missing.`);
  shellReady=true;shellError=null;showShell(status);guidance();return status;
}
async function prepareShell(options={}){
  if(preparing)return;
  preparing=true;shellReady=false;shellError=null;showShell({});guidance();showOffline();
  const update=$('#check-update');if(update){update.disabled=true;update.textContent=options.manual?'Checking release…':'Preparing shell…'}
  try{
    const existing=await navigator.serviceWorker.getRegistration('/');
    let worker=existing?.active&&isBootstrapWorker(existing.active)?existing.active:null;
    if(!worker||options.manual){help('Registering the tiny Civweave bootstrap shell…');worker=await registerWorker(BOOTSTRAP_URL,isBootstrapWorker,'Bootstrap shell')}
    activeWorker=worker;await confirmShell(worker);
    if(options.manual)help('Bootstrap shell ready. Heavy campus and model downloads remain separate.');
  }catch(error){shellError=error instanceof Error?error:new Error(String(error));showShell({});help(`App-shell preparation failed: ${shellError.message}`)}
  finally{preparing=false;if(update){update.disabled=false;update.textContent='Check release'}guidance();showOffline()}
}
async function ensureFullWorker(){
  const existing=await navigator.serviceWorker.getRegistration('/');
  if(existing?.active&&isFullWorker(existing.active)){activeWorker=existing.active;return activeWorker}
  help('You requested the offline campus. Loading the full offline package worker now…');
  return registerWorker(FULL_WORKER_URL,isFullWorker,'Offline package worker');
}
async function refreshOfflineStatus(){
  if(!activeWorker)return null;
  const status=await askWorker(activeWorker,'GET_OFFLINE_PACKAGE_STATUS');
  if(status?.type==='CIVWEAVE_OFFLINE_PACKAGE_STATUS')showOffline(status);
  return status;
}
async function offlineStoragePreflight(){
  try{
    const [response,estimate]=await Promise.all([fetch(`${OFFLINE_MANIFEST_URL}?preflight=${Date.now()}`,{cache:'no-store'}),navigator.storage?.estimate?.().catch?.(()=>null)||null]);
    if(!response?.ok||!estimate?.quota)return true;
    const manifest=await response.json(),required=Number(manifest?.preflight?.requiredFreeBytes||0),available=Math.max(0,Number(estimate.quota||0)-Number(estimate.usage||0));
    if(required&&available<required){help(`Offline campus not started: about ${formatBytes(required-available)} more browser storage is needed. Civweave itself can still be installed.`);return false}
  }catch{}
  return true;
}
async function downloadOfflineCampus(){
  if(offlineBusy||preparing)return;
  offlineBusy=true;showOffline({...(offlineStatus||{}),running:true});
  try{
    if(!(await offlineStoragePreflight()))return;
    const worker=await ensureFullWorker();activeWorker=worker;
    await refreshOfflineStatus();
    help('Downloading the optional code-first campus. Large visuals, media, knowledge packs, and AI models remain outside this package.');
    const status=await streamWorker(worker,'DOWNLOAD_OFFLINE_PACKAGE',packet=>{if(packet.type==='CIVWEAVE_OFFLINE_PACKAGE_PROGRESS'||packet.type==='CIVWEAVE_OFFLINE_PACKAGE_STATUS')showOffline(packet)});
    showOffline(status);
    if(status.ready)help(`Offline campus ready: ${status.completed}/${status.total} files${status.bytes?` · ${formatBytes(status.bytes)}`:''}.`);
    else if(status.paused)help('Offline campus paused. Everything already saved remains on the device.');
    else help(`Offline campus stopped with ${status.failedCount||status.failed?.length||0} files needing retry. The app install is unaffected.`);
  }catch(error){help(`${error.message} The bootstrap app install and files already saved are unaffected.`);await refreshOfflineStatus().catch(()=>null)}
  finally{offlineBusy=false;showOffline()}
}
async function resetAppShell(){
  help('Removing only Civweave app-shell caches. Saved models, knowledge packs, updates, and offline-campus data are preserved.');
  try{
    const regs=await navigator.serviceWorker.getRegistrations();await Promise.allSettled(regs.filter(reg=>{try{return new URL(reg.scope).pathname==='/'}catch{return false}}).map(reg=>reg.unregister()));
    const names=await caches.keys();await Promise.allSettled(names.filter(name=>!PROTECTED_CACHE_PREFIXES.some(prefix=>name.startsWith(prefix))&&(name.startsWith('civweave-install-')||name.startsWith('civweave-shell-')||name.startsWith('civweave-runtime-'))).map(name=>caches.delete(name)));
  }finally{location.reload()}
}
async function installOrOpen(){
  if(shellError)return resetAppShell();
  if(standalone()){location.assign(ENTRY);return}
  if(!shellReady){await prepareShell({manual:false});if(!shellReady)return}
  if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();const choice=await prompt.userChoice.catch(()=>null);if(choice?.outcome==='accepted'){help('Civweave installed. Open it from your device launcher. Everything heavier remains opt-in.');const button=$('#install-app');if(button){button.disabled=true;button.textContent='Civweave installed'}}else guidance();return}
  help(isIOS()?'In Safari, tap Share, then Add to Home Screen.':'Open the browser menu and choose Install app or Add to Home screen.');
}

addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;guidance()});
addEventListener('appinstalled',()=>{installPrompt=null;help('Civweave is installed. Open it from your device launcher; optional downloads remain separate.')});
$('#install-app')?.addEventListener('click',installOrOpen);
$('#check-update')?.addEventListener('click',()=>prepareShell({manual:true}));
$('#download-offline-package')?.addEventListener('click',downloadOfflineCampus);
showShell({});showOffline({});guidance();

globalThis.CivweaveInstallerV130=Object.freeze({version:VERSION,prepareShell,resetAppShell,downloadOfflineCampus,get shellReady(){return shellReady}});
})();
