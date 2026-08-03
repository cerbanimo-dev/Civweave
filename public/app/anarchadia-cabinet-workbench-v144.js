(()=>{
'use strict';
const WORKBENCH='/app/services/anarchadia/workbench.html?cabinet=1';
const ROUTES=[
  ['Governance overview','Inspect the complete local civic workspace.','overview'],
  ['Charter editor','Draft, version, compare, and amend charter text.','charter'],
  ['Proposal deliberation','Open proposals, outcomes, dissent, and discussion records.','proposals'],
  ['Rights & safeguards','Manage rights, roles, data boundaries, threats, and offline paths.','safeguards'],
  ['Exchange, restore & fork','Build selective bundles, restore conflicts, export, or fork.','exchange'],
  ['Constitutional AI','Use bounded drafting, rights scans, comparisons, and threat questions.','ai'],
  ['Readiness & emergency brake','Inspect evidence gates and blocking conditions.','readiness'],
  ['Source constitution','Read the provisional constitutional source and principles.','constitution']
];
let queued=false;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function open(route='workbench'){location.assign(`${WORKBENCH}#${encodeURIComponent(route)}`)}
function configureFeature(button,route,description){button.classList.remove('is-coming');button.removeAttribute('data-ch142-coming');button.setAttribute('data-anarchadia-workbench',route);button.querySelector('small').textContent=description;button.querySelector('em').textContent='Open'}
function mountFeatureGroup(){
  const menu=document.querySelector('.ch142-feature-menu');if(!menu)return;
  for(const button of menu.querySelectorAll('.ch142-feature')){
    const label=button.querySelector('b')?.textContent?.trim();
    if(label==='Federation hall')configureFeature(button,'exchange','Open bridge contracts, bounded federation records, selective exchange, and hub-scoped adoption tools.');
    if(label==='Assembly archive')configureFeature(button,'constitution','Open the charter, amendment history, constitutional source, and preserved civic record classes.');
  }
  if(menu.querySelector('[data-anarchadia-workbench-group]'))return;
  const section=document.createElement('section');section.className='ch142-feature-group';section.dataset.anarchadiaWorkbenchGroup='v144';
  section.innerHTML=`<h3>Governance workbench</h3>${ROUTES.map(([label,description,route])=>`<button type="button" class="ch142-feature" data-anarchadia-workbench="${esc(route)}"><span><b>${esc(label)}</b><small>${esc(description)}</small></span><em>Open</em></button>`).join('')}`;
  menu.append(section);
}
function mountConsoleModule(){
  const grid=document.querySelector('.ac-grid');if(!grid||grid.querySelector('[data-anarchadia-workbench="workbench"]'))return;
  const button=document.createElement('button');button.className='ac-module is-pink';button.type='button';button.dataset.anarchadiaWorkbench='workbench';button.innerHTML='<span class="ac-icon">Ⓐ</span><span><b>GOVERNANCE WORKBENCH</b><small>Charter, safeguards, dissent, exchange, and readiness.</small></span><i>›</i>';grid.append(button);
}
function mountCivicLinks(){
  const surface=document.querySelector('.cw143-civic');if(!surface||surface.querySelector('[data-anarchadia-workbench-links]'))return;
  const links=document.createElement('div');links.className='cw143-actions';links.dataset.anarchadiaWorkbenchLinks='v144';
  links.innerHTML='<button type="button" data-anarchadia-workbench="workbench">Open governance workbench</button><button type="button" data-anarchadia-workbench="proposals">Deliberate proposals</button><button type="button" data-anarchadia-workbench="readiness">Check civic readiness</button>';
  surface.append(links);
}
function mount(){mountFeatureGroup();mountConsoleModule();mountCivicLinks()}
function queue(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;mount()})}
document.addEventListener('click',event=>{
  const workbench=event.target.closest('[data-anarchadia-workbench]');
  if(workbench){event.preventDefault();event.stopImmediatePropagation();open(workbench.dataset.anarchadiaWorkbench||'workbench');return}
  if(event.target.closest('[data-action="vote-hub"]')){event.preventDefault();event.stopImmediatePropagation();open('proposals')}
},true);
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('DOMContentLoaded',queue,{once:true});queue();
globalThis.AnarchadiaCabinetWorkbenchV144={open,mount};
})();
