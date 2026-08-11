(()=>{
'use strict';
if(globalThis.CivweavePassportRecoveryV1)return;
const VERSION='1.0.0';
const clean=(v,n=20000)=>String(v??'').trim().slice(0,n);
const roaming=()=>globalThis.CivweavePassportRoamingV1;
async function ensureSession(origin){const api=roaming();if(!api)throw new Error('Passport roaming runtime is unavailable.');return api.sessionFor(origin)||api.login(origin)}
async function setupPaymentAnchor(origin=location.origin,email=''){const api=roaming();await ensureSession(origin);return api.request(origin,'/api/passport/stripe/setup',{method:'POST',headers:api.authHeaders(origin),body:JSON.stringify({email:clean(email,320)})})}
async function status(origin=location.origin){const api=roaming();await ensureSession(origin);return api.request(origin,'/api/passport/recovery/status',{headers:api.authHeaders(origin)})}
async function storeEncryptedCapsule(origin=location.origin,capsule={}){const api=roaming();await ensureSession(origin);if(capsule?.schema!=='civweave.passport-recovery-ciphertext.v1'||!clean(capsule.ciphertext))throw new TypeError('Recovery capsules must already be client-encrypted before upload.');return api.request(origin,'/api/passport/recovery/capsule',{method:'POST',headers:api.authHeaders(origin),body:JSON.stringify({capsule})})}
async function requestRecovery(origin=location.origin,input={}){const api=roaming();return api.request(origin,'/api/passport/recovery/request',{method:'POST',body:JSON.stringify({passportId:clean(input.passportId,180),recoveryProof:clean(input.recoveryProof,12000)})})}
const api=Object.freeze({version:VERSION,setupPaymentAnchor,status,storeEncryptedCapsule,requestRecovery});globalThis.CivweavePassportRecoveryV1=api;
try{dispatchEvent(new CustomEvent('civweave:passport-recovery-ready',{detail:{version:VERSION}}))}catch{}
})();
