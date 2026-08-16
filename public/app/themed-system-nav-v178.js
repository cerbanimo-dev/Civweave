(()=>{
'use strict';

const VERSION='1.0.162-five-system-navigation-v227';
const NAV_ID='cw-themed-system-nav';
const STYLE_ID='cw-themed-system-nav-style';
const PATH=location.pathname;
const QUERY=new URLSearchParams(location.search);
const EMBEDDED=window.self!==window.top||(QUERY.get('civweave')==='1'&&QUERY.get('cabinet')==='1');
const ROUTES=globalThis.CivweaveSystemRoutesV227;
const STATE_MAPPER='/app/subsystem-avatar-state-v347.js?v=1.0.0';
const SHEETS=Object.freeze({
  civweave:'/Civweave-weaveling-sprites.png',
  'living-school':'/Living-School-moss-sprites.png',
  cerbanimo:'/Cerbanimo-kamiya-sprites.png',
  fellowfare:'/FellowFare-rook-sprites.png',
  anarchadia:'/Anarchadia-merlin-sprites.png'
});
const FALLBACK=Object.freeze({
  civweave:'/app/assets/ai/chat/weaveling-face-v255.webp',
  'living-school':'/app/assets/ai/chat/moss-face-v255.webp',
  cerbanimo:'/app/assets/ai/chat/kamiya-face-v255.webp',
  fellowfare:'/app/assets/ai/chat/rook-face-v255.webp',
  anarchadia:'/app/assets/ai/chat/merlin-face-v255.webp'
});
const EX=Object.freeze({
  civweave:Object.freeze(['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','magical','hopeful']),
  'living-school':Object.freeze(['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','encouraging']),
  cerbanimo:Object.freeze(['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','helpful']),
  fellowfare:Object.freeze(['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','approving']),
  anarchadia:Object.freeze(['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','magical'])
});
const SYSTEMS=[
  {id:'civweave',label:'Civweave',monogram:'Cw',character:'Weaveling',fallback:'/app/working-campus-v156.html?installed=1',glow:'#f5e7ff',shade:'#dad7ff',labelColor:'#7b5a15',shell:'#fff6ff',ring:'#f6dea1',panel:'linear-gradient(135deg,#fbf8ff 0%,#eaf4ff 32%,#fff1dc 64%,#f4edff 100%)'},
  {id:'living-school',label:'Living School',monogram:'LS',character:'Moss',fallback:'/app/cabinets/living-school/index.html?cabinet=1&installed=1',glow:'#9acb70',shade:'#28412f',labelColor:'#f7e39e',shell:'#d6efcb',ring:'#ebc16b',panel:'linear-gradient(135deg,#274430,#365236)'},
  {id:'cerbanimo',label:'Cerbanimo',monogram:'Co',character:'Kamiya',fallback:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1&installed=1',glow:'#bb79ff',shade:'#4f265f',labelColor:'#ffd676',shell:'#e4d6ff',ring:'#ebbf67',panel:'linear-gradient(135deg,#4e245d,#6a2c72)'},
  {id:'fellowfare',label:'FellowFare',monogram:'FF',character:'Rook',fallback:'/app/fellowfare-cabinet-v144.html?cabinet=1&installed=1',glow:'#f5b446',shade:'#5a3618',labelColor:'#fff0bd',shell:'#f6e0a7',ring:'#d89f3d',panel:'linear-gradient(135deg,#6d4017,#8b5621)'},
  {id:'anarchadia',label:'Anarchadia',monogram:'Ai',character:'Merlin',fallback:'/app/anarchadia-console-v139.html?cabinet=1&installed=1',glow:'#ff3d96',shade:'#621f43',labelColor:'#ffe192',shell:'#f6d0df',ring:'#e1a85a',panel:'linear-gradient(135deg,#642042,#8c2455)'}
];

const explicitState=new Map();
let statePromise=null;

function href(item){
  return ROUTES?.urlFor?.(item.id,{version:'1.0.162',source:currentSystem()||'navigation'}).href||item.fallback;
}
function clearEmbedded(){
  document.getElementById(NAV_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  document.documentElement.classList.remove('cw-themed-system-nav-active');
  delete document.documentElement.dataset.cwThemedCurrent;
  document.body?.style.removeProperty('padding-bottom');
}
if(EMBEDDED){
  document.readyState==='loading'
    ?document.addEventListener('DOMContentLoaded',clearEmbedded,{once:true})
    :clearEmbedded();
  return;
}
function currentSystem(){
  const found=ROUTES?.identify?.(PATH);
  if(found)return found;
  const explicit=QUERY.get('system');
  if(SYSTEMS.some(x=>x.id===explicit))return explicit;
  if(document.documentElement.hasAttribute('data-living-school-cabinet')||PATH.includes('/cabinets/living-school/'))return'living-school';
  if(PATH.includes('fellowfare'))return'fellowfare';
  if(PATH.includes('anarchadia'))return'anarchadia';
  if(PATH.includes('realm-console-v140.html'))return explicit==='civweave'?'civweave':'cerbanimo';
  if(PATH.includes('working-campus-v156.html'))return'civweave';
  return'';
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
:root{--cw-themed-nav-height:clamp(56px,7vw,72px);--cw-themed-nav-button-width:156px;--cw-themed-nav-bottom-gap:6px}
html{scroll-padding-bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + 20px)}
html.cw-themed-system-nav-active body{padding-bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + 18px)!important}
html.cw-themed-system-nav-active nav.bottom,
html.cw-themed-system-nav-active .rc-bottom,
html.cw-themed-system-nav-active .ls-tray,
html.cw-themed-system-nav-active .bottom-nav{display:none!important}
html.cw-themed-system-nav-active[data-cw-themed-current="living-school"] .ls-app{grid-template-rows:54px minmax(0,1fr)!important}
html.cw-themed-system-nav-active[data-cw-themed-current="living-school"] .ls-moss,
html.cw-themed-system-nav-active[data-cw-themed-current="living-school"] .ls-compass{bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + 14px)!important}
#${NAV_ID}{position:fixed;z-index:2147483600;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + var(--cw-themed-nav-bottom-gap));width:100vw;height:var(--cw-themed-nav-height);display:grid;grid-template-columns:repeat(5,minmax(0,var(--cw-themed-nav-button-width)));justify-content:center;align-items:stretch;padding:0;margin:0;background:transparent!important;isolation:isolate;overflow:visible}
#${NAV_ID}::before{content:"";position:absolute;left:max(6px,calc((100vw - 780px)/2));right:max(6px,calc((100vw - 780px)/2));top:2px;bottom:2px;border:1px solid #d6ab4f88;border-radius:16px;background:linear-gradient(180deg,#1a1320cc,#100d17cc);box-shadow:0 6px 18px #0007;pointer-events:none}
#${NAV_ID} .cw-themed-system-link{position:relative;min-width:0;width:100%;height:100%;display:grid;place-items:center;margin:0;padding:0;border:0;background:var(--system-shade);box-shadow:inset 0 1px 0 #f6dda0,inset 0 -1px 0 #765018;text-decoration:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;isolation:isolate;overflow:hidden}
#${NAV_ID} .cw-themed-system-link:first-child{border-left:1px solid #d6ab4f;border-radius:15px 0 0 15px}
#${NAV_ID} .cw-themed-system-link:last-child{border-right:1px solid #d6ab4f;border-radius:0 15px 15px 0}
#${NAV_ID} .cw-themed-system-link::before{content:"";position:absolute;z-index:-1;inset:3px 2px;border-radius:14px;opacity:.18;background:var(--system-panel);box-shadow:inset 0 0 12px var(--system-glow),0 0 16px var(--system-glow)}
#${NAV_ID} .cw-themed-system-link.is-current::before{opacity:.96}
#${NAV_ID} .cw-themed-system-link:focus-visible{outline:3px solid #fff8c7;outline-offset:-4px}
#${NAV_ID} .cw-themed-system-button{width:calc(100% - 4px);height:calc(100% - 6px);display:flex;align-items:center;gap:8px;padding:4px 10px 4px 9px;box-sizing:border-box}
#${NAV_ID} .cw-themed-system-avatar-wrap{position:relative;flex:0 0 auto;width:42px;height:42px;border-radius:13px;padding:2px;background:linear-gradient(180deg,var(--system-shell),#ffffff99);border:1px solid var(--system-ring);box-shadow:0 2px 10px #0006;overflow:visible}
#${NAV_ID} .cw-themed-system-avatar{display:block;width:100%;height:100%;border-radius:11px;background-image:var(--system-sheet),var(--system-fallback);background-size:500% 400%,cover;background-position:calc(var(--sprite-col)*25%) calc(var(--sprite-row)*33.333333%),center;background-repeat:no-repeat;filter:saturate(.96) brightness(.98);transition:transform .18s ease,filter .18s ease}
#${NAV_ID} .cw-themed-system-link:hover .cw-themed-system-avatar,
#${NAV_ID} .cw-themed-system-link.is-current .cw-themed-system-avatar{filter:saturate(1.06) brightness(1.04);transform:scale(1.04)}
#${NAV_ID} .cw-themed-system-monogram{font-family:Georgia,serif;font-size:clamp(23px,2vw,31px);font-weight:700;line-height:1;color:var(--system-label);text-shadow:0 1px 0 #3a2400,0 0 10px #0006;letter-spacing:.02em;white-space:nowrap}
#${NAV_ID} .cw-themed-system-link[data-expression="worried"] .cw-themed-system-avatar-wrap,
#${NAV_ID} .cw-themed-system-link[data-expression="sad"] .cw-themed-system-avatar-wrap,
#${NAV_ID} .cw-themed-system-link[data-expression="confused"] .cw-themed-system-avatar-wrap{box-shadow:0 0 0 1px #fff1ba88,0 0 14px #ffcc6688,0 2px 10px #0007}
#${NAV_ID} .cw-themed-system-link[data-expression="sleepy"] .cw-themed-system-avatar{filter:brightness(.9) saturate(.76)}
#${NAV_ID} .cw-themed-system-link[data-expression="sleepy"] .cw-themed-system-avatar-wrap::after,
#${NAV_ID} .cw-themed-system-link[data-expression="worried"] .cw-themed-system-avatar-wrap::after,
#${NAV_ID} .cw-themed-system-link[data-expression="sad"] .cw-themed-system-avatar-wrap::after,
#${NAV_ID} .cw-themed-system-link[data-expression="happy"] .cw-themed-system-avatar-wrap::after,
#${NAV_ID} .cw-themed-system-link[data-expression="cheering"] .cw-themed-system-avatar-wrap::after{content:"";position:absolute;right:-3px;bottom:-3px;width:11px;height:11px;border-radius:50%;border:2px solid #130c18}
#${NAV_ID} .cw-themed-system-link[data-expression="sleepy"] .cw-themed-system-avatar-wrap::after{background:#7b88a5}
#${NAV_ID} .cw-themed-system-link[data-expression="worried"] .cw-themed-system-avatar-wrap::after,
#${NAV_ID} .cw-themed-system-link[data-expression="sad"] .cw-themed-system-avatar-wrap::after{background:#f4bc57}
#${NAV_ID} .cw-themed-system-link[data-expression="happy"] .cw-themed-system-avatar-wrap::after,
#${NAV_ID} .cw-themed-system-link[data-expression="cheering"] .cw-themed-system-avatar-wrap::after{background:#54df8c}
#cwp215-launcher,#cw-radio-suggestion-v233{bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + 12px)!important}
@media(display-mode:window-controls-overlay){html.cwf104-active body{padding-top:max(var(--cwf104-head-total,54px),env(titlebar-area-height,54px))!important}.cwf104-head{min-height:max(var(--cwf104-head-h,54px),env(titlebar-area-height,54px))!important}}
@media(max-width:680px){:root{--cw-themed-nav-height:clamp(60px,15vw,68px);--cw-themed-nav-button-width:132px;--cw-themed-nav-bottom-gap:3px}#${NAV_ID}::before{left:6px;right:6px;top:4px;bottom:7px}#${NAV_ID} .cw-themed-system-button{height:calc(100% - 9px);gap:6px;padding:3px 7px 3px 6px}#${NAV_ID} .cw-themed-system-avatar-wrap{width:38px;height:38px}#${NAV_ID} .cw-themed-system-monogram{font-size:clamp(21px,6vw,28px)}}
@media(max-width:430px){#${NAV_ID} .cw-themed-system-button{gap:4px;padding-left:5px;padding-right:5px}#${NAV_ID} .cw-themed-system-avatar-wrap{width:34px;height:34px}#${NAV_ID} .cw-themed-system-monogram{font-size:clamp(19px,5.8vw,25px)}}
@media(prefers-reduced-motion:reduce){#${NAV_ID} .cw-themed-system-avatar{transition:none}}
`;
  document.head.append(style);
}

function ensureStateMapper(){
  const api=globalThis.CivweaveSubsystemAvatarStateV347;
  if(api)return Promise.resolve(api);
  if(statePromise)return statePromise;
  statePromise=new Promise(resolve=>{
    const existing=Array.from(document.scripts||[]).find(node=>String(node.src||'').includes('/app/subsystem-avatar-state-v347.js'));
    if(existing){
      existing.addEventListener('load',()=>resolve(globalThis.CivweaveSubsystemAvatarStateV347||null),{once:true});
      existing.addEventListener('error',()=>resolve(null),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=STATE_MAPPER;
    script.async=false;
    script.dataset.cwSubsystemAvatarState='v347';
    script.onload=()=>resolve(globalThis.CivweaveSubsystemAvatarStateV347||null);
    script.onerror=()=>resolve(null);
    document.head?.append(script);
  });
  return statePromise;
}
function linkFor(system){
  return document.querySelector(`#${NAV_ID} .cw-themed-system-link[data-system="${system}"]`);
}
function listFor(system){
  return globalThis.CivweaveAvatarExpressionDirectorV343?.expressions?.[system]||EX[system]||EX.civweave;
}
function setExpression(system,expression='neutral',source='default',reason=''){
  const link=linkFor(system);
  if(!link)return false;
  const list=listFor(system);
  const name=list.includes(String(expression))?String(expression):'neutral';
  const index=Math.max(0,list.indexOf(name));
  link.dataset.expression=name;
  link.dataset.expressionSource=source;
  link.style.setProperty('--sprite-col',String(index%5));
  link.style.setProperty('--sprite-row',String(Math.floor(index/5)));
  const item=SYSTEMS.find(x=>x.id===system);
  const text=reason?`${name}: ${reason}`:name;
  link.title=`${item?.label||system} — ${text}`;
  link.setAttribute('aria-description',`${item?.label||system} status: ${text}`);
  return true;
}
function subsystemActive(system){
  const row=explicitState.get(system);
  if(!row)return false;
  if(row.expiresAt&&Number(row.expiresAt)<=Date.now()){
    explicitState.delete(system);
    return false;
  }
  return row.state!=='neutral'&&!row.cleared;
}
function applySubsystem(detail={}){
  const system=String(detail.system||'');
  if(!SYSTEMS.some(x=>x.id===system))return false;
  if(detail.cleared||detail.state==='neutral'){
    explicitState.delete(system);
    return setExpression(system,'neutral',String(detail.source||'subsystem-clear'),String(detail.reason||''));
  }
  explicitState.set(system,{...detail});
  return setExpression(system,String(detail.expression||'neutral'),String(detail.source||'subsystem'),String(detail.reason||''));
}
function applyChat(detail={}){
  const system=String(detail.system||'');
  if(!system||subsystemActive(system))return false;
  return setExpression(system,String(detail.expression||'neutral'),String(detail.source||'chat'));
}
function hydrate(){
  const rows=globalThis.CivweaveSubsystemAvatarStateV347?.all?.()||{};
  for(const row of Object.values(rows))applySubsystem(row);
}
function mount(){
  const current=currentSystem();
  if(!current||document.getElementById(NAV_ID))return;
  ROUTES?.authorize?.();
  installStyle();
  document.documentElement.classList.add('cw-themed-system-nav-active');
  document.documentElement.dataset.cwThemedCurrent=current;
  document.documentElement.dataset.familyNavigationOwner='themed-system-nav-v178';

  const nav=document.createElement('nav');
  nav.id=NAV_ID;
  nav.dataset.navigationRevision=VERSION;
  nav.dataset.shellRevision='v304';
  nav.setAttribute('aria-label','Travel between Civweave systems');
  nav.innerHTML=SYSTEMS.map(item=>{
    const selected=item.id===current;
    return `<a class="cw-themed-system-link${selected?' is-current':''}" data-system="${item.id}" href="${href(item)}" target="_top" aria-label="Open ${item.label}"${selected?' aria-current="page"':''} style="--system-glow:${item.glow};--system-shade:${item.shade};--system-label:${item.labelColor};--system-shell:${item.shell};--system-ring:${item.ring};--system-panel:${item.panel};--system-sheet:url('${SHEETS[item.id]}');--system-fallback:url('${FALLBACK[item.id]}');--sprite-col:0;--sprite-row:0"><span class="cw-themed-system-button"><span class="cw-themed-system-avatar-wrap"><span class="cw-themed-system-avatar" role="img" aria-label="${item.character}"></span></span><span class="cw-themed-system-monogram">${item.monogram}</span></span></a>`;
  }).join('');
  nav.addEventListener('click',event=>{
    const link=event.target.closest('a[data-system]');
    if(!link||!ROUTES?.navigate)return;
    event.preventDefault();
    ROUTES.navigate(link.dataset.system,{version:'1.0.162',source:current});
  });
  document.body.append(nav);
  for(const item of SYSTEMS)setExpression(item.id,'neutral','boot');
  hydrate();
  void ensureStateMapper().then(hydrate);
  addEventListener('civweave:subsystem-avatar-state',event=>applySubsystem(event.detail||{}));
  addEventListener('civweave:subsystem-avatar-state-ready',hydrate);
  addEventListener('civweave:avatar-expression',event=>applyChat(event.detail||{}));
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount,{once:true}):mount();

globalThis.CivweaveFamilyNavigationV178=Object.freeze({
  version:VERSION,
  owner:true,
  domOwner:NAV_ID,
  systems:SYSTEMS.map(item=>item.id),
  routeContract:'system-routes-v227',
  currentSystem,
  setExpression
});
})();
