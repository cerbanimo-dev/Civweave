(()=>{
'use strict';

const VERSION='1.0.35-shared-guide-surface-v236-single-surface-v244';
const ROOT_ID='cw-shared-guide-surface-v236';
const STYLE_ID='cw-shared-guide-surface-v236-style';
const CHAT_ROOT_ID='cw-persistent-guide-chat-v215';
const LAUNCHER_ID='cwp215-launcher';
const STORAGE_KEY='civweave.persistent-guide-chat.v214';
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
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
let currentSystem='';
let transcriptObserver=null;
let transcriptTarget=null;
let layoutObserver=null;
let observedNav=null;
let surfaceObserver=null;
let repairQueued=false;
let mounted=false;
let revealTimer=0;
let fullChatWasOpen=false;

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
#${ROOT_ID}{--cw-guide-accent:#d8dde7;--cw-guide-accent2:#8ee8ff;position:relative;z-index:2;display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;width:min(1180px,calc(100% - 24px));margin:12px auto;padding:14px;border:1px solid color-mix(in srgb,var(--cw-guide-accent) 52%,transparent);border-radius:18px;background:color-mix(in srgb,#071321 94%,var(--cw-guide-accent) 6%);box-shadow:0 12px 34px #0004;color:#f7fbff;font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;isolation:isolate}
#${ROOT_ID}[data-system="living-school"]{background:linear-gradient(145deg,#0d2f26,#173d31);color:#fff8df}
#${ROOT_ID}[data-system="cerbanimo"]{background:linear-gradient(145deg,#14081f,#231035);color:#fff7ff}
#${ROOT_ID}[data-system="fellowfare"]{background:linear-gradient(145deg,#3a241b,#543224);color:#fff8e7}
#${ROOT_ID}[data-system="anarchadia"]{background:linear-gradient(145deg,#07090d,#141014);color:#fff;border-radius:4px}
#${ROOT_ID} *{box-sizing:border-box}
#${ROOT_ID} .cwsg236-avatar{width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--cw-guide-accent);box-shadow:0 0 20px color-mix(in srgb,var(--cw-guide-accent) 42%,transparent)}
#${ROOT_ID} .cwsg236-main{min-width:0;display:grid;gap:9px}
#${ROOT_ID} .cwsg236-head{display:flex;align-items:flex-start;gap:10px;justify-content:space-between}
#${ROOT_ID} .cwsg236-head small{display:block;color:var(--cw-guide-accent);font-size:.68rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
#${ROOT_ID} .cwsg236-head strong{display:block;font-size:1.24rem;line-height:1.1}
#${ROOT_ID} .cwsg236-head span{display:block;color:#b9c9d6;font-size:.78rem;margin-top:2px}
#${ROOT_ID} .cwsg236-full{min-height:36px;border:1px solid color-mix(in srgb,var(--cw-guide-accent) 62%,transparent);border-radius:10px;padding:6px 10px;background:transparent;color:inherit;font-weight:800;cursor:pointer;white-space:nowrap}
#${ROOT_ID} .cwsg236-log{display:grid;gap:6px;max-height:168px;overflow:auto;overscroll-behavior:contain;padding:8px;border:1px solid #ffffff18;border-radius:12px;background:#0003}
#${ROOT_ID} .cwsg236-empty{color:#b9c9d6;padding:6px}
#${ROOT_ID} .cwsg236-line{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px;align-items:start}
#${ROOT_ID} .cwsg236-line b{color:var(--cw-guide-accent);font-size:.72rem;min-width:48px}
#${ROOT_ID} .cwsg236-line[data-role="user"] b{color:var(--cw-guide-accent2)}
#${ROOT_ID} .cwsg236-line p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:inherit}
#${ROOT_ID} .cwsg236-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
#${ROOT_ID} .cwsg236-form textarea{width:100%;min-height:52px;max-height:140px;resize:vertical;border:1px solid color-mix(in srgb,var(--cw-guide-accent) 48%,transparent);border-radius:11px;padding:10px 11px;background:#020812aa;color:inherit;font:inherit;outline:none}
#${ROOT_ID} .cwsg236-form textarea:focus{border-color:var(--cw-guide-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--cw-guide-accent) 18%,transparent)}
#${ROOT_ID} .cwsg236-send{min-width:78px;border:1px solid var(--cw-guide-accent);border-radius:11px;padding:0 14px;background:color-mix(in srgb,var(--cw-guide-accent) 20%,#071321);color:inherit;font-weight:900;cursor:pointer}
#${ROOT_ID} .cwsg236-send:disabled{opacity:.55;cursor:wait}
#${ROOT_ID} .cwsg236-note{color:#aebdca;font-size:.72rem}
@media(max-width:680px){:root{--cw-themed-nav-height:clamp(50px,14vw,66px)!important;--cw-themed-nav-button-width:132px!important;--cw-guide-launcher-size:56px}#cw-radio-suggestion-v233{max-width:calc(100vw - 86px)!important}#${ROOT_ID}{grid-template-columns:48px minmax(0,1fr);width:calc(100% - 16px);margin:8px auto;padding:10px;gap:9px;border-radius:14px}#${ROOT_ID} .cwsg236-avatar{width:48px;height:48px}#${ROOT_ID} .cwsg236-form{grid-template-columns:1fr}#${ROOT_ID} .cwsg236-send{min-height:42px}#${ROOT_ID} .cwsg236-head{gap:6px;flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){#${ROOT_ID} *,#cw-radio-suggestion-v233,#${LAUNCHER_ID}{scroll-behavior:auto!important;transition:none!important;animation-duration:.001ms!important}}
`;
  document.head.append(style);
}

function canonicalNativeChat(system){
  if(system==='fellowfare')return document.querySelector('.ffc144-rook');
  return null;
}

function mountTarget(){
  return document.querySelector('#weaveling-hub-v233')?.parentElement||
    document.querySelector('#ffc144-app')||
    document.querySelector('#rc-app')||
    document.querySelector('main')||
    document.querySelector('.app')||document.body;
}

function readThread(){
  const api=globalThis.CivweavePersistentGuideChatV215;
  if(api?.readState)return api.readState();
  try{return parse(localStorage.getItem(STORAGE_KEY),{})}catch{return{}}
}

function setInlineInteractive(visible){
  const root=document.getElementById(ROOT_ID);if(!root)return false;
  root.hidden=!visible;root.style.pointerEvents=visible?'':'none';root.style.display=visible?'':'none';
  try{root.inert=!visible}catch{}
  root.dataset.fullChatOpen=visible?'false':'true';
  return true
}
function syncInlineVisibility(stateOverride=null){
  const root=document.getElementById(ROOT_ID);if(!root)return false;
  const api=globalThis.CivweavePersistentGuideChatV215,state=stateOverride||api?.readState?.()||{},fullOpen=Boolean(state.open);
  if(revealTimer){clearTimeout(revealTimer);revealTimer=0}
  if(fullOpen){fullChatWasOpen=true;setInlineInteractive(false);return true}
  if(fullChatWasOpen){fullChatWasOpen=false;setInlineInteractive(false);revealTimer=setTimeout(()=>{revealTimer=0;const live=globalThis.CivweavePersistentGuideChatV215?.readState?.()||{};if(!live.open)setInlineInteractive(true)},500);return true}
  setInlineInteractive(true);return true
}

function relevantMessages(system){
  const rows=Array.isArray(readThread()?.messages)?readThread().messages:[];
  const result=[];
  for(let index=rows.length-1;index>=0&&result.length<6;index-=1){
    const row=rows[index]||{};
    if(row.role==='user'||row.guide===system)result.push(row);
  }
  return result.reverse();
}

function renderTranscript(){
  const root=document.getElementById(ROOT_ID);
  if(!root||root.dataset.system!==currentSystem)return;
  const log=root.querySelector('[data-cwsg-log]');
  if(!log)return;
  const guide=GUIDE[currentSystem];
  const rows=relevantMessages(currentSystem);
  if(!rows.length){
    log.innerHTML=`<div class="cwsg236-empty">The shared thread is quiet here. Start with ${esc(guide.name)} or open the full chat.</div>`;
    return;
  }
  log.innerHTML=rows.map(row=>{
    const isUser=row.role==='user';
    return `<article class="cwsg236-line" data-role="${isUser?'user':'assistant'}"><b>${isUser?'You':esc(guide.name)}</b><p>${esc(clean(row.text,5000))}</p></article>`;
  }).join('');
  log.scrollTop=log.scrollHeight;
}

function ownPageGuide(){
  const api=globalThis.CivweavePersistentGuideChatV215;
  if(!api||!currentSystem)return false;
  try{api.switchGuide?.(currentSystem);return true}catch{return false}
}

function observeThread(){
  const log=document.querySelector(`#${CHAT_ROOT_ID} [data-log]`);
  if(!log)return false;
  if(transcriptObserver&&transcriptTarget===log)return true;
  transcriptObserver?.disconnect();
  transcriptTarget=log;
  transcriptObserver=new MutationObserver(()=>{renderTranscript();syncInlineVisibility()});
  transcriptObserver.observe(log,{childList:true,subtree:true,characterData:true});
  return true;
}

async function submitInline(text){
  const value=clean(text,8000);
  const api=globalThis.CivweavePersistentGuideChatV215;
  if(!value||typeof api?.submitText!=='function')return false;
  api.switchGuide?.(currentSystem,{open:false});
  const sent=await api.submitText(value,currentSystem);
  renderTranscript();
  return sent!==false;
}

function buildInline(){
  if(!currentSystem||document.getElementById(ROOT_ID)||canonicalNativeChat(currentSystem))return false;
  const guide=GUIDE[currentSystem];
  const section=document.createElement('section');
  section.id=ROOT_ID;
  section.dataset.system=currentSystem;
  section.style.setProperty('--cw-guide-accent',guide.accent);
  section.style.setProperty('--cw-guide-accent2',guide.accent2);
  section.setAttribute('aria-label',`Chat with ${guide.name}`);
  section.innerHTML=`
    <img class="cwsg236-avatar" src="${guide.avatar}" alt="${guide.name}">
    <div class="cwsg236-main">
      <header class="cwsg236-head"><div><small>${guide.label} guide</small><strong>Chat with ${guide.name}</strong><span>${guide.role}</span></div><button class="cwsg236-full" type="button" data-cwsg-full>Open full chat</button></header>
      <div class="cwsg236-log" data-cwsg-log role="log" aria-live="polite"></div>
      <form class="cwsg236-form" data-cwsg-form><textarea rows="2" maxlength="8000" required placeholder="${guide.placeholder}"></textarea><button class="cwsg236-send" type="submit">Send</button></form>
      <div class="cwsg236-note">One shared thread. The inline composer hides whenever the full chat is open, so only one chat surface can receive taps at a time.</div>
    </div>`;
  const target=mountTarget();
  if(!target)return false;
  target.prepend(section);
  section.querySelector('[data-cwsg-full]').addEventListener('click',()=>{
    const api=globalThis.CivweavePersistentGuideChatV215;
    setInlineInteractive(false);
    api?.switchGuide?.(currentSystem);
    api?.open?.({guide:currentSystem});
  });
  section.querySelector('[data-cwsg-form]').addEventListener('submit',async event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    const form=event.currentTarget,input=form.querySelector('textarea'),button=form.querySelector('button[type="submit"]'),value=clean(input?.value,8000);
    if(!value)return;
    button.disabled=true;
    try{const sent=await submitInline(value);if(sent)input.value=''}finally{button.disabled=false}
  });
  renderTranscript();
  syncInlineVisibility();
  return true;
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
  observeThread();
  observeNav();
  renderTranscript();
  syncInlineVisibility();
  normalizeFloatingLayout();
}

function repairSurface(){
  repairQueued=false;
  if(!currentSystem||!document.documentElement?.isConnected)return false;
  if(!document.getElementById(ROOT_ID)&&!canonicalNativeChat(currentSystem))buildInline();
  observeThread();
  observeNav();
  syncInlineVisibility();
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
    if(records.some(record=>record.addedNodes.length||record.removedNodes.length))scheduleRepair();
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
  buildInline();
  ensureFloatingRuntime();
  watchSurface();
  addEventListener('civweave:persistent-guide-chat-ready',()=>{ownPageGuide();buildInline();observeThread();observeNav();renderTranscript();syncInlineVisibility()});
  addEventListener('civweave:guide-workspace-state',event=>syncInlineVisibility(event.detail||null));
  addEventListener('resize',normalizeFloatingLayout,{passive:true});
  document.documentElement.dataset.civweaveGuideSurface=VERSION;
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();

globalThis.CivweaveSharedGuideSurfaceV236=Object.freeze({
  version:VERSION,
  detectSystem,
  guideFor:system=>GUIDE[system]||null,
  renderTranscript,
  normalizeFloatingLayout,
  ownPageGuide,
  submitInline,
  syncInlineVisibility,
  repairSurface,
  mount
});
})();