(()=>{
'use strict';
const VERSION='1.0.133-hub-recovery-api-v5-cloud-fabric-route';
const EMAIL_KEY='civweave.hub-account-recovery-emails.v1';
const SELECTION_KEY='civweave.host-node.selection.v1';
const PASSPORT_KEY='civweave.anarchadia.citizen-console.v139';
const RECOVERED_KEY='civweave.hub-account.recovered-passport-ids.v1';
if(globalThis.CivweaveHubRecoveryApiV1?.version===VERSION)return;
const clean=(v,m=2000)=>String(v??'').trim().slice(0,m);
const parse=(v,f)=>{try{return JSON.parse(v)??f}catch{return f}};
const object=k=>{try{const v=parse(localStorage.getItem(k),{});return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return{}}};
const origin=v=>{try{const u=new URL(clean(v));return u.protocol==='https:'&&!u.username&&!u.password?u.origin:''}catch{return''}};
const session=()=>globalThis.CivweaveHostNodeSessionV1||null;
const lobby=()=>globalThis.CivweaveHostNodeInstallerLobbyV1||null;
function host(){return origin(lobby()?.normalizedHost?.()||object(SELECTION_KEY)?.origin||'')}
function nodeId(){
 const q=clean(new URLSearchParams(location.search).get('node'),180);if(/^[a-z0-9-]{1,120}$/.test(q))return q;
 const s=clean(object(SELECTION_KEY)?.nodeId,180);if(/^[a-z0-9-]{1,120}$/.test(s))return s;
 const live=session()?.publicStatus?.()?.sessions?.find?.(x=>origin(x?.origin)===host()),n=clean(live?.nodeId,180);if(/^[a-z0-9-]{1,120}$/.test(n))return n;
 const meta=clean(document.getElementById('cw-host-node-meta')?.textContent?.split('·')?.[0],180);return /^[a-z0-9-]{1,120}$/.test(meta)?meta:''
}
function accountKey(h=host(),n=nodeId()){return h&&n?`${h}#${n}`:''}
function email(h=host(),n=nodeId()){return clean(object(EMAIL_KEY)[accountKey(h,n)],320).toLowerCase()}
function saveEmail(value,h=host(),n=nodeId()){
 const next=clean(value,320).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next))throw new TypeError('Enter a valid recovery email.');
 const k=accountKey(h,n);if(!k)throw new Error('Choose a Hub and let its status finish loading first.');const all=object(EMAIL_KEY);all[k]=next;localStorage.setItem(EMAIL_KEY,JSON.stringify(all));return next
}
function passport(){try{return clean(parse(localStorage.getItem(PASSPORT_KEY),{})?.passportId,180)}catch{return''}}
function endpoint(path,h=host(),n=nodeId()){
 if(!h||!n)throw new Error('Hub identity is not ready yet.');
 const base=new URL(h),route=clean(path,120).replace(/^\/+/,''),cloudFabric=/^civweave-node-cloud\./i.test(base.hostname);
 return new URL(cloudFabric?`/n/${encodeURIComponent(n)}/api/account/${route}`:`/nodes/${encodeURIComponent(n)}/api/account/${route}`,h)
}
async function post(path,body,h=host(),n=nodeId()){
 const response=await fetch(endpoint(path,h,n),{method:'POST',cache:'no-store',headers:{accept:'application/json','content-type':'application/json','x-civweave-node-id':n},body:JSON.stringify(body||{})});
 const packet=await response.json().catch(()=>({}));if(!response.ok){const e=new Error(clean(packet?.error||`Hub returned HTTP ${response.status}.`,1200));e.status=response.status;e.code=clean(packet?.code,120);throw e}return packet
}
async function enroll(){
 const h=host(),n=nodeId(),mail=email(h,n),identity=globalThis.CivweaveHostNodeSessionExportV1?.current?.(h,n);if(!h||!n||!mail||!identity)return null;
 const packet=await post('signup',{...identity,email:mail,passportId:passport()||undefined},h,n);dispatchEvent(new CustomEvent('civweave:hub-account-enrolled',{detail:{nodeId:n,account:packet.account||null,verificationPending:Boolean(packet.verificationPending),delivery:packet.delivery||null,recoveryKit:packet.recoveryKit||null}}));return packet
}
async function acknowledgeRecoveryKit(){const h=host(),n=nodeId(),identity=globalThis.CivweaveHostNodeSessionExportV1?.current?.(h,n);if(!identity?.userId||!identity?.credential)throw new Error('The signed-in Hub session is required to confirm recovery codes.');return post('recovery/codes/ack',{userId:identity.userId,credential:identity.credential},h,n)}
async function verify(token){const packet=await post('verify',{token:clean(token,400)});dispatchEvent(new CustomEvent('civweave:hub-account-email-verified',{detail:{nodeId:nodeId(),account:packet.account||null}}));return packet}
async function pollVerification(token){const packet=await post('verify/poll',{token:clean(token,400)});if(packet?.verified)dispatchEvent(new CustomEvent('civweave:hub-account-email-verified',{detail:{nodeId:nodeId(),inboundProof:true}}));return packet}
async function requestRecovery(mail){const value=clean(mail,320).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new TypeError('Enter a valid recovery email.');return post('recovery/request',{email:value})}
function installRecovered(packet,h=host(),n=nodeId()){
 if(!packet?.userId||!packet?.credential)return packet;
 globalThis.CivweaveHostNodeSessionImportV1?.install?.(h,n,packet.userId,packet.credential,packet.recoveredAt);
 const ids=Array.isArray(packet.passportIds)?packet.passportIds.map(x=>clean(x,180)).filter(Boolean):[];
 if(ids.length)localStorage.setItem(RECOVERED_KEY,JSON.stringify({schema:'civweave.recovered-passport-associations.v1',nodeId:n,passportIds:ids,recoveredAt:packet.recoveredAt||new Date().toISOString()}));
 dispatchEvent(new CustomEvent('civweave:hub-account-recovered',{detail:{nodeId:n,userId:packet.userId,passportIds:ids,recoveryMethod:packet.recoveryMethod||'email',offlineRecoveryRemaining:Number(packet.offlineRecoveryRemaining||0),recoveredAt:packet.recoveredAt||null}}));return packet
}
async function complete(token){const h=host(),n=nodeId(),packet=await post('recovery/complete',{token:clean(token,400)},h,n);return installRecovered(packet,h,n)}
async function pollRecovery(token){const h=host(),n=nodeId(),packet=await post('recovery/poll',{token:clean(token,400)},h,n);return packet?.ready?installRecovered(packet,h,n):packet}
function needsEmail(){const h=host(),n=nodeId();return Boolean(h&&n&&!session()?.hasCredential?.(h,n)&&!email(h,n))}
globalThis.CivweaveHubRecoveryApiV1=Object.freeze({version:VERSION,host,nodeId,email,saveEmail,enroll,acknowledgeRecoveryKit,verify,pollVerification,requestRecovery,complete,pollRecovery,needsEmail});
})();
