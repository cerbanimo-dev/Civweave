(()=>{
'use strict';

const VERSION='1.0.0-gemma4-q2-retirement-v1';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const PREMIER='premier-phone';
const Q2_E2='gemma4-e2b-it-q2f16-mobile';
const Q2_E4='gemma4-e4b-it-q2f16-mobile';
const FAST_E2='gemma4-e2b-it-litert-web';
const FAST_E4='gemma4-e4b-it-litert-web';
const Q4_E2='gemma4-e2b-it-q4f16';
const Q4_E4='gemma4-e4b-it-q4f16';
const FALLBACK='qwen3-0.6b-q8-wasm';
const Q2_IDS=Object.freeze([Q2_E2,Q2_E4]);
const Q2_BYTES=Object.freeze({[Q2_E2]:2_335_000_000,[Q2_E4]:3_365_000_000});

if(globalThis.CivweaveGemma4Q2RetirementV1?.version===VERSION)return;

const freeze=value=>Object.freeze(value);
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const downloads=()=>parse(localStorage.getItem(DOWNLOADS_KEY),{});
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const authority=()=>globalThis.CivweaveGemma4PhonePerformanceCoreV1;
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}};
const savedReady=id=>downloads()?.[id]?.status==='ready';

function obsoleteReadyIds(){return Q2_IDS.filter(savedReady)}
function missingReplacementIds(){
  const old=obsoleteReadyIds(),missing=[];
  if(old.includes(Q2_E2)&&!savedReady(FAST_E2))missing.push(FAST_E2);
  if(old.includes(Q2_E4)&&!savedReady(FAST_E4))missing.push(FAST_E4);
  return missing;
}
function replacementFor(id){
  if(id===Q2_E2)return [FAST_E2,Q4_E2,FALLBACK,FAST_E4,Q4_E4];
  if(id===Q2_E4)return [FAST_E4,Q4_E4,FALLBACK,FAST_E2,Q4_E2];
  return [FALLBACK,FAST_E2,Q4_E2,FAST_E4,Q4_E4];
}
function safeSelectionFor(id){return replacementFor(id).find(savedReady)||''}

async function deleteObsoleteModels(){
  const m=manager();
  if(!m?.remove)throw new Error('The local model manager is not ready.');
  const ids=obsoleteReadyIds();
  if(!ids.length)return{removed:[]};
  const pick=m.selection?.();
  if(pick?.active&&ids.includes(pick.id)){
    const replacement=safeSelectionFor(pick.id);
    if(!replacement)throw new Error('Civweave could not find a safe installed replacement before deleting the selected obsolete model. Install the current phone models first.');
    m.select?.(replacement);
  }
  const removed=[],failed=[];
  for(const id of ids){
    try{await m.remove(id);removed.push(id)}
    catch(error){failed.push({id,message:String(error?.message||error)})}
  }
  if(failed.length){
    emit('civweave:gemma4-obsolete-model-delete-error',{removed,failed});
    throw Object.assign(new Error(`Could not delete ${failed.map(row=>row.id).join(', ')}.`),{code:'LOCAL_OBSOLETE_MODEL_DELETE_FAILED',removed,failed});
  }
  emit('civweave:gemma4-obsolete-models-deleted',{removed,freedBytes:removed.reduce((sum,id)=>sum+(Q2_BYTES[id]||0),0),q4Preserved:true});
  scheduleDecorate();
  return{removed};
}

async function installCurrentModels(){
  const api=authority();
  if(!api?.completePerformanceCore)throw new Error('The Gemma 4 phone performance installer is not ready.');
  const missing=missingReplacementIds();
  if(!missing.length)return{queued:false,missing:[]};
  const result=await api.completePerformanceCore();
  emit('civweave:gemma4-obsolete-model-replacements-queued',{missing,q4Preserved:true});
  return{queued:true,missing,result};
}

function removeLegacyExtensionUi(panel,card){
  for(const id of Q2_IDS){
    for(const row of panel.querySelectorAll(`[data-model-id="${id}"]`))row.hidden=true;
  }
  card.querySelector('[data-gemma4-q2-extensions]')?.remove();
  for(const button of panel.querySelectorAll('[data-gemma4-extension-download],[data-gemma4-extension-remove]')){
    const id=button.dataset.gemma4ExtensionDownload||button.dataset.gemma4ExtensionRemove||'';
    if(Q2_IDS.includes(id))button.closest('.cw-local-actions')?.remove();
  }
}

function cleanupCopy(ids){
  if(!ids.length)return'';
  const labels=ids.map(id=>id===Q2_E2?'E2B Q2F16':'E4B Q2F16');
  const bytes=ids.reduce((sum,id)=>sum+(Q2_BYTES[id]||0),0);
  return `${labels.join(' + ')} ${ids.length===1?'is':'are'} obsolete and no longer part of the phone pack. LiteRT is the current mobile model; Q4F16 remains the compatibility fallback. Deleting ${ids.length===1?'it':'them'} frees about ${(bytes/1e9).toFixed(1)} GB.`;
}

function decorateSettings(){
  const panel=document.getElementById('cw-local-ai-v324');if(!panel)return false;
  const card=panel.querySelector(`[data-pack-id="${PREMIER}"]`);if(!card)return false;
  removeLegacyExtensionUi(panel,card);
  const obsolete=obsoleteReadyIds(),missing=missingReplacementIds();
  const signature=JSON.stringify({obsolete,missing});
  if(card.dataset.gemma4Q2Retirement===signature)return true;

  const performanceButton=card.querySelector('[data-gemma4-performance-complete]');
  if(performanceButton&&obsolete.length)performanceButton.textContent='Install current phone models';

  let cleanup=card.querySelector('[data-gemma4-obsolete-cleanup]');
  if(!obsolete.length){cleanup?.remove();card.dataset.gemma4Q2Retirement=signature;return true}
  if(!cleanup){
    cleanup=document.createElement('div');
    cleanup.dataset.gemma4ObsoleteCleanup='';
    cleanup.className='cw-clean-note';
    const actions=[...card.querySelectorAll('.cw-local-actions')].find(node=>!node.closest('[data-gemma4-q2-extensions]'));
    actions?.after(cleanup)||card.append(cleanup);
  }
  const replaceAction=missing.length?'<button type="button" data-gemma4-obsolete-replace>Install current phone models</button>':'';
  cleanup.innerHTML=`<b>Obsolete Gemma 4 mobile models detected</b><p class="cw-local-meta">${cleanupCopy(obsolete)}</p><div class="cw-local-actions">${replaceAction}<button type="button" data-gemma4-obsolete-delete>Delete obsolete models</button></div>`;
  card.dataset.gemma4Q2Retirement=signature;
  return true;
}

let decorateTimer=0;
function scheduleDecorate(){
  clearTimeout(decorateTimer);
  const waits=[40,150,360,760,1250,1750];let index=0;
  const run=()=>{decorateSettings();index+=1;if(index<waits.length)decorateTimer=setTimeout(run,waits[index])};
  decorateTimer=setTimeout(run,waits[0]);
}
function activate(){scheduleDecorate();return true}

function onClick(event){
  const button=event.target?.closest?.('[data-gemma4-obsolete-delete],[data-gemma4-obsolete-replace]');
  if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();button.disabled=true;
  const task=button.hasAttribute('data-gemma4-obsolete-delete')?deleteObsoleteModels():installCurrentModels();
  void Promise.resolve(task).catch(error=>emit('civweave:gemma4-q2-retirement-error',{message:String(error?.message||error),code:error?.code||''})).finally(()=>{button.disabled=false;scheduleDecorate()});
}

document.addEventListener('click',onClick,true);
for(const name of ['civweave:settings-opened','civweave:settings-local-route-ready','civweave:local-model-runtime-ready','civweave:local-model-download-progress','civweave:local-model-downloaded','civweave:local-model-removed','civweave:local-model-pack-progress','civweave:local-model-pack-selected','civweave:guide-loader-reset','pageshow'])addEventListener(name,scheduleDecorate);
activate();

globalThis.CivweaveGemma4Q2RetirementV1=freeze({
  version:VERSION,
  retiredModelIds:Q2_IDS,
  currentMobileModelIds:freeze([FAST_E2,FAST_E4]),
  compatibilityModelIds:freeze([Q4_E2,Q4_E4]),
  obsoleteReadyIds,
  missingReplacementIds,
  deleteObsoleteModels,
  installCurrentModels,
  decorateSettings,
  scheduleDecorate,
  activate,
  q2Retired:true,
  q4Preserved:true,
  explicitDelete:true,
  maxSupportedVariantsPerGemmaSize:2
});
})();
