(()=>{
'use strict';
const TARGET='/app/anarchadia-sovereignty-v146.html';
let queued=false;
function open(){location.assign(TARGET)}
function mountCitizenModule(){const grid=document.querySelector('.ac-grid');if(!grid||grid.querySelector('[data-as146-open]'))return;const button=document.createElement('button');button.type='button';button.className='ac-module is-lime';button.dataset.as146Open='';button.innerHTML='<span class="ac-icon">⌘</span><span><b>LOCAL SOVEREIGNTY</b><small>Preview and adopt preferences across every realm. Fork the rails deliberately.</small></span><i>›</i>';grid.append(button)}
function mountFeatures(){const menu=document.querySelector('.ch142-feature-menu');if(!menu||menu.querySelector('[data-as146-feature-group]'))return;const section=document.createElement('section');section.className='ch142-feature-group';section.dataset.as146FeatureGroup='v146';section.innerHTML='<h3>Local sovereignty</h3><button type="button" class="ch142-feature" data-as146-open><span><b>Device preferences & local forks</b><small>Change any installed realm locally, preview it, preserve compatibility, or cross the rails with an explicit fork declaration.</small></span><em>Open</em></button>';menu.append(section)}
function mountGovernanceLink(){if(!document.documentElement.hasAttribute('data-anarchadia-governance'))return;const header=document.querySelector('.ag-top');if(!header||header.querySelector('[data-as146-open]'))return;const button=document.createElement('button');button.type='button';button.dataset.as146Open='';button.textContent='Local sovereignty';header.append(button)}
function mount(){mountCitizenModule();mountFeatures();mountGovernanceLink()}
function queue(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;mount()})}
document.addEventListener('click',event=>{const target=event.target.closest('[data-as146-open]');if(!target)return;event.preventDefault();event.stopImmediatePropagation();open()},true);
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});addEventListener('DOMContentLoaded',queue,{once:true});queue();globalThis.AnarchadiaLocalSovereigntyBridgeV146={open,mount};
})();
