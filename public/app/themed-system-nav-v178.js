(()=>{
'use strict';

const NAV_ID='cw-themed-system-nav';
const STYLE_ID='cw-themed-system-nav-style';
const PATH=location.pathname;
const QUERY=new URLSearchParams(location.search);

const SYSTEMS=[
  {id:'commonweave',label:'Commonweave',image:'/app/assets/navigation/200-commonweave-nav.webp',href:'/app/working-campus-v156.html',glow:'#7fe7dc'},
  {id:'cerbanimo',label:'Cerbanimo',image:'/app/assets/navigation/200-cerbanimo-nav.webp',href:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1',glow:'#ff54d3'},
  {id:'living-school',label:'Living School',image:'/app/assets/navigation/200-living-school-nav.webp',href:'/app/cabinets/living-school/index.html?cabinet=1',glow:'#9acb70'},
  {id:'fellowfare',label:'FellowFare',image:'/app/assets/navigation/200-fellowfare-nav.webp',href:'/app/fellowfare-cabinet-v144.html?cabinet=1',glow:'#d89f58'},
  {id:'anarchadia',label:'Anarchadia',image:'/app/assets/navigation/200-anarchadia-nav.webp',href:'/app/anarchadia-console-v139.html?cabinet=1',glow:'#ff2f87'}
];

function currentSystem(){
  const explicit=QUERY.get('system');
  if(SYSTEMS.some(item=>item.id===explicit))return explicit;
  if(document.documentElement.hasAttribute('data-living-school-cabinet')||PATH.includes('/cabinets/living-school/'))return'living-school';
  if(PATH.includes('fellowfare'))return'fellowfare';
  if(PATH.includes('anarchadia'))return'anarchadia';
  if(PATH.includes('realm-console-v140.html'))return explicit==='commonweave'?'commonweave':'cerbanimo';
  if(PATH.includes('working-campus-v156.html'))return'commonweave';
  return'';
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
:root{--cw-themed-nav-height:clamp(48px,10vw,100px)}
html.cw-themed-system-nav-active body{padding-bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom))!important}
html.cw-themed-system-nav-active #cwf104-tray{display:none!important}
html[data-cw-themed-current="commonweave"] nav.bottom{display:none!important}
html.cw-themed-system-nav-active .rc-bottom,
html.cw-themed-system-nav-active .ls-tray,
html.cw-themed-system-nav-active .bottom-nav{bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom))!important}
#${NAV_ID}{position:fixed;z-index:2147483600;left:0;right:0;bottom:0;width:100vw;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:end;gap:0;padding:0 0 env(safe-area-inset-bottom);margin:0;background:#03070bde;box-shadow:0 -6px 24px #0009;backdrop-filter:blur(10px);isolation:isolate}
#${NAV_ID} .cw-themed-system-link{position:relative;min-width:0;height:var(--cw-themed-nav-height);display:grid;place-items:center;margin:0;padding:0;border:0;background:transparent;text-decoration:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;isolation:isolate}
#${NAV_ID} .cw-themed-system-link::before{content:"";position:absolute;z-index:-1;inset:3px 2px;border-radius:13px;opacity:0;box-shadow:inset 0 0 12px var(--system-glow),0 0 16px var(--system-glow);transition:opacity .16s ease}
#${NAV_ID} .cw-themed-system-link img{display:block;width:100%;height:auto;max-height:100%;object-fit:contain;object-position:center;transform:translateZ(0);filter:brightness(.84) saturate(.82);transition:filter .16s ease,transform .16s ease;user-select:none;-webkit-user-drag:none}
#${NAV_ID} .cw-themed-system-link:hover img{filter:brightness(1.02) saturate(1)}
#${NAV_ID} .cw-themed-system-link.is-current{z-index:2}
#${NAV_ID} .cw-themed-system-link.is-current::before{opacity:.92}
#${NAV_ID} .cw-themed-system-link.is-current img{filter:brightness(1.15) saturate(1.08) drop-shadow(0 0 5px var(--system-glow)) drop-shadow(0 0 13px var(--system-glow));transform:translateY(-2px) scale(1.035)}
#${NAV_ID} .cw-themed-system-link:focus-visible{outline:3px solid #fff8c7;outline-offset:-4px;border-radius:13px}
@media(prefers-reduced-motion:reduce){#${NAV_ID} .cw-themed-system-link::before,#${NAV_ID} .cw-themed-system-link img{transition:none}}
`;
  document.head.append(style);
}

function mount(){
  const current=currentSystem();
  if(!current||document.getElementById(NAV_ID))return;
  installStyle();
  document.documentElement.classList.add('cw-themed-system-nav-active');
  document.documentElement.dataset.cwThemedCurrent=current;
  const nav=document.createElement('nav');
  nav.id=NAV_ID;
  nav.setAttribute('aria-label','Travel between Commonweave systems');
  nav.innerHTML=SYSTEMS.map(item=>{
    const selected=item.id===current;
    return `<a class="cw-themed-system-link${selected?' is-current':''}" data-system="${item.id}" href="${item.href}" aria-label="Open ${item.label}"${selected?' aria-current="page"':''} style="--system-glow:${item.glow}"><img src="${item.image}" alt="" width="200" height="100" draggable="false"></a>`;
  }).join('');
  document.body.append(nav);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
})();
