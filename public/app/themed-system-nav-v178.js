(()=>{
'use strict';
// shell-v304 keeps OS titlebar and bottom safe areas outside Civweave navigation.
const VERSION='1.0.131-five-system-navigation-v227';
const NAV_ID='cw-themed-system-nav';
const STYLE_ID='cw-themed-system-nav-style';
const PATH=location.pathname;
const QUERY=new URLSearchParams(location.search);
const EMBEDDED=window.self!==window.top||(QUERY.get('civweave')==='1'&&QUERY.get('cabinet')==='1');
const ROUTES=globalThis.CivweaveSystemRoutesV227;

const SYSTEMS=[
  {id:'civweave',label:'Civweave',image:'/app/assets/navigation/200-civweave-nav.webp?v=image-nav-r2',fallback:'/app/working-campus-v156.html?installed=1',glow:'#7fe7dc',shade:'#264646'},
  {id:'living-school',label:'Living School',image:'/app/assets/navigation/200-living-school-nav.webp?v=image-nav-r2',fallback:'/app/cabinets/living-school/index.html?cabinet=1&installed=1',glow:'#9acb70',shade:'#2d3e27'},
  {id:'cerbanimo',label:'Cerbanimo',image:'/app/assets/navigation/200-cerbanimo-nav.webp?v=image-nav-r2',fallback:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1&installed=1',glow:'#ff54d3',shade:'#4a1d43'},
  {id:'fellowfare',label:'FellowFare',image:'/app/assets/navigation/200-fellowfare-nav.webp?v=image-nav-r2',fallback:'/app/fellowfare-cabinet-v144.html?cabinet=1&installed=1',glow:'#4f8ca8',shade:'#182c37'},
  {id:'anarchadia',label:'Anarchadia',image:'/app/assets/navigation/200-anarchadia-nav.webp?v=image-nav-r2',fallback:'/app/anarchadia-console-v139.html?cabinet=1&installed=1',glow:'#ff2f87',shade:'#4a122e'}
];

function href(item){return ROUTES?.urlFor?.(item.id,{version:'1.0.131',source:currentSystem()||'navigation'}).href||item.fallback}
function clearEmbeddedCopy(){
  document.getElementById(NAV_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  document.documentElement.classList.remove('cw-themed-system-nav-active');
  delete document.documentElement.dataset.cwThemedCurrent;
  document.body?.style.removeProperty('padding-bottom');
}

if(EMBEDDED){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clearEmbeddedCopy,{once:true});
  else clearEmbeddedCopy();
  return;
}

function currentSystem(){
  const contracted=ROUTES?.identify?.(PATH);
  if(contracted)return contracted;
  const explicit=QUERY.get('system');
  if(SYSTEMS.some(item=>item.id===explicit))return explicit;
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
:root{--cw-themed-nav-height:clamp(46.8px,6.3vw,64.8px);--cw-themed-nav-button-width:156px;--cw-themed-nav-bottom-gap:6px}
html{scroll-padding-bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + var(--cw-themed-nav-bottom-gap) + 16px)}
html.cw-themed-system-nav-active body{padding-bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + var(--cw-themed-nav-bottom-gap) + 12px)!important}
html.cw-themed-system-nav-active #cwf104-tray,
html.cw-themed-system-nav-active nav.bottom,
html.cw-themed-system-nav-active .rc-bottom,
html.cw-themed-system-nav-active .ls-tray,
html.cw-themed-system-nav-active .bottom-nav{display:none!important}
html.cw-themed-system-nav-active[data-cw-themed-current="living-school"] .ls-app{grid-template-rows:54px minmax(0,1fr)!important}
html.cw-themed-system-nav-active[data-cw-themed-current="living-school"] .ls-moss,
html.cw-themed-system-nav-active[data-cw-themed-current="living-school"] .ls-compass{bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + var(--cw-themed-nav-bottom-gap) + 10px)!important}
#${NAV_ID}{position:fixed;z-index:2147483600;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + var(--cw-themed-nav-bottom-gap));width:100vw;height:var(--cw-themed-nav-height);display:grid;grid-template-columns:repeat(5,minmax(0,var(--cw-themed-nav-button-width)));justify-content:center;align-items:stretch;gap:0;padding:0;margin:0;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;isolation:isolate;overflow:visible}
#${NAV_ID}::before{content:"";position:absolute;left:max(6px,calc((100vw - 780px)/2));right:max(6px,calc((100vw - 780px)/2));top:-2px;bottom:-2px;border:1px solid #d6ab4f88;border-radius:14px;pointer-events:none;box-shadow:0 6px 18px #0007}
#${NAV_ID} .cw-themed-system-link{position:relative;min-width:0;width:100%;max-width:var(--cw-themed-nav-button-width);height:var(--cw-themed-nav-height);display:grid;place-items:center;margin:0;padding:0;border:0;background:transparent;box-shadow:inset 0 1px 0 #f6dda0,inset 0 -1px 0 #765018;text-decoration:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;isolation:isolate;overflow:hidden;transition:background-color .16s ease}
#${NAV_ID} .cw-themed-system-link:first-child{border-left:1px solid #d6ab4f;border-radius:13px 0 0 13px}
#${NAV_ID} .cw-themed-system-link:last-child{border-right:1px solid #d6ab4f;border-radius:0 13px 13px 0}
#${NAV_ID} .cw-themed-system-link:not(.is-current){background:var(--system-shade)}
#${NAV_ID} .cw-themed-system-link::before{content:"";position:absolute;z-index:-1;inset:3px 2px;border-radius:13px;opacity:0;box-shadow:inset 0 0 12px var(--system-glow),0 0 16px var(--system-glow);transition:opacity .16s ease}
#${NAV_ID} .cw-themed-system-link img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;transform:translateZ(0);filter:brightness(.9) saturate(.88);transition:filter .16s ease;user-select:none;-webkit-user-drag:none}
#${NAV_ID} .cw-themed-system-link:hover img{filter:brightness(1.05) saturate(1)}
#${NAV_ID} .cw-themed-system-link.is-current{z-index:2}
#${NAV_ID} .cw-themed-system-link.is-current::before{opacity:.92}
#${NAV_ID} .cw-themed-system-link.is-current img{filter:brightness(1.17) saturate(1.1) drop-shadow(0 0 5px var(--system-glow)) drop-shadow(0 0 13px var(--system-glow));transform:translateZ(0)}
#${NAV_ID} .cw-themed-system-link:focus-visible{outline:3px solid #fff8c7;outline-offset:-4px;border-radius:13px}
#cwp215-launcher,#cw-radio-suggestion-v233{bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + var(--cw-themed-nav-bottom-gap) + 12px)!important}
html[data-civweave-system="living-school"] #cw-shared-guide-surface-v236{margin:8px auto!important;padding:10px 12px!important;gap:10px!important}
html[data-civweave-system="living-school"] #cw-shared-guide-surface-v236 .cwsg236-avatar{width:52px!important;height:52px!important}
html[data-civweave-system="living-school"] #cw-shared-guide-surface-v236 .cwsg236-main{gap:7px!important}
html[data-civweave-system="living-school"] #cw-shared-guide-surface-v236 .cwsg236-log{max-height:104px!important;padding:7px!important}
html[data-civweave-system="living-school"] #cw-shared-guide-surface-v236 .cwsg236-form textarea{min-height:44px!important;max-height:96px!important;padding:8px 10px!important}
html[data-civweave-system="living-school"] #cw-shared-guide-surface-v236 .cwsg236-form textarea::placeholder{color:#a9bdb5!important;opacity:1!important}
html[data-civweave-system="living-school"] #cw-shared-guide-surface-v236 .cwsg236-note{color:#c6d6ce!important;line-height:1.25!important}
@media(display-mode:window-controls-overlay){
  html.cwf104-active body{padding-top:max(var(--cwf104-head-total,54px),env(titlebar-area-height,54px))!important}
  .cwf104-head{padding-left:max(10px,calc(env(titlebar-area-x,0px) + 10px))!important;padding-right:max(10px,calc(100vw - env(titlebar-area-x,0px) - env(titlebar-area-width,100vw) + 10px))!important;min-height:max(var(--cwf104-head-h,54px),env(titlebar-area-height,54px))!important}
}
@media(max-width:680px){:root{--cw-themed-nav-height:clamp(45px,12.6vw,59.4px);--cw-themed-nav-button-width:132px;--cw-themed-nav-bottom-gap:4px}#${NAV_ID}::before{left:6px;right:6px}html[data-civweave-system="living-school"] #cw-shared-guide-surface-v236 .cwsg236-log{max-height:84px!important}}
@media(prefers-reduced-motion:reduce){#${NAV_ID} .cw-themed-system-link::before,#${NAV_ID} .cw-themed-system-link img{transition:none}}
`;
  document.head.append(style);
}

function mount(){
  const current=currentSystem();
  if(!current||document.getElementById(NAV_ID))return;
  ROUTES?.authorize?.();
  installStyle();
  document.documentElement.classList.add('cw-themed-system-nav-active');
  document.documentElement.dataset.cwThemedCurrent=current;
  const nav=document.createElement('nav');
  nav.id=NAV_ID;
  nav.dataset.navigationRevision=VERSION;
  nav.dataset.shellRevision='v304';
  nav.setAttribute('aria-label','Travel between Civweave systems');
  nav.innerHTML=SYSTEMS.map(item=>{
    const selected=item.id===current;
    return `<a class="cw-themed-system-link${selected?' is-current':''}" data-system="${item.id}" href="${href(item)}" target="_top" aria-label="Open ${item.label}"${selected?' aria-current="page"':''} style="--system-glow:${item.glow};--system-shade:${item.shade}"><img src="${item.image}" alt="" width="200" height="100" draggable="false"></a>`;
  }).join('');
  nav.addEventListener('click',event=>{
    const link=event.target.closest('a[data-system]');
    if(!link||!ROUTES?.navigate)return;
    event.preventDefault();
    ROUTES.navigate(link.dataset.system,{version:'1.0.131',source:current});
  });
  document.body.append(nav);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
})();
