(()=>{
'use strict';
const VERSION='1.0.1-human-chat-guild-context-ble-roster';
if(globalThis.CivweaveHumanChatGuildContextV1?.version===VERSION)return;
let extensionsStarted=false;
function load(path,ready){
  if(ready?.())return Promise.resolve(true);
  return new Promise(resolve=>{
    const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}}),finish=()=>resolve(Boolean(ready?.()));
    if(existing){existing.addEventListener('load',finish,{once:true});setTimeout(finish,1400);return}
    const script=document.createElement('script');script.src=`${path}?v=${encodeURIComponent(VERSION)}`;script.async=false;script.onload=finish;script.onerror=()=>resolve(false);document.head?.append(script)
  })
}
async function bootExtensions(){
  if(extensionsStarted)return true;extensionsStarted=true;
  await load('/app/guild-membership-mesh-v1.js',()=>Boolean(globalThis.CivweaveGuildMembershipMeshV1));
  await load('/app/ble-object-transport-v1.js',()=>Boolean(globalThis.CivweaveBleObjectTransportV1));
  await load('/app/human-chat-ble-controls-v1.js',()=>Boolean(globalThis.CivweaveHumanChatBleControlsV1));
  try{dispatchEvent(new CustomEvent('civweave:human-chat-local-network-ready',{detail:{version:VERSION,guildRoster:'signed-local-object',ble:'web-central-plus-native-central-peripheral'}}))}catch{}
  return true
}
function sync(){
  const api=globalThis.CivweaveHostNodeSessionV1;if(!api?.publicStatus){void bootExtensions();return null}
  try{
    const status=api.publicStatus(),selected=api.selectedOrigin?.()||'',sessions=Array.isArray(status?.sessions)?status.sessions:[],session=sessions.find(row=>row?.active&&selected&&row.origin===selected)||sessions.find(row=>row?.active)||null;
    if(!session?.nodeId){void bootExtensions();return null}
    document.documentElement.dataset.civweaveNodeId=String(session.nodeId);
    document.documentElement.dataset.civweaveGuildOrigin=String(session.origin||selected||'');
    try{dispatchEvent(new CustomEvent('civweave:human-chat-guild-context',{detail:{nodeId:session.nodeId,origin:session.origin||selected||''}}))}catch{}
    void bootExtensions();
    return{nodeId:session.nodeId,origin:session.origin||selected||''};
  }catch{void bootExtensions();return null}
}
['civweave:host-node-session-ready','civweave:host-node-selected','civweave:host-node-logged-in','civweave:capacity-session-ready','pageshow'].forEach(name=>addEventListener(name,()=>queueMicrotask(sync)));
addEventListener('civweave:human-chat-network-ready',()=>void bootExtensions());
queueMicrotask(sync);
globalThis.CivweaveHumanChatGuildContextV1=Object.freeze({version:VERSION,sync,bootExtensions,source:'active-host-session',guildRoster:'signed-local-object-v1',bleMesh:'object-transport-v1'});
})();
