import{pendingPaidKey,memberStorageKey,validCredentialHash}from'./paid-admission-state-v1.mjs';
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
export async function ensureMembershipResident(account,input={}){
  const nodeId=clean(input.nodeId),userId=clean(input.userId);
  let member=nodeId&&userId?await account.member(nodeId,userId):null;
  if(member)return member;
  const pending=await account.state.storage.get(pendingPaidKey(nodeId,userId));
  const capacity=await account.snapshot(nodeId),at=new Date().toISOString();
  member=Object.freeze({
    schema:'civweave.host-member.v1',nodeId,userId,
    seatClass:'paid-expansion',billingStatus:'paid',membershipTierId:clean(input.tierId,80)||null,
    loginCredentialHash:validCredentialHash(pending?.loginCredentialHash)?pending.loginCredentialHash:null,
    admittedAt:at,updatedAt:at,
    overCapacity:capacity.paidExpansionSeatLimit!=null&&capacity.paidExpansionCount>=capacity.paidExpansionSeatLimit,
  });
  await account.state.storage.put(memberStorageKey(nodeId,userId),member);
  return member;
}
