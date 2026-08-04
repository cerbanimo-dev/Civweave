(()=>{
'use strict';
const VERSION='1.0.4-model-download-v157';
if(globalThis.CommonweaveModelDownloadV157?.version===VERSION)return;
const ADAPTER='/app/models/all-minilm-l6-v2/adapter.js?v=device-package-r37-core';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let running=null;
async function module(){return import(ADAPTER)}
function statusNode(button){return button.closest('form,dialog,.cwv156-card')?.querySelector('[data-package-state],[data-test-status],#model-test-status,#cwv156-model-output')||null}
function write(button,message,error=false){const node=statusNode(button);if(node){node.textContent=message;node.classList.toggle('is-error',error);node.classList.toggle('is-ready',!error)}button.textContent=error?'Retry local model download':'Download local model'}
async function download(button){
  if(running)return running;
  const original=button.textContent;button.disabled=true;button.textContent='Preparing local model…';
  running=(async()=>{
    try{
      const adapter=await module();
      const before=await adapter.status();
      if(before.available){write(button,'MiniLM is already cached for offline use.');return before}
      const result=await adapter.install({onProgress:progress=>{const name=String(progress.url||'').split('/').pop();button.textContent=`Local model ${progress.completed||0}/${progress.total||0}`;const node=statusNode(button);if(node)node.textContent=`Downloading ${name} · ${progress.completed||0}/${progress.total||0} files cached…`}});
      write(button,'MiniLM semantic retrieval is cached and ready for offline use.');
      globalThis.dispatchEvent(new CustomEvent('commonweave:model-package-ready',{detail:{version:VERSION,status:result}}));
      return result;
    }catch(error){write(button,`Local model download failed: ${error.message}`,true);throw error}
    finally{button.disabled=false;if(button.textContent.startsWith('Local model '))button.textContent=original;running=null}
  })();
  return running;
}
function addButton(container){
  if(!container||container.querySelector('[data-download-local-model]'))return;
  const button=document.createElement('button');button.type='button';button.dataset.downloadLocalModel='';button.textContent='Download local model';
  button.className=container.closest('.cwv156-dialog')?'cwv156-btn':'';
  container.append(button);
}
function enhance(root=document){
  root.querySelectorAll?.('[data-route-panel="bundled"] .cw-ai-actions').forEach(addButton);
  const native=root.querySelector?.('#settings .actions');if(native)addButton(native);
  const shared=root.querySelector?.('#cwv156-body .cwv156-row');if(shared)addButton(shared);
}
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-download-local-model]');
  if(button){event.preventDefault();event.stopImmediatePropagation();download(button).catch(()=>{});return}
  if(event.target.closest?.('#settings-button,#model-chip,[data-action="settings"],#lite-settings,[data-cwv-open],[data-cwv-tab="ai"]'))setTimeout(()=>enhance(document),0);
  const old=event.target.closest?.('[data-cwv-model-check]');
  if(old){event.preventDefault();event.stopImmediatePropagation();old.dataset.downloadLocalModel='';download(old).catch(()=>{})}
},true);
addEventListener('commonweave:open-ai-settings',()=>setTimeout(()=>enhance(document),0));
addEventListener('commonweave:additions-ready',()=>setTimeout(()=>enhance(document),0));
if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>enhance(document),{once:true});else enhance(document);
globalThis.CommonweaveModelDownloadV157={version:VERSION,download,enhance,status:async()=>module().then(adapter=>adapter.status())};
})();