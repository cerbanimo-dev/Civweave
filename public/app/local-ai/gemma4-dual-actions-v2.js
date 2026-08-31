(()=>{
'use strict';
const VERSION='1.2.2-gemma4-dual-actions-v2-single-owner-opfs-reconcile';
const PREMIER='premier-phone';
const E2='gemma4-e2b-it-litert-web';
const E4='gemma4-e4b-it-litert-web';
const FAST_IDS=Object.freeze([E2,E4]);
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const MODEL_FILES=Object.freeze({
  [E2]:Object.freeze({path:'gemma-4-E2B-it-web.litertlm',minBytes:2_000_000_000,label:'Gemma 4 E2B LiteRT'}),
  [E4]:Object.freeze({path:'gemma-4-E4B-it-web.litertlm',minBytes:2_950_000_000,label:'Gemma 4 E4B LiteRT'})
});
if(globalThis.CivweaveGemma4DualQ4ActionsV1?.version===VERSION)return;
const phone=()=>globalThis.CivweaveGemma4PhonePerformanceCoreV1;
const handoff=()=>globalThis.CivweaveGemma4BrowserPackCoherenceV1;
const bridge=()=>globalThis.CivweaveBrowserPackDownloadV1;
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const packs=()=>globalThis.CivweaveLocalModelPacksV1;
const opfs=()=>globalThis.CivweaveGemma4OPFSStorageV1;
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const stateMap=()=>parse(localStorage.getItem('civweave.local-ai.packs.v1'),{});
let timers=[];
function setText(node,value){if(!node)return false;const next=String(value??'');if(node.textContent===next)return false;node.textContent=next;return true}
function setHtml(node,value){if(!node)return false;const next=String(value??'');if(node.innerHTML===next)return false;node.innerHTML=next;return true}
function pendingSummary(){
  const current=bridge(),receipt=current?.pending?.(PREMIER)||null,missing=receipt&&current?.unimportedRecords?current.unimportedRecords(receipt):[];
  return{receipt,missing,imported:receipt?.importedKeys?.length||0,total:receipt?.large?.length||0,complete:Boolean(receipt?.large?.length&&(receipt.importedKeys?.length||0)===receipt.large.length)};
}
function statusLine(text,error=false){const node=document.querySelector('#cw-local-ai-v324 [data-local-status]');if(node){setText(node,text);node.classList.toggle('cw-local-error',Boolean(error))}}
function directActions(card){return[...card.children].find(node=>node.classList?.contains('cw-local-actions'))||null}
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
  if(!current?.ok)throw new Error(`${spec.label} is recorded as imported, but its OPFS file is not readable. Do not re-upload it yet; Civweave needs to repair the local storage record.`);
  const state=writeDownloadReady(id,current.bytes);
  try{dispatchEvent(new CustomEvent('civweave:local-model-downloaded',{detail:{version:VERSION,id,bytes:current.bytes,storageBackend:'opfs',reconciled:true}}))}catch{}
  if(m?.status){
    try{const checked=await m.status(id);if(checked?.available)return checked}catch{}
  }
  return{id,label:spec.label,available:true,installed:true,state,bytes:current.bytes,storageBackend:'opfs',reconciled:true};
}
async function synchronizeImportedModels(){
  const summary=pendingSummary();if(!summary.complete)return{complete:false,models:[]};
  const models=[];for(const id of FAST_IDS)models.push(await recognizeImportedModel(id));
  return{complete:true,models};
}
function decorateCurrentPhone(){
  const card=document.querySelector('#cw-local-ai-v324 [data-pack-id="premier-phone"]');if(!card)return false;
  const paragraphs=[...card.children].filter(node=>node.tagName==='P');
  if(paragraphs[0])setText(paragraphs[0],'Gemma 4 E2B LiteRT is the fast phone lane and E4B LiteRT is the deep phone lane. Q4F16 and Q2F16 files are compatibility-only and never replace the optimized phone models.');
  if(paragraphs[1])setHtml(paragraphs[1],'<b>Target:</b> 12 GB RAM · modern Android-class WebGPU · one Gemma lane loaded at a time');
  if(paragraphs[2])setHtml(paragraphs[2],'<b>Storage:</b> ~6.9 GB current phone core · legacy ONNX/Q2 files may be kept or removed separately');
  if(paragraphs[3])setText(paragraphs[3],'Gemma 4 E2B LiteRT fast · Gemma 4 E4B LiteRT deep · Qwen 3 0.6B CPU fallback · Silero · Parakeet INT8 · Omnilingual 300M INT8 · Supertonic 3');
  card.querySelector('[data-gemma4-core-note]')?.remove();
  card.querySelector('[data-gemma4-runnable-note]')?.remove();
  card.querySelector('[data-gemma4-performance-note]')?.remove();
  const summary=pendingSummary(),state=stateMap()[PREMIER]||{},actions=directActions(card);
  if(actions&&summary.complete&&state.status!=='ready'){
    const html='<button type="button" data-gemma4-phone-reconcile>Finish phone performance core</button>';
    if(actions.innerHTML!==html)actions.innerHTML=html;
  }else if(actions&&state.status==='ready'){
    const html='<button type="button" data-gemma4-phone-use="gemma4-e2b-it-litert-web">Use fast phone model</button><button type="button" data-gemma4-phone-use="gemma4-e4b-it-litert-web">Use deep phone model</button>';
    if(actions.innerHTML!==html)actions.innerHTML=html;
  }
  card.dataset.gemma4CurrentPhoneOwner=VERSION;
  return true;
}
function runDecorators(){
  try{decorateCurrentPhone()}catch{}
  // Presentation has exactly one owner: this module. The phone-performance core
  // remains the registry/pack authority but is not allowed to rewrite Settings.
  try{handoff()?.scheduleDecorate?.()}catch{}
}
function scheduleDecorate(){
  for(const timer of timers)clearTimeout(timer);timers=[];
  queueMicrotask(runDecorators);
  for(const delay of [220,650,1350])timers.push(setTimeout(runDecorators,delay));
  return true;
}
async function reconcilePhoneCore({onProgress}={}){
  const current=bridge(),receipt=current?.pending?.(PREMIER);if(!receipt?.large?.length)throw new Error('There is no completed Premier Phone Pack browser-import receipt to reconcile.');
  const missing=current.unimportedRecords?.(receipt)||[];if(missing.length)throw new Error(`${missing.length} LiteRT model file${missing.length===1?' is':'s are'} still not imported.`);
  const modelStates=[];
  for(let index=0;index<FAST_IDS.length;index++){
    const id=FAST_IDS[index];try{onProgress?.({phase:'recognizing-model',completed:index,total:FAST_IDS.length,modelId:id,message:`Recognizing imported ${id===E2?'Gemma 4 E2B':'Gemma 4 E4B'} LiteRT model…`})}catch{}
    modelStates.push(await recognizeImportedModel(id));
  }
  const unavailable=modelStates.filter(row=>!row?.available);if(unavailable.length)throw new Error(`The imported LiteRT files are present in the receipt but ${unavailable.map(row=>row?.label||row?.id).join(' and ')} are not yet readable from local model storage.`);
  try{onProgress?.({phase:'reconciling-pack',completed:FAST_IDS.length,total:FAST_IDS.length,message:'Phone models recognized · reconciling the existing support stack…'})}catch{}
  try{phone()?.applyAuthority?.()}catch{}
  const packStatus=await packs()?.status?.(PREMIER);
  if(!packStatus?.available){
    const missingComponents=(packStatus?.components||[]).filter(row=>!row.available).map(row=>row.label||row.id).filter(Boolean);
    throw new Error(`The two Gemma LiteRT models are installed, but the Premier Phone Pack still needs ${missingComponents.slice(0,3).join(', ')||'one or more support components'}. The large model files do not need to be imported again.`);
  }
  try{dispatchEvent(new CustomEvent('civweave:local-model-pack-installed',{detail:{version:VERSION,id:PREMIER,label:'Premier Phone Pack',source:'gemma4-phone-reconcile'}}))}catch{}
  statusLine('Premier Phone Pack is ready. Both Gemma 4 LiteRT phone models were recognized without re-importing the files.');
  scheduleDecorate();return packStatus;
}
async function useModel(modelId){const checked=await recognizeImportedModel(modelId);if(!checked?.available)throw new Error(`${checked?.label||modelId} is not installed.`);const m=manager();if(!m?.select)throw new Error('Local model manager is unavailable.');m.select(modelId);return checked}
function onClick(event){
  const reconcile=event.target?.closest?.('[data-gemma4-phone-reconcile]');
  if(reconcile){event.preventDefault();event.stopImmediatePropagation();reconcile.disabled=true;statusLine('Recognizing the two imported Gemma 4 LiteRT files…');void reconcilePhoneCore({onProgress:progress=>{if(progress?.message)statusLine(progress.message)}}).catch(error=>statusLine(String(error?.message||error),true)).finally(()=>{reconcile.disabled=false;scheduleDecorate()});return}
  const use=event.target?.closest?.('[data-gemma4-phone-use]');if(!use)return;
  event.preventDefault();event.stopImmediatePropagation();use.disabled=true;void useModel(use.dataset.gemma4PhoneUse).then(row=>statusLine(`${row.label||'Gemma 4'} selected for local phone work.`)).catch(error=>statusLine(String(error?.message||error),true)).finally(()=>{use.disabled=false;scheduleDecorate()});
}
document.addEventListener('click',onClick,true);
for(const name of ['civweave:model-settings-opened','civweave:settings-opened','civweave:local-model-pack-progress','civweave:local-model-pack-installed','civweave:local-model-downloaded','pageshow'])addEventListener(name,scheduleDecorate);
globalThis.CivweaveGemma4DualQ4ActionsV1=Object.freeze({
  version:VERSION,primaryModel:E2,deepModel:E4,packId:PREMIER,
  scheduleDecorate,decorateSettings:decorateCurrentPhone,pendingSummary,reconcilePhoneCore,useModel,synchronizeImportedModels,recognizeImportedModel,
  compatibilityOnly:true,currentPhoneAuthority:true,presentationOwnership:true,singlePresentationOwner:true,
  mutationObserverGuarded:false,mutationObserver:false,q4PresentationRetired:true,
  completedImportReconciliation:true,opfsReceiptReconciliation:true,preservesExistingLargeFiles:true,fullPackReinstallRequired:false
});
void synchronizeImportedModels().catch(()=>null).finally(scheduleDecorate);
})();