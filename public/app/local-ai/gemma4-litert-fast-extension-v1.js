(()=>{
'use strict';
const VERSION='1.1.1-gemma4-litert-fast-extension-v1-browser-handoff-guard';
const REGISTRY_KEY='CivweaveLocalModelRegistryV266';
const RUNTIME_ROOT='/app/vendor/litert-lm/';
const RUNTIME_MANIFEST=`${RUNTIME_ROOT}stage-manifest.json`;
const RUNTIME_CACHE='civweave-litert-lm-runtime-v1';
const UPGRADE_ID='cw-gemma4-litert-fast-upgrade-v1';
const BROWSER_HANDOFF_SRC='/app/local-ai/gemma4-browser-pack-coherence-v1.js?v=1.0.1-status-sync';
const PREMIER='premier-phone';
const MODELS=Object.freeze({
  e2: Object.freeze({
    id:'gemma4-e2b-it-litert-web',
    legacyQ4Id:'gemma4-e2b-it-q4f16',
    legacyQ2Id:'gemma4-e2b-it-q2f16-mobile',
    label:'Gemma 4 E2B IT · LiteRT Fast',
    tier:'Gemma 4 Fast',
    hardwareTier:'8+ GB RAM · modern Android WebGPU',
    recommended:'phone-fast',
    repo:'litert-community/gemma-4-E2B-it-litert-lm',
    revision:'73d35ec36cf24347ab4eec1a46f0aafbb9c3a89d',
    artifact:'gemma-4-E2B-it-web.litertlm',
    artifactBytes:2_008_432_640,
    minBytes:2_000_000_000,
    sha256:'3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
    sourceModel:'google/gemma-4-E2B-it',
    workingContextTokens:4_096,
    fallbackIds:Object.freeze(['gemma4-e2b-it-q4f16','gemma4-e2b-it-q2f16-mobile','gemma3-1b-it-q4f16','qwen3-1.7b-q4f16','qwen3-0.6b-q4f16','qwen3-0.6b-q8-wasm'])
  }),
  e4: Object.freeze({
    id:'gemma4-e4b-it-litert-web',
    legacyQ4Id:'gemma4-e4b-it-q4f16',
    legacyQ2Id:'gemma4-e4b-it-q2f16-mobile',
    label:'Gemma 4 E4B IT · LiteRT Fast',
    tier:'Gemma 4 Deep',
    hardwareTier:'12 GB RAM · modern Android WebGPU',
    recommended:'phone-deep',
    repo:'litert-community/gemma-4-E4B-it-litert-lm',
    revision:'4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4',
    artifact:'gemma-4-E4B-it-web.litertlm',
    artifactBytes:2_969_059_328,
    minBytes:2_950_000_000,
    sha256:'3904d826d5dddd25ea173e85204caec09e68ba038116e9b992b69cbdc94f57a0',
    sourceModel:'google/gemma-4-E4B-it',
    workingContextTokens:4_096,
    fallbackIds:Object.freeze(['gemma4-e4b-it-q4f16','gemma4-e4b-it-q2f16-mobile','gemma4-e2b-it-litert-web','gemma4-e2b-it-q4f16','gemma3-1b-it-q4f16','qwen3-1.7b-q4f16','qwen3-0.6b-q4f16','qwen3-0.6b-q8-wasm'])
  })
});
const BY_ID=new Map(Object.values(MODELS).map(model=>[model.id,model]));
const FAST_IDS=Object.freeze([...BY_ID.keys()]);
const LEGACY_IDS=Object.freeze(Object.values(MODELS).flatMap(model=>[model.legacyQ4Id,model.legacyQ2Id]));
if(globalThis.CivweaveGemma4LiteRTFastExtensionV1?.version===VERSION)return;
const freeze=value=>Object.freeze(value);
let primeFlight=null,primed=false,uiObserver=null,handoffFlight=null;
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}};
const fmt=bytes=>`${(Number(bytes||0)/1e9).toFixed(1)} GB`;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function definition(id){return BY_ID.get(id)||null}
function browserHandoff(){return globalThis.CivweaveGemma4BrowserPackCoherenceV1||null}
function handoffReady(){return Boolean(browserHandoff()?.startModelDownload&&browserHandoff()?.startPair)}
function directDownloadUrl(model){
  const url=new URL(`https://huggingface.co/${model.repo}/resolve/${model.revision}/${model.artifact}`);
  url.searchParams.set('download','true');
  return url.href;
}
async function ensureBrowserHandoff(){
  if(handoffReady())return browserHandoff();
  if(handoffFlight)return handoffFlight;
  handoffFlight=(async()=>{
    try{await globalThis.CivweaveModelSettingsControllerV173?.ensureGemma4Pack?.()}catch{}
    if(handoffReady())return browserHandoff();
    return new Promise((resolve,reject)=>{
      const target=new URL(BROWSER_HANDOFF_SRC,location.href),path=target.pathname;
      let script=[...document.scripts].find(row=>{try{return new URL(row.src,location.href).pathname===path}catch{return false}});
      const finish=()=>handoffReady()?resolve(browserHandoff()):reject(new Error('The browser-managed Gemma 4 download layer loaded without becoming ready.'));
      if(script&&!handoffReady())try{script.remove()}catch{}
      if(handoffReady()){resolve(browserHandoff());return}
      script=document.createElement('script');
      script.src=`${BROWSER_HANDOFF_SRC}&cwGemma4FastHandoff=${Date.now()}`;
      script.async=false;
      script.dataset.civweaveGemma4BrowserHandoff='';
      script.onload=finish;
      script.onerror=()=>reject(new Error('The browser-managed Gemma 4 download layer could not load.'));
      document.head?.append(script);
    });
  })().finally(()=>{handoffFlight=null});
  return handoffFlight;
}
function legacyFor(registry,model){
  return registry?.byId?.(model.legacyQ4Id)||registry?.byId?.(model.legacyQ2Id)||{};
}
function fastSpec(registry,model){
  const legacy=legacyFor(registry,model);
  return freeze({
    ...legacy,
    id:model.id,
    label:model.label,
    tier:model.tier,
    hardwareTier:model.hardwareTier,
    status:'device-test',
    installable:true,
    recommended:model.recommended,
    provider:'huggingface',
    repo:model.repo,
    revision:model.revision,
    task:'text-generation',
    dtype:'litert-web',
    device:'webgpu',
    runtime:'litert-lm-web',
    runtimeAsset:'/app/vendor/litert-lm/dist/index.js',
    wasmRoot:'/app/vendor/litert-lm/wasm/',
    wasmChunks:freeze([]),
    textOnly:true,
    requiresShaderF16:false,
    estimatedBytes:model.artifactBytes,
    license:'Apache-2.0',
    sourceModel:model.sourceModel,
    preferBackground:true,
    contextWindowTokens:128_000,
    workingContextTokens:model.workingContextTokens,
    healthTimeoutMs:600_000,
    generation:freeze({topK:64,topP:.95,nonThinkingTemperature:1,thinkingTemperature:1,thinkingSupported:true}),
    capabilities:legacy.capabilities||freeze({interactive:true,structuredOutput:true,agenticReasoning:true,code:true,tools:false,externalResearch:false,vision:false,audio:false,multimodal:false}),
    fallbackIds:model.fallbackIds,
    accelerationFor:model.legacyQ4Id,
    accelerationAliases:freeze([model.legacyQ4Id,model.legacyQ2Id]),
    optimizedRuntime:'google-litert-lm-webgpu',
    artifactSha256:model.sha256,
    phoneMemoryProfile:model===MODELS.e4?'12gb-deep':'8gb-plus-fast',
    artifacts:freeze([freeze({path:model.artifact,minBytes:model.minBytes,required:true,revision:model.revision,sizeBytes:model.artifactBytes,sha256:model.sha256})])
  });
}
function patchRegistry(registry){
  if(!registry?.byId||!Array.isArray(registry.models))return registry;
  if(registry.__civweaveGemma4LiteRTDualPhoneV1)return registry;
  const specs=Object.values(MODELS).map(model=>fastSpec(registry,model));
  const specsById=new Map(specs.map(spec=>[spec.id,spec]));
  const rows=[];
  const inserted=new Set();
  const insertBefore=model=>{
    for(const def of Object.values(MODELS)){
      if(inserted.has(def.id))continue;
      if(model?.id===def.legacyQ4Id||model?.id===def.legacyQ2Id||new RegExp(`^gemma4-${def===MODELS.e2?'e2b':'e4b'}`,'i').test(String(model?.id||''))){
        rows.push(specsById.get(def.id));inserted.add(def.id);
      }
    }
  };
  for(const model of registry.models){
    if(!model||FAST_IDS.includes(model.id))continue;
    insertBefore(model);
    rows.push(model);
  }
  for(const spec of specs)if(!inserted.has(spec.id)){rows.push(spec);inserted.add(spec.id)}
  const runtimeModels=[...(registry.runtimeModels||[]).filter(model=>model&&!FAST_IDS.includes(model.id))];
  const map=new Map([...rows,...runtimeModels].map(model=>[model.id,model]));
  const byId=id=>map.get(id)||null;
  const originalFallbacks=typeof registry.fallbacks==='function'?registry.fallbacks.bind(registry):null;
  const fallbacks=modelOrId=>{
    const model=typeof modelOrId==='string'?byId(modelOrId):byId(modelOrId?.id)||modelOrId;
    const def=definition(model?.id);
    if(def)return def.fallbackIds.map(byId).filter(Boolean);
    let prior=[];try{prior=originalFallbacks?.(modelOrId)||[]}catch{}
    return prior.map(item=>byId(item?.id)||item).filter(Boolean);
  };
  const originalCapable=typeof registry.capable==='function'?registry.capable.bind(registry):null;
  const capable=request=>{
    let prior=[];try{prior=originalCapable?.(request)||[]}catch{}
    const mapped=prior.map(item=>byId(item?.id)||item).filter(Boolean);
    const hasGemma=mapped.some(item=>/gemma4|gemma-4/i.test(`${item.id||''} ${item.repo||''}`));
    if(hasGemma){
      for(const spec of [...specs].reverse())if(!mapped.some(item=>item.id===spec.id))mapped.unshift(spec);
    }
    return mapped;
  };
  const originalCpuFallback=typeof registry.cpuFallback==='function'?registry.cpuFallback.bind(registry):null;
  const cpuFallback=modelOrId=>{
    const model=typeof modelOrId==='string'?byId(modelOrId):modelOrId;
    const def=definition(model?.id);
    if(def){
      const legacy=byId(def.legacyQ4Id)||byId(def.legacyQ2Id);
      try{return originalCpuFallback?.(legacy)||null}catch{return null}
    }
    try{return originalCpuFallback?.(modelOrId)||null}catch{return null}
  };
  return freeze({
    ...registry,
    models:freeze(rows),
    runtimeModels:freeze(runtimeModels),
    byId,
    fallbacks,
    capable,
    cpuFallback,
    installable:()=>rows.filter(model=>model.installable),
    experimental:()=>rows.filter(model=>!model.installable),
    __civweaveGemma4LiteRTFastV1:true,
    __civweaveGemma4LiteRTDualPhoneV1:true,
    gemma4LiteRTFastModelId:MODELS.e2.id,
    gemma4LiteRTFastModelIds:FAST_IDS,
    gemma4LiteRTAccelerationFor:MODELS.e2.legacyQ4Id,
    gemma4LiteRTAccelerationMap:freeze(Object.fromEntries(Object.values(MODELS).map(model=>[model.legacyQ4Id,model.id]))),
    gemma4LiteRTRuntime:'0.14.0',
    gemma4LiteRTArtifactRevision:MODELS.e2.revision,
    gemma4LiteRTArtifactRevisions:freeze(Object.fromEntries(Object.values(MODELS).map(model=>[model.id,model.revision])))
  });
}
function watch(){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,REGISTRY_KEY);
  if(descriptor&&!descriptor.configurable){
    try{const current=globalThis[REGISTRY_KEY],next=patchRegistry(current);if(next!==current)globalThis[REGISTRY_KEY]=next}catch{}
    return Boolean(globalThis[REGISTRY_KEY]?.__civweaveGemma4LiteRTDualPhoneV1);
  }
  let value=patchRegistry(globalThis[REGISTRY_KEY]);
  try{
    Object.defineProperty(globalThis,REGISTRY_KEY,{configurable:true,enumerable:true,get(){return value},set(next){value=patchRegistry(next)}});
    return true;
  }catch{
    try{globalThis[REGISTRY_KEY]=patchRegistry(globalThis[REGISTRY_KEY])}catch{}
    return Boolean(globalThis[REGISTRY_KEY]?.__civweaveGemma4LiteRTDualPhoneV1);
  }
}
async function status(id=MODELS.e2.id){try{return await globalThis.CivweaveLocalModelDownloadV266?.status?.(id)}catch{return{available:false}}}
async function cacheRuntimeUrl(cache,url){
  const key=new Request(new URL(url,location.href).href,{method:'GET'});
  const existing=await cache.match(key,{ignoreSearch:true});if(existing?.ok)return true;
  const response=await fetch(key,{cache:'no-store',credentials:'same-origin'});
  if(!response.ok||/text\/html/i.test(String(response.headers.get('content-type')||'')))throw new Error(`${new URL(key.url).pathname} could not be cached for offline LiteRT use.`);
  await cache.put(key,response.clone());return true;
}
async function primeRuntime({force=false}={}){
  if(primed&&!force)return true;if(primeFlight)return primeFlight;
  primeFlight=(async()=>{
    const cache=await caches.open(RUNTIME_CACHE);
    const manifestResponse=await fetch(RUNTIME_MANIFEST,{cache:'no-store',credentials:'same-origin'});
    if(!manifestResponse.ok)throw new Error(`LiteRT runtime manifest returned HTTP ${manifestResponse.status}.`);
    const manifest=await manifestResponse.clone().json();
    if(manifest?.schema!=='civweave.litert-lm-web-stage.v1'||!Array.isArray(manifest.files)||!manifest.files.length)throw new Error('LiteRT runtime manifest is incomplete.');
    await cache.put(new Request(new URL(RUNTIME_MANIFEST,location.href).href),manifestResponse);
    const files=manifest.files.map(name=>`${RUNTIME_ROOT}${String(name).replace(/^\/+/, '')}`).filter(url=>url!==RUNTIME_MANIFEST);
    let cached=0;
    for(let offset=0;offset<files.length;offset+=4){
      const batch=files.slice(offset,offset+4);
      await Promise.all(batch.map(async url=>{await cacheRuntimeUrl(cache,url);cached+=1}));
      emit('civweave:gemma4-litert-runtime-progress',{cached,total:files.length});
    }
    primed=true;emit('civweave:gemma4-litert-runtime-ready',{cached,total:files.length,cache:RUNTIME_CACHE});return true;
  })().catch(error=>{primed=false;emit('civweave:gemma4-litert-runtime-failed',{message:String(error?.message||error)});throw error}).finally(()=>{primeFlight=null});
  return primeFlight;
}
async function download(id=MODELS.e2.id,{onProgress,button}={}){
  const def=definition(id);if(!def)throw new Error(`Unknown Gemma 4 LiteRT model: ${id}`);
  if(!watch())throw new Error('The local model registry is not ready.');
  const current=await status(id);
  if(current?.available){void primeRuntime().catch(()=>null);return current}
  const handoff=await ensureBrowserHandoff();
  if(typeof handoff?.startModelDownload!=='function')throw new Error('Gemma 4 requires the browser-managed download/import flow on this device.');
  const control=button||document.querySelector(`[data-litert-fast-download="${id}"]`)||{disabled:false,textContent:''};
  try{onProgress?.({model:def,phase:'browser-handoff',message:`Opening browser download for ${def.label}.`})}catch{}
  return handoff.startModelDownload(id,control);
}
async function downloadPhonePair({onProgress,button}={}){
  const handoff=await ensureBrowserHandoff();
  if(typeof handoff?.startPair!=='function')throw new Error('Gemma 4 requires the browser-managed download/import flow on this device.');
  const control=button||document.querySelector('[data-litert-fast-pair]')||{disabled:false,textContent:''};
  try{onProgress?.({phase:'browser-handoff',message:'Opening the browser-managed Gemma 4 phone download flow.'})}catch{}
  return handoff.startPair(control);
}
async function importBrowserFiles(id,files,{onProgress}={}){
  const def=definition(id);if(!def)throw new Error(`Unknown Gemma 4 LiteRT model: ${id}`);
  if(!files?.length)return{cancelled:true,id};
  const handoff=await ensureBrowserHandoff();
  if(typeof handoff?.prepareCurrentPack!=='function')throw new Error('The browser-managed Gemma 4 import layer is not ready.');
  const prepared=await handoff.prepareCurrentPack(progress=>{try{onProgress?.(progress)}catch{}});
  const current=prepared?.current||globalThis.CivweaveBrowserPackDownloadV1;
  if(typeof current?.importFiles!=='function')throw new Error('The browser-managed Gemma 4 file importer is not ready.');
  const result=await current.importFiles(PREMIER,[...files],{onProgress:progress=>{try{onProgress?.(progress)}catch{}}});
  try{await handoff.syncFastStatus?.()}catch{}
  return result;
}
async function remove(id=MODELS.e2.id){const def=definition(id);if(!def)return false;return globalThis.CivweaveLocalModelDownloadV266?.remove?.(id)}
function maybePrime(event){
  const detail=event?.detail||{},state=detail.state||detail,id=detail.id||state.id;
  if(!FAST_IDS.includes(id))return;
  if(String(state.status||detail.status||'')==='ready'||detail.type==='ready')void primeRuntime().catch(()=>null);
}
async function renderUpgradeCard(){
  const panel=document.getElementById('cw-local-ai-v324');if(!panel?.isConnected)return false;
  let card=document.getElementById(UPGRADE_ID);
  if(!card){card=document.createElement('article');card.id=UPGRADE_ID;card.className='cw-local-row';card.dataset.modelId='gemma4-litert-phone-pair';const details=panel.querySelector('details');details?panel.insertBefore(card,details):panel.append(card)}
  const states=await Promise.all(Object.values(MODELS).map(async def=>({def,checked:await status(def.id)})));
  const readyCount=states.filter(row=>row.checked?.available).length;
  const rows=states.map(({def,checked})=>{
    const state=checked?.state||{},ready=Boolean(checked?.available),staleLegacy=['downloading','finalizing'].includes(String(state.status||''));
    const stateText=ready?'READY · automatically accelerates the matching Gemma 4 model.':staleLegacy?'BROWSER DOWNLOAD REQUIRED · the retired in-app transfer will not be resumed.':'Browser-managed LiteRT-LM model.';
    const actionText=staleLegacy?'Download again in browser':`Download ${fmt(def.artifactBytes)}`;
    const inputId=`cw-litert-import-${def.id}`;
    const direct=directDownloadUrl(def);
    const actions=ready
      ?`<button type="button" data-litert-fast-remove="${esc(def.id)}">Remove</button>`
      :`<a href="${esc(direct)}" download="${esc(def.artifact)}" rel="noopener" data-litert-fast-browser-link="${esc(def.id)}">${actionText}</a><label for="${esc(inputId)}" class="cw-browser-pack-import-label" data-litert-fast-import-label="${esc(def.id)}">Import downloaded file</label><input id="${esc(inputId)}" type="file" multiple data-litert-fast-import-input="${esc(def.id)}" style="position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none" aria-label="Import downloaded ${esc(def.label)} file">`;
    return `<div style="display:grid;gap:4px"><b>${def===MODELS.e2?'E2B fast':'E4B deep'} · ${fmt(def.artifactBytes)}</b><span class="cw-local-meta">${stateText}</span><div class="cw-local-actions">${actions}</div></div>`;
  }).join('');
  const remaining=readyCount===2?'':`<span class="cw-local-meta">Download each LiteRT file above directly in the browser, then use Import downloaded file. Both models total ${fmt(MODELS.e2.artifactBytes+MODELS.e4.artifactBytes)}.</span>`;
  card.innerHTML=`<div><b>Gemma 4 · 12 GB phone performance profile</b><p>Use Google’s Web-optimized LiteRT models instead of the heavier generic ONNX graphs. Only one Gemma engine stays resident at a time; the existing ONNX models remain compatibility fallbacks.</p><div style="display:grid;gap:10px;margin-top:8px">${rows}</div></div><div class="cw-local-actions">${remaining}</div>`;
  for(const link of card.querySelectorAll('[data-litert-fast-browser-link]'))link.addEventListener('click',event=>{const target=event.currentTarget,id=target.dataset.litertFastBrowserLink;target.textContent='Browser download started';emit('civweave:gemma4-browser-direct-user-gesture',{id,userActivation:Boolean(navigator.userActivation?.isActive),href:target.href});});
  for(const input of card.querySelectorAll('[data-litert-fast-import-input]'))input.addEventListener('change',event=>{const target=event.currentTarget,id=target.dataset.litertFastImportInput,files=[...(target.files||[])];target.value='';if(!files.length)return;const label=card.querySelector(`[data-litert-fast-import-label="${id}"]`);if(label)label.textContent='Importing downloaded file…';void importBrowserFiles(id,files,{onProgress:progress=>{if(label&&progress?.message)label.textContent=progress.message}}).then(()=>renderUpgradeCard()).catch(error=>{if(label)label.textContent='Retry import downloaded file';emit('civweave:gemma4-litert-upgrade-ui-error',{id,message:String(error?.message||error)})})});
  for(const button of card.querySelectorAll('[data-litert-fast-remove]'))button.addEventListener('click',async event=>{const target=event.currentTarget,id=target.dataset.litertFastRemove;target.disabled=true;try{await remove(id);await renderUpgradeCard()}catch{target.disabled=false}});
  return true;
}
function bindUpgradeUi(){
  if(uiObserver)return;
  const root=document.documentElement||document;
  if(typeof MutationObserver==='function'){uiObserver=new MutationObserver(()=>{if(document.getElementById('cw-local-ai-v324')&&!document.getElementById(UPGRADE_ID))queueMicrotask(()=>void renderUpgradeCard())});uiObserver.observe(root,{childList:true,subtree:true})}
  queueMicrotask(()=>void renderUpgradeCard());
}
watch();bindUpgradeUi();
for(const name of ['civweave:local-model-runtime-ready','civweave:guide-loader-reset','civweave:settings-local-route-ready','pageshow'])addEventListener(name,()=>{queueMicrotask(watch);queueMicrotask(()=>void renderUpgradeCard())});
addEventListener('civweave:local-model-download-progress',event=>{maybePrime(event);const id=event?.detail?.id||event?.detail?.state?.id;if(FAST_IDS.includes(id))queueMicrotask(()=>void renderUpgradeCard())});
addEventListener('civweave:local-model-downloaded',event=>{if(FAST_IDS.includes(event?.detail?.id)){void primeRuntime().catch(()=>null);queueMicrotask(()=>void renderUpgradeCard())}});
try{dispatchEvent(new CustomEvent('civweave:gemma4-litert-fast-extension-ready',{detail:{version:VERSION,ids:FAST_IDS,bytes:MODELS.e2.artifactBytes+MODELS.e4.artifactBytes,revisions:Object.fromEntries(Object.values(MODELS).map(model=>[model.id,model.revision])),explicitDownload:true,offlineRuntimePriming:true,settingsUpgradeCard:true,phoneProfile:'12gb-dual',browserManagedDownloadsOnly:true,directBrowserUserGesture:true,directFileImport:true}}))}catch{}
globalThis.CivweaveGemma4LiteRTFastExtensionV1=freeze({
  version:VERSION,
  id:MODELS.e2.id,
  ids:FAST_IDS,
  legacyQ4Id:MODELS.e2.legacyQ4Id,
  legacyIds:LEGACY_IDS,
  models:MODELS,
  repo:MODELS.e2.repo,
  revision:MODELS.e2.revision,
  artifact:MODELS.e2.artifact,
  artifactBytes:MODELS.e2.artifactBytes,
  artifactSha256:MODELS.e2.sha256,
  runtimeVersion:'0.14.0',
  runtimeCache:RUNTIME_CACHE,
  watch,
  patchRegistry,
  status,
  directDownloadUrl,
  ensureBrowserHandoff,
  download,
  downloadPhonePair,
  importBrowserFiles,
  remove,
  primeRuntime,
  renderUpgradeCard,
  bindUpgradeUi,
  explicitDownload:true,
  browserManagedDownloadsOnly:true,
  directBrowserUserGesture:true,
  directFileImport:true,
  legacyDirectDownloadDisabled:true,
  transparentAcceleration:true,
  dualModelAcceleration:true,
  oneEngineAtATime:true,
  phoneProfile:'12gb-dual',
  offlineRuntimePriming:true,
  settingsUpgradeCard:true,
  state:()=>freeze({primed,priming:Boolean(primeFlight),handoffLoading:Boolean(handoffFlight),upgradeCard:Boolean(document.getElementById(UPGRADE_ID))})
});
})();