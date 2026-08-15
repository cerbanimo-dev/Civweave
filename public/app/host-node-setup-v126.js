(()=>{
'use strict';
const VERSION='1.0.26';
const BUILD='1.0.26-loop-diagnostics-hotfix-2';
const log=(kind,detail={})=>window.CivweaveBootLog?.log(kind,detail)||console.info('[CW-BOOT]',kind,detail);
const load=src=>new Promise((resolve,reject)=>{const wanted=new URL(src,location.href).pathname;const existing=[...document.scripts].find(script=>{try{return new URL(script.src||location.href,location.href).pathname===wanted}catch{return false}});if(existing&&window.CivweaveBootLog)return resolve();const script=existing||document.createElement('script');if(!existing){script.src=src;script.async=false;document.head.append(script)}script.addEventListener('load',()=>{log('script-loaded',{src:wanted});resolve()},{once:true});script.addEventListener('error',()=>reject(new Error(`Could not load ${src}`)),{once:true})});
async function retireLegacyWorkers(){
  const marker='civweave.scope-migration.v126';
  if(localStorage.getItem(marker)===BUILD){log('legacy-retirement-already-complete');return}
  try{
    const registrations=await navigator.serviceWorker?.getRegistrations?.()||[];
    const legacy=registrations.filter(reg=>{const path=new URL(reg.scope).pathname;return path.startsWith('/app/')||/\/services\/(living-school|cerbanimo|fellowfare|anarchadia)\//.test(path)});
    log('legacy-workers-found',{registrations:registrations.map(reg=>reg.scope),legacy:legacy.map(reg=>reg.scope)});
    await Promise.allSettled(legacy.map(async reg=>{const result=await reg.unregister();log('legacy-worker-unregistered',{scope:reg.scope,result})}));
    const keys=await caches.keys();
    const stale=keys.filter(key=>key.startsWith('civweave-pocket-campus-')||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key));
    await Promise.allSettled(stale.map(async key=>{const result=await caches.delete(key);log('legacy-cache-deleted',{key,result})}));
    localStorage.setItem(marker,BUILD);
  }catch(error){log('legacy-retirement-failed',{message:error.message})}
}
async function installWorker(){
  if(!('serviceWorker'in navigator)){log('worker-unsupported');return null}
  try{
    const registration=await navigator.serviceWorker.register(`service-worker-v126.js?v=${VERSION}&hotfix=2`,{scope:'./',updateViaCache:'none'});
    log('worker-registered',{scope:registration.scope,active:registration.active?.scriptURL||null,waiting:registration.waiting?.scriptURL||null,installing:registration.installing?.scriptURL||null});
    if(registration.waiting)log('worker-waiting-no-auto-reload',{scriptURL:registration.waiting.scriptURL});
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;log('worker-updatefound',{scriptURL:worker?.scriptURL||null,state:worker?.state||null});worker?.addEventListener('statechange',()=>log('worker-statechange',{scriptURL:worker.scriptURL,state:worker.state}))});
    return registration;
  }catch(error){log('worker-registration-failed',{message:error.message});return null}
}
function exposeFallback(error){
  document.querySelector('#cw-visual-first-paint')?.remove();
  let node=document.querySelector('.cw-boot-recovery');
  if(!node){node=document.createElement('aside');node.className='cw-boot-recovery';node.innerHTML='<strong>Civweave could not finish the visual boot.</strong><span></span><button data-log>Open boot log</button><a href="/recover.html">Run scope recovery</a>';document.body.append(node);const style=document.createElement('style');style.textContent='.cw-boot-recovery{position:fixed;z-index:9999;left:12px;right:12px;bottom:56px;display:grid;gap:8px;padding:15px;border:1px solid #7ee5ff77;border-radius:16px;background:#061923f7;color:#effffb;box-shadow:0 18px 50px #000b}.cw-boot-recovery span{color:#c8dcda}.cw-boot-recovery a,.cw-boot-recovery button{min-height:42px;display:grid;place-items:center;border:1px solid #efd17677;border-radius:10px;background:#174b58;color:white;text-decoration:none}';document.head.append(style);node.querySelector('[data-log]').onclick=()=>document.querySelector('.cw-boot-log-button')?.click()}
  node.querySelector('span').textContent=error?.message||String(error||'Unknown boot error');log('visual-boot-fallback',{message:error?.message||String(error)})
}
(async()=>{
  try{if(!window.CivweaveBootLog)await load(`boot-diagnostics-v126.js?v=${VERSION}&hotfix=2`)}catch(error){console.warn('Boot diagnostics could not preload',error)}
  log('v126-bootstrap-start',{href:location.href,controller:navigator.serviceWorker?.controller?.scriptURL||null,build:BUILD});
  localStorage.setItem('civweave.host-build',BUILD);
  await retireLegacyWorkers();
  await installWorker();
  try{await load(`host-node-v126-safe.js?v=${VERSION}&hotfix=2`);log('v126-runtime-ready',{universalAI:Boolean(window.CivweaveUniversalAI),build:BUILD})}catch(error){console.error('Civweave v1.0.26 shell failed to load',error);exposeFallback(error)}
})();
setTimeout(()=>{if(!window.CivweaveUniversalAI&&!document.querySelector('.cw-v125-home-nav'))exposeFallback(new Error('The visual Guild timed out before its controls became available.'))},9000);
})();
