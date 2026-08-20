(()=>{
'use strict';

const VERSION='1.0.0-gemma4-e4b-q4-extension-v1';
const REGISTRY_KEY='CivweaveLocalModelRegistryV266';
const PACKS_KEY='CivweaveLocalModelPacksV1';
const SETTINGS_KEY='CivweaveSettingsLocalRouteV323';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const PREMIER='premier-phone';
const E2_Q4='gemma4-e2b-it-q4f16';
const E4_Q4='gemma4-e4b-it-q4f16';
const E4_Q2='gemma4-e4b-it-q2f16-mobile';
const E4_REVISION='874c3395246e1063e6c8fcf40445bb79ea10b0f5';
const E4_Q4_BYTES=4_905_000_000;
const FULL_CORE_BYTES=9_917_000_000;
const FALLBACK='qwen3-0.6b-q8-wasm';

if(globalThis.CivweaveGemma4E4BQ4ExtensionV1?.version===VERSION)return;

const freeze=value=>Object.freeze(value);
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const artifact=(path,minBytes,required=true)=>freeze({path,minBytes,required,revision:'',sizeBytes:0});
const downloads=()=>parse(localStorage.getItem(DOWNLOADS_KEY),{});
const packStates=()=>parse(localStorage.getItem(PACK_STATE_KEY),{});
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const browser=()=>globalThis.CivweaveBrowserPackDownloadV1;
const settings=()=>globalThis[SETTINGS_KEY];
const e2Extension=()=>globalThis.CivweaveGemma4PackExtensionV1;

function e4Spec(registry){
  const existing=registry?.byId?.(E4_Q4);
  const legacy=registry?.byId?.(E4_Q2)||registry?.models?.find?.(row=>row?.id===E4_Q2)||registry?.runtimeModels?.find?.(row=>row?.id===E4_Q2)||{};
  return freeze({
    ...legacy,
    ...(existing||{}),
    id:E4_Q4,
    label:'Gemma 4 E4B IT',
    tier:'Gemma 4 Deep',
    hardwareTier:'12 GB RAM · modern Android-class WebGPU fp16',
    status:'device-test',
    installable:true,
    recommended:'phone-deep',
    provider:'huggingface',
    repo:'onnx-community/gemma-4-E4B-it-ONNX',
    revision:E4_REVISION,
    task:'text-generation',
    dtype:'q4f16',
    device:'webgpu',
    runtime:'transformers-js-v4',
    runtimeAsset:legacy.runtimeAsset||'/app/vendor/transformers-v4/transformers.min.js',
    wasmRoot:legacy.wasmRoot||'/app/vendor/transformers-v4/wasm/',
    wasmChunks:freeze([...(legacy.wasmChunks||[])]),
    textOnly:true,
    requiresShaderF16:true,
    estimatedBytes:E4_Q4_BYTES,
    license:'Apache-2.0',
    sourceModel:'google/gemma-4-E4B-it',
    preferBackground:true,
    contextWindowTokens:128_000,
    workingContextTokens:16_384,
    healthTimeoutMs:900_000,
    generation:legacy.generation||freeze({topK:64,nonThinkingTemperature:1,thinkingTemperature:1,thinkingSupported:true}),
    capabilities:legacy.capabilities||freeze({interactive:true,structuredOutput:true,agenticReasoning:true,code:true,tools:false,externalResearch:false,vision:false,audio:false,multimodal:false}),
    fallbackIds:freeze([E2_Q4,'gemma3-1b-it-q4f16','qwen3-1.7b-q4f16','qwen3-0.6b-q4f16','smollm2-360m-instruct-q4f16','smollm2-135m-instruct-q8-wasm',FALLBACK]),
    packRole:'required-core-deep',
    packId:PREMIER,
    coreVariant:'q4f16',
    optionalExtensionIds:freeze([E4_Q2]),
    artifacts:freeze([
      artifact('config.json',5_000,true),
      artifact('tokenizer.json',18_000_000,true),
      artifact('tokenizer_config.json',1_500,true),
      artifact('generation_config.json',100,true),
      artifact('chat_template.jinja',10_000,true),
      artifact('onnx/decoder_model_merged_q4f16.onnx',700_000,true),
      artifact('onnx/decoder_model_merged_q4f16.onnx_data',1_900_000_000,true),
      artifact('onnx/decoder_model_merged_q4f16.onnx_data_1',700_000_000,true),
      artifact('onnx/embed_tokens_q4f16.onnx',5_000,true),
      artifact('onnx/embed_tokens_q4f16.onnx_data',1_850_000_000,true)
    ])
  });
}

function baseRegistry(registry){
  const ext=e2Extension();
  try{return ext?.patchRegistry?.(registry)||registry}catch{return registry}
}

function patchRegistry(registry){
  const base=baseRegistry(registry);
  if(!base?.byId||!Array.isArray(base.models))return base;
  if(base.__civweaveGemma4E4BQ4V1)return base;
  const deep=e4Spec(base);
  const models=[];let inserted=false;
  for(const model of base.models){
    if(!model||model.id===E4_Q4)continue;
    models.push(model);
    if(model.id===E2_Q4){models.push(deep);inserted=true}
  }
  if(!inserted)models.push(deep);
  const runtimeModels=freeze([...(base.runtimeModels||[]).filter(model=>model?.id!==E4_Q4)]);
  const map=new Map([...models,...runtimeModels].map(model=>[model?.id,model]).filter(([id])=>id));
  const byId=id=>map.get(id)||null;
  const fallbacks=modelOrId=>{
    const model=typeof modelOrId==='string'?byId(modelOrId):byId(modelOrId?.id)||modelOrId;
    return (model?.fallbackIds||[]).map(byId).filter(Boolean);
  };
  const capable=request=>{
    let rows=[];
    try{rows=(base.capable?.(request)||[]).map(model=>byId(model.id)||model).filter(Boolean)}catch{}
    if(!rows.some(model=>model.id===E4_Q4))rows.push(deep);
    return rows;
  };
  return freeze({
    ...base,
    models:freeze(models),
    runtimeModels,
    byId,
    fallbacks,
    installable:()=>models.filter(model=>model.installable),
    experimental:()=>models.filter(model=>!model.installable),
    capable,
    __civweaveGemma4E4BQ4V1:true,
    gemma4PackDeepModelId:E4_Q4,
    gemma4DeepQ2OptionalExtension:E4_Q2
  });
}

function savedReady(id){
  const state=downloads()[id]||{};
  return state.status==='ready';
}
function existingPremier(){
  const state=packStates()[PREMIER]||{};
  return Boolean(state.installedAt||['ready','browser-ready','browser-partial','browser-queued','core-update-required'].includes(String(state.status||'')));
}
function missingCoreIds(){
  return [E2_Q4,E4_Q4].filter(id=>!savedReady(id));
}
function fullCorePack(base){
  const rawOrder=[...(base?.installOrder||[])].filter(id=>id!==E4_Q4);
  const order=[];let inserted=false;
  for(const id of rawOrder){
    order.push(id);
    if(id===E2_Q4){order.push(E4_Q4);inserted=true}
  }
  if(!inserted){
    const fallbackIndex=order.indexOf(FALLBACK);
    if(fallbackIndex>=0)order.splice(fallbackIndex+1,0,E2_Q4,E4_Q4);
    else order.unshift(E2_Q4,E4_Q4);
  }
  const generative=[E2_Q4,E4_Q4,FALLBACK,...(base?.generative||[])].filter((id,index,rows)=>id&&rows.indexOf(id)===index&&!['gemma4-e2b-it-q2f16-mobile',E4_Q2].includes(id));
  return freeze({
    ...base,
    id:PREMIER,
    label:'Premier Phone Pack',
    target:'12 GB RAM · modern Android-class WebGPU',
    storage:'About 9.9 GB core download; Q2F16 extensions are optional',
    estimatedBytes:FULL_CORE_BYTES,
    primaryModel:E2_Q4,
    deepModel:E4_Q4,
    fallbackModel:FALLBACK,
    summary:'Phone-local Gemma 4 ladder with E2B Q4F16 for fast work, E4B Q4F16 for deeper work, multilingual speech, and a CPU-safe fallback.',
    generative:freeze(generative),
    installOrder:freeze(order),
    q4CoreModels:freeze([E2_Q4,E4_Q4]),
    q2ExtensionsOptional:true
  });
}
function migrationPack(base){
  const core=fullCorePack(base),missing=missingCoreIds();
  const bytes=missing.reduce((sum,id)=>sum+(id===E4_Q4?E4_Q4_BYTES:3_135_000_000),0);
  return freeze({
    ...core,
    label:'Premier Phone Pack · Gemma 4 Q4F16 core update',
    estimatedBytes:bytes,
    generative:freeze(missing),
    specialized:freeze([]),
    installOrder:freeze(missing),
    migrationOnly:true,
    missingCoreModels:freeze(missing)
  });
}
function writePackState(patch){
  const rows=packStates();
  rows[PREMIER]={...(rows[PREMIER]||{}),...patch,updatedAt:new Date().toISOString()};
  try{localStorage.setItem(PACK_STATE_KEY,JSON.stringify(rows))}catch{}
  return rows[PREMIER];
}

function basePackManager(api){
  const ext=e2Extension();
  try{return ext?.patchPackManager?.(api)||api}catch{return api}
}
function patchPackManager(api){
  const base=basePackManager(api);
  if(!base?.byId)return base;
  if(base.__civweaveGemma4E4BQ4V1)return base;
  const baseById=base.byId.bind(base),baseStatus=base.status?.bind(base),baseUse=base.use?.bind(base),baseRemove=base.remove?.bind(base),baseCatalogue=base.catalogue?.bind(base);
  const rawPremier=baseById(PREMIER);
  const byId=id=>{
    if(id!==PREMIER)return baseById(id);
    return existingPremier()&&missingCoreIds().length?migrationPack(rawPremier):fullCorePack(rawPremier);
  };
  const status=async id=>{
    if(id!==PREMIER)return baseStatus?baseStatus(id):null;
    const baseResult=baseStatus?await baseStatus(PREMIER):{available:false,installed:false,components:[]};
    let deep={available:false};
    try{deep=await manager()?.status?.(E4_Q4)||deep}catch{}
    const available=Boolean(baseResult?.available&&deep.available);
    const components=[...(baseResult?.components||[]).filter(row=>row?.id!==E4_Q4),{id:E4_Q4,...deep}];
    if(available){
      writePackState({status:'ready',phase:'ready',percent:100,error:'',primaryModel:E2_Q4,deepModel:E4_Q4,installedAt:packStates()[PREMIER]?.installedAt||new Date().toISOString()});
    }else if(existingPremier()){
      writePackState({status:'core-update-required',phase:'gemma4-q4-core-required',primaryModel:E2_Q4,deepModel:E4_Q4,error:''});
    }
    return{...baseResult,id:PREMIER,label:'Premier Phone Pack',available,installed:available,components,state:packStates()[PREMIER]||baseResult?.state||null};
  };
  const use=async id=>{
    if(id!==PREMIER)return baseUse?baseUse(id):null;
    const checked=await status(PREMIER);
    if(!checked.available)throw new Error('Premier Phone Pack needs both Gemma 4 Q4F16 lanes before it is complete: E2B fast and E4B deep. Complete the Q4F16 core; existing Q2F16 files stay installed as optional extensions.');
    const result=baseUse?await baseUse(PREMIER):null;
    writePackState({status:'ready',selectedModel:E2_Q4,primaryModel:E2_Q4,deepModel:E4_Q4,lastUsedAt:new Date().toISOString()});
    return{...(result||{}),pack:fullCorePack(result?.pack||rawPremier),model:result?.model||E2_Q4,deepModel:E4_Q4};
  };
  const remove=async id=>{
    if(id!==PREMIER)return baseRemove?baseRemove(id):false;
    try{await manager()?.remove?.(E4_Q4)}catch{}
    return baseRemove?baseRemove(PREMIER):true;
  };
  const catalogue=()=>{
    const rows=baseCatalogue?baseCatalogue():Object.values(base.packs||{});
    return rows.map(row=>row?.id===PREMIER?fullCorePack(row):row);
  };
  const packs={...(base.packs||{}),[PREMIER]:fullCorePack(rawPremier)};
  return freeze({
    ...base,
    packs:freeze(packs),
    byId,
    status,
    use,
    remove,
    catalogue,
    __civweaveGemma4E4BQ4V1:true,
    gemma4CoreModel:E2_Q4,
    gemma4DeepModel:E4_Q4,
    q4CoreModels:freeze([E2_Q4,E4_Q4]),
    q2OptionalExtensions:freeze(['gemma4-e2b-it-q2f16-mobile',E4_Q2])
  });
}

function layerGlobal(key,patch,marker){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
  if(descriptor&&!descriptor.configurable){
    try{const current=globalThis[key],next=patch(current);if(next!==current)globalThis[key]=next}catch{}
    return Boolean(globalThis[key]?.[marker]);
  }
  let value=patch(globalThis[key]);
  try{
    Object.defineProperty(globalThis,key,{configurable:true,enumerable:true,get(){return value},set(next){value=patch(next)}});
    return true;
  }catch{
    try{globalThis[key]=patch(globalThis[key])}catch{}
    return Boolean(globalThis[key]?.[marker]);
  }
}
function activate(){
  if(!e2Extension()?.patchRegistry||!e2Extension()?.patchPackManager)return false;
  layerGlobal(REGISTRY_KEY,patchRegistry,'__civweaveGemma4E4BQ4V1');
  layerGlobal(PACKS_KEY,patchPackManager,'__civweaveGemma4E4BQ4V1');
  scheduleDecorate();
  return true;
}
async function ensureActionModules(){
  const api=settings();
  if(typeof api?.ensureActionModules==='function')await api.ensureActionModules();
  activate();
  return Boolean(manager()&&globalThis[REGISTRY_KEY]?.byId?.(E4_Q4));
}
async function completeCore(){
  await ensureActionModules();
  const b=browser();
  if(!b?.queue)throw new Error('The browser AI pack download bridge is not ready.');
  writePackState({status:'browser-ready',phase:'gemma4-q4-core-required',percent:0,error:'',errorCode:'',coreMigration:true,primaryModel:E2_Q4,deepModel:E4_Q4});
  return b.queue(PREMIER);
}

function decorateSettings(){
  const panel=document.getElementById('cw-local-ai-v324');
  if(!panel)return false;
  const card=panel.querySelector(`[data-pack-id="${PREMIER}"]`);
  if(!card)return false;
  const state=downloads(),signature=JSON.stringify({e2:state[E2_Q4]?.status||'',e4:state[E4_Q4]?.status||'',pack:packStates()[PREMIER]?.status||''});
  if(card.dataset.gemma4DeepDecoration===signature)return true;
  const paragraphs=[...card.children].filter(node=>node.tagName==='P');
  if(paragraphs[0])paragraphs[0].textContent='Gemma 4 E2B Q4F16 is the fast core and E4B Q4F16 is the deep core. Both are runnable today; Q2F16 mobile weights remain optional extensions.';
  if(paragraphs[1])paragraphs[1].innerHTML='<b>Target:</b> 12 GB RAM · modern Android-class WebGPU · one Gemma lane loaded at a time';
  if(paragraphs[2])paragraphs[2].innerHTML='<b>Storage:</b> ~9.9 GB core · Q2F16 extensions +2.3 GB / +3.4 GB';
  if(paragraphs[3])paragraphs[3].textContent='Gemma 4 E2B Q4F16 fast · Gemma 4 E4B Q4F16 deep · Qwen 3 0.6B CPU fallback · Silero · Parakeet INT8 · Omnilingual 300M INT8 · Supertonic 3';
  const missing=missingCoreIds();
  if(existingPremier()&&missing.length){
    const actions=[...card.querySelectorAll('.cw-local-actions')].find(node=>!node.closest('[data-gemma4-q2-extensions]'));
    if(actions)actions.innerHTML='<button type="button" data-gemma4-core-complete>Complete Q4F16 core</button>';
    let note=card.querySelector('[data-gemma4-core-note]');
    const extension=card.querySelector('[data-gemma4-q2-extensions]');
    if(!note){note=document.createElement('p');note.dataset.gemma4CoreNote='';note.className='cw-local-meta';extension?.before(note)||card.append(note)}
    const labels=missing.map(id=>id===E2_Q4?'E2B Q4F16':'E4B Q4F16').join(' + ');
    note.textContent=`Your existing Q2F16 files are being kept as optional extensions. Complete ${labels}; no deletion or full-pack reinstall is required.`;
  }
  card.dataset.gemma4DeepDecoration=signature;
  return true;
}
let decorateTimer=0;
function scheduleDecorate(){
  clearTimeout(decorateTimer);
  const waits=[30,120,320,700,1100];let index=0;
  const run=()=>{decorateSettings();index+=1;if(index<waits.length)decorateTimer=setTimeout(run,waits[index])};
  decorateTimer=setTimeout(run,waits[0]);
}
let activationTimer=0;
function scheduleActivate(){
  clearTimeout(activationTimer);
  const waits=[0,25,90,220,520,1000];let index=0;
  const run=()=>{if(activate())return;index+=1;if(index<waits.length)activationTimer=setTimeout(run,waits[index])};
  activationTimer=setTimeout(run,waits[0]);
}
async function handleButton(button){
  button.disabled=true;
  try{
    if(button.hasAttribute('data-gemma4-core-complete'))await completeCore();
    else if(button.dataset.gemma4ExtensionDownload)await e2Extension()?.extensionDownload?.(button.dataset.gemma4ExtensionDownload);
    else if(button.dataset.gemma4ExtensionRemove)await e2Extension()?.extensionRemove?.(button.dataset.gemma4ExtensionRemove);
  }catch(error){
    try{dispatchEvent(new CustomEvent('civweave:local-model-pack-extension-error',{detail:{version:VERSION,message:String(error?.message||error)}}))}catch{}
    console.warn('[Civweave Gemma 4 E4B Q4]',error);
  }finally{
    button.disabled=false;
    activate();
    scheduleDecorate();
  }
}
function onDocumentClick(event){
  const button=event.target?.closest?.('[data-gemma4-core-complete],[data-gemma4-extension-download],[data-gemma4-extension-remove]');
  if(button){event.preventDefault();event.stopImmediatePropagation();void handleButton(button);return}
  if(event.target?.closest?.('[data-settings-tab="local-models"]')){scheduleActivate();scheduleDecorate()}
}

document.addEventListener('click',onDocumentClick,true);
for(const name of ['civweave:settings-opened','civweave:local-model-download-progress','civweave:local-model-downloaded','civweave:local-model-removed','civweave:local-model-pack-progress','pageshow']){
  addEventListener(name,()=>{scheduleActivate();scheduleDecorate()});
}
scheduleActivate();

globalThis.CivweaveGemma4E4BQ4ExtensionV1=freeze({
  version:VERSION,
  modelId:E4_Q4,
  repo:'onnx-community/gemma-4-E4B-it-ONNX',
  revision:E4_REVISION,
  estimatedBytes:E4_Q4_BYTES,
  primaryModelId:E2_Q4,
  deepModelId:E4_Q4,
  optionalQ2ModelId:E4_Q2,
  patchRegistry,
  patchPackManager,
  activate,
  completeCore,
  decorateSettings,
  scheduleDecorate,
  q4RequiredCore:true,
  q2Optional:true,
  textOnly:true,
  renderLoopSafe:true,
  mutationObserver:false
});
})();
