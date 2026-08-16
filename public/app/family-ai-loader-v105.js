(()=>{
'use strict';

const VERSION='1.0.126-headless-canonical-chat-r54-selected-local';
if(globalThis.CivweaveFamilyAILoaderV105?.version===VERSION)return;

const CSS=['/app/intention-ui-v138.css?v=1.0.4','/app/assistant-runtime-v141.css?v=1.0.4'];
const PREREQUISITES=[
  ['/app/shared/civweave-parity-runtime.js?v=1.0.4',()=>globalThis.CivweaveParity],
  ['/app/shared/civweave-model-runtime.js?v=1.0.4',()=>globalThis.CivweaveModelRuntime],
  ['/app/weaveling-memory-v191.js?v=1.0.7-v191',()=>globalThis.CivweaveWeavelingMemoryV191],
  ['/app/intention-planner-v141.js?v=1.0.4',()=>globalThis.CivweaveIntentionPlanner],
  ['/app/guide-contracts-v141.js?v=1.0.4',()=>globalThis.CivweaveGuideContractsV141]
];
const VALUE_CORE=[
  ['/app/civweave-basic-value-v1.js?v=economic-review-v1',()=>globalThis.CivweaveBasicValueV1],
  ['/app/civweave-economic-policy-v1.js?v=economic-review-v1',()=>globalThis.CivweaveEconomicPolicyV1]
];
const VALUE_MODEL=[
  ['/app/civweave-basic-value-model-v1.js?v=economic-review-v1',()=>globalThis.CivweaveBasicValueModelV1],
  ['/app/civweave-basic-value-review-v1.js?v=economic-review-v1',()=>globalThis.CivweaveBasicValueReviewV1],
  ['/app/civweave-basic-value-systems-v1.js?v=economic-review-v1-idle-safe-v1',()=>globalThis.CivweaveBasicValueSystemsV1?.eventDriven===true]
];
const FAST_RUNTIME=['/app/fast-interactive-runtime-v192.js?v=1.0.124-v313-runtime-spine-contract',()=>globalThis.CivweaveFastInteractiveV192];
const RESPONSE_ROUTER=['/app/minilm-response-router-v347.js?v=1.0.0-response-router-v347',()=>globalThis.CivweaveResponseRouterV347];
const LOCAL_BOOTSTRAP=['/app/local-ai/bootstrap-v266.js?v=1.0.83-v282-inference-health',()=>globalThis.CivweaveLocalAIBootstrapV266];
const ASSISTANT=['/app/assistant-runtime-v141.js?v=1.0.5-minilm-local-route',()=>globalThis.CivweaveAssistantV141];
const PATCHES=[
  ['/app/deterministic-mode-v175.js?v=deterministic-r1',()=>globalThis.CivweaveDeterministicModeV175],
  ['/app/weaveling-memory-bridge-v191.js?v=1.0.7-v191',()=>globalThis.CivweaveWeavelingMemoryBridgeV191],
  ['/app/knowledge-encyclopedia-bridge-v271.js?v=knowledge-encyclopedia-v271',()=>globalThis.CivweaveKnowledgeEncyclopediaBridgeV271]
];
const OPTIONAL=[
  ['/app/intention-ui-v138.js?v=1.0.4',()=>globalThis.CivweaveIntentionUI],
  ['/app/local-object-mesh-v146.js?v=1.0.4',()=>globalThis.CivweaveLocalMeshV146],
  ['/app/core-loop-v152.js?v=1.0.4',()=>globalThis.CivweaveCoreLoopV152],
  ['/app/validation-cloud-optin-v1.js?v=host-capacity-v1',()=>globalThis.CivweaveValidationCloudOptInV1]
];
const LABEL={civweave:'Civweave','living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',anarchadia:'Anarchadia'};
const GUIDE={civweave:{name:'Weaveling',role:'Central mirror and project-memory assistant'},'living-school':{name:'Moss',role:'Learning guide'},cerbanimo:{name:'Kamiya',role:'Questwright and skilled-work guide'},fellowfare:{name:'Rook',role:'Quartermaster and exchange guide'},anarchadia:{name:'Merlin',role:'Civic, feature-request, and automation guide'}};
const LOCAL_SELECTION_KEY='civweave.local-ai.selection.v266';
const MODEL_PROFILES_KEY='civweave-model-profiles-v1';
const UNIVERSAL_AI_KEY='civweave.universal-ai.v127';
let promise=null,optionalPromise=null,valueCorePromise=null,valueModelPromise=null,localBootstrapPromise=null,economicReviewQueued=false,generation=0;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const arr=key=>{const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]};
const obj=key=>{const value=parse(localStorage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}};
function ludEnabled(){if(globalThis.CivweaveLudModeV1?.isEnabled)return globalThis.CivweaveLudModeV1.isEnabled();try{return parse(localStorage.getItem('civweave.operating-mode.v1'),{})?.mode==='lud'}catch{return false}}
function assertAIAllowed(capability='AI generation'){if(!ludEnabled())return true;const error=new Error(`${capability} is unavailable in Lud Mode.`);error.code='CIVWEAVE_LUD_AI_DISABLED';error.mode='lud';throw error}
function detect(){const query=new URLSearchParams(location.search).get('system');if(LABEL[query])return query;const declared=clean(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||document.body?.dataset?.civweaveSystem||document.body?.dataset?.system,80).toLowerCase();if(LABEL[declared])return declared;const path=location.pathname.toLowerCase(),host=location.hostname.toLowerCase();if(document.documentElement.hasAttribute('data-living-school-cabinet')||path.includes('/cabinets/living-school/')||path.includes('living-school'))return'living-school';if(path.includes('realm-console-v140')||path.includes('cerbanimo')||path.split('/').includes('loom')||host==='cerbanimo.com'||host.startsWith('cerbanimo.'))return'cerbanimo';if(path.includes('fellowfare'))return'fellowfare';if(path.includes('anarchadia'))return'anarchadia';return'civweave'}
function guideFor(system){return GUIDE[system]||GUIDE.civweave}
function addCss(href){if(document.querySelector(`link[data-cwf105-style="${href}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.cwf105Style=href;document.head.append(link)}
function removeStale(path,ready){for(const script of [...document.scripts])if(script.src&&new URL(script.src).pathname===path&&!ready?.()&&script.dataset.cwf105State!=='loading')script.remove()}
function loadScript(src,ready){if(ready?.())return Promise.resolve();const path=new URL(src,location.href).pathname,existing=[...document.scripts].find(script=>script.src&&new URL(script.src).pathname===path);if(existing?.dataset.cwf105State==='loading')return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{clearInterval(poll);reject(new Error(`${path} did not become ready`))},12000),poll=setInterval(()=>{if(ready?.()){clearTimeout(timer);clearInterval(poll);resolve()}},40)});removeStale(path,ready);return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.cwf105State='loading';const timer=setTimeout(()=>finish(new Error(`${path} timed out while loading`)),12000);function finish(error){clearTimeout(timer);if(error){script.remove();reject(error)}else{script.dataset.cwf105State='ready';resolve()}}script.onload=()=>ready?.()?finish():finish(new Error(`${path} loaded without its runtime`));script.onerror=()=>finish(new Error(`Could not load ${path}`));document.head.append(script)})}
function loadSequence(rows){return rows.reduce((chain,pair)=>chain.then(()=>loadScript(...pair)),Promise.resolve())}
function loadValueCore(){if(valueCorePromise)return valueCorePromise;valueCorePromise=loadSequence(VALUE_CORE).catch(error=>{valueCorePromise=null;throw error});return valueCorePromise}
function loadValueModel(){assertAIAllowed('Model-assisted economic review');if(valueModelPromise)return valueModelPromise;valueModelPromise=loadValueCore().then(()=>loadSequence(VALUE_MODEL)).catch(error=>{valueModelPromise=null;throw error});return valueModelPromise}
function selectedLocal(){const selected=parse(localStorage.getItem(LOCAL_SELECTION_KEY),{});return selected?.active&&selected?.id?selected:null}
function configuredLocal(){const profiles=obj(MODEL_PROFILES_KEY),legacy=obj(UNIVERSAL_AI_KEY),configured=profiles.interactive&&typeof profiles.interactive==='object'?profiles.interactive:legacy,provider=clean(configured?.provider||configured?.route,80).toLowerCase();return['downloaded-local','generative-local','smollm2','smollm3','qwen','browser'].includes(provider)}
function localRequested(){return Boolean(selectedLocal()||configuredLocal())}
async function ensureLocalAI(){
  if(!localRequested())return false;
  if(globalThis.CivweaveLocalAIBootstrapV266?.readyState==='ready')return true;
  if(localBootstrapPromise)return localBootstrapPromise;
  localBootstrapPromise=(async()=>{
    await loadScript(...LOCAL_BOOTSTRAP);
    const bootstrap=globalThis.CivweaveLocalAIBootstrapV266;
    const ready=await bootstrap?.ready;
    if(ready===false||bootstrap?.readyState!=='ready')throw new Error(bootstrap?.lastError||'The selected downloaded-local runtime did not become ready.');
    if(!globalThis.CivweaveLocalModelBridgeV266?.registered&&!globalThis.CivweaveLocalModelBridgeV266?.patch?.())throw new Error('The downloaded-local runtime bridge did not attach to the model runtime.');
    return true;
  })().catch(error=>{localBootstrapPromise=null;throw error});
  return localBootstrapPromise;
}
function reset(reason='manual reset'){generation++;promise=null;optionalPromise=null;valueModelPromise=null;localBootstrapPromise=null;try{dispatchEvent(new CustomEvent('civweave:guide-loader-reset',{detail:{reason,at:new Date().toISOString()}}))}catch{}}
function loadOptional(){assertAIAllowed('AI-adjacent optional runtime loading');if(optionalPromise)return optionalPromise;optionalPromise=Promise.allSettled(OPTIONAL.map(([src,ready])=>loadScript(src,ready))).then(()=>true);return optionalPromise}
function emitAssistantReady(){try{dispatchEvent(new CustomEvent('civweave:assistant-runtime-ready',{detail:{version:VERSION,system:detect(),at:new Date().toISOString(),localModelRequested:localRequested(),localModelReady:globalThis.CivweaveLocalAIBootstrapV266?.readyState==='ready'}}))}catch{}}
async function ensure(){
  assertAIAllowed('Guide and model generation');
  if(globalThis.CivweaveAssistantV141&&globalThis.CivweaveDeterministicModeV175&&globalThis.CivweaveWeavelingMemoryBridgeV191&&globalThis.CivweaveKnowledgeEncyclopediaBridgeV271){
    await loadValueCore();await loadValueModel();await loadScript(...FAST_RUNTIME);await loadScript(...RESPONSE_ROUTER);await ensureLocalAI();globalThis.CivweaveWeavelingMemoryBridgeV191.install?.();await globalThis.CivweaveKnowledgeEncyclopediaBridgeV271.install?.();loadOptional();emitAssistantReady();return true;
  }
  if(promise)return promise;
  const ticket=++generation;
  promise=(async()=>{
    CSS.forEach(addCss);await loadValueCore();await Promise.all(PREREQUISITES.map(([src,ready])=>loadScript(src,ready)));if(ticket!==generation)throw new Error('Civweave loading was reset.');await loadValueModel();await loadScript(...FAST_RUNTIME);await loadScript(...RESPONSE_ROUTER);await ensureLocalAI();await loadScript(...ASSISTANT);await Promise.all(PATCHES.map(([src,ready])=>loadScript(src,ready)));await globalThis.CivweaveKnowledgeEncyclopediaBridgeV271?.install?.();globalThis.CivweaveDeterministicModeV175?.installAssistantPatch?.();globalThis.CivweaveWeavelingMemoryBridgeV191?.install?.();loadOptional();emitAssistantReady();return true;
  })().catch(error=>{if(ticket===generation)reset(error.message);throw error});
  return promise;
}
function requestEconomicReview(reason='realm-work-created'){if(ludEnabled())return false;if(economicReviewQueued)return;economicReviewQueued=true;queueMicrotask(async()=>{try{await ensure();globalThis.CivweaveBasicValueSystemsV1?.schedule?.(0);try{dispatchEvent(new CustomEvent('civweave:economic-review-requested',{detail:{reason,system:detect(),at:new Date().toISOString()}}))}catch{}}catch(error){console.info('[Civweave economic review deferred]',error.message)}finally{economicReviewQueued=false}});return true}
function patchHeader(){const button=document.querySelector('#cwf104-head [data-cwf-chat]');if(!button)return;const system=detect(),guide=guideFor(system);button.setAttribute('aria-label',ludEnabled()?'AI guide chat unavailable in Lud Mode':`Talk to ${guide.name} in ${LABEL[system]}`);button.title=ludEnabled()?'Lud Mode · AI guide chat unavailable':`Talk to ${guide.name}`;button.toggleAttribute('disabled',ludEnabled())}
function canonicalChatApi(){if(globalThis.CivweaveGuideWorkspaceV242?.openWindow)return{kind:'workspace',api:globalThis.CivweaveGuideWorkspaceV242};const api=globalThis.CivweavePersistentGuideChatV215;if(api?.canonicalOwner&&typeof api.open==='function')return{kind:'compat',api};return null}
function openCanonical(target,prefill=''){const owner=canonicalChatApi();if(!owner)return null;if(owner.kind==='workspace')return owner.api.openWindow(target,{prefill,focus:true});return owner.api.open({guide:target,prefill,focus:true})}
function waitForCanonicalChat(timeout=1600){if(canonicalChatApi())return Promise.resolve(true);return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);removeEventListener('civweave:guide-workspace-ready',ready);resolve(value)},ready=()=>finish(true),timer=setTimeout(()=>finish(Boolean(canonicalChatApi())),timeout);addEventListener('civweave:guide-workspace-ready',ready,{once:true})})}
async function openChat(system=detect(),{prefill='',contextSystem=system}={}){assertAIAllowed('Guide chat');const target=LABEL[contextSystem]?contextSystem:LABEL[system]?system:detect();patchHeader();const immediate=openCanonical(target,prefill);if(immediate)return immediate;await waitForCanonicalChat();return openCanonical(target,prefill)}
function compact(rows,limit=8){return(Array.isArray(rows)?rows.slice(-limit):[]).map(row=>{const out={};for(const key of ['id','title','name','kind','state','status','label','capability','objective','purpose','updatedAt','createdAt','at'])if(row?.[key]!=null)out[key]=row[key];if(row?.fields)out.fields=row.fields;return out})}
function workspaceSnapshot(system=detect(),query=''){const living=obj('civweave.living-school.cabinet.v151'),fellow=obj('fellowfare.mvp.state.v3'),anarchadia=obj('civweave.anarchadia.citizen-console.v139'),memory=system==='civweave'?null:globalThis.CivweaveWeavelingMemoryV191?.snapshot?.(query,{limit:6})||null,snapshot={schema:'civweave.inline-workspace-context.v4-fast',contextSystem:system,page:{path:location.pathname,room:new URLSearchParams(location.search).get('room')},memory,intentions:compact(arr('civweave.intentions.v127'),8)};if(system==='living-school')snapshot.livingSchool=living.school?{school:living.school,activeModuleId:living.activeModuleId,progress:living.progress,practicum:living.practicum,projectGate:living.projectGate}:null;if(system==='cerbanimo')snapshot.cerbanimo={quests:compact(arr('civweave.cerbanimo.quest-queue.v1'),10),actions:compact(arr('civweave.realm-actions.v141').filter(item=>item?.system==='cerbanimo'),10)};if(system==='fellowfare')snapshot.fellowfare={resources:compact(arr('civweave.fellowfare.resource-queue.v152'),10),threads:compact(fellow.threads,8),listings:compact(fellow.listings||fellow.offers||fellow.posts,8)};if(system==='anarchadia')snapshot.anarchadia={proposals:compact(anarchadia.proposals,8),passport:obj('civweave.anarchadia.passport.v152')};return clean(JSON.stringify(snapshot),7000)}
async function openSettings(launcher){const gateway=globalThis.CivweaveSettingsGatewayV317;if(!gateway?.open){console.error('Civweave Settings gateway is unavailable.');try{dispatchEvent(new CustomEvent('civweave:model-settings-open-failed',{detail:{message:'Settings gateway unavailable',system:detect()}}))}catch{}return null}return gateway.open(launcher)}
function warm(){assertAIAllowed('AI runtime warmup');return ensure()}
function boot(){patchHeader();loadValueCore().catch(error=>console.warn('[Civweave economic value core]',error.message))}
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();addEventListener('pageshow',boot);addEventListener('civweave:guide-workspace-ready',patchHeader);addEventListener('civweave:operating-mode-changed',patchHeader);addEventListener('civweave:working-campus-plan-built',()=>requestEconomicReview('working-campus-plan-built'));addEventListener('cerbanimo:quest-engine-changed',()=>requestEconomicReview('cerbanimo-quest-changed'));
globalThis.CivweaveFamilyAILoaderV105={version:VERSION,ensure,warm,ensureLocalAI,localRequested,openChat,openSettings,reset,workspaceSnapshot,requestEconomicReview,settingsOwner:'settings-gateway-v317',settingsInputOwnership:false,defaultProvider:'configured-route',transformerActive:false,memoryRevision:'v192-fast-relevant-memory',latencyRevision:'v250-headless-explicit-demand-only',localModelPathway:'selected-model-on-demand-v316',localAIOptionalSideEffects:false,knowledgeRevision:'v271-local-encyclopedia',canonicalChatOwner:'guide-chat-surface-v350',validationCloudOptIn:'v1',economicValueRevision:'v1-model-estimate-plus-rubric-review-idle-safe',ludGuard:true,aiAllowed:()=>!ludEnabled(),eagerWarm:false};
})();