(()=>{
'use strict';
const VERSION='1.0.31';
const BUILD='1.0.31-device-package-r23';
let registration=null;
let reloading=false;
function pill(){
  let node=document.querySelector('#cw-pwa-state');
  if(node)return node;
  node=document.createElement('button');node.id='cw-pwa-state';node.type='button';node.className='cw-pwa-state';node.textContent=navigator.onLine?'Device package · updates are manual':'Device package · offline';
  node.addEventListener('click',async()=>{
    if(globalThis.CommonweaveHubRuntimeV143?.openUpdateHub){globalThis.CommonweaveHubRuntimeV143.openUpdateHub();return}
    if(registration?.waiting){registration.waiting.postMessage({type:'SKIP_WAITING'});node.textContent='Applying update…'}
  });
  document.body.append(node);return node;
}
function updateState(){
  const node=pill();
  if(registration?.waiting){node.textContent='Update downloaded · open Hub & updates';node.classList.add('is-update');return}
  node.classList.remove('is-update');
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  node.textContent=navigator.onLine?(standalone?'Installed device package · manual updates':'Local installer · install on this device'):'Offline · device package active';
}
async function retireLegacyWorkers(){
  const regs=await navigator.serviceWorker.getRegistrations();
  const legacy=regs.filter(reg=>{
    const scope=new URL(reg.scope).pathname;
    const script=reg.active?.scriptURL||reg.waiting?.scriptURL||reg.installing?.scriptURL||'';
    return scope.startsWith('/app/')||scope.startsWith('/campus/')||/\/services\//.test(scope)||/service-worker-v12[67]\.js|\/app\/service-worker\.js/.test(script);
  });
  await Promise.allSettled(legacy.map(reg=>reg.unregister()));
}
async function boot(){
  const embedded=new URLSearchParams(location.search).get('embed')==='1';
  if(embedded){document.documentElement.dataset.commonweaveMode='embedded';return}
  document.documentElement.dataset.commonweaveMode=(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)?'installed':'browser';
  document.documentElement.dataset.commonweaveVersion=VERSION;
  document.documentElement.dataset.commonweaveBuild=BUILD;
  if(!('serviceWorker'in navigator)){pill().textContent='Offline install unsupported in this browser';return}
  try{
    await retireLegacyWorkers();
    registration=await navigator.serviceWorker.getRegistration('/')||await navigator.serviceWorker.register(`/service-worker.js?v=${VERSION}`,{scope:'/',updateViaCache:'none'});
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)updateState()});
    });
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});
    updateState();
  }catch{pill().textContent=navigator.onLine?'Device package install unavailable':'Offline · cached package unavailable'}
}
addEventListener('online',updateState);addEventListener('offline',updateState);
boot();
})();