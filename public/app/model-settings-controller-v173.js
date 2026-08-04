(()=>{
'use strict';
const VERSION='173.0-direct-settings-controller';
if(globalThis.CommonweaveModelSettingsControllerV173?.version===VERSION)return;
const STYLE='/app/model-settings-v133.css?v=direct-settings-v173';
const DEPENDENCIES=[
  ['/app/shared/commonweave-model-runtime.js?v=direct-settings-v173',()=>globalThis.CommonweaveModelRuntime],
  ['/app/minilm-model-settings-v138.js?v=direct-settings-v173',()=>globalThis.CommonweaveModelSettingsV133&&globalThis.CommonweaveModelSettingsV133!==facade]
];
const REFLEX_SCRIPT='/app/minilm-reflex-runtime-v138.js?v=direct-settings-v173-explicit';
let settingsPromise=null;
let openPromise=null;
let reflexPromise=null;
let reflexStatusProxy=null;
let facade=null;
function mark(state,message=''){
  document.documentElement.dataset.settingsOpenState=state;
  if(message)document.documentElement.dataset.settingsOpenMessage=String(message).slice(0,240);
  else delete document.documentElement.dataset.settingsOpenMessage;
}
function addStyle(){
  if(document.querySelector('link[data-cw173-settings-style]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=STYLE;
  link.dataset.cw173SettingsStyle='';
  document.head.append(link);
}
function waitForReady(ready,pathname,timeoutMs=8000){
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const tick=()=>{
      if(ready?.())return resolve(true);
      if(Date.now()-started>=timeoutMs)return reject(new Error(`${pathname} did not become ready`));
      setTimeout(tick,50);
    };
    tick();
  });
}
function loadScript(src,ready){
  if(ready?.())return Promise.resolve(true);
  const pathname=new URL(src,location.href).pathname;
  const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===pathname);
  if(existing)return waitForReady(ready,pathname);
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.dataset.cw173SettingsDependency='';
    const timeout=setTimeout(()=>finish(new Error(`${pathname} timed out`)),8000);
    function finish(error){
      clearTimeout(timeout);
      if(error){script.remove();reject(error)}
      else resolve(true);
    }
    script.onload=()=>ready?.()?finish():finish(new Error(`${pathname} loaded without its runtime`));
    script.onerror=()=>finish(new Error(`Could not load ${pathname}`));
    document.head.append(script);
  });
}
function modelPackageStatus(){
  return new Promise(resolve=>{
    const controller=navigator.serviceWorker?.controller;
    if(!controller){
      resolve({available:false,missing:[{url:'local model package status',status:'unavailable',length:0}],files:[],graphs:[],source:'no-service-worker-controller',dormant:true});
      return;
    }
    const channel=new MessageChannel();
    let settled=false;
    const finish=value=>{
      if(settled)return;
      settled=true;
      clearTimeout(timeout);
      channel.port1.close?.();
      channel.port2.close?.();
      resolve(value);
    };
    const timeout=setTimeout(()=>finish({available:false,missing:[{url:'local model package status',status:'timeout',length:0}],files:[],graphs:[],source:'service-worker-timeout',dormant:true}),1200);
    channel.port1.onmessage=event=>{
      const packet=event.data||{};
      const missing=(packet.missing||[]).map(url=>({url,status:'not-downloaded',length:0}));
      finish({available:Boolean(packet.ready),missing,files:[],graphs:[],source:'service-worker-package-index',dormant:true});
    };
    try{controller.postMessage({type:'GET_MODEL_PACKAGE_STATUS'},[channel.port2])}
    catch(error){finish({available:false,missing:[{url:'local model package status',status:error.message||'message-failed',length:0}],files:[],graphs:[],source:'service-worker-message-failed',dormant:true})}
  });
}
async function ensureReflex(){
  if(globalThis.CommonweaveReflexRuntime&&globalThis.CommonweaveReflexRuntime!==reflexStatusProxy&&typeof globalThis.CommonweaveReflexRuntime.benchmark==='function')return globalThis.CommonweaveReflexRuntime;
  if(reflexPromise)return reflexPromise;
  reflexPromise=loadScript(REFLEX_SCRIPT,()=>globalThis.CommonweaveReflexRuntime&&globalThis.CommonweaveReflexRuntime!==reflexStatusProxy&&typeof globalThis.CommonweaveReflexRuntime.benchmark==='function')
    .then(()=>globalThis.CommonweaveReflexRuntime)
    .catch(error=>{reflexPromise=null;throw error});
  return reflexPromise;
}
function installDormantReflexStatus(){
  if(globalThis.CommonweaveReflexRuntime)return;
  reflexStatusProxy={
    model:'Xenova/all-MiniLM-L6-v2',
    dormant:true,
    status:modelPackageStatus,
    benchmark:async cases=>(await ensureReflex()).benchmark(cases),
    prewarm:async options=>(await ensureReflex()).prewarm(options)
  };
  globalThis.CommonweaveReflexRuntime=reflexStatusProxy;
}
function settingsBoundary(){
  const panel=document.querySelector('[data-route-panel="bundled"]');
  if(!panel||panel.querySelector('[data-cwf104-local-boundary]'))return;
  const note=document.createElement('div');
  note.dataset.cwf104LocalBoundary='';
  note.className='cw-ai-fallback-contract';
  note.innerHTML='<b>Validation boundary</b><span>The onboard runtime can route, retrieve, and validate submitted code against explicit rails. MiniLM can assist with semantic matching only. It cannot generate, rewrite, repair, or apply code. Connect an imported LLM for code generation.</span>';
  panel.append(note);
}
async function ensure(){
  if(globalThis.CommonweaveModelSettingsV133&&globalThis.CommonweaveModelSettingsV133!==facade)return true;
  if(settingsPromise)return settingsPromise;
  settingsPromise=(async()=>{
    addStyle();
    installDormantReflexStatus();
    for(const [src,ready] of DEPENDENCIES)await loadScript(src,ready);
    return true;
  })().catch(error=>{settingsPromise=null;throw error});
  return settingsPromise;
}
async function open(){
  if(openPromise)return openPromise;
  mark('opening');
  openPromise=(async()=>{
    await ensure();
    const runtime=globalThis.CommonweaveModelSettingsV133;
    if(!runtime?.open||runtime===facade)throw new Error('The shared settings surface did not become ready.');
    const dialog=runtime.open();
    settingsBoundary();
    mark('open');
    return dialog;
  })().catch(error=>{
    mark('error',error.message);
    dispatchEvent(new CustomEvent('commonweave:model-settings-error',{detail:{version:VERSION,message:error.message}}));
    throw error;
  }).finally(()=>{openPromise=null});
  return openPromise;
}
facade={
  version:`${VERSION}-facade`,
  open,
  ensure,
  renderInline:async(...args)=>{await ensure();return globalThis.CommonweaveModelSettingsV133.renderInline?.(...args)}
};
if(!globalThis.CommonweaveModelSettingsV133)globalThis.CommonweaveModelSettingsV133=facade;
mark('ready');
globalThis.CommonweaveModelSettingsControllerV173={version:VERSION,open,ensure,ensureReflex,modelPackageStatus,settingsBoundary,facade};
})();
