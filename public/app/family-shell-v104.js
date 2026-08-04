(()=>{
'use strict';
const VERSION='1.0.4';
const HOST='/app/fullscreen-family-v104.html';
const SYSTEMS={
  commonweave:{label:'Commonweave',guide:'Weaveling',site:'/app/realm-console-v140.html?system=commonweave&cabinet=1&embed=1'},
  'living-school':{label:'Living School',guide:'Moss',site:'/app/cabinets/living-school/index.html?cabinet=1&embed=1'},
  cerbanimo:{label:'Cerbanimo',guide:'Kamiya',site:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1&embed=1'},
  fellowfare:{label:'FellowFare',guide:'Rook',site:'/app/fellowfare-cabinet-v144.html?cabinet=1&embed=1'},
  anarchadia:{label:'Anarchadia',guide:'Merlin',site:'/app/anarchadia-console-v139.html?cabinet=1&embed=1'}
};
for(const [id,item] of Object.entries(SYSTEMS))item.url=`${HOST}?system=${encodeURIComponent(id)}`;
const parse=(value,fallback)=>{try{const out=JSON.parse(value);return out==null?fallback:out}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function detect(){const query=new URLSearchParams(location.search).get('system');return SYSTEMS[query]?query:'commonweave'}
function list(key){const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]}
function status(system){
  if(system==='commonweave'){const plans=list('commonweave.intentions.v127').filter(item=>item?.kind==='weave-plan'),review=plans.filter(item=>item.state==='review').length,active=plans.filter(item=>item.state==='active'||item.plan?.state==='active').length;return{count:review,state:review?'attention':active?'active':'ready',label:review?'Review':active?'Active':'Ready'}}
  if(system==='living-school'){const intake=list('commonweave.living-school.intake.v152'),native=parse(localStorage.getItem('living-school.cabinet.v151'),{}),active=intake.filter(item=>item?.state!=='complete').length;return{count:active,state:active?'attention':native?.activePathId?'active':'ready',label:active?'Path due':native?.activePathId?'Learning':'Ready'}}
  if(system==='cerbanimo'){const queue=list('commonweave.cerbanimo.quest-queue.v1'),native=parse(localStorage.getItem('commonweave.realm-console.v140'),{}),active=queue.filter(item=>!['complete','accepted'].includes(item?.state)).length;return{count:active,state:active?'attention':native?.active?.cerbanimo?'active':'ready',label:active?'Quest due':native?.active?.cerbanimo?'Building':'Ready'}}
  if(system==='fellowfare'){const queue=list('commonweave.fellowfare.resource-queue.v152'),native=parse(localStorage.getItem('fellowfare.mvp.state.v3'),{}),active=queue.filter(item=>!['fulfilled','closed'].includes(item?.state)).length;return{count:active,state:active?'attention':Array.isArray(native?.threads)&&native.threads.length?'active':'ready',label:active?'Need open':native?.threads?.length?'Exchange':'Ready'}}
  const passport=parse(localStorage.getItem('commonweave.anarchadia.passport.v152'),{}),native=parse(localStorage.getItem('anarchadia.citizen-console.v139'),{}),count=Array.isArray(native?.proposals)?native.proposals.filter(item=>item?.state==='open').length:0;return{count,state:count?'attention':passport?.activeIntentionId?'active':'ready',label:count?'Vote due':passport?.activeIntentionId?'Governing':'Ready'}
}
function openSettings(){globalThis.CommonweaveModelSettingsV133?.open?.()}
function openChat(system){globalThis.CommonweaveGuideChatV153?.open?.(system)}
function route(system,{replace=false}={}){if(!SYSTEMS[system])return;const url=SYSTEMS[system].url;location[replace?'replace':'assign'](url)}
function childStyle(doc,current){
  const style=doc.createElement('style');style.dataset.cwf104Child='true';style.textContent=`
  html,body{min-height:100%!important}body{padding-bottom:0!important}.gc153-launcher,.cw127-topbar,.cw127-nav{display:none!important}.cw127-app,.ls-app,.rc-app,.ffc144-app,.ac-shell{min-height:100dvh!important;padding-top:0!important;padding-bottom:0!important}.rc-bottom,.ls-tray{bottom:0!important}
  `;doc.head.append(style);doc.documentElement.dataset.fullscreenCabinet=current;
}
function hookChild(frame,current){
  try{
    const doc=frame.contentDocument;if(!doc)return;
    childStyle(doc,current);
    doc.addEventListener('click',event=>{
      const chat=event.target.closest?.('[data-action="chat"],#moss,.ch142-guide,[data-guide-chat]');
      if(chat){event.preventDefault();event.stopImmediatePropagation();openChat(current);return}
      const settings=event.target.closest?.('[data-action="settings"],#lite-settings,[data-model-settings]');
      if(settings){event.preventDefault();event.stopImmediatePropagation();openSettings();return}
      const realm=event.target.closest?.('[data-realm]')?.dataset.realm;
      if(SYSTEMS[realm]){event.preventDefault();event.stopImmediatePropagation();route(realm)}
    },true);
    frame.classList.add('is-ready');
    frame.title=`${SYSTEMS[current].label} cabinet software`;
  }catch(error){console.warn('[Commonweave family] Could not bind child software',error)}
}
function mountFrame(current){const frame=document.getElementById('cwf104-frame');if(!frame)return;frame.addEventListener('load',()=>hookChild(frame,current));frame.src=SYSTEMS[current].site}
function build(){
  const current=detect(),item=SYSTEMS[current];
  document.documentElement.classList.add('cwf104-active');document.documentElement.dataset.commonweaveSystem=current;
  let head=document.getElementById('cwf104-head');if(!head){head=document.createElement('header');head.id='cwf104-head';head.className='cwf104-head';document.body.append(head)}
  head.innerHTML=`<div class="cwf104-title"><small>CABINET MODE · <span class="cwf104-version">v${VERSION}</span></small><b>${esc(item.label)}</b></div><div class="cwf104-head-state"><i class="cwf104-dot"></i><span data-cwf-current-state>Ready</span></div><button type="button" data-cwf-chat>Talk to ${esc(item.guide)}</button><button type="button" data-cwf-settings>AI settings</button>`;
  head.querySelector('[data-cwf-chat]').onclick=()=>openChat(current);head.querySelector('[data-cwf-settings]').onclick=openSettings;
  let tray=document.getElementById('cwf104-tray');if(!tray){tray=document.createElement('nav');tray.id='cwf104-tray';tray.className='cwf104-tray';tray.setAttribute('aria-label','Travel between Commonweave systems');document.body.append(tray)}
  tray.innerHTML=Object.entries(SYSTEMS).filter(([id])=>id!==current).map(([id,system])=>`<a class="cwf104-system" data-cwf-system="${id}" href="${system.url}"><b class="cwf104-badge" data-cwf-badge hidden>0</b><span class="cwf104-system-label">${esc(system.label)}</span><span class="cwf104-system-meta"><i class="cwf104-dot"></i><span data-cwf-state>Ready</span></span></a>`).join('');
  tray.addEventListener('click',event=>{const target=event.target.closest('[data-cwf-system]');if(!target)return;event.preventDefault();route(target.dataset.cwfSystem)});
  mountFrame(current);refresh();
}
function refresh(){const current=detect(),currentState=status(current),head=document.getElementById('cwf104-head');if(head){head.classList.remove('is-ready','is-attention','is-active');head.classList.add(`is-${currentState.state}`);const label=head.querySelector('[data-cwf-current-state]');if(label)label.textContent=currentState.label}document.querySelectorAll('[data-cwf-system]').forEach(node=>{const value=status(node.dataset.cwfSystem);node.classList.remove('is-ready','is-attention','is-active');node.classList.add(`is-${value.state}`);const label=node.querySelector('[data-cwf-state]');if(label)label.textContent=value.label;const badge=node.querySelector('[data-cwf-badge]');if(badge){badge.textContent=String(value.count);badge.hidden=!value.count}})}
function boot(){build();setInterval(refresh,2500);addEventListener('storage',refresh);addEventListener('commonweave:intentions-changed',refresh)}
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
globalThis.CommonweaveFamilyShellV104={version:VERSION,systems:SYSTEMS,detect,status,route,refresh,openSettings,openChat};
})();