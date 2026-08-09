(()=>{
'use strict';

const VERSION='1.0.67-working-campus-topbar-v243-federation-finder-local-v269';
const STYLE_ID='cw-working-campus-topbar-v243-style';
const MAP_BUTTON_ID='cw-working-campus-map-v243';
const MAP_EVENT='civweave:map-open-request';
const MAP_READY_EVENT='civweave:map-ready';
const MAP_API_NAME='CivweaveMapLaunchV243';
const FINDER_API_NAME='CivweaveFederationFinderV269';
const LOCAL_FINDER_PATH='/app/federation-finder-local-v269.html';
const BRAND_ICON='/app/logos/civweave-pwa-192-v247.png';
let header=null;
let mapButton=null;
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
function configuredFinderUrl(){
  const url=new URL(LOCAL_FINDER_PATH,location.origin);
  const params=new URLSearchParams(location.search);
  if(params.get('installed')==='1')url.searchParams.set('installed','1');
  const version=params.get('version');
  if(/^\d+\.\d+\.\d+$/.test(version||''))url.searchParams.set('version',version);
  const node=params.get('node')||params.get('finderNode');
  if(node)url.searchParams.set('node',node);
  return url.href
}
function openFederationFinder(){location.assign(configuredFinderUrl());return true}
function registerMap(detail={}){
  if(typeof detail.open==='function')mapOpenHandler=detail.open;
  const route=normalizedRoute(detail.route||detail.url||'');if(route)mapRoute=route;
  if(mapButton){mapButton.dataset.mapState='ready';mapButton.title='Open local-first Federation Finder'}
  return true
}
function openMap(){
  try{if(openFederationFinder())return true}catch(error){console.warn('[Civweave] Local Federation Finder launch failed.',error)}
  const direct=globalThis.CivweaveMapSystem||globalThis.CivweaveMapV1||globalThis.CivweaveMap;
  try{if(typeof direct?.open==='function'){direct.open({source:'working-campus',system:'civweave'});return true}}catch(error){console.warn('[Civweave] Map open handler failed.',error)}
  try{if(typeof mapOpenHandler==='function'){mapOpenHandler({source:'working-campus',system:'civweave'});return true}}catch(error){console.warn('[Civweave] Registered map open handler failed.',error)}
  if(mapRoute){location.assign(mapRoute);return true}
  const detail={source:'working-campus',system:'civweave',handled:false,route:'',open:null};
  const event=new CustomEvent(MAP_EVENT,{detail,cancelable:true});dispatchEvent(event);
  if(event.defaultPrevented||detail.handled)return true;
  if(typeof detail.open==='function'){registerMap({open:detail.open});return openMap()}
  const eventRoute=normalizedRoute(detail.route);if(eventRoute){mapRoute=eventRoute;location.assign(mapRoute);return true}
  toast('Local Federation Finder could not open and no fallback map runtime is registered.');return false
}
function syncHeaderHeight(){if(!header?.isConnected)return;const height=Math.ceil(header.getBoundingClientRect().height||0);document.documentElement.style.setProperty('--cw-working-campus-topbar-height',`${Math.max(48,height)}px`)}
function repairBrand(){const image=header?.querySelector('#brand-home img,.brand img[alt="Civweave"]');if(!image)return false;if(image.getAttribute('src')!==BRAND_ICON)image.setAttribute('src',BRAND_ICON);if(!image.dataset.cw243ValidBrand){image.dataset.cw243ValidBrand='true';image.addEventListener('error',()=>{if(image.getAttribute('src')!==BRAND_ICON)image.setAttribute('src',BRAND_ICON)})}return true}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
html[data-civweave-system-route="civweave"],html[data-civweave-system="civweave"]{max-width:100%;overflow-x:clip}
html[data-civweave-system-route="civweave"] body,html[data-civweave-system="civweave"] body{max-width:100%;overflow-x:clip}
html[data-civweave-system-route="civweave"] main.app,html[data-civweave-system="civweave"] main.app{max-width:100%;overflow-x:clip}
html[data-civweave-system-route="civweave"] main.app>header.top,html[data-civweave-system="civweave"] main.app>header.top{position:sticky!important;top:max(6px,env(safe-area-inset-top))!important;z-index:2147483646!important;pointer-events:auto!important;isolation:isolate!important;overflow:visible!important;grid-template-columns:minmax(190px,1fr) auto auto auto auto auto!important;grid-template-areas:"brand modes map settings review theme"!important;box-shadow:0 10px 28px #0008!important;max-width:1180px!important;width:100%!important;min-width:0!important}
html[data-civweave-system-route="civweave"] main.app>header.top>*,html[data-civweave-system="civweave"] main.app>header.top>*{pointer-events:auto!important;min-width:0}
#${MAP_BUTTON_ID}{grid-area:map;position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:38px;border-color:#8ee8ff66;background:linear-gradient(135deg,#8ee8ff18,#8af5d214)}
#${MAP_BUTTON_ID}[data-map-state="ready"]{border-color:#8af5d299;box-shadow:inset 0 0 14px #8af5d214}
html[data-civweave-system-route="civweave"] #cw-persistent-guide-chat-v215,html[data-civweave-system="civweave"] #cw-persistent-guide-chat-v215{top:calc(var(--cw-working-campus-topbar-height,88px) + env(safe-area-inset-top) + 14px)!important;bottom:calc(var(--cw-themed-nav-height,58px) + env(safe-area-inset-bottom) + 10px)!important;height:auto!important;max-height:none!important;z-index:2147483644!important}
html[data-civweave-system-route="civweave"] #cw-persistent-guide-chat-v215.is-minimized,html[data-civweave-system="civweave"] #cw-persistent-guide-chat-v215.is-minimized{top:auto!important;height:auto!important;max-height:min(38dvh,300px)!important}
@media(max-width:960px){html[data-civweave-system-route="civweave"] main.app>header.top,html[data-civweave-system="civweave"] main.app>header.top{grid-template-columns:minmax(0,1fr) auto auto auto!important;grid-template-areas:"brand modes map settings" "brand review theme diagnostics"!important}}
@media(max-width:700px){html[data-civweave-system-route="civweave"] main.app>header.top,html[data-civweave-system="civweave"] main.app>header.top{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;grid-template-areas:"brand brand" "modes modes" "map settings" "review theme"!important;top:max(4px,env(safe-area-inset-top))!important;gap:6px!important}html[data-civweave-diagnostics="true"][data-civweave-system-route="civweave"] main.app>header.top,html[data-civweave-diagnostics="true"][data-civweave-system="civweave"] main.app>header.top{grid-template-areas:"brand brand" "modes modes" "map settings" "review theme" "diagnostics diagnostics"!important}html[data-civweave-system-route="civweave"] main.app>header.top .mode-switch,html[data-civweave-system="civweave"] main.app>header.top .mode-switch{width:100%!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}html[data-civweave-system-route="civweave"] main.app>header.top .pill,html[data-civweave-system="civweave"] main.app>header.top .pill,html[data-civweave-system-route="civweave"] main.app>header.top [data-cw160-review],html[data-civweave-system="civweave"] main.app>header.top [data-cw160-review],html[data-civweave-system-route="civweave"] main.app>header.top [data-cw160-theme],html[data-civweave-system="civweave"] main.app>header.top [data-cw160-theme]{min-width:0!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important}#${MAP_BUTTON_ID}{min-width:0!important;width:100%!important;padding:8px 9px!important}html[data-civweave-system-route="civweave"] main.app>.campus,html[data-civweave-system="civweave"] main.app>.campus{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;overflow:visible!important;overscroll-behavior:auto!important;width:100%!important;max-width:1180px!important;padding-bottom:0!important}html[data-civweave-system-route="civweave"] main.app>.campus .realm-node,html[data-civweave-system="civweave"] main.app>.campus .realm-node{min-width:0!important;width:100%!important;max-width:100%!important;flex:none!important}html[data-civweave-system-route="civweave"] #cw-shared-guide-surface-v236,html[data-civweave-system="civweave"] #cw-shared-guide-surface-v236{width:calc(100% - 14px)!important;max-width:calc(100vw - 14px)!important;min-width:0!important}html[data-civweave-system-route="civweave"] #cw-persistent-guide-chat-v215,html[data-civweave-system="civweave"] #cw-persistent-guide-chat-v215{top:calc(var(--cw-working-campus-topbar-height,194px) + env(safe-area-inset-top) + 10px)!important}}
@media(max-width:420px){html[data-civweave-system-route="civweave"] main.app>.campus,html[data-civweave-system="civweave"] main.app>.campus{grid-template-columns:1fr!important}#${MAP_BUTTON_ID} span:last-child{font-size:11px}}
`;document.head.append(style)
}
function installMapButton(){
  header=document.querySelector('main.app>header.top');if(!header)return false;repairBrand();mapButton=document.getElementById(MAP_BUTTON_ID);
  if(!mapButton){mapButton=document.createElement('button');mapButton.id=MAP_BUTTON_ID;mapButton.type='button';mapButton.className='pill map-pill';mapButton.dataset.mapState='ready';mapButton.innerHTML='<span aria-hidden="true">⌖</span><span>Map</span>';mapButton.setAttribute('aria-label','Open local-first Federation Finder map');const settings=header.querySelector('#settings-button');if(settings)header.insertBefore(mapButton,settings);else header.append(mapButton)}
  if(!mapButton.dataset.cw243Bound){mapButton.dataset.cw243Bound='true';mapButton.addEventListener('click',openMap)}mapButton.dataset.mapState='ready';mapButton.title='Open local-first Federation Finder';syncHeaderHeight();resizeObserver?.disconnect();if('ResizeObserver'in globalThis){resizeObserver=new ResizeObserver(syncHeaderHeight);resizeObserver.observe(header)}addEventListener('resize',syncHeaderHeight,{passive:true});globalThis.visualViewport?.addEventListener('resize',syncHeaderHeight,{passive:true});document.documentElement.dataset.civweaveWorkingCampusTopbar='v243-mobile-v248-federation-finder-local-v269';return true
}
function start(){if(!isCivweave())return;installStyle();if(!installMapButton())queueMicrotask(installMapButton)}
addEventListener(MAP_READY_EVENT,event=>registerMap(event.detail||{}));if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
globalThis[FINDER_API_NAME]=Object.freeze({version:'1.7.1-local-first-v269',path:LOCAL_FINDER_PATH,url:configuredFinderUrl,open:openFederationFinder,localFirst:true});
globalThis[MAP_API_NAME]=Object.freeze({version:VERSION,event:MAP_EVENT,readyEvent:MAP_READY_EVENT,open:openMap,register:registerMap,state:()=>({route:mapRoute,handler:Boolean(mapOpenHandler),button:Boolean(mapButton),finder:configuredFinderUrl(),finderVersion:'1.7.1-local-first',mobileContainment:'v248',brandIcon:BRAND_ICON})});
})();
