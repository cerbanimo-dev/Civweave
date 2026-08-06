(()=>{
'use strict';
const VERSION='1.0.7-model-download-v181-fixed-ort';
if(globalThis.CivweaveModelDownloadV157?.version===VERSION)return;
const ADAPTER='/app/models/all-minilm-l6-v2/adapter.js?v=device-package-r41-fixed-ort-wasm';
let running=null;
async function module(){return import(ADAPTER)}
function statusNode(button){return button.closest('[data-semantic-lab],form,dialog')?.querySelector('[data-package-state],[data-test-status]')||null}
function write(button,message,error=false){const node=statusNode(button);if(node){node.textContent=message;node.classList.toggle('is-error',error);node.classList.toggle('is-ready',!error)}button.textContent=error?'Retry local model download':'Download local model'}
async function download(button){
  if(running)return running;
  const original=button.textContent;button.disabled=true;button.textContent='Preparing fixed local model…';
  running=(async()=>{
    try{
      const adapter=await module(),before=await adapter.status();
      if(before.available){write(button,'MiniLM and its fixed WASM runtime are already cached for explicit semantic-lab use.');return before}
      const result=await adapter.install({onProgress:progress=>{const name=String(progress.url||'').split('/').pop();button.textContent=`Local model ${progress.completed||0}/${progress.total||0}`;const node=statusNode(button);if(node)node.textContent=`Downloading ${name} · ${progress.completed||0}/${progress.total||0} files cached…`}});
      write(button,'MiniLM is cached with one fixed ONNX Runtime Web WASM backend. It remains dormant until a semantic-lab test explicitly starts it.');
      globalThis.dispatchEvent(new CustomEvent('civweave:model-package-ready',{detail:{version:VERSION,status:result}}));return result;
    }catch(error){write(button,`Local model download failed: ${error.message}`,true);throw error}
    finally{button.disabled=false;if(button.textContent.startsWith('Local model '))button.textContent=original;running=null}
  })();return running;
}
function addButton(container){if(!container||container.querySelector('[data-download-local-model]'))return null;const button=document.createElement('button');button.type='button';button.dataset.downloadLocalModel='';button.textContent='Download local model';container.append(button);return button}
function enhance(root=document){root.querySelectorAll?.('[data-semantic-lab] [data-model-download-actions]').forEach(addButton);return root}
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-download-local-model]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();download(button).catch(()=>{})},true);
addEventListener('civweave:open-semantic-lab',event=>enhance(event.detail?.root||document));
globalThis.CivweaveModelDownloadV157=Object.freeze({version:VERSION,download,enhance,status:async()=>module().then(adapter=>adapter.status()),settingsHooks:false,automaticStartup:false});
})();
