import{pendingPaidKey,memberStorageKey,pendingPaidRecord}from'./paid-admission-state-v1.mjs';
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
function pendingExpiry(row){const explicit=Date.parse(row?.expiresAt||''),created=Date.parse(row?.createdAt||'');return Number.isFinite(explicit)?explicit:Number.isFinite(created)?created+30*60*1000:0;}
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
  const now=Date.now(),pendingRows=await account.state.storage.list({prefix:'pending-paid:'});
  let activePending=0,ownPending=null;
  for(const[key,row]of pendingRows.entries()){
    const expires=pendingExpiry(row);
    if(expires&&expires<=now){await account.state.storage.delete(key);continue;}
    if(key===pendingPaidKey(nodeId,userId))ownPending=row;
    activePending+=1;
  }
  const capacity=await account.snapshot(nodeId);
  if(ownPending)return{ready:true,existingMember:false,pending:true,capacity};
  const hardLimit=Number(capacity.maxMembers||28);
  if(capacity.memberCount+activePending>=hardLimit)throw Object.assign(new RangeError('instance-capacity-full'),{status:409});
  const pending=pendingPaidRecord({nodeId,userId,loginCredentialHash});
  await account.state.storage.put(pendingPaidKey(nodeId,userId),pending);
  return{ready:true,existingMember:false,pending:true,capacity};
}
