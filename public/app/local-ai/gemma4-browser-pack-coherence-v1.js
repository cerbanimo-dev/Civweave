(()=>{
'use strict';

const VERSION='1.0.1-gemma4-browser-pack-coherence-v1-status-sync';
const PREMIER='premier-phone';
const FAST_E2='gemma4-e2b-it-litert-web';
const FAST_E4='gemma4-e4b-it-litert-web';
const FAST_IDS=Object.freeze([FAST_E2,FAST_E4]);
const BRIDGE_VERSION_PREFIX='1.3.';
const BRIDGE_SRC='/app/local-ai/browser-pack-download-v1.js?v=1.3.0-progress-and-final-match';
const PROFILE_ID='cw-gemma4-litert-fast-upgrade-v1';
const ERROR_ATTR='data-gemma4-browser-handoff-error';
if(globalThis.CivweaveGemma4BrowserPackCoherenceV1?.version===VERSION)return;

const freeze=value=>Object.freeze(value);
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const packs=()=>globalThis.CivweaveLocalModelPacksV1;
const bridge=()=>globalThis.CivweaveBrowserPackDownloadV1;
const authority=()=>globalThis.CivweaveGemma4PhonePerformanceCoreV1;
const pwa=()=>globalThis.CivweaveBrowserPackPwaImportV1;
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}};
const fmt=bytes=>`${(Number(bytes||0)/1e9).toFixed(1)} GB`;
let bridgeFlight=null,decorateQueued=false,observer=null;

function activateAuthority(){
  try{authority()?.activate?.()}catch{}
  try{globalThis.CivweaveGemma4Q2RetirementV1?.scheduleDecorate?.()}catch{}
  return Boolean(authority()?.packId===PREMIER||packs()?.byId?.(PREMIER));
}
function ensureBridge(){
  const ready=()=>Boolean(bridge()?.prepare&&bridge()?.markStarted&&bridge()?.pickAndImport&&String(bridge()?.version||'').startsWith(BRIDGE_VERSION_PREFIX));
  if(ready())return Promise.resolve(bridge());
  if(bridgeFlight)return bridgeFlight;
  bridgeFlight=new Promise((resolve,reject)=>{
    const path=new URL(BRIDGE_SRC,location.href).pathname;
    const existing=[...document.scripts].find(node=>{try{return new URL(node.src,location.href).pathname===path}catch{return false}});
    if(existing&&!ready())try{existing.remove()}catch{}
    if(ready()){resolve(bridge());return}
    const script=document.createElement('script');script.src=`${BRIDGE_SRC}&cwGemma4Browser=${Date.now()}`;script.async=false;script.dataset.civweaveGemma4BrowserPack='';
    script.onload=()=>ready()?resolve(bridge()):reject(new Error('The browser-managed AI download bridge loaded without becoming ready.'));
    script.onerror=()=>reject(new Error('The browser-managed AI download bridge could not load.'));
    document.head?.append(script);
  }).finally(()=>{bridgeFlight=null});
  return bridgeFlight;
}
function profileCard(){return document.getElementById(PROFILE_ID)}
function premierCard(){return document.querySelector('#cw-local-ai-v324 [data-pack-id="premier-phone"]')}
function showError(message=''){
  const card=profileCard();if(!card)return;
  let note=card.querySelector(`[${ERROR_ATTR}]`);
  if(!message){note?.remove();return}
  if(!note){note=document.createElement('p');note.setAttribute(ERROR_ATTR,'');note.className='cw-local-meta cw-local-error';card.append(note)}
  note.textContent=message;
}
function receiptInfo(){
  const current=bridge();const receipt=current?.pending?.(PREMIER);if(!receipt)return{receipt:null,started:new Set(),imported:new Set(),rows:[]};
  return{receipt,started:new Set(receipt.startedKeys||[]),imported:new Set(receipt.importedKeys||[]),rows:receipt.large||[]};
}
function rowFor(id){const info=receiptInfo();return{...info,row:info.rows.find(row=>row.componentId===id)||null}}
function dispatchBrowserDownload(current,record){
  const link=document.createElement('a');link.href=current.downloadUrl(record);link.download=record.basename;link.rel='noopener';link.style.display='none';document.body.append(link);link.click();link.remove();
  current.markStarted(PREMIER,record.key);try{pwa()?.scheduleSync?.()}catch{}
  emit('civweave:gemma4-browser-download-started',{packId:PREMIER,modelId:record.componentId,recordKey:record.key,basename:record.basename});
}
async function prepareCurrentPack(onProgress){
  activateAuthority();const current=await ensureBridge();activateAuthority();
  const result=await current.prepare(PREMIER,{onProgress});
  try{pwa()?.scheduleSync?.()}catch{}
  return{current,result,receipt:current.pending(PREMIER)||result.receipt};
}
async function syncFastStatus(){
  const m=manager(),states=[];
  if(m?.status){for(const id of FAST_IDS){try{states.push(await m.status(id))}catch{states.push(null)}}}
  activateAuthority();try{pwa()?.scheduleSync?.()}catch{}scheduleDecorate();
  emit('civweave:gemma4-browser-import-status-synced',{ready:FAST_IDS.filter((id,index)=>states[index]?.available),postImport:true});
  return states;
}
async function startModelDownload(id,button){
  if(!FAST_IDS.includes(id))return false;
  button.disabled=true;showError('');
  try{
    const installed=await manager()?.status?.(id).catch?.(()=>null);if(installed?.available){scheduleDecorate();return true}
    const {current,receipt}=await prepareCurrentPack(progress=>{if(progress?.message)button.textContent=progress.message});
    const row=(receipt?.large||[]).find(record=>record.componentId===id&&!new Set(receipt.importedKeys||[]).has(record.key));
    if(!row)throw new Error(`${id===FAST_E2?'Gemma 4 E2B':'Gemma 4 E4B'} LiteRT is not present in the current Premier Phone Pack download manifest.`);
    const started=new Set(receipt.startedKeys||[]);
    if(started.has(row.key)){
      button.textContent='Select downloaded file…';
      const result=await current.pickAndImport(PREMIER,{onProgress:progress=>{if(progress?.message)button.textContent=progress.message}});
      if(result?.cancelled){button.disabled=false;button.textContent=`Import ${fmt(row.expectedBytes||row.sizeBytes)}`;return false}
      await syncFastStatus();
    }else{
      dispatchBrowserDownload(current,row);button.textContent='Browser download started';
    }
    scheduleDecorate();return true;
  }catch(error){
    const message=String(error?.message||error);showError(message);emit('civweave:gemma4-browser-download-error',{modelId:id,message});button.disabled=false;button.textContent='Try browser download';return false;
  }
}
async function startPair(button){
  button.disabled=true;showError('');
  try{
    const {current,receipt}=await prepareCurrentPack(progress=>{if(progress?.message)button.textContent=progress.message});
    const next=current.nextRecord(PREMIER);
    if(next){dispatchBrowserDownload(current,next);button.textContent='Browser download started';scheduleDecorate();return true}
    const missing=current.unimportedRecords(receipt);
    if(missing.length){button.textContent='Select downloaded files…';const result=await current.pickAndImport(PREMIER,{onProgress:progress=>{if(progress?.message)button.textContent=progress.message}});if(result?.cancelled){button.disabled=false;button.textContent='Import downloaded files';return false}await syncFastStatus();scheduleDecorate();return true}
    await syncFastStatus();button.textContent='Current models ready';scheduleDecorate();return true;
  }catch(error){
    const message=String(error?.message||error);showError(message);emit('civweave:gemma4-browser-download-error',{pair:true,message});button.disabled=false;button.textContent='Try browser download';return false;
  }
}
function decoratePremier(){
  const card=premierCard();if(!card)return false;
  const direct=[...card.children].filter(node=>node.tagName==='P');
  if(direct[0])direct[0].textContent='Current mid-range phone pack: Gemma 4 E2B LiteRT for fast work, Gemma 4 E4B LiteRT for deeper work, multilingual speech, and a CPU-safe fallback. Existing Q4F16 Gemma models remain compatibility fallbacks.';
  if(direct[1])direct[1].innerHTML='<b>Target:</b> 12 GB RAM · modern Android-class WebGPU';
  if(direct[2])direct[2].innerHTML='<b>Storage:</b> ~6.9 GB current pack · old Q2F16 files can be deleted after migration';
  if(direct[3])direct[3].textContent='Gemma 4 E2B LiteRT 2.0 GB · Gemma 4 E4B LiteRT 3.0 GB · Qwen 3 0.6B CPU fallback · Silero · Parakeet INT8 · Omnilingual 300M INT8 · Supertonic 3';
  card.dataset.gemma4CurrentMidrange='litert-e2-e4-q4-compat';return true;
}
function decorateProfile(){
  const card=profileCard();if(!card)return false;
  const intro=card.querySelector(':scope > div > p');if(intro)intro.textContent='These are the current Gemma 4 phone models used by the Premier Phone Pack. Large LiteRT files use the browser download manager; after each download finishes, import it back into Civweave. Q4F16 remains the compatibility fallback.';
  for(const button of card.querySelectorAll('[data-litert-fast-download]')){
    const id=button.dataset.litertFastDownload,{row,started,imported}=rowFor(id);if(!row)continue;
    if(imported.has(row.key))button.textContent='Imported';
    else if(started.has(row.key))button.textContent=`Import ${fmt(row.expectedBytes||row.sizeBytes)}`;
    else button.textContent=`Download ${fmt(row.expectedBytes||row.sizeBytes)}`;
    button.disabled=false;
  }
  const pair=card.querySelector('[data-litert-fast-pair]');if(pair){const current=bridge(),receipt=current?.pending?.(PREMIER);const missing=receipt&&current?.unimportedRecords?current.unimportedRecords(receipt):[];const next=current?.nextRecord?.(PREMIER);pair.textContent=next?'Download next optimized model':missing.length?'Import downloaded files':'Start optimized downloads';pair.disabled=false}
  let note=card.querySelector('[data-gemma4-browser-handoff-note]');if(!note){note=document.createElement('p');note.dataset.gemma4BrowserHandoffNote='';note.className='cw-local-meta';card.append(note)}
  note.textContent='Multi-gigabyte LiteRT models no longer use the legacy in-app Cache Storage downloader.';
  return true;
}
function decorate(){decorateQueued=false;activateAuthority();decoratePremier();decorateProfile();return true}
function scheduleDecorate(){if(decorateQueued)return;decorateQueued=true;queueMicrotask(decorate)}
function onClick(event){
  const modelButton=event.target?.closest?.('[data-litert-fast-download]');if(modelButton){event.preventDefault();event.stopImmediatePropagation();void startModelDownload(modelButton.dataset.litertFastDownload,modelButton);return}
  const pairButton=event.target?.closest?.('[data-litert-fast-pair]');if(pairButton){event.preventDefault();event.stopImmediatePropagation();void startPair(pairButton)}
}

document.addEventListener('click',onClick,true);
for(const name of ['civweave:settings-opened','civweave:model-settings-opened','civweave:settings-local-route-ready','civweave:local-model-pack-progress','civweave:local-model-downloaded','civweave:local-model-removed','civweave:guide-loader-reset','pageshow'])addEventListener(name,scheduleDecorate);
addEventListener('civweave:local-model-pack-installed',event=>{if(event?.detail?.id===PREMIER)void syncFastStatus();else scheduleDecorate()});
if(typeof MutationObserver==='function'&&document.documentElement){observer=new MutationObserver(scheduleDecorate);observer.observe(document.documentElement,{childList:true,subtree:true})}
scheduleDecorate();

globalThis.CivweaveGemma4BrowserPackCoherenceV1=freeze({version:VERSION,packId:PREMIER,currentModels:FAST_IDS,activateAuthority,ensureBridge,prepareCurrentPack,syncFastStatus,startModelDownload,startPair,decoratePremier,decorateProfile,scheduleDecorate,browserManagedLiteRT:true,legacyCacheDownloadDisabled:true,midrangeUsesLiteRT:true,q4CompatibilityPreserved:true,postImportStatusSync:true});
})();
