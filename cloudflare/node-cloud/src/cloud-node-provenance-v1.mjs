import { CivweaveCloudNode as BaseCloudNode } from './cloud-node-recovery-v2.mjs';
import {
  ingestCreationReceipt,listDeviceAuditRequests,pruneGuildAuditStorage,readAuditRequest,readLatestGuildAudit,
  runGuildDailyAudit,setGuildAuditPolicy,updateAuditRequest,
} from './creator-provenance-audit-v1.mjs';
import {decryptAuditEvidence,ensureAuditEncryptionIdentity,publicAuditEncryptionIdentity,verifyDeviceProof} from './creator-provenance-evidence-v1.mjs';
import {verifyCreationPacket} from '../../../lib/creator-provenance-packet-verify-v1.mjs';
import {analyzeCreationPacket} from '../../../lib/creator-provenance-anomaly-v1.mjs';
import {buildProvenanceReviewRequest,routeProvenanceReview} from '../../../lib/creator-provenance-review-v1.mjs';

const NODE_KEY='creator-provenance:node-id';
const PROOF_PREFIX='creator-provenance:proof:';
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
    const nonceKey=`${PROOF_PREFIX}${message.deviceId}:${message.nonce}`;if(await storage.get(nonceKey))throw Object.assign(new Error('Creator audit device proof was already used.'),{status:409});await storage.put(nonceKey,{usedAt:new Date().toISOString(),deviceId:message.deviceId,action:message.action});return message;
  }
  async creatorProvenanceInternal(request,nodeId){
    if(!await this.authorizeProvenanceInternal(request))return json({ok:false,error:'forbidden'},403);
    const url=new URL(request.url),storage=this.state.storage;
    try{
      if(url.pathname==='/internal/creator-provenance/receipt'&&request.method==='POST'){
        const input=await request.json().catch(()=>({}));await storage.put(NODE_KEY,nodeId);const result=await ingestCreationReceipt(storage,nodeId,input.object);return json({ok:true,...result},result.stored?201:200);
      }
      if(url.pathname==='/internal/creator-provenance/audit/requests'&&request.method==='POST'){
        const input=await request.json().catch(()=>({})),message=await this.consumeDeviceProof(storage,input.proof,input.publicJwk,{nodeId,action:'list-requests'}),requests=await listDeviceAuditRequests(storage,message.deviceId),identity=publicAuditEncryptionIdentity(await ensureAuditEncryptionIdentity(storage,nodeId));
        return json({ok:true,nodeId,deviceId:message.deviceId,requests:requests.map(row=>({...row,deviceCredential:undefined})),auditEncryption:identity});
      }
      if(url.pathname==='/internal/creator-provenance/audit/evidence'&&request.method==='POST'){
        const input=await request.json().catch(()=>({})),sampleId=clean(input.sampleId,700),message=await this.consumeDeviceProof(storage,input.proof,input.publicJwk,{nodeId,action:'submit-evidence',sampleId}),auditRequest=await readAuditRequest(storage,message.deviceId,sampleId);if(!auditRequest)throw Object.assign(new Error('Creator audit request was not found for this device.'),{status:404});
        const storedProof=await verifyDeviceProof(auditRequest.deviceCredential,input.proof);if(!storedProof.valid)throw Object.assign(new Error('Creator audit proof does not match the receipt signing identity.'),{status:403});if(auditRequest.status!=='pending-evidence')return json({ok:true,nodeId,request:auditRequest,idempotent:true});
        const packet=await decryptAuditEvidence(storage,input.envelope,nodeId),receipt=auditRequest.receipt;if(clean(packet.sessionId,240)!==clean(receipt.sessionId,240)||clean(packet.headHash,128)!==clean(receipt.headHash,128))throw Object.assign(new Error('Submitted provenance packet does not match the selected receipt.'),{status:409});
        const verification=await verifyCreationPacket(packet),analysis=analyzeCreationPacket(packet,{verification}),sample={schema:'civweave.creator-audit-sample.v1',sampleId:auditRequest.sampleId,guildId:nodeId,dayKey:auditRequest.dayKey,priorityReason:auditRequest.priorityReason,reviewLane:auditRequest.reviewLane,receipt},reviewLane=routeProvenanceReview(sample,analysis,{allowModelReview:true}),reviewRequest=buildProvenanceReviewRequest({...sample,reviewLane},analysis),updated=await updateAuditRequest(storage,message.deviceId,sampleId,{status:'pending-review',packetVerification:verification,analysis,reviewLane,reviewRequest,evidenceReceivedAt:new Date().toISOString(),rawPacketRetained:false,encryptedEvidenceRetained:false});
        return json({ok:true,nodeId,request:{...updated,deviceCredential:undefined},verification,analysis,reviewLane,reviewRequest,rawPacketRetained:false});
      }
      if(url.pathname==='/internal/creator-provenance/audit/latest'&&request.method==='GET')return json({ok:true,nodeId,audit:await readLatestGuildAudit(storage)});
      if(url.pathname==='/internal/creator-provenance/audit/policy'&&request.method==='POST'){const input=await request.json().catch(()=>({}));return json({ok:true,nodeId,policy:await setGuildAuditPolicy(storage,input.policy||input)});}
      if(url.pathname==='/internal/creator-provenance/audit/run'&&request.method==='POST'){await storage.put(NODE_KEY,nodeId);const result=await runGuildDailyAudit(storage,nodeId,await this.provenanceSamplingSecret(nodeId));await pruneGuildAuditStorage(storage);return json({ok:true,nodeId,audit:result});}
      return json({ok:false,error:'Not found.'},404);
    }catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500)}
  }
  async alarm(alarmInfo){
    if(typeof super.alarm==='function')await super.alarm(alarmInfo);
    const nodeId=clean(await this.state.storage.get(NODE_KEY),180);if(!nodeId)return;
    try{await runGuildDailyAudit(this.state.storage,nodeId,await this.provenanceSamplingSecret(nodeId));await pruneGuildAuditStorage(this.state.storage);}
    catch(error){console.error('[Civweave] Guild provenance audit alarm failed',error);await this.state.storage.setAlarm(Date.now()+60*60*1000);}
  }
  async fetch(request){const url=new URL(request.url),nodeId=clean(request.headers.get('x-civweave-node-id')||url.searchParams.get('nodeId')||await this.state.storage.get(NODE_KEY),180);if(url.pathname.startsWith('/internal/creator-provenance/')){if(!nodeId)return json({ok:false,error:'nodeId is required.'},400);return this.creatorProvenanceInternal(request,nodeId)}return super.fetch(request)}
}

export async function creatorProvenanceInternalToken(env){return internalToken(env)}
