(()=>{
'use strict';

const VERSION='1.0.129-shared-guide-surface-v236-persistent-system-context';
const STYLE_ID='cw-shared-guide-surface-v236-style';
const LAUNCHER_ID='cwp215-launcher';
const CHAT_ROOT_ID='cw-persistent-guide-chat-v215';
const CONTEXT_SRC='/app/persistent-system-context-v1.js?v=1.0.1';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const FALLBACK_PATHS=new Map([
  ['/app/working-campus-v156.html','civweave'],
  ['/app/cabinets/living-school/index.html','living-school'],
  ['/app/realm-console-v140.html','cerbanimo'],
  ['/app/fellowfare-cabinet-v144.html','fellowfare'],
  ['/app/anarchadia-console-v139.html','anarchadia']
]);
const GUIDE=Object.freeze({
  civweave:{name:'Weaveling',label:'Civweave',role:'Quest guide and central orchestrator',avatar:'/app/assets/ai/chat/weaveling-face-v255.webp',accent:'#d8dde7',accent2:'#8ee8ff',placeholder:'Tell Weaveling what Quest you want to pursue, revise the route, or ask what connects next.'},
  'living-school':{name:'Moss',label:'Living School',role:'Learning Journey guide',avatar:'/app/assets/ai/chat/moss-face-v255.webp',accent:'#59cf87',accent2:'#f3cf65',placeholder:'Ask Moss to build or revise a Learning Journey, or what you should learn, practice, or demonstrate.'},
  cerbanimo:{name:'Kamiya',label:'Cerbanimo',role:'Endeavor guide',avatar:'/app/assets/ai/chat/kamiya-face-v255.webp',accent:'#ff54d3',accent2:'#55edff',placeholder:'Tell Kamiya what Endeavor you want to build, plan, repair, or ship.'},
  fellowfare:{name:'Rook',label:'FellowFare',role:'Manifest guide and Quartermaster',avatar:'/app/assets/ai/chat/rook-face-v255.webp',accent:'#f2a93b',accent2:'#55c49a',placeholder:'Tell Rook what Manifest of needs, skills, resources, or offers you want to assemble.'},
  anarchadia:{name:'Merlin',label:'Anarchadia',role:'Civic, feature-request, and automation guide',avatar:'/app/assets/ai/chat/merlin-face-v255.webp',accent:'#ff4f9a',accent2:'#e9ff39',placeholder:'Tell Merlin what should change and how success should be tested.'}
});

if(globalThis.CivweaveSharedGuideSurfaceV236?.version===VERSION)return;
const clean=(value,max=8000)=>String(value??'').trim().slice(0,max);
let currentSystem='';
let layoutObserver=null;
let observedNav=null;
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
function ensureSystemContext(){
  if(globalThis.CivweavePersistentSystemContextV1?.owner)return true;
  const path=new URL(CONTEXT_SRC,location.href).pathname;
  if([...document.scripts].some(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}}))return false;
  const script=document.createElement('script');script.src=CONTEXT_SRC;script.async=false;script.dataset.civweaveSystemContext='v1';script.onload=()=>{try{globalThis.CivweavePersistentSystemContextV1?.applyPending?.('shared-guide-context-load')}catch{}};document.head?.append(script);return false;
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
:root{--cw-guide-nav-offset:96px;--cw-floating-gap:12px;--cw-guide-launcher-size:60px}
#cw-themed-system-nav{z-index:2147483600!important}
#cw-radio-suggestion-v233{z-index:2147483610!important;left:max(12px,env(safe-area-inset-left))!important;right:auto!important;bottom:calc(var(--cw-guide-nav-offset,96px) + var(--cw-floating-gap))!important;max-width:min(360px,calc(100vw - 92px))!important}
#${LAUNCHER_ID}{z-index:2147483611!important;right:max(12px,env(safe-area-inset-right))!important;bottom:calc(var(--cw-guide-nav-offset,96px) + var(--cw-floating-gap))!important;width:var(--cw-guide-launcher-size)!important;height:var(--cw-guide-launcher-size)!important}
#${CHAT_ROOT_ID}{z-index:2147483612!important;bottom:calc(var(--cw-guide-nav-offset,96px) + var(--cw-floating-gap))!important}
@media(max-width:680px){:root{--cw-guide-launcher-size:56px}#cw-radio-suggestion-v233{max-width:calc(100vw - 86px)!important}}
@media(prefers-reduced-motion:reduce){#cw-radio-suggestion-v233,#${LAUNCHER_ID}{scroll-behavior:auto!important;transition:none!important;animation-duration:.001ms!important}}
`;
  document.head?.append(style);
}
function buildInline(){return false}
function renderTranscript(){return false}
function setInlineInteractive(){return false}
function syncInlineVisibility(){return false}
function removeEmbeddedGuideCards(){return false}
function canonicalSurface(){
  const api=globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215;
  return api?.canonicalOwner?api:null;
}
function ownPageGuide(){
  // Compatibility name only. The physical page no longer owns the active guide.
  // The persistent system-context layer keeps the selected guide sticky until the user changes it.
  return Boolean(canonicalSurface());
}
async function submitInline(text){
  const value=clean(text,8000),api=canonicalSurface();
  if(!value||typeof api?.submitText!=='function')return false;
  const active=globalThis.CivweavePersistentSystemContextV1?.selected?.()||api.state?.().activeSystem||currentSystem;
  if(SYSTEMS.includes(active))api.switchGuide?.(active,{open:false});
  return (await api.submitText(value,active))!==false;
}
function normalizeFloatingLayout(){
  const themed=document.getElementById('cw-themed-system-nav');
  if(themed){const height=Math.max(0,Math.round(themed.getBoundingClientRect().height||0));if(height)document.documentElement.style.setProperty('--cw-guide-nav-offset',`${height}px`)}
  document.documentElement.dataset.civweaveFloatingContract='v236-nav-nonowning-v1';
}
function observeNav(){
  if(!('ResizeObserver'in globalThis))return false;
  if(!layoutObserver)layoutObserver=new ResizeObserver(normalizeFloatingLayout);
  const nav=document.getElementById('cw-themed-system-nav');if(!nav)return false;
  if(observedNav!==nav){if(observedNav)try{layoutObserver.unobserve(observedNav)}catch{};observedNav=nav;layoutObserver.observe(nav)}
  return true;
}
function repairSurface(){
  currentSystem=detectSystem()||currentSystem;
  const api=canonicalSurface();
  try{api?.ensureLauncher?.()}catch{}
  ensureSystemContext();
  try{globalThis.CivweavePersistentSystemContextV1?.applyPending?.('shared-guide-repair')}catch{}
  observeNav();normalizeFloatingLayout();
  return Boolean(api);
}
function mount(){
  if(mounted)return;
  mounted=true;
  currentSystem=detectSystem();if(!currentSystem)return;
  installStyle();ensureSystemContext();repairSurface();
  addEventListener('civweave:persistent-guide-chat-ready',repairSurface);
  addEventListener('civweave:guide-chat-ready',repairSurface);
  addEventListener('civweave:system-context-changed',()=>{observeNav();normalizeFloatingLayout()});
  addEventListener('pageshow',repairSurface);
  addEventListener('resize',normalizeFloatingLayout,{passive:true});
  document.documentElement.dataset.civweaveGuideSurface=VERSION;
  document.documentElement.dataset.civweaveGuideSurfaceMode='bubble-only';
  document.documentElement.dataset.civweaveGuideLauncherOwner='guide-chat-surface-v350';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();

globalThis.CivweaveSharedGuideSurfaceV236=Object.freeze({version:VERSION,mode:'bubble-only',sourceTruth:true,launcherOwner:'guide-chat-surface-v350',navigationGeometryOwner:false,navigationOffsetVariable:'--cw-guide-nav-offset',pageGuideOwnership:false,persistentSystemContext:true,detectSystem,guideFor:system=>GUIDE[system]||null,renderTranscript,normalizeFloatingLayout,ownPageGuide,submitInline,syncInlineVisibility,setInlineInteractive,buildInline,repairSurface,removeEmbeddedGuideCards,mount});
})();