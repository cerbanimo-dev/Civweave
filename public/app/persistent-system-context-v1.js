(()=>{
'use strict';

const VERSION='1.0.1-persistent-system-context-v1';
const SYSTEMS=Object.freeze(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const PENDING_KEY='civweave.pending-system-context.v1';
const NAV_ID='cw-themed-system-nav';
const CHAT_ROOT_ID='cw-persistent-guide-chat-v215';
const CHAT_LAUNCHER_ID='cwp215-launcher';
const HOLD_MS=430;
const MOVE_TOLERANCE=12;
if(globalThis.CivweavePersistentSystemContextV1?.version===VERSION)return;

let boundNav=null;
let observer=null;
let gesture=null;
let suppressClickSystem='';
let suppressTimer=0;
let patchedLoader=null;
let patchedShell=null;
const boundControls=new WeakSet();

const valid=system=>SYSTEMS.includes(String(system||''));
const clean=value=>String(value??'').trim().toLowerCase();
const chat=()=>globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215||null;
const navApi=()=>globalThis.CivweaveFamilyNavigationV178||null;

function hostSystem(){
  const route=globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname);
  if(valid(route))return route;
  const declared=clean(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||document.body?.dataset?.civweaveSystem||document.body?.dataset?.system);
  if(valid(declared))return declared;
  const query=clean(new URLSearchParams(location.search).get('system'));
  if(valid(query))return query;
  return'civweave';
}
function pending(){try{const value=clean(localStorage.getItem(PENDING_KEY));return valid(value)?value:''}catch{return''}}
function remember(system){if(!valid(system))return false;try{localStorage.setItem(PENDING_KEY,system)}catch{}return true}
function selected(){
  const stored=pending();if(valid(stored))return stored;
  const current=chat()?.state?.().activeSystem;
  if(valid(current))return current;
  return hostSystem();
}
function syncSelection(system=selected()){
  if(!valid(system))return false;
  document.documentElement.dataset.civweaveActiveSystemContext=system;
  try{navApi()?.syncCurrentSelection?.(system)}catch{}
  const nav=document.getElementById(NAV_ID);
  if(nav)for(const link of nav.querySelectorAll('a[data-system]')){
    const active=link.dataset.system===system;
    link.classList.toggle('is-current',active);
    if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
  return true;
}
function emit(system,source){
  const detail=Object.freeze({schema:'civweave.system-context.v1',version:VERSION,system,activeSystem:system,hostSystem:hostSystem(),source:String(source||'api'),navigationReload:false,at:new Date().toISOString()});
  try{dispatchEvent(new CustomEvent('civweave:system-context-changed',{detail}))}catch{}
  return detail;
}
function switchContext(system,{source='api',open=null,focus=false}={}){
  system=clean(system);if(!valid(system))return false;
  remember(system);
  const api=chat(),wasOpen=Boolean(api?.state?.().open),keepOpen=open==null?wasOpen:Boolean(open);
  try{api?.switchGuide?.(system,{open:keepOpen,focus:Boolean(focus)})}catch{}
  syncSelection(system);emit(system,source);return true;
}
function applyPending(source='guide-ready'){
  const system=pending()||chat()?.state?.().activeSystem||hostSystem();
  if(!valid(system))return false;
  return switchContext(system,{source,open:null,focus:false});
}
function markGesture(event,link){gesture={system:clean(link?.dataset?.system),pointerId:event.pointerId,start:Date.now(),x:Number(event.clientX)||0,y:Number(event.clientY)||0,moved:false}}
function moveGesture(event){if(!gesture||event.pointerId!==gesture.pointerId)return;if(Math.hypot((Number(event.clientX)||0)-gesture.x,(Number(event.clientY)||0)-gesture.y)>MOVE_TOLERANCE)gesture.moved=true}
function finishGesture(event){
  if(!gesture||event.pointerId!==gesture.pointerId)return;
  if(!gesture.moved&&Date.now()-gesture.start>=HOLD_MS){suppressClickSystem=gesture.system;clearTimeout(suppressTimer);suppressTimer=setTimeout(()=>{suppressClickSystem=''},800)}
  gesture=null;
}
function interceptNavClick(event){
  const link=event.target?.closest?.(`#${NAV_ID} a[data-system]`);if(!link)return;
  const system=clean(link.dataset.system);if(!valid(system))return;
  if(suppressClickSystem===system){suppressClickSystem='';return}
  if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();event.stopImmediatePropagation();switchContext(system,{source:'five-guide-rail',open:null,focus:false});
}
function bindNav(){
  const nav=document.getElementById(NAV_ID);if(!nav||nav===boundNav)return Boolean(nav);
  boundNav=nav;
  nav.addEventListener('pointerdown',event=>{const link=event.target?.closest?.('a[data-system]');if(link)markGesture(event,link)},true);
  nav.addEventListener('pointermove',moveGesture,true);
  nav.addEventListener('pointerup',finishGesture,true);
  nav.addEventListener('pointercancel',()=>{gesture=null},true);
  nav.addEventListener('click',interceptNavClick,true);
  syncSelection();return true;
}
function bindChatControls(){
  const launcher=document.getElementById(CHAT_LAUNCHER_ID);
  if(launcher&&!boundControls.has(launcher)){
    boundControls.add(launcher);launcher.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const system=selected();remember(system);chat()?.open?.({guide:system,focus:true});syncSelection(system)},true);
  }
  const root=document.getElementById(CHAT_ROOT_ID);
  if(root&&!boundControls.has(root)){
    boundControls.add(root);root.addEventListener('click',event=>{const button=event.target?.closest?.('[data-cw242-window]');if(!button)return;const system=clean(button.dataset.cw242Window);if(!valid(system))return;event.preventDefault();event.stopImmediatePropagation();switchContext(system,{source:'guide-switcher',open:true,focus:true})},true);
  }
  return Boolean(launcher||root);
}
function patchFamilyAiLoader(){
  const loader=globalThis.CivweaveFamilyAILoaderV105;if(!loader||loader===patchedLoader||typeof loader.openChat!=='function')return Boolean(loader);
  const original=loader.openChat.bind(loader);
  loader.openChat=(system,options={})=>{
    const requested=clean(options?.contextSystem),host=hostSystem(),sticky=selected();
    const target=valid(requested)&&requested!==host?requested:valid(sticky)?sticky:valid(requested)?requested:valid(system)?system:host;
    remember(target);syncSelection(target);
    return original(system,{...(options||{}),contextSystem:target});
  };
  loader.persistentSystemContext='v1';patchedLoader=loader;return true;
}
function patchFamilyShell(){
  const shell=globalThis.CivweaveFamilyShellV104;if(!shell||shell===patchedShell)return Boolean(shell);
  try{shell.route=system=>switchContext(system,{source:'family-shell-route',open:null,focus:false});shell.persistentSystemContext='v1';patchedShell=shell;return true}catch{return false}
}
function maintain(){bindNav();bindChatControls();patchFamilyAiLoader();patchFamilyShell();syncSelection()}
function install(){
  maintain();
  if(!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(maintain);observer.observe(document.documentElement,{childList:true,subtree:true})}
  addEventListener('civweave:guide-chat-ready',()=>{applyPending('guide-chat-ready');maintain()});
  addEventListener('civweave:persistent-guide-chat-ready',()=>{applyPending('persistent-guide-chat-ready');maintain()});
  addEventListener('civweave:assistant-runtime-ready',maintain);
  addEventListener('civweave:guide-chat-state',event=>{const system=clean(event?.detail?.activeSystem);if(valid(system)){remember(system);syncSelection(system)}});
  addEventListener('pageshow',maintain);addEventListener('focus',maintain);
  document.documentElement.dataset.civweaveSystemContextOwner='persistent-system-context-v1';return true;
}

const api=Object.freeze({version:VERSION,owner:true,systems:SYSTEMS,hostSystem,selected,switchContext,applyPending,syncSelection,bindNav,bindChatControls,patchFamilyAiLoader,patchFamilyShell,install,navigationReload:false,stickyUntilExplicitSwitch:true});
globalThis.CivweavePersistentSystemContextV1=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
