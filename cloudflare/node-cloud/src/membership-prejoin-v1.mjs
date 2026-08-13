import{pendingPaidKey,memberStorageKey,pendingPaidRecord}from'./paid-admission-state-v1.mjs';
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
export async function prepareMembershipJoin(account,input={}){
  const nodeId=clean(input.nodeId),userId=clean(input.userId),loginCredentialHash=clean(input.loginCredentialHash,128);
  const config=await account.config();
  if(!config.hostNodeIds.includes(nodeId))throw Object.assign(new RangeError('Node is not registered to this capacity account.'),{status:404});
  const existing=await account.member(nodeId,userId);
  if(existing){
    if(existing.loginCredentialHash&&existing.loginCredentialHash!==loginCredentialHash)throw Object.assign(new Error('Host login credential is invalid.'),{status:401});
    if(!existing.loginCredentialHash)await account.state.storage.put(memberStorageKey(nodeId,userId),Object.freeze({...existing,loginCredentialHash,updatedAt:new Date().toISOString()}));
    return{ready:true,existingMember:true,capacity:await account.snapshot(nodeId)};
  }
  const capacity=await account.snapshot(nodeId);
  if(capacity.paidExpansionSeatLimit!=null&&capacity.paidExpansionCount>=capacity.paidExpansionSeatLimit)throw Object.assign(new RangeError('paid-expansion-capacity-full'),{status:409});
  const pending=pendingPaidRecord({nodeId,userId,loginCredentialHash});
  await account.state.storage.put(pendingPaidKey(nodeId,userId),pending);
  return{ready:true,existingMember:false,capacity};
}
