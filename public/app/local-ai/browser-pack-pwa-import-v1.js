(()=>{
'use strict';
const VERSION='1.1.0-browser-pack-pwa-import-v1-explicit-files';
const BRIDGE_SRC='/app/local-ai/browser-pack-download-v1.js?v=1.2.0-explicit-files';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const BROWSER_PACKS=new Set(['premier-phone','server-quality']);
const STYLE_ID='cw-browser-pack-pwa-import-v1-style';
if(globalThis.CivweaveBrowserPackPwaImportV1?.version===VERSION)return;

const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const bridge=()=>globalThis.CivweaveBrowserPackDownloadV1;
let bridgePromise=null,syncQueued=false;

function installStyle(){
  if(document.getElementById(STYLE_ID)||!document.head)return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#cw-local-ai-v324 .cw-browser-pack-import-label{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:5px 9px;border:1px solid #ffffff33;border-radius:8px;background:#ffffff0d;color:inherit;text-decoration:none;font:inherit;font-weight:700;cursor:pointer}
.cw-browser-pack-file-input{position:fixed!important;left:-10000px!important;top:0!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
#cw-local-ai-v324 [data-cw-browser-pack-state]{margin:.35rem 0!important;padding:.45rem .55rem;border:1px solid #8af5d233;border-radius:9px;background:#07192a;color:#cdeee6;font-size:.8rem}
`;(document.head||document.documentElement).append(style)
}
function status(text,error=false){
  const el=document.querySelector('#cw-local-ai-v324 [data-local-status]');
  if(el){if(el.textContent!==text)el.textContent=text;el.classList.toggle('cw-local-error',Boolean(error))}
}
function ensureBridge(){
  if(bridge()?.explicitBrowserFiles&&bridge()?.partialImport&&bridge()?.version?.startsWith?.('1.2.'))return Promise.resolve(bridge());
  if(bridgePromise)return bridgePromise;
  bridgePromise=new Promise((resolve,reject)=>{
    const target=new URL(BRIDGE_SRC,location.href).href;
    const exact=[...document.scripts].find(script=>script.src===target);
    const ready=()=>Boolean(bridge()?.explicitBrowserFiles&&bridge()?.partialImport&&bridge()?.version?.startsWith?.('1.2.'));
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
function packIdFrom(element){const id=String(packCardFrom(element)?.dataset?.packId||element?.dataset?.cwBrowserPackStart||element?.dataset?.cwBrowserPackRetry||element?.dataset?.cwBrowserPackDownloadNext||'');return BROWSER_PACKS.has(id)?id:''}
function fmt(bytes){const b=Number(bytes||0);return b>=1e9?`${(b/1e9).toFixed(1)} GB`:b>=1e6?`${Math.round(b/1e6)} MB`:`${Math.max(1,Math.round(b/1e3))} KB`}
function inputId(packId){return`cw-browser-pack-input-${packId}`}
function ensureImportInput(packId){
  let input=document.getElementById(inputId(packId));if(input)return input;
  input=document.createElement('input');input.id=inputId(packId);input.className='cw-browser-pack-file-input';input.type='file';input.multiple=true;input.setAttribute('aria-label',`Select completed ${packId} Civweave AI pack downloads`);input.dataset.cwBrowserPackInput=packId;
  input.addEventListener('change',()=>{
    const files=[...(input.files||[])];input.value='';if(!files.length)return;
    status(`Importing ${files.length} selected browser download${files.length===1?'':'s'}…`);
    ensureBridge().then(current=>current.importFiles(packId,files,{onProgress:progress=>{if(progress?.message)status(progress.message)}})).then(result=>{
      if(result?.available){status(`${result.pack.label} is installed in Civweave local storage.`)}
      else if(result?.partial){status(`Imported ${result.importedTotal}/${result.receipt.large.length} large files. ${result.missing.length} still need importing; import any files already in Downloads, or download the remaining ones.`)}
      scheduleSync();
    }).catch(error=>{status(String(error?.message||error),true);scheduleSync()});
  });
  (document.body||document.documentElement).append(input);return input;
}
function stateLine(card,receipt,state){
  let line=card.querySelector('[data-cw-browser-pack-state]');if(!line){line=document.createElement('p');line.dataset.cwBrowserPackState='';const actions=card.querySelector('.cw-local-actions');actions?.before(line)}
  const counts=bridge()?.receiptCounts?.(receipt)||{expected:receipt?.large?.length||0,started:receipt?.startedKeys?.length||0,imported:receipt?.importedKeys?.length||0,remainingToImport:0};
  const text=state==='ready'?`${receipt?.label||'AI pack'} ready.`:`Browser-managed payload: about ${fmt(receipt?.largeBytes||0)} across ${counts.expected} large files · ${counts.started} download${counts.started===1?'':'s'} started · ${counts.imported} imported.`;
  if(line&&line.textContent!==text)line.textContent=text;return line
}
function controlsHtml(packId,receipt,state){
  const current=bridge(),counts=current.receiptCounts(receipt),next=current.nextRecord(packId),parts=[];
  if(next){parts.push(`<a href="${esc(current.downloadUrl(next))}" data-cw-browser-pack-download-next="${esc(packId)}" data-cw-browser-record-key="${esc(next.key)}" download="${esc(next.basename)}">Download next · ${counts.started+counts.imported+1}/${counts.expected} · ${esc(next.basename)} · ${esc(fmt(next.expectedBytes))}</a>`)}
  parts.push(`<label class="cw-browser-pack-import-label" for="${esc(inputId(packId))}">Import downloaded files</label>`);
  if(!next&&counts.remainingToImport>0)parts.push(`<button type="button" data-cw-browser-pack-retry="${esc(packId)}">Retry unimported downloads</button>`);
  parts.push(`<button type="button" data-local-pack-remove="${esc(packId)}">Clear pack</button>`);
  return parts.join('')
}
function syncCards(){
  syncQueued=false;installStyle();const current=bridge();if(!current?.explicitBrowserFiles){ensureBridge().then(scheduleSync,()=>{});return}
  const states=packStates();
  for(const card of document.querySelectorAll('#cw-local-ai-v324 [data-pack-id]')){
    const packId=String(card.dataset.packId||'');if(!BROWSER_PACKS.has(packId))continue;
    const state=String(states[packId]?.status||''),receipt=current.pending(packId),actions=card.querySelector('.cw-local-actions');if(!actions)continue;
    if(state==='ready'||!receipt){
      card.querySelector('[data-cw-browser-pack-state]')?.remove();delete actions.dataset.cwBrowserSignature;ensureImportInput(packId);continue;
    }
    ensureImportInput(packId);stateLine(card,receipt,state);
    const counts=current.receiptCounts(receipt),next=current.nextRecord(packId),signature=[receipt.version,counts.expected,counts.started,counts.imported,next?.key||'',state].join('|');
    if(actions.dataset.cwBrowserSignature!==signature){actions.innerHTML=controlsHtml(packId,receipt,state);actions.dataset.cwBrowserSignature=signature}
  }
}
function scheduleSync(){if(syncQueued)return;syncQueued=true;queueMicrotask(syncCards)}
function beginQueue(packId,control){
  control.disabled=true;status('Preparing the browser-managed AI pack…');
  ensureBridge().then(current=>current.queue(packId,{onProgress:progress=>{if(progress?.message)status(progress.message)}})).then(result=>{
    const receipt=result.receipt||bridge()?.pending(packId),counts=bridge()?.receiptCounts?.(receipt);
    status(`${result.pack.label}: started ${counts?.started||1}/${counts?.expected||receipt?.large?.length||1} large browser downloads. Use Download next for the remaining files; Civweave can be closed while each browser download runs.`);scheduleSync()
  }).catch(error=>status(String(error?.message||error),true)).finally(()=>{control.disabled=false;scheduleSync()})
}
function onClick(event){
  const start=event.target.closest?.('button[data-local-pack-download]');
  if(start){const packId=packIdFrom(start);if(packId){event.preventDefault();event.stopImmediatePropagation();beginQueue(packId,start);return}}
  const next=event.target.closest?.('a[data-cw-browser-pack-download-next]');
  if(next){const packId=packIdFrom(next),key=String(next.dataset.cwBrowserRecordKey||'');if(!packId||!key)return;status(`Starting ${next.getAttribute('download')||'browser download'}…`);setTimeout(()=>{bridge()?.markStarted?.(packId,key);scheduleSync()},0);return}
  const retry=event.target.closest?.('button[data-cw-browser-pack-retry]');
  if(retry){const packId=packIdFrom(retry);if(!packId)return;event.preventDefault();event.stopImmediatePropagation();const receipt=bridge()?.retryMissing?.(packId);if(receipt){const counts=bridge().receiptCounts(receipt);status(`Retry list reset. ${counts.remainingToImport} large files are still unimported; use Download next only for files you do not already have.`);scheduleSync()}return}
}
const observer=new MutationObserver(scheduleSync);
function boot(){installStyle();ensureBridge().then(scheduleSync,()=>{});document.addEventListener('click',onClick,true);observer.observe(document.documentElement,{childList:true,subtree:true});scheduleSync()}
addEventListener('civweave:model-settings-opened',scheduleSync);
for(const name of ['civweave:local-model-pack-progress','civweave:local-model-pack-installed','civweave:local-model-pack-removed'])addEventListener(name,scheduleSync);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

globalThis.CivweaveBrowserPackPwaImportV1=Object.freeze({version:VERSION,ensureBridge,syncCards,scheduleSync,ensureImportInput,explicitBrowserFiles:true});
})();
