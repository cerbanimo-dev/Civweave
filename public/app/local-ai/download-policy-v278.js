(()=>{
'use strict';
const VERSION='1.0.82-local-ai-download-policy-v322-explicit-sync';
const REVISION='1.0.123-local-ai-download-policy-v322-phone-foreground';
const FOREGROUND_PHONE_MODELS=new Set(['gemma3-1b-it-q4f16','qwen3-0.6b-q4f16']);
if(globalThis.CivweaveLocalModelDownloadPolicyV278?.version===VERSION&&globalThis.CivweaveLocalModelDownloadPolicyV278?.revision===REVISION)return;
const base=globalThis.CivweaveLocalModelDownloadV266;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
if(!base?.start||!base?.syncBackgroundJobs)throw new Error('Local model download manager must load before download policy.');
function forceForeground(id,spec=registry()?.byId?.(id)){
  return Boolean(spec?.preferBackground===false||FOREGROUND_PHONE_MODELS.has(String(id||'')));
}
async function start(id,options={}){
  const spec=registry()?.byId?.(id);
  if(forceForeground(id,spec))return base.start(id,{...options,preferBackground:false});
  const preferBackground=options.preferBackground;
  return base.start(id,{...options,preferBackground:preferBackground===undefined?true:preferBackground});
}
async function sync(){
  const active=await base.syncBackgroundJobs();
  const rows=Array.isArray(active)?active:[];
  for(const id of rows){
    const spec=registry()?.byId?.(id);
    if(!forceForeground(id,spec))continue;
    try{await base.cancel(id)}catch{}
  }
  return rows.filter(id=>!forceForeground(id,registry()?.byId?.(id)));
}
const wrapped=Object.freeze({...base,start,install:start,syncBackgroundJobs:sync,downloadPolicyVersion:VERSION,downloadPolicyRevision:REVISION,largeExternalDataForeground:true,phoneModelForeground:true,foregroundPhoneModels:Object.freeze([...FOREGROUND_PHONE_MODELS]),autoSyncOnLoad:false,explicitSyncOnly:true});
globalThis.CivweaveLocalModelDownloadV266=wrapped;
globalThis.CivweaveLocalModelDownloadPolicyV278=Object.freeze({version:VERSION,revision:REVISION,start,sync,forceForeground,phoneModelForeground:true,foregroundPhoneModels:Object.freeze([...FOREGROUND_PHONE_MODELS]),autoSyncOnLoad:false,explicitSyncOnly:true});
try{dispatchEvent(new CustomEvent('civweave:local-model-download-policy-ready',{detail:{version:VERSION,revision:REVISION,largeExternalDataForeground:true,phoneModelForeground:true,foregroundPhoneModels:[...FOREGROUND_PHONE_MODELS],autoSyncOnLoad:false}}))}catch{}
})();