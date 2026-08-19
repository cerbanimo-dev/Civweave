(()=>{
'use strict';
const VERSION='1.0.3-browser-pack-pwa-import-v1-idempotent-observer';
const BRIDGE_SRC='/app/local-ai/browser-pack-download-v1.js?v=1.1.1-pwa-import-retry';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const BROWSER_PACKS=new Set(['premier-phone','server-quality']);
if(globalThis.CivweaveBrowserPackPwaImportV1?.version===VERSION)return;

const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const bridge=()=>globalThis.CivweaveBrowserPackDownloadV1;
let bridgePromise=null;

function status(text,error=false){
  const el=document.querySelector('#cw-local-ai-v324 [data-local-status]');
  if(el){if(el.textContent!==text)el.textContent=text;el.classList.toggle('cw-local-error',Boolean(error))}
}
function ensureBridge(){
  if(bridge()?.pickAndImport&&bridge()?.queue&&bridge()?.version?.startsWith?.('1.1.1-'))return Promise.resolve(bridge());
  if(bridgePromise)return bridgePromise;
  bridgePromise=new Promise((resolve,reject)=>{
    const target=new URL(BRIDGE_SRC,location.href).href;
    const exact=[...document.scripts].find(script=>script.src===target);
    const ready=()=>bridge()?.pickAndImport&&bridge()?.queue&&bridge()?.version?.startsWith?.('1.1.1-');
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
function packIdFrom(element){
  const card=packCardFrom(element),fromCard=String(card?.dataset?.packId||'');
  if(BROWSER_PACKS.has(fromCard))return fromCard;
  if(element?.matches?.('a[href*="source=settings-ai-pack-import"]')){
    try{const id=new URL(element.href,location.href).searchParams.get('pack')||'';if(BROWSER_PACKS.has(id))return id}catch{}
  }
  return '';
}
function rerender(){
  const form=document.querySelector('[data-cw-settings-form]');
  try{globalThis.CivweaveSettingsLocalRouteV323?.renderLocalModels?.(form)}catch{}
  queueMicrotask(syncCards);
}
function syncCards(){
  const states=packStates();
  for(const card of document.querySelectorAll('#cw-local-ai-v324 [data-pack-id]')){
    const packId=String(card.dataset.packId||'');if(!BROWSER_PACKS.has(packId))continue;
    const state=String(states[packId]?.status||''),actions=card.querySelector('.cw-local-actions');if(!actions)continue;
    const existing=actions.querySelector('a[href*="source=settings-ai-pack-import"]');
    if(existing){if(existing.dataset.cwPwaBrowserPackImport!==packId)existing.dataset.cwPwaBrowserPackImport=packId;if(existing.hasAttribute('target'))existing.removeAttribute('target');if(existing.hasAttribute('rel'))existing.removeAttribute('rel')}
    let button=actions.querySelector('[data-cw-pwa-browser-pack-import]');
    if(state==='browser-queued'){
      if(!button){button=document.createElement('button');button.type='button';button.dataset.cwPwaBrowserPackImport=packId;button.textContent='Import finished downloads';actions.prepend(button)}
      if(existing&&!existing.hidden)existing.hidden=true;
      const download=actions.querySelector('button[data-local-pack-download]');
      if(download&&download!==button&&download.textContent!=='Queue again')download.textContent='Queue again';
    }else{
      if(button)button.remove();
      if(existing&&existing.hidden)existing.hidden=false;
    }
  }
}
function beginImport(packId,control){
  const current=bridge();
  if(!current?.pickAndImport||!current?.version?.startsWith?.('1.1.1-')){
    status('Preparing the in-PWA import picker. Tap Import finished downloads again in a moment.');
    ensureBridge().then(syncCards,error=>status(String(error?.message||error),true));
    return;
  }
  if(control){control.setAttribute('aria-busy','true');if('disabled'in control)control.disabled=true}
  status('Choose the completed browser downloads for this pack.');
  current.pickAndImport(packId,{onProgress:progress=>{if(progress?.message)status(progress.message)}})
    .then(result=>{
      if(result?.cancelled){status('Import cancelled. Your browser downloads were not changed.');return}
      status(`${result?.pack?.label||'AI pack'} is installed in Civweave local storage.`);
      rerender();
    })
    .catch(error=>status(String(error?.message||error),true))
    .finally(()=>{if(control){control.removeAttribute('aria-busy');if('disabled'in control)control.disabled=false}syncCards()});
}
function beginQueue(packId,control){
  const current=bridge();
  if(!current?.queue||!current?.pickAndImport||!current?.version?.startsWith?.('1.1.1-')){
    status('Preparing the browser download bridge. Tap Download pack again in a moment.');
    ensureBridge().then(syncCards,error=>status(String(error?.message||error),true));
    return;
  }
  control.disabled=true;
  status('Preparing browser-managed downloads…');
  current.queue(packId,{onProgress:progress=>{if(progress?.message)status(progress.message)}})
    .then(result=>{status(`${result.pack.label} downloads are queued in the browser. Civweave can be closed while they finish.`);rerender()})
    .catch(error=>status(String(error?.message||error),true))
    .finally(()=>{control.disabled=false;syncCards()});
}
function onClick(event){
  const importControl=event.target.closest?.('[data-cw-pwa-browser-pack-import],a[href*="source=settings-ai-pack-import"]');
  if(importControl){
    const packId=packIdFrom(importControl);if(!packId)return;
    event.preventDefault();event.stopImmediatePropagation();beginImport(packId,importControl);return;
  }
  const download=event.target.closest?.('button[data-local-pack-download]');
  if(download){
    const packId=packIdFrom(download);if(!packId)return;
    event.preventDefault();event.stopImmediatePropagation();beginQueue(packId,download);
  }
}
const observer=new MutationObserver(()=>syncCards());
function boot(){
  ensureBridge().catch(()=>{});
  document.addEventListener('click',onClick,true);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  syncCards();
}
addEventListener('civweave:model-settings-opened',()=>queueMicrotask(syncCards));
addEventListener('civweave:local-model-pack-progress',()=>queueMicrotask(syncCards));
addEventListener('civweave:local-model-pack-installed',()=>queueMicrotask(syncCards));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

globalThis.CivweaveBrowserPackPwaImportV1=Object.freeze({version:VERSION,ensureBridge,syncCards,beginImport,beginQueue});
})();