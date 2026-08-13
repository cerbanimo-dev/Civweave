import{CivweaveCapacityAccount as BaseCapacityAccount}from'./capacity.mjs';
import{ensureMembershipResident}from'./membership-resident-v1.mjs';
import{prepareCapacityJoin}from'./capacity-prejoin-policy-v1.mjs';
export class CivweaveCapacityAccount extends BaseCapacityAccount{
  async fetch(request){
    const url=new URL(request.url),input=request.method==='POST'?await request.clone().json().catch(()=>({})):{};
    try{
      if(request.method==='POST'&&url.pathname==='/members/prepare-membership')return Response.json(await prepareCapacityJoin(this,input));
      if(request.method==='POST'&&url.pathname==='/members/ensure-membership-resident')return Response.json({member:await ensureMembershipResident(this,input)});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:Number.isSafeInteger(error?.status)?error.status:500});}
    return super.fetch(request);
  }
}
