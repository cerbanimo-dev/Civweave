(()=>{
'use strict';
let session=null,doc=null,saveTimer=null,lastText='',pending=Promise.resolve(),epoch=0;
const editor=()=>document.getElementById('cs-text-editor');
const provenance=()=>globalThis.CivweaveContentProvenanceV1;
const store=()=>globalThis.CivweaveCreatorStoreV1;
const journal=()=>globalThis.CivweaveCreatorCrashJournalV1;
const builder=()=>globalThis.CivweaveStructuredDocumentV1;
async function digest(text){
  const bytes=new TextEncoder().encode(text),hash=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
function nameStatus(message,bad=false){
  const node=document.getElementById('cs-document-name-status');
  if(node){node.textContent=message;node.className='cs-status'+(bad?' cs-bad':'');}
}
function syncName(force=false){
  const input=document.getElementById('cs-document-name'),button=document.getElementById('cs-save-document-name');
  if(input){if(force||document.activeElement!==input)input.value=session?.title||'';input.readOnly=Boolean(session?.finalizedAt);}
  if(button)button.disabled=Boolean(session?.finalizedAt);
}
function notify(){
  syncName();
  const node=document.getElementById('cs-document-status');
  if(node&&doc){const s=builder().status(doc);node.textContent='Revision '+s.revision+' · '+s.wordCount+' words · '+s.blockCount+' blocks · '+s.status;}
  dispatchEvent(new CustomEvent('creator-suite:session-updated',{detail:{kind:'text',session,documentStatus:doc?builder().status(doc):null}}));
}
function changed(expected){if(expected!==epoch)throw new Error('The active document changed. Open it again before saving.');}
function enqueue(work){
  const expected=epoch,result=pending.then(()=>{changed(expected);return work(expected);});
  pending=result.catch(()=>{});
  return result;
}
function report(error){
  nameStatus(error?.message||String(error),true);
  dispatchEvent(new CustomEvent('creator-suite:document-name-error',{detail:{message:error?.message||String(error)}}));
}
function newSession(){
  clearTimeout(saveTimer);epoch++;
  session=provenance().createSession({mediaType:'text',artifactType:'document',sourceSystem:'creator-suite'});
  doc=builder().fresh(session.id);
  lastText='';if(editor())editor().textContent='';
  const initial=session,initialDoc=doc;
  pending=Promise.all([store().putSession(initial),store().putArtifact(initialDoc)]).catch(report);
  nameStatus('Name this document to find it in Projects.');
  syncName(true);notify();return session;
}
async function openSession(next){
  if(!next||next.mediaType!=='text')return false;
  if(session&&!session.finalizedAt&&editor()?.innerText!==lastText)await flush();
  clearTimeout(saveTimer);const expected=++epoch;
  await pending;changed(expected);
  const [recovered,savedDoc]=await Promise.all([journal()?.restore(next.id),store()?.getArtifact('document:'+next.id)]);
  changed(expected);
  session=structuredClone(next);
  const text=recovered&&!recovered.cleared?String(recovered.content||''):'';
  doc=savedDoc?.schema===builder().schema?savedDoc:builder().fresh(session.id,text);
  if(!doc.title&&session.title)doc.title=session.title;
  const current=savedDoc?builder().render(doc):text;
  editor().innerText=current;lastText=current;
  nameStatus(session.finalizedAt?'Finalized document names are locked.':'Document opened from local storage.');
  syncName(true);notify();return true;
}
function sealSession(next){
  return enqueue(async expected=>{
    if(!next||next.mediaType!=='text'||!session||next.id!==session.id)
      throw new Error('Finalized session does not match the active document.');
    if(next.headHash!==session.headHash)throw new Error('Document changed before finalization.');
    await store().putSession(next);changed(expected);
    session=structuredClone(next);nameStatus('Finalized document names are locked.');notify();return session;
  });
}
async function commit(next,nextDoc,content,expected){
  const contentDigest='sha256:'+await digest(content);changed(expected);
  await store().commitDocumentChange({session:next,document:nextDoc,content,contentDigest});changed(expected);
  session=next;doc=nextDoc;lastText=content;if(editor()?.innerText!==content)editor().innerText=content;notify();
}
async function snapshot(type,expected){
  const text=editor()?.innerText||'';
  if(text===lastText)return session;
  if(session.finalizedAt)throw new Error('Finalized documents cannot be edited.');
  const nextDoc=builder().fromHuman(doc||builder().fresh(session.id),text);
  const hash=await digest(text);changed(expected);
  const next=await provenance().recordEvent(session,{type,actor:{kind:'human',id:'local-creator'},
    payload:{length:text.length,contentDigest:'sha256:'+hash,documentRevision:nextDoc.revision}});changed(expected);
  await commit(next,nextDoc,text,expected);return session;
}
function recordHumanSnapshot(type='text.replace'){
  if(!session)newSession();
  return enqueue(expected=>snapshot(type,expected));
}
function scheduleSnapshot(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>recordHumanSnapshot().catch(report),180);}
async function renameDocument(value){
  const name=String(value??'').trim();
  if(!name||name.length>120)return Promise.reject(new Error('Use a document name between 1 and 120 characters.'));
  if(!session)newSession();clearTimeout(saveTimer);
  return enqueue(async expected=>{
    if(session.finalizedAt)throw new Error('Finalized documents cannot be renamed.');
    await snapshot('text.replace',expected);
    if(session.title===name)return session;
    const update=builder().apply(doc,[{op:'setTitle',title:name}],{expectedRevision:doc.revision});
    const recorded=await provenance().recordEvent(session,{type:'document.rename',
      actor:{kind:'human',id:'local-creator'},payload:{previousName:session.title||'',name,documentRevision:update.document.revision}});changed(expected);
    const next={...recorded,title:name};
    const body=builder().render(update.document);
    await commit(next,update.document,body,expected);
    syncName(true);nameStatus('Saved locally as “'+name+'”.');
    dispatchEvent(new CustomEvent('creator-suite:document-name-saved',{detail:{sessionId:session.id,name}}));
    return session;
  });
}
function inspect(args={}){
  const start=Math.max(0,Math.min(doc.blocks.length,Number(args.start)||0));
  const limit=Math.max(1,Math.min(40,Number(args.limit)||15));
  return{status:builder().status(doc),blocks:doc.blocks.slice(start,start+limit).map(block=>({...block})),
    nextCursor:start+limit<doc.blocks.length?start+limit:null};
}
function execute(action,args={},actor){
  if(!session)newSession();
  return enqueue(async expected=>{
    if(action==='document.inspect')return inspect(args);
    if(session.finalizedAt)throw new Error('This document is finalized. Start a new document.');
    if(!['replaceAll','generate','append','document.apply'].includes(action))
      throw new Error('Unsupported text action: '+action);
    clearTimeout(saveTimer);
    await snapshot('text.replace',expected);
    let edits=args.edits;
    if(action!=='document.apply'){
      const text=String(args.text??args.content??'');
      edits=action==='append'?[{op:'append',block:{type:'paragraph',text}}]:
        [{op:'replaceAll',blocks:text?[{type:'paragraph',text}]:[]}];
    }
    const small=args.taskTier==='small'||args.modelTier==='small';
    const maxEdits=small?3:64;
    const expectedRevision=action==='document.apply'?args.expectedRevision:doc.revision;
    const update=builder().apply(doc,edits,{
      expectedRevision,requestId:args.batchId||(action==='document.apply'?actor?.requestId:''),maxEdits
    });
    if(update.duplicate)return{sessionId:session.id,duplicate:true,applied:0,status:builder().status(doc)};
    const nextDoc=update.document,body=builder().render(nextDoc),hash=await digest(body);changed(expected);
    const next=await provenance().recordEvent(session,{type:'document.batch',actor,payload:{
      documentRevision:nextDoc.revision,editCount:update.applied,operations:edits.map(edit=>String(edit.op).slice(0,40)),
      contentLength:body.length,contentDigest:'sha256:'+hash
    }});changed(expected);
    if(nextDoc.title!==session.title)next.title=nextDoc.title;
    await commit(next,nextDoc,body,expected);
    return{sessionId:session.id,duplicate:false,applied:update.applied,status:builder().status(doc)};
  });
}
function flush(){
  if(!session||session.finalizedAt)return Promise.resolve(session);
  clearTimeout(saveTimer);return recordHumanSnapshot();
}
function init(){
  const node=editor();if(!node||node.dataset.creatorTextBound==='1')return;
  node.dataset.creatorTextBound='1';
  node.addEventListener('input',scheduleSnapshot);
  node.addEventListener('paste',event=>{
    if(!session)newSession();if(session.finalizedAt)return;
    const pasted=event.clipboardData?.getData('text/plain')||'';
    enqueue(async expected=>{
      const next=await provenance().recordEvent(session,{type:'external.paste',actor:{kind:'external',id:'clipboard'},
        payload:{length:pasted.length,contentDigest:'sha256:'+await digest(pasted)}});changed(expected);
      await store().putSession(next);changed(expected);session=next;notify();
    }).catch(report);
  });
  document.querySelector('[data-new-session="text"]')?.addEventListener('click',()=>flush().then(newSession).catch(report));
  document.getElementById('cs-save-document-name')?.addEventListener('click',()=>renameDocument(document.getElementById('cs-document-name')?.value).catch(report));
  document.getElementById('cs-document-name')?.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();renameDocument(event.currentTarget.value).catch(report);}
  });
  addEventListener('creator-suite:open-session',event=>{
    if(event.detail?.session?.mediaType==='text')openSession(event.detail.session).catch(report);
  });
  globalThis.CivweaveCreatorToolsV1?.registerEditor('text',{
    actions:['replaceAll','generate','append','document.inspect','document.apply'],execute
  });
  newSession();
}
globalThis.CivweaveCreatorTextV1=Object.freeze({
  init,newSession,openSession,sealSession,renameDocument,flush,execute,
  getSession:()=>session,getText:()=>editor()?.innerText||'',
  getDocument:()=>doc?structuredClone(doc):null,getDocumentStatus:()=>doc?builder().status(doc):null,
  recordHumanSnapshot
});
})();