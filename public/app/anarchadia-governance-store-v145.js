const DB='civweave-anarchadia-governance-v145';
const VERSION=1;
const STATE='state';
const KEYS='keys';
function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,VERSION);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STATE))db.createObjectStore(STATE);if(!db.objectStoreNames.contains(KEYS))db.createObjectStore(KEYS)};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Unable to open the governance vault.'));
  });
}
async function withStore(name,mode,operation){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(name,mode),store=tx.objectStore(name);
    let request;
    try{request=operation(store)}catch(error){db.close();reject(error);return}
    request.onerror=()=>reject(request.error||new Error('Governance vault request failed.'));
    tx.oncomplete=()=>{db.close();resolve(request.result??null)};
    tx.onerror=()=>{db.close();reject(tx.error||new Error('Governance vault transaction failed.'))};
  });
}
export const loadGovernanceState=()=>withStore(STATE,'readonly',store=>store.get('active'));
export const saveGovernanceState=state=>withStore(STATE,'readwrite',store=>store.put(state,'active'));
export const putPrivateKey=(id,key)=>withStore(KEYS,'readwrite',store=>store.put(key,id));
export const getPrivateKey=id=>withStore(KEYS,'readonly',store=>store.get(id));
export const deletePrivateKey=id=>withStore(KEYS,'readwrite',store=>store.delete(id));
export async function exportPublicState(){
  const state=await loadGovernanceState();
  if(!state)return null;
  return structuredClone(state);
}
