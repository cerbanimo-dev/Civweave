import {CivweaveCloudNode as BaseCloudNode,creatorProvenanceInternalToken} from './cloud-node-provenance-v1.mjs';
import {listDeviceAuditRequests,readAuditRequest,updateAuditRequest} from './creator-provenance-audit-v1.mjs';
import {ensureAuditEncryptionIdentity,publicAuditEncryptionIdentity,verifyDeviceProof} from './creator-provenance-evidence-v1.mjs';

const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const headers=Object.freeze({'cache-control':'no-store','content-type':'application/json; charset=utf-8'});
const json=(value,status=200)=>Response.json(value,{status,headers});

export class CivweaveCloudNode extends BaseCloudNode {
  reviewerSafeRequest(row){
    if(!row)return null;
    const{deviceCredential,deviceId,creatorUserId,finding,reviewRecord,findingHistory,reviewHistory,tribunalVotes,tribunalDecision,...safe}=row;
    return{...safe,creatorExcluded:Boolean(creatorUserId),priorFindingsWithheld:Boolean(finding||reviewRecord||findingHistory?.length||reviewHistory?.length),reviewerVotesWithheld:Boolean(tribunalVotes?.length||tribunalDecision)};
  }
  async creatorProvenanceInternal(request,nodeId){
    const url=new URL(request.url),storage=this.state.storage;
    const lifecycleRoute=['/internal/creator-provenance/audit/requests','/internal/creator-provenance/audit/appeal','/internal/creator-provenance/audit/human/pending'].includes(url.pathname);
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
      return json({ok:false,error:'Method not allowed.'},405);
    }catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500)}
  }
}

export {creatorProvenanceInternalToken};
