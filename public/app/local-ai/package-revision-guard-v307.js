(()=>{
'use strict';
const VERSION='1.0.121-local-model-package-revision-guard-v307';
const base=globalThis.CivweaveLocalModelDownloadV266;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
if(globalThis.CivweaveLocalModelPackageRevisionGuardV307?.version===VERSION&&base?.packageRevisionGuard===true)return;
if(!base?.selection||!base?.state||!base?.status)return;

function mismatch(id,selectionValue=null,stateValue=null){
  const spec=registry()?.byId?.(id);
  if(!spec)return null;
  const selected=selectionValue||base.selection?.()||{};
  const state=stateValue||base.state?.(id)||{};
  const selectedRevision=String(selected?.id===id?selected?.revision||'':'');
  const stateRevision=String(state?.revision||'');
  const currentRevision=String(spec.revision||'');
  const replacementReady=stateRevision===currentRevision&&String(state?.status||'')==='ready';
  const selectedStale=Boolean(selectedRevision&&currentRevision&&selectedRevision!==currentRevision&&!replacementReady);
  const stateStale=Boolean(stateRevision&&currentRevision&&stateRevision!==currentRevision);
  if(!selectedStale&&!stateStale)return null;
  const installedRevision=stateStale?stateRevision:selectedRevision;
  return{schema:'civweave.local-model-package-revision.v1',id,spec,installedRevision,currentRevision,replacementReady,stateStatus:String(state?.status||''),message:`${spec.label} has a newer local package. Resume the model download once to install the current browser-compatible artifacts.`};
}
function selection(){
  const value=base.selection?.()||{active:false,id:null};
  const stale=value?.active&&value?.id?mismatch(value.id,value,null):null;
  return stale?{...value,active:false,packageRevisionChanged:true,installedRevision:stale.installedRevision,currentRevision:stale.currentRevision,migrationMessage:stale.message}:value;
}
function normalizeState(id,value){
  const state=value||{};
  const stale=mismatch(id,null,state);
  if(!stale||!['ready','finalizing'].includes(String(state.status||'')))return state;
  return{...state,status:'paused',percent:Math.min(99,Number(state.percent||0)),packageRevisionChanged:true,installedRevision:stale.installedRevision,currentRevision:stale.currentRevision,error:stale.message};
}
function state(id){
  if(id)return normalizeState(id,base.state?.(id)||{});
  const values=base.state?.()||{},out={};
  for(const [modelId,value] of Object.entries(values))out[modelId]=normalizeState(modelId,value);
  return out;
}
async function status(id){
  const result=await base.status(id);
  const stale=mismatch(id,null,result?.state||base.state?.(id)||{});
  if(!stale)return result;
  return{...result,available:false,installed:false,selected:false,packageRevisionChanged:true,installedRevision:stale.installedRevision,currentRevision:stale.currentRevision,migrationMessage:stale.message,state:normalizeState(id,result?.state||base.state?.(id)||{})};
}
function migration(id){return mismatch(id)||null}

const guarded=Object.freeze({...base,selection,state,status,packageRevisionGuard:true,packageRevisionGuardVersion:VERSION,packageMigration:migration});
globalThis.CivweaveLocalModelDownloadV266=guarded;
globalThis.CivweaveLocalModelPackageRevisionGuardV307=Object.freeze({version:VERSION,mismatch:migration,selection,state,status});
try{dispatchEvent(new CustomEvent('civweave:local-model-package-revision-guard-ready',{detail:{version:VERSION,selectionSuppression:true,stateNormalization:true,replacementMustBeReady:true,preservesCachedWeights:true}}))}catch{}
})();
