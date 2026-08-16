(()=>{
'use strict';
const VERSION='hub-passport-account-v1.0.2-passport-bootstrap';
const PASSPORT_KEY='civweave.anarchadia.citizen-console.v139';
const PASSPORT_SCHEMA='civweave.anarchadia-console.v1';
const STATE_KEY='civweave.passport-account.client.v1';
if(globalThis.CivweaveHubPassportAccountV1?.version===VERSION)return;
const clean=(v,m=2000)=>String(v??'').trim().slice(0,m);
const parse=(v,f)=>{try{return JSON.parse(v)??f}catch{return f}};
const origin=v=>{try{const u=new URL(clean(v,1000));return u.protocol==='https:'&&!u.username&&!u.password?u.origin:''}catch{return''}};
const b64u=bytes=>{const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let binary='';for(const byte of data)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'')};
const unb64u=value=>{let s=String(value||'').replaceAll('-','+').replaceAll('_','/');s+='='.repeat((4-s.length%4)%4);return Uint8Array.from(atob(s),c=>c.charCodeAt(0))};
const sessionExport=()=>globalThis.CivweaveHostNodeSessionExportV1||null;
const lobby=()=>globalThis.CivweaveHostNodeInstallerLobbyV1||null;
function selected(){try{return parse(localStorage.getItem('civweave.host-node.selection.v1'),{})}catch{return{}}}
function host(){return origin(lobby()?.normalizedHost?.()||selected()?.origin||'')}
function nodeId(){const q=clean(new URLSearchParams(location.search).get('node'),180);if(/^[a-z0-9-]{1,120}$/.test(q))return q;const s=clean(selected()?.nodeId,180);return /^[a-z0-9-]{1,120}$/.test(s)?s:''}
function generatedPassportId(){
 const uuid=globalThis.crypto?.randomUUID?.();
 if(uuid)return `AC-${uuid.slice(0,8).toUpperCase()}`;
 try{return `AC-${Array.from(globalThis.crypto.getRandomValues(new Uint8Array(4)),byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase()}`}
 catch{return `AC-${Date.now().toString(36).slice(-8).toUpperCase()}`}
}
function passport(){
 try{
  const saved=parse(localStorage.getItem(PASSPORT_KEY),null);
  const existing=clean(saved?.passportId,180);
  if(existing)return existing;
  const passportId=generatedPassportId();
  const next={
   ...(saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{}),
   schema:PASSPORT_SCHEMA,
   passportId,
   proposals:Array.isArray(saved?.proposals)?saved.proposals:[],
   ledger:Array.isArray(saved?.ledger)?saved.ledger:[],
   settings:saved?.settings&&typeof saved.settings==='object'&&!Array.isArray(saved.settings)?saved.settings:{autoRun:true}
  };
  localStorage.setItem(PASSPORT_KEY,JSON.stringify(next));
  dispatchEvent(new CustomEvent('civweave:passport-ready',{detail:{passportId}}));
  return passportId;
 }catch{return''}
}
function identity(h=host(),n=nodeId()){return h&&n?sessionExport()?.current?.(h,n)||null:null}
function key(h=host(),n=nodeId()){return h&&n?`${h}#${n}`:''}
function state(){try{return parse(localStorage.getItem(STATE_KEY),{})||{}}catch{return{}}}
function saveAccount(account,h=host(),n=nodeId()){if(!account||!h||!n)return account;const all=state();all[key(h,n)]={account,updatedAt:new Date().toISOString()};localStorage.setItem(STATE_KEY,JSON.stringify(all));dispatchEvent(new CustomEvent('civweave:passport-account',{detail:{host:h,nodeId:n,account}}));return account}
function current(){return state()?.[key()]?.account||null}
function endpoint(path,h=host(),n=nodeId()){
 if(!h||!n)throw new Error('Guild identity is not ready yet.');
 const base=new URL(h),route=clean(path,140).replace(/^\/+/,''),cloud=/^civweave-node-cloud\./i.test(base.hostname);
 return new URL(cloud?`/n/${encodeURIComponent(n)}/api/account/${route}`:`/nodes/${encodeURIComponent(n)}/api/account/${route}`,h)
}
async function post(path,body,h=host(),n=nodeId()){
 const response=await fetch(endpoint(path,h,n),{method:'POST',cache:'no-store',headers:{accept:'application/json','content-type':'application/json','x-civweave-node-id':n},body:JSON.stringify(body||{})});
 const packet=await response.json().catch(()=>({}));if(!response.ok||packet?.ok===false){const error=new Error(clean(packet?.error||`Guild returned HTTP ${response.status}.`,1200));error.status=response.status;throw error}return packet
}
function authPayload(h=host(),n=nodeId()){
 const login=identity(h,n),passportId=passport();if(!login?.userId||!login?.credential)throw new Error('Join this Guild before setting up the account.');if(!passportId)throw new Error('Passport identity could not be stored on this device.');return{userId:clean(login.userId,180),credential:clean(login.credential,400),passportId}
}
function rp(){return{rpId:location.hostname.toLowerCase(),origin:location.origin}}
function creationOptions(packet){const options=structuredClone(packet.publicKey||{});options.challenge=unb64u(options.challenge);if(options.user?.id)options.user.id=unb64u(options.user.id);if(Array.isArray(options.excludeCredentials))for(const item of options.excludeCredentials)item.id=unb64u(item.id);return options}
function requestOptions(packet){const options=structuredClone(packet.publicKey||{});options.challenge=unb64u(options.challenge);if(Array.isArray(options.allowCredentials))for(const item of options.allowCredentials)item.id=unb64u(item.id);return options}
function registrationBody(credential,token,extra={}){const response=credential?.response;if(!credential||!response?.clientDataJSON||!response?.attestationObject)throw new Error('Passkey registration did not return a complete credential.');return{...extra,token,credentialId:b64u(credential.rawId),clientDataJSON:b64u(response.clientDataJSON),attestationObject:b64u(response.attestationObject),transports:typeof response.getTransports==='function'?response.getTransports():[]}}
function assertionBody(assertion,token,extra={}){const response=assertion?.response;if(!assertion||!response?.clientDataJSON||!response?.authenticatorData||!response?.signature)throw new Error('Passkey authentication did not return a complete assertion.');return{...extra,token,credentialId:b64u(assertion.rawId),clientDataJSON:b64u(response.clientDataJSON),authenticatorData:b64u(response.authenticatorData),signature:b64u(response.signature)}}
async function ensureAccount(){const data={...authPayload(),...rp()};const packet=await post('passport-account/ensure',data);saveAccount(packet.account);return packet}
async function registerCurrentPassport(){
 if(!globalThis.PublicKeyCredential||!navigator.credentials?.create)throw new Error('This device does not support passkeys.');
 const base={...authPayload(),...rp()};let packet=await post('passkey/register/begin',base);if(packet.alreadyRegistered){saveAccount(packet.account);return packet}
 const credential=await navigator.credentials.create({publicKey:creationOptions(packet)});packet=await post('passkey/register/finish',registrationBody(credential,packet.token));saveAccount(packet.account);return packet
}
async function login(accountName,h=host(),n=nodeId()){
 if(!globalThis.PublicKeyCredential||!navigator.credentials?.get)throw new Error('This device does not support passkeys.');
 const begin=await post('passkey/login/begin',{accountName:clean(accountName,64),...rp()},h,n);const assertion=await navigator.credentials.get({publicKey:requestOptions(begin)});const packet=await post('passkey/login/finish',assertionBody(assertion,begin.token),h,n);
 globalThis.CivweaveHostNodeSessionImportV1?.install?.(h,n,packet.userId,packet.credential,packet.recoveredAt);saveAccount(packet.account,h,n);return packet
}
let recoveryChallenge=null;
async function beginRecoveryEmail(email){const base={...authPayload(),email:clean(email,320)};const packet=await post('recovery-email/begin',base);recoveryChallenge={challengeToken:packet.challengeToken,email:clean(email,320)};return packet}
async function finishLink(link,currentGuild,currentNode){
 const targetOrigin=origin(link?.locator?.origin),targetNode=clean(link?.locator?.nodeId,180);if(!targetOrigin||!targetNode)throw new Error('Existing account location is unavailable.');
 const passportId=passport();let begin=await post('passport-link/begin',{proofToken:link.proofToken,passportId,...rp()},targetOrigin,targetNode);
 const assertion=await navigator.credentials.get({publicKey:requestOptions(begin)});let authenticated=await post('passport-link/authenticate',assertionBody(assertion,begin.token,{...rp()}),targetOrigin,targetNode);
 const newCredential=await navigator.credentials.create({publicKey:creationOptions(authenticated)});const packet=await post('passport-link/finish',registrationBody(newCredential,authenticated.token),targetOrigin,targetNode);
 globalThis.CivweaveHostNodeSessionImportV1?.install?.(targetOrigin,targetNode,packet.userId,packet.credential,packet.recoveredAt);saveAccount(packet.account,targetOrigin,targetNode);
 dispatchEvent(new CustomEvent('civweave:passport-account-linked',{detail:{from:{origin:currentGuild,nodeId:currentNode},to:{origin:targetOrigin,nodeId:targetNode},account:packet.account}}));return packet
}
async function verifyRecoveryEmail(code){
 if(!recoveryChallenge?.challengeToken)throw new Error('Request a verification code first.');const h=host(),n=nodeId();const packet=await post('recovery-email/verify',{...authPayload(h,n),challengeToken:recoveryChallenge.challengeToken,code:clean(code,40),hubOrigin:h},h,n);recoveryChallenge=null;
 if(packet.linkRequired)return finishLink(packet,h,n);if(packet.account)saveAccount(packet.account,h,n);return packet
}
function hasPasskey(){const account=current();return Boolean(account&&Number(account.passkeyCount||0)>0)}
async function bootstrap(){try{passport();const packet=await ensureAccount();if(packet?.passportHasPasskey===false)dispatchEvent(new CustomEvent('civweave:passport-passkey-needed',{detail:{account:packet.account}}));return packet}catch{return null}}
function boot(){passport();addEventListener('civweave:host-node-logged-in',()=>void bootstrap());addEventListener('civweave:host-node-selected',()=>dispatchEvent(new CustomEvent('civweave:passport-account',{detail:{account:current()}})));if(identity())void bootstrap()}
const api=Object.freeze({version:VERSION,host,nodeId,passport,identity,current,ensureAccount,registerCurrentPassport,login,beginRecoveryEmail,verifyRecoveryEmail,hasPasskey,bootstrap});
globalThis.CivweaveHubPassportAccountV1=api;if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
