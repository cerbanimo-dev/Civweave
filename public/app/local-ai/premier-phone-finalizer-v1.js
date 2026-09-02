(()=>{
'use strict';

const VERSION='1.0.0-premier-phone-finalizer-v1';
const PREMIER='premier-phone';
const E2='gemma4-e2b-it-litert-web';
const E4='gemma4-e4b-it-litert-web';
const FAST_IDS=Object.freeze([E2,E4]);
const SUPPORT_IDS=Object.freeze(['qwen3-0.6b-q8-wasm','silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','omnilingual-asr-300m-int8','supertonic-3-tts-int8']);
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const PENDING_KEY='civweave.ai-pack.browser-downloads.v1';
const FAST_BYTES=Object.freeze({[E2]:2_008_432_640,[E4]:2_969_059_328});
if(globalThis.CivweavePremierPhoneFinalizerV1?.version===VERSION)return;

const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const packs=()=>globalThis.CivweaveLocalModelPacksV1;
const bridge=()=>globalThis.CivweaveBrowserPackDownloadV1;
const actions=()=>globalThis.CivweaveGemma4DualQ4ActionsV1;
const controller=()=>globalThis.CivweaveModelSettingsControllerV173;
const phone=()=>globalThis.CivweaveGemma4PhonePerformanceCoreV1;
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:now(),...detail}}))}catch{}};
let finishPromise=null;

function stateMap(){try{return parse(localStorage.getItem(PACK_STATE_KEY),{})}catch{return{}}}
function writePackState(patch){
  const map=stateMap(),previous=map[PREMIER]||{},next={...previous,...patch,updatedAt:now()};
  map[PREMIER]=next;
  try{localStorage.setItem(PACK_STATE_KEY,JSON.stringify(map))}catch{}
  emit('civweave:local-model-pack-progress',{id:PREMIER,state:{...next},finalizer:true});
  return next;
}
function report(message,onProgress,extra={}){
  const text=String(message||'');
  try{onProgress?.({message:text,...extra})}catch{}
  const selectors=['#cw-local-ai-v324 [data-local-status]','#cw-local-models-direct-v325 [data-cw-direct-local-status]'];
  for(const selector of selectors){const node=document.querySelector?.(selector);if(node)node.textContent=text}
}
async function ensureRuntime(){
  const api=controller();
  if(api?.ensureGemma4Pack)await api.ensureGemma4Pack();
  try{phone()?.applyAuthority?.()}catch{}
  return true;
}
function rowBytes(row){
  return Math.max(0,Number(row?.bytes||row?.state?.bytesDownloaded||row?.installedBytes||row?.rows?.reduce?.((sum,item)=>sum+Number(item?.bytes||0),0)||0));
}
function labelFor(id){
  if(id===E2)return'Gemma 4 E2B LiteRT';
  if(id===E4)return'Gemma 4 E4B LiteRT';
  try{return packs()?.specialized?.[id]?.label||globalThis.CivweaveLocalModelRegistryV266?.byId?.(id)?.label||id}catch{return id}
}
async function recognizeFastModels(onProgress){
  const rows=[],dual=actions(),m=manager();
  for(let index=0;index<FAST_IDS.length;index++){
    const id=FAST_IDS[index];
    report(`Checking ${labelFor(id)} already stored on this device…`,onProgress,{phase:'checking-fast',modelId:id,index,total:FAST_IDS.length});
    try{
      let current=null;
      if(dual?.recognizeImportedModel)current=await dual.recognizeImportedModel(id);
      else if(m?.status)current=await m.status(id);
      rows.push({id,label:labelFor(id),...(current||{}),available:Boolean(current?.available),bytes:rowBytes(current)||FAST_BYTES[id]});
    }catch(error){rows.push({id,label:labelFor(id),available:false,error:String(error?.message||error),bytes:0})}
  }
  return rows;
}
async function supportStatus(){
  const dual=actions();
  if(dual?.supportStatus){
    const current=await dual.supportStatus();
    return{rows:(current?.rows||[]).map(row=>({...row,available:Boolean(row?.available)})),missing:current?.missing||[]};
  }
  const p=packs(),m=manager(),rows=[];
  for(const id of SUPPORT_IDS){
    try{
      const current=id==='qwen3-0.6b-q8-wasm'?await m?.status?.(id):await p?.componentStatus?.(id);
      rows.push({id,label:labelFor(id),...(current||{}),available:Boolean(current?.available)});
    }catch(error){rows.push({id,label:labelFor(id),available:false,error:String(error?.message||error)})}
  }
  return{rows,missing:rows.filter(row=>!row.available)};
}
function repairReceipt(models){
  const b=bridge(),p=packs();
  if(!b?.receiptFor||!p?.byId)return null;
  let source=null;
  try{source=b.pending?.(PREMIER)||b.receiptFor(p.byId(PREMIER))}catch{return null}
  const large=(source?.large||[]).filter(row=>FAST_IDS.includes(String(row?.componentId||'')));
  if(large.length!==FAST_IDS.length)return null;
  const available=new Map(models.filter(row=>row?.available).map(row=>[row.id,row]));
  const importedKeys=[],importedByteSizes={};
  for(const row of large){
    const current=available.get(String(row.componentId||''));
    if(!current)continue;
    importedKeys.push(row.key);
    importedByteSizes[row.key]=rowBytes(current)||Number(row.expectedBytes||row.sizeBytes||row.minBytes||0);
  }
  const receipt={...source,version:Number(source?.version||3),packId:PREMIER,large,largeBytes:large.reduce((sum,row)=>sum+Number(row.expectedBytes||row.sizeBytes||row.minBytes||0),0),importedKeys,startedKeys:(source?.startedKeys||[]).filter(key=>!importedKeys.includes(key)&&large.some(row=>row.key===key)),importedByteSizes,completed:importedKeys.length===large.length,receiptScope:'gemma-litert-browser-only',supportFilesManagedInternally:true,repairedAt:now()};
  const key=b.pendingKey||PENDING_KEY,map=parse(localStorage.getItem(key),{});map[PREMIER]=receipt;try{localStorage.setItem(key,JSON.stringify(map))}catch{}
  emit('civweave:gemma4-browser-receipt-repaired',{packId:PREMIER,imported:importedKeys.length,total:large.length,individualDownloadsRecognized:true});
  return receipt;
}
async function downloadOnlyMissingSupport(current,onProgress){
  if(!current?.missing?.length)return current;
  const dual=actions();
  if(!dual?.downloadSupportFiles)throw new Error(`Premier Phone still needs ${current.missing.map(row=>row.label||row.id).join(', ')} and the internal support downloader is unavailable.`);
  report(`Finishing ${current.missing.length} missing Premier Phone support component${current.missing.length===1?'':'s'}…`,onProgress,{phase:'support',missing:current.missing.map(row=>row.id)});
  await dual.downloadSupportFiles();
  return supportStatus();
}
function markReady(models,support){
  const previous=stateMap()[PREMIER]||{};
  const measured=[...models,...(support?.rows||[])].reduce((sum,row)=>sum+rowBytes(row),0);
  const installedBytes=Math.max(Number(previous.installedBytes||0),measured,6_854_491_968);
  const next=writePackState({
    status:'ready',phase:'ready',percent:100,error:'',errorCode:'',
    completedBytes:installedBytes,totalBytes:installedBytes,installedBytes,
    installedAt:previous.installedAt||now(),verifiedAt:now(),verifiedBy:VERSION,
    primaryModel:E2,deepModel:E4,selectedModel:previous.selectedModel||null,
    optimizedRuntime:'google-litert-lm-webgpu',missingPerformanceModels:[],missingSupportComponents:[],
    supportFilesManagedInternally:true,individualDownloadsRecognized:true
  });
  emit('civweave:local-model-pack-installed',{id:PREMIER,label:'Premier Phone Pack',source:'verified-existing-components',state:{...next}});
  return next;
}
async function finish({downloadMissingSupport=true,onProgress}={}){
  if(finishPromise)return finishPromise;
  finishPromise=(async()=>{
    await ensureRuntime();
    const models=await recognizeFastModels(onProgress),missingModels=models.filter(row=>!row.available);
    repairReceipt(models);
    if(missingModels.length){
      writePackState({status:'core-update-required',phase:'gemma4-litert-performance-core-required',percent:Math.min(98,Number(stateMap()[PREMIER]?.percent||0)),missingPerformanceModels:missingModels.map(row=>row.id),error:''});
      throw new Error(`Premier Phone still needs ${missingModels.map(row=>row.label).join(' and ')}. Models already present were kept; nothing was requeued.`);
    }
    let support=await supportStatus();
    if(support.missing.length&&downloadMissingSupport)support=await downloadOnlyMissingSupport(support,onProgress);
    if(support.missing.length){
      writePackState({status:'support-required',phase:'phone-support-required',percent:99,missingPerformanceModels:[],missingSupportComponents:support.missing.map(row=>row.id),error:''});
      throw new Error(`Premier Phone still needs ${support.missing.map(row=>row.label||row.id).join(', ')}.`);
    }
    report('All existing Premier Phone components verified · finalizing the pack…',onProgress,{phase:'finalizing'});
    const state=markReady(models,support);
    try{phone()?.applyAuthority?.()}catch{}
    report('Premier Phone Pack is ready.',onProgress,{phase:'ready',percent:100});
    return{id:PREMIER,label:'Premier Phone Pack',available:true,installed:true,models,support,state};
  })().finally(()=>{finishPromise=null});
  return finishPromise;
}
async function use(modelId=E2,{onProgress}={}){
  if(!FAST_IDS.includes(modelId))modelId=E2;
  await finish({downloadMissingSupport:false,onProgress});
  const m=manager();
  if(!m?.select)throw new Error('Local model manager is unavailable.');
  const checked=await m.status?.(modelId);if(checked&&!checked.available)throw new Error(`${labelFor(modelId)} is not available.`);
  m.select(modelId);
  const previous=stateMap()[PREMIER]||{};
  writePackState({status:'ready',phase:'ready',percent:100,selectedModel:modelId,lastUsedAt:now(),primaryModel:E2,deepModel:E4,missingPerformanceModels:[],missingSupportComponents:[]});
  try{globalThis.CivweaveSettingsLocalRouteV323?.persistLocalRoute?.(m.selection?.()||{active:true,id:modelId})}catch{}
  emit('civweave:local-model-pack-selected',{id:PREMIER,label:'Premier Phone Pack',model:modelId,source:VERSION});
  report(`${labelFor(modelId)} is active for downloaded local AI.`,onProgress,{phase:'selected',modelId});
  return{pack:{id:PREMIER,label:'Premier Phone Pack'},model:modelId,state:previous};
}
function scheduleDecorate(){try{actions()?.scheduleDecorate?.()}catch{}try{globalThis.CivweaveGemma4BrowserPackCoherenceV1?.scheduleDecorate?.()}catch{}}
function onClick(event){
  const button=event.target?.closest?.('[data-gemma4-phone-reconcile],[data-gemma4-phone-support]');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();button.disabled=true;
  report('Checking the existing Premier Phone downloads before doing anything else…');
  void finish({downloadMissingSupport:true,onProgress:progress=>{if(progress?.message)report(progress.message)}})
    .catch(error=>report(String(error?.message||error)))
    .finally(()=>{button.disabled=false;scheduleDecorate()});
}

document.addEventListener('click',onClick,true);
globalThis.CivweavePremierPhoneFinalizerV1=Object.freeze({version:VERSION,packId:PREMIER,primaryModel:E2,deepModel:E4,fastIds:FAST_IDS,supportIds:SUPPORT_IDS,finish,use,repairReceipt,recognizeFastModels,supportStatus,markReady,idempotent:true,preservesExistingModels:true,downloadsMissingSupportOnly:true,requeuesVerifiedLargeModels:false,captureBeforeLegacyReconcile:true});
})();
