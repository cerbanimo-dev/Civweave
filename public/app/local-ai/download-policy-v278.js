(()=>{
'use strict';
const VERSION='1.0.81-local-ai-download-policy-v278-foreground-large-files';
if(globalThis.CivweaveLocalModelDownloadPolicyV278?.version===VERSION)return;
const base=globalThis.CivweaveLocalModelDownloadV266;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
if(!base?.start||!base?.sync)throw new Error('Local model download manager must load before download policy.');
async function start(id,options={}){
  const spec=registry()?.byId?.(id);
  const preferBackground=spec?.preferBackground===false?false:options.preferBackground;
  return base.start(id,{...options,preferBackground:preferBackground===undefined?true:preferBackground});
}
async function sync(){
  const active=await base.sync();
  const rows=Array.isArray(active)?active:[];
  for(const id of rows){
    const spec=registry()?.byId?.(id);
    if(spec?.preferBackground!==false)continue;
    try{await base.cancel(id)}catch{}
    try{
      const state=base.state?.()?.[id]||{};
      if(['downloading','finalizing'].includes(String(state.status||'')))base.setState?.(id,{status:'paused',mode:'foreground-stream',background:false,error:'This model uses Civweave’s resumable in-app transfer because browser Background Fetch can stall on large Hugging Face external-data files. Tap Resume to continue without restarting completed files.'});
    }catch{}
  }
  return rows.filter(id=>registry()?.byId?.(id)?.preferBackground!==false);
}
const wrapped=Object.freeze({...base,start,sync,downloadPolicyVersion:VERSION,largeExternalDataForeground:true});
globalThis.CivweaveLocalModelDownloadV266=wrapped;
globalThis.CivweaveLocalModelDownloadPolicyV278=Object.freeze({version:VERSION,start,sync});
try{dispatchEvent(new CustomEvent('civweave:local-model-download-policy-ready',{detail:{version:VERSION,largeExternalDataForeground:true}}))}catch{}
})();
