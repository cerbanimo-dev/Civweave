(()=>{
'use strict';
const VERSION='1.0.30';
const BUILD='1.0.30-offline-mesh-cabinet-runtime';
let registration=null;
let reloading=false;
const report=(kind,detail={})=>fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'commonweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:BUILD,kind:`pwa:${kind}`,detail}),keepalive:true,cache:'no-store'}).catch(()=>{});
function pill(){
  let node=document.querySelector('#cw-pwa-state');
  if(node)return node;
  node=document.createElement('button');node.id='cw-pwa-state';node.type='button';node.className='cw-pwa-state';node.textContent=navigator.onLine?'Local app · online bridge':'Local app · offline';
  node.addEventListener('click',async()=>{
    if(registration?.waiting){registration.waiting.postMessage({type:'SKIP_WAITING'});node.textContent='Applying update…';return}
    try{await registration?.update();node.textContent='Checked for updates'}catch{node.textContent='Offline · using local copy'}
    setTimeout(updateState,1800);
  });
  document.body.append(node);return node;
}
function updateState(){
  const node=pill();
  if(registration?.waiting){node.textContent='Update ready · tap to apply';node.classList.add('is-update');return}
  node.classList.remove('is-update');
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  node.textContent=navigator.onLine?(standalone?'Installed local app · hub available':'Browser preview · install from gateway'):'Offline · local campus active';
}
async function retireLegacyWorkers(){
  const regs=await navigator.serviceWorker.getRegistrations();
  const legacy=regs.filter(reg=>{
    const scope=new URL(reg.scope).pathname;
    const script=reg.active?.scriptURL||reg.waiting?.scriptURL||reg.installing?.scriptURL||'';
    return scope.startsWith('/app/')||scope.startsWith('/campus/')||/\/services\//.test(scope)||/service-worker-v12[67]\.js|\/app\/service-worker\.js/.test(script);
  });
  await Promise.allSettled(legacy.map(reg=>reg.unregister()));
  if(legacy.length)report('legacy-workers-retired',{scopes:legacy.map(reg=>reg.scope)});
}
async function boot(){
  const embedded=new URLSearchParams(location.search).get('embed')==='1';
  if(embedded){document.documentElement.dataset.commonweaveMode='embedded';return}
  document.documentElement.dataset.commonweaveMode=(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)?'installed':'browser';
  if(!('serviceWorker'in navigator)){pill().textContent='Offline install unsupported in this browser';return}
  try{
    await retireLegacyWorkers();
    registration=await navigator.serviceWorker.register(`/service-worker.js?v=${VERSION}`,{scope:'/',updateViaCache:'none'});
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){updateState();report('update-ready',{script:worker.scriptURL})}});
    });
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});
    await registration.update().catch(()=>{});
    updateState();
    report('ready',{scope:registration.scope,controller:navigator.serviceWorker.controller?.scriptURL||null,standalone:document.documentElement.dataset.commonweaveMode==='installed'});
  }catch(error){pill().textContent=navigator.onLine?'Local install unavailable':'Offline · cached shell unavailable';report('registration-failed',{message:error.message})}
}
addEventListener('online',updateState);addEventListener('offline',updateState);
boot();
})();