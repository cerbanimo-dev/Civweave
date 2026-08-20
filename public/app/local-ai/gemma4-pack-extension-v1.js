(()=>{
'use strict';

const VERSION='1.0.0-gemma4-pack-extension-v1';
const REGISTRY_KEY='CivweaveLocalModelRegistryV266';
const PACKS_KEY='CivweaveLocalModelPacksV1';
const SETTINGS_KEY='CivweaveSettingsLocalRouteV323';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const Q4_ID='gemma4-e2b-it-q4f16';
const Q4_REVISION='9f4bef82ea6e296bc69f8a2f5939f73af81b07a6';
const Q2_E2='gemma4-e2b-it-q2f16-mobile';
const Q2_E4='gemma4-e4b-it-q2f16-mobile';
const Q2_IDS=Object.freeze([Q2_E2,Q2_E4]);
const PREMIER='premier-phone';
const CORE_BYTES=5_012_000_000;
const Q4_BYTES=3_135_000_000;
const EXTENSIONS=Object.freeze([
  Object.freeze({id:Q2_E2,label:'Gemma 4 E2B · Q2F16 mobile',bytes:2_335_000_000}),
  Object.freeze({id:Q2_E4,label:'Gemma 4 E4B · Q2F16 mobile',bytes:3_365_000_000})
]);

if(globalThis.CivweaveGemma4PackExtensionV1?.version===VERSION)return;

const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const freeze=value=>Object.freeze(value);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const artifact=(path,minBytes,required=true,sizeBytes=0)=>freeze({path,minBytes,required,revision:'',sizeBytes:Math.max(0,Number(sizeBytes)||0)});
const downloadsState=()=>parse(localStorage.getItem(DOWNLOADS_KEY),{});
const packStates=()=>parse(localStorage.getItem(PACK_STATE_KEY),{});
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const browser=()=>globalThis.CivweaveBrowserPackDownloadV1;
const settings=()=>globalThis[SETTINGS_KEY];

function q4Spec(registry){
  const existing=registry?.byId?.(Q4_ID);
  const legacy=registry?.byId?.(Q2_E2)||registry?.models?.find?.(row=>row?.id===Q2_E2)||{};
  return freeze({
    ...legacy,
    ...(existing||{}),
    id:Q4_ID,
    label:'Gemma 4 E2B IT',
    tier:'Gemma 4 Core',
    hardwareTier:'10+ GB RAM · WebGPU fp16',
    status:'device-test',
    installable:true,
    recommended:'phone-fast',
    provider:'huggingface',
    repo:'onnx-community/gemma-4-E2B-it-ONNX',
    revision:Q4_REVISION,
    task:'text-generation',
    dtype:'q4f16',
    device:'webgpu',
    runtime:'transformers-js-v4',
    runtimeAsset:legacy.runtimeAsset||'/app/vendor/transformers-v4/transformers.min.js',
    wasmRoot:legacy.wasmRoot||'/app/vendor/transformers-v4/wasm/',
    wasmChunks:freeze([...(legacy.wasmChunks||[])]),
    textOnly:true,
    requiresShaderF16:true,
    estimatedBytes:Q4_BYTES,
    license:'Apache-2.0',
    sourceModel:'google/gemma-4-E2B-it',
    preferBackground:true,
    contextWindowTokens:128_000,
    workingContextTokens:8_192,
    healthTimeoutMs:900_000,
    generation:legacy.generation||freeze({topK:64,nonThinkingTemperature:1,thinkingTemperature:1,thinkingSupported:true}),
    capabilities:legacy.capabilities||freeze({interactive:true,structuredOutput:true,agenticReasoning:true,code:true,tools:false,externalResearch:false,vision:false,audio:false,multimodal:false}),
    fallbackIds:freeze(['gemma3-1b-it-q4f16','qwen3-1.7b-q4f16','qwen3-0.6b-q4f16','smollm2-360m-instruct-q4f16','smollm2-135m-instruct-q8-wasm','qwen3-0.6b-q8-wasm']),
    packRole:'required-core',
    packId:PREMIER,
    coreVariant:'q4f16',
    optionalExtensionIds:Q2_IDS,
    artifacts:freeze([
      artifact('config.json',6_000,true),
      artifact('tokenizer.json',18_000_000,true),
      artifact('tokenizer_config.json',10_000,true),
      artifact('generation_config.json',100,true),
      artifact('chat_template.jinja',10_000,true),
      artifact('onnx/decoder_model_merged_q4f16.onnx',500_000,true),
      artifact('onnx/decoder_model_merged_q4f16.onnx_data',1_400_000_000,true),
      artifact('onnx/embed_tokens_q4f16.onnx',5_000,true),
      artifact('onnx/embed_tokens_q4f16.onnx_data',1_500_000_000,true)
    ])
  });
}
function extensionSpec(model){
  if(!model)return null;
  return freeze({
    ...model,
    installable:false,
    recommended:'',
    status:'optional-extension',
    packRole:'optional-extension',
    packId:PREMIER,
    extensionFamily:'q2f16-mobile',
    runtimeBlockedUntil:'@huggingface/transformers-js-2-bit-gather',
    reason:'Optional Q2F16 mobile extension. Keep it installed if desired; Civweave uses the Q4F16 Gemma 4 core until the browser runtime supports this graph.'
  });
}
function patchRegistry(registry){
  if(!registry?.byId||!Array.isArray(registry.models))return registry;
  if(registry.__civweaveGemma4PackCoreV1)return registry;
  const core=q4Spec(registry);
  const originals=new Map([...registry.models,...(registry.runtimeModels||[])].map(model=>[model?.id,model]));
  const legacyExtensions=Q2_IDS.map(id=>extensionSpec(originals.get(id))).filter(Boolean);
  const models=[];let inserted=false;
  for(const model of registry.models){
    if(!model||Q2_IDS.includes(model.id)||model.id===Q4_ID)continue;
    if(!inserted&&['smollm3-3b-q4f16','qwen3-4b-q4f16'].includes(model.id)){models.push(core);inserted=true}
    models.push(model);
  }
  if(!inserted)models.push(core);
  const runtimeModels=[...(registry.runtimeModels||[]).filter(model=>model&&!Q2_IDS.includes(model.id)&&model.id!==Q4_ID),...legacyExtensions];
  const map=new Map([...models,...runtimeModels].map(model=>[model.id,model]));
  const byId=id=>map.get(id)||null;
  const fallbacks=modelOrId=>{
    const model=typeof modelOrId==='string'?byId(modelOrId):byId(modelOrId?.id)||modelOrId;
    return (model?.fallbackIds||[]).map(byId).filter(Boolean);
  };
  const capable=request=>{
    let rows=[];try{rows=(registry.capable?.(request)||[]).map(model=>byId(model.id)||model).filter(model=>model&&!Q2_IDS.includes(model.id))}catch{}
    if(!rows.some(model=>model.id===Q4_ID))rows.push(core);
    return rows;
  };
  return freeze({
    ...registry,
    models:freeze(models),
    runtimeModels:freeze(runtimeModels),
    byId,
    fallbacks,
    installable:()=>models.filter(model=>model.installable),
    experimental:()=>models.filter(model=>!model.installable),
    capable,
    __civweaveGemma4PackCoreV1:true,
    gemma4PackCoreModelId:Q4_ID,
    gemma4Q2OptionalExtensions:Q2_IDS,
    gemma4Q2CoreRequired:false
  });
}
function watchGlobal(key,patch,marker){
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

function corePack(base){
  return freeze({
    ...base,
    id:PREMIER,
    label:'Premier Phone Pack',
    target:'12 GB RAM · modern Android-class WebGPU',
    storage:'About 5.0 GB core download; Q2F16 extensions are optional',
    estimatedBytes:CORE_BYTES,
    primaryModel:Q4_ID,
    deepModel:'',
    fallbackModel:'qwen3-0.6b-q8-wasm',
    summary:'Phone-local AI pack with Gemma 4 E2B Q4F16 as the runnable core, multilingual speech, and a CPU-safe fallback.',
    generative:freeze([Q4_ID,'qwen3-0.6b-q8-wasm']),
    specialized:freeze(['silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','omnilingual-asr-300m-int8','supertonic-3-tts-int8']),
    installOrder:freeze(['qwen3-0.6b-q8-wasm',Q4_ID,'silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','supertonic-3-tts-int8','omnilingual-asr-300m-int8']),
    optionalExtensions:EXTENSIONS
  });
}
function legacyPackNeedsCore(){
  const packs=packStates(),downloads=downloadsState(),state=packs[PREMIER]||{},q4=downloads[Q4_ID]||{};
  return Boolean((state.installedAt||state.status==='ready')&&q4.status!=='ready');
}
function migrationPack(base){
  const core=corePack(base);
  return freeze({...core,label:'Premier Phone Pack · Gemma 4 core update',estimatedBytes:Q4_BYTES,generative:freeze([Q4_ID]),specialized:freeze([]),installOrder:freeze([Q4_ID]),migrationOnly:true});
}
function writePackState(patch){
  const rows=packStates();rows[PREMIER]={...(rows[PREMIER]||{}),...patch,updatedAt:new Date().toISOString()};
  try{localStorage.setItem(PACK_STATE_KEY,JSON.stringify(rows))}catch{}
  return rows[PREMIER];
}
async function coreStatus(api,base){
  const pack=corePack(base),components=[];
  for(const id of pack.installOrder){
    try{components.push({id,...await api.componentStatus(id)})}catch(error){components.push({id,available:false,error:String(error?.message||error)})}
  }
  const available=components.every(row=>row.available);
  const installedBytes=components.reduce((sum,row)=>sum+Number(row.bytes||row.state?.bytesDownloaded||row.rows?.reduce?.((n,a)=>n+Number(a.bytes||0),0)||0),0);
  if(available)writePackState({status:'ready',phase:'ready',percent:100,installedBytes,installedAt:packStates()[PREMIER]?.installedAt||new Date().toISOString(),error:'',primaryModel:Q4_ID});
  return{id:PREMIER,label:pack.label,available,installed:available,components,installedBytes,state:packStates()[PREMIER]||null};
}
function patchPackManager(api){
  if(!api?.byId||api.__civweaveGemma4PackCoreV1)return api;
  const baseById=api.byId.bind(api),baseStatus=api.status?.bind(api),baseUse=api.use?.bind(api),baseRemove=api.remove?.bind(api),baseCatalogue=api.catalogue?.bind(api);
  const basePremier=baseById(PREMIER);
  const byId=id=>id===PREMIER?(legacyPackNeedsCore()?migrationPack(basePremier):corePack(basePremier)):baseById(id);
  const status=async id=>id===PREMIER?coreStatus(api,basePremier):baseStatus(id);
  const use=async id=>{
    if(id!==PREMIER)return baseUse(id);
    const checked=await coreStatus(api,basePremier);if(!checked.available)throw new Error('Premier Phone Pack needs its Gemma 4 Q4F16 core before it can be used. Choose Complete core download; your Q2F16 extension files will be kept.');
    const m=manager(),q4=await m.status(Q4_ID),fallback=await m.status('qwen3-0.6b-q8-wasm');
    const selected=q4.available?Q4_ID:(fallback.available?'qwen3-0.6b-q8-wasm':'');if(!selected)throw new Error('Premier Phone Pack has no runnable interactive model available.');
    m.select(selected);writePackState({status:'ready',selectedModel:selected,lastUsedAt:new Date().toISOString(),primaryModel:Q4_ID});
    try{dispatchEvent(new CustomEvent('civweave:local-model-pack-selected',{detail:{version:VERSION,id:PREMIER,label:basePremier.label,model:selected}}))}catch{}
    return{pack:corePack(basePremier),model:selected};
  };
  const remove=async id=>{
    if(id!==PREMIER)return baseRemove(id);
    try{await manager()?.remove?.(Q4_ID)}catch{}
    const rows=packStates();delete rows[PREMIER];try{localStorage.setItem(PACK_STATE_KEY,JSON.stringify(rows))}catch{}
    try{dispatchEvent(new CustomEvent('civweave:local-model-pack-removed',{detail:{version:VERSION,id:PREMIER,label:basePremier.label,optionalExtensionsKept:true}}))}catch{}
    return true;
  };
  const catalogue=()=>{const rows=baseCatalogue?baseCatalogue():Object.values(api.packs||{});return rows.map(row=>row?.id===PREMIER?corePack(row):row)};
  const packs={...(api.packs||{}),[PREMIER]:corePack(basePremier)};
  return freeze({...api,packs:freeze(packs),byId,status,use,remove,catalogue,__civweaveGemma4PackCoreV1:true,gemma4CoreModel:Q4_ID,q2OptionalExtensions:Q2_IDS});
}

async function ensureActionModules(){
  const api=settings();
  if(typeof api?.ensureActionModules==='function')await api.ensureActionModules();
  watchGlobal(REGISTRY_KEY,patchRegistry,'__civweaveGemma4PackCoreV1');
  watchGlobal(PACKS_KEY,patchPackManager,'__civweaveGemma4PackCoreV1');
  return Boolean(manager()&&globalThis[REGISTRY_KEY]);
}
async function extensionStatus(id){
  await ensureActionModules();
  try{return await manager().status(id)}catch{return{available:false,state:downloadsState()[id]||null}}
}
async function extensionDownload(id){
  if(!Q2_IDS.includes(id))return false;
  await ensureActionModules();
  const spec=globalThis[REGISTRY_KEY]?.byId?.(id);if(!spec)throw new Error(`The optional ${id} extension is not registered.`);
  await manager().start(id,{preferBackground:true});
  return true;
}
async function extensionRemove(id){
  if(!Q2_IDS.includes(id))return false;
  await ensureActionModules();
  const selected=manager().selection?.();
  if(selected?.active&&selected.id===id){
    const q4=await manager().status(Q4_ID).catch(()=>({available:false}));
    manager().select(q4.available?Q4_ID:null);
  }
  await manager().remove(id);
  return true;
}
async function completeCore(){
  await ensureActionModules();
  const b=browser();if(!b?.queue)throw new Error('The browser AI pack download bridge is not ready.');
  if(legacyPackNeedsCore())writePackState({status:'browser-ready',phase:'gemma4-q4-core-required',percent:0,error:'',errorCode:'',coreMigration:true});
  return b.queue(PREMIER);
}
function extensionStateCopy(id){
  const state=downloadsState()[id]||{};
  if(state.status==='ready')return'Installed · optional extension parked until its browser runtime is supported.';
  if(['downloading','finalizing'].includes(state.status))return`${state.status} · ${Math.max(0,Math.min(99,Number(state.percent||0)))}%`;
  if(state.status==='paused'||state.status==='error')return`${state.status} · ${state.error||'resume when ready'}`;
  return'Not installed · optional.';
}
function decorateSettings(){
  const panel=document.getElementById('cw-local-ai-v324');if(!panel)return false;
  for(const id of Q2_IDS){const row=panel.querySelector(`[data-model-id="${id}"]`);if(row)row.hidden=true}
  const card=panel.querySelector(`[data-pack-id="${PREMIER}"]`);if(!card)return false;
  const paragraphs=[...card.children].filter(node=>node.tagName==='P');
  if(paragraphs[0])paragraphs[0].textContent='Gemma 4 E2B Q4F16 is the required runnable core. Q2F16 mobile weights are optional extensions and are never required to use the pack.';
  if(paragraphs[1])paragraphs[1].innerHTML='<b>Target:</b> 12 GB RAM · modern Android-class WebGPU';
  if(paragraphs[2])paragraphs[2].innerHTML='<b>Storage:</b> ~5.0 GB core · Q2F16 extensions +2.3 GB / +3.4 GB';
  if(paragraphs[3])paragraphs[3].textContent='Gemma 4 E2B Q4F16 core · Qwen 3 0.6B CPU fallback · Silero · Parakeet INT8 · Omnilingual 300M INT8 · Supertonic 3';
  let extension=card.querySelector('[data-gemma4-q2-extensions]');
  if(!extension){extension=document.createElement('div');extension.dataset.gemma4Q2Extensions='';extension.className='cw-clean-note';const actions=card.querySelector('.cw-local-actions');actions?.before(extension)||card.append(extension)}
  extension.innerHTML=`<b>Optional Q2F16 mobile extension</b>${EXTENSIONS.map(row=>`<p class="cw-local-meta">${esc(row.label)} · ${(row.bytes/1e9).toFixed(1)} GB · ${esc(extensionStateCopy(row.id))}</p><div class="cw-local-actions">${downloadsState()[row.id]?.status==='ready'?`<button type="button" data-gemma4-extension-remove="${row.id}">Remove extension</button>`:`<button type="button" data-gemma4-extension-download="${row.id}">Add extension</button>`}</div>`).join('')}`;
  const q4State=downloadsState()[Q4_ID]||{};
  if(legacyPackNeedsCore()&&q4State.status!=='ready'){
    const actions=card.querySelector('.cw-local-actions:last-child');
    if(actions)actions.innerHTML='<button type="button" data-gemma4-core-complete>Complete Q4F16 core</button>';
    let note=card.querySelector('[data-gemma4-core-note]');if(!note){note=document.createElement('p');note.dataset.gemma4CoreNote='';note.className='cw-local-meta';extension.before(note)}
    note.textContent='Your existing Q2F16 files are being kept as optional extensions. Complete the Q4F16 core; no deletion or full-pack reinstall is required.';
  }
  return true;
}
async function onClick(event){
  const button=event.target?.closest?.('[data-gemma4-core-complete],[data-gemma4-extension-download],[data-gemma4-extension-remove]');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();button.disabled=true;
  try{
    if(button.hasAttribute('data-gemma4-core-complete'))await completeCore();
    else if(button.dataset.gemma4ExtensionDownload)await extensionDownload(button.dataset.gemma4ExtensionDownload);
    else if(button.dataset.gemma4ExtensionRemove)await extensionRemove(button.dataset.gemma4ExtensionRemove);
  }catch(error){try{dispatchEvent(new CustomEvent('civweave:local-model-pack-extension-error',{detail:{version:VERSION,message:String(error?.message||error)}}))}catch{};console.warn('[Civweave Gemma 4 pack]',error)}
  finally{button.disabled=false;setTimeout(decorateSettings,50)}
}

watchGlobal(REGISTRY_KEY,patchRegistry,'__civweaveGemma4PackCoreV1');
watchGlobal(PACKS_KEY,patchPackManager,'__civweaveGemma4PackCoreV1');
document.addEventListener('click',onClick,true);
const observer=new MutationObserver(()=>queueMicrotask(decorateSettings));
if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
for(const name of ['civweave:settings-opened','civweave:local-model-download-progress','civweave:local-model-downloaded','civweave:local-model-removed','civweave:local-model-pack-progress','pageshow'])addEventListener(name,()=>queueMicrotask(decorateSettings));
queueMicrotask(decorateSettings);

globalThis.CivweaveGemma4PackExtensionV1=freeze({
  version:VERSION,
  coreModelId:Q4_ID,
  premierPackId:PREMIER,
  optionalQ2ModelIds:Q2_IDS,
  patchRegistry,
  patchPackManager,
  extensionStatus,
  extensionDownload,
  extensionRemove,
  completeCore,
  decorateSettings,
  existingQ2Preserved:true,
  q2Optional:true,
  q4RequiredCore:true,
  fullReinstallRequired:false
});
})();
