(()=>{
'use strict';
const VERSION='172.0-settings-window-capture';
if(globalThis.CommonweaveSettingsSafeOpenV172?.version===VERSION)return;
const STYLE='/app/model-settings-v133.css?v=settings-safe-open-v172';
const SETTINGS_SCRIPTS=[
  ['/app/shared/commonweave-model-runtime.js?v=settings-safe-open-v172',()=>globalThis.CommonweaveModelRuntime],
  ['/app/minilm-model-settings-v138.js?v=settings-safe-open-v172',()=>globalThis.CommonweaveModelSettingsV133]
];
const REFLEX_SCRIPT='/app/minilm-reflex-runtime-v138.js?v=settings-safe-open-v172-explicit';
let settingsPromise=null;
let openPromise=null;
let reflexPromise=null;
let statusProxy=null;
function mark(state,message=''){
  document.documentElement.dataset.settingsOpenState=state;
  if(message)document.documentElement.dataset.settingsOpenMessage=String(message).slice(0,240);
  else delete document.documentElement.dataset.settingsOpenMessage;
}
function addStyle(){
  if(document.querySelector('link[data-cw172-settings-style]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=STYLE;link.dataset.cw172SettingsStyle='';document.head.append(link);
}
function loadScript(src,ready){
  if(ready?.())return Promise.resolve(true);
  const pathname=new URL(src,location.href).pathname;
  const existing=[...document.scripts].find(script=>script.src&&new URL(script.src).pathname===pathname);
  if(existing)return new Promise((resolve,reject)=>{
    const started=Date.now();
    const timer=setInterval(()=>{
      if(ready?.()){clearInterval(timer);resolve(true)}
      else if(Date.now()-started>8000){clearInterval(timer);reject(new Error(`${pathname} did not become ready`))}
    },50);
  });
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=src;script.async=false;script.dataset.cw172SettingsDependency='';
    const timeout=setTimeout(()=>finish(new Error(`${pathname} timed out`)),8000);
    function finish(error){clearTimeout(timeout);if(error){script.remove();reject(error)}else resolve(true)}
    script.onload=()=>ready?.()?finish():finish(new Error(`${pathname} loaded without its runtime`));
    script.onerror=()=>finish(new Error(`Could not load ${pathname}`));
    document.head.append(script);
  });
}
function modelPackageStatus(){
  return new Promise(resolve=>{
    const controller=navigator.serviceWorker?.controller;
    if(!controller){resolve({available:false,missing:[{url:'local model package status',status:'unavailable',length:0}],dormant:true});return}
    const channel=new MessageChannel();
    let settled=false;
    const finish=value=>{
      if(settled)return;settled=true;clearTimeout(timeout);channel.port1.close?.();channel.port2.close?.();resolve(value);
    };
    const timeout=setTimeout(()=>finish({available:false,missing:[{url:'local model package status',status:'timeout',length:0}],dormant:true}),1200);
    channel.port1.onmessage=event=>{
      const packet=event.data||{};
      const missing=(packet.missing||[]).map(url=>({url,status:'not-downloaded',length:0}));
      finish({available:Boolean(packet.ready),missing,files:[],graphs:[],source:'service-worker-package-index',dormant:true});
    };
    try{controller.postMessage({type:'GET_MODEL_PACKAGE_STATUS'},[channel.port2])}
    catch(error){finish({available:false,missing:[{url:'local model package status',status:error.message||'message-failed',length:0}],dormant:true})}
  });
}
async function ensureReflex(){
  if(globalThis.CommonweaveReflexRuntime&&globalThis.CommonweaveReflexRuntime!==statusProxy&&typeof globalThis.CommonweaveReflexRuntime.benchmark==='function')return globalThis.CommonweaveReflexRuntime;
  if(reflexPromise)return reflexPromise;
  reflexPromise=loadScript(REFLEX_SCRIPT,()=>globalThis.CommonweaveReflexRuntime&&globalThis.CommonweaveReflexRuntime!==statusProxy&&typeof globalThis.CommonweaveReflexRuntime.benchmark==='function').then(()=>globalThis.CommonweaveReflexRuntime).catch(error=>{reflexPromise=null;throw error});
  return reflexPromise;
}
function installDormantStatusProxy(){
  if(globalThis.CommonweaveReflexRuntime)return;
  statusProxy={
    model:'Xenova/all-MiniLM-L6-v2',
    dormant:true,
    status:modelPackageStatus,
    benchmark:async cases=>(await ensureReflex()).benchmark(cases),
    prewarm:async options=>(await ensureReflex()).prewarm(options)
  };
  globalThis.CommonweaveReflexRuntime=statusProxy;
}
async function ensureSettings(){
  if(globalThis.CommonweaveModelSettingsV133)return true;
  if(settingsPromise)return settingsPromise;
  settingsPromise=(async()=>{
    addStyle();
    installDormantStatusProxy();
    for(const [src,ready] of SETTINGS_SCRIPTS)await loadScript(src,ready);
    return true;
  })().catch(error=>{settingsPromise=null;throw error});
  return settingsPromise;
}
function patchApis(){
  if(globalThis.CommonweaveFamilyAILoaderV105)globalThis.CommonweaveFamilyAILoaderV105.openSettings=open;
  if(globalThis.CommonweaveFamilyShellV104)globalThis.CommonweaveFamilyShellV104.openSettings=open;
}
async function open(){
  if(openPromise)return openPromise;
  mark('opening');
  openPromise=(async()=>{
    await ensureSettings();
    patchApis();
    const runtime=globalThis.CommonweaveModelSettingsV133;
    if(!runtime?.open)throw new Error('The shared settings surface did not become ready.');
    const dialog=runtime.open();
    mark('open');
    return dialog;
  })().catch(error=>{mark('error',error.message);throw error}).finally(()=>{openPromise=null});
  return openPromise;
}
function settingsControl(target){
  if(!target?.closest)return null;
  if(target.closest('[data-unified-model-settings],#cw-ai-settings-v157'))return null;
  const explicit=target.closest('#settings-button,#model-chip,[data-cwf-settings],[data-action="settings"],#lite-settings,[data-model-settings],[data-ai-settings],[data-capability="commonweave.model-setup"],[data-cw143-settings]');
  if(explicit)return explicit;
  const control=target.closest('button,a,[role="button"],summary');
  return control&&/\b(ai settings|model settings|model setup|configure ai|configure model|choose the compass mind|model control)\b/i.test(control.textContent||control.getAttribute('aria-label')||'')?control:null;
}
function captureSettingsClick(event){
  const control=settingsControl(event.target);if(!control)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  open().catch(error=>{
    console.error('[Commonweave] AI settings could not open.',error);
    dispatchEvent(new CustomEvent('commonweave:model-settings-error',{detail:{version:VERSION,message:error.message}}));
  });
}
/* Window capture runs before older document-capture handlers that still close over eager loaders. */
addEventListener('click',captureSettingsClick,true);
patchApis();
for(const delay of [0,100,500,1500])setTimeout(patchApis,delay);
mark('ready');
globalThis.CommonweaveSettingsSafeOpenV172={version:VERSION,open,ensureSettings,modelPackageStatus,ensureReflex,patchApis,captureSettingsClick};
})();
