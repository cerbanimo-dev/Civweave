(()=>{
'use strict';
const KEY='civweave.host-node.credentials.v1';
const parse=value=>{try{return JSON.parse(value)||{}}catch{return{}}};
function install(origin,nodeId,userId,credential,recoveredAt=''){
  const host=new URL(origin).origin;
  const all=parse(localStorage.getItem(KEY));
  all[`${host}#${String(nodeId).trim()}`]={schema:'civweave.host-node-device-login.v1',userId:String(userId).trim(),credential:String(credential).trim(),createdAt:recoveredAt||new Date().toISOString(),recoveredAt:recoveredAt||new Date().toISOString()};
  localStorage.setItem(KEY,JSON.stringify(all));
  return true;
}
function localFederated(){return document.getElementById('cw-host-node-lobby')?.dataset?.localFederated==='true'}
function installRecoveryBoundary(attempt=0){
  const base=globalThis.CivweaveHubRecoveryApiV1;
  if(!base){if(attempt<30)setTimeout(()=>installRecoveryBoundary(attempt+1),10);return false}
  if(base.localDockerBoundary===true)return true;
  const localError=()=>{throw new Error('Email recovery is not enabled for this local Docker Hub yet. Your existing local Hub login remains unchanged.')};
  globalThis.CivweaveHubRecoveryApiV1=Object.freeze({
    ...base,
    localDockerBoundary:true,
    needsEmail:(...args)=>localFederated()?false:base.needsEmail(...args),
    saveEmail:(...args)=>localFederated()?localError():base.saveEmail(...args),
    enroll:(...args)=>localFederated()?Promise.resolve(null):base.enroll(...args),
    verify:(...args)=>localFederated()?Promise.reject(new Error('Cloud email recovery is not enabled for this local Docker Hub.')):base.verify(...args),
    requestRecovery:(...args)=>localFederated()?Promise.reject(new Error('Cloud email recovery is not enabled for this local Docker Hub.')):base.requestRecovery(...args),
    complete:(...args)=>localFederated()?Promise.reject(new Error('Cloud email recovery is not enabled for this local Docker Hub.')):base.complete(...args),
  });
  return true;
}
setTimeout(()=>installRecoveryBoundary(),0);
globalThis.CivweaveHostNodeSessionImportV1=Object.freeze({install,installRecoveryBoundary});
})();
