(()=>{
'use strict';
const VERSION='1.3.1-gemma4-dual-actions-v2-support-autodetect';
const PREMIER='premier-phone';
const E2='gemma4-e2b-it-litert-web';
const E4='gemma4-e4b-it-litert-web';
const FALLBACK='qwen3-0.6b-q8-wasm';
const FAST_IDS=Object.freeze([E2,E4]);
const SUPPORT_IDS=Object.freeze([FALLBACK,'silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','omnilingual-asr-300m-int8','supertonic-3-tts-int8']);
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const PENDING_KEY='civweave.ai-pack.browser-downloads.v1';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const SUPPORT_WORKER='/app/local-ai/premier-phone-support-worker-v1.js?v=1.0.0-worker-cache-stream';
const MODEL_FILES=Object.freeze({
  [E2]:Object.freeze({path:'gemma-4-E2B-it-web.litertlm',minBytes:2_000_000_000,label:'Gemma 4 E2B LiteRT'}),
  [E4]:Object.freeze({path:'gemma-4-E4B-it-web.litertlm',minBytes:2_950_000_000,label:'Gemma 4 E4B LiteRT'})
});
if(globalThis.CivweaveGemma4DualQ4ActionsV1?.version===VERSION)return;
const phone=()=>globalThis.CivweaveGemma4PhonePerformanceCoreV1;
const handoff=()=>globalThis.CivweaveGemma4BrowserPackCoherenceV1;
const bridge=()=>globalThis.CivweaveBrowserPackDownloadV1;
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const packs=()=>globalThis.CivweaveLocalModelPacksV1;
const opfs=()=>globalThis.CivweaveGemma4OPFSStorageV1;
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const stateMap=()=>parse(localStorage.getItem(PACK_STATE_KEY),{});
let timers=[];
let supportSnapshot={checked:false,loading:false,rows:[],missing:[]};
let supportPromise=null;
function setText(node,value){if(!node)return false;const next=String(value??'');if(node.textContent===next)return false;node.textContent=next;return true}
function setHtml(node,value){if(!node)return false;const next=String(value??'');if(node.innerHTML===next)return false;node.innerHTML=next;return true}
function pendingSummary(){
  const current=bridge(),receipt=current?.pending?.(PREMIER)||null,missing=receipt&&current?.unimportedRecords?current.unimportedRecords(receipt):[];
  return{receipt,missing,imported:receipt?.importedKeys?.length||0,total:receipt?.large?.length||0,complete:Boolean(receipt?.large?.length&&(receipt.importedKeys?.length||0)===receipt.large.length)};
}
function statusLine(text,error=false){const node=document.querySelector('#cw-local-ai-v324 [data-local-status]');if(node){setText(node,text);node.classList.toggle('cw-local-error',Boolean(error))}}
function directActions(card){return[...card.children].find(node=>node.classList?.contains('cw-local-actions'))||null}
function labelFor(id){return packs()?.specialized?.[id]?.label||registry()?.byId?.(id)?.label||({[FALLBACK]:'Qwen 3 0.6B CPU fallback'}[id])||id}
function writeDownloadReady(id,bytes){
  const rows=parse(localStorage.getItem(DOWNLOADS_KEY),{}),previous=rows[id]||{},value=Math.max(0,Number(bytes||previous.bytesDownloaded||previous.totalBytes||MODEL_FILES[id]?.minBytes||0));
  rows[id]={...previous,status:'ready',phase:'ready',percent:100,bytesDownloaded:value,totalBytes:value,installedAt:previous.installedAt||new Date().toISOString(),error:'',storageBackend:'opfs',updatedAt:new Date().toISOString()};
  localStorage.setItem(DOWNLOADS_KEY,JSON.stringify(rows));
  return rows[id];
}
async function recognizeImportedModel(id){
  const spec=MODEL_FILES[id],m=manager();if(!spec)throw new Error(`Unknown current Gemma phone model: ${id}`);
  try{opfs()?.installCacheFacade?.()}catch{}
  if(m?.status){
    try{const checked=await m.status(id);if(checked?.available)return checked}catch{}
  }
  const storage=opfs();if(!storage?.opfsStatus)throw new Error(`${spec.label} could not be checked in origin-private model storage.`);
  const current=await storage.opfsStatus(id,spec.path,spec.minBytes);
  if(!current?.ok)throw new Error(`${spec.label} is not currently readable from origin-private model storage.`);
  const state=writeDownloadReady(id,current.bytes);
  try{dispatchEvent(new CustomEvent('civweave:local-model-downloaded',{detail:{version:VERSION,id,bytes:current.bytes,storageBackend:'opfs',reconciled:true}}))}catch{}
  if(m?.status){
    try{const checked=await m.status(id);if(checked?.available)return checked}catch{}
  }
  return{id,label:spec.label,available:true,installed:true,state,bytes:current.bytes,storageBackend:'opfs',reconciled:true};
}
function repairPremierReceipt(models=[]){
  const map=parse(localStorage.getItem(PENDING_KEY),{}),raw=map[PREMIER];if(!raw||typeof raw!=='object')return null;
  const large=(raw.large||[]).filter(row=>FAST_IDS.includes(String(row?.componentId||'')));
  if(!large.length)return raw;
  const valid=new Set(large.map(row=>String(row.key||''))),available=new Map(models.filter(row=>row?.id).map(row=>[row.id,row]));
  const imported=new Set((raw.importedKeys||[]).filter(key=>valid.has(String(key)))),sizes={};
  for(const [key,bytes] of Object.entries(raw.importedByteSizes||{}))if(valid.has(String(key))&&Number(bytes)>0)sizes[key]=Number(bytes);
  for(const row of large){const model=available.get(String(row.componentId||''));if(!model?.available)continue;imported.add(row.key);sizes[row.key]=Number(model.bytes||model.state?.bytesDownloaded||row.expectedBytes||row.sizeBytes||row.minBytes||0)}
  const complete=large.length===FAST_IDS.length&&imported.size===large.length,largeBytes=large.reduce((sum,row)=>sum+Number(row.expectedBytes||row.sizeBytes||row.minBytes||0),0);
  const next={...raw,large,largeBytes,importedKeys:[...imported],startedKeys:(raw.startedKeys||[]).filter(key=>valid.has(String(key))&&!imported.has(key)),importedByteSizes:sizes,completed:complete,receiptScope:'gemma-litert-browser-only',supportFilesManagedInternally:true,repairedAt:new Date().toISOString()};
  map[PREMIER]=next;localStorage.setItem(PENDING_KEY,JSON.stringify(map));
  const packMap=stateMap(),previous=packMap[PREMIER]||{},percent=complete?100:Math.floor(imported.size/Math.max(1,large.length)*100);
  packMap[PREMIER]={...previous,browserExpectedFiles:large.length,browserImportedFiles:imported.size,browserRemainingFiles:Math.max(0,large.length-imported.size),browserLargeBytes:largeBytes,status:previous.status==='ready'?'ready':complete?'support-required':'browser-partial',phase:previous.status==='ready'?'ready':complete?'phone-support-required':'waiting-for-browser-downloads',percent:previous.status==='ready'?100:complete?99:percent,error:'',updatedAt:new Date().toISOString()};
  localStorage.setItem(PACK_STATE_KEY,JSON.stringify(packMap));
  try{dispatchEvent(new CustomEvent('civweave:local-model-pack-progress',{detail:{version:VERSION,id:PREMIER,state:{...packMap[PREMIER]},receiptRepaired:true}}))}catch{}
  return next;
}
async function synchronizeImportedModels(){
  const models=[];
  for(const id of FAST_IDS){
    try{models.push({id,...await recognizeImportedModel(id)})}
    catch(error){models.push({id,label:MODEL_FILES[id]?.label||id,available:false,error:String(error?.message||error)})}
  }
  const receipt=repairPremierReceipt(models),complete=models.every(row=>row.available)&&Boolean(receipt?.large?.length===FAST_IDS.length);
  return{complete,models,receipt};
}
async function supportStatus(){
  const p=packs(),m=manager(),rows=[];
  for(const id of SUPPORT_IDS){
    try{
      let current=null;
      if(id===FALLBACK)current=await m?.status?.(id);
      else if(p?.componentStatus)current=await p.componentStatus(id);
      else if(p?.specializedStatus)current=await p.specializedStatus(id);
      rows.push({id,label:labelFor(id),...(current||{}),available:Boolean(current?.available)});
    }catch(error){rows.push({id,label:labelFor(id),available:false,error:String(error?.message||error)})}
  }
  return{rows,missing:rows.filter(row=>!row.available)};
}
function supportNote(card){
  let note=card.querySelector('[data-gemma4-support-note]');
  if(!pendingSummary().complete){note?.remove();return}
  if(!note){note=document.createElement('p');note.dataset.gemma4SupportNote='';note.className='cw-local-meta';card.append(note)}
  if(supportSnapshot.loading&&!supportSnapshot.checked){setText(note,'Checking internally stored Premier Phone support files…');return}
  if(supportSnapshot.missing.length){setText(note,`Still needed internally: ${supportSnapshot.missing.map(row=>row.label||row.id).join(' · ')}. These download directly into Civweave storage and are detected automatically; they do not appear in Android Downloads.`);return}
  if(supportSnapshot.checked)setText(note,'Gemma E2B/E4B and all internally stored Premier Phone support files are present.');
}
function decorateCurrentPhone(){
  const card=document.querySelector('#cw-local-ai-v324 [data-pack-id="premier-phone"]');if(!card)return false;
  const paragraphs=[...card.children].filter(node=>node.tagName==='P');
  if(paragraphs[0])setText(paragraphs[0],'Gemma 4 E2B LiteRT is the fast phone lane and E4B LiteRT is the deep phone lane. Q4F16 and Q2F16 files are compatibility-only and never replace the optimized phone models.');
  if(paragraphs[1])setHtml(paragraphs[1],'<b>Target:</b> 12 GB RAM · modern Android-class WebGPU · one Gemma lane loaded at a time');
  if(paragraphs[2])setHtml(paragraphs[2],'<b>Storage:</b> ~6.9 GB current phone core · support files are stored inside Civweave and auto-detected');
  if(paragraphs[3])setText(paragraphs[3],'Gemma 4 E2B LiteRT fast · Gemma 4 E4B LiteRT deep · Qwen 3 0.6B CPU fallback · Silero · Parakeet INT8 · Omnilingual 300M INT8 · Supertonic 3');
  card.querySelector('[data-gemma4-core-note]')?.remove();
  card.querySelector('[data-gemma4-runnable-note]')?.remove();
  card.querySelector('[data-gemma4-performance-note]')?.remove();
  const summary=pendingSummary(),state=stateMap()[PREMIER]||{},actions=directActions(card);
  if(actions&&summary.complete){
    let html='';
    if(supportSnapshot.loading&&!supportSnapshot.checked)html='<button type="button" disabled>Checking support files…</button>';
    else if(supportSnapshot.missing.length)html=`<button type="button" data-gemma4-phone-support>Download missing support files internally (${supportSnapshot.missing.length})</button>`;
    else if(state.status==='ready')html='<button type="button" data-gemma4-phone-use="gemma4-e2b-it-litert-web">Use fast phone model</button><button type="button" data-gemma4-phone-use="gemma4-e4b-it-litert-web">Use deep phone model</button>';
    else html='<button type="button" data-gemma4-phone-reconcile>Finish phone performance core</button>';
    if(actions.innerHTML!==html)actions.innerHTML=html;
  }
  supportNote(card);
  card.dataset.gemma4CurrentPhoneOwner=VERSION;
  return true;
}
function runDecorators(){
  try{decorateCurrentPhone()}catch{}
  try{handoff()?.scheduleDecorate?.()}catch{}
}
function scheduleDecorate(){
  for(const timer of timers)clearTimeout(timer);timers=[];
  queueMicrotask(runDecorators);
  for(const delay of [220,650,1350])timers.push(setTimeout(runDecorators,delay));
  return true;
}
function workerInstallSupport(id,{onProgress}={}){
  const p=packs(),component=p?.specialized?.[id];
  if(!component?.artifacts?.length)throw new Error(`Support component ${labelFor(id)} has no specialized asset manifest.`);
  const artifacts=component.artifacts.map(art=>({path:art.path,minBytes:art.minBytes,sizeBytes:art.sizeBytes,url:p.assetUrl(id,art.path)}));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(SUPPORT_WORKER);
    const cleanup=()=>{try{worker.terminate()}catch{}};
    worker.onmessage=event=>{
      const packet=event.data||{};if(packet.componentId!==id)return;
      if(packet.type==='progress'){try{onProgress?.(packet)}catch{};return}
      if(packet.type==='complete'){cleanup();resolve(packet);return}
      if(packet.type==='error'){cleanup();reject(new Error(packet.message||`${labelFor(id)} download failed.`))}
    };
    worker.onerror=event=>{cleanup();reject(new Error(event?.message||`${labelFor(id)} support worker failed.`))};
    worker.postMessage({type:'install-support-component',cacheName:p.cache,component:{id,label:component.label,artifacts}});
  });
}
async function waitForModel(id,onProgress){
  const m=manager(),started=Date.now();
  while(Date.now()-started<7_200_000){
    const current=await m?.status?.(id);if(current?.available)return current;
    const state=m?.state?.(id)||current?.state||{};try{onProgress?.(state)}catch{}
    if(['error','paused','aborted'].includes(String(state.status||'')))throw new Error(state.error||`${labelFor(id)} download stopped.`);
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error(`${labelFor(id)} did not finish within the download session.`);
}
async function installSupportComponent(row,index,total){
  const id=row.id,label=row.label||labelFor(id),m=manager();
  statusLine(`Downloading internally ${index}/${total} · ${label}…`);
  if(id===FALLBACK){
    if(!m?.start)throw new Error('Local generative download manager is unavailable.');
    await m.requestPersistence?.();
    const current=await m.status(id);if(!current?.available){
      await m.start(id,{preferBackground:false,onProgress:state=>{const pct=Math.max(0,Math.min(99,Number(state?.percent||0)));statusLine(`${label} · internal download ${pct}%`)}});
      await waitForModel(id,state=>{const pct=Math.max(0,Math.min(99,Number(state?.percent||0)));statusLine(`${label} · internal download ${pct}%`)});
    }
  }else{
    await workerInstallSupport(id,{onProgress:packet=>{
      const pct=packet.total?Math.max(0,Math.min(99,Math.floor(Number(packet.loaded||0)/Number(packet.total||1)*100))):0;
      statusLine(`${label} · ${packet.artifact||'model data'} · internal download ${pct}%`);
    }});
  }
  const verified=id===FALLBACK?await m?.status?.(id):await packs()?.componentStatus?.(id);
  if(!verified?.available)throw new Error(`${label} finished downloading but was not detected in Civweave internal storage.`);
  try{dispatchEvent(new CustomEvent('civweave:gemma4-support-progress',{detail:{version:VERSION,id,label,index,total,complete:true,autoDetected:true,storage:'internal'}}))}catch{}
}
async function downloadSupportFiles(){
  if(supportPromise)return supportPromise;
  supportPromise=(async()=>{
    const synced=await synchronizeImportedModels();
    if(!synced.complete)throw new Error('Both Gemma 4 LiteRT files must be present before downloading the Premier Phone support stack. Existing imports were rechecked automatically.');
    let current=await supportStatus();
    if(!current.missing.length)return reconcilePhoneCore();
    const missing=[...current.missing],total=missing.length;
    for(let index=0;index<missing.length;index++)await installSupportComponent(missing[index],index+1,total);
    current=await supportStatus();
    supportSnapshot={checked:true,loading:false,...current};scheduleDecorate();
    if(current.missing.length)throw new Error(`Premier Phone support is still missing ${current.missing.map(row=>row.label||row.id).join(', ')}.`);
    return reconcilePhoneCore();
  })().finally(()=>{supportPromise=null});
  return supportPromise;
}
async function reconcilePhoneCore({onProgress}={}){
  await synchronizeImportedModels();
  const current=bridge(),receipt=current?.pending?.(PREMIER);if(!receipt?.large?.length)throw new Error('There is no completed Premier Phone Pack browser-import receipt to reconcile.');
  const missing=current.unimportedRecords?.(receipt)||[];if(missing.length)throw new Error(`${missing.length} LiteRT model file${missing.length===1?' is':'s are'} still not imported.`);
  const modelStates=[];
  for(let index=0;index<FAST_IDS.length;index++){
    const id=FAST_IDS[index];try{onProgress?.({phase:'recognizing-model',completed:index,total:FAST_IDS.length,modelId:id,message:`Recognizing imported ${id===E2?'Gemma 4 E2B':'Gemma 4 E4B'} LiteRT model…`})}catch{}
    modelStates.push(await recognizeImportedModel(id));
  }
  const unavailable=modelStates.filter(row=>!row?.available);if(unavailable.length)throw new Error(`The imported LiteRT files are present in the receipt but ${unavailable.map(row=>row?.label||row?.id).join(' and ')} are not yet readable from local model storage.`);
  const support=await supportStatus();supportSnapshot={checked:true,loading:false,...support};scheduleDecorate();
  if(support.missing.length)throw new Error(`The two Gemma LiteRT models are installed. Download the remaining support files internally: ${support.missing.map(row=>row.label||row.id).join(', ')}.`);
  try{onProgress?.({phase:'reconciling-pack',completed:FAST_IDS.length,total:FAST_IDS.length,message:'Phone models and internally stored support stack recognized · finalizing the pack…'})}catch{}
  try{phone()?.applyAuthority?.()}catch{}
  const packStatus=await packs()?.status?.(PREMIER);
  if(!packStatus?.available){
    const missingComponents=(packStatus?.components||[]).filter(row=>!row.available).map(row=>row.label||labelFor(row.id)).filter(Boolean);
    throw new Error(`Premier Phone still reports missing ${missingComponents.slice(0,5).join(', ')||'one or more support components'}. The two large Gemma files do not need to be imported again.`);
  }
  try{dispatchEvent(new CustomEvent('civweave:local-model-pack-installed',{detail:{version:VERSION,id:PREMIER,label:'Premier Phone Pack',source:'gemma4-phone-reconcile'}}))}catch{}
  statusLine('Premier Phone Pack is ready. Choose the fast or deep Gemma 4 LiteRT phone model.');
  scheduleDecorate();return packStatus;
}
async function refreshSupportStatus({autoReconcile=true}={}){
  if(supportSnapshot.loading)return supportSnapshot;
  supportSnapshot={...supportSnapshot,loading:true};scheduleDecorate();
  try{
    const synced=await synchronizeImportedModels();if(!synced.complete)return null;
    const current=await supportStatus();supportSnapshot={checked:true,loading:false,...current};
    if(autoReconcile&&!current.missing.length){
      try{phone()?.applyAuthority?.();await packs()?.status?.(PREMIER)}catch{}
    }
    return supportSnapshot;
  }finally{supportSnapshot={...supportSnapshot,loading:false};scheduleDecorate()}
}
async function useModel(modelId){const checked=await recognizeImportedModel(modelId);if(!checked?.available)throw new Error(`${checked?.label||modelId} is not installed.`);const m=manager();if(!m?.select)throw new Error('Local model manager is unavailable.');m.select(modelId);return checked}
function onClick(event){
  const support=event.target?.closest?.('[data-gemma4-phone-support]');
  if(support){event.preventDefault();event.stopImmediatePropagation();support.disabled=true;void downloadSupportFiles().catch(error=>statusLine(String(error?.message||error),true)).finally(()=>{support.disabled=false;void refreshSupportStatus({autoReconcile:true})});return}
  const reconcile=event.target?.closest?.('[data-gemma4-phone-reconcile]');
  if(reconcile){event.preventDefault();event.stopImmediatePropagation();reconcile.disabled=true;statusLine('Finalizing the Premier Phone Pack…');void reconcilePhoneCore({onProgress:progress=>{if(progress?.message)statusLine(progress.message)}}).catch(error=>statusLine(String(error?.message||error),true)).finally(()=>{reconcile.disabled=false;void refreshSupportStatus({autoReconcile:true})});return}
  const use=event.target?.closest?.('[data-gemma4-phone-use]');if(!use)return;
  event.preventDefault();event.stopImmediatePropagation();use.disabled=true;void useModel(use.dataset.gemma4PhoneUse).then(row=>statusLine(`${row.label||'Gemma 4'} selected for local phone work.`)).catch(error=>statusLine(String(error?.message||error),true)).finally(()=>{use.disabled=false;scheduleDecorate()});
}
document.addEventListener('click',onClick,true);
for(const name of ['civweave:model-settings-opened','civweave:settings-opened','civweave:local-model-pack-progress','civweave:local-model-pack-installed','civweave:local-model-downloaded','civweave:gemma4-support-progress','pageshow'])addEventListener(name,()=>{scheduleDecorate();if(pendingSummary().complete)void refreshSupportStatus({autoReconcile:true})});
globalThis.CivweaveGemma4DualQ4ActionsV1=Object.freeze({
  version:VERSION,primaryModel:E2,deepModel:E4,packId:PREMIER,supportIds:SUPPORT_IDS,supportWorker:SUPPORT_WORKER,
  scheduleDecorate,decorateSettings:decorateCurrentPhone,pendingSummary,reconcilePhoneCore,useModel,synchronizeImportedModels,recognizeImportedModel,repairPremierReceipt,supportStatus,refreshSupportStatus,downloadSupportFiles,
  compatibilityOnly:true,currentPhoneAuthority:true,presentationOwnership:true,singlePresentationOwner:true,
  mutationObserverGuarded:false,mutationObserver:false,q4PresentationRetired:true,
  completedImportReconciliation:true,opfsReceiptReconciliation:true,preservesExistingLargeFiles:true,fullPackReinstallRequired:false,
  missingSupportDownloadAction:true,supportDownloadsWorkerOnly:true,supportLargeFileReimportRequired:false,supportFilesInternal:true,supportAutoDetect:true,browserReceiptGemmaOnly:true
});
void synchronizeImportedModels().catch(()=>null).then(()=>refreshSupportStatus({autoReconcile:true})).catch(()=>null).finally(scheduleDecorate);
})();