(()=>{
'use strict';
const VERSION='1.0.0-human-chat-guild-context-v1';
if(globalThis.CivweaveHumanChatGuildContextV1?.version===VERSION)return;
function sync(){
  const api=globalThis.CivweaveHostNodeSessionV1;if(!api?.publicStatus)return null;
  try{
    const status=api.publicStatus(),selected=api.selectedOrigin?.()||'',sessions=Array.isArray(status?.sessions)?status.sessions:[],session=sessions.find(row=>row?.active&&selected&&row.origin===selected)||sessions.find(row=>row?.active)||null;
    if(!session?.nodeId)return null;
    document.documentElement.dataset.civweaveNodeId=String(session.nodeId);
    document.documentElement.dataset.civweaveGuildOrigin=String(session.origin||selected||'');
    try{dispatchEvent(new CustomEvent('civweave:human-chat-guild-context',{detail:{nodeId:session.nodeId,origin:session.origin||selected||''}}))}catch{}
    return{nodeId:session.nodeId,origin:session.origin||selected||''};
  }catch{return null}
}
['civweave:host-node-session-ready','civweave:host-node-selected','civweave:host-node-logged-in','civweave:capacity-session-ready','pageshow'].forEach(name=>addEventListener(name,()=>queueMicrotask(sync)));
queueMicrotask(sync);
globalThis.CivweaveHumanChatGuildContextV1=Object.freeze({version:VERSION,sync,source:'active-host-session'});
})();
