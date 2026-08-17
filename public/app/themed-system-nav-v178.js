(()=>{
'use strict';

const VERSION='1.0.164-five-guide-rail-hold-menu-v228';
const NAV_ID='cw-themed-system-nav';
const MENU_ID='cw-themed-system-nav-menu';
const STYLE_ID='cw-themed-system-nav-style';
const HOLD_MS=460;
const MOVE_TOLERANCE=12;
const INITIAL_QUERY=new URLSearchParams(location.search);
const EMBEDDED=window.self!==window.top||(INITIAL_QUERY.get('civweave')==='1'&&INITIAL_QUERY.get('cabinet')==='1');
const PREVIOUS=globalThis.CivweaveFamilyNavigationV178;
if(PREVIOUS?.owner&&typeof PREVIOUS.ensureMounted==='function'){
  PREVIOUS.ensureMounted();
  return;
}
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
const SYSTEMS=Object.freeze([
  Object.freeze({id:'civweave',label:'Civweave',character:'Weaveling',fallback:'/app/working-campus-v156.html?installed=1',glow:'#f5e7ff',shade:'#dad7ff',labelColor:'#7b5a15',shell:'#fff6ff',ring:'#f6dea1',panel:'linear-gradient(135deg,#fbf8ff 0%,#eaf4ff 32%,#fff1dc 64%,#f4edff 100%)'}),
  Object.freeze({id:'living-school',label:'Living School',character:'Moss',fallback:'/app/cabinets/living-school/index.html?cabinet=1&installed=1',glow:'#9acb70',shade:'#28412f',labelColor:'#f7e39e',shell:'#d6efcb',ring:'#ebc16b',panel:'linear-gradient(135deg,#274430,#365236)'}),
  Object.freeze({id:'cerbanimo',label:'Cerbanimo',character:'Kamiya',fallback:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1&installed=1',glow:'#bb79ff',shade:'#4f265f',labelColor:'#ffd676',shell:'#e4d6ff',ring:'#ebbf67',panel:'linear-gradient(135deg,#4e245d,#6a2c72)'}),
  Object.freeze({id:'fellowfare',label:'FellowFare',character:'Rook',fallback:'/app/fellowfare-cabinet-v144.html?cabinet=1&installed=1',glow:'#f5b446',shade:'#5a3618',labelColor:'#fff0bd',shell:'#f6e0a7',ring:'#d89f3d',panel:'linear-gradient(135deg,#6d4017,#8b5621)'}),
  Object.freeze({id:'anarchadia',label:'Anarchadia',character:'Merlin',fallback:'/app/anarchadia-console-v139.html?cabinet=1&installed=1',glow:'#ff3d96',shade:'#621f43',labelColor:'#ffe192',shell:'#f6d0df',ring:'#e1a85a',panel:'linear-gradient(135deg,#642042,#8c2455)'})
]);
const QUICK=Object.freeze({
  civweave:Object.freeze([
    Object.freeze({id:'weave',label:'Current Quest',hint:'Resume the active weave'}),
    Object.freeze({id:'progress',label:'Progress',hint:'See completed and remaining work'}),
    Object.freeze({id:'library',label:'Library',hint:'Open saved weaves'}),
    Object.freeze({id:'chat',label:'Talk to Weaveling',hint:'Open the Civweave guide thread'}),
    Object.freeze({id:'settings',label:'Settings',hint:'Open shared Civweave settings'})
  ]),
  'living-school':Object.freeze([
    Object.freeze({id:'continue',label:'Continue Learning',hint:'Resume the current module'}),
    Object.freeze({id:'path',label:'Learning Path',hint:'Choose or define the path'}),
    Object.freeze({id:'modules',label:'Modules',hint:'Jump to the module rail'}),
    Object.freeze({id:'practicum',label:'Practicum',hint:'Apply learning in the world'}),
    Object.freeze({id:'chat',label:'Talk to Moss',hint:'Open the Living School guide thread'})
  ]),
  cerbanimo:Object.freeze([
    Object.freeze({id:'quest',label:'Workboard',hint:'Open active Quest work'}),
    Object.freeze({id:'mission-room',label:'New Quest',hint:'Start a new Quest'}),
    Object.freeze({id:'project-workbench',label:'Project Workbench',hint:'Open project structure and notes'}),
    Object.freeze({id:'observatory',label:'Proof Observatory',hint:'Review proof and validation'}),
    Object.freeze({id:'chat',label:'Talk to Kamiya',hint:'Open the Cerbanimo guide thread'})
  ]),
  fellowfare:Object.freeze([
    Object.freeze({id:'market',label:'Market',hint:'Browse the exchange'}),
    Object.freeze({id:'loom',label:'Sell',hint:'Open the selling desk'}),
    Object.freeze({id:'assemblies',label:'Orders',hint:'Open active arrangements'}),
    Object.freeze({id:'inbox',label:'Wallet',hint:'Open balances and exchange state'}),
    Object.freeze({id:'profile',label:'You',hint:'Open your FellowFare profile'}),
    Object.freeze({id:'chat',label:'Talk to Rook',hint:'Open the FellowFare guide thread'})
  ]),
  anarchadia:Object.freeze([
    Object.freeze({id:'passport',label:'Passport',hint:'Return to your Passport'}),
    Object.freeze({id:'proposals',label:'Proposals',hint:'Open civic proposals'}),
    Object.freeze({id:'ledger',label:'Ledger',hint:'Open public receipts'}),
    Object.freeze({id:'observatory',label:'Observatory',hint:'Open readiness and risk'}),
    Object.freeze({id:'governance',label:'Governance',hint:'Open governed updates and ballots'}),
    Object.freeze({id:'chat',label:'Talk to Merlin',hint:'Open the Anarchadia guide thread'})
  ])
});

const explicitState=new Map();
let statePromise=null;
let menu=null;
let menuSystem='';
let hold=null;
let suppressClickUntil=0;
let onboardingSystem='';
let requestedRetry=0;

function itemFor(system){return SYSTEMS.find(item=>item.id===system)||null}
function quickFor(system){return QUICK[system]||[]}
function href(item){
  return ROUTES?.urlFor?.(item.id,{version:'1.0.163',source:currentSystem()||'navigation'}).href||item.fallback;
}
function clearEmbedded(){
  document.getElementById(NAV_ID)?.remove();
  document.getElementById(MENU_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  document.documentElement.classList.remove('cw-themed-system-nav-active');
  delete document.documentElement.dataset.cwThemedCurrent;
  document.body?.style.removeProperty('padding-bottom');
}
if(EMBEDDED){
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',clearEmbedded,{once:true}):clearEmbedded();
  return;
}
function currentSystem(){
  const path=location.pathname;
  const query=new URLSearchParams(location.search);
  const found=ROUTES?.identify?.(path);
  if(found)return found;
  const explicit=query.get('system');
  if(SYSTEMS.some(x=>x.id===explicit))return explicit;
  const declared=String(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||'').toLowerCase();
  if(SYSTEMS.some(x=>x.id===declared))return declared;
  if(document.documentElement.hasAttribute('data-living-school-cabinet')||path.includes('/cabinets/living-school/'))return'living-school';
  if(path.includes('fellowfare'))return'fellowfare';
  if(path.includes('anarchadia'))return'anarchadia';
  if(path.includes('realm-console-v140.html'))return explicit==='civweave'?'civweave':'cerbanimo';
  if(path.includes('working-campus-v156.html'))return'civweave';
  if(path.includes('fullscreen-family-v104.html'))return SYSTEMS.some(x=>x.id===explicit)?explicit:'civweave';
  return'';
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
:root{--cw-themed-nav-height:clamp(60px,7vw,74px);--cw-themed-nav-bottom-gap:6px}
html{scroll-padding-bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + 20px)}
html.cw-themed-system-nav-active body{padding-bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + 18px)!important}
html.cw-themed-system-nav-active nav.bottom,
html.cw-themed-system-nav-active .rc-bottom,
html.cw-themed-system-nav-active .ls-tray,
html.cw-themed-system-nav-active .bottom-nav{display:none!important}
html.cw-themed-system-nav-active[data-cw-themed-current="civweave"] main.app>.campus,
html.cw-themed-system-nav-active[data-cw-themed-current="civweave"] details[data-cw-pd-id="civweave-campus"]{display:none!important}
html.cw-themed-system-nav-active[data-cw-themed-current="living-school"] .ls-app{grid-template-rows:54px minmax(0,1fr)!important}
html.cw-themed-system-nav-active[data-cw-themed-current="living-school"] .ls-moss,
html.cw-themed-system-nav-active[data-cw-themed-current="living-school"] .ls-compass{bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + 14px)!important}
#${NAV_ID}{position:fixed;z-index:2147483600;left:50%;bottom:calc(env(safe-area-inset-bottom) + var(--cw-themed-nav-bottom-gap));transform:translateX(-50%);width:min(780px,calc(100vw - 8px));height:var(--cw-themed-nav-height);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:stretch;padding:0;margin:0;border:1px solid #d6ab4f88;border-radius:17px;background:linear-gradient(180deg,#1a1320e8,#100d17e8)!important;box-shadow:0 7px 22px #0008;isolation:isolate;overflow:visible}
#${NAV_ID} .cw-themed-system-link{position:relative;min-width:0;height:100%;display:grid;place-items:center;margin:0;padding:0;border:0;border-right:1px solid #d6ab4f38;background:color-mix(in srgb,var(--system-shade) 42%,#17131c);box-shadow:inset 0 1px 0 #f6dda055,inset 0 -1px 0 #765018;text-decoration:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;isolation:isolate;overflow:visible;opacity:.72;filter:saturate(.76) brightness(.82);transition:opacity .16s ease,filter .16s ease,transform .16s ease,box-shadow .16s ease,background .16s ease}
#${NAV_ID} .cw-themed-system-link:first-child{border-radius:15px 0 0 15px}#${NAV_ID} .cw-themed-system-link:last-child{border-right:0;border-radius:0 15px 15px 0}
#${NAV_ID} .cw-themed-system-link::before{content:"";position:absolute;z-index:-1;inset:3px 2px;border-radius:13px;opacity:.12;background:var(--system-panel);box-shadow:inset 0 0 12px var(--system-glow),0 0 16px var(--system-glow)}
#${NAV_ID} .cw-themed-system-link.is-current{z-index:2;opacity:1;filter:none;background:var(--system-shade);transform:translateY(-4px);box-shadow:inset 0 0 0 2px var(--system-ring),inset 0 1px 0 #fff8d8,0 -5px 16px color-mix(in srgb,var(--system-glow) 72%,transparent),0 5px 16px #0009}
#${NAV_ID} .cw-themed-system-link.is-current::before{opacity:.96}
#${NAV_ID} .cw-themed-system-link.is-menu-open{z-index:3;opacity:1;filter:none;box-shadow:inset 0 0 0 2px #fff2b5,0 -5px 18px color-mix(in srgb,var(--system-glow) 78%,transparent)}
#${NAV_ID} .cw-themed-system-link.is-onboarding-highlight{z-index:4;opacity:1;filter:none;animation:cw-nav-guide-pulse 1.05s ease-in-out infinite alternate;box-shadow:inset 0 0 0 2px #fff4bd,0 0 26px color-mix(in srgb,var(--system-glow) 88%,transparent)}
#${NAV_ID} .cw-themed-system-link:focus-visible{outline:3px solid #fff8c7;outline-offset:-4px}
#${NAV_ID} .cw-themed-system-button{width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:4px 8px;box-sizing:border-box;pointer-events:none}
#${NAV_ID} .cw-themed-system-avatar-wrap{position:relative;flex:0 0 auto;width:42px;height:42px;border-radius:13px;padding:2px;background:linear-gradient(180deg,var(--system-shell),#ffffff99);border:1px solid var(--system-ring);box-shadow:0 2px 10px #0006;overflow:visible}
#${NAV_ID} .cw-themed-system-avatar{display:block;width:100%;height:100%;border-radius:11px;background-image:var(--system-sheet),var(--system-fallback);background-size:500% 400%,cover;background-position:calc(var(--sprite-col)*25%) calc(var(--sprite-row)*33.333333%),center;background-repeat:no-repeat;filter:saturate(.96) brightness(.98);transition:transform .18s ease,filter .18s ease}
#${NAV_ID} .cw-themed-system-link:hover .cw-themed-system-avatar,#${NAV_ID} .cw-themed-system-link.is-current .cw-themed-system-avatar{filter:saturate(1.06) brightness(1.04);transform:scale(1.04)}
#${NAV_ID} .cw-themed-system-copy{min-width:0;display:grid;gap:1px;text-align:left}#${NAV_ID} .cw-themed-system-copy b{overflow:hidden;text-overflow:ellipsis;color:var(--system-label);font:800 12px/1.1 system-ui,sans-serif;white-space:nowrap;text-shadow:0 1px 4px #0009}#${NAV_ID} .cw-themed-system-copy small{overflow:hidden;text-overflow:ellipsis;color:#fffbd9d9;font:700 9px/1.1 system-ui,sans-serif;white-space:nowrap}
#${NAV_ID} .cw-themed-unread{position:absolute;right:-4px;top:-4px;min-width:13px;height:13px;padding:0 3px;border:2px solid #130c18;border-radius:999px;background:#fff1a8;box-shadow:0 0 10px var(--system-glow);color:#241708;font:900 8px/9px system-ui,sans-serif;text-align:center}#${NAV_ID} .cw-themed-unread[hidden]{display:none!important}
#${NAV_ID} .cw-themed-system-link[data-expression="worried"] .cw-themed-system-avatar-wrap,#${NAV_ID} .cw-themed-system-link[data-expression="sad"] .cw-themed-system-avatar-wrap,#${NAV_ID} .cw-themed-system-link[data-expression="confused"] .cw-themed-system-avatar-wrap{box-shadow:0 0 0 1px #fff1ba88,0 0 14px #ffcc6688,0 2px 10px #0007}
#${NAV_ID} .cw-themed-system-link[data-expression="sleepy"] .cw-themed-system-avatar{filter:brightness(.9) saturate(.76)}
#${MENU_ID}{position:fixed;z-index:2147483640;width:min(282px,calc(100vw - 20px));max-height:min(68dvh,520px);overflow:auto;padding:8px;border:1px solid #f1cf7a88;border-radius:16px;background:linear-gradient(160deg,#17121ff5,#090b12f8);box-shadow:0 22px 70px #000c,0 0 28px color-mix(in srgb,var(--menu-glow,#fff) 22%,transparent);color:#fff;font:13px/1.35 system-ui,sans-serif;overscroll-behavior:contain}
#${MENU_ID}[hidden]{display:none!important}#${MENU_ID} .cw-nav-menu-head{display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:9px;padding:6px 7px 9px;border-bottom:1px solid #ffffff17}#${MENU_ID} .cw-nav-menu-head img{width:38px;height:38px;border:1px solid #f1cf7a88;border-radius:11px;object-fit:cover}#${MENU_ID} .cw-nav-menu-head b,#${MENU_ID} .cw-nav-menu-head small{display:block}#${MENU_ID} .cw-nav-menu-head small{margin-top:2px;color:#aebac9;font-size:10px}
#${MENU_ID} .cw-nav-menu-list{display:grid;gap:4px;padding-top:7px}#${MENU_ID} [role="menuitem"]{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:10px 11px;border:1px solid transparent;border-radius:10px;background:#ffffff08;color:#fff;text-align:left;cursor:pointer}#${MENU_ID} [role="menuitem"]:hover,#${MENU_ID} [role="menuitem"]:focus-visible{border-color:#f1cf7a77;background:#ffffff13;outline:0}#${MENU_ID} [role="menuitem"] span{min-width:0}#${MENU_ID} [role="menuitem"] b,#${MENU_ID} [role="menuitem"] small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${MENU_ID} [role="menuitem"] small{margin-top:2px;color:#9eacbe;font-size:10px}#${MENU_ID} [role="menuitem"] i{font-style:normal;color:#f2d57f;font-weight:900}
#cwp215-launcher,#cw-radio-suggestion-v233{bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + 12px)!important}
@keyframes cw-nav-guide-pulse{from{transform:translateY(-3px) scale(1)}to{transform:translateY(-6px) scale(1.035)}}
@media(max-width:680px){:root{--cw-themed-nav-height:clamp(62px,16vw,70px);--cw-themed-nav-bottom-gap:3px}#${NAV_ID}{width:calc(100vw - 6px)}#${NAV_ID} .cw-themed-system-button{gap:4px;padding:3px 4px}#${NAV_ID} .cw-themed-system-avatar-wrap{width:37px;height:37px;border-radius:11px}#${NAV_ID} .cw-themed-system-avatar{border-radius:9px}#${NAV_ID} .cw-themed-system-copy b{font-size:10px}#${NAV_ID} .cw-themed-system-copy small{display:none}}
@media(max-width:470px){#${NAV_ID} .cw-themed-system-button{display:grid;grid-template-rows:38px auto;justify-items:center;align-content:center;gap:1px;padding:2px}#${NAV_ID} .cw-themed-system-copy{text-align:center}#${NAV_ID} .cw-themed-system-copy b{font-size:8.5px;max-width:58px}#${NAV_ID} .cw-themed-system-avatar-wrap{width:36px;height:36px}#${MENU_ID}{width:calc(100vw - 16px)}}
@media(prefers-reduced-motion:reduce){#${NAV_ID} .cw-themed-system-link,#${NAV_ID} .cw-themed-system-avatar{transition:none}#${NAV_ID} .cw-themed-system-link.is-onboarding-highlight{animation:none}}
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
    script.src=STATE_MAPPER;script.async=false;script.dataset.cwSubsystemAvatarState='v347';
    script.onload=()=>resolve(globalThis.CivweaveSubsystemAvatarStateV347||null);script.onerror=()=>resolve(null);
    document.head?.append(script);
  });
  return statePromise;
}
function linkFor(system){return document.querySelector(`#${NAV_ID} .cw-themed-system-link[data-system="${system}"]`)}
function listFor(system){return globalThis.CivweaveAvatarExpressionDirectorV343?.expressions?.[system]||EX[system]||EX.civweave}
function setExpression(system,expression='neutral',source='default',reason=''){
  const link=linkFor(system);if(!link)return false;
  const list=listFor(system),name=list.includes(String(expression))?String(expression):'neutral',index=Math.max(0,list.indexOf(name));
  link.dataset.expression=name;link.dataset.expressionSource=source;link.style.setProperty('--sprite-col',String(index%5));link.style.setProperty('--sprite-row',String(Math.floor(index/5)));
  const item=itemFor(system),status=reason?`${name}: ${reason}`:name;
  link.title=`${item?.character||system} · ${item?.label||system} — ${status}. Tap to open; hold for shortcuts.`;
  link.setAttribute('aria-description',`${item?.label||system} status: ${status}. Tap to open. Press and hold for shortcuts.`);
  return true;
}
function subsystemActive(system){
  const row=explicitState.get(system);if(!row)return false;
  if(row.expiresAt&&Number(row.expiresAt)<=Date.now()){explicitState.delete(system);return false}
  return row.state!=='neutral'&&!row.cleared;
}
function applySubsystem(detail={}){
  const system=String(detail.system||'');if(!SYSTEMS.some(x=>x.id===system))return false;
  if(detail.cleared||detail.state==='neutral'){explicitState.delete(system);return setExpression(system,'neutral',String(detail.source||'subsystem-clear'),String(detail.reason||''))}
  explicitState.set(system,{...detail});return setExpression(system,String(detail.expression||'neutral'),String(detail.source||'subsystem'),String(detail.reason||''));
}
function applyChat(detail={}){const system=String(detail.system||'');if(!system||subsystemActive(system))return false;return setExpression(system,String(detail.expression||'neutral'),String(detail.source||'chat'))}
function hydrate(){const rows=globalThis.CivweaveSubsystemAvatarStateV347?.all?.()||{};for(const row of Object.values(rows))applySubsystem(row)}
function syncCurrentSelection(current=currentSystem()){
  if(!SYSTEMS.some(item=>item.id===current))return false;
  document.documentElement.dataset.cwThemedCurrent=current;
  for(const item of SYSTEMS){const link=linkFor(item.id);if(!link)continue;const selected=item.id===current;link.classList.toggle('is-current',selected);if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')}
  return true;
}
function syncUnread(){
  const chat=globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215;
  for(const item of SYSTEMS){const link=linkFor(item.id),dot=link?.querySelector('.cw-themed-unread');if(!dot)continue;let unread=false;try{unread=Boolean(chat?.hasUnread?.(item.id))}catch{}dot.hidden=!unread;dot.textContent=unread?'•':''}
}
function syncOnboarding(){for(const item of SYSTEMS)linkFor(item.id)?.classList.toggle('is-onboarding-highlight',item.id===onboardingSystem)}

function ensureMenu(){
  if(menu?.isConnected)return menu;
  menu=document.getElementById(MENU_ID)||document.createElement('section');menu.id=MENU_ID;menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','Guide shortcuts');
  menu.addEventListener('click',event=>{const button=event.target.closest('[data-cw-nav-feature]');if(!button)return;event.preventDefault();const system=button.dataset.cwNavSystem,feature=button.dataset.cwNavFeature;closeQuickMenu({restoreFocus:false});launchFeature(system,feature)});
  menu.addEventListener('keydown',event=>{
    const items=[...menu.querySelectorAll('[role="menuitem"]')];if(!items.length)return;const index=Math.max(0,items.indexOf(document.activeElement));
    if(event.key==='Escape'){event.preventDefault();closeQuickMenu({restoreFocus:true});return}
    if(event.key==='ArrowDown'){event.preventDefault();items[(index+1)%items.length].focus();return}
    if(event.key==='ArrowUp'){event.preventDefault();items[(index-1+items.length)%items.length].focus();return}
    if(event.key==='Home'){event.preventDefault();items[0].focus();return}
    if(event.key==='End'){event.preventDefault();items.at(-1).focus()}
  });
  if(!menu.isConnected)document.body.append(menu);return menu;
}
function positionMenu(link){
  if(!menu||!link)return;const rect=link.getBoundingClientRect(),width=Math.min(282,Math.max(220,innerWidth-20)),left=Math.max(8,Math.min(innerWidth-width-8,rect.left+rect.width/2-width/2)),bottom=Math.max(8,innerHeight-rect.top+8);
  menu.style.width=`${width}px`;menu.style.left=`${Math.round(left)}px`;menu.style.bottom=`${Math.round(bottom)}px`;
}
function openQuickMenu(system,{focus=true}={}){
  const item=itemFor(system),link=linkFor(system);if(!item||!link)return false;
  ensureMenu();closeQuickMenu({restoreFocus:false});menuSystem=system;menu.style.setProperty('--menu-glow',item.glow);menu.setAttribute('aria-label',`${item.character} shortcuts`);
  menu.innerHTML=`<div class="cw-nav-menu-head"><img src="${FALLBACK[system]}" alt=""><div><b>${item.character}</b><small>${item.label} · quick launch</small></div></div><div class="cw-nav-menu-list">${quickFor(system).map(action=>`<button type="button" role="menuitem" data-cw-nav-system="${system}" data-cw-nav-feature="${action.id}"><span><b>${action.label}</b><small>${action.hint}</small></span><i>›</i></button>`).join('')}</div>`;
  menu.hidden=false;positionMenu(link);link.classList.add('is-menu-open');link.setAttribute('aria-expanded','true');
  if(focus)requestAnimationFrame(()=>menu.querySelector('[role="menuitem"]')?.focus({preventScroll:true}));
  try{dispatchEvent(new CustomEvent('civweave:navigation-quick-menu-opened',{detail:{system,version:VERSION}}))}catch{}
  return true;
}
function closeQuickMenu({restoreFocus=false}={}){
  if(!menu||menu.hidden)return false;const system=menuSystem,link=linkFor(system);menu.hidden=true;menuSystem='';link?.classList.remove('is-menu-open');link?.setAttribute('aria-expanded','false');if(restoreFocus)link?.focus({preventScroll:true});return true;
}
function cancelHold(){if(!hold)return;clearTimeout(hold.timer);hold=null}
function startHold(event,link){
  if(event.button!=null&&event.button!==0)return;cancelHold();const system=String(link.dataset.system||''),startX=Number(event.clientX)||0,startY=Number(event.clientY)||0,pointerId=event.pointerId;
  hold={system,link,startX,startY,pointerId,opened:false,timer:setTimeout(()=>{if(!hold||hold.system!==system)return;hold.opened=true;suppressClickUntil=Date.now()+700;openQuickMenu(system,{focus:false});try{navigator.vibrate?.(10)}catch{}},HOLD_MS)};
}
function moveHold(event){if(!hold||event.pointerId!==hold.pointerId)return;if(Math.hypot((Number(event.clientX)||0)-hold.startX,(Number(event.clientY)||0)-hold.startY)>MOVE_TOLERANCE)cancelHold()}
function finishHold(event){if(!hold||event.pointerId!==hold.pointerId)return;const opened=hold.opened;cancelHold();if(opened){event.preventDefault();event.stopPropagation()}}
function routeSystem(system,feature=''){
  const item=itemFor(system);if(!item)return false;ROUTES?.authorize?.();let url;
  try{url=ROUTES?.urlFor?.(system,{version:'1.0.163',source:currentSystem()||'navigation'})||new URL(item.fallback,location.origin)}catch{url=new URL(item.fallback,location.origin)}
  if(feature)url.searchParams.set('feature',feature);location.assign(url.href);return true;
}
function reveal(target){
  if(!target)return false;let node=target;if(node.matches?.('details'))node.open=true;for(let parent=node.parentElement;parent;parent=parent.parentElement)if(parent.matches?.('details'))parent.open=true;
  requestAnimationFrame(()=>{target.scrollIntoView?.({behavior:'smooth',block:'start'});const focusable=target.matches?.('button,a,input,select,textarea,summary,[tabindex]')?target:target.querySelector?.('button,a,input,select,textarea,summary,[tabindex]');focusable?.focus?.({preventScroll:true})});return true;
}
function openChat(system){const chat=globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215;try{return Boolean(chat?.open?.({guide:system,focus:true}))}catch{return false}}
function livingTarget(feature){
  if(feature==='continue')return document.querySelector('.lsc218-lesson')||document.querySelector('.lsc218-module-rail')||document.querySelector('.lsc218-hero');
  if(feature==='path')return document.querySelector('details[data-cw-pd-id="living-path-setup"]')||[...document.querySelectorAll('.lsc218-panel')].find(panel=>/choose or define the path/i.test(panel.textContent||''));
  if(feature==='modules')return document.querySelector('.lsc218-module-rail')||document.querySelector('.lsc218-lesson');
  if(feature==='practicum')return document.querySelector('details[data-cw-pd-id="living-practicum"]')||[...document.querySelectorAll('.lsc218-panel')].find(panel=>/apply learning in the world/i.test(panel.textContent||''));
  return null;
}
function activateLocalFeature(system,feature){
  if(system!==currentSystem())return false;
  if(feature==='chat')return openChat(system);
  if(system==='civweave'){
    if(feature==='settings'){const control=document.querySelector('[data-open-unified-ai-settings]');if(control){control.click();return true}return false}
    const button=document.querySelector(`nav.bottom [data-view="${feature}"]`);if(button){button.click();return true}return false;
  }
  if(system==='living-school')return reveal(livingTarget(feature));
  if(system==='cerbanimo'){
    const selector=`[data-dashboard-room="${feature}"],[data-room="${feature}"]`,control=document.querySelector(selector);if(control){control.click();return true}return false;
  }
  if(system==='fellowfare'){
    const control=document.querySelector(`[data-ffc-command="${feature}"]`);if(control){control.click();return true}return false;
  }
  if(system==='anarchadia'){
    if(feature==='passport'){
      document.querySelector('[data-screen-target="home"]')?.click();return reveal(document.querySelector('.ac-passport'));
    }
    if(feature==='governance'){const control=document.querySelector('[data-ag145-open]');if(control){control.click();return true}return false}
    const control=document.querySelector(`[data-screen-target="${feature}"]`);if(control){control.click();return true}return false;
  }
  return false;
}
function launchFeature(system,feature){
  closeQuickMenu({restoreFocus:false});
  if(system===currentSystem()&&activateLocalFeature(system,feature))return true;
  return routeSystem(system,feature);
}
function clearRequestedFeature(){
  const url=new URL(location.href);if(!url.searchParams.has('feature'))return;url.searchParams.delete('feature');history.replaceState(history.state,'',`${url.pathname}${url.search}${url.hash}`);
}
function applyRequestedFeature(){
  const feature=String(new URLSearchParams(location.search).get('feature')||'').trim();if(!feature)return true;const system=currentSystem();if(!system)return false;
  if(activateLocalFeature(system,feature)){clearRequestedFeature();requestedRetry=0;return true}
  if(requestedRetry<1){requestedRetry+=1;setTimeout(()=>applyRequestedFeature(),720)}
  return false;
}
function syncChrome(){syncCurrentSelection();syncUnread();syncOnboarding()}
function mount(){
  const current=currentSystem();if(!current)return false;if(!document.body){document.addEventListener('DOMContentLoaded',mount,{once:true});return false}
  installStyle();document.documentElement.classList.add('cw-themed-system-nav-active');document.documentElement.dataset.cwThemedCurrent=current;document.documentElement.dataset.familyNavigationOwner='themed-system-nav-v178';
  let nav=document.getElementById(NAV_ID);
  if(!nav){
    ROUTES?.authorize?.();nav=document.createElement('nav');nav.id=NAV_ID;nav.dataset.navigationRevision=VERSION;nav.dataset.shellRevision='v305-hold-menu';nav.setAttribute('aria-label','Civweave five-guide rail');
    nav.innerHTML=SYSTEMS.map(item=>{const selected=item.id===current;return `<a class="cw-themed-system-link${selected?' is-current':''}" data-system="${item.id}" href="${href(item)}" target="_top" aria-label="${item.character} · ${item.label}. Tap to open ${item.label}. Press and hold for shortcuts." aria-haspopup="menu" aria-expanded="false"${selected?' aria-current="page"':''} style="--system-glow:${item.glow};--system-shade:${item.shade};--system-label:${item.labelColor};--system-shell:${item.shell};--system-ring:${item.ring};--system-panel:${item.panel};--system-sheet:url('${SHEETS[item.id]}');--system-fallback:url('${FALLBACK[item.id]}');--sprite-col:0;--sprite-row:0"><span class="cw-themed-system-button"><span class="cw-themed-system-avatar-wrap"><span class="cw-themed-system-avatar" role="img" aria-label="${item.character}"></span><span class="cw-themed-unread" hidden></span></span><span class="cw-themed-system-copy"><b>${item.character}</b><small>${item.label}</small></span></span></a>`}).join('');
    nav.addEventListener('pointerdown',event=>{const link=event.target.closest?.('a[data-system]');if(link)startHold(event,link)});
    nav.addEventListener('pointermove',moveHold);
    nav.addEventListener('pointerup',finishHold);
    nav.addEventListener('pointercancel',cancelHold);
    nav.addEventListener('contextmenu',event=>{const link=event.target.closest?.('a[data-system]');if(!link)return;event.preventDefault();cancelHold();suppressClickUntil=Date.now()+500;openQuickMenu(link.dataset.system,{focus:true})});
    nav.addEventListener('keydown',event=>{const link=event.target.closest?.('a[data-system]');if(!link)return;if(event.key==='ContextMenu'||event.key==='ArrowUp'||(event.key==='Enter'&&event.shiftKey)){event.preventDefault();openQuickMenu(link.dataset.system,{focus:true})}});
    nav.addEventListener('click',event=>{const link=event.target.closest?.('a[data-system]');if(!link)return;event.preventDefault();if(Date.now()<suppressClickUntil)return;closeQuickMenu({restoreFocus:false});const target=String(link.dataset.system||'');syncCurrentSelection(target);routeSystem(target)});
    document.body.append(nav);
  }else nav.dataset.navigationRevision=VERSION;
  ensureMenu();syncChrome();for(const item of SYSTEMS)if(!linkFor(item.id)?.dataset.expression)setExpression(item.id,'neutral','boot');hydrate();void ensureStateMapper().then(hydrate);requestAnimationFrame(()=>applyRequestedFeature());return true;
}
function ensureMounted(){if(EMBEDDED){clearEmbedded();return false}return mount()}

addEventListener('civweave:subsystem-avatar-state',event=>applySubsystem(event.detail||{}));
addEventListener('civweave:subsystem-avatar-state-ready',hydrate);
addEventListener('civweave:avatar-expression',event=>applyChat(event.detail||{}));
addEventListener('civweave:system-route-changed',()=>syncCurrentSelection());
addEventListener('civweave:guide-chat-state',syncUnread);
addEventListener('civweave:realm-guide-thread-changed',syncUnread);
addEventListener('civweave:guide-chat-ready',()=>{syncUnread();applyRequestedFeature()});
addEventListener('civweave:living-school-workbench-ready',applyRequestedFeature);
addEventListener('civweave:onboarding-step',event=>{onboardingSystem=String(event.detail?.system||'');syncOnboarding()});
for(const name of ['civweave:onboarding-completed','civweave:onboarding-skipped'])addEventListener(name,()=>{onboardingSystem='';syncOnboarding()});
addEventListener('storage',event=>{if(String(event.key||'').startsWith('civweave.guide-thread.'))syncUnread()});
addEventListener('popstate',()=>{syncCurrentSelection();applyRequestedFeature()});
addEventListener('hashchange',()=>syncCurrentSelection());
addEventListener('pageshow',()=>{ensureMounted();syncUnread();applyRequestedFeature()});
addEventListener('focus',()=>{ensureMounted();syncUnread()});
addEventListener('resize',()=>{if(menu&&!menu.hidden&&menuSystem)positionMenu(linkFor(menuSystem))},{passive:true});
document.addEventListener('pointerdown',event=>{if(menu?.hidden)return;if(menu?.contains(event.target)||document.getElementById(NAV_ID)?.contains(event.target))return;closeQuickMenu({restoreFocus:false})},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureMounted,{once:true});else ensureMounted();
setTimeout(ensureMounted,120);setTimeout(ensureMounted,900);

globalThis.CivweaveFamilyNavigationV178=Object.freeze({
  version:VERSION,owner:true,domOwner:NAV_ID,menuOwner:MENU_ID,systems:SYSTEMS.map(item=>item.id),routeContract:'system-routes-v227',interaction:'tap-system-hold-shortcuts',holdMilliseconds:HOLD_MS,currentSystem,mount,ensureMounted,syncCurrentSelection,setExpression,quickActions:system=>quickFor(system).map(action=>({...action})),openQuickMenu,closeQuickMenu,activateFeature:launchFeature,applyRequestedFeature
});
})();
