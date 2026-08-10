(()=>{
'use strict';
const VERSION='1.0.95-node-operator-local-session-v1';
const SECRET_KEY='civweave.node-ai-operator.internal-secret.v1';
const ATTEMPT_KEY='civweave.node-ai-operator.local-session-attempt.v1';
function stored(key){try{return String(sessionStorage.getItem(key)||'').trim()}catch{return''}}
function store(key,value){try{value?sessionStorage.setItem(key,value):sessionStorage.removeItem(key)}catch{}}
async function bootstrap(){
  if(stored(SECRET_KEY))return;
  if(stored(ATTEMPT_KEY)==='done')return;
  store(ATTEMPT_KEY,'done');
  try{
    const response=await fetch('/api/ai/node/operator/local-session',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},cache:'no-store',body:JSON.stringify({ttlSeconds:28800})});
    if(!response.ok)return;
    const payload=await response.json().catch(()=>({}));
    const token=String(payload?.session||'').trim();
    if(!token.startsWith('cwop1.'))return;
    store(SECRET_KEY,token);
    location.reload();
  }catch{}
}
globalThis.CivweaveNodeAIOperatorLocalSessionV1=Object.freeze({version:VERSION,bootstrap});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',bootstrap,{once:true});else queueMicrotask(bootstrap);
})();
