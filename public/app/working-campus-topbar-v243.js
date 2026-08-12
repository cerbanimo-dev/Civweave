(()=>{
'use strict';

const VERSION='1.0.117-working-campus-topbar-v243-downloads-entry-v2';
const STYLE_ID='cw-working-campus-topbar-v243-style';
const MAP_BUTTON_ID='cw-working-campus-map-v243';
const DOWNLOADS_BUTTON_ID='cw-working-campus-downloads-v243';
const MAP_EVENT='civweave:map-open-request';
const MAP_READY_EVENT='civweave:map-ready';
const MAP_API_NAME='CivweaveMapLaunchV243';
const FINDER_API_NAME='CivweaveFederationFinderV268';
const DOWNLOADS_API_NAME='CivweaveDownloadsLaunchV243';
const FINDER_STORAGE='civweave.federation-finder.origin.v1';
const HOST_ENDPOINT_STORAGE='federation-finder.physical-node-endpoint';
const BRAND_ICON='/app/logos/civweave-pwa-192-v247.png';
let header=null;
let mapButton=null;
let downloadsButton=null;
let resizeObserver=null;
let mapOpenHandler=null;
let mapRoute='';

if(globalThis[MAP_API_NAME]?.version===VERSION)return;

const isCivweave=()=>{
  const declared=String(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||'').toLowerCase();
  return declared==='civweave'||location.pathname==='/app/working-campus-v156.html';
};
const clean=value=>String(value??'').trim();
function toast(message){
  const existing=document.getElementById('toast');
  if(existing){existing.textContent=message;existing.hidden=false;setTimeout(()=>{existing.hidden=true},3600);return}
  const node=document.createElement('div');node.setAttribute('role','status');node.textContent=message;Object.assign(node.style,{position:'fixed',zIndex:'2147483647',left:'50%',bottom:'calc(var(--cw-themed-nav-height,58px) + 18px)',transform:'translateX(-50%)',maxWidth:'min(92vw,520px)',padding:'10px 13px',border:'1px solid #ffffff33',borderRadius:'12px',background:'#0b1728f2',color:'#fff',boxShadow:'0 8px 30px #0009'});document.body.append(node);setTimeout(()=>node.remove(),3600)
}
function normalizedRoute(value){
  const raw=clean(value);if(!raw)return'';
  try{const url=new URL(raw,location.origin);return url.origin===location.origin?`${url.pathname}${url.search}${url.hash}`:''}catch{return''}
}
function normalizeFinderOrigin(value){
  const raw=clean(value);if(!raw)return'';
  try{const url=new URL(raw,location.origin);if(url.protocol!=='http:'&&url.protocol!=='https:')return'';return url.origin}catch{return''}
}
function normalizeHostOrigin(value){
  const raw=clean(value);if(!raw)return'';
  try{const url=new URL(raw,location.origin);if(url.protocol!=='http:'&&url.protocol!=='https:')return'';if(url.username||url.password)return'';return url.origin}catch{return''}
}
function storedHostOrigin(){
  try{return normalizeHostOrigin(localStorage.getItem(HOST_ENDPOINT_STORAGE)||'')}catch{return''}
}
function isLoopbackOrigin(value){
  const normalized=normalizeFinderOrigin(value);if(!normalized)return false;
  try{const host=new URL(normalized).hostname.replace(/^\[|\]$/g,'').toLowerCase();return host==='localhost'||host==='127.0.0.1'||host==='::1'}catch{return false}
}
function configuredFinderUrl(){
  const params=new URLSearchParams(location.search);
  const explicit=normalizeFinderOrigin(params.get('finder')||params.get('federationFinder')||'');
  if(explicit){try{localStorage.setItem(FINDER_STORAGE,explicit)}catch{};return new URL('/finder',explicit).href}
  let stored='';try{stored=normalizeFinderOrigin(localStorage.getItem(FINDER_STORAGE)||'')}catch{}
  if(stored){
    if(isLoopbackOrigin(stored)&&!isLoopbackOrigin(location.origin)){try{localStorage.removeItem(FINDER_STORAGE)}catch{}}
    else return new URL('/finder',stored).href
  }
  return new URL('/finder',location.origin).href
}
function configureFinder(origin){
  const normalized=normalizeFinderOrigin(origin);
  if(!normalized)throw new Error('Federation Finder origin must be an http(s) node origin.');
  try{localStorage.setItem(FINDER_STORAGE,normalized)}catch{}
  return new URL('/finder',normalized).href
}
function downloadsUrl(){
  const target=new URL('/app/index.html',location.origin);
  const current=new URLSearchParams(location.search);
  const explicitHost=normalizeHostOrigin(current.get('host')||current.get('hostNode')||'');
  if(explicitHost)target.searchParams.set('host',explicitHost);
  for(const key of ['node','nodeId','node_id','finder','federationFinder']){
    const value=clean(current.get(key));
    if(value&&!target.searchParams.has(key))target.searchParams.set(key,value)
  }
  if(!target.searchParams.has('host')){
    const stored=storedHostOrigin();
    if(stored)target.searchParams.set('host',stored)
  }
  target.searchParams.set('manage','downloads');
  target.searchParams.set('source','working-campus');
  return target.href
}
function openDownloads(){
  location.assign(downloadsUrl());
  return true
}
function openFederationFinder(){
  const target=configuredFinderUrl();
  const url=new URL(target,location.origin);
  if(url.origin===location.origin){location.assign(`${url.pathname}${url.search}${url.hash}`);return true}
  try{
    const opened=window.open(target,'civweave-federation-finder');
    if(opened){try{opened.opener=null}catch{};return true}
  }catch(error){console.warn('[Civweave] Remote Federation Finder window could not open.',error)}
  location.assign(target);
  return true
}
function registerMap(detail={}){
  if(typeof detail.open==='function')mapOpenHandler=detail.open;
  const route=normalizedRoute(detail.route||detail.url||'');if(route)mapRoute=route;
  if(mapButton){mapButton.dataset.mapState='ready';mapButton.title='Open Federation Finder'}
  return true
}
function openMap(){
  try{if(openFederationFinder())return true}catch(error){console.warn('[Civweave] Federation Finder launch failed.',error)}
  const direct=globalThis.CivweaveMapSystem||globalThis.CivweaveMapV1||globalThis.CivweaveMap;
  try{if(typeof direct?.open==='function'){direct.open({source:'working-campus',system:'civweave'});return true}}catch(error){console.warn('[Civweave] Map open handler failed.',error)}
  try{if(typeof mapOpenHandler==='function'){mapOpenHandler({source:'working-campus',system:'civweave'});return true}}catch(error){console.warn('[Civweave] Registered map open handler failed.',error)}
  if(mapRoute){location.assign(mapRoute);return true}
  const detail={source:'working-campus',system:'civweave',handled:false,route:'',open:null};
  const event=new CustomEvent(MAP_EVENT,{detail,cancelable:true});
  dispatchEvent(event);
  if(event.defaultPrevented||detail.handled)return true;
  if(typeof detail.open==='function'){registerMap({open:detail.open});return openMap()}
  const eventRoute=normalizedRoute(detail.route);if(eventRoute){mapRoute=eventRoute;location.assign(mapRoute);return true}
  toast('Federation Finder could not open and no fallback map runtime is registered.');
  return false
}
function syncHeaderHeight(){
  if(!header?.isConnected)return;
  const height=Math.ceil(header.getBoundingClientRect().height||0);
  document.documentElement.style.setProperty('--cw-working-campus-topbar-height',`${Math.max(48,height)}px`)
}
function repairBrand(){
  const image=header?.querySelector('#brand-home img,.brand img[alt="Civweave"]');
  if(!image)return false;
  if(image.getAttribute('src')!==BRAND_ICON)image.setAttribute('src',BRAND_ICON);
  if(!image.dataset.cw243ValidBrand){image.dataset.cw243ValidBrand='true';image.addEventListener('error',()=>{if(image.getAttribute('src')!==BRAND_ICON)image.setAttribute('src',BRAND_ICON)})}
  return true
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
html[data-civweave-system-route="civweave"],html[data-civweave-system="civweave"]{max-width:100%;overflow-x:clip}
html[data-civweave-system-route="civweave"] body,html[data-civweave-system="civweave"] body{max-width:100%;overflow-x:clip}
html[data-civweave-system-route="civweave"] main.app,html[data-civweave-system="civweave"] main.app{max-width:100%;overflow-x:clip}
html[data-civweave-system-route="civweave"] main.app>header.top,html[data-civweave-system="civweave"] main.app>header.top{position:sticky!important;top:max(6px,env(safe-area-inset-top))!important;z-index:2147483646!important;pointer-events:auto!important;isolation:isolate!important;overflow:visible!important;grid-template-columns:minmax(190px,1fr) auto auto auto auto auto auto!important;grid-template-areas:"brand modes map downloads settings review theme"!important;box-shadow:0 10px 28px #0008!important;max-width:1180px!important;width:100%!important;min-width:0!important}
html[data-civweave-system-route="civweave"] main.app>header.top>*,html[data-civweave-system="civweave"] main.app>header.top>*{pointer-events:auto!important;min-width:0}
#${MAP_BUTTON_ID}{grid-area:map;position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:38px;border-color:#8ee8ff66;background:linear-gradient(135deg,#8ee8ff18,#8af5d214)}
#${MAP_BUTTON_ID}[data-map-state="ready"]{border-color:#8af5d299;box-shadow:inset 0 0 14px #8af5d214}
#${DOWNLOADS_BUTTON_ID}{grid-area:downloads;position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:38px;border-color:#f6d77d66;background:linear-gradient(135deg,#f6d77d18,#ef9cff14)}
#${DOWNLOADS_BUTTON_ID}:focus-visible{outline:2px solid #f6d77dcc;outline-offset:2px}
html[data-civweave-system-route="civweave"] #cw-persistent-guide-chat-v215,html[data-civweave-system="civweave"] #cw-persistent-guide-chat-v215{top:calc(var(--cw-working-campus-topbar-height,88px) + env(safe-area-inset-top) + 14px)!important;bottom:calc(var(--cw-themed-nav-height,58px) + env(safe-area-inset-bottom) + 10px)!important;height:auto!important;max-height:none!important;z-index:2147483644!important}
html[data-civweave-system-route="civweave"] #cw-persistent-guide-chat-v215.is-minimized,html[data-civweave-system="civweave"] #cw-persistent-guide-chat-v215.is-minimized{top:auto!important;height:auto!important;max-height:min(38dvh,300px)!important}
@media(max-width:960px){html[data-civweave-system-route="civweave"] main.app>header.top,html[data-civweave-system="civweave"] main.app>header.top{grid-template-columns:minmax(0,1fr) auto auto auto auto!important;grid-template-areas:"brand modes map downloads settings" "brand review theme diagnostics diagnostics"!important}}
@media(max-width:700px){
html[data-civweave-system-route="civweave"] main.app>header.top,html[data-civweave-system="civweave"] main.app>header.top{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;grid-template-areas:"brand brand" "modes modes" "map downloads" "settings review" "theme theme"!important;top:max(4px,env(safe-area-inset-top))!important;gap:6px!important}
html[data-civweave-diagnostics="true"][data-civweave-system-route="civweave"] main.app>header.top,html[data-civweave-diagnostics="true"][data-civweave-system="civweave"] main.app>header.top{grid-template-areas:"brand brand" "modes modes" "map downloads" "settings review" "theme theme" "diagnostics diagnostics"!important}
html[data-civweave-system-route="civweave"] main.app>header.top .mode-switch,html[data-civweave-system="civweave"] main.app>header.top .mode-switch{width:100%!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}
html[data-civweave-system-route="civweave"] main.app>header.top .pill,html[data-civweave-system="civweave"] main.app>header.top .pill,html[data-civweave-system-route="civweave"] main.app>header.top [data-cw160-review],html[data-civweave-system="civweave"] main.app>header.top [data-cw160-review],html[data-civweave-system-route="civweave"] main.app>header.top [data-cw160-theme],html[data-civweave-system="civweave"] main.app>header.top [data-cw160-theme]{min-width:0!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important}
#${MAP_BUTTON_ID},#${DOWNLOADS_BUTTON_ID}{min-width:0!important;width:100%!important;padding:8px 9px!important}
html[data-civweave-system-route="civweave"] main.app>.campus,html[data-civweave-system="civweave"] main.app>.campus{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;overflow:visible!important;overscroll-behavior:auto!important;width:100%!important;max-width:1180px!important;padding-bottom:0!important}
html[data-civweave-system-route="civweave"] main.app>.campus .realm-node,html[data-civweave-system="civweave"] main.app>.campus .realm-node{min-width:0!important;width:100%!important;max-width:100%!important;flex:none!important}
html[data-civweave-system-route="civweave"] #cw-shared-guide-surface-v236,html[data-civweave-system="civweave"] #cw-shared-guide-surface-v236{width:calc(100% - 14px)!important;max-width:calc(100vw - 14px)!important;min-width:0!important}
html[data-civweave-system-route="civweave"] #cw-persistent-guide-chat-v215,html[data-civweave-system="civweave"] #cw-persistent-guide-chat-v215{top:calc(var(--cw-working-campus-topbar-height,226px) + env(safe-area-inset-top) + 10px)!important}
}
@media(max-width:420px){html[data-civweave-system-route="civweave"] main.app>.campus,html[data-civweave-system="civweave"] main.app>.campus{grid-template-columns:1fr!important}#${MAP_BUTTON_ID} span:last-child,#${DOWNLOADS_BUTTON_ID} span:last-child{font-size:11px}}
`;
  document.head.append(style)
}
function installMapButton(){
  header=document.querySelector('main.app>header.top');if(!header)return false;
  repairBrand();
  mapButton=document.getElementById(MAP_BUTTON_ID);
  if(!mapButton){mapButton=document.createElement('button');mapButton.id=MAP_BUTTON_ID;mapButton.type='button';mapButton.className='pill map-pill';mapButton.dataset.mapState='ready';mapButton.innerHTML='<span aria-hidden="true">⌖</span><span>Map</span>';mapButton.setAttribute('aria-label','Open Federation Finder map');const settings=header.querySelector('#settings-button');if(settings)header.insertBefore(mapButton,settings);else header.append(mapButton)}
  if(!mapButton.dataset.cw243Bound){mapButton.dataset.cw243Bound='true';mapButton.addEventListener('click',openMap)}
  mapButton.dataset.mapState='ready';mapButton.title='Open Federation Finder';
  return true
}
function installDownloadsButton(){
  header=document.querySelector('main.app>header.top');if(!header)return false;
  downloadsButton=document.getElementById(DOWNLOADS_BUTTON_ID);
  if(!downloadsButton){
    downloadsButton=document.createElement('button');downloadsButton.id=DOWNLOADS_BUTTON_ID;downloadsButton.type='button';downloadsButton.className='pill downloads-pill';downloadsButton.innerHTML='<span aria-hidden="true">⇩</span><span>Downloads</span>';downloadsButton.setAttribute('aria-label','Manage Civweave installs, downloads, and host node connection');
    const settings=header.querySelector('#settings-button');if(settings)header.insertBefore(downloadsButton,settings);else header.append(downloadsButton)
  }
  if(!downloadsButton.dataset.cw243Bound){downloadsButton.dataset.cw243Bound='true';downloadsButton.addEventListener('click',openDownloads)}
  downloadsButton.title='Manage installs, offline downloads, and host node connection';
  return true
}
function installHeaderControls(){
  if(!installMapButton())return false;
  installDownloadsButton();
  syncHeaderHeight();
  resizeObserver?.disconnect();
  if('ResizeObserver'in globalThis){resizeObserver=new ResizeObserver(syncHeaderHeight);resizeObserver.observe(header)}
  addEventListener('resize',syncHeaderHeight,{passive:true});
  globalThis.visualViewport?.addEventListener('resize',syncHeaderHeight,{passive:true});
  document.documentElement.dataset.civweaveWorkingCampusTopbar='v243-mobile-v248-federation-finder-v268-downloads-entry-v2';
  return true
}
function start(){if(!isCivweave())return;installStyle();if(!installHeaderControls())queueMicrotask(installHeaderControls)}
addEventListener(MAP_READY_EVENT,event=>registerMap(event.detail||{}));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

globalThis[FINDER_API_NAME]=Object.freeze({version:'1.7.2-launch-v268-no-localhost-v1',storageKey:FINDER_STORAGE,defaultOrigin:location.origin,url:configuredFinderUrl,configure:configureFinder,open:openFederationFinder});
globalThis[DOWNLOADS_API_NAME]=Object.freeze({version:VERSION,url:downloadsUrl,open:openDownloads,state:()=>({button:Boolean(downloadsButton),route:downloadsUrl(),storedHost:storedHostOrigin()})});
globalThis[MAP_API_NAME]=Object.freeze({version:VERSION,event:MAP_EVENT,readyEvent:MAP_READY_EVENT,open:openMap,register:registerMap,configureFinder,state:()=>({route:mapRoute,handler:Boolean(mapOpenHandler),button:Boolean(mapButton),downloadsButton:Boolean(downloadsButton),downloadsRoute:downloadsUrl(),finder:configuredFinderUrl(),finderVersion:'1.7.2',mobileContainment:'v248',brandIcon:BRAND_ICON})});
})();