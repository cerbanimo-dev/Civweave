import{CivweaveCloudNode as BaseCloudNode}from'./index.mjs';
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
async function capacityJson(node,pathname,body){const response=await node.capacityStub().fetch(`https://capacity.internal${pathname}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(payload.error||`Capacity returned HTTP ${response.status}`),{status:response.status});return payload;}
export class CivweaveCloudNode extends BaseCloudNode{
  async applyPaymentCapacity(nodeId,event){
    if(event?.type==='topup.paid'&&event?.userId){
      return capacityJson(this,'/settlements/topup',{sourceId:event.id,nodeId,userId:clean(event.userId),topupId:clean(event?.metadata?.topupId,240),netServiceCents:Number(event.serviceNetCents||0)});
    }
    if((event?.type==='topup.refunded'||event?.type==='payment.chargeback')&&event?.userId){
      return capacityJson(this,'/settlements/topup-adjustment',{sourceId:event.id,nodeId,userId:clean(event.userId),topupId:clean(event?.metadata?.topupId,240),kind:event.type==='topup.refunded'?'refund':'chargeback',systemCreditCents:Number(event.userCreditCents||event.amountCents||0)});
    }
    if(event?.type==='membership.paid'&&event?.userId){
      await capacityJson(this,'/members/ensure-membership-resident',{nodeId,userId:clean(event.userId),tierId:clean(event.tierId,80)});
    }
    return super.applyPaymentCapacity(nodeId,event);
  }
}
