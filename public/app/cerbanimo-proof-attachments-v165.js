(()=>{
'use strict';
const VERSION='1.0.5-cerbanimo-proof-attachments-v165-idempotent';
if(globalThis.CivweaveCerbanimoProofAttachmentsV165?.version===VERSION)return;
const DB_NAME='cerbanimo-proof-files-v165';
const DB_STORE='files';
const META_KEY='cerbanimo.proof-attachments.v165';
const MAX_FILE_BYTES=15*1024*1024;
const MAX_BATCH_BYTES=40*1024*1024;
const hasDOM=typeof document!=='undefined';
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clean=(value,max=8000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
let pendingTarget=null;
let decorateQueued=false;
function api(){return globalThis.CivweaveCerbanimoQuestV144}
function metadata(){const value=parse(localStorage.getItem(META_KEY),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function writeMetadata(value){localStorage.setItem(META_KEY,JSON.stringify(value));try{dispatchEvent(new CustomEvent('cerbanimo:proof-attachments-changed',{detail:{attachments:value}}))}catch{}}
function formatBytes(bytes){const value=Number(bytes)||0;if(value<1024)return`${value} B`;if(value<1024*1024)return`${(value/1024).toFixed(1)} KB`;return`${(value/1024/1024).toFixed(1)} MB`}
function validProofUrl(value){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)}catch{return false}}
function validateFiles(files){const list=Array.from(files||[]),oversized=list.find(file=>file.size>MAX_FILE_BYTES),total=list.reduce((sum,file)=>sum+Number(file.size||0),0);if(oversized)return{ok:false,error:`${oversized.name} exceeds the 15 MB per-file proof limit.`};if(total>MAX_BATCH_BYTES)return{ok:false,error:'This proof batch exceeds the 40 MB attachment limit.'};return{ok:true,files:list,total}}
function openDb(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB)return reject(new Error('This browser cannot store local proof files.'));const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE,{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Could not open the proof file store.'))})}
async function putFile(file){const db=await openDb(),id=uid('attachment'),record={id,name:clean(file.name,240)||'proof-file',type:clean(file.type,120)||'application/octet-stream',size:Number(file.size)||0,lastModified:Number(file.lastModified)||0,createdAt:now(),blob:file};await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not save the proof file.'));tx.onabort=()=>reject(tx.error||new Error('Proof file storage was aborted.'))});db.close();return record}
async function getFile(id){const db=await openDb(),record=await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly'),request=tx.objectStore(DB_STORE).get(id);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error||new Error('Could not read the proof file.'))});db.close();return record}
async function deleteFile(id){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not remove the proof file.'))});db.close()}
function activeTargetFromControl(control){const state=api()?.readState?.(),quest=state?.quests?.find(item=>item.id===state.preferences?.activeQuestId)||state?.quests?.find(item=>item.status!=='completed'&&item.status!=='archived')||state?.quests?.[0],taskId=control.closest('[data-task-id]')?.dataset.taskId,task=quest?.tasks?.find(item=>item.id===taskId);return quest&&task?{questId:quest.id,taskId:task.id,questTitle:quest.title,taskTitle:task.title}:null}
function enhanceProofDialog(){
  if(!hasDOM||!pendingTarget)return;const dialog=document.querySelector('#cq144-dialog'),body=dialog?.querySelector('#cq144-dialog-body'),form=dialog?.querySelector('form');if(!dialog||!body||!form||body.querySelector('[data-cq165-proof-attachments]'))return;
  const title=dialog.querySelector('#cq144-dialog-title')?.textContent||'';if(!/attach proof/i.test(title))return;
  const evidence=body.querySelector('textarea[name="value"]');if(evidence){evidence.required=false;evidence.placeholder='Add a note, paste a result, or leave this blank when attaching files or a link.'}
  const section=document.createElement('section');section.dataset.cq165ProofAttachments='';section.innerHTML=`<label>Proof link<input name="proofLink" type="url" inputmode="url" placeholder="https://…"></label><label>Files or images<input name="proofFiles" type="file" multiple accept="image/*,.txt,.md,.markdown,.json,.jsonl,.csv,.tsv,.log,.xml,.yaml,.yml,text/*"></label><small>Images, text files, logs, JSON, Markdown, and gitingest-style dumps are stored locally on this device. Up to 15 MB per file and 40 MB per submission.</small>`;
  body.append(section);form.dataset.cq165QuestId=pendingTarget.questId;form.dataset.cq165TaskId=pendingTarget.taskId;scheduleDecorate();
}
function toast(message){const node=document.querySelector?.('#rc-toast');if(!node)return;node.textContent=message;node.hidden=false;clearTimeout(node._cq165Timer);node._cq165Timer=setTimeout(()=>node.hidden=true,3600)}
async function submitEnhanced(form){
  const questId=form.dataset.cq165QuestId,taskId=form.dataset.cq165TaskId;if(!questId||!taskId)return false;
  const data=new FormData(form),note=clean(data.get('value'),12000),label=clean(data.get('label'),160)||'Completion evidence',kind=clean(data.get('kind'),40)||'note',link=clean(data.get('proofLink'),2000),fileInput=form.querySelector('input[name="proofFiles"]'),validation=validateFiles(fileInput?.files);
  if(!validation.ok)throw new Error(validation.error);if(link&&!validProofUrl(link))throw new Error('Proof links must use http or https.');if(!note&&!link&&!validation.files.length)throw new Error('Add a note, link, file, or image before attaching proof.');
  const questApi=api();if(!questApi?.addProof)throw new Error('The Cerbanimo proof engine is not ready.');let added=0;
  if(note){const result=questApi.addProof(questId,taskId,{kind,label,value:note});if(result?.ok===false)throw new Error(result.error);added++}
  if(link){const result=questApi.addProof(questId,taskId,{kind:'url',label:label==='Completion evidence'?'Proof link':label,value:link});if(result?.ok===false)throw new Error(result.error);added++}
  const meta=metadata();
  for(const file of validation.files){
    const stored=await putFile(file),proofKind=stored.type.startsWith('image/')?'image':'file',result=questApi.addProof(questId,taskId,{kind:proofKind,label:stored.name,value:`attachment:${stored.id}`});
    if(result?.ok===false){await deleteFile(stored.id).catch(()=>{});throw new Error(result.error)}
    meta[stored.id]={id:stored.id,proofId:result?.proof?.id||'',questId,taskId,name:stored.name,type:stored.type,size:stored.size,kind:proofKind,createdAt:stored.createdAt};added++;
  }
  writeMetadata(meta);document.querySelector('#cq144-dialog')?.close();questApi.mount?.();scheduleDecorate();toast(`${added} proof item${added===1?'':'s'} attached locally.`);return true;
}
function proofRecordsForCard(card){const state=api()?.readState?.(),quest=state?.quests?.find(item=>item.id===state.preferences?.activeQuestId)||state?.quests?.find(item=>item.status!=='completed'&&item.status!=='archived')||state?.quests?.[0],task=quest?.tasks?.find(item=>item.id===card.dataset.taskId);return task?.proofs||[]}
function removeExtras(node,selector,keep=null){for(const extra of node.querySelectorAll(selector))if(extra!==keep)extra.remove()}
function decorateProofLists(){
  if(!hasDOM)return;const meta=metadata();document.querySelectorAll('.cq144-task[data-task-id]').forEach(card=>{const proofs=proofRecordsForCard(card),nodes=Array.from(card.querySelectorAll('.cq144-proof-list>div'));nodes.forEach((node,index)=>{const proof=proofs[index],span=node.querySelector('span');if(!proof||!span)return;const value=clean(proof.value,4000);
    if(value.startsWith('attachment:')){
      const id=value.slice('attachment:'.length),info=meta[id],text=info?`${info.name} · ${formatBytes(info.size)} · stored on this device`:'Local proof attachment',label=info?.kind==='image'?'View image':'Open file';
      removeExtras(span,'[data-cq165-link]');if(span.textContent!==text)span.textContent=text;
      let button=node.querySelector(`[data-cq165-attachment="${CSS.escape(id)}"]`);if(!button){removeExtras(node,'[data-cq165-attachment]');button=document.createElement('button');button.type='button';button.className='cq144-button';button.dataset.cq165Attachment=id;node.append(button)}else removeExtras(node,'[data-cq165-attachment]',button);if(button.textContent!==label)button.textContent=label;return;
    }
    if(validProofUrl(value)){
      removeExtras(node,'[data-cq165-attachment]');let link=span.querySelector('[data-cq165-link]');if(!link){span.replaceChildren();link=document.createElement('a');link.dataset.cq165Link='';link.target='_blank';link.rel='noreferrer';span.append(link)}else removeExtras(span,'[data-cq165-link]',link);if(link.getAttribute('href')!==value)link.href=value;if(link.textContent!==value)link.textContent=value;return;
    }
    removeExtras(node,'[data-cq165-attachment]');removeExtras(span,'[data-cq165-link]');
  })})
}
function ensureViewer(){if(!hasDOM)return null;let dialog=document.querySelector('#cq165-proof-viewer');if(dialog)return dialog;dialog=document.createElement('dialog');dialog.id='cq165-proof-viewer';dialog.className='cq144-dialog cq165-proof-viewer';dialog.innerHTML='<section class="cq165-viewer-card"><header><div><small>LOCAL PROOF ATTACHMENT</small><h2 data-cq165-viewer-title>Proof</h2></div><button type="button" data-cq165-close>×</button></header><div data-cq165-viewer-body></div><footer><a class="cq144-button is-primary" data-cq165-download download>Download</a><button type="button" class="cq144-button" data-cq165-close>Close</button></footer></section>';document.body.append(dialog);dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-cq165-close]'))closeViewer()});return dialog}
function closeViewer(){const dialog=document.querySelector?.('#cq165-proof-viewer');if(!dialog)return;if(dialog._cq165Url){URL.revokeObjectURL(dialog._cq165Url);dialog._cq165Url=''}dialog.close?.()}
async function openAttachment(id){
  const info=metadata()[id],record=await getFile(id);if(!record?.blob)throw new Error('This proof file is missing from local device storage.');const dialog=ensureViewer(),body=dialog.querySelector('[data-cq165-viewer-body]'),title=dialog.querySelector('[data-cq165-viewer-title]'),download=dialog.querySelector('[data-cq165-download]');if(dialog._cq165Url)URL.revokeObjectURL(dialog._cq165Url);const url=URL.createObjectURL(record.blob);dialog._cq165Url=url;title.textContent=info?.name||record.name||'Proof attachment';download.href=url;download.download=info?.name||record.name||'proof-file';body.replaceChildren();const type=info?.type||record.type||record.blob.type||'';
  if(type.startsWith('image/')){const image=document.createElement('img');image.src=url;image.alt=title.textContent;body.append(image)}else if(type.startsWith('text/')||/\.(txt|md|markdown|json|jsonl|csv|tsv|log|xml|ya?ml)$/i.test(record.name||'')){const pre=document.createElement('pre');const text=await record.blob.text();pre.textContent=text.slice(0,250000)+(text.length>250000?'\n\n[Preview truncated. Download the full file.]':'');body.append(pre)}else{const note=document.createElement('p');note.textContent=`${record.name||'File'} · ${formatBytes(record.size)}. Use Download to inspect this proof attachment.`;body.append(note)}if(!dialog.open)dialog.showModal?.();return record
}
function scheduleDecorate(){if(!hasDOM||decorateQueued)return;decorateQueued=true;requestAnimationFrame(()=>{decorateQueued=false;enhanceProofDialog();decorateProofLists()})}
function injectStyles(){if(!hasDOM||document.querySelector('#cq165-styles'))return;const style=document.createElement('style');style.id='cq165-styles';style.textContent='[data-cq165-proof-attachments]{display:grid;gap:12px;padding:12px;border:1px solid rgba(108,227,255,.22);border-radius:12px;background:rgba(108,227,255,.04)}[data-cq165-proof-attachments] small{color:#aaa2c5;line-height:1.45}.cq144-proof-list>div>.cq144-button{width:max-content;margin-top:6px}.cq144-proof-list a{color:#6ce3ff;overflow-wrap:anywhere}.cq165-proof-viewer{width:min(900px,calc(100vw - 20px))}.cq165-viewer-card{display:grid;grid-template-rows:auto minmax(0,1fr) auto;max-height:90vh}.cq165-viewer-card>header,.cq165-viewer-card>footer{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(116,220,255,.24);background:#08071d}.cq165-viewer-card>footer{justify-content:flex-end;border-top:1px solid rgba(116,220,255,.24);border-bottom:0}.cq165-viewer-card>[data-cq165-viewer-body]{padding:16px;overflow:auto}.cq165-viewer-card img{display:block;max-width:100%;height:auto;margin:auto}.cq165-viewer-card pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#e9e5f5;background:#02030e;padding:14px;border-radius:10px}';document.head.append(style)}
function captureClick(event){const control=event.target.closest?.('[data-cq-action="open-proof"],[data-cq165-attachment]');if(!control)return;if(control.dataset.cq165Attachment){event.preventDefault();event.stopImmediatePropagation();openAttachment(control.dataset.cq165Attachment).catch(error=>toast(error.message));return}pendingTarget=activeTargetFromControl(control);setTimeout(enhanceProofDialog,0)}
function captureSubmit(event){const form=event.target;if(!form?.matches?.('#cq144-dialog form[data-cq165-quest-id]'))return;const files=form.querySelector('input[name="proofFiles"]')?.files,link=clean(new FormData(form).get('proofLink'),2000),note=clean(new FormData(form).get('value'),12000);if(!files?.length&&!link&&note)return;event.preventDefault();event.stopImmediatePropagation();submitEnhanced(form).catch(error=>toast(error.message))}
function relevantMutation(records){return records.some(record=>Array.from(record.addedNodes||[]).some(node=>node?.nodeType===1&&(node.matches?.('.cq144-task,#cq144-dialog,.cq144-proof-list')||node.querySelector?.('.cq144-task,#cq144-dialog,.cq144-proof-list'))))}
function boot(){injectStyles();ensureViewer();document.addEventListener('click',captureClick,true);document.addEventListener('submit',captureSubmit,true);const observer=new MutationObserver(records=>{if(relevantMutation(records))scheduleDecorate()});observer.observe(document.querySelector('#rc-app')||document.documentElement,{childList:true,subtree:true});addEventListener('cerbanimo:quest-engine-changed',scheduleDecorate);addEventListener('cerbanimo:proof-attachments-changed',scheduleDecorate);scheduleDecorate()}
if(hasDOM){document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot()}
globalThis.CivweaveCerbanimoProofAttachmentsV165={version:VERSION,DB_NAME,META_KEY,validateFiles,validProofUrl,putFile,getFile,deleteFile,openAttachment,submitEnhanced,scheduleDecorate};
})();
