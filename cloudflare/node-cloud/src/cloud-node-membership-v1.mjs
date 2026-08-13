import{CivweaveCloudNode as BaseCloudNode}from'./index.mjs';
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
export class CivweaveCloudNode extends BaseCloudNode{
  async applyPaymentCapacity(nodeId,event){
    if(event?.type==='membership.paid'&&event?.userId){
      const response=await this.capacityStub().fetch('https://capacity.internal/members/ensure-membership-resident',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({nodeId,userId:clean(event.userId),tierId:clean(event.tierId,80)})
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw Object.assign(new Error(payload.error||`Capacity resident creation returned HTTP ${response.status}`),{status:response.status});
    }
    return super.applyPaymentCapacity(nodeId,event);
  }
}
