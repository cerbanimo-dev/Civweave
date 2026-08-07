(()=>{
'use strict';

const VERSION='1.0.36-working-campus-topbar-v243';
const STYLE_ID='cw-working-campus-topbar-v243-style';
const MAP_BUTTON_ID='cw-working-campus-map-v243';
const MAP_EVENT='civweave:map-open-request';
const MAP_READY_EVENT='civweave:map-ready';
const MAP_API_NAME='CivweaveMapLaunchV243';
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
function registerMap(detail={}){
  if(typeof detail.open==='function')mapOpenHandler=detail.open;
  const route=normalizedRoute(detail.route||detail.url||'');if(route)mapRoute=route;
  if(mapButton){mapButton.dataset.mapState=(mapOpenHandler||mapRoute)?'ready':'waiting';mapButton.title=(mapOpenHandler||mapRoute)?'Open Civweave map':'Map system is wired and waiting for its runtime'}
  return Boolean(mapOpenHandler||mapRoute)
}
function openMap(){
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
  toast('Map button is ready. The incoming map runtime has not registered itself yet.');
  return false
}
function syncHeaderHeight(){
  if(!header?.isConnected)return;
  const height=Math.ceil(header.getBoundingClientRect().height||0);
  document.documentElement.style.setProperty('--cw-working-campus-topbar-height',`${Math.max(48,height)}px`)
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
html[data-civweave-system-route="civweave"] main.app>header.top,html[data-civweave-system="civweave"] main.app>header.top{position:sticky!important;top:max(6px,env(safe-area-inset-top))!important;z-index:2147483646!important;pointer-events:auto!important;isolation:isolate!important;overflow:visible!important;grid-template-columns:minmax(190px,1fr) auto auto auto auto auto!important;grid-template-areas:"brand modes map settings review theme"!important;box-shadow:0 10px 28px #0008!important}
html[data-civweave-system-route="civweave"] main.app>header.top>*,html[data-civweave-system="civweave"] main.app>header.top>*{pointer-events:auto!important}
#${MAP_BUTTON_ID}{grid-area:map;position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:38px;border-color:#8ee8ff66;background:linear-gradient(135deg,#8ee8ff18,#8af5d214)}
#${MAP_BUTTON_ID}[data-map-state="ready"]{border-color:#8af5d299;box-shadow:inset 0 0 14px #8af5d214}
html[data-civweave-system-route="civweave"] #cw-persistent-guide-chat-v215,html[data-civweave-system="civweave"] #cw-persistent-guide-chat-v215{top:calc(var(--cw-working-campus-topbar-height,88px) + env(safe-area-inset-top) + 14px)!important;bottom:calc(var(--cw-themed-nav-height,58px) + env(safe-area-inset-bottom) + 10px)!important;height:auto!important;max-height:none!important;z-index:2147483644!important}
html[data-civweave-system-route="civweave"] #cw-persistent-guide-chat-v215.is-minimized,html[data-civweave-system="civweave"] #cw-persistent-guide-chat-v215.is-minimized{top:auto!important;height:auto!important;max-height:min(38dvh,300px)!important}
@media(max-width:960px){html[data-civweave-system-route="civweave"] main.app>header.top,html[data-civweave-system="civweave"] main.app>header.top{grid-template-columns:minmax(180px,1fr) auto auto auto!important;grid-template-areas:"brand modes map settings" "brand review theme diagnostics"!important}}
@media(max-width:700px){html[data-civweave-system-route="civweave"] main.app>header.top,html[data-civweave-system="civweave"] main.app>header.top{grid-template-columns:minmax(0,1fr) auto auto!important;grid-template-areas:"brand brand brand" "modes map settings" "review theme diagnostics"!important;top:max(4px,env(safe-area-inset-top))!important}#${MAP_BUTTON_ID}{min-width:62px;padding:7px 9px!important}html[data-civweave-system-route="civweave"] #cw-persistent-guide-chat-v215,html[data-civweave-system="civweave"] #cw-persistent-guide-chat-v215{top:calc(var(--cw-working-campus-topbar-height,154px) + env(safe-area-inset-top) + 10px)!important}}
@media(max-width:420px){#${MAP_BUTTON_ID} span:last-child{font-size:11px}}
`;
  document.head.append(style)
}
function installMapButton(){
  header=document.querySelector('main.app>header.top');if(!header)return false;
  mapButton=document.getElementById(MAP_BUTTON_ID);
  if(!mapButton){mapButton=document.createElement('button');mapButton.id=MAP_BUTTON_ID;mapButton.type='button';mapButton.className='pill map-pill';mapButton.dataset.mapState=(mapOpenHandler||mapRoute)?'ready':'waiting';mapButton.innerHTML='<span aria-hidden="true">⌖</span><span>Map</span>';mapButton.setAttribute('aria-label','Open Civweave map');const settings=header.querySelector('#settings-button');if(settings)header.insertBefore(mapButton,settings);else header.append(mapButton)}
  mapButton.addEventListener('click',openMap);
  syncHeaderHeight();
  resizeObserver?.disconnect();
  if('ResizeObserver'in globalThis){resizeObserver=new ResizeObserver(syncHeaderHeight);resizeObserver.observe(header)}
  addEventListener('resize',syncHeaderHeight,{passive:true});
  globalThis.visualViewport?.addEventListener('resize',syncHeaderHeight,{passive:true});
  document.documentElement.dataset.civweaveWorkingCampusTopbar='v243';
  return true
}
function start(){if(!isCivweave())return;installStyle();if(!installMapButton())queueMicrotask(installMapButton)}
addEventListener(MAP_READY_EVENT,event=>registerMap(event.detail||{}));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

globalThis[MAP_API_NAME]=Object.freeze({version:VERSION,event:MAP_EVENT,readyEvent:MAP_READY_EVENT,open:openMap,register:registerMap,state:()=>({route:mapRoute,handler:Boolean(mapOpenHandler),button:Boolean(mapButton)})});
})();
