import{preservesServiceFloor}from'./capacity-service-floor-v1.mjs';
import{prepareMembershipJoin}from'./membership-prejoin-v1.mjs';
export async function prepareCapacityJoin(account,input={}){
  const capacity=await account.snapshot(input.nodeId||'');
  if(!preservesServiceFloor(capacity))throw Object.assign(new RangeError('funded-daily-floor-would-break'),{status:409});
  return prepareMembershipJoin(account,input);
}
