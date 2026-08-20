(()=>{
'use strict';
const VERSION='1.0.0-gemma4-litert-fast-extension-v1';
const REGISTRY_KEY='CivweaveLocalModelRegistryV266';
const FAST_ID='gemma4-e2b-it-litert-web';
const LEGACY_Q4_ID='gemma4-e2b-it-q4f16';
const REPO='litert-community/gemma-4-E2B-it-litert-lm';
const REVISION='73d35ec36cf24347ab4eec1a46f0aafbb9c3a89d';
const ARTIFACT='gemma-4-E2B-it-web.litertlm';
const ARTIFACT_BYTES=2_008_432_640;
if(globalThis.CivweaveGemma4LiteRTFastExtensionV1?.version===VERSION)return;
const freeze=value=>Object.freeze(value);
function fastSpec(registry){
  const legacy=registry?.byId?.(LEGACY_Q4_ID)||registry?.byId?.('gemma4-e2b-it-q2f16-mobile')||{};
  return freeze({
    ...legacy,
    id:FAST_ID,
    label:'Gemma 4 E2B IT · LiteRT Fast',
    tier:'Gemma 4 Fast',
    hardwareTier:'8+ GB RAM · WebGPU · optimized LiteRT-LM',
    status:'device-test',
    installable:true,
    recommended:'phone-fast',
    provider:'huggingface',
    repo:REPO,
    revision:REVISION,
    task:'text-generation',
    dtype:'litert-web',
    device:'webgpu',
    runtime:'litert-lm-web',
    runtimeAsset:'/app/vendor/litert-lm/dist/index.js',
    wasmRoot:'/app/vendor/litert-lm/wasm/',
    wasmChunks:freeze([]),
    textOnly:true,
    requiresShaderF16:false,
    estimatedBytes:ARTIFACT_BYTES,
    license:'Apache-2.0',
    sourceModel:'google/gemma-4-E2B-it',
    preferBackground:true,
    contextWindowTokens:128_000,
    workingContextTokens:4_096,
    healthTimeoutMs:600_000,
    generation:freeze({topK:64,topP:.95,nonThinkingTemperature:1,thinkingTemperature:1,thinkingSupported:true}),
    capabilities:legacy.capabilities||freeze({interactive:true,structuredOutput:true,agenticReasoning:true,code:true,tools:false,externalResearch:false,vision:false,audio:false,multimodal:false}),
    fallbackIds:freeze([LEGACY_Q4_ID,'gemma3-1b-it-q4f16','qwen3-1.7b-q4f16','qwen3-0.6b-q4f16','qwen3-0.6b-q8-wasm']),
    accelerationFor:LEGACY_Q4_ID,
    optimizedRuntime:'google-litert-lm-webgpu',
    artifactSha256:'3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
    artifacts:freeze([freeze({path:ARTIFACT,minBytes:2_000_000_000,required:true,revision:REVISION,sizeBytes:ARTIFACT_BYTES})])
  });
}
function patchRegistry(registry){
  if(!registry?.byId||!Array.isArray(registry.models))return registry;
  if(registry.__civweaveGemma4LiteRTFastV1)return registry;
  const fast=fastSpec(registry),rows=[];let inserted=false;
  for(const model of registry.models){
    if(!model||model.id===FAST_ID)continue;
    if(!inserted&&(model.id===LEGACY_Q4_ID||/^gemma4-e2b/i.test(String(model.id||'')))){rows.push(fast);inserted=true}
    rows.push(model);
  }
  if(!inserted)rows.push(fast);
  const runtimeModels=[...(registry.runtimeModels||[]).filter(model=>model?.id!==FAST_ID)];
  const map=new Map([...rows,...runtimeModels].map(model=>[model.id,model]));
  const byId=id=>map.get(id)||null;
  const originalFallbacks=typeof registry.fallbacks==='function'?registry.fallbacks.bind(registry):null;
  const fallbacks=modelOrId=>{
    const model=typeof modelOrId==='string'?byId(modelOrId):byId(modelOrId?.id)||modelOrId;
    if(model?.id===FAST_ID)return fast.fallbackIds.map(byId).filter(Boolean);
    let prior=[];try{prior=originalFallbacks?.(modelOrId)||[]}catch{}
    return prior.map(item=>byId(item?.id)||item).filter(Boolean);
  };
  const originalCapable=typeof registry.capable==='function'?registry.capable.bind(registry):null;
  const capable=request=>{let prior=[];try{prior=originalCapable?.(request)||[]}catch{}const mapped=prior.map(item=>byId(item?.id)||item).filter(Boolean);if(!mapped.some(item=>item.id===FAST_ID)&&mapped.some(item=>/gemma4|gemma-4/i.test(`${item.id||''} ${item.repo||''}`)))mapped.unshift(fast);return mapped};
  const originalCpuFallback=typeof registry.cpuFallback==='function'?registry.cpuFallback.bind(registry):null;
  const cpuFallback=modelOrId=>{const model=typeof modelOrId==='string'?byId(modelOrId):modelOrId;if(model?.id===FAST_ID){const legacy=byId(LEGACY_Q4_ID);try{return originalCpuFallback?.(legacy)||null}catch{return null}}try{return originalCpuFallback?.(modelOrId)||null}catch{return null}};
  return freeze({...registry,models:freeze(rows),runtimeModels:freeze(runtimeModels),byId,fallbacks,capable,cpuFallback,installable:()=>rows.filter(model=>model.installable),experimental:()=>rows.filter(model=>!model.installable),__civweaveGemma4LiteRTFastV1:true,gemma4LiteRTFastModelId:FAST_ID,gemma4LiteRTAccelerationFor:LEGACY_Q4_ID,gemma4LiteRTRuntime:'0.14.0',gemma4LiteRTArtifactRevision:REVISION});
}
function watch(){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,REGISTRY_KEY);
  if(descriptor&&!descriptor.configurable){try{const current=globalThis[REGISTRY_KEY],next=patchRegistry(current);if(next!==current)globalThis[REGISTRY_KEY]=next}catch{}return Boolean(globalThis[REGISTRY_KEY]?.__civweaveGemma4LiteRTFastV1)}
  let value=patchRegistry(globalThis[REGISTRY_KEY]);
  try{Object.defineProperty(globalThis,REGISTRY_KEY,{configurable:true,enumerable:true,get(){return value},set(next){value=patchRegistry(next)}});return true}catch{try{globalThis[REGISTRY_KEY]=patchRegistry(globalThis[REGISTRY_KEY])}catch{}return Boolean(globalThis[REGISTRY_KEY]?.__civweaveGemma4LiteRTFastV1)}
}
async function status(){try{return await globalThis.CivweaveLocalModelDownloadV266?.status?.(FAST_ID)}catch{return{available:false}}}
async function download({onProgress}={}){if(!watch())throw new Error('The local model registry is not ready.');const manager=globalThis.CivweaveLocalModelDownloadV266;if(!manager?.start)throw new Error('The local model download manager is not ready.');return manager.start(FAST_ID,{onProgress,preferBackground:true})}
async function remove(){return globalThis.CivweaveLocalModelDownloadV266?.remove?.(FAST_ID)}
watch();
for(const name of ['civweave:local-model-runtime-ready','civweave:guide-loader-reset','civweave:settings-local-route-ready','pageshow'])addEventListener(name,()=>queueMicrotask(watch));
try{dispatchEvent(new CustomEvent('civweave:gemma4-litert-fast-extension-ready',{detail:{version:VERSION,id:FAST_ID,bytes:ARTIFACT_BYTES,revision:REVISION,explicitDownload:true}}))}catch{}
globalThis.CivweaveGemma4LiteRTFastExtensionV1=freeze({version:VERSION,id:FAST_ID,legacyQ4Id:LEGACY_Q4_ID,repo:REPO,revision:REVISION,artifact:ARTIFACT,artifactBytes:ARTIFACT_BYTES,artifactSha256:'3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',runtimeVersion:'0.14.0',watch,patchRegistry,status,download,remove,explicitDownload:true,transparentAcceleration:true});
})();