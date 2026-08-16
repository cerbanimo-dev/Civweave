(()=>{
'use strict';
if(globalThis.CivweavePassportIdentityV1)return;

const VERSION='1.2.0';
const STORAGE_KEY='civweave.anarchadia.citizen-console.v139';
const SCHEMA='civweave.anarchadia-console.v1';
const CHAT_KEYCHAIN_SCHEMA='civweave.passport-chat-keychain.v1';
const CHAT_HISTORY_SCHEMA='civweave.passport-chat-key-history.v1';
const CHAT_TRANSITION_SCHEMA='civweave.passport-chat-key-transition.v1';
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const now=()=>new Date().toISOString();
const clone=value=>value==null?value:structuredClone(value);

function createPassportId(){
  const token=crypto?.randomUUID?.().slice(0,8).toUpperCase()||Math.random().toString(36).slice(2,10).toUpperCase();
  return `AC-${token}`;
}

function normalize(saved){
  const source=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
  const passportId=clean(source.passportId)||createPassportId();
  return {
    ...source,
    schema:SCHEMA,
    passportId,
    proposals:Array.isArray(source.proposals)?source.proposals:[],
    ledger:Array.isArray(source.ledger)&&source.ledger.length?source.ledger:[{id:uid('evt'),time:now(),kind:'console-ready',detail:'Citizen Passport initialized locally.'}],
    settings:source.settings&&typeof source.settings==='object'&&!Array.isArray(source.settings)?source.settings:{autoRun:true},
  };
}

function readRecord(){
  let saved=null;
  try{saved=parse(localStorage.getItem(STORAGE_KEY),null)}catch{}
  return{saved,next:normalize(saved)};
}
function persist(record){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(record));return true}catch{return false}}
function ensure(){
  const{saved,next}=readRecord();
  const changed=!saved||saved.schema!==next.schema||clean(saved.passportId)!==next.passportId||!Array.isArray(saved.proposals)||!Array.isArray(saved.ledger)||!saved.settings;
  if(changed)persist(next);
  try{dispatchEvent(new CustomEvent('civweave:passport-ready',{detail:{version:VERSION,passportId:next.passportId,created:!clean(saved?.passportId)}}))}catch{}
  return clone(next);
}

function passportId(){return ensure().passportId}
function snapshot(){return ensure()}

function b64url(bytes){let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64url(value){const raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/'),padded=raw+'='.repeat((4-raw.length%4)%4),binary=atob(padded);return Uint8Array.from(binary,char=>char.charCodeAt(0))}
function normalized(value){if(Array.isArray(value))return value.map(normalized);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())if(value[key]!==undefined)out[key]=normalized(value[key]);return out}return value}
const canonical=value=>JSON.stringify(normalized(value));
async function sha256(value){const bytes=typeof value==='string'?new TextEncoder().encode(value):value;return b64url(await crypto.subtle.digest('SHA-256',bytes))}
async function fingerprint(publicKey){return(await sha256(canonical(publicKey))).slice(0,32)}
function aliasFromFingerprint(value){
  const first=['Amber','Brisk','Cinder','Dappled','Ember','Fern','Glimmer','Harbor','Indigo','Juniper','Kindle','Lumen','Mossy','Nimbus','Ochre','Pollen','Quiet','River','Sable','Thistle','Umber','Velvet','Willow','Yarrow'];
  const second=['Badger','Beacon','Cicada','Comet','Finch','Fox','Heron','Kestrel','Lantern','Lynx','Magpie','Marten','Moth','Otter','Raven','Salamander','Sparrow','Starling','Tern','Vole','Wren'];
  const chars=String(value||'');let acc=0;for(let index=0;index<chars.length;index++)acc=(acc*33+chars.charCodeAt(index))>>>0;
  return`${first[acc%first.length]} ${second[Math.floor(acc/first.length)%second.length]} ${(acc%89)+11}`;
}
async function publicNameForKey(publicKey){return aliasFromFingerprint(await fingerprint(publicKey))}
async function generatePair(){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);return{publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey),privateKey:await crypto.subtle.exportKey('jwk',pair.privateKey)}}
async function signWith(privateKey,value){const key=await crypto.subtle.importKey('jwk',privateKey,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);return b64url(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(canonical(value))))}
async function verifyWith(publicKey,value,signature){try{const key=await crypto.subtle.importKey('jwk',publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unb64url(signature),new TextEncoder().encode(canonical(value)))}catch{return false}}
function entryWithoutHash(entry){const copy={...entry};delete copy.entryHash;return copy}
async function entryHash(entry){return sha256(canonical(entryWithoutHash(entry)))}
function transitionFor(passport,entry){return{schema:CHAT_TRANSITION_SCHEMA,passportId:passport,generation:entry.generation,keyId:entry.keyId,publicKey:entry.publicKey,publicName:entry.publicName,activatedAt:entry.activatedAt,previousKeyId:entry.previousKeyId,previousEntryHash:entry.previousEntryHash}}
function keychainFrom(record){const value=record?.chatIdentity;return value?.schema===CHAT_KEYCHAIN_SCHEMA&&value?.current?.privateKey&&Array.isArray(value?.history)?value:null}
async function makeGenesis(record){
  const pair=await generatePair(),keyId=`pk:${await fingerprint(pair.publicKey)}`,publicName=await publicNameForKey(pair.publicKey),activatedAt=now();
  const entry={schema:CHAT_HISTORY_SCHEMA,generation:1,keyId,publicKey:pair.publicKey,publicName,activatedAt,previousKeyId:null,previousEntryHash:null,transitionSignature:null};entry.entryHash=await entryHash(entry);
  const chatIdentity={schema:CHAT_KEYCHAIN_SCHEMA,generation:1,current:{keyId,publicKey:pair.publicKey,privateKey:pair.privateKey,publicName,activatedAt},history:[entry]};
  const next={...record,chatIdentity};if(!persist(next))throw new Error('Passport chat key could not be persisted.');return chatIdentity
}
async function ensureChatKeychain(){const record=ensure(),existing=keychainFrom(record);return clone(existing||await makeGenesis(record))}
async function chatPublicIdentity(){const record=ensure(),chain=await ensureChatKeychain(),current=chain.current;return{schema:'civweave.passport-chat-public-identity.v1',passportId:record.passportId,generation:chain.generation,keyId:current.keyId,publicKey:clone(current.publicKey),publicName:current.publicName,activatedAt:current.activatedAt}}
async function signChatValue(value){const chain=await ensureChatKeychain();return signWith(chain.current.privateKey,value)}
async function verifyChatValue(publicKey,value,signature){return verifyWith(publicKey,value,signature)}
async function rotateChatKey(){
  const record=ensure(),chain=await ensureChatKeychain(),prior=chain.current,priorEntry=chain.history.at(-1),generation=Number(chain.generation||0)+1,activatedAt=now();
  let pair,publicName;
  do{pair=await generatePair();publicName=await publicNameForKey(pair.publicKey)}while(publicName===prior.publicName);
  const keyId=`pk:${await fingerprint(pair.publicKey)}`;
  const entry={schema:CHAT_HISTORY_SCHEMA,generation,keyId,publicKey:pair.publicKey,publicName,activatedAt,previousKeyId:prior.keyId,previousEntryHash:priorEntry?.entryHash||null,transitionSignature:null};
  entry.transitionSignature=await signWith(prior.privateKey,transitionFor(record.passportId,entry));entry.entryHash=await entryHash(entry);
  const nextChain={schema:CHAT_KEYCHAIN_SCHEMA,generation,current:{keyId,publicKey:pair.publicKey,privateKey:pair.privateKey,publicName,activatedAt},history:[...chain.history,entry]};
  const next={...record,chatIdentity:nextChain};if(!persist(next))throw new Error('Passport key rotation could not be persisted.');
  try{dispatchEvent(new CustomEvent('civweave:passport-chat-key-rotated',{detail:{passportId:record.passportId,generation,keyId,publicName,previousKeyId:prior.keyId}}))}catch{}
  return chatPublicIdentity()
}
async function chatHistory(){const chain=await ensureChatKeychain();return clone(chain.history)}
async function verifyChatHistory(){
  const record=ensure(),chain=await ensureChatKeychain();let previous=null;
  for(const entry of chain.history){
    if(entry?.schema!==CHAT_HISTORY_SCHEMA||await entryHash(entry)!==entry.entryHash)return{ok:false,error:'history-entry-invalid',generation:entry?.generation||null};
    if(entry.previousKeyId!==(previous?.keyId||null)||entry.previousEntryHash!==(previous?.entryHash||null))return{ok:false,error:'history-chain-invalid',generation:entry.generation};
    if(await publicNameForKey(entry.publicKey)!==entry.publicName)return{ok:false,error:'public-name-invalid',generation:entry.generation};
    if(previous&&!await verifyWith(previous.publicKey,transitionFor(record.passportId,entry),entry.transitionSignature))return{ok:false,error:'transition-signature-invalid',generation:entry.generation};
    if(!previous&&entry.transitionSignature!==null)return{ok:false,error:'genesis-signature-invalid',generation:entry.generation};
    previous=entry;
  }
  return{ok:true,count:chain.history.length,generation:chain.generation,head:previous?.entryHash||null,keyId:previous?.keyId||null}
}

const api=Object.freeze({version:VERSION,storageKey:STORAGE_KEY,schema:SCHEMA,chatKeychainSchema:CHAT_KEYCHAIN_SCHEMA,chatHistorySchema:CHAT_HISTORY_SCHEMA,ensure,passportId,snapshot,chatPublicIdentity,signChatValue,verifyChatValue,rotateChatKey,chatHistory,verifyChatHistory,publicNameForKey});
globalThis.CivweavePassportIdentityV1=api;
ensure();
})();