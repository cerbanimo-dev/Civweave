(()=>{
'use strict';
const VERSION='1.0.0-local-generation-model-policy-v1';
if(globalThis.CivweaveLocalGenerationModelPolicyV1?.version===VERSION)return;
const SELECTION_KEY='civweave.local-ai.selection.v266';
const clean=(s,max=240)=>String(s??'').trim().slice(0,max);
const PAIRS=Object.freeze([
  Object.freeze({fast:'gemma4-e2b-it-litert-web',deep:'gemma4-e4b-it-litert-web',aliases:Object.freeze(['gemma4-e2b-it-q4f16','gemma4-e2b-it-q2f16-mobile','gemma4-e4b-it-q4f16','gemma4-e4b-it-q2f16-mobile'])}),
  Object.freeze({fast:'qwen35-4b-litert-web',deep:'qwen35-9b-litert-web',aliases:Object.freeze([])})
]);
function selection(){
  try{const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();if(live?.active&&live.id)return live}catch{}
  try{const saved=JSON.parse(localStorage.getItem(SELECTION_KEY)||'null');if(saved?.active&&saved.id)return saved}catch{}
  return null;
}
const pairFor=id=>PAIRS.find(pair=>[pair.fast,pair.deep,...pair.aliases].includes(id))||null;
function supportsSelected(){return Boolean(pairFor(clean(selection()?.id)))}
function resolve(role='deep',options={}){
  const selected=clean(options.selectedModel||options.config?.model||selection()?.id);
  const pair=pairFor(selected)||pairFor(clean(selection()?.id));
  if(pair)return role==='intake'||role==='fast'?pair.fast:pair.deep;
  // Do not silently reassign an unrelated local model to a Gemma 4 model.
  return selected||'';
}
async function requireRole(role='deep',options={}){
  const id=resolve(role,options);
  if(!id)throw Object.assign(new Error('Select and install a local model before generating.'),{code:'LOCAL_GENERATION_MODEL_NOT_SELECTED'});
  const manager=globalThis.CivweaveLocalModelDownloadV266;
  if(typeof manager?.status==='function'){
    const status=await manager.status(id);
    if(status?.available!==true)throw Object.assign(new Error(`The configured ${role} model ${id} is not downloaded and ready. No alternate model was substituted.`),{code:'LOCAL_GENERATION_ROLE_MODEL_UNAVAILABLE',executionModel:id,role,modelStatus:status});
  }
  return id;
}
function display(id){const modelId=clean(id)||resolve('deep');try{const spec=globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.profiles?.[modelId];if(spec?.label)return spec.label}catch{}try{return clean(globalThis.CivweaveLocalModelRegistryV266?.byId?.(modelId)?.name,120)||modelId}catch{return modelId}}
const api=Object.freeze({version:VERSION,selection,pairFor,supportsSelected,resolve,requireRole,display,pairs:PAIRS});
globalThis.CivweaveLocalGenerationModelPolicyV1=api;
try{dispatchEvent(new CustomEvent('civweave:local-generation-model-policy-ready',{detail:{version:VERSION}}))}catch{}
})();