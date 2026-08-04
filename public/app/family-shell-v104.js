(()=>{
'use strict';
const VERSION='1.0.4';
const SYSTEMS={
  commonweave:{label:'Commonweave',guide:'Weaveling',url:'/loom/?cabinet=1',keys:['commonweave.intentions.v127']},
  'living-school':{label:'Living School',guide:'Moss',url:'/app/cabinets/living-school/index.html?cabinet=1',keys:['commonweave.living-school.intake.v152','living-school.cabinet.v151']},
  cerbanimo:{label:'Cerbanimo',guide:'Kamiya',url:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1',keys:['commonweave.cerbanimo.quest-queue.v1','commonweave.realm-console.v140']},
  fellowfare:{label:'FellowFare',guide:'Rook',url:'/app/fellowfare-cabinet-v144.html?cabinet=1',keys:['commonweave.fellowfare.resource-queue.v152','fellowfare.mvp.state.v3']},
  anarchadia:{label:'Anarchadia',guide:'Merlin',url:'/app/anarchadia-console-v139.html?cabinet=1',keys:['commonweave.anarchadia.passport.v152','anarchadia.citizen-console.v139']}
};
const parse=(value,fallback)=>{try{const out=JSON.parse(value);return out==null?fallback:out}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function detect(){
  const query=new URLSearchParams(location.search).get('system');
  if(SYSTEMS[query])return query;
  const path=location.pathname;
  if(document.documentElement.hasAttribute('data-living-school-cabinet')||path.includes('/cabinets/living-school'))return'living-school';
  if(path.includes('fellowfare'))return'fellowfare';
  if(path.includes('anarchadia'))return'anarchadia';
  if(path.includes('realm-console'))return'cerbanimo';
  return'commonweave';
}
function list(key){const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]}
function status(system){
  if(system==='commonweave'){
    const plans=list('commonweave.intentions.v127').filter(item=>item?.kind==='weave-plan');
    const review=plans.filter(item=>item.state==='review').length,active=plans.filter(item=>item.state==='active'||item.plan?.state==='active').length;
    return{count:review,state:review?'attention':active?'active':'ready',label:review?'Review':active?'Active':'Ready'};
  }
  if(system==='living-school'){
    const intake=list('commonweave.living-school.intake.v152'),native=parse(localStorage.getItem('living-school.cabinet.v151'),{}),active=intake.filter(item=>item?.state!=='complete').length;
    return{count:active,state:active?'attention':native?.activePathId?'active':'ready',label:active?'Path due':native?.activePathId?'Learning':'Ready'};
  }
  if(system==='cerbanimo'){
    const queue=list('commonweave.cerbanimo.quest-queue.v1'),native=parse(localStorage.getItem('commonweave.realm-console.v140'),{}),active=queue.filter(item=>!['complete','accepted'].includes(item?.state)).length;
    return{count:active,state:active?'attention':native?.active?.cerbanimo?'active':'ready',label:active?'Quest due':native?.active?.cerbanimo?'Building':'Ready'};
  }
  if(system==='fellowfare'){
    const queue=list('commonweave.fellowfare.resource-queue.v152'),native=parse(localStorage.getItem('fellowfare.mvp.state.v3'),{}),active=queue.filter(item=>!['fulfilled','closed'].includes(item?.state)).length;
    return{count:active,state:active?'attention':Array.isArray(native?.threads)&&native.threads.length?'active':'ready',label:active?'Need open':native?.threads?.length?'Exchange':'Ready'};
  }
  const passport=parse(localStorage.getItem('commonweave.anarchadia.passport.v152'),{}),native=parse(localStorage.getItem('anarchadia.citizen-console.v139'),{}),count=Array.isArray(native?.proposals)?native.proposals.filter(item=>item?.state==='open').length:0;
  return{count,state:count?'attention':passport?.activeIntentionId?'active':'ready',label:count?'Vote due':passport?.activeIntentionId?'Governing':'Ready'};
}
function loadCss(href){if([...document.styleSheets].some(sheet=>sheet.href?.includes(href)))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link)}
function loadScript(src){return new Promise((resolve,reject)=>{if([...document.scripts].some(script=>script.src?.includes(src)))return resolve();const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error(`Could not load ${src}`));document.head.append(script)})}
async function openSettings(){
  try{
    loadCss('/app/model-settings-v133.css?v=1.0.4');
    if(!globalThis.CommonweaveModelRuntime)await loadScript('/app/shared/commonweave-model-runtime.js?v=1.0.4');
    if(!globalThis.CommonweaveReflexRuntime)await loadScript('/app/minilm-reflex-runtime-v138.js?v=1.0.4');
    if(!globalThis.CommonweaveModelSettingsV133)await loadScript('/app/minilm-model-settings-v138.js?v=1.0.4');
    globalThis.CommonweaveModelSettingsV133?.open?.();
  }catch(error){console.error('[Commonweave family] AI settings failed to open',error);alert(`AI settings could not open: ${error.message}`)}
}
function openChat(system){
  if(globalThis.CommonweaveGuideChatV153?.open)return globalThis.CommonweaveGuideChatV153.open(system);
  document.getElementById('gc153-launcher')?.click();
}
function route(system){const target=SYSTEMS[system];if(target)location.assign(target.url)}
function build(){
  const current=detect(),item=SYSTEMS[current];
  document.documentElement.classList.add('cwf104-active');
  document.documentElement.dataset.commonweaveSystem=current;
  let head=document.getElementById('cwf104-head');
  if(!head){head=document.createElement('header');head.id='cwf104-head';head.className='cwf104-head';document.body.append(head)}
  head.innerHTML=`<div class="cwf104-title"><small>CABINET MODE · <span class="cwf104-version">v${VERSION}</span></small><b>${esc(item.label)}</b></div><div class="cwf104-head-state"><i class="cwf104-dot"></i><span data-cwf-current-state>Ready</span></div><button type="button" data-cwf-chat>Talk to ${esc(item.guide)}</button><button type="button" data-cwf-settings>AI settings</button>`;
  head.querySelector('[data-cwf-chat]').onclick=()=>openChat(current);
  head.querySelector('[data-cwf-settings]').onclick=openSettings;
  let tray=document.getElementById('cwf104-tray');
  if(!tray){tray=document.createElement('nav');tray.id='cwf104-tray';tray.className='cwf104-tray';tray.setAttribute('aria-label','Travel between Commonweave systems');document.body.append(tray)}
  tray.innerHTML=Object.entries(SYSTEMS).filter(([id])=>id!==current).map(([id,system])=>`<a class="cwf104-system" data-cwf-system="${id}" href="${system.url}"><b class="cwf104-badge" data-cwf-badge hidden>0</b><span class="cwf104-system-label">${esc(system.label)}</span><span class="cwf104-system-meta"><i class="cwf104-dot"></i><span data-cwf-state>Ready</span></span></a>`).join('');
  document.addEventListener('click',event=>{
    const hotspot=event.target.closest?.('[data-realm]');
    if(hotspot&&SYSTEMS[hotspot.dataset.realm]){event.preventDefault();event.stopImmediatePropagation();route(hotspot.dataset.realm);return}
    const direct=event.target.closest?.('[data-cwf-system]');
    if(direct){event.preventDefault();route(direct.dataset.cwfSystem)}
  },true);
  refresh();
}
function refresh(){
  const current=detect(),currentState=status(current),head=document.getElementById('cwf104-head');
  if(head){head.classList.remove('is-ready','is-attention','is-active');head.classList.add(`is-${currentState.state}`);const label=head.querySelector('[data-cwf-current-state]');if(label)label.textContent=currentState.label}
  document.querySelectorAll('[data-cwf-system]').forEach(node=>{const value=status(node.dataset.cwfSystem);node.classList.remove('is-ready','is-attention','is-active');node.classList.add(`is-${value.state}`);const label=node.querySelector('[data-cwf-state]');if(label)label.textContent=value.label;const badge=node.querySelector('[data-cwf-badge]');if(badge){badge.textContent=String(value.count);badge.hidden=!value.count}})
}
function boot(){loadCss('/app/family-shell-v104.css?v=1.0.4');build();setInterval(refresh,2500);addEventListener('storage',refresh);addEventListener('commonweave:intentions-changed',refresh)}
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
globalThis.CommonweaveFamilyShellV104={version:VERSION,systems:SYSTEMS,detect,status,route,refresh,openSettings,openChat};
})();