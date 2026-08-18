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
const api=Object.freeze({
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
