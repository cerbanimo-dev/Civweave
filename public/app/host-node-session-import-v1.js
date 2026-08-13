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
globalThis.CivweaveHostNodeSessionImportV1=Object.freeze({install});
})();
