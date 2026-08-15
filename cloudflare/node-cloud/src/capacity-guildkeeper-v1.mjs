import {CivweaveCapacityAccount as HostingCapacityAccount} from './capacity-hosting-plan-v1.mjs';
import {GUILDKEEPER_POLICY,requiredGuildkeeperCount,guildkeeperExpansionDecision,splitGuildkeeperEarnings} from '../../../public/app/shared/guild-host-resilience-v1.mjs';

export const GUILDKEEPER_GOVERNANCE_SCHEMA='civweave.guildkeeper-governance.v1';
const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const prefix=nodeId=>`guildkeeper:${clean(nodeId,180)}:`;
const key=(nodeId,userId)=>`${prefix(nodeId)}${clean(userId,180)}`;
const primaryId=nodeId=>`host:${clean(nodeId,180)}:primary`;

export class CivweaveCapacityAccount extends HostingCapacityAccount {
  async appointedGuildkeepers(nodeId){
    const id=clean(nodeId,180);if(!id)return[];
    const rows=await this.state.storage.list({prefix:prefix(id)});
    return [...rows.values()].filter(row=>row?.active!==false&&row?.userId).sort((a,b)=>String(a.userId).localeCompare(String(b.userId)));
  }
  async guildkeeperGovernance(nodeId,memberCount=null){
    const id=clean(nodeId,180);if(!id)return null;
    const baseCount=memberCount==null?Number((await super.snapshot(id)).nodeMembers||0):Math.max(0,Number(memberCount)||0);
    const appointed=await this.appointedGuildkeepers(id),recipientIds=[primaryId(id),...appointed.map(row=>row.userId)],required=requiredGuildkeeperCount(baseCount);
    return Object.freeze({schema:GUILDKEEPER_GOVERNANCE_SCHEMA,nodeId:id,membersPerGuildkeeper:GUILDKEEPER_POLICY.membersPerGuildkeeper,memberCount:baseCount,requiredGuildkeepers:required,availableGuildkeepers:recipientIds.length,primaryGuildkeeperId:recipientIds[0],appointedGuildkeepers:Object.freeze(appointed.map(row=>Object.freeze({userId:row.userId,appointedAt:row.appointedAt,label:row.label||null}))),recipientIds:Object.freeze(recipientIds),expansionReady:recipientIds.length>=required,nextAppointmentRequiredAt:recipientIds.length*GUILDKEEPER_POLICY.membersPerGuildkeeper+1});
  }
  async appointGuildkeeper(input={}){
    const nodeId=clean(input.nodeId,180),userId=clean(input.userId,180);if(!nodeId||!userId)throw Object.assign(new TypeError('nodeId and userId are required.'),{status:400});
    const config=await this.config();if(!config.hostNodeIds.includes(nodeId))throw Object.assign(new RangeError('Node is not registered to this capacity account.'),{status:404});
    const member=await this.member(nodeId,userId);if(!member)throw Object.assign(new RangeError('Guildkeeper must already be a Guild member.'),{status:409});
    const storageKey=key(nodeId,userId),prior=await this.state.storage.get(storageKey);if(prior?.active!==false)return{guildkeeper:prior,governance:await this.guildkeeperGovernance(nodeId),idempotent:true};
    const row=Object.freeze({schema:'civweave.guildkeeper.v1',nodeId,userId,label:clean(input.label,180)||null,active:true,appointedAt:new Date().toISOString()});await this.state.storage.put(storageKey,row);
    return{guildkeeper:row,governance:await this.guildkeeperGovernance(nodeId),idempotent:false};
  }
  async removeGuildkeeper(input={}){
    const nodeId=clean(input.nodeId,180),userId=clean(input.userId,180);if(!nodeId||!userId)throw Object.assign(new TypeError('nodeId and userId are required.'),{status:400});
    const row=await this.state.storage.get(key(nodeId,userId));if(!row)return{removed:false,governance:await this.guildkeeperGovernance(nodeId)};
    const governance=await this.guildkeeperGovernance(nodeId),remaining=governance.availableGuildkeepers-1;if(remaining<governance.requiredGuildkeepers)throw Object.assign(new RangeError('Cannot remove this Guildkeeper while the Guild has more than 28 members per remaining Guildkeeper.'),{status:409});
    await this.state.storage.delete(key(nodeId,userId));return{removed:true,governance:await this.guildkeeperGovernance(nodeId)};
  }
  async snapshot(nodeId=''){
    const base=await super.snapshot(nodeId),governance=nodeId?await this.guildkeeperGovernance(nodeId,base.nodeMembers):null;
    return Object.freeze({...base,guildkeeperGovernance:governance});
  }
  async admitMember(input={}){
    const nodeId=clean(input.nodeId,180),userId=clean(input.userId,180);if(!nodeId||!userId)return super.admitMember(input);
    const prior=await this.member(nodeId,userId);if(prior)return super.admitMember(input);
    const base=await super.snapshot(nodeId),governance=await this.guildkeeperGovernance(nodeId,base.nodeMembers),decision=guildkeeperExpansionDecision({currentMemberCount:base.nodeMembers,guildkeeperCount:governance.availableGuildkeepers,additionalMembers:1});
    if(!decision.allowed)throw Object.assign(new RangeError(`Guild expansion requires ${decision.requiredGuildkeepers} Guildkeepers before admitting member ${decision.nextMemberCount}.`),{status:409,code:'GUILDKEEPER_EXPANSION_REQUIRED',governance});
    return super.admitMember(input);
  }
  async decorateHostEarnings(result,nodeId){
    if(!result?.split||!Number.isSafeInteger(Number(result.split.hostCents)))return result;
    const governance=await this.guildkeeperGovernance(nodeId),guildkeeperEarnings=splitGuildkeeperEarnings(Number(result.split.hostCents),governance.recipientIds);
    return Object.freeze({...result,guildkeeperEarnings:Object.freeze({...guildkeeperEarnings,schema:'civweave.guildkeeper-earnings-allocation.v1',membersPerGuildkeeper:GUILDKEEPER_POLICY.membersPerGuildkeeper})});
  }
  async settleMembership(input={}){return this.decorateHostEarnings(await super.settleMembership(input),clean(input.nodeId,180))}
  async settleTopup(input={}){return this.decorateHostEarnings(await super.settleTopup(input),clean(input.nodeId,180))}
  async fetch(request){
    const url=new URL(request.url);
    if(request.method==='POST'&&url.pathname==='/guildkeepers/appoint'){try{return Response.json(await this.appointGuildkeeper(await request.json().catch(()=>({}))));}catch(error){return Response.json({ok:false,error:String(error?.message||error),code:error?.code||null},{status:Number.isSafeInteger(error?.status)?error.status:500})}}
    if(request.method==='POST'&&url.pathname==='/guildkeepers/remove'){try{return Response.json(await this.removeGuildkeeper(await request.json().catch(()=>({}))));}catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:Number.isSafeInteger(error?.status)?error.status:500})}}
    if(request.method==='POST'&&url.pathname==='/guildkeepers/status'){try{const input=await request.json().catch(()=>({}));return Response.json({governance:await this.guildkeeperGovernance(input.nodeId)});}catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:Number.isSafeInteger(error?.status)?error.status:500})}}
    return super.fetch(request);
  }
}
