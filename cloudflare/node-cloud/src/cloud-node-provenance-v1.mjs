import { CivweaveCloudNode as BaseCloudNode } from './cloud-node-recovery-v2.mjs';
import {
  ingestCreationReceipt,listDeviceAuditRequests,pruneGuildAuditStorage,readAuditRequest,readLatestGuildAudit,
  runGuildDailyAudit,setGuildAuditPolicy,updateAuditRequest,
} from './creator-provenance-audit-v1.mjs';
import {decryptAuditEvidence,ensureAuditEncryptionIdentity,publicAuditEncryptionIdentity,verifyDeviceProof} from './creator-provenance-evidence-v1.mjs';
import {reviewProvenanceEvidence} from './creator-provenance-reviewer-v1.mjs';
import {verifyCreationPacket} from '../../../lib/creator-provenance-packet-verify-v1.mjs';
import {analyzeCreationPacket} from '../../../lib/creator-provenance-anomaly-v1.mjs';
import {additiveReviewRecord,buildProvenanceReviewRequest,routeProvenanceReview} from '../../../lib/creator-provenance-review-v1.mjs';
import {addTribunalVote,tribunalDecision} from '../../../lib/creator-provenance-tribunal-v1.mjs';

const NODE_KEY='creator-provenance:node-id';
const POLICY_KEY='creator-provenance:policy';
const REQUEST_PREFIX='creator-provenance:request:';
const PROOF_PREFIX='creator-provenance:proof:';
const PROOF_TTL_MS=24*60*60*1000;
const enc=new TextEncoder();
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const headers=Object.freeze({'cache-control':'no-store','content-type':'application/json; charset=utf-8'});
const json=(value,status=200)=>Response.json(value,{status,headers});
function b64(bytes){let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'')}
async function internalToken(env){const source=clean(env.NODE_FABRIC_SESSION_SECRET||env.NODE_FABRIC_OPERATOR_TOKEN,10000);if(source.length<24)throw Object.assign(new Error('Guild internal provenance authority is unavailable.'),{status:503});const digest=await crypto.subtle.digest('SHA-256',enc.encode(`civweave.creator-provenance-internal.v1\0${source}`));return b64(digest)}
async function secretEqual(left,right){const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(String(left||''))),crypto.subtle.digest('SHA-256',enc.encode(String(right||'')))]),aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=aa.length^bb.length;for(let i=0;i<Math.min(aa.length,bb.length);i++)diff|=aa[i]^bb[i];return diff===0}

export class CivweaveCloudNode extends BaseCloudNode {
  async provenanceSamplingSecret(nodeId){const identity=await this.identity(),privatePart=clean(identity?.privateJwk?.d,4000);if(!privatePart)throw new Error('Guild provenance sampling identity is unavailable.');const digest=await crypto.subtle.digest('SHA-256',enc.encode(`civweave.creator-audit-salt.v1\n${nodeId}\n${privatePart}`));return b64(digest)}
  async authorizeProvenanceInternal(request){const supplied=clean(request.headers.get('x-civweave-internal-provenance'),5000),expected=await internalToken(this.env);return secretEqual(supplied,expected)}
  async consumeDeviceProof(storage,proof,publicJwk,expected={}){
    const verification=await verifyDeviceProof(publicJwk,proof);if(!verification.valid)throw Object.assign(new Error(`Creator audit device proof rejected: ${verification.reason}`),{status:401});
    const message=verification.message;if(expected.nodeId&&message.nodeId!==expected.nodeId)throw Object.assign(new Error('Creator audit proof belongs to another Guild.'),{status:403});if(expected.action&&message.action!==expected.action)throw Object.assign(new Error('Creator audit proof action mismatch.'),{status:403});if(expected.sampleId!=null&&message.sampleId!==clean(expected.sampleId,700))throw Object.assign(new Error('Creator audit proof sample mismatch.'),{status:403});
    const nonceKey=`${PROOF_PREFIX}${message.deviceId}:${message.nonce}`;if(await storage.get(nonceKey))throw Object.assign(new Error('Creator audit device proof was already used.'),{status:409});await storage.put(nonceKey,{usedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+PROOF_TTL_MS).toISOString(),deviceId:message.deviceId,action:message.action});return message;
  }
  async pruneDeviceProofs(storage,now=Date.now()){const rows=await storage.list({prefix:PROOF_PREFIX}),deletes=[];for(const[key,row]of rows)if(Date.parse(row?.expiresAt||row?.usedAt||0)<=now)deletes.push(key);if(deletes.length)await storage.delete(deletes);return deletes.length}
  minimumReviewEvidence(packet={},verification={},analysis={}){
    const implicated=new Set((analysis?.anomalies||[]).map(row=>Number(row?.seq)||0).filter(Boolean));if(Number.isInteger(verification?.index)&&verification.index>=0)implicated.add(verification.index+1);
    const actor=value=>({kind:clean(value?.kind,40),id:clean(value?.id,180),provider:clean(value?.provider,120),model:clean(value?.model,180),requestId:clean(value?.requestId,160)});
    const timeline=(packet.events||[]).slice(0,512).map(event=>({seq:Number(event?.seq)||0,type:clean(event?.type,120),actorKind:clean(event?.actor?.kind,40)}));
    const implicatedEvents=(packet.events||[]).filter(event=>implicated.has(Number(event?.seq)||0)).slice(0,24).map(event=>({seq:Number(event.seq)||0,timestamp:clean(event.timestamp,80),type:clean(event.type,120),actor:actor(event.actor),payload:event.payload&&typeof event.payload==='object'?structuredClone(event.payload):{}}));
    return Object.freeze({schema:'civweave.creator-provenance-review-evidence.v1',sessionId:clean(packet.sessionId,240),headHash:clean(packet.headHash,128),eventCount:Number(packet.eventCount)||0,verification:{valid:Boolean(verification?.valid),reason:clean(verification?.reason,120),index:Number.isInteger(verification?.index)?verification.index:null},timeline:Object.freeze(timeline),implicatedEvents:Object.freeze(implicatedEvents),rawCreativeContentIncluded:false});
  }
  async requestRows(storage){const rows=await storage.list({prefix:REQUEST_PREFIX});return[...rows.values()].filter(row=>row?.schema==='civweave.creator-audit-device-request.v1')}
  async requestBySample(storage,sampleId){return(await this.requestRows(storage)).find(row=>row.sampleId===clean(sampleId,700))||null}
  publicReviewRequest(row){if(!row)return null;const{deviceCredential,creatorUserId,...safe}=row;return{...safe,creatorExcluded:Boolean(creatorUserId)}}
  async creatorProvenanceInternal(request,nodeId){
    if(!await this.authorizeProvenanceInternal(request))return json({ok:false,error:'forbidden'},403);
    const url=new URL(request.url),storage=this.state.storage;
    try{
      if(url.pathname==='/internal/creator-provenance/receipt'&&request.method==='POST'){
        const input=await request.json().catch(()=>({}));await storage.put(NODE_KEY,nodeId);const result=await ingestCreationReceipt(storage,nodeId,input.object);return json({ok:true,...result},result.stored?201:200);
      }
      if(url.pathname==='/internal/creator-provenance/audit/requests'&&request.method==='POST'){
        const input=await request.json().catch(()=>({})),message=await this.consumeDeviceProof(storage,input.proof,input.publicJwk,{nodeId,action:'list-requests'}),requests=await listDeviceAuditRequests(storage,message.deviceId),identity=publicAuditEncryptionIdentity(await ensureAuditEncryptionIdentity(storage,nodeId));
        return json({ok:true,nodeId,deviceId:message.deviceId,requests:requests.map(row=>this.publicReviewRequest(row)),auditEncryption:identity});
      }
      if(url.pathname==='/internal/creator-provenance/audit/evidence'&&request.method==='POST'){
        const input=await request.json().catch(()=>({})),sampleId=clean(input.sampleId,700),message=await this.consumeDeviceProof(storage,input.proof,input.publicJwk,{nodeId,action:'submit-evidence',sampleId}),auditRequest=await readAuditRequest(storage,message.deviceId,sampleId);if(!auditRequest)throw Object.assign(new Error('Creator audit request was not found for this device.'),{status:404});
        const storedProof=await verifyDeviceProof(auditRequest.deviceCredential,input.proof);if(!storedProof.valid)throw Object.assign(new Error('Creator audit proof does not match the receipt signing identity.'),{status:403});if(auditRequest.status!=='pending-evidence')return json({ok:true,nodeId,request:this.publicReviewRequest(auditRequest),idempotent:true});
        const packet=await decryptAuditEvidence(storage,input.envelope,nodeId),receipt=auditRequest.receipt;if(clean(packet.sessionId,240)!==clean(receipt.sessionId,240)||clean(packet.headHash,128)!==clean(receipt.headHash,128))throw Object.assign(new Error('Submitted provenance packet does not match the selected receipt.'),{status:409});
        const verification=await verifyCreationPacket(packet),analysis=analyzeCreationPacket(packet,{verification}),policy=await storage.get(POLICY_KEY)||{},sample={schema:'civweave.creator-audit-sample.v1',sampleId:auditRequest.sampleId,guildId:nodeId,dayKey:auditRequest.dayKey,priorityReason:auditRequest.priorityReason,reviewLane:auditRequest.reviewLane,receipt},reviewLane=routeProvenanceReview(sample,analysis,{allowModelReview:policy.modelReviewEnabled===true}),reviewRequest=buildProvenanceReviewRequest({...sample,reviewLane},analysis),reviewEvidence=this.minimumReviewEvidence(packet,verification,analysis),reviewInput={...auditRequest,packetVerification:verification,analysis,reviewLane,reviewRequest},review=await reviewProvenanceEvidence(this.env,reviewInput,{modelReviewEnabled:policy.modelReviewEnabled===true,model:policy.model||this.env.CIVWEAVE_CREATOR_AUDIT_MODEL});
        const updated=await updateAuditRequest(storage,message.deviceId,sampleId,{status:review.status,creatorUserId:clean(input.memberUserId,240)||auditRequest.creatorUserId||null,packetVerification:verification,analysis,reviewLane,reviewRequest,reviewEvidence,finding:review.finding,reviewRecord:review.record,reviewReason:review.reason,evidenceReceivedAt:new Date().toISOString(),reviewedAt:review.status==='reviewed'?new Date().toISOString():null,originImmutable:true,rawPacketRetained:false,encryptedEvidenceRetained:false});
        return json({ok:true,nodeId,request:this.publicReviewRequest(updated),verification,analysis,reviewLane,reviewRequest,finding:review.finding,reviewStatus:review.status,reviewReason:review.reason,rawPacketRetained:false});
      }
      if(url.pathname==='/internal/creator-provenance/audit/human/pending'&&request.method==='POST'){
        const input=await request.json().catch(()=>({})),memberUserId=clean(input.memberUserId,240);if(!memberUserId)throw Object.assign(new Error('Authenticated Guild member is required for human provenance review.'),{status:401});const rows=(await this.requestRows(storage)).filter(row=>row.status==='pending-human-review'&&row.creatorUserId!==memberUserId);return json({ok:true,nodeId,requests:rows.map(row=>this.publicReviewRequest(row))});
      }
      if(url.pathname==='/internal/creator-provenance/audit/human/finding'&&request.method==='POST'){
        const input=await request.json().catch(()=>({})),memberUserId=clean(input.memberUserId,240),auditRequest=await this.requestBySample(storage,input.sampleId);if(!memberUserId)throw Object.assign(new Error('Authenticated Guild member is required for human provenance review.'),{status:401});if(!auditRequest)throw Object.assign(new Error('Creator provenance review request was not found.'),{status:404});if(auditRequest.creatorUserId&&auditRequest.creatorUserId===memberUserId)throw Object.assign(new Error('The creator may not review their own sampled provenance request.'),{status:403});if(auditRequest.status!=='pending-human-review')throw Object.assign(new Error('Creator provenance request is not awaiting human review.'),{status:409});
        let tribunal;try{tribunal=addTribunalVote({votes:auditRequest.tribunalVotes||[]},input.finding||{},{request:auditRequest,reviewerId:memberUserId})}catch(error){throw Object.assign(error,{status:/already voted/i.test(String(error.message))?409:400})}const decision=tribunalDecision(tribunal.votes),patch={tribunalVotes:tribunal.votes,tribunalDecision:decision,status:decision.status,originImmutable:true};if(decision.status==='reviewed'){patch.finding=decision.finding;patch.reviewRecord=additiveReviewRecord(auditRequest.receipt,decision.finding);patch.reviewedAt=new Date().toISOString();patch.reviewReason='Independent Guild human tribunal reached a decision.'}const updated=await updateAuditRequest(storage,auditRequest.deviceId,auditRequest.sampleId,patch);return json({ok:true,nodeId,status:decision.status,decision,finding:decision.finding,request:this.publicReviewRequest(updated)});
      }
      if(url.pathname==='/internal/creator-provenance/audit/latest'&&request.method==='GET')return json({ok:true,nodeId,audit:await readLatestGuildAudit(storage)});
      if(url.pathname==='/internal/creator-provenance/audit/policy'&&request.method==='POST'){const input=await request.json().catch(()=>({}));return json({ok:true,nodeId,policy:await setGuildAuditPolicy(storage,input.policy||input)});}
      if(url.pathname==='/internal/creator-provenance/audit/run'&&request.method==='POST'){await storage.put(NODE_KEY,nodeId);const result=await runGuildDailyAudit(storage,nodeId,await this.provenanceSamplingSecret(nodeId));await pruneGuildAuditStorage(storage);await this.pruneDeviceProofs(storage);return json({ok:true,nodeId,audit:result});}
      return json({ok:false,error:'Not found.'},404);
    }catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500)}
  }
  async alarm(alarmInfo){
    if(typeof super.alarm==='function')await super.alarm(alarmInfo);
    const nodeId=clean(await this.state.storage.get(NODE_KEY),180);if(!nodeId)return;
    try{await runGuildDailyAudit(this.state.storage,nodeId,await this.provenanceSamplingSecret(nodeId));await pruneGuildAuditStorage(this.state.storage);await this.pruneDeviceProofs(this.state.storage);}
    catch(error){console.error('[Civweave] Guild provenance audit alarm failed',error);await this.state.storage.setAlarm(Date.now()+60*60*1000);}
  }
  async fetch(request){const url=new URL(request.url),nodeId=clean(request.headers.get('x-civweave-node-id')||url.searchParams.get('nodeId')||await this.state.storage.get(NODE_KEY),180);if(url.pathname.startsWith('/internal/creator-provenance/')){if(!nodeId)return json({ok:false,error:'nodeId is required.'},400);return this.creatorProvenanceInternal(request,nodeId)}return super.fetch(request)}
}

export async function creatorProvenanceInternalToken(env){return internalToken(env)}
