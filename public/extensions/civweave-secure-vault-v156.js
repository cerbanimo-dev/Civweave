(()=>{
'use strict';
const VERSION='1.0.4-v156-post-pr56';
const VAULT_KEY='civweave.encrypted-ai-vault.v156';
const PROFILE_KEY='civweave-model-profiles-v1';
const SHARED_KEY='civweave-shared-model';
const SECRET_KEY='civweave-model-secrets-v1';
const SESSION_KEY='civweave-model-session';
const NATIVE_SECRET_KEY='civweave.model-secret.v1';
const encoder=new TextEncoder(),decoder=new TextDecoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64=value=>Uint8Array.from(atob(String(value||'')),char=>char.charCodeAt(0));
const parse=(value,fallback)=>{try{return JSON.parse(value)||fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
function dispatch(type,detail={}){try{globalThis.dispatchEvent(new CustomEvent(type,{detail:{...detail,at:now(),version:VERSION}}))}catch{}}
async function keyFrom(passphrase,salt,usage){
  const material=await crypto.subtle.importKey('raw',encoder.encode(String(passphrase||'')),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:250000},material,{name:'AES-GCM',length:256},false,usage);
}
function currentSnapshot(){
  return{
    schema:'civweave.ai-vault.snapshot.v156',
    profiles:parse(localStorage.getItem(PROFILE_KEY),{}),
    shared:parse(localStorage.getItem(SHARED_KEY),null),
    secrets:parse(sessionStorage.getItem(SECRET_KEY),{}),
    session:parse(sessionStorage.getItem(SESSION_KEY),{}),
    nativeSecret:sessionStorage.getItem(NATIVE_SECRET_KEY)||'',
    capturedAt:now()
  };
}
function publicStatus(){
  const snapshot=currentSnapshot(),profiles=snapshot.profiles||{},secrets=snapshot.secrets||{};
  const secretCount=Object.keys(secrets).length+(snapshot.session?.apiKey?1:0)+(snapshot.nativeSecret?1:0);
  return{
    version:VERSION,
    remembered:Boolean(localStorage.getItem(VAULT_KEY)),
    unlocked:secretCount>0,
    interactive:profiles.interactive||snapshot.shared?.model||null,
    agentic:profiles.agentic||null,
    agenticEnabled:Boolean(profiles.agenticEnabled),
    secretCount
  };
}
function restore(snapshot){
  if(snapshot?.schema!=='civweave.ai-vault.snapshot.v156')throw new Error('Unsupported Civweave AI vault snapshot.');
  localStorage.setItem(PROFILE_KEY,JSON.stringify(snapshot.profiles||{}));
  if(snapshot.shared)localStorage.setItem(SHARED_KEY,JSON.stringify(snapshot.shared));else localStorage.removeItem(SHARED_KEY);
  sessionStorage.setItem(SECRET_KEY,JSON.stringify(snapshot.secrets||{}));
  sessionStorage.setItem(SESSION_KEY,JSON.stringify(snapshot.session||{}));
  if(snapshot.nativeSecret)sessionStorage.setItem(NATIVE_SECRET_KEY,snapshot.nativeSecret);else sessionStorage.removeItem(NATIVE_SECRET_KEY);
  dispatch('civweave:model-config-changed',{source:'encrypted-vault',profiles:snapshot.profiles||{}});
  dispatch('civweave:vault-unlocked',{status:publicStatus()});
  return publicStatus();
}
async function remember(passphrase){
  if(String(passphrase||'').length<8)throw new Error('Use an encryption passphrase of at least eight characters.');
  const snapshot=currentSnapshot();
  if(!Object.keys(snapshot.secrets||{}).length&&!snapshot.session?.apiKey&&!snapshot.nativeSecret)throw new Error('No session API secret is available to remember. Configure Gemini or another AI source first.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await keyFrom(passphrase,salt,['encrypt']);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(snapshot)));
  localStorage.setItem(VAULT_KEY,JSON.stringify({schema:'civweave.encrypted-ai-vault.v156',kdf:'PBKDF2-SHA256',iterations:250000,cipher:'AES-GCM-256',salt:b64(salt),iv:b64(iv),payload:b64(cipher),savedAt:now()}));
  dispatch('civweave:vault-remembered',{status:publicStatus()});
  return publicStatus();
}
async function unlock(passphrase){
  const stored=parse(localStorage.getItem(VAULT_KEY),null);if(!stored)throw new Error('No encrypted AI vault is stored on this device.');
  try{
    const key=await keyFrom(passphrase,unb64(stored.salt),['decrypt']);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(stored.iv)},key,unb64(stored.payload));
    return restore(JSON.parse(decoder.decode(plain)));
  }catch{throw new Error('The AI vault could not be unlocked. Check the passphrase.');}
}
function lock(){
  sessionStorage.removeItem(SECRET_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(NATIVE_SECRET_KEY);
  dispatch('civweave:vault-locked',{status:publicStatus()});
  return publicStatus();
}
function forget(){localStorage.removeItem(VAULT_KEY);lock();dispatch('civweave:vault-forgotten',{status:publicStatus()});return publicStatus()}
function scrubPlaintext(){
  const keys=['gemini-api-key','civweave-api-key','antigravity-api-key'];let removed=0;
  for(const key of keys)if(localStorage.getItem(key)){localStorage.removeItem(key);removed++}
  if(removed)dispatch('civweave:vault-scrubbed',{removed});return removed;
}
scrubPlaintext();
globalThis.CivweaveSecureVaultV156=Object.freeze({VERSION,remember,unlock,lock,forget,restore,currentSnapshot,status:publicStatus,hasRemembered:()=>Boolean(localStorage.getItem(VAULT_KEY)),scrubPlaintext});
})();
