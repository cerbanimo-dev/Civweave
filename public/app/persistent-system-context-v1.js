(()=>{
'use strict';

const VERSION='1.0.3-persistent-system-context-direct-routes';
const SYSTEMS=Object.freeze(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const PENDING_KEY='civweave.pending-system-context.v1';
const NAV_ID='cw-themed-system-nav';
const CHAT_ROOT_ID='cw-persistent-guide-chat-v215';
const CHAT_LAUNCHER_ID='cwp215-launcher';
if(globalThis.CivweavePersistentSystemContextV1?.version===VERSION)return;

let boundNav=null;
let observer=null;
let patchedLoader=null;
let patchedShell=null;
const boundControls=new WeakSet();

const valid=system=>SYSTEMS.includes(String(system||''));
const clean=value=>String(value??'').trim().toLowerCase();
const chat=()=>globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215||null;
const navApi=()=>globalThis.CivweaveFamilyNavigationV178||null;

function requestedContext(){const value=clean(new URLSearchParams(location.search).get('context'));return valid(value)?value:''}
function hostSystem(){
  const route=globalThis.CivweaveSystemRoutesV227?.identify?.(location.href||location.pathname);
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
  const requested=requestedContext();if(valid(requested))return requested;
  const current=chat()?.state?.().activeSystem;if(valid(current))return current;
  return hostSystem();
}
function syncSelection(system=hostSystem()){
  if(!valid(system))return false;
  document.documentElement.dataset.civweaveActiveSystemContext=system;
  try{navApi()?.syncCurrentSelection?.(system)}catch{}
  const nav=document.getElementById(NAV_ID);
  if(nav)for(const link of nav.querySelectorAll('a[data-system]')){
    const active=link.dataset.system===system;link.classList.toggle('is-current',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
  return true;
}
function emit(system,source){
  const detail=Object.freeze({schema:'civweave.system-context.v1',version:VERSION,system,activeSystem:system,hostSystem:hostSystem(),source:String(source||'api'),navigationReload:false,at:new Date().toISOString()});
  try{dispatchEvent(new CustomEvent('civweave:system-context-changed',{detail}))}catch{}return detail;
}
function switchContext(system,{source='api',open=null,focus=false}={}){
  system=clean(system);if(!valid(system))return false;remember(system);
  const api=chat(),wasOpen=Boolean(api?.state?.().open),keepOpen=open==null?wasOpen:Boolean(open);
  try{api?.switchGuide?.(system,{open:keepOpen,focus:Boolean(focus)})}catch{}
  syncSelection(hostSystem());emit(system,source);return true;
}
function applyPending(source='guide-ready'){
  const system=pending()||requestedContext()||chat()?.state?.().activeSystem||hostSystem();if(!valid(system))return false;return switchContext(system,{source,open:null,focus:false});
}
function bindNav(){
  const nav=document.getElementById(NAV_ID);if(!nav)return false;
  if(nav!==boundNav)boundNav=nav;
  syncSelection(hostSystem());
  return true;
}
function bindChatControls(){
  const launcher=document.getElementById(CHAT_LAUNCHER_ID);
  if(launcher&&!boundControls.has(launcher)){boundControls.add(launcher);launcher.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const system=selected();remember(system);chat()?.open?.({guide:system,focus:true});syncSelection(hostSystem())},true)}
  const root=document.getElementById(CHAT_ROOT_ID);
  if(root&&!boundControls.has(root)){boundControls.add(root);root.addEventListener('click',event=>{const button=event.target?.closest?.('[data-cw242-window]');if(!button)return;const system=clean(button.dataset.cw242Window);if(!valid(system))return;event.preventDefault();event.stopImmediatePropagation();switchContext(system,{source:'guide-switcher',open:true,focus:true})},true)}
  return Boolean(launcher||root);
}
function patchFamilyAiLoader(){
  const loader=globalThis.CivweaveFamilyAILoaderV105;if(!loader||loader===patchedLoader||typeof loader.openChat!=='function')return Boolean(loader);const original=loader.openChat.bind(loader);
  loader.openChat=(system,options={})=>{const requested=clean(options?.contextSystem),host=hostSystem(),sticky=selected(),target=valid(requested)&&requested!==host?requested:valid(sticky)?sticky:valid(requested)?requested:valid(system)?system:host;remember(target);return original(system,{...(options||{}),contextSystem:target})};
  loader.persistentSystemContext='direct-routes-v1';patchedLoader=loader;return true;
}
function patchFamilyShell(){
  const shell=globalThis.CivweaveFamilyShellV104;if(!shell||shell===patchedShell)return Boolean(shell);
  try{
    shell.route=system=>{const target=clean(system);if(!valid(target))return false;const routes=globalThis.CivweaveSystemRoutesV227;if(!routes?.navigate)return false;routes.navigate(target,{source:'family-shell-route'});return true};
    shell.persistentSystemContext='direct-routes-v1';patchedShell=shell;return true;
  }catch{return false}
}
function maintain(){bindNav();bindChatControls();patchFamilyAiLoader();patchFamilyShell();syncSelection(hostSystem())}
function install(){
  if(!pending())remember(requestedContext()||hostSystem());maintain();
  if(!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(maintain);observer.observe(document.documentElement,{childList:true,subtree:true})}
  addEventListener('civweave:guide-chat-ready',()=>{applyPending('guide-chat-ready');maintain()});addEventListener('civweave:persistent-guide-chat-ready',()=>{applyPending('persistent-guide-chat-ready');maintain()});addEventListener('civweave:assistant-runtime-ready',maintain);
  addEventListener('civweave:guide-chat-state',event=>{const system=clean(event?.detail?.activeSystem);if(valid(system)){remember(system);syncSelection(hostSystem())}});
  addEventListener('civweave:system-route-changed',()=>queueMicrotask(()=>syncSelection(hostSystem())));addEventListener('pageshow',maintain);addEventListener('focus',maintain);
  document.documentElement.dataset.civweaveSystemContextOwner='persistent-system-context-direct-routes';return true;
}

const api=Object.freeze({version:VERSION,owner:true,systems:SYSTEMS,hostSystem,requestedContext,selected,switchContext,applyPending,syncSelection,bindNav,bindChatControls,patchFamilyAiLoader,patchFamilyShell,install,navigationReload:false,realmNavigationReload:true,stickyUntilExplicitSwitch:true});
globalThis.CivweavePersistentSystemContextV1=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();