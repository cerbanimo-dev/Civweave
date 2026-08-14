const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
export const pendingPaidKey=(nodeId,userId)=>`pending-paid:${clean(nodeId)}:${clean(userId)}`;
export const memberStorageKey=(nodeId,userId)=>`member:${clean(nodeId)}:${clean(userId)}`;
export function validCredentialHash(value){return /^[a-f0-9]{64}$/i.test(clean(value,128));}
export function pendingPaidRecord({nodeId,userId,loginCredentialHash,ttlMs=30*60*1000}){
  if(!nodeId||!/^[A-Za-z0-9:_-]{12,180}$/.test(clean(userId)))throw Object.assign(new TypeError('Valid nodeId and userId are required.'),{status:400});
  if(!validCredentialHash(loginCredentialHash))throw Object.assign(new TypeError('A valid login credential hash is required.'),{status:400});
  const createdAt=new Date().toISOString();
  return Object.freeze({schema:'civweave.pending-paid-admission.v2',nodeId:clean(nodeId),userId:clean(userId),loginCredentialHash:clean(loginCredentialHash,128),createdAt,expiresAt:new Date(Date.parse(createdAt)+Math.max(60_000,Number(ttlMs)||30*60*1000)).toISOString()});
}
