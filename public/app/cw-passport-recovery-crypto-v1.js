(()=>{
'use strict';
if(globalThis.CivweavePassportRecoveryCryptoV1)return;
const VERSION='1.0.0',ITERATIONS=250000,enc=new TextEncoder(),dec=new TextDecoder();
const clean=(v,n=100000)=>String(v??'').trim().slice(0,n);
const b64url=bytes=>{let s='';for(const b of bytes instanceof Uint8Array?bytes:new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')};
const fromB64url=value=>{const x=clean(value).replaceAll('-','+').replaceAll('_','/'),p=x+'='.repeat((4-x.length%4)%4);return Uint8Array.from(atob(p),c=>c.charCodeAt(0))};
async function keyFor(secret,salt){if(clean(secret,10000).length<12)throw new RangeError('Recovery secret must be at least 12 characters.');const material=await crypto.subtle.importKey('raw',enc.encode(secret),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function encrypt(secret,payload={}){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(secret,salt),plain=enc.encode(JSON.stringify({schema:'civweave.passport-recovery-capsule.v1',payload,createdAt:new Date().toISOString()})),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);return Object.freeze({schema:'civweave.passport-recovery-ciphertext.v1',algorithm:'PBKDF2-SHA256-250000+AES-GCM-256',iterations:ITERATIONS,salt:b64url(salt),iv:b64url(iv),ciphertext:b64url(cipher)})}
async function decrypt(secret,capsule){if(capsule?.schema!=='civweave.passport-recovery-ciphertext.v1')throw new TypeError('Unsupported recovery capsule.');const salt=fromB64url(capsule.salt),iv=fromB64url(capsule.iv),cipher=fromB64url(capsule.ciphertext),key=await keyFor(secret,salt),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipher),decoded=JSON.parse(dec.decode(plain));if(decoded?.schema!=='civweave.passport-recovery-capsule.v1')throw new Error('Recovery capsule plaintext is invalid.');return decoded.payload}
const api=Object.freeze({version:VERSION,iterations:ITERATIONS,encrypt,decrypt});globalThis.CivweavePassportRecoveryCryptoV1=api;
try{dispatchEvent(new CustomEvent('civweave:passport-recovery-crypto-ready',{detail:{version:VERSION,iterations:ITERATIONS}}))}catch{}
})();
