(()=>{
'use strict';

const VERSION='1.1.0-gemma4-dual-q4-actions-v1-retry-import';
const PREMIER='premier-phone';
const E2='gemma4-e2b-it-q4f16';
const E4='gemma4-e4b-it-q4f16';
const LARGE_BYTES=32*1024*1024;
const GENERATIVE_CACHE='civweave-model-generative-v266';
const SPECIALIZED_CACHE='civweave-specialized-model-packs-v1';
const DEFAULT_PENDING_KEY='civweave.ai-pack.browser-downloads.v1';
const DEFAULT_PACK_STATE_KEY='civweave.local-ai.packs.v1';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const SELECTION_KEY='civweave.local-ai.selection.v266';

if(globalThis.CivweaveGemma4DualQ4ActionsV1?.version===VERSION)return;

const freeze=value=>Object.freeze(value);
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const bridge=()=>globalThis.CivweaveBrowserPackDownloadV1;
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const packs=()=>globalThis.CivweaveLocalModelPacksV1;
const settings=()=>globalThis.CivweaveSettingsLocalRouteV323;
const deep=()=>globalThis.CivweaveGemma4E4BQ4ExtensionV1;
const cacheFor=kind=>kind==='specialized'?SPECIALIZED_CACHE:GENERATIVE_CACHE;
const maxBytes=row=>Math.max(Number(row?.sizeBytes||0),Number(row?.minBytes||0),Number(row?.expectedBytes||0));
const isLarge=row=>maxBytes(row)>=LARGE_BYTES;

function statusLine(text,error=false){
  const node=document.querySelector('#cw-local-ai-v324 [data-local-status]');
  if(node){node.textContent=String(text||'');node.classList.toggle('cw-local-error',Boolean(error))}
}
function pendingKey(){return bridge()?.pendingKey||DEFAULT_PENDING_KEY}
function packStateKey(){return bridge()?.packStateKey||DEFAULT_PACK_STATE_KEY}
function pendingMap(){return parse(localStorage.getItem(pendingKey()),{})}
function savePending(packId,value){const map=pendingMap();map[packId]=value;localStorage.setItem(pendingKey(),JSON.stringify(map));return value}
function packStateMap(){return parse(localStorage.getItem(packStateKey()),{})}
function setPackState(pack,patch={}){
  const map=packStateMap(),previous=map[pack.id]||{};
  const next={...previous,...patch,downloadMode:'browser',error:'',updatedAt:now()};
  map[pack.id]=next;
  try{localStorage.setItem(packStateKey(),JSON.stringify(map))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:local-model-pack-progress',{detail:{version:VERSION,id:pack.id,state:{...next}}}))}catch{}
  return next;
}
function selection(){return parse(localStorage.getItem(SELECTION_KEY),{active:false,id:null})}
function downloads(){return parse(localStorage.getItem(DOWNLOADS_KEY),{})}

async function cached(record){
  const response=await (await caches.open(cacheFor(record.kind))).match(record.url);
  if(!response?.ok)return{ok:false,bytes:0};
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(type.includes('text/html'))return{ok:false,bytes:0};
  const bytes=Number(response.headers.get('content-length')||0);
  const minimum=Number(record.minBytes||0);
  return{ok:!bytes||!minimum||bytes>=minimum*.97,bytes:bytes||Number(record.expectedBytes||record.sizeBytes||record.minBytes||0)};
}
async function fetchSmall(record){
  const current=await cached(record);if(current.ok)return current;
  if(isLarge(record))return{ok:false,bytes:0,large:true};
  const response=await fetch(record.url,{cache:'no-store',redirect:'follow'});
  if(!response.ok)throw new Error(`${record.label||record.componentId} · ${record.path} returned HTTP ${response.status}.`);
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(type.includes('text/html'))throw new Error(`${record.label||record.componentId} · ${record.path} returned HTML instead of model data.`);
  const declared=Number(response.headers.get('content-length')||0),minimum=Number(record.minBytes||0);
  if(declared&&minimum&&declared<minimum*.97)throw new Error(`${record.label||record.componentId} · ${record.path} was incomplete.`);
  if(/\.json$/i.test(record.path)){try{JSON.parse(await response.clone().text())}catch{throw new Error(`${record.label||record.componentId} · ${record.path} was not valid JSON.`)}}
  await (await caches.open(cacheFor(record.kind))).put(record.url,response);
  return{ok:true,bytes:declared||Number(record.expectedBytes||record.sizeBytes||record.minBytes||0)};
}
function recordForModel(model,artifact){
  return{
    kind:'generative',componentId:model.id,label:model.label,path:artifact.path,
    url:registry().directUrl(model,artifact.path),minBytes:Number(artifact.minBytes||1),
    sizeBytes:Number(artifact.sizeBytes||0),expectedBytes:Number(artifact.sizeBytes||artifact.minBytes||0),required:Boolean(artifact.required)
  };
}

async function ensureActionModules(){
  if(typeof settings()?.ensureActionModules==='function')await settings().ensureActionModules();
  deep()?.activate?.();
  if(!bridge()?.receiptFor||!bridge()?.recordsFor||!bridge()?.retryMissing||!bridge()?.pickAndImport||!manager()?.status||!registry()?.byId||!packs()?.byId)throw new Error('The local Gemma 4 download modules did not become ready.');
  return true;
}

async function finishModel(modelId,{onProgress}={}){
  await ensureActionModules();
  const model=registry().byId(modelId);if(!model)throw new Error(`Unknown Gemma 4 model: ${modelId}`);
  const required=(model.artifacts||[]).filter(row=>row.required).map(row=>recordForModel(model,row));
  const missingLarge=[];
  for(let index=0;index<required.length;index++){
    const record=required[index],current=await cached(record);
    if(current.ok)continue;
    if(isLarge(record)){missingLarge.push(record);continue}
    try{onProgress?.({phase:'finishing-model-support',modelId,record,completed:index+1,total:required.length,message:`Finishing ${model.label} support file · ${record.path}`})}catch{}
    await fetchSmall(record);
  }
  const checked=await manager().status(modelId);
  return{model,available:Boolean(checked.available),status:checked,missingLarge};
}

async function prepareCurrentReceipt(packId=PREMIER,{onProgress}={}){
  await ensureActionModules();
  const b=bridge(),pack=packs().byId(packId),fresh=b.receiptFor(pack),old=b.pending(packId);
  const oldImported=new Set(old?.importedKeys||[]),oldStarted=new Set(old?.startedKeys||[]),oldBytes=old?.importedByteSizes||{};
  const importedKeys=[],startedKeys=[],importedByteSizes={};
  for(const record of fresh.large){
    const current=await cached(record);
    if(oldImported.has(record.key)||current.ok){
      importedKeys.push(record.key);importedByteSizes[record.key]=Number(oldBytes[record.key]||current.bytes||record.expectedBytes||0);continue;
    }
    if(oldStarted.has(record.key))startedKeys.push(record.key);
  }
  const receipt=savePending(packId,{...fresh,createdAt:old?.createdAt||fresh.createdAt,queuedAt:old?.queuedAt||'',importedKeys,startedKeys,importedByteSizes,completed:false,migratedAt:now(),migrationSource:VERSION});
  const count=receipt.large.length,percent=Math.floor(importedKeys.length/Math.max(1,count)*100);
  const state=setPackState(pack,{status:importedKeys.length?'browser-partial':'browser-queued',phase:'waiting-for-browser-downloads',percent:Math.min(99,percent),completedBytes:importedKeys.reduce((sum,key)=>sum+Number(importedByteSizes[key]||0),0),totalBytes:Number(pack.estimatedBytes||receipt.largeBytes||0),browserExpectedFiles:count,browserImportedFiles:importedKeys.length,browserStartedFiles:startedKeys.length,browserRemainingFiles:Math.max(0,count-importedKeys.length),browserLargeBytes:Number(receipt.largeBytes||0),errorCode:''});
  try{onProgress?.({phase:'receipt-migrated',pack,receipt,state,message:`Recognized ${importedKeys.length}/${count} already-cached large files for the current Gemma 4 core.`})}catch{}
  return{pack,receipt,state};
}

function pendingSummary(){
  const b=bridge(),receipt=b?.pending?.(PREMIER)||null;
  if(!receipt)return{receipt:null,missing:[],startedMissing:[],unstartedMissing:[],imported:0,total:0};
  const missing=b.unimportedRecords(receipt),started=new Set(receipt.startedKeys||[]);
  const startedMissing=missing.filter(row=>started.has(row.key)),unstartedMissing=missing.filter(row=>!started.has(row.key));
  return{receipt,missing,startedMissing,unstartedMissing,imported:(receipt.importedKeys||[]).length,total:(receipt.large||[]).length};
}

async function finishCurrentPack(packId=PREMIER,{onProgress}={}){
  const prepared=await prepareCurrentReceipt(packId,{onProgress}),{pack,receipt}=prepared,b=bridge();
  const missingLarge=b.unimportedRecords(receipt);
  if(missingLarge.length)return{pack,receipt,available:false,needsDownloads:true,missing:missingLarge};
  const all=b.recordsFor(pack),small=all.filter(row=>!row.large);
  for(let index=0;index<small.length;index++){
    try{onProgress?.({phase:'finishing-small',pack,record:small[index],completed:index+1,total:small.length,message:`Finishing smaller support files · ${index+1}/${small.length}`})}catch{}
    await fetchSmall(small[index]);
  }
  const incomplete=[];
  for(const record of all){const check=await cached(record);if(!check.ok)incomplete.push(record)}
  if(incomplete.length)throw new Error(`${incomplete.length} current pack file${incomplete.length===1?' is':'s are'} still missing: ${incomplete.slice(0,2).map(row=>`${row.label} · ${row.path}`).join('; ')}.`);
  await finishModel(E2,{onProgress});
  await finishModel(E4,{onProgress});
  const installedBytes=all.reduce((sum,row)=>sum+Number(row.expectedBytes||row.sizeBytes||row.minBytes||0),0);
  const completed=savePending(packId,{...receipt,startedKeys:[],completed:true,completedAt:now()});
  const state=setPackState(pack,{status:'ready',phase:'ready',percent:100,completedBytes:installedBytes||pack.estimatedBytes,totalBytes:installedBytes||pack.estimatedBytes,installedBytes:installedBytes||pack.estimatedBytes,installedAt:packStateMap()[packId]?.installedAt||now(),browserExpectedFiles:completed.large.length,browserImportedFiles:completed.importedKeys.length,browserStartedFiles:0,browserRemainingFiles:0,browserLargeBytes:Number(completed.largeBytes||0),primaryModel:E2,deepModel:E4,errorCode:''});
  try{dispatchEvent(new CustomEvent('civweave:local-model-pack-installed',{detail:{version:VERSION,id:pack.id,label:pack.label,source:'gemma4-dual-q4-recovery'}}))}catch{}
  return{pack,receipt:completed,state,available:true,needsDownloads:false};
}

async function advanceCore({onProgress}={}){
  await ensureActionModules();
  const e2=await finishModel(E2,{onProgress}).catch(error=>({available:false,error,missingLarge:[]}));
  const e4=await finishModel(E4,{onProgress}).catch(error=>({available:false,error,missingLarge:[]}));
  const prepared=await prepareCurrentReceipt(PREMIER,{onProgress}),b=bridge(),missing=b.unimportedRecords(prepared.receipt);
  if(missing.length){
    const started=new Set(prepared.receipt.startedKeys||[]),startedMissing=missing.filter(row=>started.has(row.key)),unstartedMissing=missing.filter(row=>!started.has(row.key));
    if(!unstartedMissing.length)return{available:false,needsDownloads:true,needsImport:true,retryAvailable:true,missing,startedMissing,e2Available:Boolean(e2.available),e4Available:Boolean(e4.available)};
    const next=await b.queueNext(PREMIER,{onProgress});
    return{available:false,needsDownloads:true,next,missing,startedMissing,unstartedMissing,e2Available:Boolean(e2.available),e4Available:Boolean(e4.available)};
  }
  const finished=await finishCurrentPack(PREMIER,{onProgress});
  return{...finished,e2Available:true,e4Available:true};
}

async function retryMissingDownload({onProgress}={}){
  await ensureActionModules();
  await prepareCurrentReceipt(PREMIER,{onProgress});
  const b=bridge(),reset=b.retryMissing(PREMIER);
  if(!reset)throw new Error('There is no pending Gemma 4 browser download to retry.');
  const next=await b.queueNext(PREMIER,{onProgress});
  if(next?.record)return{...next,retried:true};
  return{...next,retried:false};
}

async function importDownloadedFiles({onProgress}={}){
  await ensureActionModules();
  await prepareCurrentReceipt(PREMIER,{onProgress});
  const result=await bridge().pickAndImport(PREMIER,{onProgress});
  if(result?.cancelled)return result;
  const e2=await finishModel(E2,{onProgress}).catch(()=>({available:false}));
  const e4=await finishModel(E4,{onProgress}).catch(()=>({available:false}));
  const summary=pendingSummary();
  if(!summary.missing.length){
    const finished=await finishCurrentPack(PREMIER,{onProgress});
    return{...result,...finished,e2Available:Boolean(e2.available),e4Available:Boolean(e4.available)};
  }
  return{...result,e2Available:Boolean(e2.available),e4Available:Boolean(e4.available),missing:summary.missing};
}

async function useModel(modelId){
  await ensureActionModules();
  const checked=await finishModel(modelId);
  if(!checked.available)throw new Error(`${checked.model.label} still has ${checked.missingLarge.length||checked.status?.missing?.length||1} required file${(checked.missingLarge.length||checked.status?.missing?.length||1)===1?'':'s'} missing.`);
  manager().select(modelId);
  globalThis.CivweaveLocalModelBridgeV266?.patch?.();
  statusLine(`${checked.model.label} is now the interactive local model.`);
  return checked;
}

function directActionContainer(card){return[...card.children].find(node=>node.classList?.contains('cw-local-actions'))||null}
let observedCard=null,cardObserver=null,observerQueued=false;
function ensureCardObserver(card){
  if(typeof MutationObserver!=='function'||observedCard===card)return;
  try{cardObserver?.disconnect?.()}catch{}
  observedCard=card;
  cardObserver=new MutationObserver(()=>{
    if(observerQueued)return;observerQueued=true;
    queueMicrotask(()=>{observerQueued=false;decorateSettings()});
  });
  cardObserver.observe(card,{childList:true,subtree:true});
}
function controlsComplete(actions,{e2Ready,e4Ready,startedCount,unstartedCount}){
  if(e2Ready&&!actions.querySelector(`[data-gemma4-use-model="${E2}"]`))return false;
  if(e4Ready&&!actions.querySelector(`[data-gemma4-use-model="${E4}"]`))return false;
  if(startedCount&&(!actions.querySelector('[data-gemma4-import-downloaded]')||!actions.querySelector('[data-gemma4-retry-missing]')))return false;
  if(unstartedCount&&!actions.querySelector('[data-gemma4-core-advance]'))return false;
  return true;
}
function decorateSettings(){
  const panel=document.getElementById('cw-local-ai-v324'),card=panel?.querySelector?.(`[data-pack-id="${PREMIER}"]`);if(!card)return false;
  ensureCardObserver(card);
  const actions=directActionContainer(card);if(!actions)return false;
  const state=downloads(),selected=selection(),e2Ready=state[E2]?.status==='ready',e4Ready=state[E4]?.status==='ready',pending=pendingSummary();
  const startedCount=pending.startedMissing.length,unstartedCount=pending.unstartedMissing.length,missingCount=pending.missing.length;
  const signature=[e2Ready,e4Ready,selected.active?selected.id:'',packStateMap()[PREMIER]?.status||'',pending.imported,pending.total,startedCount,unstartedCount].join('|');
  if(actions.dataset.gemma4DualQ4Signature===signature&&controlsComplete(actions,{e2Ready,e4Ready,startedCount,unstartedCount}))return true;
  const buttons=[];
  if(e2Ready)buttons.push(`<button type="button" data-gemma4-use-model="${E2}">${selected.active&&selected.id===E2?'Using E2B':'Use E2B'}</button>`);
  if(e4Ready)buttons.push(`<button type="button" data-gemma4-use-model="${E4}">${selected.active&&selected.id===E4?'Using E4B':'Use E4B'}</button>`);
  if(startedCount){
    buttons.push('<button type="button" data-gemma4-import-downloaded>Import downloaded files</button>');
    buttons.push(`<button type="button" data-gemma4-retry-missing>Retry missing download${missingCount===1?'':'s'}</button>`);
  }
  if(unstartedCount||(!missingCount&&(!e2Ready||!e4Ready)))buttons.push(`<button type="button" data-gemma4-core-advance>${e2Ready&&!e4Ready?'Continue E4B Q4F16 core':'Complete Q4F16 core'}</button>`);
  if(e2Ready&&e4Ready&&!missingCount)buttons.push('<button type="button" data-local-pack-remove="premier-phone">Remove pack</button>');
  actions.innerHTML=buttons.join('');actions.dataset.gemma4DualQ4Signature=signature;
  let note=card.querySelector('[data-gemma4-runnable-note]');if(!note){note=document.createElement('p');note.className='cw-local-meta';note.dataset.gemma4RunnableNote='';actions.before(note)}
  if(startedCount)note.textContent=`${e2Ready?'E2B Q4F16 is runnable now. ':''}${startedCount} browser download${startedCount===1?' was':'s were'} started but not imported. Import a completed file, or retry it if the browser download was partial or cancelled.`;
  else if(e2Ready&&e4Ready)note.textContent='Both Gemma 4 Q4F16 lanes are runnable. Choose E2B for the fast lane or E4B for deeper local work.';
  else if(e2Ready)note.textContent='E2B Q4F16 is runnable now. You can use it immediately while E4B Q4F16 is completed separately.';
  else if(e4Ready)note.textContent='E4B Q4F16 is runnable now. E2B Q4F16 still needs its remaining core files.';
  else note.textContent='Existing imported Gemma 4 files will be reused. Complete core only downloads or repairs files that are still missing.';
  return true;
}

let decorateTimer=0;
function scheduleDecorate(){
  clearTimeout(decorateTimer);const waits=[0,50,160,420,900,1800];let index=0;
  const run=()=>{decorateSettings();index+=1;if(index<waits.length)decorateTimer=setTimeout(run,waits[index])};
  decorateTimer=setTimeout(run,waits[0]);
}
async function handleCore(button){
  button.disabled=true;statusLine('Checking the Gemma 4 Q4F16 core and reusing files already on this device…');
  try{
    const result=await advanceCore({onProgress:progress=>{if(progress?.message)statusLine(progress.message)}});
    if(result.needsImport)statusLine('A Gemma 4 browser download was started but has not been imported. Import the completed file, or use Retry missing download if it was partial or cancelled.');
    else if(result.e2Available&&!result.e4Available&&result.next?.record)statusLine('Gemma 4 E2B Q4F16 is ready to use now. The next E4B Q4F16 browser file has been started.');
    else if(result.available)statusLine('Gemma 4 E2B and E4B Q4F16 are both ready to use locally.');
    else if(result.needsDownloads)statusLine('Existing Gemma 4 files were kept. The next missing Q4F16 core file has been started in the browser.');
  }catch(error){statusLine(String(error?.message||error),true)}finally{button.disabled=false;scheduleDecorate()}
}
async function handleImport(button){
  button.disabled=true;statusLine('Choose the completed Gemma 4 file from your browser downloads.');
  try{
    const result=await importDownloadedFiles({onProgress:progress=>{if(progress?.message)statusLine(progress.message)}});
    if(result?.cancelled)statusLine('Import cancelled. Your existing local files were left unchanged.');
    else if(result?.available)statusLine('Gemma 4 E2B and E4B Q4F16 are ready locally.');
    else if(result?.missing?.length)statusLine(`Imported the completed file. ${result.missing.length} large Gemma 4 file${result.missing.length===1?' remains':'s remain'}.`);
    else statusLine('Imported the completed Gemma 4 browser file.');
  }catch(error){statusLine(String(error?.message||error),true)}finally{button.disabled=false;scheduleDecorate()}
}
async function handleRetry(button){
  button.disabled=true;statusLine('Resetting the stuck browser-download marker and starting the missing Gemma 4 file again…');
  try{
    const result=await retryMissingDownload({onProgress:progress=>{if(progress?.message)statusLine(progress.message)}});
    if(result?.record)statusLine(`Restarted ${result.record.label} · ${result.record.basename}. When it finishes, use Import downloaded files.`);
    else statusLine('No unimported Gemma 4 browser file remains to retry.');
  }catch(error){statusLine(String(error?.message||error),true)}finally{button.disabled=false;scheduleDecorate()}
}
function onWindowClick(event){
  const use=event.target?.closest?.('[data-gemma4-use-model]');
  if(use){event.preventDefault();event.stopImmediatePropagation();const id=String(use.dataset.gemma4UseModel||'');use.disabled=true;void useModel(id).catch(error=>statusLine(String(error?.message||error),true)).finally(()=>{use.disabled=false;scheduleDecorate()});return}
  const imported=event.target?.closest?.('[data-gemma4-import-downloaded]');
  if(imported){event.preventDefault();event.stopImmediatePropagation();void handleImport(imported);return}
  const retry=event.target?.closest?.('[data-gemma4-retry-missing]');
  if(retry){event.preventDefault();event.stopImmediatePropagation();void handleRetry(retry);return}
  const core=event.target?.closest?.('[data-gemma4-core-advance],[data-gemma4-core-complete]');
  if(core){event.preventDefault();event.stopImmediatePropagation();void handleCore(core);return}
}

window.addEventListener('click',onWindowClick,true);
for(const name of ['civweave:model-settings-opened','civweave:settings-opened','civweave:local-model-download-progress','civweave:local-model-downloaded','civweave:local-model-selection','civweave:local-model-pack-progress','civweave:local-model-pack-installed','pageshow'])addEventListener(name,scheduleDecorate);
scheduleDecorate();

globalThis.CivweaveGemma4DualQ4ActionsV1=freeze({
  version:VERSION,primaryModel:E2,deepModel:E4,packId:PREMIER,
  ensureActionModules,finishModel,prepareCurrentReceipt,finishCurrentPack,advanceCore,retryMissingDownload,importDownloadedFiles,useModel,decorateSettings,scheduleDecorate,pendingSummary,
  preservesExistingLargeFiles:true,partialCoreUsable:true,e2UsableBeforeE4:true,smallFileRecovery:true,fullPackReinstallRequired:false,
  stuckBrowserDownloadRetry:true,browserImportAction:true,startedIsNotCompleted:true,mutationObserverGuarded:true
});
})();
