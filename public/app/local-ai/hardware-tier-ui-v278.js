(()=>{
'use strict';
const VERSION='1.0.81-local-ai-hardware-tier-ui-v278';
if(globalThis.CivweaveLocalModelHardwareTierUIV278?.version===VERSION)return;
const PANEL='cw-local-ai-v266';
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
function linkFor(model){const href=registry()?.sourceUrl?.(model);if(!href)return null;const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Source package';a.dataset.civweaveModelSource=model.id;a.style.cssText='display:inline-block;margin-top:5px;font-size:.78rem;color:#9ff2dc;text-decoration:underline';return a}
function decorate(){const panel=document.getElementById(PANEL),r=registry();if(!panel||!r)return false;for(const model of r.installable()){const row=panel.querySelector(`[data-model-id="${CSS.escape(model.id)}"]`);if(!row)continue;const p=row.querySelector('p');if(p&&model.hardwareTier&&!p.dataset.hardwareTier){p.append(document.createTextNode(` · ${model.hardwareTier}`));p.dataset.hardwareTier='1'}if(!row.querySelector(`[data-civweave-model-source="${model.id}"]`)){const a=linkFor(model);if(a)row.querySelector('div')?.append(a)}}const previews=[...panel.querySelectorAll('.cw-local-experimental')];r.experimental().forEach((model,index)=>{const row=previews[index];if(!row)return;const p=row.querySelector('p');if(p&&model.hardwareTier&&!p.dataset.hardwareTier){p.prepend(document.createTextNode(`${model.hardwareTier} · `));p.dataset.hardwareTier='1'}if(!row.querySelector(`[data-civweave-model-source="${model.id}"]`)){const a=linkFor(model);if(a)row.querySelector('div')?.append(a)}});return true}
let observer=null;
function watch(){decorate();const panel=document.getElementById(PANEL);if(!panel||observer)return;observer=new MutationObserver(()=>queueMicrotask(decorate));observer.observe(panel,{childList:true,subtree:true})}
addEventListener('civweave:model-settings-opened',()=>setTimeout(watch,0));addEventListener('civweave:local-model-download-progress',()=>queueMicrotask(decorate));addEventListener('civweave:local-model-downloaded',()=>queueMicrotask(decorate));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queueMicrotask(watch),{once:true});else queueMicrotask(watch);
globalThis.CivweaveLocalModelHardwareTierUIV278=Object.freeze({version:VERSION,decorate,watch});
})();
