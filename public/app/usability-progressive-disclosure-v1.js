(()=>{
'use strict';

const VERSION='1.0.1-usability-progressive-disclosure-v1';
const WORKING_KEY='civweave.working-campus.v1';
const INTENTIONS_KEY='civweave.intentions.v127';
const STYLE_ID='cw-usability-progressive-disclosure-v1-style';
if(globalThis.CivweaveProgressiveDisclosureV1?.version===VERSION)return;

const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const text=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
const q=(selector,root=document)=>root?.querySelector?.(selector)||null;
const qa=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
const escaped=value=>globalThis.CSS?.escape?CSS.escape(String(value)):String(value).replace(/[^a-zA-Z0-9_-]/g,'\\$&');
let queued=false,observer=null,patching=false;

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
.cw-pd-details{display:block;width:100%;margin:10px 0;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:14px;background:color-mix(in srgb,currentColor 3%,transparent);overflow:hidden}
.cw-pd-details>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:10px 12px;cursor:pointer;font:800 12px/1.25 system-ui,sans-serif;letter-spacing:.02em}
.cw-pd-details>summary::-webkit-details-marker{display:none}.cw-pd-details>summary::after{content:'+';font-size:19px;font-weight:700;opacity:.72}.cw-pd-details[open]>summary::after{content:'−'}
.cw-pd-summary-copy{display:grid;gap:2px}.cw-pd-summary-copy small{font-size:9px;letter-spacing:.09em;text-transform:uppercase;opacity:.66}.cw-pd-summary-copy strong{font-size:13px}
.cw-pd-details>.cw-pd-body{padding:0 10px 10px}.cw-pd-details>.cw-pd-body>:first-child{margin-top:0}.cw-pd-details>.cw-pd-body>:last-child{margin-bottom:0}
.cw-pd-installer-disclosure{max-width:1180px;margin:14px auto}.cw-pd-installer-disclosure>.cw-pd-body{padding:0}.cw-pd-installer-disclosure>.cw-pd-body>.knowledge-card,.cw-pd-installer-disclosure>.cw-pd-body>.gateway-grid,.cw-pd-installer-disclosure>.cw-pd-body>.status-card{margin:0!important;border:0!important;border-radius:0 0 14px 14px!important;box-shadow:none!important}
.cw-pd-campus-disclosure{max-width:1180px;margin:8px auto}.cw-pd-campus-disclosure>.cw-pd-body{padding:0}.cw-pd-campus-disclosure .campus{margin:0!important;padding:8px}
.guide .cw-pd-guide-toggle{margin-left:auto;min-height:34px;padding:6px 9px;border:1px solid #ffffff24;border-radius:9px;background:#ffffff0b;color:inherit;font:800 11px/1 system-ui,sans-serif}
body[data-cw-pd-stage="active"] .main{grid-template-columns:minmax(0,1fr)!important}body[data-cw-pd-stage="active"] .work{order:1}body[data-cw-pd-stage="active"] .guide{order:2}
body[data-cw-pd-stage="active"] .guide.cw-pd-collapsible:not(.cw-pd-open) .conversation,body[data-cw-pd-stage="active"] .guide.cw-pd-collapsible:not(.cw-pd-open) .weaveling-chat-form,body[data-cw-pd-stage="active"] .guide.cw-pd-collapsible:not(.cw-pd-open) .cw-pd-details[data-cw-pd-id="civweave-guide-options"]{display:none!important}
body[data-cw-pd-stage="active"] .guide.cw-pd-collapsible:not(.cw-pd-open) .guide-head{border-bottom:0!important}.cw-pd-guide-toggle[aria-expanded="true"]{background:#8af5d21a;border-color:#8af5d266}
.cw-pd-profile-more>.cw-pd-body{display:grid;gap:10px}.cw-pd-profile-more .field{width:100%}.cw-pd-profile-more .field.full{grid-column:auto!important}
.lsc218-root .cw-pd-details{border-color:#65d49238;background:#0c1f1788}.lsc218-root .cw-pd-details>summary{color:#e8f7e6}.lsc218-root .cw-pd-details>.cw-pd-body{padding:0 12px 12px}.lsc218-root .cw-pd-details>.cw-pd-body>.lsc218-panel,.lsc218-root .cw-pd-details>.cw-pd-body>.lsc218-content-block{margin:0!important;border:0!important;box-shadow:none!important}
.rc-app .cw-pd-details{border-color:#ffffff20}.rc-app .cw-pd-details>.cw-pd-body{padding:0}.rc-app .cw-pd-details>.cw-pd-body>.rc-hero,.rc-app .cw-pd-details>.cw-pd-body>.rc-summary{margin:0!important;border:0!important;border-radius:0!important}
.ac-passport>.cw-pd-details{margin:12px 0;border-color:#ffffff24}.ac-passport>.cw-pd-details>.cw-pd-body{padding:8px 10px 12px}.ac-passport>.cw-pd-details>.cw-pd-body>*{margin-top:10px!important}.cw-pd-civic-primary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}.cw-pd-civic-primary .ac-module{width:100%}.ac-display>.cw-pd-details>.cw-pd-body{padding:8px 10px 12px}.ac-display>.cw-pd-details>.cw-pd-body>.ac-grid{margin:0!important}
@media(max-width:700px){.cw-pd-civic-primary{grid-template-columns:1fr}.cw-pd-details>summary{min-height:42px;padding:9px 10px}.cw-pd-campus-disclosure{margin-left:0;margin-right:0}}
`;
  document.head?.append(style);
}

function summaryMarkup(kicker,label){
  const span=document.createElement('span');
  span.className='cw-pd-summary-copy';
  const small=document.createElement('small');small.textContent=kicker||'More';
  const strong=document.createElement('strong');strong.textContent=label||'Details';
  span.append(small,strong);
  return span;
}
function wrapperFor(id){return q(`details[data-cw-pd-id="${escaped(id)}"]`)}
function wrap(node,{id,label,kicker='Optional',open=false,className='',forceOpen=false}={}){
  if(!node?.parentNode||!id)return null;
  const parent=node.closest?.(`details[data-cw-pd-id="${escaped(id)}"]`);
  if(parent){if(forceOpen)parent.open=true;return parent}
  const existing=wrapperFor(id);
  if(existing){if(!existing.contains(node))q('.cw-pd-body',existing)?.append(node);if(forceOpen)existing.open=true;return existing}
  const details=document.createElement('details');
  details.className=`cw-pd-details ${className}`.trim();
  details.dataset.cwPdId=id;
  details.open=Boolean(open);
  const summary=document.createElement('summary');summary.append(summaryMarkup(kicker,label));
  const body=document.createElement('div');body.className='cw-pd-body';
  node.parentNode.insertBefore(details,node);details.append(summary,body);body.append(node);
  return details;
}
function group(nodes,{id,label,kicker='Optional',open=false,className='',before=null}={}){
  const list=nodes.filter(node=>node?.isConnected);
  if(!list.length)return null;
  let details=wrapperFor(id);
  if(!details){
    details=document.createElement('details');details.className=`cw-pd-details ${className}`.trim();details.dataset.cwPdId=id;details.open=Boolean(open);
    const summary=document.createElement('summary');summary.append(summaryMarkup(kicker,label));
    const body=document.createElement('div');body.className='cw-pd-body';details.append(summary,body);
    const anchor=before?.isConnected?before:list[0];anchor.parentNode.insertBefore(details,anchor);
  }
  const body=q('.cw-pd-body',details);for(const node of list)if(node.parentNode!==body)body.append(node);
  return details;
}
function currentSystem(){
  const data=document.documentElement?.dataset||{},path=location.pathname;
  if(document.body?.classList.contains('cw-installer')||path==='/app/index.html')return'installer';
  if(data.civweaveSystem)return data.civweaveSystem;
  if(path.includes('/cabinets/living-school/'))return'living-school';
  if(path.includes('fellowfare'))return'fellowfare';
  if(path.includes('anarchadia'))return'anarchadia';
  if(path.includes('realm-console-v140'))return new URLSearchParams(location.search).get('system')||'cerbanimo';
  if(path.includes('working-campus'))return'civweave';
  return'';
}
function workingState(){try{return parse(localStorage.getItem(WORKING_KEY),{})}catch{return{}}}
function savedWeaves(){try{return parse(localStorage.getItem(INTENTIONS_KEY),[]).filter?.(item=>item?.kind==='weave-plan')||[]}catch{return[]}}

function syncInstaller(){
  document.body?.classList.add('cw-pd-installer');
  const technical=q('.quest-technical'),release=q('#check-update');
  if(technical&&release&&release.parentNode!==technical){technical.append(release);release.classList.add('cw-pd-release-check')}
  const offline=q('#campus-install-progress');if(offline)wrap(offline,{id:'installer-offline-campus',kicker:'Optional road pack',label:'Add the offline campus',open:false,className:'cw-pd-installer-disclosure'});
  const guildGate=q('[data-civweave-hub-tools-gate]');if(guildGate)wrap(guildGate,{id:'installer-find-guild',kicker:'Optional community path',label:'Find a Guild or recover a Passport',open:false,className:'cw-pd-installer-disclosure'});
  const guild=q('.guild-host-card');if(guild)wrap(guild,{id:'installer-guild-hosting',kicker:'After you enter Civweave',label:'Create or host a Guild',open:false,className:'cw-pd-installer-disclosure'});
  const knowledge=q('.quest-sidepath');if(knowledge)wrap(knowledge,{id:'installer-knowledge',kicker:'Optional offline knowledge',label:'Knowledge Schools and field libraries',open:false,className:'cw-pd-installer-disclosure'});
  const road=q('.quest-road-grid');if(road)wrap(road,{id:'installer-road-ahead',kicker:'Orientation & recovery',label:'What waits beyond the threshold',open:false,className:'cw-pd-installer-disclosure'});
}

function syncWorkingCampus(){
  const state=workingState(),stage=String(state.stage||'wish'),hasPlan=Boolean(state.plan),view=String(state.view||'weave'),pastWish=stage!=='wish';
  document.body.dataset.cwPdStage=stage;
  const campus=q('.campus');
  if(campus&&pastWish){wrap(campus,{id:'civweave-campus',kicker:'Explore when needed',label:'Living School, Cerbanimo, FellowFare & Anarchadia',open:view==='campus',forceOpen:view==='campus',className:'cw-pd-campus-disclosure'})}
  const guide=q('.guide');
  if(guide){
    guide.classList.toggle('cw-pd-collapsible',stage==='active');
    const head=q('.guide-head',guide);
    let toggle=q('.cw-pd-guide-toggle',head);
    if(stage==='active'&&head&&!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='cw-pd-guide-toggle';toggle.textContent='Ask Weaveling';toggle.setAttribute('aria-expanded','false');toggle.addEventListener('click',()=>{const open=guide.classList.toggle('cw-pd-open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Hide Weaveling':'Ask Weaveling'});head.append(toggle)}
    if(stage!=='active'){guide.classList.remove('cw-pd-open');toggle?.remove()}
  }
  const foot=q('.guide-foot');if(foot&&pastWish)wrap(foot,{id:'civweave-guide-options',kicker:'Secondary controls',label:'Guide options, export & support',open:false});
  const progress=q('.bottom [data-view="progress"]'),library=q('.bottom [data-view="library"]');
  if(progress)progress.hidden=!hasPlan;
  if(library)library.hidden=savedWeaves().length===0;
  if(stage==='profile'){
    const grid=q('.workspace .field-grid');
    if(grid&&!q('[data-cw-pd-id="civweave-more-context"]',grid.parentNode)){
      const fields=qa(':scope > .field',grid);
      if(fields.length>2){
        const details=document.createElement('details');details.className='cw-pd-details cw-pd-profile-more';details.dataset.cwPdId='civweave-more-context';
        const summary=document.createElement('summary');summary.append(summaryMarkup('Optional planning detail','More context'));
        const body=document.createElement('div');body.className='cw-pd-body';details.append(summary,body);grid.after(details);fields.slice(2).forEach(field=>body.append(field));
      }
    }
  }
  if(stage==='review'){
    const passport=qa('.workspace .path').find(node=>/passport and consent/i.test(text(q('small',node))));
    if(passport)wrap(passport,{id:'civweave-passport-review',kicker:'Consent & boundaries',label:'Passport layer',open:false});
  }
}

function heading(panel){return text(q('header h2, h2, h3',panel)).toLowerCase()}
function syncLivingSchool(){
  const root=q('#living-school-root');if(!root)return;
  const activeLesson=q('.lsc218-lesson',root),hasCourse=Boolean(activeLesson||q('.lsc218-module-rail',root));
  if(hasCourse){
    for(const panel of qa(':scope > .lsc218-grid .lsc218-panel',root)){
      const h=heading(panel);
      if(h.includes('choose or define the path'))wrap(panel,{id:'living-path-setup',kicker:'Course setup',label:'Path selection',open:false});
      else if(h.includes('research, generate, or revise'))wrap(panel,{id:'living-curriculum-setup',kicker:'Course setup',label:'Research & curriculum settings',open:false});
      else if(h.includes('apply learning in the world'))wrap(panel,{id:'living-practicum',kicker:'When you are ready to apply it',label:'Practicum & Cerbanimo handoff',open:false});
      else if(/sources|research packet|passport|settings/.test(h))wrap(panel,{id:`living-secondary-${h.replace(/[^a-z0-9]+/g,'-').slice(0,40)}`,kicker:'Reference',label:text(q('header h2, h2',panel))||'Details',open:false});
    }
  }
  if(activeLesson){
    for(const block of qa('.lsc218-content-block',activeLesson)){
      const h=heading(block);
      if(h.includes('prerequisites'))wrap(block,{id:'living-module-requirements',kicker:'Reference',label:'Requirements & completion criteria',open:false});
      else if(h.includes('concepts and definitions'))wrap(block,{id:'living-module-concepts',kicker:'Reference',label:'Concepts & definitions',open:false});
      else if(h.includes('completion reward and handoff'))wrap(block,{id:'living-module-reward',kicker:'After completion',label:'Reward & handoff details',open:false});
    }
  }
}

function syncCerbanimo(){
  const app=q('#rc-app');if(!app)return;
  const active=q('.rc-active',app),hero=q('.rc-hero',app),activeTitle=text(q('h2',active));
  const hasActive=Boolean(active&&activeTitle&&!/^no active quest$/i.test(activeTitle));
  if(hasActive&&hero){
    const details=wrap(hero,{id:'cerbanimo-new-quest',kicker:'Secondary while work is active',label:'Start another Quest',open:false});
    if(details&&active.parentNode===details.parentNode&&active.compareDocumentPosition(details)&Node.DOCUMENT_POSITION_PRECEDING)details.parentNode.insertBefore(active,details);
  }
  const summary=q('.rc-summary',app);if(summary)wrap(summary,{id:'cerbanimo-record-summary',kicker:'Reference',label:'Records, capabilities & balances',open:false});
}

function syncAnarchadia(){
  const passport=q('.ac-passport');if(!passport)return;
  const rank=q('.ac-passport-rank',passport),weave=q('.ac-passport-panel.is-weave',passport);
  if(rank&&weave&&weave.parentNode!==passport)rank.after(weave);
  const wallet=q('.ac-passport-wallet',passport),deck=q('.ac-passport-deck',passport),lower=q('.ac-passport-lower',passport),ownership=q('.ac-ownership-strip',passport),legend=q('.ac-passport-legend',passport);
  group([wallet,deck,lower,ownership,legend],{id:'anarchadia-passport-details',kicker:'Reference & receipts',label:'Passport details',open:false});
  const grid=q('.ac-grid');
  if(grid&&!q('.cw-pd-civic-primary')){
    const proposal=q('[data-screen-target="proposals"]',grid),governed=q('[data-ag145-open]',grid);
    if(proposal||governed){const primary=document.createElement('div');primary.className='cw-pd-civic-primary';grid.parentNode.insertBefore(primary,grid);if(proposal)primary.append(proposal);if(governed&&governed!==proposal)primary.append(governed)}
    wrap(grid,{id:'anarchadia-civic-tools',kicker:'Less frequent',label:'More civic tools',open:false});
  }
  const pulse=q('.ac-pulse');if(pulse){const count=Number(text(q('#ac-proposal-count')))||0;wrap(pulse,{id:'anarchadia-civic-pulse',kicker:'Community status',label:'Civic pulse',open:count>0,forceOpen:count>0})}
}

function sync(){
  if(patching)return;patching=true;
  try{
    installStyle();
    const system=currentSystem();
    if(system==='installer')syncInstaller();
    else if(system==='civweave')syncWorkingCampus();
    else if(system==='living-school')syncLivingSchool();
    else if(system==='cerbanimo')syncCerbanimo();
    else if(system==='anarchadia')syncAnarchadia();
    document.documentElement.dataset.civweaveProgressiveDisclosure=VERSION;
  }finally{patching=false}
}
function queueSync(){if(queued||patching)return;queued=true;queueMicrotask(()=>{queued=false;sync()})}
function boot(){
  sync();
  observer=new MutationObserver(records=>{if(records.some(record=>record.addedNodes.length||record.removedNodes.length))queueSync()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('storage',event=>{if([WORKING_KEY,INTENTIONS_KEY].includes(event.key))queueSync()});
  addEventListener('civweave:actions-changed',queueSync);
  addEventListener('civweave:living-school-workbench-ready',queueSync);
}

globalThis.CivweaveProgressiveDisclosureV1=Object.freeze({version:VERSION,sync,queueSync,currentSystem});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
