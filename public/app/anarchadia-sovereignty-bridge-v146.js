(()=>{
'use strict';
const VERSION='1.0.33-sovereignty-bridge-stable',TARGET='/app/anarchadia-sovereignty-v146.html';
if(globalThis.AnarchadiaLocalSovereigntyBridgeV146?.version===VERSION)return;let attempts=0,timer=0;
function open(){location.assign(TARGET)}
function mountCitizenModule(){const grid=document.querySelector('.ac-grid');if(!grid||grid.querySelector('[data-as146-open]'))return false;const button=document.createElement('button');button.type='button';button.className='ac-module is-lime';button.dataset.as146Open='';button.innerHTML='<span class="ac-icon">⌘</span><span><b>LOCAL SOVEREIGNTY</b><small>Preview preferences and local forks deliberately.</small></span><i>›</i>';grid.append(button);return true}
function mountGovernanceLink(){if(!document.documentElement.hasAttribute('data-anarchadia-governance'))return false;const header=document.querySelector('.ag-top');if(!header||header.querySelector('[data-as146-open]'))return false;const button=document.createElement('button');button.type='button';button.dataset.as146Open='';button.textContent='Local sovereignty';header.append(button);return true}
function mount(){mountCitizenModule();mountGovernanceLink()}
function schedule(){clearTimeout(timer);if(attempts++>20)return;timer=setTimeout(()=>{mount();if(!document.querySelector('.ac-grid')&&!document.querySelector('.ag-top'))schedule()},Math.min(500,40+attempts*20))}
if(document.documentElement.dataset.as146Bound!=='true'){document.documentElement.dataset.as146Bound='true';document.addEventListener('click',event=>{const target=event.target.closest('[data-as146-open]');if(!target)return;event.preventDefault();event.stopImmediatePropagation();open()},true)}
document.readyState==='loading'?addEventListener('DOMContentLoaded',schedule,{once:true}):schedule();
globalThis.AnarchadiaLocalSovereigntyBridgeV146={version:VERSION,open,mount};
})();
