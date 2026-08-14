(()=>{
'use strict';
const VERSION='hub-mail-claim-v2-private-messaging';
if(globalThis.CivweaveHubMailClaimV1?.version===VERSION)return;
const clean=(v,m=1200)=>String(v??'').trim().slice(0,m);
const api=()=>globalThis.CivweaveHubRecoveryApiV1||null;
const sessionExport=()=>globalThis.CivweaveHostNodeSessionExportV1||null;
let busy=false,pmPromise=null;

function identity(){
 const h=api()?.host?.(),n=api()?.nodeId?.();
 if(!h||!n)return null;
 const current=sessionExport()?.current?.(h,n);
 if(!current?.userId||!current?.credential)return null;
 return {host:h,nodeId:n,userId:clean(current.userId,180),credential:clean(current.credential,400)};
}
function endpoint(host,nodeId){return new URL(`/nodes/${encodeURIComponent(nodeId)}/api/account/mail/claim/request`,host)}
async function requestClaimGrant(){
 if(busy)throw new Error('A private-messaging username claim is already being prepared.');
 const current=identity();if(!current)throw new Error('Join this Hub before choosing a private-messaging username.');
 const response=await fetch(endpoint(current.host,current.nodeId),{method:'POST',cache:'no-store',headers:{accept:'application/json','content-type':'application/json','x-civweave-node-id':current.nodeId},body:JSON.stringify({userId:current.userId,credential:current.credential})});
 const packet=await response.json().catch(()=>({}));
 if(!response.ok||packet?.ok!==true){const error=new Error(clean(packet?.error||`Hub returned HTTP ${response.status}.`,1200));error.status=response.status;throw error}
 if(!clean(packet.claimToken,500))throw new Error('Hub returned an invalid one-use identity claim grant.');
 dispatchEvent(new CustomEvent('civweave:pm-claim-ready',{detail:{nodeId:current.nodeId,expiresAt:packet.expiresAt||null}}));
 return packet;
}
function ensurePm(){
 if(globalThis.CivweavePrivateMessagingV1)return Promise.resolve(globalThis.CivweavePrivateMessagingV1);
 if(pmPromise)return pmPromise;
 pmPromise=new Promise((resolve,reject)=>{
  const src='/app/civweave-private-messaging-v1.js';
  const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===src);
  if(existing){let ticks=0;const timer=setInterval(()=>{if(globalThis.CivweavePrivateMessagingV1){clearInterval(timer);resolve(globalThis.CivweavePrivateMessagingV1)}else if(++ticks>200){clearInterval(timer);reject(new Error('Private messaging did not become ready.'))}},40);return}
  const script=document.createElement('script');script.src=`${src}?v=pm-mail-relay-v1`;script.async=false;script.onload=()=>globalThis.CivweavePrivateMessagingV1?resolve(globalThis.CivweavePrivateMessagingV1):reject(new Error('Private messaging loaded without its API.'));script.onerror=()=>reject(new Error('Private messaging could not load.'));document.head.append(script);
 }).catch(error=>{pmPromise=null;throw error});
 return pmPromise;
}
async function setupPrivateMessaging(username){
 if(busy)throw new Error('Private-messaging setup is already running.');
 busy=true;
 try{
  const pm=await ensurePm();
  const existing=await pm.identity?.();
  if(existing?.username)return {username:existing.username,fingerprint:existing.fingerprint,alreadyConfigured:true};
  const grant=await requestClaimGrant();
  return pm.claimUsername(clean(username,32),grant.claimToken);
 }finally{busy=false}
}
function status(message,state='info'){const node=document.getElementById('cw-hub-mail-status');if(node){node.textContent=message;node.dataset.state=state}}
async function renderConfigured(section){
 try{const pm=await ensurePm(),current=await pm.identity?.();if(!current?.username)return false;const input=section.querySelector('#cw-hub-pm-username'),button=section.querySelector('#cw-hub-mail-claim-button');if(input){input.value=current.username;input.disabled=true}if(button){button.textContent=`@${current.username} ready`;button.disabled=true}status('Private messaging is configured. Nearby mesh is primary; the hidden online relay catches up when internet is available.','ok');return true}catch{return false}
}
function install(){
 const recovery=document.getElementById('cw-hub-recovery-panel');if(!recovery||document.getElementById('cw-hub-mail-claim'))return false;
 const section=document.createElement('section');section.id='cw-hub-mail-claim';section.innerHTML=`<hr><p><strong>Private messaging</strong></p><p class="cw-hub-recovery-note">Choose a unique Civweave username. Civweave invisibly attaches it to an internal <code>_pm</code> relay slot for online store-and-forward delivery. It is <strong>not an email address</strong>, cannot receive internet email, and works with the offline mesh.</p><div class="cw-hub-recovery-row"><label style="display:grid;gap:6px;flex:1">Username<input id="cw-hub-pm-username" autocomplete="username" minlength="3" maxlength="32" pattern="[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]" placeholder="riverfox"></label><button id="cw-hub-mail-claim-button" type="button">Claim username</button></div><p id="cw-hub-mail-status" class="cw-hub-recovery-status" role="status"></p>`;
 recovery.append(section);
 const button=section.querySelector('#cw-hub-mail-claim-button'),input=section.querySelector('#cw-hub-pm-username');
 button?.addEventListener('click',async()=>{const username=clean(input?.value,32).toLowerCase();if(!username){status('Choose a username first.','error');return}button.disabled=true;input.disabled=true;status('Creating your encrypted private-messaging identity…');try{const result=await setupPrivateMessaging(username);button.textContent=`@${result.username} ready`;status('Private messaging is ready. The hidden _pm transport address is never presented as your email. Save the recovery codes from your account kit when shown by the dedicated messaging recovery surface.','ok')}catch(error){status(`Private messaging setup could not finish: ${error.message}`,'error');button.disabled=false;input.disabled=false}});
 void renderConfigured(section);
 return true;
}
function observe(){if(install())return;const watcher=new MutationObserver(()=>{if(install())watcher.disconnect()});watcher.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>watcher.disconnect(),20000)}
function boot(){observe();addEventListener('civweave:host-node-selected',install);addEventListener('civweave:host-node-logged-in',install)}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweaveHubMailClaimV1=Object.freeze({version:VERSION,identity,requestClaim:requestClaimGrant,requestClaimGrant,setupPrivateMessaging,install});
})();
