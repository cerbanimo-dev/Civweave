(()=>{
'use strict';
const VERSION='1.0.6';
const ENTRY='/app/installed-entry-v146.html?system=commonweave';
const WORKER_REVISION='flat-living-school-v203';
const ADDITIONS_REVISION='working-campus-additions-v197-assistant-runtime-package';
const PREVIOUS_ADDITIONS_REVISION='working-campus-additions-v196-living-school-reader-loop';
const EARLIER_ADDITIONS_REVISION='working-campus-additions-v195-living-school-boot';
const CRITICAL_BOOT_REVISION='living-school-flat-core-v203';
const IMAGE_REVISION='shared-image-delivery-v203';
const UPDATE_REVISION='visible-update-library-preservation-v207-registration-watchdog';
const PREVIOUS_PACKAGE_LABEL='Living School lesson and navigation repair';
const EARLIER_PACKAGE_LABEL='complete critical package repair';
const WORKER_BUILD=`${VERSION}-${WORKER_REVISION}-${ADDITIONS_REVISION}-${UPDATE_REVISION}`;
const WORKER_URL=`/service-worker-v203.js?v=${WORKER_BUILD}`;
const PREPARE_TIMEOUT_MS=180000;
const REGISTRATION_TIMEOUT_MS=15000;
const UPDATE_TIMEOUT_MS=15000;
const REGISTRATION_QUERY_TIMEOUT_MS=6000;
const AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r52';
const PREVIOUS_AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r51';
const EARLIER_AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r48';
const WATCHDOG_RECOVERY_KEY='commonweave.device-package.registration-watchdog.v107-r1';
const LEGACY_LIBRARY_CACHE='commonweave-knowledge-schools-v1';
const LIBRARY_CACHE='cwknowledge-school-seeds-v2';
const PROTECTED_CACHE_PREFIXES=['cwknowledge-','cwupdate-'];
let installPrompt=null;
let registration=null;
let packageReady=false;
let packageStatus=null;
let packageError=null;
let preparing=false;
let activeWorker=null;
let recovering=false;
const $=selector=>document.querySelector(selector);
const help=message=>{const node=$('#install-help');if(node)node.textContent=message};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function withTimeout(promise,timeoutMs,message,phase='operation'){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{
      if(settled)return;
      settled=true;
      const error=new Error(message);
      error.name='CommonweavePackageTimeoutError';
      error.code='COMMONWEAVE_PACKAGE_TIMEOUT';
      error.phase=phase;
      reject(error);
    },timeoutMs);
    Promise.resolve(promise).then(value=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      resolve(value);
    },error=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      reject(error);
    });
  });
}
function standalone(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function isIOS(){return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())}
function rootScope(reg){try{const scope=new URL(reg.scope);return scope.origin===location.origin&&scope.pathname==='/'}catch{return false}}
function workerMatches(worker){try{const url=new URL(worker?.scriptURL||'');return url.pathname==='/service-worker-v203.js'&&url.searchParams.get('v')===WORKER_BUILD}catch{return false}}
function showPackage(status={}){
  packageStatus=status;
  $('#package-state').textContent=packageReady?'complete':packageError?'failed':'preparing';
  const missing=Array.isArray(status.missing)?status.missing.length:0;
  const total=Number(status.assetCount||0)+Number(status.additions?.assetCount||0)+Number(status.critical?.total||0)+Number(status.images?.total||0);
  $('#package-assets').textContent=packageReady&&total?`${total} packaged files`:missing?`${missing} missing files`:total?`${total} packaged files`:'checking package';
  $('#local-mode').textContent='v1.0.6 · local package · preserved knowledge library';
}
function guidance(){
  const button=$('#install-app');
  if(!button)return;
  if(standalone()){
    button.disabled=false;
    button.textContent='Open Commonweave v1.0.6';
    help(packageReady?'Commonweave is installed. Use Check release here or the new Check updates control inside the app.':'Checking the installed Commonweave package…');
    return;
  }
  if(packageError){
    button.disabled=false;
    button.textContent='Reset app package and retry';
    help(`Package preparation failed: ${packageError.message}. Your saved knowledge-school cache will be preserved.`);
    return;
  }
  if(preparing||!packageReady){
    button.disabled=true;
    button.textContent='Preparing Commonweave…';
    help('Preparing the app package. The optional knowledge library runs separately and will not be erased by updates.');
    return;
  }
  button.disabled=false;
  button.textContent='Install Commonweave v1.0.6';
  if(installPrompt)help('The Commonweave app package is ready. Tap Install Commonweave.');
  else if(isIOS())help('The package is ready. Tap Install Commonweave for Safari Add to Home Screen instructions.');
  else help('The package is ready. Tap Install Commonweave, then choose Install app or Add to Home screen in your browser.');
}
function failPackage(error){
  packageReady=false;
  packageError=error instanceof Error?error:new Error(String(error||'Unknown package error'));
  showPackage({...packageStatus,error:packageError.message});
  guidance();
}
function protectedCache(name){return name===LEGACY_LIBRARY_CACHE||name===LIBRARY_CACHE||PROTECTED_CACHE_PREFIXES.some(prefix=>name.startsWith(prefix))}
async function migrateKnowledgeCache(){
  if(!('caches'in window))return 0;
  const names=await caches.keys();
  if(!names.includes(LEGACY_LIBRARY_CACHE))return 0;
  const legacy=await caches.open(LEGACY_LIBRARY_CACHE);
  const target=await caches.open(LIBRARY_CACHE);
  const requests=await legacy.keys();
  let copied=0;
  for(const request of requests){
    if(await target.match(request))continue;
    const response=await legacy.match(request);
    if(response){await target.put(request,response.clone());copied+=1}
  }
  if(requests.length)await caches.delete(LEGACY_LIBRARY_CACHE);
  return copied;
}
async function clearPackageCaches(){
  if(!('caches'in window))return;
  await migrateKnowledgeCache();
  const keys=await caches.keys();
  await Promise.allSettled(keys.filter(key=>!protectedCache(key)&&(key.startsWith('commonweave-')||key.startsWith('cwext-')||key.startsWith('cwboot-')||key.startsWith('cwimg-'))).map(key=>caches.delete(key)));
}
async function resetDevicePackage(){
  recovering=true;
  help('Removing the incomplete app package while preserving your saved knowledge library…');
  sessionStorage.removeItem(WATCHDOG_RECOVERY_KEY);
  sessionStorage.removeItem(AUTO_RESET_KEY);
  await migrateKnowledgeCache();
  if('serviceWorker'in navigator){
    const regs=await withTimeout(navigator.serviceWorker.getRegistrations(),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not return the registered app packages.','registration lookup').catch(()=>[]);
    await Promise.allSettled(regs.filter(rootScope).map(reg=>withTimeout(reg.unregister(),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not release the old app package.','registration cleanup')));
  }
  await clearPackageCaches();
  registration=null;
  activeWorker=null;
  await pause(350);
  const next=new URL(location.href);
  next.searchParams.set('package-reset',Date.now().toString(36));
  location.replace(next.href);
}
async function recoverStalledRegistration(error){
  const phase=error?.phase||'service-worker registration';
  if(sessionStorage.getItem(WATCHDOG_RECOVERY_KEY)==='1'){
    throw new Error((error?.message||'Chrome stalled while preparing the app package.')+' Automatic recovery already ran once. Use Reset app package and retry.');
  }
  sessionStorage.setItem(WATCHDOG_RECOVERY_KEY,'1');
  recovering=true;
  help('Chrome stalled during '+phase+'. Preserving your knowledge library and rebuilding the app registration once…');
  await migrateKnowledgeCache();
  const regs=await withTimeout(navigator.serviceWorker.getRegistrations(),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not return registrations during recovery.','registration recovery lookup').catch(()=>[]);
  await Promise.allSettled(regs.filter(rootScope).map(reg=>withTimeout(reg.unregister(),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not release a stale registration.','registration recovery cleanup')));
  await clearPackageCaches();
  registration=null;
  activeWorker=null;
  await pause(300);
  const next=new URL(location.href);
  next.searchParams.set('registration-recovery',Date.now().toString(36));
  location.replace(next.href);
  const navigation=new Error('Reloading after stalled '+phase+'.');
  navigation.code='COMMONWEAVE_RECOVERY_RELOAD';
  navigation.phase=phase;
  throw navigation;
}
function askWorker(worker,type,timeoutMs=18000){
  return new Promise(resolve=>{
    if(!worker)return resolve(null);
    const channel=new MessageChannel();
    const timer=setTimeout(()=>resolve(null),timeoutMs);
    channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data||null)};
    worker.postMessage({type},[channel.port2]);
  });
}
async function waitForCurrentWorker(timeoutMs=PREPARE_TIMEOUT_MS){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    registration=await withTimeout(navigator.serviceWorker.getRegistration('/'),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not return the current service-worker registration.','registration lookup');
    const candidate=registration?.waiting||registration?.installing;
    if(registration?.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
    if(candidate?.state==='installed')candidate.postMessage({type:'SKIP_WAITING'});
    if(registration?.active?.state==='activated'&&workerMatches(registration.active)){
      activeWorker=registration.active;
      return activeWorker;
    }
    const state=candidate?.state||registration?.active?.state||'registering';
    help('Preparing Commonweave · '+state+'…');
    if(candidate?.state==='redundant')throw new Error('The browser rejected the updated app package.');
    await pause(180);
  }
  const error=new Error('Package preparation timed out.');
  error.code='COMMONWEAVE_PACKAGE_TIMEOUT';
  error.phase='worker activation';
  throw error;
}
async function confirmReady(worker=activeWorker){
  const images=await askWorker(worker,'GET_SHARED_IMAGE_STATUS');
  if(!images||images.type!=='COMMONWEAVE_SHARED_IMAGE_STATUS')throw new Error('The shared image lane did not return readiness.');
  if(!images.ready)throw new Error(`${images.missing?.length||'Some'} required AI and family-button images are missing.`);
  const critical=await askWorker(worker,'GET_CRITICAL_BOOT_STATUS');
  if(!critical||critical.type!=='COMMONWEAVE_CRITICAL_BOOT_STATUS')throw new Error('The flat learning core did not return package readiness.');
  if(critical.mode!=='flat')throw new Error('The installed Living School core is not in flat mode.');
  if(!critical.ready){const full=critical.fullPackage||{};throw new Error(`Flat core incomplete: ${(critical.missing||[]).length} missing, core ${full.baseCount||0}/111, shared ${full.extensionCount||0}/53.`)}
  const status=await askWorker(worker,'GET_DEVICE_PACKAGE_STATUS');
  if(!status||status.type!=='COMMONWEAVE_DEVICE_PACKAGE')throw new Error('The device worker did not return core-package readiness.');
  if(!status.ready)throw new Error(`${(status.missing||[]).length||'Some'} required core-package files are missing.`);
  const additions=await askWorker(worker,'GET_ADDITIONS_STATUS');
  if(!additions||additions.type!=='COMMONWEAVE_ADDITIONS_STATUS')throw new Error('The shared-tools layer did not return package readiness.');
  if(!additions.ready)throw new Error(`${(additions.missing||[]).length||'Some'} shared-tool files are missing.`);
  packageReady=true;
  packageError=null;
  const combined={...status,baseWorkerRevision:WORKER_REVISION,additionsRevision:ADDITIONS_REVISION,previousAdditionsRevision:PREVIOUS_ADDITIONS_REVISION,earlierAdditionsRevision:EARLIER_ADDITIONS_REVISION,criticalBootRevision:CRITICAL_BOOT_REVISION,imageRevision:IMAGE_REVISION,updateRevision:UPDATE_REVISION,knowledgeCache:LIBRARY_CACHE,previousPackageLabel:PREVIOUS_PACKAGE_LABEL,earlierPackageLabel:EARLIER_PACKAGE_LABEL,previousAutoResetKey:PREVIOUS_AUTO_RESET_KEY,earlierAutoResetKey:EARLIER_AUTO_RESET_KEY,critical,images,additions,missing:[...(images.missing||[]),...(critical.missing||[]),...(status.missing||[]),...(additions.missing||[])]};
  showPackage(combined);
  guidance();
  return combined;
}
async function preparePackage(options={}){
  if(preparing)return;
  preparing=true;
  recovering=false;
  packageReady=false;
  packageError=null;
  showPackage({});
  guidance();
  const updateButton=$('#check-update');
  if(updateButton){updateButton.disabled=true;updateButton.textContent=options.manual?'Checking release…':'Checking package…'}
  try{
    if(!('serviceWorker'in navigator))throw new Error('This browser does not support service workers.');
    const migrated=await migrateKnowledgeCache();
    if(migrated)help('Preserved '+migrated+' staged knowledge-school file'+(migrated===1?'':'s')+' before updating the app package…');
    const existing=await withTimeout(navigator.serviceWorker.getRegistration('/'),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not return the existing app registration.','registration lookup');
    const exactActive=existing?.active?.state==='activated'&&workerMatches(existing.active);
    const exactCandidate=[existing?.waiting,existing?.installing].find(workerMatches);
    let worker=null;
    if(exactActive){
      registration=existing;
      activeWorker=existing.active;
      worker=activeWorker;
      help('Using the current Commonweave package registration…');
    }else{
      if(exactCandidate){
        registration=existing;
        if(existing.waiting||exactCandidate.state==='installed')exactCandidate.postMessage({type:'SKIP_WAITING'});
      }else{
        if(existing&&sessionStorage.getItem(AUTO_RESET_KEY)!=='1'){
          sessionStorage.setItem(AUTO_RESET_KEY,'1');
          await withTimeout(existing.unregister(),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not release the outdated app registration.','registration cleanup');
          await clearPackageCaches();
          await pause(250);
        }
        help('Registering the Commonweave app package…');
        registration=await withTimeout(
          navigator.serviceWorker.register(WORKER_URL,{scope:'/',updateViaCache:'none'}),
          REGISTRATION_TIMEOUT_MS,
          'Chrome did not finish registering the Commonweave app package.',
          'service-worker registration'
        );
        const returnedWorker=registration?.waiting||registration?.installing||registration?.active;
        if(!workerMatches(returnedWorker)){
          help('Refreshing the Commonweave worker package…');
          await withTimeout(
            registration.update(),
            UPDATE_TIMEOUT_MS,
            'Chrome did not finish checking the Commonweave worker package.',
            'service-worker update'
          );
        }
      }
      worker=await waitForCurrentWorker();
    }
    await withTimeout(
      navigator.serviceWorker.ready,
      REGISTRATION_TIMEOUT_MS,
      'Chrome did not finish activating the Commonweave app package.',
      'service-worker readiness'
    );
    await confirmReady(worker);
    sessionStorage.removeItem(WATCHDOG_RECOVERY_KEY);
    if(options.manual)help('Commonweave is updated and ready. Your saved knowledge library was preserved.');
  }catch(error){
    if(error?.code==='COMMONWEAVE_PACKAGE_TIMEOUT'){
      try{await recoverStalledRegistration(error)}catch(recoveryError){
        if(recoveryError?.code!=='COMMONWEAVE_RECOVERY_RELOAD')failPackage(recoveryError);
      }
    }else if(error?.code!=='COMMONWEAVE_RECOVERY_RELOAD')failPackage(error);
  }finally{
    preparing=false;
    if(updateButton){updateButton.disabled=false;updateButton.textContent='Check release'}
    if(!recovering)guidance();
  }
}
async function installOrOpen(){
  if(packageError)return resetDevicePackage();
  if(standalone()){location.assign(ENTRY);return}
  if(!packageReady){await preparePackage({manual:true});if(!packageReady)return}
  if(installPrompt){
    const prompt=installPrompt;
    installPrompt=null;
    await prompt.prompt();
    const choice=await prompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted')help('Commonweave installation accepted. Open it from the new app icon.');
    else guidance();
    return;
  }
  help(isIOS()?'In Safari, tap Share, then Add to Home Screen. Your saved knowledge library remains in browser storage.':'Open the browser menu and choose Install app or Add to Home screen. The package is ready and your saved knowledge library will survive app updates.');
}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;guidance()});
addEventListener('appinstalled',()=>{installPrompt=null;help('Commonweave is installed. Updates are now available from inside the app.')});
$('#install-app')?.addEventListener('click',installOrOpen);
$('#check-update')?.addEventListener('click',()=>preparePackage({manual:true}));
showPackage({});
guidance();
preparePackage();
})();
