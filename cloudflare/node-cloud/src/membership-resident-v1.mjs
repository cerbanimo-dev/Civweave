import{pendingPaidKey,memberStorageKey,validCredentialHash}from'./paid-admission-state-v1.mjs';
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
function pendingExpiry(row){const explicit=Date.parse(row?.expiresAt||''),created=Date.parse(row?.createdAt||'');return Number.isFinite(explicit)?explicit:Number.isFinite(created)?created+30*60*1000:0;}
export async function ensureMembershipResident(account,input={}){
  const nodeId=clean(input.nodeId),userId=clean(input.userId);
  if(!nodeId||!/^[A-Za-z0-9:_-]{12,180}$/.test(userId))throw Object.assign(new TypeError('Valid nodeId and userId are required.'),{status:400});
  let member=await account.member(nodeId,userId);
  if(member)return member;
  const pendingKey=pendingPaidKey(nodeId,userId),pending=await account.state.storage.get(pendingKey);
  if(!pending||!validCredentialHash(pending.loginCredentialHash))throw Object.assign(new RangeError('Membership settlement has no matching device-bound prejoin.'),{status:409});
  const expires=pendingExpiry(pending);
  if(expires&&expires<=Date.now()){await account.state.storage.delete(pendingKey);throw Object.assign(new RangeError('Membership prejoin reservation expired.'),{status:409});}
  const capacity=await account.snapshot(nodeId),at=new Date().toISOString();
  member=Object.freeze({
    schema:'civweave.host-member.v2',nodeId,userId,
    seatClass:'paid-expansion',billingStatus:'paid',membershipTierId:clean(input.tierId,80)||null,
    loginCredentialHash:pending.loginCredentialHash,
    admittedAt:at,updatedAt:at,
    overCapacity:capacity.memberCount>=Number(capacity.maxMembers||28),
  });
  await account.state.storage.put(memberStorageKey(nodeId,userId),member);
  await account.state.storage.delete(pendingKey);
  return member;
}
