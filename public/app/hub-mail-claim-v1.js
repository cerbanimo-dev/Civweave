(()=>{
'use strict';
const VERSION='hub-mail-claim-v1';
if(globalThis.CivweaveHubMailClaimV1?.version===VERSION)return;
const clean=(v,m=1200)=>String(v??'').trim().slice(0,m);
const api=()=>globalThis.CivweaveHubRecoveryApiV1||null;
const sessionExport=()=>globalThis.CivweaveHostNodeSessionExportV1||null;
let busy=false;

function identity(){
 const h=api()?.host?.(),n=api()?.nodeId?.();
 if(!h||!n)return null;
 const current=sessionExport()?.current?.(h,n);
 if(!current?.userId||!current?.credential)return null;
 return {host:h,nodeId:n,userId:clean(current.userId,180),credential:clean(current.credential,400)};
}
function endpoint(host,nodeId){return new URL(`/nodes/${encodeURIComponent(nodeId)}/api/account/mail/claim/request`,host)}
async function requestClaim(){
 if(busy)throw new Error('A mailbox claim is already being prepared.');
 const current=identity();if(!current)throw new Error('Join this Hub before claiming a Civweave Mail address.');
 busy=true;
 try{
  const response=await fetch(endpoint(current.host,current.nodeId),{method:'POST',cache:'no-store',headers:{accept:'application/json','content-type':'application/json','x-civweave-node-id':current.nodeId},body:JSON.stringify({userId:current.userId,credential:current.credential})});
  const packet=await response.json().catch(()=>({}));
  if(!response.ok||packet?.ok!==true){const error=new Error(clean(packet?.error||`Hub returned HTTP ${response.status}.`,1200));error.status=response.status;throw error}
  const claimUrl=clean(packet.claimUrl,2000);const url=new URL(claimUrl);
  if(url.protocol!=='https:'||url.hostname!=='mail.civweave.cc'||!url.hash.startsWith('#claim='))throw new Error('Hub returned an invalid Civweave Mail claim link.');
  dispatchEvent(new CustomEvent('civweave:mail-claim-ready',{detail:{nodeId:current.nodeId,expiresAt:packet.expiresAt||null}}));
  const opened=window.open(url.href,'_blank','noopener,noreferrer');if(!opened)location.assign(url.href);
  return packet;
 }finally{busy=false}
}
function status(message,state='info'){const node=document.getElementById('cw-hub-mail-status');if(node){node.textContent=message;node.dataset.state=state}}
function install(){
 const recovery=document.getElementById('cw-hub-recovery-panel');if(!recovery||document.getElementById('cw-hub-mail-claim'))return false;
 const section=document.createElement('section');section.id='cw-hub-mail-claim';section.innerHTML=`<hr><p><strong>Civweave Mail</strong></p><p class="cw-hub-recovery-note">Claim a private <code>@civweave.cc</code> mailbox. Your Hub only issues a short-lived one-use claim grant; Mail keeps its own access key and recovery codes and does not store your Passport ID.</p><div class="cw-hub-recovery-row"><button id="cw-hub-mail-claim-button" type="button">Claim @civweave.cc address</button></div><p id="cw-hub-mail-status" class="cw-hub-recovery-status" role="status"></p>`;
 recovery.append(section);
 const button=section.querySelector('#cw-hub-mail-claim-button');
 button?.addEventListener('click',async()=>{button.disabled=true;status('Preparing a one-time mailbox claim…');try{const packet=await requestClaim();status(`Claim link opened${packet?.expiresAt?`; it expires ${new Date(packet.expiresAt).toLocaleTimeString()}`:''}.`,'ok')}catch(error){status(`Mailbox claim could not start: ${error.message}`,'error')}finally{button.disabled=false}});
 return true;
}
function observe(){if(install())return;const watcher=new MutationObserver(()=>{if(install())watcher.disconnect()});watcher.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>watcher.disconnect(),20000)}
function boot(){observe();addEventListener('civweave:host-node-selected',install);addEventListener('civweave:host-node-logged-in',install)}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweaveHubMailClaimV1=Object.freeze({version:VERSION,identity,requestClaim,install});
})();
