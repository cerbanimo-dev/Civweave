(()=>{
'use strict';
const VERSION='1.3.2-browser-pack-pwa-import-v1-premier-incremental-handoff';
const BRIDGE_SRC='/app/local-ai/browser-pack-download-v1.js?v=1.3.0-progress-and-final-match';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const BROWSER_PACKS=new Set(['premier-phone','server-quality']);
const PREMIER='premier-phone';
const PREMIER_BROWSER_IDS=new Set(['gemma4-e2b-it-litert-web','gemma4-e4b-it-litert-web']);
const STYLE_ID='cw-browser-pack-pwa-import-v1-style';
if(globalThis.CivweaveBrowserPackPwaImportV1?.version===VERSION)return;

const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const bridge=()=>globalThis.CivweaveBrowserPackDownloadV1;
const currentOwner=()=>globalThis.CivweaveGemma4DualQ4ActionsV1;
const settingsController=()=>globalThis.CivweaveModelSettingsControllerV173;
const importProgress=new Map();
let bridgePromise=null,syncQueued=false,ownerFlight=null;

function installStyle(){
  if(document.getElementById(STYLE_ID)||!document.head)return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#cw-local-ai-v324 .cw-browser-pack-import-label{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:5px 9px;border:1px solid #ffffff33;border-radius:8px;background:#ffffff0d;color:inherit;text-decoration:none;font:inherit;font-weight:700;cursor:pointer}
.cw-browser-pack-file-input{position:fixed!important;left:-10000px!important;top:0!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
#cw-local-ai-v324 [data-cw-browser-pack-state]{margin:.35rem 0!important;padding:.45rem .55rem;border:1px solid #8af5d233;border-radius:9px;background:#07192a;color:#cdeee6;font-size:.8rem}
#cw-local-ai-v324 [data-cw-browser-pack-missing]{margin:.25rem 0;color:#ffe0a8;font-size:.78rem}
#cw-local-ai-v324 .cw-browser-pack-progress{display:grid;gap:5px;margin:.5rem 0 .2rem}
#cw-local-ai-v324 .cw-browser-pack-progress-track{height:10px;border-radius:999px;overflow:hidden;background:#ffffff18;border:1px solid #ffffff14}
#cw-local-ai-v324 .cw-browser-pack-progress-track i{display:block;height:100%;width:var(--cw-browser-pack-progress,0%);background:linear-gradient(90deg,#7eeed5,#93c9ff,#e79cff);transition:width .12s linear}
#cw-local-ai-v324 .cw-browser-pack-progress small{color:#cfe0ec;font-size:.76rem}
`;(document.head||document.documentElement).append(style)
}
function status(text,error=false){
  const el=document.querySelector('#cw-local-ai-v324 [data-local-status]');
  if(el){if(el.textContent!==text)el.textContent=text;el.classList.toggle('cw-local-error',Boolean(error))}
}
function ensureBridge(){
  if(bridge()?.streamingImportProgress&&bridge()?.relaxedMinimumOnlyMatching&&bridge()?.version?.startsWith?.('1.3.'))return Promise.resolve(bridge());
  if(bridgePromise)return bridgePromise;
  bridgePromise=new Promise((resolve,reject)=>{
    const target=new URL(BRIDGE_SRC,location.href).href;
    const exact=[...document.scripts].find(script=>script.src===target);
    const ready=()=>Boolean(bridge()?.streamingImportProgress&&bridge()?.relaxedMinimumOnlyMatching&&bridge()?.version?.startsWith?.('1.3.'));
    if(exact){
      if(ready()){resolve(bridge());return}
      exact.addEventListener('load',()=>ready()?resolve(bridge()):reject(new Error('The Civweave browser-pack bridge did not become ready.')),{once:true});
      exact.addEventListener('error',()=>reject(new Error('The Civweave browser-pack bridge could not load.')),{once:true});
      return;
    }
    const script=document.createElement('script');script.src=BRIDGE_SRC;script.async=false;script.dataset.civweavePwaBrowserPackBridge='';
    script.onload=()=>ready()?resolve(bridge()):reject(new Error('The Civweave browser-pack bridge did not become ready.'));
    script.onerror=()=>reject(new Error('The Civweave browser-pack bridge could not load.'));
    document.head.append(script);
  }).finally(()=>{bridgePromise=null});
  return bridgePromise;
}
function packStates(){try{return parse(localStorage.getItem(PACK_STATE_KEY),{})}catch{return{}}}
function packCardFrom(element){return element?.closest?.('[data-pack-id]')||null}
function packIdFrom(element){const id=String(packCardFrom(element)?.dataset?.packId||element?.dataset?.cwBrowserPackStart||element?.dataset?.cwBrowserPackDownloadNext||'');return BROWSER_PACKS.has(id)?id:''}
function fmt(bytes){const b=Number(bytes||0);return b>=1e9?`${(b/1e9).toFixed(2)} GB`:b>=1e6?`${Math.round(b/1e6)} MB`:`${Math.max(1,Math.round(b/1e3))} KB`}
function inputId(packId){return`cw-browser-pack-input-${packId}`}
function browserRecords(packId,receipt){const rows=[...(receipt?.large||[])];return packId===PREMIER?rows.filter(row=>PREMIER_BROWSER_IDS.has(String(row?.componentId||''))):rows}
function browserCounts(packId,receipt){
  const rows=browserRecords(packId,receipt),valid=new Set(rows.map(row=>row.key)),imported=(receipt?.importedKeys||[]).filter(key=>valid.has(key)),started=(receipt?.startedKeys||[]).filter(key=>valid.has(key)&&!imported.includes(key));
  return{expected:rows.length,imported:imported.length,started:started.length,remainingToStart:Math.max(0,rows.length-imported.length-started.length),remainingToImport:Math.max(0,rows.length-imported.length),rows,importedKeys:new Set(imported),startedKeys:new Set(started)}
}
function missingBrowserRecords(packId,receipt){const counts=browserCounts(packId,receipt);return counts.rows.filter(row=>!counts.importedKeys.has(row.key))}
function nextBrowserRecord(packId,receipt){const counts=browserCounts(packId,receipt);return counts.rows.find(row=>!counts.importedKeys.has(row.key)&&!counts.startedKeys.has(row.key))||null}
function contaminatedPremier(receipt){return Boolean(receipt?.large?.some(row=>!PREMIER_BROWSER_IDS.has(String(row?.componentId||''))))}
function applyProgress(packId,progress){
  if(!progress)return;
  if(progress.message)status(progress.message);
  const receipt=bridge()?.pending?.(packId),counts=browserCounts(packId,receipt);
  if(progress.phase==='copying-large'){
    const fileFraction=progress.currentTotal?Math.max(0,Math.min(1,Number(progress.currentBytes||0)/Number(progress.currentTotal||1))):0;
    const overall=Math.max(0,Math.min(100,((Number(counts.imported||0)+fileFraction)/Math.max(1,Number(counts.expected||1)))*100));
    importProgress.set(packId,{percent:overall,text:`Importing ${progress.record?.label||'model file'} · ${Math.floor(fileFraction*100)}% · ${fmt(progress.currentBytes)} / ${fmt(progress.currentTotal)} · Gemma ${Math.floor(overall)}%`});
  }else if(progress.phase==='importing-large'){
    const overall=Math.max(0,Math.min(100,(Number(counts.imported||0)/Math.max(1,Number(counts.expected||1)))*100));
    importProgress.set(packId,{percent:overall,text:`Imported ${counts.imported}/${counts.expected} browser-managed Gemma files · ${Math.floor(overall)}%`});
  }else if(progress.phase==='partial'||progress.phase==='ready'){
    importProgress.delete(packId);
  }
  scheduleSync();
}
async function settleCurrentPremierOwner(owner){
  if(!owner?.currentPhoneAuthority||!owner?.downloadSupportFiles)throw new Error('The current Premier Phone setup controls did not become ready.');
  try{await owner.synchronizeImportedModels?.()}catch(error){console.warn('[Civweave] Premier Phone imported-model settlement deferred.',error)}
  const summary=owner.pendingSummary?.();
  if(summary?.complete){
    try{await owner.refreshSupportStatus?.({autoReconcile:true})}catch(error){console.warn('[Civweave] Premier Phone support settlement deferred.',error)}
  }
  owner.scheduleDecorate?.();
  return owner;
}
function ensureCurrentPremierOwner(){
  const current=currentOwner();
  if(current?.currentPhoneAuthority&&current?.downloadSupportFiles)return settleCurrentPremierOwner(current);
  if(ownerFlight)return ownerFlight;
  const controller=settingsController();
  if(!controller?.ensureGemma4Pack)return Promise.reject(new Error('The current Premier Phone setup controller is unavailable. Close and reopen Civweave, then try again.'));
  ownerFlight=Promise.resolve(controller.ensureGemma4Pack()).then(ok=>{
    const next=currentOwner();
    if(!ok||!next?.currentPhoneAuthority||!next?.downloadSupportFiles)throw new Error('The current Premier Phone setup controls did not become ready.');
    return settleCurrentPremierOwner(next);
  }).finally(()=>{ownerFlight=null});
  return ownerFlight;
}
function ensureImportInput(packId){
  let input=document.getElementById(inputId(packId));if(input)return input;
  input=document.createElement('input');input.id=inputId(packId);input.className='cw-browser-pack-file-input';input.type='file';input.multiple=true;input.setAttribute('aria-label',`Select completed ${packId} Civweave AI pack downloads`);input.dataset.cwBrowserPackInput=packId;
  input.addEventListener('change',()=>{
    const files=[...(input.files||[])];input.value='';if(!files.length)return;
    status(`Importing ${files.length} selected browser download${files.length===1?'':'s'}…`);
    ensureBridge().then(current=>current.importFiles(packId,files,{onProgress:progress=>applyProgress(packId,progress)})).then(async result=>{
      const receipt=bridge()?.pending?.(packId),counts=browserCounts(packId,receipt),missing=missingBrowserRecords(packId,receipt);
      if(packId!==PREMIER&&result?.available){importProgress.delete(packId);status(`${result.pack.label} is installed in Civweave local storage.`)}
      else if(missing.length){importProgress.delete(packId);status(`Imported ${counts.imported}/${counts.expected} browser-managed file${counts.expected===1?'':'s'}. Still missing ${missing[0].label} · ${missing[0].basename}. Import downloaded files remains available for the next model.`)}
      if(packId===PREMIER&&(counts.imported>0||counts.expected&&counts.imported===counts.expected)){
        status(counts.remainingToImport?'Keeping the remaining Gemma import available…':'Checking existing Gemma imports and Civweave internal support storage…');
        await ensureCurrentPremierOwner().catch(error=>status(String(error?.message||error),true));
      }
      scheduleSync();
    }).catch(error=>{importProgress.delete(packId);status(String(error?.message||error),true);scheduleSync()});
  });
  (document.body||document.documentElement).append(input);return input;
}
function stateLine(card,packId,receipt,state){
  let line=card.querySelector('[data-cw-browser-pack-state]');if(!line){line=document.createElement('p');line.dataset.cwBrowserPackState='';const actions=card.querySelector('.cw-local-actions');actions?.before(line)}
  const counts=browserCounts(packId,receipt),bytes=counts.rows.reduce((sum,row)=>sum+Number(row.expectedBytes||row.sizeBytes||row.minBytes||0),0);
  const text=state==='ready'?`${receipt?.label||'AI pack'} ready.`:packId===PREMIER?`Browser-managed Gemma payload: about ${fmt(bytes)} across ${counts.expected} large files · ${counts.started} downloaded but not yet imported · ${counts.imported} imported. Smaller support files stay inside Civweave and auto-detect.`:`Browser-managed payload: about ${fmt(receipt?.largeBytes||0)} across ${counts.expected} large files · ${counts.started} downloaded but not yet imported · ${counts.imported} imported.`;
  if(line&&line.textContent!==text)line.textContent=text;
  let missingLine=card.querySelector('[data-cw-browser-pack-missing]');const missing=missingBrowserRecords(packId,receipt);
  if(state!=='ready'&&missing.length){if(!missingLine){missingLine=document.createElement('p');missingLine.dataset.cwBrowserPackMissing='';line.after(missingLine)}const first=missing[0],copy=`Still missing browser-managed model: ${first.label} · ${first.basename} · at least ${fmt(first.minBytes||first.expectedBytes)}${missing.length>1?` · plus ${missing.length-1} more`:''}.`;if(missingLine.textContent!==copy)missingLine.textContent=copy}else missingLine?.remove();
  return line
}
function syncProgress(card,packId,receipt,state){
  let box=card.querySelector('[data-cw-browser-pack-progress]');
  if(state==='ready'){box?.remove();return}
  if(!box){box=document.createElement('div');box.className='cw-browser-pack-progress';box.dataset.cwBrowserPackProgress='';box.innerHTML='<div class="cw-browser-pack-progress-track"><i></i></div><small></small>';const actions=card.querySelector('.cw-local-actions');actions?.before(box)}
  const counts=browserCounts(packId,receipt),active=importProgress.get(packId);
  const percent=active?active.percent:Math.max(0,Math.min(100,(Number(counts.imported||0)/Math.max(1,Number(counts.expected||1)))*100));
  const text=active?.text||`Gemma import progress · ${counts.imported}/${counts.expected} files · ${Math.floor(percent)}%`;
  box.style.setProperty('--cw-browser-pack-progress',`${percent}%`);const label=box.querySelector('small');if(label&&label.textContent!==text)label.textContent=text;
}
function controlsHtml(packId,receipt){
  const next=nextBrowserRecord(packId,receipt),missing=missingBrowserRecords(packId,receipt),downloadRecord=next||missing[0],parts=[];
  if(downloadRecord){const retry=!next&&missing.length>0,label=retry?'Download missing again':'Download next';parts.push(`<a href="${esc(bridge().downloadUrl(downloadRecord))}" data-cw-browser-pack-download-next="${esc(packId)}" data-cw-browser-record-key="${esc(downloadRecord.key)}" download="${esc(downloadRecord.basename)}">${label} · ${esc(downloadRecord.label)} · ${esc(downloadRecord.basename)} · ${esc(fmt(downloadRecord.minBytes||downloadRecord.expectedBytes))}</a>`)}
  parts.push(`<label class="cw-browser-pack-import-label" for="${esc(inputId(packId))}">Import downloaded files</label>`);
  parts.push(`<button type="button" data-local-pack-remove="${esc(packId)}">Clear pack</button>`);
  return parts.join('')
}
function normalizeBaseStatus(card,state){
  if(!['browser-queued','browser-partial','browser-importing','support-required'].includes(state))return;
  for(const row of card.querySelectorAll('.cw-local-meta')){
    if(/Browser downloads queued|Sending files to the browser download manager/i.test(row.textContent||'')){
      const copy='Browser-managed Gemma downloads · smaller support files download internally and are auto-detected.';if(row.textContent!==copy)row.textContent=copy;
    }
  }
}
function currentOwnerActive(){const owner=currentOwner(),summary=owner?.pendingSummary?.();return Boolean(owner?.currentPhoneAuthority&&owner?.singlePresentationOwner&&summary?.complete)}
function syncCards(){
  syncQueued=false;installStyle();const current=bridge();
  if(!current?.streamingImportProgress)return;
  const states=packStates();
  for(const card of document.querySelectorAll('#cw-local-ai-v324 [data-pack-id]')){
    const packId=String(card.dataset.packId||'');if(!BROWSER_PACKS.has(packId))continue;
    const state=String(states[packId]?.status||''),receipt=current.pending(packId),actions=card.querySelector('.cw-local-actions');if(!actions)continue;
    normalizeBaseStatus(card,state);
    if(state==='ready'||!receipt){card.querySelector('[data-cw-browser-pack-state]')?.remove();card.querySelector('[data-cw-browser-pack-missing]')?.remove();syncProgress(card,packId,receipt,state);delete actions.dataset.cwBrowserSignature;ensureImportInput(packId);continue}
    ensureImportInput(packId);stateLine(card,packId,receipt,state);syncProgress(card,packId,receipt,state);
    const counts=browserCounts(packId,receipt),complete=counts.expected>0&&counts.imported===counts.expected;
    if(packId===PREMIER&&complete){
      delete actions.dataset.cwBrowserSignature;
      if(currentOwnerActive()){currentOwner()?.scheduleDecorate?.();continue}
      const html='<button type="button" data-cw-premier-phone-finish>Finish Premier Phone setup</button><button type="button" data-local-pack-remove="premier-phone">Clear pack</button>';
      if(actions.innerHTML!==html)actions.innerHTML=html;
      continue;
    }
    if(packId===PREMIER&&contaminatedPremier(receipt)&&counts.imported>0){
      delete actions.dataset.cwBrowserSignature;
      const html=`<button type="button" data-cw-premier-phone-finish>Recheck imported Gemma files</button>${controlsHtml(packId,receipt)}`;
      if(actions.innerHTML!==html)actions.innerHTML=html;
      continue;
    }
    const next=nextBrowserRecord(packId,receipt),missing=missingBrowserRecords(packId,receipt),downloadRecord=next||missing[0],signature=[receipt.version,counts.expected,counts.started,counts.imported,downloadRecord?.key||'',state].join('|');
    if(actions.dataset.cwBrowserSignature!==signature){actions.innerHTML=controlsHtml(packId,receipt);actions.dataset.cwBrowserSignature=signature}
  }
}
function scheduleSync(){if(syncQueued)return;syncQueued=true;queueMicrotask(syncCards)}
function beginQueue(packId,control){
  control.disabled=true;status('Preparing the browser-managed AI pack…');
  ensureBridge().then(current=>current.prepare(packId,{onProgress:progress=>applyProgress(packId,progress)})).then(result=>{
    const receipt=result.receipt,counts=browserCounts(packId,receipt);importProgress.delete(packId);
    status(packId===PREMIER?`${result.pack.label}: ${counts.expected} browser-managed Gemma downloads are required. Support files will download internally after these are imported.`:`${result.pack.label}: ${counts.expected} large browser downloads are required. Use Download next to start each file explicitly.`);scheduleSync()
  }).catch(error=>status(String(error?.message||error),true)).finally(()=>{control.disabled=false;scheduleSync()})
}
function onClick(event){
  const finish=event.target.closest?.('button[data-cw-premier-phone-finish]');
  if(finish){event.preventDefault();event.stopImmediatePropagation();finish.disabled=true;status('Rechecking imported Gemma files and internal support storage…');void ensureCurrentPremierOwner().catch(error=>status(String(error?.message||error),true)).finally(()=>{finish.disabled=false;scheduleSync()});return}
  const start=event.target.closest?.('button[data-local-pack-download]');
  if(start){const packId=packIdFrom(start);if(packId){event.preventDefault();event.stopImmediatePropagation();beginQueue(packId,start);return}}
  const next=event.target.closest?.('a[data-cw-browser-pack-download-next]');
  if(next){const packId=packIdFrom(next),key=String(next.dataset.cwBrowserRecordKey||'');if(!packId||!key)return;status(`Starting ${next.getAttribute('download')||'browser download'}…`);setTimeout(()=>{bridge()?.markStarted?.(packId,key);scheduleSync()},0);return}
}
function boot(){installStyle();document.addEventListener('click',onClick,true);scheduleSync()}
addEventListener('civweave:model-settings-opened',scheduleSync);
addEventListener('civweave:settings-opened',scheduleSync);
for(const name of ['civweave:local-model-pack-progress','civweave:local-model-pack-installed','civweave:local-model-pack-removed','civweave:local-model-downloaded','civweave:gemma4-support-progress'])addEventListener(name,scheduleSync);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

globalThis.CivweaveBrowserPackPwaImportV1=Object.freeze({version:VERSION,ensureBridge,syncCards,scheduleSync,ensureImportInput,ensureCurrentPremierOwner,browserRecords,browserCounts,missingBrowserRecords,explicitBrowserFiles:true,progressUi:true,missingFileRecovery:true,eventDriven:true,mutationObserver:false,passiveBridgeLoad:false,currentPremierOwnerHandoff:true,completedPremierActionsRelinquished:true,premierGemmaOnly:true,supportFilesInternal:true,incrementalPremierImport:true,ownerSettlementOnEveryImport:true,ownerRequiresCompletedGemmaReceipt:true});
})();