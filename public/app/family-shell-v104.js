(()=>{
'use strict';
const VERSION='1.0.4';
const STATUS_KEY='commonweave.family-status.v105';
const SYSTEM_ORDER=['commonweave','living-school','cerbanimo','fellowfare','anarchadia'];
const SYSTEMS={
  commonweave:{label:'Commonweave',place:'Intention Loom',guide:'Weaveling',site:'/app/realm-console-v140.html?system=commonweave&cabinet=1',artifact:'/app/assets/ai/weaveling-compass.png',avatar:'/app/assets/ai/weaveling.png'},
  'living-school':{label:'Living School',place:'Learning Map',guide:'Moss',site:'/app/cabinets/living-school/index.html?cabinet=1',artifact:'/app/assets/ai/moss-acorn.png',avatar:'/app/assets/ai/moss.png'},
  cerbanimo:{label:'Cerbanimo',place:'Quest Console',guide:'Kamiya',site:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1',artifact:'/app/assets/ai/kamiya-gift.png',avatar:'/app/assets/ai/kamiya.png'},
  fellowfare:{label:'FellowFare',place:'Exchange Workbench',guide:'Rook',site:'/app/fellowfare-cabinet-v144.html?cabinet=1',artifact:'/app/assets/ai/rook-coin-button.png',avatar:'/app/assets/ai/rook.png'},
  anarchadia:{label:'Anarchadia',place:'Citizen Console',guide:'Merlin',site:'/app/anarchadia-console-v139.html?cabinet=1',artifact:'/app/assets/ai/merlin-hat.png',avatar:'/app/assets/ai/merlin.png'}
};
const parse=(value,fallback)=>{try{const out=JSON.parse(value);return out==null?fallback:out}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const array=key=>{const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]};
const object=key=>{const value=parse(localStorage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}};
const timestamp=item=>Date.parse(item?.updatedAt||item?.createdAt||item?.time||item?.at||item?.savedAt||0)||0;
const nonSeedFellowFare=item=>!/^([tmp]|pr|ag|a|c|ev)[1-9]\d*$/.test(String(item?.id||''));
function detect(){const query=new URLSearchParams(location.search).get('system');if(SYSTEMS[query])return query;if(document.documentElement.hasAttribute('data-living-school-cabinet')||location.pathname.includes('/cabinets/living-school/'))return'living-school';if(location.pathname.includes('fellowfare'))return'fellowfare';if(location.pathname.includes('anarchadia'))return'anarchadia';return'commonweave'}
function readStatusStore(){const store=object(STATUS_KEY);store.visits=store.visits&&typeof store.visits==='object'?store.visits:{};return store}
function seedVisits(){const store=readStatusStore();if(!Object.keys(store.visits).length){const at=Date.now();for(const id of SYSTEM_ORDER)store.visits[id]=at;localStorage.setItem(STATUS_KEY,JSON.stringify(store))}return store}
function markVisited(system){const store=seedVisits();store.visits[system]=Date.now();localStorage.setItem(STATUS_KEY,JSON.stringify(store))}
function actionable(system){
  if(system==='commonweave')return array('commonweave.intentions.v127').filter(item=>item?.kind==='weave-plan'&&(item.state==='review'||item.plan?.state==='review'));
  if(system==='living-school')return array('commonweave.living-school.intake.v152').filter(item=>['ready','review'].includes(item?.status||item?.state));
  if(system==='cerbanimo')return [...array('commonweave.cerbanimo.quest-queue.v1').filter(item=>['review','ready','blocked'].includes(item?.state)),...array('commonweave.realm-actions.v141').filter(item=>item?.system==='cerbanimo'&&['clarifying','review'].includes(item?.state))];
  if(system==='fellowfare'){const native=object('fellowfare.mvp.state.v3'),messages=Array.isArray(native.messages)?native.messages.filter(item=>item?.read===false&&nonSeedFellowFare(item)):[];return [...array('commonweave.fellowfare.resource-queue.v152').filter(item=>['review','ready','blocked'].includes(item?.status||item?.state)),...array('commonweave.fellowfare.pending-threads.v1').filter(item=>['draft','review'].includes(item?.status)),...messages]}
  const native=object('commonweave.anarchadia.citizen-console.v139'),proposals=Array.isArray(native.proposals)?native.proposals.filter(item=>['open','review'].includes(item?.state||item?.status)):[];return [...proposals,...array('commonweave.realm-actions.v141').filter(item=>item?.system==='anarchadia'&&['clarifying','review'].includes(item?.state))]
}
function state(system){const actions=actionable(system);
  if(system==='commonweave'){const active=array('commonweave.intentions.v127').some(item=>item?.state==='active'||item?.plan?.state==='active');return actions.length?{kind:'attention',label:'Review'}:active?{kind:'active',label:'Active'}:{kind:'ready',label:'Ready'}}
  if(system==='living-school'){const school=object('commonweave.living-school.cabinet.v151').school;return actions.length?{kind:'attention',label:'Path ready'}:school?{kind:'active',label:'Learning'}:{kind:'ready',label:'Ready'}}
  if(system==='cerbanimo'){const active=array('commonweave.cerbanimo.quest-queue.v1').some(item=>item?.state==='active')||array('commonweave.realm-actions.v141').some(item=>item?.system==='cerbanimo'&&['active','published'].includes(item?.state));return actions.length?{kind:'attention',label:'Review'}:active?{kind:'active',label:'Active'}:{kind:'ready',label:'Ready'}}
  if(system==='fellowfare'){const native=object('fellowfare.mvp.state.v3'),active=Array.isArray(native.threads)&&native.threads.some(item=>nonSeedFellowFare(item)&&!['closed','fulfilled','cancelled'].includes(item?.status));return actions.length?{kind:'attention',label:'Review'}:active?{kind:'active',label:'Exchange'}:{kind:'ready',label:'Ready'}}
  const passport=object('commonweave.anarchadia.passport.v152');return actions.length?{kind:'attention',label:'Review'}:passport.activeIntentionId?{kind:'active',label:'Active'}:{kind:'ready',label:'Ready'}}
function status(system){const store=seedVisits(),last=Number(store.visits[system]||Date.now()),items=actionable(system),count=items.filter(item=>timestamp(item)>last).length,live=state(system);return{count,state:live.kind,label:live.label,total:items.length}}
function route(system){if(SYSTEMS[system])location.assign(SYSTEMS[system].site)}
async function openChat(system=detect(),prefill=''){return globalThis.CommonweaveFamilyAILoaderV105?.openChat?.('commonweave',{prefill,contextSystem:system})}
async function openSettings(){return globalThis.CommonweaveFamilyAILoaderV105?.openSettings?.()}
function isSettingsControl(target){const explicit=target.closest?.('[data-cwf-settings],[data-action="settings"],#lite-settings,[data-model-settings],[data-ai-settings],[data-capability="commonweave.model-setup"],[data-cw143-settings]');if(explicit)return true;const control=target.closest?.('button,a,[role="button"],summary');return Boolean(control&&/\b(ai settings|model setup|configure ai|configure model|choose the compass mind|model control)\b/i.test(control.textContent||control.getAttribute('aria-label')||''))}
function installMerlinitesStyle(){if(document.querySelector('link[data-merlinites-shell-v166]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/app/merlinites-shell-fix-v166.css?v=merlinites-r2';link.dataset.merlinitesShellV166='';document.head.append(link)}
function build(){
  installMerlinitesStyle();
  const current=detect(),item=SYSTEMS[current];
  seedVisits();markVisited(current);
  document.documentElement.classList.add('cwf104-active');
  document.documentElement.dataset.commonweaveSystem=current;
  document.documentElement.dataset.familyShell='direct';
  document.documentElement.dataset.visualShell='merlinites-r1';
  let head=document.getElementById('cwf104-head');
  if(!head){head=document.createElement('header');head.id='cwf104-head';head.className='cwf104-head';document.body.append(head)}
  head.innerHTML=`<div class="cwf104-realm-mark" aria-hidden="true"><img src="${item.artifact}" alt=""></div><div class="cwf104-title"><small>${esc(item.place)}</small><b>${esc(item.label)}</b></div><div class="cwf104-head-state"><i class="cwf104-dot"></i><span data-cwf-current-state>Ready</span></div><button class="cwf104-chat" type="button" data-cwf-chat aria-label="Talk to Commonweave with Weaveling from ${esc(item.label)}"><img src="${SYSTEMS.commonweave.artifact}" alt=""></button><button class="cwf104-settings" type="button" data-cwf-settings aria-label="Open Commonweave AI settings"><span aria-hidden="true">⚙</span></button>`;
  head.querySelector('[data-cwf-chat]').onclick=()=>openChat(current);
  head.querySelector('[data-cwf-settings]').onclick=openSettings;
  let tray=document.getElementById('cwf104-tray');
  if(!tray){tray=document.createElement('nav');tray.id='cwf104-tray';tray.className='cwf104-tray';tray.setAttribute('aria-label','Travel between Commonweave systems');document.body.append(tray)}
  tray.innerHTML=SYSTEM_ORDER.map(id=>{const system=SYSTEMS[id],active=id===current;return `<a class="cwf104-system${active?' is-current':''}" data-cwf-system="${id}" href="${system.site}"${active?' aria-current="page"':''}><b class="cwf104-badge" data-cwf-badge hidden></b><span class="cwf104-system-art"><img src="${system.artifact}" alt=""></span><span class="cwf104-system-label">${esc(system.label)}</span><span class="cwf104-system-meta"><i class="cwf104-dot"></i><span data-cwf-state>Ready</span></span></a>`}).join('');
  refresh();
}
function refresh(){
  const current=detect(),currentState=status(current),head=document.getElementById('cwf104-head');
  if(head){head.classList.remove('is-ready','is-attention','is-active');head.classList.add(`is-${currentState.state}`);head.querySelector('[data-cwf-current-state]').textContent=currentState.label}
  document.querySelectorAll('[data-cwf-system]').forEach(node=>{const value=status(node.dataset.cwfSystem);node.classList.remove('is-ready','is-attention','is-active');node.classList.add(`is-${value.state}`);node.querySelector('[data-cwf-state]').textContent=value.label;const badge=node.querySelector('[data-cwf-badge]');badge.textContent=String(value.count);badge.hidden=value.count<1})
}
function bind(){document.addEventListener('click',event=>{const target=event.target,nav=target.closest?.('[data-cwf-system]');if(nav){event.preventDefault();const destination=nav.dataset.cwfSystem;if(destination!==detect())route(destination);return}if(target.closest?.('[data-cwf-chat],[data-action="chat"],[data-guide-chat="commonweave"]')){event.preventDefault();event.stopImmediatePropagation();openChat(detect());return}if(isSettingsControl(target)){event.preventDefault();event.stopImmediatePropagation();openSettings()}},true);addEventListener('storage',refresh);addEventListener('focus',refresh);addEventListener('commonweave:intentions-changed',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden){markVisited(detect());refresh()}});document.addEventListener('click',()=>setTimeout(refresh,80),{passive:true});setInterval(refresh,30000)}
function boot(){build();bind();requestAnimationFrame(()=>document.documentElement.dataset.familyReady='true')}
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
globalThis.CommonweaveFamilyShellV104={version:VERSION,systems:SYSTEMS,systemOrder:SYSTEM_ORDER,detect,status,state,actionable,markVisited,route,refresh,openSettings,openChat};
})();
