(()=>{
'use strict';

const VERSION='1.0.121-headless-canonical-chat-r50-local-ai-coherence-v307';
const LOCAL_AI_BOOTSTRAP_REVISION='1.0.115-local-ai-bootstrap-v302-session-handoff';
if(globalThis.CivweaveFamilyAILoaderV105?.version===VERSION)return;

const CSS=['/app/intention-ui-v138.css?v=1.0.4','/app/assistant-runtime-v141.css?v=1.0.4'];
const PREREQUISITES=[
  ['/app/shared/civweave-parity-runtime.js?v=1.0.4',()=>globalThis.CivweaveParity],
  ['/app/shared/civweave-model-runtime.js?v=1.0.4',()=>globalThis.CivweaveModelRuntime],
  ['/app/weaveling-memory-v191.js?v=1.0.7-v191',()=>globalThis.CivweaveWeavelingMemoryV191],
  ['/app/intention-planner-v141.js?v=1.0.4',()=>globalThis.CivweaveIntentionPlanner],
  ['/app/guide-contracts-v141.js?v=1.0.4',()=>globalThis.CivweaveGuideContractsV141]
];
const FAST_RUNTIME=['/app/fast-interactive-runtime-v192.js?v=1.0.7-v192',()=>globalThis.CivweaveFastInteractiveV192];
const ASSISTANT=['/app/assistant-runtime-v141.js?v=1.0.4',()=>globalThis.CivweaveAssistantV141];
const PATCHES=[
  ['/app/deterministic-mode-v175.js?v=deterministic-r1',()=>globalThis.CivweaveDeterministicModeV175],
  ['/app/weaveling-memory-bridge-v191.js?v=1.0.7-v191',()=>globalThis.CivweaveWeavelingMemoryBridgeV191],
  ['/app/knowledge-encyclopedia-bridge-v271.js?v=knowledge-encyclopedia-v271',()=>globalThis.CivweaveKnowledgeEncyclopediaBridgeV271]
];
const OPTIONAL=[
  ['/app/intention-ui-v138.js?v=1.0.4',()=>globalThis.CivweaveIntentionUI],
  ['/app/local-object-mesh-v146.js?v=1.0.4',()=>globalThis.CivweaveLocalMeshV146],
  ['/app/core-loop-v152.js?v=1.0.4',()=>globalThis.CivweaveCoreLoopV152],
  ['/app/local-ai/bootstrap-v266.js?v=1.0.121-local-ai-coherence-v307',()=>globalThis.CivweaveLocalAIBootstrapV266?.revision===LOCAL_AI_BOOTSTRAP_REVISION],
  ['/app/validation-cloud-optin-v1.js?v=host-capacity-v1',()=>globalThis.CivweaveValidationCloudOptInV1]
];
const LABEL={civweave:'Civweave','living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',anarchadia:'Anarchadia'};
const GUIDE={
  civweave:{name:'Weaveling',role:'Central mirror and project-memory assistant'},
  'living-school':{name:'Moss',role:'Learning guide'},
  cerbanimo:{name:'Kamiya',role:'Questwright and skilled-work guide'},
  fellowfare:{name:'Rook',role:'Quartermaster and exchange guide'},
  anarchadia:{name:'Merlin',role:'Civic, feature-request, and automation guide'}
};

let promise=null;
let optionalPromise=null;
let generation=0;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const arr=key=>{const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]};
const obj=key=>{const value=parse(localStorage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}};

function detect(){
  const query=new URLSearchParams(location.search).get('system');
  if(LABEL[query])return query;
  const declared=clean(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||document.body?.dataset?.civweaveSystem||document.body?.dataset?.system,80).toLowerCase();
  if(LABEL[declared])return declared;
  const path=location.pathname.toLowerCase(),host=location.hostname.toLowerCase();
  if(document.documentElement.hasAttribute('data-living-school-cabinet')||path.includes('/cabinets/living-school/')||path.includes('living-school'))return'living-school';
  if(path.includes('realm-console-v140')||path.includes('cerbanimo')||path.split('/').includes('loom')||host==='cerbanimo.com'||host.startsWith('cerbanimo.'))return'cerbanimo';
  if(path.includes('fellowfare'))return'fellowfare';
  if(path.includes('anarchadia'))return'anarchadia';
  return'civweave';
}
function guideFor(system){return GUIDE[system]||GUIDE.civweave}
function addCss(href){if(document.querySelector(`link[data-cwf105-style="${href}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.cwf105Style=href;document.head.append(link)}
function removeStale(path,ready){for(const script of [...document.scripts])if(script.src&&new URL(script.src).pathname===path&&!ready?.()&&script.dataset.cwf105State!=='loading')script.remove()}
function loadScript(src,ready){
  if(ready?.())return Promise.resolve();
  const path=new URL(src,location.href).pathname;
  const existing=[...document.scripts].find(script=>script.src&&new URL(script.src).pathname===path);
  if(existing?.dataset.cwf105State==='loading')return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{clearInterval(poll);reject(new Error(`${path} did not become ready`))},8000);
    const poll=setInterval(()=>{if(ready?.()){clearTimeout(timer);clearInterval(poll);resolve()}},40);
  });
  removeStale(path,ready);
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=src;script.async=false;script.dataset.cwf105State='loading';
    const timer=setTimeout(()=>finish(new Error(`${path} timed out while loading`)),8000);
    function finish(error){clearTimeout(timer);if(error){script.remove();reject(error)}else{script.dataset.cwf105State='ready';resolve()}}
    script.onload=()=>ready?.()?finish():finish(new Error(`${path} loaded without its runtime`));
    script.onerror=()=>finish(new Error(`Could not load ${path}`));
    document.head.append(script);
  });
}
function reset(reason='manual reset'){generation++;promise=null;optionalPromise=null;try{dispatchEvent(new CustomEvent('civweave:guide-loader-reset',{detail:{reason,at:new Date().toISOString()}}))}catch{}}
function loadOptional(){if(optionalPromise)return optionalPromise;optionalPromise=Promise.allSettled(OPTIONAL.map(([src,ready])=>loadScript(src,ready))).then(()=>true);return optionalPromise}
function emitAssistantReady(){try{dispatchEvent(new CustomEvent('civweave:assistant-runtime-ready',{detail:{version:VERSION,system:detect(),at:new Date().toISOString()}}))}catch{}}

async function ensure(){
  if(globalThis.CivweaveAssistantV141&&globalThis.CivweaveDeterministicModeV175&&globalThis.CivweaveWeavelingMemoryBridgeV191&&globalThis.CivweaveKnowledgeEncyclopediaBridgeV271){
    globalThis.CivweaveWeavelingMemoryBridgeV191.install?.();
    await globalThis.CivweaveKnowledgeEncyclopediaBridgeV271.install?.();
    loadOptional();
    emitAssistantReady();
    return true;
  }
  if(promise)return promise;
  const ticket=++generation;
  promise=(async()=>{
    CSS.forEach(addCss);
    await Promise.all(PREREQUISITES.map(([src,ready])=>loadScript(src,ready)));
    if(ticket!==generation)throw new Error('Civweave loading was reset.');
    await loadScript(...FAST_RUNTIME);
    await loadScript(...ASSISTANT);
    await Promise.all(PATCHES.map(([src,ready])=>loadScript(src,ready)));
    await globalThis.CivweaveKnowledgeEncyclopediaBridgeV271?.install?.();
    globalThis.CivweaveDeterministicModeV175?.installAssistantPatch?.();
    globalThis.CivweaveWeavelingMemoryBridgeV191?.install?.();
    loadOptional();
    emitAssistantReady();
    return true;
  })().catch(error=>{if(ticket===generation)reset(error.message);throw error});
  return promise;
}

function patchHeader(){
  const button=document.querySelector('#cwf104-head [data-cwf-chat]');
  if(!button)return;
  const system=detect(),guide=guideFor(system);
  button.setAttribute('aria-label',`Talk to ${guide.name} in ${LABEL[system]}`);
  button.title=`Talk to ${guide.name}`;
}
function canonicalChatApi(){
  if(globalThis.CivweaveGuideWorkspaceV242?.openWindow)return{kind:'workspace',api:globalThis.CivweaveGuideWorkspaceV242};
  const api=globalThis.CivweavePersistentGuideChatV215;
  if(api?.canonicalOwner&&typeof api.open==='function')return{kind:'compat',api};
  return null;
}
function openCanonical(target,prefill=''){
  const owner=canonicalChatApi();
  if(!owner)return null;
  if(owner.kind==='workspace')return owner.api.openWindow(target,{prefill,focus:true});
  return owner.api.open({guide:target,prefill,focus:true});
}
function waitForCanonicalChat(timeout=1600){
  if(canonicalChatApi())return Promise.resolve(true);
  return new Promise(resolve=>{
    let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);removeEventListener('civweave:guide-workspace-ready',ready);resolve(value)};
    const ready=()=>finish(true),timer=setTimeout(()=>finish(Boolean(canonicalChatApi())),timeout);
    addEventListener('civweave:guide-workspace-ready',ready,{once:true});
  });
}
async function openChat(system=detect(),{prefill='',contextSystem=system}={}){
  const target=LABEL[contextSystem]?contextSystem:LABEL[system]?system:detect();
  patchHeader();
  const immediate=openCanonical(target,prefill);
  if(immediate)return immediate;
  await waitForCanonicalChat();
  return openCanonical(target,prefill);
}

function compact(rows,limit=8){return(Array.isArray(rows)?rows.slice(-limit):[]).map(row=>{const out={};for(const key of ['id','title','name','kind','state','status','label','capability','objective','purpose','updatedAt','createdAt','at'])if(row?.[key]!=null)out[key]=row[key];if(row?.fields)out.fields=row.fields;return out})}
function workspaceSnapshot(system=detect(),query=''){
  const living=obj('civweave.living-school.cabinet.v151'),fellow=obj('fellowfare.mvp.state.v3'),anarchadia=obj('civweave.anarchadia.citizen-console.v139');
  const memory=system==='civweave'?null:globalThis.CivweaveWeavelingMemoryV191?.snapshot?.(query,{limit:6})||null;
  const snapshot={schema:'civweave.inline-workspace-context.v4-fast',contextSystem:system,page:{path:location.pathname,room:new URLSearchParams(location.search).get('room')},memory,intentions:compact(arr('civweave.intentions.v127'),8)};
  if(system==='living-school')snapshot.livingSchool=living.school?{school:living.school,activeModuleId:living.activeModuleId,progress:living.progress,practicum:living.practicum,projectGate:living.projectGate}:null;
  if(system==='cerbanimo')snapshot.cerbanimo={quests:compact(arr('civweave.cerbanimo.quest-queue.v1'),10),actions:compact(arr('civweave.realm-actions.v141').filter(item=>item?.system==='cerbanimo'),10)};
  if(system==='fellowfare')snapshot.fellowfare={resources:compact(arr('civweave.fellowfare.resource-queue.v152'),10),threads:compact(fellow.threads,8),listings:compact(fellow.listings||fellow.offers||fellow.posts,8)};
  if(system==='anarchadia')snapshot.anarchadia={proposals:compact(anarchadia.proposals,8),passport:obj('civweave.anarchadia.passport.v152')};
  return clean(JSON.stringify(snapshot),7000);
}

async function openSettings(){
  try{
    const controller=globalThis.CivweaveModelSettingsControllerV173;
    if(!controller?.open)throw new Error('The direct model settings controller is unavailable.');
    return await controller.open();
  }catch(error){
    console.error('Civweave settings failed to open',error);
    try{dispatchEvent(new CustomEvent('civweave:model-settings-open-failed',{detail:{message:error.message,system:detect()}}))}catch{}
    return null;
  }
}
function warm(){return ensure()}
function boot(){patchHeader()}

document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
addEventListener('pageshow',boot);
addEventListener('civweave:guide-workspace-ready',patchHeader);

globalThis.CivweaveFamilyAILoaderV105={
  version:VERSION,
  ensure,
  warm,
  openChat,
  openSettings,
  reset,
  workspaceSnapshot,
  settingsOwner:'CivweaveModelSettingsControllerV173',
  defaultProvider:'deterministic',
  transformerActive:false,
  memoryRevision:'v192-fast-relevant-memory',
  latencyRevision:'v250-headless-explicit-demand-only',
  localModelPathway:'optional-v307-coherent-bootstrap',
  knowledgeRevision:'v271-local-encyclopedia',
  canonicalChatOwner:'guide-workspace-v242',
  validationCloudOptIn:'v1',
  eagerWarm:false
};
})();