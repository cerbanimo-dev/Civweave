import '../action-board-v1.mjs';
import {
  normalizePortableDraftBundle,planPortableReconciliation,verifyPortableGuildSession
} from '../shared/worldweaver-portable-reconcile-v1.mjs';

const $=id=>document.getElementById(id);
const nonce=(new URLSearchParams(location.hash.slice(1)).get('nonce')||'').slice(0,100);
const expectedUniverse=(new URLSearchParams(location.hash.slice(1)).get('universe')||'').slice(0,96);
const validNonce=/^[A-Za-z0-9_-]{20,100}$/.test(nonce);
const validUniverse=!expectedUniverse||/^[A-Za-z0-9_-]{1,96}$/.test(expectedUniverse);
let verified=null,bundle=null,objects=[],plan=null,privateReady=false,busy=false;
const text=(id,value)=>{$(id).textContent=String(value);};
function buttonRows(where,rows,kind,allow){
  const root=$(where);root.replaceChildren();
  for(const entry of rows){
    const row=document.createElement('label');row.className='row';
    const check=document.createElement('input');check.type='checkbox';
    check.dataset.kind=kind;check.dataset.draftId=entry.id;
    check.disabled=entry.status!=='new'||!allow;
    const info=document.createElement('span'),name=document.createElement('strong'),details=document.createElement('small');
    name.textContent=kind==='quest'?entry.title:entry.text;
    details.textContent=entry.status==='new'?'New — requires your approval':
      entry.status==='unchanged'?'Already imported; no duplicate will be created':
        'Conflict — preserve both versions; resolve separately';
    if(kind==='quest'&&entry.originallyDone)details.textContent+=' · Previously checked, but not independently verified';
    info.append(name,details);row.append(check,info);root.append(row);
  }
}
function selections(kind){
  return Array.from(document.querySelectorAll('input[data-kind="'+kind+'"]:checked')).map(x=>x.dataset.draftId);
}
function updateApproval(){
  $('cw-approve').disabled=!verified||!bundle||busy||(!selections('quest').length&&!selections('journal').length);
}
async function renderPreview(){
  if(!verified||!bundle){plan=null;updateApproval();return;}
  privateReady=Boolean(globalThis.CivweaveLocalMeshV146?.listObjects&&globalThis.CivweaveLocalMeshV146?.createObject);
  if(privateReady){
    try{objects=await globalThis.CivweaveLocalMeshV146.listObjects();}
    catch(error){privateReady=false;objects=[];text('cw-import-status','Private journal storage is unavailable: '+String(error?.message||error));}
  }
  const actions=globalThis.CivweaveActionBoardV1?.read?.();
  if(!Array.isArray(actions))throw new Error('Canonical Action Board unavailable');
  plan=planPortableReconciliation(bundle,actions,objects,verified);
  buttonRows('cw-quest-review',plan.quests,'quest',true);
  buttonRows('cw-journal-review',plan.journal,'journal',privateReady);
  text('cw-drafts-status','Review '+plan.quests.length+' Quest step(s) and '+plan.journal.length+' private journal note(s) from '+bundle.universeId+'.');
  updateApproval();
}
async function loadBundle(data){
  if(!verified)throw new Error('Verify your current Guild or node membership first');
  const normalized=normalizePortableDraftBundle(data);
  if(!validUniverse||(expectedUniverse&&normalized.universeId!==expectedUniverse))
    throw new Error('The transferred drafts belong to a different universe');
  bundle=normalized;
  await renderPreview();
}
async function verify(){
  if(busy)return;
  busy=true;$('cw-verify').disabled=true;updateApproval();
  try{
    verified=await verifyPortableGuildSession(globalThis.CivweaveHostNodeSessionV1);
    text('cw-auth-status','Verified current member '+verified.userId+' in node '+verified.nodeId+' at '+verified.origin+'.');
    text('cw-attachment-target','Authenticated Guild / HTTPS local node: '+verified.origin);
    if(bundle)await renderPreview();
    // The only message to the opener after verification asks for local drafts.
    // No token, credential, arbitrary metadata or bearer grant leaves this origin.
    if(validNonce&&validUniverse&&window.opener&&!window.opener.closed)
      window.opener.postMessage({schema:'civweave.portable-bridge.v1',type:'request-drafts',nonce,universeId:expectedUniverse},'*');
  }catch(error){
    verified=null;bundle=null;plan=null;
    $('cw-quest-review').replaceChildren();$('cw-journal-review').replaceChildren();
    text('cw-auth-status','Attachment not authorized: '+String(error?.message||error));
  }finally{busy=false;$('cw-verify').disabled=false;updateApproval();}
}
function sendReceipt(receipts){
  if(!validNonce||!window.opener||window.opener.closed)return;
  window.opener.postMessage({
    schema:'civweave.portable-bridge.v1',type:'receipt',nonce,
    universeId:bundle.universeId,
    receipts:receipts.map(r=>({draftId:r.draftId,status:r.status,kind:r.kind}))
  },'*');
}
async function approve(){
  if(busy||!verified||!bundle)return;
  const questIds=selections('quest'),journalIds=selections('journal');
  if(!questIds.length&&!journalIds.length)return;
  busy=true;updateApproval();
  const receipts=[];
  try{
    // Time-of-check/time-of-use defense: recheck current server membership
    // immediately before any canonical local write.
    const again=await verifyPortableGuildSession(globalThis.CivweaveHostNodeSessionV1);
    if(again.origin!==verified.origin||again.nodeId!==verified.nodeId||again.userId!==verified.userId)
      throw new Error('Guild or node selection changed; verify and review again');
    const current=planPortableReconciliation(bundle,globalThis.CivweaveActionBoardV1?.read?.()||[],
      privateReady?await globalThis.CivweaveLocalMeshV146.listObjects():[],verified);
    if(questIds.some(id=>current.quests.find(q=>q.id===id)?.status!=='new')||
       journalIds.some(id=>current.journal.find(q=>q.id===id)?.status!=='new'))
      throw new Error('Draft status changed. Re-review before importing.');
    if(questIds.length){
      const result=globalThis.CivweaveActionBoardV1?.importPortableActions?.(bundle,questIds,verified);
      if(!result?.ok)throw new Error(result?.error||'Action Board could not save reviewed actions');
      receipts.push(...result.receipts.map(x=>({...x,kind:'quest'})));
    }
    if(journalIds.length){
      if(!privateReady)throw new Error('Private journal mesh unavailable; no journal was imported');
      for(const id of journalIds){
        const note=bundle.journal.find(row=>row.id===id);
        if(!note)throw new Error('Journal selection no longer exists');
        try{
          await globalThis.CivweaveLocalMeshV146.createObject({
            kind:'civweave.portable-journal.v1',purpose:'Private reviewed portable universe journal',
            consent:'private',publish:false,hopLimit:0,
            payload:{universeId:bundle.universeId,draftId:id,nodeId:verified.nodeId,
              userId:verified.userId,text:note.text,reviewed:true}
          });
          receipts.push({draftId:id,status:'imported',kind:'journal'});
        }catch(error){
          receipts.push({draftId:id,status:'failed',kind:'journal'});
          text('cw-import-status','One or more private journals could not be saved. The original portable copy is unchanged.');
        }
      }
    }
    sendReceipt(receipts);
    text('cw-import-status',receipts.filter(r=>r.status==='imported').length+
      ' reviewed local draft(s) imported. These are not official Guild Quest completions or shared world changes.');
    await renderPreview();
  }catch(error){
    text('cw-import-status','No unverified Guild action was accepted: '+String(error?.message||error));
    if(receipts.length)sendReceipt(receipts); // retain truthful partial local receipts
    await renderPreview().catch(()=>{});
  }finally{busy=false;updateApproval();}
}
window.addEventListener('message',event=>{
  if(event.source!==window.opener)return;
  if(!validNonce||event.data?.nonce!==nonce||event.data?.schema!=='civweave.portable-bridge.v1'||event.data.type!=='drafts')return;
  if(!verified)return;
  // file: openers have opaque "null" origins. Nothing in their message
  // authenticates the user: only current Guild membership + explicit approval do.
  if(event.origin!=='null'&&!/^https?:\/\/[^/]+$/.test(event.origin))return;
  try{
    if(JSON.stringify(event.data.bundle||{}).length>512000)throw new Error('Transfer exceeds size limit');
    void loadBundle(event.data.bundle).catch(error=>text('cw-drafts-status','Transfer rejected: '+String(error?.message||error)));
  }catch(error){text('cw-drafts-status','Transfer rejected: '+String(error?.message||error));}
});
$('cw-verify').addEventListener('click',()=>void verify());
$('cw-approve').addEventListener('click',()=>void approve());
for(const id of ['cw-quest-review','cw-journal-review'])
  $(id).addEventListener('change',updateApproval);
$('cw-drafts-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{
    if(file.size>512000)throw new Error('Draft export exceeds 512 KiB');
    await loadBundle(JSON.parse(await file.text()));
  }catch(error){text('cw-drafts-status','File rejected: '+String(error?.message||error));}
});
if(validNonce&&validUniverse)text('cw-attachment-target','Pending portable universe: '+(expectedUniverse||'unknown')+' · session not yet verified');
