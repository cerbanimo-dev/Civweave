(()=>{
'use strict';
const path=location.pathname;
const system=path.includes('/living-school/')?'living':path.includes('/cerbanimo/')?'cerbanimo':path.includes('/fellowfare/')?'fellowfare':path.includes('/anarchadia/')?'anarchadia':'';
if(!system||new URLSearchParams(location.search).get('classic')==='1')return;
const VERSION='1.0.23';
const ROOT=new URL('../../',location.href);
const R=p=>new URL(p,ROOT).href;
const A=p=>new URL(p,location.href).href;
const icon={
 home:R('assets/generated/civweave-navigation-icons/civweave-home.png'),
 compass:R('assets/generated/civweave-navigation-icons/weaveling-compass.png'),
 realms:R('assets/generated/civweave-navigation-icons/civweave-realms.png'),
 route:R('assets/generated/civweave-navigation-icons/civweave-route.png'),
 settings:R('assets/generated/civweave-navigation-icons/civweave-ai-config.png')
};
const P=(x,y,w,h,poly='')=>({x,y,w,h,poly});
const configs={
 living:{name:'Living School',home:'hall',nav:'',logo:R('logos/living-school.webp'),guide:R('assets/ai/moss.png'),guideClass:'moss',scenes:{
  hall:{src:A('visual-assets/core/home.webp'),guide:'welcome',spots:[
   ['Moss’s Study','study',P(1,19,28,21,'polygon(0 8%,78% 0,100% 100%,8% 100%)')],
   ['Great Library','library',P(71,19,28,22,'polygon(18% 0,100% 8%,92% 100%,0 100%)')],
   ['Curriculum Forge','forge',P(0,40,31,22,'polygon(0 6%,82% 0,100% 100%,8% 100%)')],
   ['Practicum Conservatory','practice',P(70,40,30,22,'polygon(18% 0,100% 7%,92% 100%,0 100%)')],
   ['Competency Tower','tower',P(33,47,34,27,'polygon(20% 0,80% 0,100% 100%,0 100%)')],
   ['Ask Moss','moss-chat',P(31,10,38,25,'ellipse(50% 50% at 50% 50%)'),'action']
  ]},
  study:{src:A('visual-assets/core/moss.webp'),guide:'teach'},
  forge:{src:A('visual-assets/core/forge.webp'),guide:'generate'},
  library:{src:A('visual-assets/core/library.webp'),guide:'teach'},
  practice:{src:A('visual-assets/core/workshop.webp'),guide:'practice'},
  tower:{src:A('visual-assets/core/tower.webp'),guide:'assess'}
 }},
 cerbanimo:{name:'Cerbanimo',home:'nexus',nav:'',logo:A('assets/cerbanimo-wordmark.png'),guide:R('assets/ai/kamiya.png'),guideClass:'kamiya',scenes:{
  nexus:{src:A('assets/visual/nexus.webp'),spots:[
   ['Mission Control','mission',P(2,16,30,21,'polygon(0 0,88% 0,100% 100%,7% 100%)')],
   ['Workshop','workshop',P(67,16,31,22,'polygon(12% 0,100% 0,94% 100%,0 100%)')],
   ['Quest Arcade','quest',P(2,43,31,21,'polygon(0 0,100% 8%,88% 100%,5% 100%)')],
   ['Skill Observatory','observatory',P(67,43,31,21,'polygon(0 8%,100% 0,95% 100%,12% 100%)')],
   ['Talk to Kamiya','kamiya-chat',P(34,52,32,24,'ellipse(50% 50% at 50% 50%)'),'action']
  ]},
  mission:{src:A('assets/visual/mission.webp')},workshop:{src:A('assets/visual/workshop.webp')},quest:{src:A('assets/visual/quest.webp')},observatory:{src:A('assets/visual/observatory.webp')},ai:{src:A('assets/visual/ai-core.webp')}
 }},
 fellowfare:{name:'FellowFare',home:'exchange',nav:'',logo:R('logos/fellowfare.png'),guide:R('assets/ai/rook.png'),guideClass:'rook',scenes:{
  exchange:{src:A('assets/mall/exchange-galleria.webp'),spots:[
   ['Exchange board','exchange-board',P(30,31,40,18,'ellipse(50% 50% at 50% 50%)'),'action'],
   ['Browse offers','market',P(0,45,29,25,'polygon(0 0,78% 0,100% 100%,0 100%)')],
   ['Post a need or offer','listing',P(71,45,29,25,'polygon(22% 0,100% 0,100% 100%,0 100%)'),'action'],
   ['Ask Rook','rook-chat',P(55,55,37,22,'polygon(8% 0,100% 0,92% 100%,0 100%)'),'action'],
   ['Desk ledger','ledger',P(13,63,74,15,'polygon(3% 0,97% 0,100% 100%,0 100%)'),'action']
  ]},
  market:{src:A('assets/mall/marketplace.webp')},makers:{src:A('assets/mall/makers-arcade.webp')},galleria:{src:A('assets/mall/main-atrium.webp')},resource:{src:A('assets/mall/resource-center.webp')},upper:{src:A('assets/mall/upper-gallery.webp')}
 }},
 anarchadia:{name:'Anarchadia',home:'commons',nav:'',logo:R('logos/anarchadia.webp'),guide:R('assets/ai/merlin.png'),guideClass:'merlin',scenes:{
  commons:{src:A('assets/screens/home-portrait.webp'),guide:'welcome',board:true},
  control:{src:A('assets/screens/rails-portrait.webp'),guide:'listen'},
  proposal:{src:A('assets/screens/proposal-portrait.webp'),guide:'proposal'},
  assembly:{src:A('assets/screens/hub-portrait.webp'),guide:'conflict'},
  consent:{src:A('assets/screens/ledger-portrait.webp'),guide:'consent'},
  federation:{src:A('assets/screens/federation-portrait.webp'),guide:'execute'}
 }}
};
const cfg=configs[system];
let sceneId=cfg.home, surfaceKind='';
let frame, art, backdrop, layer, stage;
const stateKey=`civweave.${system}.visual-state.v2`;
const read=()=>{try{return JSON.parse(localStorage.getItem(stateKey)||'{}')}catch{return{}}};
const write=v=>{try{localStorage.setItem(stateKey,JSON.stringify(v))}catch{}};
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function unifyWorker(){if(!('serviceWorker'in navigator))return;try{const regs=await navigator.serviceWorker.getRegistrations();await Promise.allSettled(regs.filter(r=>/\/services\//.test(r.scope)).map(r=>r.unregister()));await navigator.serviceWorker.register(R('service-worker.js'),{scope:ROOT.pathname,updateViaCache:'none'})}catch{}}
function civweave(query=''){location.href=R(`index.html${query}`)}
function settings(){civweave(`?open=model-settings&return=${encodeURIComponent(location.href)}`)}
function compass(){if(window.CivweaveCompass?.open){window.CivweaveCompass.open();return}if(window.CivweaveMerlinChat?.open){window.CivweaveMerlinChat.open();return}document.querySelector('.cw-merlin-launcher')?.click()}
function removeLegacy(){document.querySelectorAll('.cw-release-banner,.app-update-banner,[data-app-update-banner],[class*="update-banner"],.legacy-toolbar,.legacy-bottom-nav,.legacy-hud,.rook-commons-local,.ff-version-plaque,.ff-scene-back,.cw-scene-decoration,.debug-region,.hotspot-debug,[data-debug-box],.cerbanimo-image-dock,.ff-image-dock,.ls-image-dock,.visual-stage-tools.cardinal-image-dock').forEach(n=>n.remove())}
function guideAsset(){return{src:cfg.guide,index:0,sprite:false}}
function fitFrame(){if(!frame||!art?.naturalWidth)return;const box=stage.getBoundingClientRect(),scale=Math.min(box.width/art.naturalWidth,box.height/art.naturalHeight);frame.style.width=`${Math.round(art.naturalWidth*scale)}px`;frame.style.height=`${Math.round(art.naturalHeight*scale)}px`}
function renderSpots(scene){const spots=scene.spots||[];layer.querySelector('.cw-object-hotspots').innerHTML=spots.map(([label,target,b,mode])=>`<button class="cw-object-hotspot" data-target="${safe(target)}" data-mode="${mode||'scene'}" aria-label="${safe(label)}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%;${b.poly?`clip-path:${b.poly};`:''}"><span>${safe(label)}</span></button>`).join('');layer.querySelectorAll('.cw-object-hotspot').forEach(btn=>btn.onclick=()=>btn.dataset.mode==='action'?openSurface(btn.dataset.target):setScene(btn.dataset.target))}
function boardMarkup(){return `<section class="cw-anarchadia-board"><small>MERLIN’S COMMONS BOARD</small><strong>WHAT NEEDS DOING?</strong><div><button data-an-action="feature">FEATURE REQUEST</button><button data-an-action="bug">BUG REPORT</button><button data-an-action="hub">COMMUNITY HUB</button><button data-an-action="federation">FEDERATION</button></div></section>`}
function renderForeground(scene){
 const logo=system==='fellowfare'?`<div class="cw-fellowfare-brand"><img src="${cfg.logo}" alt=""><strong>FELLOWFARE</strong></div>`:system==='cerbanimo'?`<img class="cw-district-logo cerbanimo" src="${cfg.logo}" alt="Cerbanimo">`:`<img class="cw-district-logo ${system}" src="${cfg.logo}" alt="${cfg.name}">`;
 const ga=guideAsset(scene);const guide=`<div class="cw-guide-frame ${cfg.guideClass}${ga.sprite?' sprite':''}"><img ${ga.sprite?'class="cw-pose-sprite"':''} style="--pose-index:${ga.index}" src="${ga.src}" alt="${cfg.guideClass}"></div>`;
 layer.innerHTML=`${logo}${guide}<div class="cw-object-hotspots"></div>${scene.board&&!surfaceKind?boardMarkup():''}<section class="cw-inworld-surface" hidden></section>`;
 renderSpots(scene);
 layer.querySelectorAll('[data-an-action]').forEach(b=>b.onclick=()=>openSurface(b.dataset.anAction));
}
function setScene(id,{surface=''}={}){if(!cfg.scenes[id])id=cfg.home;sceneId=id;surfaceKind=surface;const scene=cfg.scenes[id];stage.dataset.scene=id;stage.classList.remove('ready');backdrop.src=scene.src;art.onload=()=>{stage.classList.add('ready');fitFrame()};art.onerror=()=>stage.querySelector('.cw-loading').textContent='This local scene asset could not be opened.';art.src=scene.src;renderForeground(scene);if(surface)openSurface(surface,true);const st=read();st.scene=id;write(st)}
function panel(title,body,actions=''){const node=layer.querySelector('.cw-inworld-surface');node.hidden=false;node.innerHTML=`<header><div><small>${safe(cfg.name)}</small><h2>${safe(title)}</h2></div><button data-close aria-label="Close">×</button></header><div class="cw-surface-body">${body}</div>${actions}`;node.querySelector('[data-close]').onclick=()=>{surfaceKind='';node.hidden=true;if(system==='anarchadia'&&sceneId==='commons')renderForeground(cfg.scenes[sceneId])};return node}
function saveSubmission(type,data){const key=`civweave.${system}.${type}.v1`;let list=[];try{list=JSON.parse(localStorage.getItem(key)||'[]')}catch{}list.unshift({...data,id:crypto.randomUUID(),createdAt:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(list.slice(0,100)));dispatchEvent(new CustomEvent(`civweave:${system}:${type}`,{detail:list[0]}))}
function openSurface(kind,fromScene=false){surfaceKind=kind;
 if(system==='anarchadia'){
  const map={feature:['proposal','Feature Request'],bug:['proposal','Bug Report'],hub:['assembly','Community Hub'],federation:['federation','Federation Engine']};const [scene,title]=map[kind]||['control','Merlin’s Control Room'];if(!fromScene&&sceneId!==scene){setScene(scene,{surface:kind});return}
  if(kind==='feature'||kind==='bug'){const n=panel(title,`<form class="cw-zine-form"><label>What should change?<textarea name="summary" required placeholder="Name the need clearly…"></textarea></label><label>Why does it matter?<textarea name="reason" placeholder="Who is affected, what is blocked, and what would better look like?"></textarea></label><label>Evidence or context<input name="evidence" placeholder="Optional link, room, intention, or observation"></label><button type="submit">Pin to the Commons board</button></form>`);n.querySelector('form').onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));saveSubmission(kind,data);n.querySelector('.cw-surface-body').innerHTML='<div class="cw-success-card"><strong>Posted locally.</strong><p>Merlin added it to the review queue without silently approving or executing anything.</p></div>'};return}
  if(kind==='hub'){panel(title,`<div class="cw-card-grid"><button data-go="assembly">Open discussion floor</button><button data-go="consent">Review consent and objections</button><button data-go="control">Talk with Merlin</button><button data-go="commons">Return to Commons board</button></div>`).querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>setScene(b.dataset.go));return}
  panel(title,`<div class="cw-card-grid"><button data-go="control">Automation controls</button><button data-go="consent">Approval gates</button><button data-go="assembly">Dependencies and conflict map</button><button data-go="commons">Back to Commons</button></div>`).querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>setScene(b.dataset.go));return
 }
 if(system==='fellowfare'){
  if(kind==='listing'){const n=panel('Post a need or offer',`<form class="cw-zine-form"><label>Type<select name="type"><option>Need</option><option>Offer</option><option>Trade</option></select></label><label>What is moving?<textarea name="summary" required></textarea></label><label>Fair edges<input name="terms" placeholder="Timing, condition, exchange, or free"></label><button type="submit">Post locally</button></form>`);n.querySelector('form').onsubmit=e=>{e.preventDefault();saveSubmission('listing',Object.fromEntries(new FormData(e.currentTarget)));n.querySelector('.cw-surface-body').innerHTML='<div class="cw-success-card"><strong>Rook logged it.</strong><p>The listing is stored locally and ready for the marketplace bridge.</p></div>'};return}
  if(kind==='exchange-board'||kind==='ledger'){panel(kind==='ledger'?'Exchange ledger':'Exchange board',`<div class="cw-card-grid"><button data-act="listing">Post need or offer</button><button data-go="market">Browse marketplace</button><button data-go="makers">Makers arcade</button><button data-go="resource">Resource center</button></div>`).querySelectorAll('button').forEach(b=>b.onclick=()=>b.dataset.act?openSurface(b.dataset.act):setScene(b.dataset.go));return}
  if(kind==='rook-chat'){compass();return}
 }
 if(system==='living'){
  if(kind==='moss-chat'){compass();return}
 }
 if(system==='cerbanimo'&&kind==='kamiya-chat'){compass();return}
 panel('Scene controls','<p>This illustrated object is wired and ready for its full in-world surface.</p>')
}
function toggleInfo(){document.querySelector('.cw-district-info').hidden=!document.querySelector('.cw-district-info').hidden}
function markup(){return `<section class="cw-recovery-stage" data-system="${system}"><img class="cw-scene-backdrop" alt=""><div class="cw-art-frame"><img class="cw-recovery-art" alt="${cfg.name} visual scene"><div class="cw-scene-layer"></div></div><div class="cw-loading">Loading local ${cfg.name} scene…</div><button class="cw-civweave-return" aria-label="Return to Civweave"><img src="${R('ui-icons/back.svg')}" alt=""></button><nav class="cw-district-controls"><button data-info aria-label="Scene information"><span>i</span></button><button data-compass aria-label="Weaveling Compass"><img src="${icon.compass}" alt=""></button><button data-settings aria-label="Civweave settings"><img src="${icon.settings}" alt=""></button></nav><nav class="cw-district-dock"><button data-home aria-label="${cfg.name} home"><img src="${icon.home}" alt=""></button><button data-route aria-label="Realm route"><img src="${icon.route}" alt=""></button><button data-civweave aria-label="Civweave home"><img src="${R('logos/civweave-icon-96.png')}" alt=""></button><button data-realms aria-label="Realm map"><img src="${icon.realms}" alt=""></button><button data-compass aria-label="Weaveling Compass"><img src="${icon.compass}" alt=""></button></nav></section><aside class="cw-district-info" hidden><button aria-label="Close">×</button><small>CIVWEAVE v${VERSION}</small><strong>${cfg.name}</strong><p>The image is the interface. Object-shaped hotspots follow the artwork, while Civweave alone owns installation, caching, models, and updates.</p><span>Top Compass: site-wide AI</span><span>Center dock sigil: return to the Quad</span><span>Home: return to this realm’s main room</span></aside>`}
function mount(){if(document.querySelector('.cw-recovery-stage'))return;document.documentElement.classList.add('cw-lean-visual-shell',`cw-system-${system}`);document.title=`Civweave Pocket Campus · ${cfg.name}`;document.body.insertAdjacentHTML('beforeend',markup());stage=document.querySelector('.cw-recovery-stage');frame=stage.querySelector('.cw-art-frame');art=stage.querySelector('.cw-recovery-art');backdrop=stage.querySelector('.cw-scene-backdrop');layer=stage.querySelector('.cw-scene-layer');stage.querySelector('.cw-civweave-return').onclick=()=>civweave();stage.querySelectorAll('[data-compass]').forEach(b=>b.onclick=compass);stage.querySelector('[data-settings]').onclick=settings;stage.querySelector('[data-info]').onclick=toggleInfo;stage.querySelector('[data-home]').onclick=()=>setScene(cfg.home);stage.querySelector('[data-civweave]').onclick=()=>civweave();stage.querySelector('[data-realms]').onclick=()=>civweave('?open=map');stage.querySelector('[data-route]').onclick=()=>openSurface(system==='anarchadia'?'hub':system==='fellowfare'?'exchange-board':system==='living'?'moss-chat':'kamiya-chat');document.querySelector('.cw-district-info>button').onclick=toggleInfo;addEventListener('resize',fitFrame,{passive:true});setScene(read().scene||cfg.home);unifyWorker()}
const observer=new MutationObserver(()=>{removeLegacy();if(!document.querySelector('.cw-recovery-stage'))mount()});observer.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{removeLegacy();mount()},{once:true});else{removeLegacy();mount()}
})();
