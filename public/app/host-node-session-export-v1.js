(()=>{
'use strict';
const KEY='civweave.host-node.credentials.v1';
const parse=value=>{try{return JSON.parse(value)||{}}catch{return{}}};
function current(origin,nodeId=''){
  const host=new URL(origin).origin;
  const all=parse(localStorage.getItem(KEY));
  const row=all[nodeId?`${host}#${String(nodeId).trim()}`:host]||all[host];
  return row?.userId&&row?.credential?{userId:String(row.userId),credential:String(row.credential)}:null;
}
globalThis.CivweaveHostNodeSessionExportV1=Object.freeze({current});
})();
