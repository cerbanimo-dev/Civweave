(()=>{
'use strict';
const VERSION='1.1.1-rapid-navigation-race-guard';
const SYSTEMS=new Set(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const ROUTES=Object.freeze({
  civweave:['/app/working-campus-v440.html',{}],
  'living-school':['/app/cabinets/living-school/index.html',{cabinet:'1'}],
  cerbanimo:['/app/realm-console-v140.html',{system:'cerbanimo',cabinet:'1'}],
  fellowfare:['/app/fellowfare-cabinet-v144.html',{cabinet:'1'}],
  anarchadia:['/app/anarchadia-console-v139.html',{cabinet:'1'}]
});
const FRAME_ID='cw-persistent-system-stage';
const HUMAN_LAUNCHER_ID='cw-human-message-launcher-v1';
const AI_LAUNCHER_ID='cwp215-launcher';
const GUIDE_ROOT_ID='cw-persistent-guide-chat-v215';
const UPDATE_STYLE_ID='cw-persistent-platform-update-backlights-v1';
const SUBSYSTEM_STATE_KEY='civweave.subsystem-avatar-state.v347';
const GUIDE_THREAD_PREFIX='civweave.guide-thread.v350.';
const SETTINGS_GATEWAY='/app/settings-gateway-v317.js?v=1.0.133-settings-v324-direct-local-model-view';
const SETTINGS_LOCAL_ROUTE='/app/settings-local-route-v323.js?v=1.1.1-settings-local-route-v325-browser-pack-handoff';
const GUIDE_CHAT_SURFACE='/app/guide-chat-surface-v350.js?v=1.0.170-guide-chat-surface-v350-parakeet-no-proxy-worker';
const UPDATE_COLORS=Object.freeze({
  civweave:'#fff8ff',
  'living-school':'#9cff73',
  cerbanimo:'#c77dff',
  fellowfare:'#ffc04d',
  anarchadia:'#ff4ba3'
});
const UPDATE_STATES=new Set(['attention','needs-attention','warning','degraded','error','critical','failed','failure','blocked','conflict','unread','new','changed','discovery','available','complete','completed','success','celebrating']);
const frame=()=>document.getElementById(FRAME_ID);
const loading=()=>document.getElementById('cw-persistent-system-loading');
const errorBox=()=>document.getElementById('cw-persistent-system-error');
let current='';
let loadToken=0;
let loadTimer=0;
let chromeObserver=null;
let chromeTimers=[];
let settingsPromise=null;
let guidePromise=null;
let backlightTimers=[];

function cleanSystem(value){const id=String(value||'').toLowerCase();return SYSTEMS.has(id)?id:'civweave'}
function parse(value,fallback={}){try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'?parsed:fallback}catch{return fallback}}
function contentUrl(system,{feature=''}={}){
  system=cleanSystem(system);const [path,params]=ROUTES[system];const url=new URL(path,location.origin);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  url.searchParams.set('installed','1');url.searchParams.set('embed','1');url.searchParams.set('persistentShell','1');
  if(feature)url.searchParams.set('feature',String(feature));
  return url;
}
function shellUrl(system,{feature=''}={}){
  const url=new URL('/app/persistent-system-shell-v1.html',location.origin);url.searchParams.set('system',cleanSystem(system));url.searchParams.set('installed','1');if(feature)url.searchParams.set('feature',String(feature));return url;
}
function mark(system){
  current=cleanSystem(system);document.documentElement.dataset.civweaveSystem=current;document.documentElement.dataset.cwThemedCurrent=current;document.documentElement.dataset.persistentSystem=current;
  try{localStorage.setItem('civweave.pending-system-context.v1',current)}catch{}
  try{globalThis.CivweaveFamilyNavigationV178?.syncCurrentSelection?.(current)}catch{}
}
function showLoading(){const node=loading();if(node)node.hidden=false;const error=errorBox();if(error)error.dataset.open='0'}
function hideLoading(){const node=loading();if(node)node.hidden=true}
function showError(message){hideLoading();const node=errorBox();if(node){node.textContent=String(message||'System did not finish loading.');node.dataset.open='1'}}

function installBacklightStyle(){
  if(document.getElementById(UPDATE_STYLE_ID))return;
  const style=document.createElement('style');style.id=UPDATE_STYLE_ID;style.textContent=`
#cw-themed-system-nav .cw-themed-system-avatar-wrap{transition:background .18s ease,box-shadow .18s ease,border-color .18s ease!important}
#cw-themed-system-nav .cw-themed-system-avatar-wrap::after{content:""!important;position:absolute!important;inset:2px!important;border-radius:18px!important;z-index:1!important;pointer-events:none!important;opacity:0!important;background:radial-gradient(circle at 50% 58%,color-mix(in srgb,var(--system-update) 96%,white 4%) 0 22%,color-mix(in srgb,var(--system-update) 82%,transparent) 46%,color-mix(in srgb,var(--system-update) 48%,transparent) 70%,transparent 88%)!important;mix-blend-mode:screen!important;filter:saturate(1.45) brightness(1.2)!important;transition:opacity .18s ease!important}
#cw-themed-system-nav .cw-themed-system-link[data-has-update="true"] .cw-themed-system-avatar-wrap{background:linear-gradient(180deg,color-mix(in srgb,var(--system-update) 66%,white 34%),color-mix(in srgb,var(--system-update) 48%,var(--system-shell) 52%))!important;border-color:color-mix(in srgb,var(--system-update) 86%,white 14%)!important;box-shadow:inset 0 0 22px color-mix(in srgb,var(--system-update) 68%,transparent),0 0 24px color-mix(in srgb,var(--system-update) 92%,transparent),0 2px 8px #0006!important}
#cw-themed-system-nav .cw-themed-system-link[data-has-update="true"] .cw-themed-system-avatar-wrap::after{opacity:.98!important}
#cw-themed-system-nav .cw-themed-system-avatar{z-index:2!important}
@media(prefers-reduced-motion:reduce){#cw-themed-system-nav .cw-themed-system-avatar-wrap,#cw-themed-system-nav .cw-themed-system-avatar-wrap::after{transition:none!important}}
`;
  document.head?.append(style);
}
function subsystemRows(){try{return parse(localStorage.getItem(SUBSYSTEM_STATE_KEY)||'{}',{})}catch{return{}}}
function subsystemNeedsUpdate(row){
  if(!row||row.cleared)return false;
  if(row.expiresAt&&Number(row.expiresAt)<=Date.now())return false;
  const state=String(row.state||'neutral').toLowerCase();
  if(state==='neutral')return false;
  return Boolean(row.sticky||Number(row.priority||0)>=3||UPDATE_STATES.has(state));
}
function guideUnread(system){try{return Boolean((globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215)?.hasUnread?.(system))}catch{return false}}
function syncBacklights(){
  installBacklightStyle();
  const rows=subsystemRows();
  for(const system of SYSTEMS){
    const link=document.querySelector(`#cw-themed-system-nav .cw-themed-system-link[data-system="${system}"]`);
    if(!link)continue;
    link.style.setProperty('--system-update',UPDATE_COLORS[system]);
    const chat=guideUnread(system),subsystem=subsystemNeedsUpdate(rows[system]),active=chat||subsystem;
    if(active){link.dataset.hasUpdate='true';link.dataset.updateSource=chat&&subsystem?'chat+platform':chat?'chat':'platform'}
    else{delete link.dataset.hasUpdate;delete link.dataset.updateSource}
  }
  document.documentElement.dataset.persistentUpdateSignals='platform-backlight-v2';
  return true;
}
function scheduleBacklights(){
  backlightTimers.forEach(clearTimeout);
  backlightTimers=[0,100,420].map(delay=>setTimeout(syncBacklights,delay));
  return true;
}

function scriptByPath(src){const path=new URL(src,location.href).pathname;return[...document.scripts].find(node=>{try{return new URL(node.src,location.href).pathname===path}catch{return false}})||null}
function loadScript(src,ready,label){
  if(ready())return Promise.resolve(true);
  const existing=scriptByPath(src);
  if(existing)return new Promise((resolve,reject)=>{
    let elapsed=0;const timer=setInterval(()=>{elapsed+=40;if(ready()){clearInterval(timer);resolve(true)}else if(elapsed>=5000){clearInterval(timer);reject(new Error(`${label} did not become ready.`))}},40);
  });
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=src;script.async=false;
    script.onload=()=>ready()?resolve(true):reject(new Error(`${label} loaded without its runtime.`));
    script.onerror=()=>reject(new Error(`${label} could not load.`));
    document.head?.append(script);
  });
}
function settingsApi(){return globalThis.CivweaveSettingsV320||globalThis.CivweaveSettingsGatewayV317||null}
function ensureSettings(){
  if(settingsApi()?.open)return Promise.resolve(settingsApi());
  if(settingsPromise)return settingsPromise;
  settingsPromise=loadScript(SETTINGS_LOCAL_ROUTE,()=>Boolean(globalThis.CivweaveSettingsLocalRouteV323),'Settings local-model view')
    .catch(()=>false)
    .then(()=>loadScript(SETTINGS_GATEWAY,()=>Boolean(settingsApi()?.open),'Shared Settings'))
    .then(()=>settingsApi())
    .finally(()=>{settingsPromise=null});
  return settingsPromise;
}
function openSettings(){
  const launcher=document.querySelector('#cw-themed-system-nav .cw-themed-system-link[data-system="civweave"]')||document.activeElement;
  const invoke=()=>{const api=settingsApi();if(!api?.open)return false;try{api.open(launcher);return true}catch{return false}};
  if(invoke())return true;
  void ensureSettings().then(invoke).catch(error=>showError(error?.message||'Settings could not open.'));
  return true;
}
function guideApi(){return globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215||null}
function ensureGuide(){
  if(guideApi()?.open)return Promise.resolve(guideApi());
  if(guidePromise)return guidePromise;
  guidePromise=loadScript(GUIDE_CHAT_SURFACE,()=>Boolean(guideApi()?.open),'Guide chat')
    .then(()=>guideApi())
    .finally(()=>{guidePromise=null});
  return guidePromise;
}
function openGuide(system){
  system=cleanSystem(system);
  const invoke=()=>{const api=guideApi();if(!api?.open)return false;try{return Boolean(api.open({guide:system,focus:true}))}catch{return false}};
  if(invoke())return true;
  void ensureGuide().then(invoke).catch(error=>showError(error?.message||'Guide chat could not open.'));
  return true;
}
function closeQuickMenu(){try{globalThis.CivweaveFamilyNavigationV178?.closeQuickMenu?.({restoreFocus:false})}catch{}}

function clearChildChromeWork(){
  chromeTimers.forEach(clearTimeout);chromeTimers=[];
  if(chromeObserver)try{chromeObserver.disconnect()}catch{}
  chromeObserver=null;
  return true;
}
function frameMatchesExpected(host=frame(),expectedHref=''){
  if(!host)return false;
  const expected=String(expectedHref||host.dataset.cwExpectedHref||'');
  if(!expected)return true;
  try{return new URL(host.contentWindow?.location?.href||'',location.href).href===new URL(expected,location.href).href}catch{return false}
}
function suppressChildChrome(reason='frame-load',{token=loadToken,expectedHref=''}={}){
  if(token!==loadToken)return false;
  const host=frame();if(!frameMatchesExpected(host,expectedHref))return false;
  let doc,win;try{doc=host?.contentDocument;win=host?.contentWindow}catch{return false}
  if(!doc?.documentElement)return false;
  const remove=()=>{
    if(token!==loadToken||!frameMatchesExpected(host,expectedHref))return;
    for(const id of [HUMAN_LAUNCHER_ID,AI_LAUNCHER_ID,GUIDE_ROOT_ID])doc.getElementById(id)?.remove();
    doc.documentElement.dataset.persistentParentChrome='parent-owned';
    doc.documentElement.dataset.persistentChromeReason=reason;
  };
  remove();
  if(chromeObserver)try{chromeObserver.disconnect()}catch{}
  const Observer=win?.MutationObserver||MutationObserver;
  chromeObserver=new Observer(remove);
  chromeObserver.observe(doc.documentElement,{childList:true,subtree:true});
  return true;
}
function scheduleChildChrome(reason='frame-load',{token=loadToken,expectedHref=''}={}){
  clearChildChromeWork();
  chromeTimers=[0,60,220,800,1800].map(delay=>setTimeout(()=>{if(token===loadToken)suppressChildChrome(`${reason}-${delay}`,{token,expectedHref})},delay));
  return true;
}

function navigate(system,{feature='',replace=false,source='persistent-navbar'}={}){
  system=cleanSystem(system);mark(system);const url=shellUrl(system,{feature});history[replace?'replaceState':'pushState']({system,feature},'',`${url.pathname}${url.search}`);
  const target=contentUrl(system,{feature}),host=frame();if(!host)return false;
  clearChildChromeWork();
  const token=++loadToken;showLoading();clearTimeout(loadTimer);loadTimer=setTimeout(()=>{if(token===loadToken)showError(`${system} is taking too long to open.`)},9000);
  host.dataset.cwLoadToken=String(token);host.dataset.cwExpectedHref=target.href;host.title=`${system} · Civweave`;host.src=target.href;
  scheduleBacklights();
  try{dispatchEvent(new CustomEvent('civweave:system-route-changed',{detail:{system,feature,source,version:VERSION,persistent:true}}))}catch{}
  return true;
}
function intercept(event){
  if(event.defaultPrevented||event.button!=null&&event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target?.closest?.('#cw-themed-system-nav a[data-system]');
  if(link){if(link.classList.contains('is-menu-open'))return;event.preventDefault();event.stopImmediatePropagation();navigate(link.dataset.system,{source:'shared-navbar'});return}
  const quick=event.target?.closest?.('#cw-themed-system-nav-menu [data-cw-nav-feature]');
  if(!quick)return;
  const system=cleanSystem(quick.dataset.cwNavSystem),feature=String(quick.dataset.cwNavFeature||'');
  event.preventDefault();event.stopImmediatePropagation();closeQuickMenu();
  if(feature==='settings'){openSettings();return}
  if(feature==='chat'){openGuide(system);return}
  navigate(system,{feature,source:'shared-navbar-quick'});
}
function bindBacklights(){
  for(const name of ['civweave:guide-chat-state','civweave:realm-guide-thread-changed','civweave:guide-chat-ready','civweave:subsystem-avatar-state','civweave:subsystem-avatar-state-ready','civweave:system-route-changed'])addEventListener(name,scheduleBacklights);
  addEventListener('storage',event=>{const key=String(event.key||'');if(key===SUBSYSTEM_STATE_KEY||key.startsWith(GUIDE_THREAD_PREFIX))scheduleBacklights()});
  addEventListener('focus',scheduleBacklights);
  addEventListener('pageshow',scheduleBacklights);
  return true;
}
function boot(){
  document.addEventListener('click',intercept,true);
  bindBacklights();
  const host=frame();host?.addEventListener('load',()=>{
    const token=Number(host.dataset.cwLoadToken||0),expectedHref=String(host.dataset.cwExpectedHref||'');
    if(token!==loadToken||!frameMatchesExpected(host,expectedHref))return;
    clearTimeout(loadTimer);hideLoading();const node=errorBox();if(node)node.dataset.open='0';scheduleChildChrome('frame-load',{token,expectedHref});scheduleBacklights();
  });
  const query=new URLSearchParams(location.search);navigate(cleanSystem(query.get('system')),{feature:query.get('feature')||'',replace:true,source:'shell-boot'});
  addEventListener('popstate',()=>{const query=new URLSearchParams(location.search);navigate(cleanSystem(query.get('system')),{feature:query.get('feature')||'',replace:true,source:'history'});});
  scheduleBacklights();
}

globalThis.CivweavePersistentSystemShellV1=Object.freeze({
  version:VERSION,navigate,contentUrl,shellUrl,current:()=>current,systems:[...SYSTEMS],persistentNavbar:true,stage:'iframe-content-only',
  chromeOwner:true,sharedQuickFeatures:Object.freeze(['settings','chat']),updateSignal:'platform-backlight-v2',childChatLauncherPolicy:'parent-only',
  openSettings,openGuide,syncBacklights,suppressChildChrome
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
