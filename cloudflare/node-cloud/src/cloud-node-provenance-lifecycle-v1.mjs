import {CivweaveCloudNode as BaseCloudNode,creatorProvenanceInternalToken} from './cloud-node-provenance-v1.mjs';
import {listDeviceAuditRequests,readAuditRequest,updateAuditRequest} from './creator-provenance-audit-v1.mjs';
import {ensureAuditEncryptionIdentity,publicAuditEncryptionIdentity,verifyDeviceProof} from './creator-provenance-evidence-v1.mjs';

const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const headers=Object.freeze({'cache-control':'no-store','content-type':'application/json; charset=utf-8'});
const json=(value,status=200)=>Response.json(value,{status,headers});

export class CivweaveCloudNode extends BaseCloudNode {
  async creatorProvenanceInternal(request,nodeId){
    const url=new URL(request.url),storage=this.state.storage;
    if(url.pathname!=='/internal/creator-provenance/audit/requests'&&url.pathname!=='/internal/creator-provenance/audit/appeal')return super.creatorProvenanceInternal(request,nodeId);
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
        const priorReviews=[...(Array.isArray(auditRequest.priorReviews)?auditRequest.priorReviews:[]),{finding:auditRequest.finding||null,reviewRecord:auditRequest.reviewRecord||null,reviewedAt:auditRequest.reviewedAt||null,reviewReason:auditRequest.reviewReason||null}].slice(-8),filedAt=new Date().toISOString();
        const updated=await updateAuditRequest(storage,message.deviceId,sampleId,{status:'pending-human-review',priorityReason:'dispute',reviewLane:'human',appeal:{schema:'civweave.creator-provenance-appeal.v1',reason,filedAt,memberUserId},appealedAt:filedAt,priorReviews,tribunalVotes:[],tribunalDecision:null,finding:null,reviewRecord:null,reviewedAt:null,reviewReason:'Creator filed a signed provenance appeal; independent Guild human review is required.',originImmutable:true});
        return json({ok:true,nodeId,status:updated.status,appeal:updated.appeal,request:this.publicReviewRequest(updated)});
      }
      return json({ok:false,error:'Method not allowed.'},405);
    }catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500)}
  }
}

export {creatorProvenanceInternalToken};
