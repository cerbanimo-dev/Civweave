(()=>{
'use strict';
const VERSION='1.0.4-platform-stability-v159';
if(globalThis.CivweavePlatformStabilityV159?.version===VERSION)return;
const CHAT_STATE='civweave.chat-dock.v159';
const nativeRaf=typeof globalThis.requestAnimationFrame==='function'?globalThis.requestAnimationFrame.bind(globalThis):(callback)=>setTimeout(()=>callback(performance.now()),16);
const nativeCancel=typeof globalThis.cancelAnimationFrame==='function'?globalThis.cancelAnimationFrame.bind(globalThis):clearTimeout;
if(!globalThis.requestAnimationFrame?.cw159Bound){const safe=callback=>nativeRaf(callback);safe.cw159Bound=true;globalThis.requestAnimationFrame=safe;globalThis.cancelAnimationFrame=id=>nativeCancel(id)}
let scheduled=false;
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
function chatState(){return parse(sessionStorage.getItem(CHAT_STATE),{minimized:false})}
function saveChatState(minimized){sessionStorage.setItem(CHAT_STATE,JSON.stringify({minimized:Boolean(minimized),at:new Date().toISOString()}))}
function chatBand(){return document.querySelector('.ch142-control-band')}
function ensureDock(){
  let dock=document.getElementById('cw159-chat-dock');
  if(!dock){dock=document.createElement('button');dock.id='cw159-chat-dock';dock.type='button';dock.dataset.cw159ChatDock='';dock.className='cw159-chat-dock';dock.innerHTML='<span aria-hidden="true">✦</span><b>Weaveling</b><small>Chat</small>';dock.setAttribute('aria-label','Open Weaveling chat')}
  const tray=document.getElementById('cwf104-tray');
  if(tray){tray.classList.add('cw159-has-chat-dock');if(dock.parentNode!==tray)tray.append(dock)}
  else if(!dock.isConnected&&document.body)document.body.append(dock);
  return dock;
}
function setMinimized(minimized,{focus=true}={}){
  const band=chatBand(),dock=ensureDock();
  saveChatState(minimized);
  if(band){band.classList.toggle('cw159-is-minimized',minimized);band.setAttribute('aria-hidden',minimized?'true':'false')}
  dock.classList.toggle('is-open',!minimized&&Boolean(band));dock.setAttribute('aria-pressed',String(!minimized&&Boolean(band)));
  if(!minimized&&band&&focus){globalThis.requestAnimationFrame(()=>{band.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});band.querySelector('textarea,input')?.focus()})}
}
function enhanceBand(band){
  if(!band)return;
  let button=band.querySelector('[data-cw159-chat-minimize]');
  if(!button){button=document.createElement('button');button.type='button';button.dataset.cw159ChatMinimize='';button.className='cw159-chat-minimize';button.textContent='Minimize to tray';button.setAttribute('aria-label','Minimize Weaveling chat to the navigation tray');const guide=band.querySelector('.ch142-guide')||band;guide.append(button)}
  const minimized=chatState().minimized;band.classList.toggle('cw159-is-minimized',minimized);band.setAttribute('aria-hidden',minimized?'true':'false');ensureDock().classList.toggle('is-open',!minimized);
}
function enhanceDialogs(){
  document.querySelectorAll('dialog.cw127-dialog,dialog#cw138-intentions').forEach(dialog=>{
    if(dialog.dataset.cw159Escape==='true')return;dialog.dataset.cw159Escape='true';
    const panel=dialog.querySelector(':scope > section,:scope > form')||dialog;
    const returnBar=document.createElement('div');returnBar.className='cw159-dialog-return';returnBar.innerHTML='<button type="button" data-cw159-close-dialog>Close and return</button>';panel.append(returnBar);
    dialog.addEventListener('cancel',()=>setTimeout(()=>dialog.returnValue='',0));
  })
}
function wrapLoader(){
  const api=globalThis.CivweaveFamilyAILoaderV105;if(!api?.openChat||api.cw159Wrapped)return;
  const original=api.openChat.bind(api);api.openChat=async(...args)=>{saveChatState(false);const result=await original(...args);enhanceBand(result||chatBand());setMinimized(false);return result};api.cw159Wrapped=true;
}
function patch(){ensureDock();enhanceBand(chatBand());enhanceDialogs();wrapLoader()}
function schedule(){if(scheduled)return;scheduled=true;globalThis.requestAnimationFrame(()=>{scheduled=false;patch()})}
document.addEventListener('pointerdown',event=>{if(event.target.closest?.('[data-cwf-chat]'))saveChatState(false)},true);
document.addEventListener('click',event=>{
  const minimize=event.target.closest?.('[data-cw159-chat-minimize]');if(minimize){event.preventDefault();event.stopImmediatePropagation();setMinimized(true);return}
  const dock=event.target.closest?.('[data-cw159-chat-dock]');if(dock){event.preventDefault();event.stopImmediatePropagation();const band=chatBand();if(band){setMinimized(false);return}saveChatState(false);globalThis.CivweaveFamilyAILoaderV105?.openChat?.('civweave',{contextSystem:document.documentElement.dataset.civweaveSystem||'civweave'});return}
  const close=event.target.closest?.('[data-cw159-close-dialog]');if(close){event.preventDefault();const dialog=close.closest('dialog');if(dialog?.open)dialog.close();return}
  if(event.target.closest?.('[data-cwf-chat]')){saveChatState(false);schedule()}
},true);
const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});
document.readyState==='loading'?addEventListener('DOMContentLoaded',schedule,{once:true}):schedule();addEventListener('pageshow',schedule);
globalThis.CivweavePlatformStabilityV159={version:VERSION,setChatMinimized:setMinimized,patch:schedule,domReadySafe:true};
})();
