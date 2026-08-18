import {CivweaveCloudNode as BaseCloudNode,creatorProvenanceInternalToken} from './cloud-node-provenance-v1.mjs';
import {listDeviceAuditRequests,readAuditRequest,updateAuditRequest} from './creator-provenance-audit-v1.mjs';
import {ensureAuditEncryptionIdentity,publicAuditEncryptionIdentity,verifyDeviceProof} from './creator-provenance-evidence-v1.mjs';
import {additiveReviewRecord} from '../../../lib/creator-provenance-review-v1.mjs';
import {addTribunalVote,tribunalDecision} from '../../../lib/creator-provenance-tribunal-v1.mjs';
import {verifyReviewEndorsement,reviewEndorsementCommitment} from '../../../public/creator-suite/audit/review-endorsement-v1.mjs';

const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const headers=Object.freeze({'cache-control':'no-store','content-type':'application/json; charset=utf-8'});
const json=(value,status=200)=>Response.json(value,{status,headers});

export class CivweaveCloudNode extends BaseCloudNode {
  publicReviewRequest(row){
    const base=super.publicReviewRequest(row);if(!base)return null;
    const{tribunalVotes,...safe}=base;
    return{...safe,tribunalVoteCount:Array.isArray(row?.tribunalVotes)?row.tribunalVotes.length:0};
  }
  reviewerSafeRequest(row){
    if(!row)return null;
    const{deviceCredential,deviceId,creatorUserId,finding,reviewRecord,findingHistory,reviewHistory,tribunalVotes,tribunalDecision,...safe}=row;
    return{...safe,creatorExcluded:Boolean(creatorUserId),priorFindingsWithheld:Boolean(finding||reviewRecord||findingHistory?.length||reviewHistory?.length),reviewerVotesWithheld:Boolean(tribunalVotes?.length||tribunalDecision)};
  }
  async creatorProvenanceInternal(request,nodeId){
    const url=new URL(request.url),storage=this.state.storage;
    const lifecycleRoute=['/internal/creator-provenance/audit/requests','/internal/creator-provenance/audit/appeal','/internal/creator-provenance/audit/human/pending','/internal/creator-provenance/audit/human/finding'].includes(url.pathname);
    if(!lifecycleRoute)return super.creatorProvenanceInternal(request,nodeId);
    if(!await this.authorizeProvenanceInternal(request))return json({ok:false,error:'forbidden'},403);
    try{
      if(url.pathname==='/internal/creator-provenance/audit/requests'&&request.method==='POST'){
        const input=await request.json().catch(()=>({})),message=await this.consumeDeviceProof(storage,input.proof,input.publicJwk,{nodeId,action:'list-requests'}),requests=await listDeviceAuditRequests(storage,message.deviceId,{status:null}),identity=publicAuditEncryptionIdentity(await ensureAuditEncryptionIdentity(storage,nodeId));
        return json({ok:true,nodeId,deviceId:message.deviceId,requests:requests.map(row=>this.publicReviewRequest(row)),auditEncryption:identity});
      }
      if(url.pathname==='/internal/creator-provenance/audit/appeal'&&request.method==='POST'){
        const input=await request.json().catch(()=>({})),sampleId=clean(input.sampleId,700),message=await this.consumeDeviceProof(storage,input.proof,input.publicJwk,{nodeId,action:'appeal',sampleId}),auditRequest=await readAuditRequest(storage,message.deviceId,sampleId);
        if(!auditRequest)throw Object.assign(new Error('Creator provenance review request was not found.'),{status:404});
        const storedProof=await verifyDeviceProof(auditRequest.deviceCredential,input.proof);if(!storedProof.valid)throw Object.assign(new Error('Creator appeal proof does not match the receipt signing identity.'),{status:403});
        const memberUserId=clean(input.memberUserId,240),creatorUserId=clean(auditRequest.creatorUserId,240);if(!memberUserId||!creatorUserId||memberUserId!==creatorUserId)throw Object.assign(new Error('Only the authenticated creator may appeal this provenance finding.'),{status:403});
        if(auditRequest.status!=='reviewed')throw Object.assign(new Error('Only a completed provenance finding can be appealed.'),{status:409});
        const reason=clean(input.reason,1600);if(!reason)throw Object.assign(new Error('An appeal reason is required.'),{status:400});
        const evidenceReference=clean(input.evidenceReference,600)||null,filedAt=new Date().toISOString(),findingHistory=[...(Array.isArray(auditRequest.findingHistory)?auditRequest.findingHistory:[]),auditRequest.finding].filter(Boolean).slice(-16),reviewHistory=[...(Array.isArray(auditRequest.reviewHistory)?auditRequest.reviewHistory:[]),auditRequest.reviewRecord].filter(Boolean).slice(-16);
        const updated=await updateAuditRequest(storage,message.deviceId,sampleId,{status:'pending-human-review',priorityReason:'dispute',reviewLane:'human',appeal:{schema:'civweave.creator-provenance-appeal.v1',reason,evidenceReference,filedAt},appealCount:Math.max(0,Number(auditRequest.appealCount)||0)+1,appealedAt:filedAt,findingHistory,reviewHistory,tribunalVotes:[],tribunalDecision:null,reviewReason:'Creator filed a signed provenance appeal; independent Guild human review is required.',originImmutable:true});
        return json({ok:true,nodeId,status:updated.status,appeal:updated.appeal,request:this.publicReviewRequest(updated)});
      }
      if(url.pathname==='/internal/creator-provenance/audit/human/pending'&&request.method==='POST'){
        const input=await request.json().catch(()=>({})),memberUserId=clean(input.memberUserId,240);if(!memberUserId)throw Object.assign(new Error('Authenticated Guild member is required for human provenance review.'),{status:401});
        const rows=(await this.requestRows(storage)).filter(row=>row.status==='pending-human-review'&&row.creatorUserId!==memberUserId);
        return json({ok:true,nodeId,requests:rows.map(row=>this.reviewerSafeRequest(row))});
      }
      if(url.pathname==='/internal/creator-provenance/audit/human/finding'&&request.method==='POST'){
        const input=await request.json().catch(()=>({})),memberUserId=clean(input.memberUserId,240),auditRequest=await this.requestBySample(storage,input.sampleId);if(!memberUserId)throw Object.assign(new Error('Authenticated Guild member is required for human provenance review.'),{status:401});if(!auditRequest)throw Object.assign(new Error('Creator provenance review request was not found.'),{status:404});if(auditRequest.creatorUserId&&auditRequest.creatorUserId===memberUserId)throw Object.assign(new Error('The creator may not review their own sampled provenance request.'),{status:403});if(auditRequest.status!=='pending-human-review')throw Object.assign(new Error('Creator provenance request is not awaiting human review.'),{status:409});
        const endorsementVerification=await verifyReviewEndorsement(input.publicJwk,input.endorsement);if(!endorsementVerification.valid)throw Object.assign(new Error(`Creator review endorsement rejected: ${endorsementVerification.reason}`),{status:401});const endorsement=endorsementVerification.message;if(endorsement.nodeId!==nodeId||endorsement.sampleId!==auditRequest.sampleId||endorsement.memberUserId!==memberUserId)throw Object.assign(new Error('Creator review endorsement context does not match this Guild review.'),{status:403});
        const protectedEndorsement={schema:'civweave.creator-provenance-review-endorsement-proof.v1',publicJwk:input.publicJwk,endorsement:input.endorsement},endorsementCommitment=await reviewEndorsementCommitment(input.publicJwk,input.endorsement);
        let tribunal;try{tribunal=addTribunalVote({votes:auditRequest.tribunalVotes||[]},endorsement.finding,{request:auditRequest,reviewerId:memberUserId,endorsement:protectedEndorsement,endorsementCommitment})}catch(error){throw Object.assign(error,{status:/already voted/i.test(String(error.message))?409:400})}const decision=tribunalDecision(tribunal.votes),patch={tribunalVotes:tribunal.votes,tribunalDecision:decision,status:decision.status,originImmutable:true};if(decision.status==='reviewed'){patch.finding=decision.finding;patch.reviewRecord={...additiveReviewRecord(auditRequest.receipt,decision.finding),tribunal:{voteCount:decision.voteCount,endorsementCount:decision.endorsementCount,individualReviewerIdentitiesPublic:false}};patch.reviewedAt=new Date().toISOString();patch.reviewReason='Independent Guild human tribunal reached a device-endorsed decision.'}const updated=await updateAuditRequest(storage,auditRequest.deviceId,auditRequest.sampleId,patch);return json({ok:true,nodeId,status:decision.status,decision,finding:decision.finding,endorsementAccepted:true,endorsementCommitment,request:this.publicReviewRequest(updated)});
      }
      return json({ok:false,error:'Method not allowed.'},405);
    }catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500)}
  }
}

export {creatorProvenanceInternalToken};
