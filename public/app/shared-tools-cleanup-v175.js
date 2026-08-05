(()=>{
'use strict';
const VERSION='175.0-shared-tools-no-ai-vault';
function additions(){return globalThis.CommonweaveAdditionsV156}
function forceMesh(){try{return additions()?.openTools?.('mesh')}catch(error){console.error('[Commonweave shared tools cleanup]',error)}}
function patch(){
  const launcher=document.querySelector('#cwv156-tools button');
  if(launcher&&!launcher.dataset.noAiVault){launcher.dataset.noAiVault='true';launcher.innerHTML='<span class="cwv156-dot"></span>Shared tools'}
  const dialog=document.querySelector('#cwv156-dialog');if(!dialog)return;
  dialog.querySelector('[data-cwv-tab="vault"]')?.remove();
  const mesh=dialog.querySelector('[data-cwv-tab="mesh"]');if(mesh&&!dialog.querySelector('[data-cwv-tab][aria-selected="true"]'))mesh.setAttribute('aria-selected','true');
  const body=dialog.querySelector('#cwv156-body');
  if(body?.querySelector('[data-cwv-native-settings],[data-cwv-model-check],#cwv156-remember,#cwv156-unlock'))queueMicrotask(forceMesh);
}
document.addEventListener('click',event=>{
  const launcher=event.target.closest('#cwv156-tools button');if(launcher){event.preventDefault();event.stopImmediatePropagation();forceMesh();return}
  const vault=event.target.closest('[data-cwv-tab="vault"],[data-cwv-native-settings],[data-cwv-model-check]');if(vault){event.preventDefault();event.stopImmediatePropagation();forceMesh()}
},true);
addEventListener('commonweave:open-shared-tools',event=>{if(!event.detail?.tab||event.detail.tab==='vault')setTimeout(forceMesh,0)},true);
const observer=new MutationObserver(patch);observer.observe(document.documentElement,{childList:true,subtree:true});
document.readyState==='loading'?addEventListener('DOMContentLoaded',patch,{once:true}):patch();
globalThis.CommonweaveSharedToolsCleanupV175=Object.freeze({version:VERSION,patch,open:forceMesh});
})();
