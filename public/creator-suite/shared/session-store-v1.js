(()=>{
'use strict';
const DB='civweave.creator-suite.v1',VERSION=1,SESSION_STORE='sessions',ARTIFACT_STORE='artifacts';
let dbPromise;
function db(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,VERSION);
    request.onupgradeneeded=()=>{const target=request.result;if(!target.objectStoreNames.contains(SESSION_STORE))target.createObjectStore(SESSION_STORE,{keyPath:'id'});if(!target.objectStoreNames.contains(ARTIFACT_STORE))target.createObjectStore(ARTIFACT_STORE,{keyPath:'id'})};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  return dbPromise;
}
async function run(store,mode,work){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(store,mode),os=tx.objectStore(store),result=work(os);tx.oncomplete=()=>resolve(result?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted.'))})}
async function commitDocumentChange({session,document,content,contentDigest,expectedRevision,receipt}={}){
  if(!session?.id||document?.sessionId!==session.id||typeof content!=='string')
    throw new Error('Document commit must contain matching session, document, and content.');
  const database=await db();
  const journal={id:'journal:'+session.id,schema:'civweave.creator-crash-journal.v1',
    sessionId:session.id,kind:'text',updatedAt:new Date().toISOString(),
    content,contentDigest:String(contentDigest||''),recoverable:true};
  return new Promise((resolve,reject)=>{
    const tx=database.transaction([SESSION_STORE,ARTIFACT_STORE],'readwrite');
    const artifacts=tx.objectStore(ARTIFACT_STORE),current=artifacts.get(document.id);let conflict;
    current.onsuccess=()=>{
      if(expectedRevision!==undefined&&current.result?.revision!==expectedRevision||current.result&&document.revision<=current.result.revision){conflict=new Error('Document revision conflict. Refresh before saving.');tx.abort();return}
      tx.objectStore(SESSION_STORE).put(structuredClone(session));
      artifacts.put(structuredClone(document));artifacts.put(journal);
      artifacts.put({id:`document-revision:${session.id}:${document.revision}`,schema:'civweave.creator-document-revision.v1',sessionId:session.id,document:structuredClone(document),content,contentDigest:String(contentDigest||'')});
      if(receipt)artifacts.put({...structuredClone(receipt),sessionId:session.id,artifactRevision:document.revision,contentDigest:String(contentDigest||'')});
    };
    tx.oncomplete=()=>resolve({sessionId:session.id,revision:document.revision,receiptId:receipt?.id||null});
    tx.onerror=()=>reject(conflict||tx.error||new Error('Document commit failed.'));
    tx.onabort=()=>reject(conflict||tx.error||new Error('Document commit aborted.'));
  });
}
async function commitCreationRun({run:next,expectedRevision=0,checkpoint}={}){
  if(next?.schema!=='civweave.creation-run.v1'||!next.id||next.revision!==expectedRevision+1||JSON.stringify(next).length>150000)
    throw new Error('Invalid bounded creation-run revision.');
  if(checkpoint&&(checkpoint.schema!=='civweave.creation-checkpoint.v1'||checkpoint.runId!==next.id||typeof checkpoint.text!=='string'||checkpoint.text.length>64000))throw new Error('Invalid creation checkpoint.');
  const database=await db();return new Promise((resolve,reject)=>{
    const tx=database.transaction(ARTIFACT_STORE,'readwrite'),os=tx.objectStore(ARTIFACT_STORE),read=os.get(next.id);let failure;
    read.onsuccess=()=>{
      const current=read.result;
      if((current?.revision||0)!==expectedRevision){failure=new Error('Creation-run revision conflict. Reload before retrying.');tx.abort();return}
      if(current)os.put({...structuredClone(current),id:`${next.id}:revision:${current.revision}`,runId:next.id});
      os.put(structuredClone(next));if(checkpoint)os.put(structuredClone(checkpoint));
    };
    tx.oncomplete=()=>resolve(structuredClone(next));tx.onerror=()=>reject(failure||tx.error);tx.onabort=()=>reject(failure||tx.error||new Error('Creation-run commit aborted.'));
  });
}
const api=Object.freeze({
  commitDocumentChange,commitCreationRun,
  getDocumentRevision(sessionId,revision){return run(ARTIFACT_STORE,'readonly',os=>os.get(`document-revision:${sessionId}:${revision}`))},
  putSession(session){return run(SESSION_STORE,'readwrite',os=>os.put(structuredClone(session)))},
  getSession(id){return run(SESSION_STORE,'readonly',os=>os.get(id))},
  deleteSession(id){return run(SESSION_STORE,'readwrite',os=>os.delete(id))},
  listSessions(){return run(SESSION_STORE,'readonly',os=>os.getAll())},
  putArtifact(artifact){return run(ARTIFACT_STORE,'readwrite',os=>os.put(structuredClone(artifact)))},
  getArtifact(id){return run(ARTIFACT_STORE,'readonly',os=>os.get(id))},
  deleteArtifact(id){return run(ARTIFACT_STORE,'readwrite',os=>os.delete(id))}
});
globalThis.CivweaveCreatorStoreV1=api;
})();
