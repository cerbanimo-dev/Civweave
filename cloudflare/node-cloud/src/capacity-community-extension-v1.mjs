import{
  CivweaveCapacityAccount as BaseCapacityAccount,
  HOST_ECONOMY_SCHEMA,
  admissionDecision,
  splitTopupNetCents,
  centsToMicrocents,
  microcentsToNeurons,
}from'./capacity.mjs';

const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
const whole=(value,label,min=0)=>{const number=Number(value);if(!Number.isSafeInteger(number)||number<min)throw new RangeError(`${label} must be an integer >= ${min}.`);return number;};
const memberKey=(nodeId,userId)=>`member:${clean(nodeId)}:${clean(userId)}`;
const walletKey=(nodeId,userId)=>`credits:${clean(nodeId)}:${clean(userId)}`;
const settlementKey=(kind,sourceId)=>`settlement:${clean(kind,40)}:${clean(sourceId,240)}`;
const topupSharingKey=topupId=>`topup-sharing:${clean(topupId,240)}`;
const topupBackingKey=topupId=>`topup-backing:${clean(topupId,240)}`;
const publicMember=member=>{if(!member||typeof member!=='object')return member;const{loginCredentialHash,...safe}=member;return Object.freeze(safe);};
function pendingExpiry(row){const explicit=Date.parse(row?.expiresAt||''),created=Date.parse(row?.createdAt||'');return Number.isFinite(explicit)?explicit:Number.isFinite(created)?created+30*60*1000:0;}
function normalizeTopupSharing({shareBps,shareMode}={}){
  const mode=clean(shareMode,40).toLowerCase()==='node-equal'?'node-equal':'personal';
  if(mode==='node-equal')return Object.freeze({shareMode:mode,shareBps:10_000});
  const raw=shareBps==null||String(shareBps).trim()===''?500:Number(shareBps);
  if(!Number.isSafeInteger(raw)||raw<500||raw>1000)throw new RangeError('shareBps must be between 500 and 1000.');
  return Object.freeze({shareMode:mode,shareBps:raw});
}

export class CivweaveCapacityAccount extends BaseCapacityAccount{
  async activePendingPaidCount(now=Date.now()){
    const rows=await this.state.storage.list({prefix:'pending-paid:'});let count=0;
    for(const[key,row]of rows.entries()){
      const expires=pendingExpiry(row);
      if(expires&&expires<=now){await this.state.storage.delete(key);continue;}
      count+=1;
    }
    return count;
  }

  async admitMember(input){
    const nodeId=clean(input.nodeId),userId=clean(input.userId);
    if(!nodeId||!userId)throw Object.assign(new TypeError('nodeId and userId are required.'),{status:400});
    const config=await this.config();
    if(!config.hostNodeIds.includes(nodeId))throw Object.assign(new RangeError('Node is not registered to this capacity account.'),{status:404});
    const key=memberKey(nodeId,userId),prior=await this.state.storage.get(key);
    if(prior){
      const suppliedHash=clean(input.loginCredentialHash,128);
      if(prior.loginCredentialHash&&suppliedHash&&suppliedHash!==prior.loginCredentialHash)throw Object.assign(new Error('Host login credential is invalid.'),{status:401});
      const next=!prior.loginCredentialHash&&suppliedHash?Object.freeze({...prior,loginCredentialHash:suppliedHash,updatedAt:new Date().toISOString()}):prior;
      if(next!==prior)await this.state.storage.put(key,next);
      return{member:publicMember(next),capacity:await this.snapshot(nodeId),idempotent:true};
    }
    const capacity=await this.snapshot(nodeId),seatClass=clean(input.seatClass).toLowerCase();
    const pendingPaidReservations=seatClass==='community'?await this.activePendingPaidCount():0;
    const projected=pendingPaidReservations>0?{...capacity,memberCount:capacity.memberCount+pendingPaidReservations}:capacity;
    const decision=admissionDecision({seatClass,billingStatus:input.billingStatus,capacity:projected});
    if(!decision.allowed)throw Object.assign(new RangeError(decision.reason),{status:409});
    const at=new Date().toISOString(),member=Object.freeze({
      schema:'civweave.host-member.v2',nodeId,userId,seatClass,
      billingStatus:clean(input.billingStatus||'free').toLowerCase()==='paid'?'paid':'free',
      membershipTierId:clean(input.membershipTierId)||null,
      loginCredentialHash:clean(input.loginCredentialHash,128)||null,
      admittedAt:at,updatedAt:at,
    });
    await this.state.storage.put(key,member);
    return{member:publicMember(member),capacity:await this.snapshot(nodeId),idempotent:false};
  }

  async setTopupSharing(input){
    const topupId=clean(input.topupId,240),nodeId=clean(input.nodeId),userId=clean(input.userId);
    if(!topupId||!nodeId||!userId)throw Object.assign(new TypeError('topupId, nodeId, and userId are required.'),{status:400});
    if(!await this.member(nodeId,userId))throw Object.assign(new RangeError('Member is not admitted to this node.'),{status:404});
    const normalized=normalizeTopupSharing({shareBps:input.shareBps,shareMode:input.shareMode});
    const record=Object.freeze({schema:'civweave.topup-sharing.v1',topupId,nodeId,userId,...normalized,updatedAt:new Date().toISOString()});
    await this.state.storage.put(topupSharingKey(topupId),record);
    return record;
  }

  async settleTopup(input){
    const nodeId=clean(input.nodeId),userId=clean(input.userId),sourceId=clean(input.sourceId,240),topupId=clean(input.topupId,240);
    if(!await this.member(nodeId,userId))throw Object.assign(new RangeError('Member is not admitted to this node.'),{status:404});
    if(sourceId){const prior=await this.state.storage.get(settlementKey('topup',sourceId));if(prior)return{...prior,idempotent:true};}
    const netServiceCents=whole(input.netServiceCents,'netServiceCents',1),preference=topupId?await this.state.storage.get(topupSharingKey(topupId)):null;
    const split=splitTopupNetCents(netServiceCents),normalized=normalizeTopupSharing({shareBps:input.shareBps??preference?.shareBps,shareMode:input.shareMode??preference?.shareMode});
    const communitySharedCents=normalized.shareMode==='node-equal'?split.systemCents:Math.min(split.systemCents,Math.floor(netServiceCents*normalized.shareBps/10_000));
    const personalCreditCents=Math.max(0,split.systemCents-communitySharedCents),creditBacking=centsToMicrocents(personalCreditCents),communityBacking=centsToMicrocents(communitySharedCents),credits=microcentsToNeurons(creditBacking);
    const config=await this.config();config.creditReserveMicrocents+=creditBacking;config.communityTopupReserveMicrocents=Number(config.communityTopupReserveMicrocents||0)+communityBacking;await this.putConfig(config);
    const key=walletKey(nodeId,userId),wallet=await this.wallet(nodeId,userId),nextWallet={...wallet,balanceNeurons:wallet.balanceNeurons+credits,issuedNeurons:wallet.issuedNeurons+credits,updatedAt:new Date().toISOString()};await this.state.storage.put(key,nextWallet);
    const result={schema:HOST_ECONOMY_SCHEMA,kind:'topup',sourceId:sourceId||null,topupId:topupId||null,split,sharing:{...normalized,communitySharedCents,personalCreditCents},lifetimeCreditsAdded:credits,wallet:nextWallet,capacity:await this.snapshot(nodeId),idempotent:false};
    if(topupId)await this.state.storage.put(topupBackingKey(topupId),{schema:'civweave.topup-backing.v1',topupId,nodeId,userId,systemCents:split.systemCents,personalCreditCents,communitySharedCents,reversedSystemCents:0,reversedPersonalCents:0,reversedCommunityCents:0,updatedAt:new Date().toISOString()});
    if(sourceId)await this.state.storage.put(settlementKey('topup',sourceId),result);
    return result;
  }

  async adjustTopup(input){
    const nodeId=clean(input.nodeId),userId=clean(input.userId),sourceId=clean(input.sourceId,240),kind=clean(input.kind||'refund',40),topupId=clean(input.topupId,240);
    if(!sourceId)throw Object.assign(new TypeError('sourceId is required for a top-up adjustment.'),{status:400});
    const idempotency=settlementKey(`topup-${kind}`,sourceId),prior=await this.state.storage.get(idempotency);if(prior)return{...prior,idempotent:true};
    const backing=topupId?await this.state.storage.get(topupBackingKey(topupId)):null;
    let personalCreditCents,communitySharedCents;
    if(backing&&Number(backing.systemCents)>0){
      const requestedSystemDelta=whole(input.systemCreditCents??input.userCreditCents??input.amountCents??0,'systemCreditCents'),priorSystem=Math.max(0,Number(backing.reversedSystemCents||0)),nextSystem=Math.min(Number(backing.systemCents),priorSystem+requestedSystemDelta),appliedSystemDelta=Math.max(0,nextSystem-priorSystem),targetShared=Math.floor(Number(backing.communitySharedCents||0)*nextSystem/Number(backing.systemCents)),priorShared=Math.max(0,Number(backing.reversedCommunityCents||0));
      communitySharedCents=Math.max(0,targetShared-priorShared);personalCreditCents=Math.max(0,appliedSystemDelta-communitySharedCents);
      await this.state.storage.put(topupBackingKey(topupId),{...backing,reversedSystemCents:nextSystem,reversedPersonalCents:Number(backing.reversedPersonalCents||0)+personalCreditCents,reversedCommunityCents:priorShared+communitySharedCents,updatedAt:new Date().toISOString()});
    }else{
      personalCreditCents=whole(input.personalCreditCents??input.userCreditCents??input.amountCents??0,'personalCreditCents');communitySharedCents=whole(input.communitySharedCents??0,'communitySharedCents');
    }
    if(personalCreditCents<1&&communitySharedCents<1)throw Object.assign(new RangeError('Top-up adjustment has no backed compute to reverse.'),{status:400});
    const debitNeurons=microcentsToNeurons(centsToMicrocents(personalCreditCents)),key=walletKey(nodeId,userId),wallet=await this.wallet(nodeId,userId),recoveredNeurons=Math.min(wallet.balanceNeurons,debitNeurons),debtAddedNeurons=debitNeurons-recoveredNeurons,nextWallet={...wallet,balanceNeurons:wallet.balanceNeurons-recoveredNeurons,debtNeurons:wallet.debtNeurons+debtAddedNeurons,updatedAt:new Date().toISOString()};await this.state.storage.put(key,nextWallet);
    const config=await this.config(),personalBacking=centsToMicrocents(personalCreditCents),communityBacking=centsToMicrocents(communitySharedCents),creditReserveRemoved=Math.min(config.creditReserveMicrocents,personalBacking),communityReserveRemoved=Math.min(Number(config.communityTopupReserveMicrocents||0),communityBacking);
    config.creditReserveMicrocents-=creditReserveRemoved;config.communityTopupReserveMicrocents=Number(config.communityTopupReserveMicrocents||0)-communityReserveRemoved;await this.putConfig(config);
    const result={schema:HOST_ECONOMY_SCHEMA,kind:`topup-${kind}`,sourceId,topupId:topupId||null,personalCreditCents,communitySharedCents,lifetimeCreditsRemoved:recoveredNeurons,debtAddedNeurons,unbackedAdjustmentMicrocents:Math.max(0,personalBacking-creditReserveRemoved)+Math.max(0,communityBacking-communityReserveRemoved),wallet:nextWallet,capacity:await this.snapshot(nodeId),idempotent:false};
    await this.state.storage.put(idempotency,result);return result;
  }

  async fetch(request){
    const url=new URL(request.url);
    if(request.method==='POST'&&url.pathname==='/topups/share-preference'){
      const input=await request.clone().json().catch(()=>({}));
      try{return Response.json(await this.setTopupSharing(input));}catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:Number.isSafeInteger(error?.status)?error.status:500});}
    }
    return super.fetch(request);
  }
}
