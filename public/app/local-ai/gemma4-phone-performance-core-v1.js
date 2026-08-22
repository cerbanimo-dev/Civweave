(()=>{
'use strict';

const VERSION='1.2.0-gemma4-phone-performance-core-v1-resume-authority';
const REGISTRY_KEY='CivweaveLocalModelRegistryV266';
const PACKS_KEY='CivweaveLocalModelPacksV1';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const PREMIER='premier-phone';
const FAST_E2='gemma4-e2b-it-litert-web';
const FAST_E4='gemma4-e4b-it-litert-web';
const LEGACY_E2='gemma4-e2b-it-q4f16';
const LEGACY_E4='gemma4-e4b-it-q4f16';
const Q2_E2='gemma4-e2b-it-q2f16-mobile';
const Q2_E4='gemma4-e4b-it-q2f16-mobile';
const FALLBACK='qwen3-0.6b-q8-wasm';
const FAST_BYTES=Object.freeze({[FAST_E2]:2_008_432_640,[FAST_E4]:2_969_059_328});
const PERFORMANCE_CORE_BYTES=6_854_491_968;
const RETIRED_PHONE_CORE=new Set([LEGACY_E2,LEGACY_E4,Q2_E2,Q2_E4,FAST_E2,FAST_E4]);

if(globalThis.CivweaveGemma4PhonePerformanceCoreV1?.version===VERSION)return;

const freeze=value=>Object.freeze(value);
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const downloads=()=>parse(localStorage.getItem(DOWNLOADS_KEY),{});
const packStates=()=>parse(localStorage.getItem(PACK_STATE_KEY),{});
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const browser=()=>globalThis.CivweaveBrowserPackDownloadV1;
const packExtension=()=>globalThis.CivweaveGemma4PackExtensionV1;
const fastExtension=()=>globalThis.CivweaveGemma4LiteRTFastExtensionV1;
const deepExtension=()=>globalThis.CivweaveGemma4E4BQ4ExtensionV1;
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}};

function writePackState(patch){
  const rows=packStates();
  rows[PREMIER]={...(rows[PREMIER]||{}),...patch,updatedAt:new Date().toISOString()};
  try{localStorage.setItem(PACK_STATE_KEY,JSON.stringify(rows))}catch{}
  return rows[PREMIER];
}
function existingPremier(){
  const state=packStates()[PREMIER]||{};
  return Boolean(state.installedAt||['ready','browser-ready','browser-partial','browser-queued','core-update-required','performance-core-required'].includes(String(state.status||'')));
}
function savedReady(id){return downloads()?.[id]?.status==='ready'}
function missingFastIds(){return [FAST_E2,FAST_E4].filter(id=>!savedReady(id))}

function layeredRegistry(registry){
  let base=registry;
  try{base=packExtension()?.patchRegistry?.(base)||base}catch{}
  try{base=deepExtension()?.patchRegistry?.(base)||base}catch{}
  try{base=fastExtension()?.patchRegistry?.(base)||base}catch{}
  return base;
}
function patchRegistry(registry){
  const base=layeredRegistry(registry);
  if(!base?.byId||!Array.isArray(base.models))return base;
  if(base.__civweaveGemma4PhonePerformanceRegistryV1)return base;
  const missing=[LEGACY_E2,LEGACY_E4,FAST_E2,FAST_E4].filter(id=>!base.byId(id));
  return freeze({
    ...base,
    __civweaveGemma4PhonePerformanceRegistryV1:true,
    gemma4PhonePerformanceRegistry:true,
    gemma4PhonePerformanceRegistryComplete:missing.length===0,
    gemma4PhonePerformanceRegistryMissing:freeze(missing),
    gemma4PhonePrimaryModel:FAST_E2,
    gemma4PhoneDeepModel:FAST_E4,
    gemma4LegacyFastAlias:LEGACY_E2,
    gemma4LegacyDeepAlias:LEGACY_E4
  });
}
function watchRegistry(){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,REGISTRY_KEY);
  if(descriptor&&!descriptor.configurable){
    try{const current=globalThis[REGISTRY_KEY],next=patchRegistry(current);if(next!==current)globalThis[REGISTRY_KEY]=next}catch{}
    return Boolean(globalThis[REGISTRY_KEY]?.__civweaveGemma4PhonePerformanceRegistryV1);
  }
  let value=patchRegistry(globalThis[REGISTRY_KEY]);
  try{
    Object.defineProperty(globalThis,REGISTRY_KEY,{configurable:true,enumerable:true,get(){return value},set(next){value=patchRegistry(next)}});
    return true;
  }catch{
    try{globalThis[REGISTRY_KEY]=patchRegistry(globalThis[REGISTRY_KEY])}catch{}
    return Boolean(globalThis[REGISTRY_KEY]?.__civweaveGemma4PhonePerformanceRegistryV1);
  }
}

function performanceOrder(base){
  const order=[...(base?.installOrder||[])].filter(id=>id&&!RETIRED_PHONE_CORE.has(id));
  const at=order.indexOf(FALLBACK);
  if(at>=0)order.splice(at+1,0,FAST_E2,FAST_E4);
  else order.unshift(FAST_E2,FAST_E4);
  return order.filter((id,index,rows)=>rows.indexOf(id)===index);
}
function performancePack(base){
  const order=performanceOrder(base);
  const prior=[...(base?.generative||[])].filter(id=>id&&!RETIRED_PHONE_CORE.has(id)&&id!==FALLBACK);
  return freeze({
    ...base,
    id:PREMIER,
    label:'Premier Phone Pack',
    target:'12 GB RAM · modern Android-class WebGPU',
    storage:'About 6.9 GB phone core; legacy ONNX/Q2 files are compatibility-only',
    estimatedBytes:PERFORMANCE_CORE_BYTES,
    primaryModel:FAST_E2,
    deepModel:FAST_E4,
    fallbackModel:FALLBACK,
    summary:'Phone-local Gemma 4 ladder using Google LiteRT-LM WebGPU binaries: E2B for fast work, E4B for deeper work, one Gemma engine resident at a time, plus the CPU-safe fallback and local speech stack.',
    generative:freeze([FAST_E2,FAST_E4,FALLBACK,...prior].filter((id,index,rows)=>rows.indexOf(id)===index)),
    installOrder:freeze(order),
    phonePerformanceCore:freeze([FAST_E2,FAST_E4]),
    legacyCompatibilityModels:freeze([LEGACY_E2,LEGACY_E4,Q2_E2,Q2_E4]),
    optimizedRuntime:'google-litert-lm-webgpu',
    oneEngineAtATime:true,
    q4CoreModels:freeze([]),
    q2ExtensionsOptional:true
  });
}
function migrationPack(base){
  const missing=missingFastIds();
  return freeze({
    ...performancePack(base),
    label:'Premier Phone Pack · phone performance core update',
    estimatedBytes:missing.reduce((sum,id)=>sum+(FAST_BYTES[id]||0),0),
    generative:freeze(missing),
    specialized:freeze([]),
    installOrder:freeze(missing),
    migrationOnly:true,
    missingPerformanceModels:freeze(missing)
  });
}
function layeredBase(api){
  let base=api;
  try{base=packExtension()?.patchPackManager?.(base)||base}catch{}
  try{base=deepExtension()?.patchPackManager?.(base)||base}catch{}
  return base;
}
function patchPackManager(api){
  const base=layeredBase(api);
  if(!base?.byId)return base;
  if(base.__civweaveGemma4PhonePerformanceCoreV1)return base;
  const baseById=base.byId.bind(base),baseStatus=base.status?.bind(base),baseUse=base.use?.bind(base),baseRemove=base.remove?.bind(base),baseCatalogue=base.catalogue?.bind(base);
  const rawPremier=baseById(PREMIER)||{};
  const byId=id=>{
    if(id!==PREMIER)return baseById(id);
    return existingPremier()&&missingFastIds().length?migrationPack(rawPremier):performancePack(rawPremier);
  };
  const status=async id=>{
    if(id!==PREMIER)return baseStatus?baseStatus(id):null;
    const pack=performancePack(rawPremier),components=[];
    for(const componentId of pack.installOrder){
      try{components.push({id:componentId,...await manager()?.status?.(componentId)})}
      catch(error){components.push({id:componentId,available:false,error:String(error?.message||error)})}
    }
    const available=components.length>0&&components.every(row=>row.available);
    const installedBytes=components.reduce((sum,row)=>sum+Number(row?.state?.bytesDownloaded||row?.bytes||0),0);
    if(available){
      writePackState({status:'ready',phase:'ready',percent:100,error:'',primaryModel:FAST_E2,deepModel:FAST_E4,selectedModel:packStates()[PREMIER]?.selectedModel||FAST_E2,installedBytes,installedAt:packStates()[PREMIER]?.installedAt||new Date().toISOString(),optimizedRuntime:'google-litert-lm-webgpu'});
    }else if(existingPremier()&&missingFastIds().length){
      writePackState({status:'core-update-required',phase:'gemma4-litert-performance-core-required',error:'',primaryModel:FAST_E2,deepModel:FAST_E4,missingPerformanceModels:missingFastIds()});
    }
    return{id:PREMIER,label:pack.label,available,installed:available,components,installedBytes,state:packStates()[PREMIER]||null};
  };
  const use=async id=>{
    if(id!==PREMIER)return baseUse?baseUse(id):null;
    const checked=await status(PREMIER);
    if(!checked.available)throw Object.assign(new Error('Premier Phone Pack needs its LiteRT phone-performance core before local Gemma 4 can run at phone speed. Open Local models and choose Complete phone performance core.'),{code:'LOCAL_PHONE_PERFORMANCE_CORE_REQUIRED',missingModels:missingFastIds()});
    manager()?.select?.(FAST_E2);
    const pack=performancePack(rawPremier);
    writePackState({status:'ready',phase:'ready',selectedModel:FAST_E2,primaryModel:FAST_E2,deepModel:FAST_E4,lastUsedAt:new Date().toISOString(),optimizedRuntime:'google-litert-lm-webgpu'});
    emit('civweave:gemma4-phone-performance-selected',{model:FAST_E2,deepModel:FAST_E4});
    return{pack,model:FAST_E2,deepModel:FAST_E4};
  };
  const remove=async id=>{
    if(id!==PREMIER)return baseRemove?baseRemove(id):false;
    for(const modelId of [FAST_E2,FAST_E4])try{await manager()?.remove?.(modelId)}catch{}
    return baseRemove?baseRemove(PREMIER):true;
  };
  const catalogue=()=>{
    const rows=baseCatalogue?baseCatalogue():Object.values(base.packs||{});
    return rows.map(row=>row?.id===PREMIER?byId(PREMIER):row);
  };
  return freeze({
    ...base,
    packs:freeze({...(base.packs||{}),[PREMIER]:performancePack(rawPremier)}),
    byId,status,use,remove,catalogue,
    __civweaveGemma4PhonePerformanceCoreV1:true,
    gemma4CoreModel:FAST_E2,
    gemma4DeepModel:FAST_E4,
    gemma4PhonePerformanceCore:freeze([FAST_E2,FAST_E4]),
    gemma4LegacyCompatibilityModels:freeze([LEGACY_E2,LEGACY_E4,Q2_E2,Q2_E4]),
    optimizedRuntime:'google-litert-lm-webgpu',
    oneEngineAtATime:true
  });
}
function watchPacks(){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,PACKS_KEY);
  if(descriptor&&!descriptor.configurable){
    try{const current=globalThis[PACKS_KEY],next=patchPackManager(current);if(next!==current)globalThis[PACKS_KEY]=next}catch{}
    return Boolean(globalThis[PACKS_KEY]?.__civweaveGemma4PhonePerformanceCoreV1);
  }
  let value=patchPackManager(globalThis[PACKS_KEY]);
  try{
    Object.defineProperty(globalThis,PACKS_KEY,{configurable:true,enumerable:true,get(){return value},set(next){value=patchPackManager(next)}});
    return true;
  }catch{
    try{globalThis[PACKS_KEY]=patchPackManager(globalThis[PACKS_KEY])}catch{}
    return Boolean(globalThis[PACKS_KEY]?.__civweaveGemma4PhonePerformanceCoreV1);
  }
}
function applyAuthority(){
  const registryReady=watchRegistry();
  const packsReady=watchPacks();
  return{registryReady,packsReady,ready:Boolean(registryReady&&packsReady)};
}
let authorityTimer=0;
function scheduleAuthorityReassert(){
  clearTimeout(authorityTimer);
  const waits=[0,30,120,320,700,1150,1500];let index=0;
  const run=()=>{
    const state=applyAuthority();
    index+=1;
    if(index<waits.length)authorityTimer=setTimeout(run,waits[index]);
    else emit('civweave:gemma4-phone-performance-authority-stable',{...state,resumeSafe:true});
  };
  queueMicrotask(run);
}
function activate(){
  const state=applyAuthority();
  try{deepExtension()?.scheduleDecorate?.()}catch{}
  try{fastExtension()?.bindUpgradeUi?.()}catch{}
  scheduleDecorate();
  scheduleAuthorityReassert();
  const registry=globalThis[REGISTRY_KEY],missing=registry?.gemma4PhonePerformanceRegistryMissing||[];
  emit('civweave:gemma4-phone-performance-authority',{...state,registryComplete:Boolean(registry?.gemma4PhonePerformanceRegistryComplete),missing,resumeSafe:true});
  return state.ready;
}
async function completePerformanceCore(){
  activate();
  const bridge=browser();
  if(!bridge?.queue)throw new Error('The browser AI pack download bridge is not ready.');
  writePackState({status:'browser-ready',phase:'gemma4-litert-performance-core-required',percent:0,error:'',errorCode:'',coreMigration:true,primaryModel:FAST_E2,deepModel:FAST_E4,missingPerformanceModels:missingFastIds()});
  return bridge.queue(PREMIER);
}
function selectedLegacyNeedsPerformance(){
  const pick=manager()?.selection?.();
  return Boolean(pick?.active&&[LEGACY_E2,LEGACY_E4].includes(pick.id)&&existingPremier()&&missingFastIds().includes(pick.id===LEGACY_E4?FAST_E4:FAST_E2));
}
function assertSelectedPerformance(){
  applyAuthority();
  const registry=globalThis[REGISTRY_KEY],registryMissing=registry?.gemma4PhonePerformanceRegistryMissing||[];
  if(registryMissing.length)throw Object.assign(new Error(`Gemma 4 phone runtime registration is incomplete: ${registryMissing.join(', ')}.`),{code:'LOCAL_PHONE_MODEL_REGISTRY_INCOMPLETE',missingModels:[...registryMissing]});
  if(!selectedLegacyNeedsPerformance())return true;
  const pick=manager()?.selection?.(),target=pick?.id===LEGACY_E4?FAST_E4:FAST_E2;
  throw Object.assign(new Error(`${pick?.id===LEGACY_E4?'Gemma 4 E4B':'Gemma 4 E2B'} is selected, but its LiteRT phone-performance model is not installed. Open Local models and choose Complete phone performance core.`),{code:'LOCAL_PHONE_PERFORMANCE_CORE_REQUIRED',selectedModel:pick?.id,requiredModel:target,missingModels:missingFastIds()});
}
function decorateSettings(){
  const panel=document.getElementById('cw-local-ai-v324');if(!panel)return false;
  const card=panel.querySelector(`[data-pack-id="${PREMIER}"]`);if(!card)return false;
  const missing=missingFastIds(),signature=JSON.stringify({missing,pack:packStates()[PREMIER]?.status||''});
  if(card.dataset.gemma4PhonePerformance===signature)return true;
  const paragraphs=[...card.children].filter(node=>node.tagName==='P');
  if(paragraphs[0])paragraphs[0].textContent='Gemma 4 E2B and E4B use the Web-optimized LiteRT-LM phone binaries. Generic ONNX/Q4 files are compatibility fallbacks, not the primary phone runtime.';
  if(paragraphs[1])paragraphs[1].innerHTML='<b>Target:</b> 12 GB RAM · modern Android WebGPU · one Gemma engine resident at a time';
  if(paragraphs[2])paragraphs[2].innerHTML='<b>Storage:</b> ~6.9 GB phone core · existing ONNX/Q2 files may be kept or removed separately';
  if(existingPremier()&&missing.length){
    const actions=[...card.querySelectorAll('.cw-local-actions')].find(node=>!node.closest('[data-gemma4-q2-extensions]'));
    if(actions)actions.innerHTML='<button type="button" data-gemma4-performance-complete>Complete phone performance core</button>';
    let note=card.querySelector('[data-gemma4-performance-note]');
    if(!note){note=document.createElement('p');note.dataset.gemma4PerformanceNote='';note.className='cw-local-meta';card.append(note)}
    const labels=missing.map(id=>id===FAST_E2?'E2B LiteRT 2.0 GB':'E4B LiteRT 3.0 GB').join(' + ');
    note.textContent=`Performance update required: ${labels}. Your existing model files are kept; only the missing phone-optimized binaries download.`;
  }
  card.dataset.gemma4PhonePerformance=signature;
  return true;
}
let decorateTimer=0;
function scheduleDecorate(){
  clearTimeout(decorateTimer);const waits=[30,120,320,700,1200];let index=0;
  const run=()=>{decorateSettings();index+=1;if(index<waits.length)decorateTimer=setTimeout(run,waits[index])};
  decorateTimer=setTimeout(run,waits[0]);
}
function onClick(event){
  const button=event.target?.closest?.('[data-gemma4-performance-complete]');
  if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();button.disabled=true;
  void completePerformanceCore().catch(error=>emit('civweave:gemma4-phone-performance-error',{message:String(error?.message||error)})).finally(()=>{button.disabled=false;scheduleDecorate()});
}
document.addEventListener('click',onClick,true);
for(const name of ['civweave:settings-opened','civweave:settings-local-route-ready','civweave:local-model-runtime-ready','civweave:local-model-download-progress','civweave:local-model-downloaded','civweave:local-model-pack-progress','civweave:local-model-pack-selected','civweave:guide-loader-reset','pageshow'])addEventListener(name,()=>{scheduleAuthorityReassert();scheduleDecorate()});
activate();

globalThis.CivweaveGemma4PhonePerformanceCoreV1=freeze({
  version:VERSION,
  packId:PREMIER,
  primaryModel:FAST_E2,
  deepModel:FAST_E4,
  legacyModels:freeze([LEGACY_E2,LEGACY_E4,Q2_E2,Q2_E4]),
  performanceBytes:freeze({...FAST_BYTES}),
  patchRegistry,
  watchRegistry,
  patchPackManager,
  watchPacks,
  applyAuthority,
  scheduleAuthorityReassert,
  activate,
  completePerformanceCore,
  decorateSettings,
  missingFastIds,
  selectedLegacyNeedsPerformance,
  assertSelectedPerformance,
  optimizedRuntime:'google-litert-lm-webgpu',
  registryAuthority:true,
  packAuthority:true,
  resumeSafeAuthority:true,
  oneEngineAtATime:true,
  explicitMigration:true
});
})();