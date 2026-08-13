(()=>{
'use strict';

const VERSION='1.0.118-shared-guide-surface-v236-bubble-only-v425';
const ROOT_ID='cw-shared-guide-surface-v236';
const STYLE_ID='cw-shared-guide-surface-v236-style';
const LAUNCHER_ID='cwp215-launcher';
const CHAT_ROOT_ID='cw-persistent-guide-chat-v215';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const FALLBACK_PATHS=new Map([
  ['/app/working-campus-v156.html','civweave'],
  ['/app/cabinets/living-school/index.html','living-school'],
  ['/app/realm-console-v140.html','cerbanimo'],
  ['/app/fellowfare-cabinet-v144.html','fellowfare'],
  ['/app/anarchadia-console-v139.html','anarchadia']
]);
const GUIDE=Object.freeze({
  civweave:{name:'Weaveling',label:'Civweave',role:'Central mirror and orchestrator',avatar:'/app/assets/ai/weaveling.png',accent:'#d8dde7',accent2:'#8ee8ff',placeholder:'Tell Weaveling your wish, revise the route, or ask what connects next.'},
  'living-school':{name:'Moss',label:'Living School',role:'Learning guide',avatar:'/app/assets/ai/moss.png',accent:'#59cf87',accent2:'#f3cf65',placeholder:'Ask Moss what you should learn, practice, or demonstrate.'},
  cerbanimo:{name:'Kamiya',label:'Cerbanimo',role:'Questwright and skilled-work guide',avatar:'/app/assets/ai/kamiya.png',accent:'#ff54d3',accent2:'#55edff',placeholder:'Tell Kamiya what you want to build, plan, repair, or ship.'},
  fellowfare:{name:'Rook',label:'FellowFare',role:'Quartermaster and exchange guide',avatar:'/app/assets/ai/rook.png',accent:'#f2a93b',accent2:'#55c49a',placeholder:'Tell Rook what you need, offer, or want to exchange.'},
  anarchadia:{name:'Merlin',label:'Anarchadia',role:'Civic, feature-request, and automation guide',avatar:'/app/assets/ai/merlin.png',accent:'#ff4f9a',accent2:'#e9ff39',placeholder:'Tell Merlin what should change and how success should be tested.'}
});

if(globalThis.CivweaveSharedGuideSurfaceV236?.version===VERSION)return;

const clean=(value,max=8000)=>String(value??'').trim().slice(0,max);
let currentSystem='';
let layoutObserver=null;
let observedNav=null;
let surfaceObserver=null;
let repairQueued=false;
let mounted=false;

function detectSystem(){
  const route=globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname);
  if(SYSTEMS.includes(route))return route;
  const declared=clean(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||document.body?.dataset?.civweaveSystem||document.body?.dataset?.system,80).toLowerCase();
  if(SYSTEMS.includes(declared))return declared;
  const query=new URLSearchParams(location.search).get('system');
  if(SYSTEMS.includes(query))return query;
  if(document.documentElement.hasAttribute('data-living-school-cabinet'))return'living-school';
  return FALLBACK_PATHS.get(location.pathname)||'';
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
:root{--cw-themed-nav-height:clamp(52px,7vw,72px)!important;--cw-themed-nav-button-width:156px!important;--cw-floating-gap:12px;--cw-guide-launcher-size:60px}
#cw-themed-system-nav{z-index:2147483600!important}
#cw-radio-suggestion-v233{z-index:2147483610!important;left:max(12px,env(safe-area-inset-left))!important;right:auto!important;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + var(--cw-floating-gap))!important;max-width:min(360px,calc(100vw - 92px))!important}
#${LAUNCHER_ID}{z-index:2147483611!important;right:max(12px,env(safe-area-inset-right))!important;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + var(--cw-floating-gap))!important;width:var(--cw-guide-launcher-size)!important;height:var(--cw-guide-launcher-size)!important}
#${CHAT_ROOT_ID}{z-index:2147483612!important;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + var(--cw-floating-gap))!important}
html.cw-themed-system-nav-active body{padding-bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom))!important}
#cw-themed-system-nav .cw-themed-system-link{height:var(--cw-themed-nav-height)!important;max-width:var(--cw-themed-nav-button-width)!important}
#cw-themed-system-nav .cw-themed-system-link img{max-height:var(--cw-themed-nav-height)!important;object-fit:contain!important}
@media(max-width:680px){:root{--cw-themed-nav-height:clamp(50px,14vw,66px)!important;--cw-themed-nav-button-width:132px!important;--cw-guide-launcher-size:56px}#cw-radio-suggestion-v233{max-width:calc(100vw - 86px)!important}}
@media(prefers-reduced-motion:reduce){#cw-radio-suggestion-v233,#${LAUNCHER_ID}{scroll-behavior:auto!important;transition:none!important;animation-duration:.001ms!important}}
`;
  document.head?.append(style);
}

function removeEmbeddedGuideCards(){
  document.getElementById(ROOT_ID)?.remove();
  if(currentSystem==='fellowfare')document.querySelectorAll('.ffc144-rook').forEach(node=>node.remove());
  document.documentElement.dataset.civweaveGuideSurfaceMode='bubble-only';
  return true;
}

function buildInline(){removeEmbeddedGuideCards();return false}
function renderTranscript(){return false}
function setInlineInteractive(){return false}
function syncInlineVisibility(){removeEmbeddedGuideCards();return false}

function ownPageGuide(){
  const api=globalThis.CivweavePersistentGuideChatV215;
  if(!api||!currentSystem)return false;
  try{api.switchGuide?.(currentSystem);return true}catch{return false}
}

async function submitInline(text){
  const value=clean(text,8000);
  const api=globalThis.CivweavePersistentGuideChatV215;
  if(!value||typeof api?.submitText!=='function')return false;
  api.switchGuide?.(currentSystem,{open:false});
  return (await api.submitText(value,currentSystem))!==false;
}

function normalizeFloatingLayout(){
  const themed=document.getElementById('cw-themed-system-nav');
  if(themed){
    const height=Math.min(72,Math.max(50,Math.round(themed.getBoundingClientRect().height||0)));
    if(height)document.documentElement.style.setProperty('--cw-themed-nav-height',`${height}px`);
  }
  document.documentElement.dataset.civweaveFloatingContract='v236';
}

function observeNav(){
  if(!('ResizeObserver'in globalThis))return false;
  if(!layoutObserver)layoutObserver=new ResizeObserver(normalizeFloatingLayout);
  const nav=document.getElementById('cw-themed-system-nav');
  if(!nav)return false;
  if(observedNav!==nav){
    if(observedNav)try{layoutObserver.unobserve(observedNav)}catch{}
    observedNav=nav;
    layoutObserver.observe(nav);
  }
  return true;
}

function ensureFloatingRuntime(){
  ownPageGuide();
  observeNav();
  removeEmbeddedGuideCards();
  normalizeFloatingLayout();
}

function repairSurface(){
  repairQueued=false;
  if(!currentSystem||!document.documentElement?.isConnected)return false;
  removeEmbeddedGuideCards();
  observeNav();
  normalizeFloatingLayout();
  return true;
}

function scheduleRepair(){
  if(repairQueued)return;
  repairQueued=true;
  queueMicrotask(repairSurface);
}

function watchSurface(){
  if(surfaceObserver||!document.body)return false;
  surfaceObserver=new MutationObserver(records=>{
    if(records.some(record=>record.addedNodes.length))scheduleRepair();
  });
  surfaceObserver.observe(document.body,{childList:true,subtree:true});
  return true;
}

function mount(){
  if(mounted)return;
  mounted=true;
  currentSystem=detectSystem();
  if(!currentSystem)return;
  installStyle();
  removeEmbeddedGuideCards();
  ensureFloatingRuntime();
  watchSurface();
  addEventListener('civweave:persistent-guide-chat-ready',()=>{ownPageGuide();removeEmbeddedGuideCards();observeNav();normalizeFloatingLayout()});
  addEventListener('resize',normalizeFloatingLayout,{passive:true});
  document.documentElement.dataset.civweaveGuideSurface=VERSION;
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();

globalThis.CivweaveSharedGuideSurfaceV236=Object.freeze({
  version:VERSION,
  mode:'bubble-only',
  detectSystem,
  guideFor:system=>GUIDE[system]||null,
  renderTranscript,
  normalizeFloatingLayout,
  ownPageGuide,
  submitInline,
  syncInlineVisibility,
  setInlineInteractive,
  buildInline,
  repairSurface,
  removeEmbeddedGuideCards,
  mount
});
})();
