(()=>{
'use strict';

if(globalThis.CivweaveCoreInterfaceRuntimeV1?.version)return;

const VERSION='1.0.0';
const REVISION='five-system-interface-runtime-v1';
const requestedRelease=/^\d+\.\d+\.\d+$/.test(new URLSearchParams(globalThis.location?.search||'').get('version')||'')?new URLSearchParams(globalThis.location?.search||'').get('version'):'1.0.160';
const ASSET_REVISION=`${requestedRelease}-core-interface-runtime-v1`;
const FELLOWFARE_GUIDE_BRIDGE='/app/fellowfare-shared-guide-bridge-v236.js';
const ASSET_CUSTOMIZATION='/app/asset-customization-v239.js';
const ASSET_CUSTOMIZATION_STORAGE='civweave.asset-lockboard.v239';
const SYSTEM_ORDER=Object.freeze(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const SHARED_NEEDS=Object.freeze([
  'lifecycle',
  'navigation',
  'settings-entry',
  'guide-workspace',
  'status',
  'overlays'
]);
const SYSTEMS=Object.freeze({
  civweave:Object.freeze({
    id:'civweave',
    label:'Civweave',
    pathname:'/app/working-campus-v156.html',
    params:Object.freeze({}),
    features:Object.freeze(['intentions','planning','campus'])
  }),
  'living-school':Object.freeze({
    id:'living-school',
    label:'Living School',
    pathname:'/app/cabinets/living-school/index.html',
    params:Object.freeze({cabinet:'1'}),
    features:Object.freeze(['learning','projects','evidence'])
  }),
  cerbanimo:Object.freeze({
    id:'cerbanimo',
    label:'Cerbanimo',
    pathname:'/app/realm-console-v140.html',
    params:Object.freeze({system:'cerbanimo',cabinet:'1'}),
    features:Object.freeze(['quests','skills','projects'])
  }),
  fellowfare:Object.freeze({
    id:'fellowfare',
    label:'FellowFare',
    pathname:'/app/fellowfare-cabinet-v144.html',
    params:Object.freeze({cabinet:'1'}),
    features:Object.freeze(['exchange','resources','services'])
  }),
  anarchadia:Object.freeze({
    id:'anarchadia',
    label:'Anarchadia',
    pathname:'/app/anarchadia-console-v139.html',
    params:Object.freeze({cabinet:'1'}),
    features:Object.freeze(['governance','consent','review'])
  })
});
const SHARED_BOOT_SCRIPTS=Object.freeze([
  '/app/system-routes-v227.js',
  '/app/release-version-v1.js',
  '/app/settings-gateway-v317.js',
  '/app/mobile-ai-hardening-v302.js',
  '/app/experience-orchestrator-v232.js',
  '/app/system-radio-agent-v233.js',
  '/app/radio-track-suggestions-v240.js',
  '/app/canonical-playlists-v1.js',
  '/app/radio-playlist-governance-v1.js',
  '/app/civweave-systems-mesh-v251.js',
  '/app/host-node-session-v1.js',
  '/app/node-ai-mesh-v1.js',
  '/app/quest-veil-mesh-v1.js',
  '/app/quest-veil-ledger-gate-v1.js',
  '/app/quest-veil-v1.js',
  '/app/guide-identity-integrity-v216.js',
  '/app/realm-session-integrity-v237.js',
  '/app/guide-workspace-v242.js',
  '/app/working-campus-topbar-v243.js',
  '/app/themed-system-nav-v178.js',
  '/app/campus-background-download-v241.js',
  '/app/shared-review-surface-v234.js',
  '/app/shared-guide-surface-v236.js'
]);
const PATH_TO_SYSTEM=new Map(Object.values(SYSTEMS).map(item=>[item.pathname,item.id]));
const PHASE_ORDER=Object.freeze(['created','booting','dom-ready','shared-ready','system-ready','interactive','suspended','failed']);
const adapters=new Map();
const mountedAdapters=new Map();
const featureLoaders=new Map();
const featurePromises=new Map();
const readyWaiters=new Set();

let currentSystem=identify();
let phase='created';
let bootPromise=null;
let sharedBootPromise=null;
let suspended=false;
const sharedLoadFailures=new Map();

function clean(value,max=240){return String(value??'').trim().slice(0,max)}
function normalizePathname(value){
  let pathname=String(value||'/').split(/[?#]/,1)[0]||'/';
  try{pathname=decodeURI(pathname)}catch{}
  if(pathname.length>1&&pathname.endsWith('/'))pathname=pathname.slice(0,-1);
  return pathname;
}
function identify(value=globalThis.location?.pathname||'/'){
  const contract=globalThis.CivweaveSystemRoutesV227;
  const identified=clean(contract?.identify?.(value),80).toLowerCase();
  if(SYSTEMS[identified])return identified;
  let pathname=value;
  try{pathname=new URL(String(value),globalThis.location?.origin||'https://civweave.invalid').pathname}catch{}
  pathname=normalizePathname(pathname);
  const byPath=PATH_TO_SYSTEM.get(pathname);
  if(byPath)return byPath;
  const requested=clean(new URLSearchParams(globalThis.location?.search||'').get('system'),80).toLowerCase();
  return SYSTEMS[requested]?requested:'civweave';
}
function systemDefinition(id=currentSystem){return SYSTEMS[String(id||'').toLowerCase()]||SYSTEMS.civweave}
function detail(extra={}){
  const definition=systemDefinition();
  return Object.freeze({version:VERSION,revision:REVISION,phase,system:currentSystem,label:definition.label,...extra});
}
function emit(name,extra={}){
  const packet=detail(extra);
  try{globalThis.dispatchEvent?.(new CustomEvent(name,{detail:packet}))}catch{}
  return packet;
}
function setPhase(next,extra={}){
  next=clean(next,80)||phase;
  phase=next;
  const root=globalThis.document?.documentElement;
  if(root){
    root.dataset.civweaveInterfaceRuntime=REVISION;
    root.dataset.civweaveInterfacePhase=phase;
    root.dataset.civweaveSystem=currentSystem;
  }
  emit('civweave:interface-runtime-phase',extra);
  if(phase==='interactive'){
    for(const resolve of readyWaiters){try{resolve(status())}catch{}}
    readyWaiters.clear();
    emit('civweave:interface-runtime-ready');
  }
  return phase;
}
function scriptPresent(src){
  const document=globalThis.document;
  if(!document)return false;
  return [...document.scripts].some(script=>{
    if(!script.src)return false;
    try{return new URL(script.src,globalThis.location?.href||'https://civweave.invalid').pathname===src}catch{return false}
  });
}
function queueScript(src){
  const document=globalThis.document;
  const head=document?.head;
  if(!head)return Promise.resolve({src,ok:false,reason:'missing-head'});
  if(scriptPresent(src))return Promise.resolve({src,ok:true,existing:true});
  return new Promise(resolve=>{
    const script=document.createElement('script');
    script.src=`${src}?v=${encodeURIComponent(ASSET_REVISION)}`;
    script.async=false;
    script.onload=()=>resolve({src,ok:true,existing:false});
    script.onerror=()=>{
      sharedLoadFailures.set(src,'load-error');
      emit('civweave:interface-feature-error',{feature:src,message:`Shared runtime dependency failed to load: ${src}`});
      resolve({src,ok:false,reason:'load-error'});
    };
    head.append(script);
  });
}
function assetCustomizationConfigured(){
  try{
    const value=JSON.parse(globalThis.localStorage?.getItem(ASSET_CUSTOMIZATION_STORAGE)||'{}');
    return value?.personalEnabled!==false&&value?.pathOverrides&&Object.keys(value.pathOverrides).length>0;
  }catch{return false}
}
function installSharedSupport(){
  if(sharedBootPromise)return sharedBootPromise;
  const scripts=[...SHARED_BOOT_SCRIPTS];
  if(currentSystem==='fellowfare')scripts.push(FELLOWFARE_GUIDE_BRIDGE);
  if(assetCustomizationConfigured())scripts.push(ASSET_CUSTOMIZATION);
  sharedBootPromise=Promise.all(scripts.map(queueScript)).then(results=>{
    emit('civweave:interface-shared-support-ready',{attempted:results.length,failed:results.filter(result=>!result.ok).length});
    return Object.freeze(results);
  });
  return sharedBootPromise;
}
function ensureStructuralSlots(){
  const document=globalThis.document;
  const body=document?.body;
  if(!body)return null;
  body.dataset.civweaveInterfaceHost='';
  const content=document.querySelector('[data-civweave-interface-slot="content"]')||document.querySelector('main')||body;
  if(content!==body&&!content.hasAttribute('data-civweave-interface-slot'))content.setAttribute('data-civweave-interface-slot','content');
  let overlays=document.getElementById('civweave-interface-overlays');
  if(!overlays){
    overlays=document.createElement('div');
    overlays.id='civweave-interface-overlays';
    overlays.dataset.civweaveInterfaceSlot='overlays';
    body.append(overlays);
  }
  return{content,overlays};
}
function slots(){
  const document=globalThis.document;
  return Object.freeze({
    content:document?.querySelector?.('[data-civweave-interface-slot="content"]')||document?.querySelector?.('main')||document?.body||null,
    overlays:document?.getElementById?.('civweave-interface-overlays')||null,
    familyHeader:document?.getElementById?.('cwf104-head')||null,
    familyTray:document?.getElementById?.('cwf104-tray')||null
  });
}
function adapterContext(reason='mount'){
  return Object.freeze({
    version:VERSION,
    revision:REVISION,
    reason,
    system:currentSystem,
    definition:systemDefinition(),
    sharedNeeds:SHARED_NEEDS,
    sharedBootScripts:SHARED_BOOT_SCRIPTS,
    slots:slots(),
    navigate,
    requestFeature,
    status
  });
}
function registerAdapter(systemId,adapter={}){
  const id=clean(systemId,80).toLowerCase();
  if(!SYSTEMS[id])throw new Error(`Unknown Civweave system adapter: ${id||'(empty)'}`);
  if(!adapter||typeof adapter!=='object')throw new TypeError(`Adapter for ${id} must be an object.`);
  adapters.set(id,adapter);
  emit('civweave:interface-adapter-registered',{adapterSystem:id});
  if(bootPromise&&id===currentSystem&&['shared-ready','system-ready','interactive'].includes(phase))void mountAdapter(id,'late-register');
  return()=>{
    if(adapters.get(id)===adapter)adapters.delete(id);
  };
}
function getAdapter(systemId=currentSystem){return adapters.get(String(systemId||'').toLowerCase())||null}
async function mountAdapter(systemId=currentSystem,reason='boot'){
  const id=String(systemId||'').toLowerCase();
  const adapter=getAdapter(id);
  if(!adapter)return null;
  const previous=mountedAdapters.get(id);
  if(previous===adapter)return adapter;
  const context=adapterContext(reason);
  await adapter.beforeMount?.(context);
  await adapter.mount?.(context);
  mountedAdapters.set(id,adapter);
  await adapter.afterMount?.(context);
  emit('civweave:interface-system-ready',{adapterSystem:id,adapterMounted:true,reason});
  return adapter;
}
async function unmountAdapter(systemId=currentSystem,reason='unmount'){
  const id=String(systemId||'').toLowerCase();
  const adapter=mountedAdapters.get(id);
  if(!adapter)return false;
  mountedAdapters.delete(id);
  await adapter.unmount?.(adapterContext(reason));
  emit('civweave:interface-adapter-unmounted',{adapterSystem:id,reason});
  return true;
}
function registerFeature(name,loader){
  const id=clean(name,120);
  if(!id)throw new Error('Feature name is required.');
  if(typeof loader!=='function')throw new TypeError(`Feature loader for ${id} must be a function.`);
  featureLoaders.set(id,loader);
  return()=>{if(featureLoaders.get(id)===loader)featureLoaders.delete(id)};
}
async function requestFeature(name,options={}){
  const id=clean(name,120);
  if(!id)throw new Error('Feature name is required.');
  if(featurePromises.has(id))return featurePromises.get(id);
  const loader=featureLoaders.get(id);
  if(!loader)throw new Error(`No shared interface feature registered as “${id}”.`);
  const promise=Promise.resolve(loader(Object.freeze({system:currentSystem,definition:systemDefinition(),options,status,slots:slots()})))
    .then(value=>{emit('civweave:interface-feature-ready',{feature:id});return value})
    .catch(error=>{featurePromises.delete(id);emit('civweave:interface-feature-error',{feature:id,message:clean(error?.message||error,500)});throw error});
  featurePromises.set(id,promise);
  return promise;
}
function fallbackUrlFor(systemId,options={}){
  const definition=systemDefinition(systemId);
  const origin=options.origin||globalThis.location?.origin||'https://civweave.invalid';
  const url=new URL(definition.pathname,origin);
  for(const [key,value] of Object.entries(definition.params))url.searchParams.set(key,value);
  url.searchParams.set('installed','1');
  url.searchParams.set('navigation',REVISION);
  if(options.version)url.searchParams.set('version',String(options.version));
  if(options.source)url.searchParams.set('source',String(options.source));
  return url;
}
function navigate(systemId,options={}){
  const id=clean(systemId,80).toLowerCase();
  if(!SYSTEMS[id])throw new Error(`Unknown Civweave system: ${id||'(empty)'}`);
  const contract=globalThis.CivweaveSystemRoutesV227;
  if(contract?.navigate)return contract.navigate(id,{...options,source:options.source||'core-interface-runtime-v1'});
  const url=fallbackUrlFor(id,options);
  if(options.replace)globalThis.location?.replace?.(url.href);else globalThis.location?.assign?.(url.href);
  return url.href;
}
function status(){
  return Object.freeze({
    version:VERSION,
    revision:REVISION,
    phase,
    phaseIndex:PHASE_ORDER.indexOf(phase),
    system:currentSystem,
    definition:systemDefinition(),
    sharedNeeds:SHARED_NEEDS,
    adapterRegistered:adapters.has(currentSystem),
    adapterMounted:mountedAdapters.has(currentSystem),
    registeredFeatures:Object.freeze([...featureLoaders.keys()]),
    loadedFeatures:Object.freeze([...featurePromises.keys()]),
    sharedBootScripts:SHARED_BOOT_SCRIPTS,
    sharedLoadFailures:Object.freeze([...sharedLoadFailures.entries()]),
    suspended
  });
}
function whenReady(){
  if(phase==='interactive')return Promise.resolve(status());
  return new Promise(resolve=>readyWaiters.add(resolve));
}
async function suspend(reason='pagehide'){
  if(suspended)return status();
  suspended=true;
  const adapter=mountedAdapters.get(currentSystem);
  await adapter?.suspend?.(adapterContext(reason));
  setPhase('suspended',{reason});
  return status();
}
async function resume(reason='pageshow'){
  const nextSystem=identify();
  if(nextSystem!==currentSystem){
    const previous=currentSystem;
    await unmountAdapter(previous,'system-change');
    currentSystem=nextSystem;
    emit('civweave:interface-system-changed',{previousSystem:previous});
  }
  suspended=false;
  ensureStructuralSlots();
  const adapter=getAdapter(currentSystem);
  await adapter?.resume?.(adapterContext(reason));
  await mountAdapter(currentSystem,reason);
  setPhase('interactive',{reason,resumed:true});
  return status();
}
async function afterDomReady(){
  if(globalThis.document?.readyState!=='loading')return;
  await new Promise(resolve=>globalThis.addEventListener?.('DOMContentLoaded',resolve,{once:true}));
}
async function afterPaint(){
  if(typeof globalThis.requestAnimationFrame!=='function')return;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
async function boot(){
  if(bootPromise)return bootPromise;
  bootPromise=(async()=>{
    setPhase('booting');
    const sharedSupport=installSharedSupport();
    await afterDomReady();
    currentSystem=identify();
    ensureStructuralSlots();
    setPhase('dom-ready');
    await sharedSupport;
    setPhase('shared-ready',{failedSharedLoads:sharedLoadFailures.size});
    await mountAdapter(currentSystem,'boot');
    setPhase('system-ready',{adapterMounted:mountedAdapters.has(currentSystem)});
    await afterPaint();
    setPhase('interactive');
    return status();
  })().catch(error=>{
    setPhase('failed',{message:clean(error?.message||error,500)});
    emit('civweave:interface-runtime-error',{message:clean(error?.message||error,500)});
    throw error;
  });
  return bootPromise;
}

const api=Object.freeze({
  version:VERSION,
  revision:REVISION,
  systems:SYSTEMS,
  systemOrder:SYSTEM_ORDER,
  sharedNeeds:SHARED_NEEDS,
  sharedBootScripts:SHARED_BOOT_SCRIPTS,
  identify,
  currentSystem:()=>currentSystem,
  systemDefinition,
  registerAdapter,
  getAdapter,
  mountAdapter,
  unmountAdapter,
  registerFeature,
  requestFeature,
  installSharedSupport,
  assetCustomizationConfigured,
  navigate,
  slots,
  status,
  whenReady,
  suspend,
  resume,
  boot,
  ownership:Object.freeze({
    runtime:'core-interface-runtime-v1',
    bootstrapCaller:'install-boundary-v146',
    routeAuthority:'system-routes-v227',
    familyNavigationOwner:'family-shell-v104',
    settingsInputOwner:'settings-gateway-v317',
    guideWorkspaceOwner:'guide-workspace-v242'
  })
});

globalThis.CivweaveCoreInterfaceRuntimeV1=api;
globalThis.addEventListener?.('pagehide',()=>{void suspend('pagehide')});
globalThis.addEventListener?.('pageshow',event=>{if(event.persisted||suspended)void resume(event.persisted?'bfcache-pageshow':'pageshow')});
void boot().catch(error=>console.error('[Civweave interface runtime]',error));
})();
