import assert from 'node:assert/strict';
import { CivweaveCloudNode, creatorProvenanceInternalToken } from '../cloudflare/node-cloud/src/cloud-node-provenance-v1.mjs';

class Storage{
  constructor(){this.rows=new Map();this.alarm=null}
  async get(key){return this.rows.get(key)}
  async put(key,value){if(typeof key==='object'&&value===undefined)for(const[k,v]of Object.entries(key))this.rows.set(k,v);else this.rows.set(key,value)}
  async list({prefix=''}={}){return new Map([...this.rows].filter(([key])=>key.startsWith(prefix)))}
  async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])this.rows.delete(key)}
  async getAlarm(){return this.alarm}
  async setAlarm(value){this.alarm=Number(value)}
}
const nodeId='guild-test',deviceId='device:test',sampleId='audit:guild-test:sample-human',key=`creator-provenance:request:${deviceId}:${sampleId}`,storage=new Storage();
storage.rows.set(key,{schema:'civweave.creator-audit-device-request.v1',requestId:`audit-request:${sampleId}`,nodeId,dayKey:'2026-08-18',sampleId,sessionId:'creation:human',deviceId,deviceCredential:{kty:'EC',crv:'P-256',x:'x',y:'y'},creatorUserId:'member:creator',receipt:{schema:'civweave.creation-receipt-summary.v1',sessionId:'creation:human',headHash:'head',receiptHash:'receipt',origin:'unknown',aiUsed:false,mediaType:'text'},analysis:{outcome:'anomalous',anomalyCount:1,anomalies:[{code:'bulk-external-paste',severity:'medium',seq:4,detail:'External material entered the session.'}],detectorInferenceUsed:false},reviewRequest:{schema:'civweave.creator-provenance-review-request.v1',reviewId:'review:human',sampleId,receipt:{origin:'unknown'},provenanceAnalysis:{outcome:'anomalous'},privacy:{styleDetectionForbidden:true,retainRawPacket:false}},reviewEvidence:{schema:'civweave.creator-provenance-review-evidence.v1',timeline:[{seq:4,type:'external.paste',actorKind:'external'}]},priorityReason:'routine',reviewLane:'human',status:'pending-human-review',rawPacketRetained:false,encryptedEvidenceRetained:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
const env={NODE_FABRIC_SESSION_SECRET:'tribunal-test-secret-123456789012345'},node=new CivweaveCloudNode({storage},env),token=await creatorProvenanceInternalToken(env),headers={'content-type':'application/json','x-civweave-node-id':nodeId,'x-civweave-internal-provenance':token};
async function post(path,body){const response=await node.fetch(new Request(`https://node.internal${path}?nodeId=${nodeId}`,{method:'POST',headers,body:JSON.stringify(body)}));return{response,body:await response.json()}}
let result=await post('/internal/creator-provenance/audit/human/pending',{memberUserId:'member:a'});
assert.equal(result.response.status,200);assert.equal(result.body.requests.length,1);assert.equal(result.body.requests[0].deviceCredential,undefined);assert.equal(result.body.requests[0].creatorUserId,undefined);assert.deepEqual(result.body.requests[0].reviewEvidence.timeline,[{seq:4,type:'external.paste',actorKind:'external'}]);
result=await post('/internal/creator-provenance/audit/human/pending',{memberUserId:'member:creator'});
assert.equal(result.body.requests.length,0,'creator must not receive their own human review assignment');
result=await post('/internal/creator-provenance/audit/human/finding',{memberUserId:'member:a',sampleId,finding:{outcome:'unknown-origin',confidence:0.9,rationale:'External material remains unverified.'}});
assert.equal(result.response.status,200);assert.equal(result.body.status,'pending-human-review');assert.equal(result.body.decision.requiredVotes,2);
let duplicate=await post('/internal/creator-provenance/audit/human/finding',{memberUserId:'member:a',sampleId,finding:{outcome:'unknown-origin',confidence:0.9,rationale:'Duplicate.'}});
assert.equal(duplicate.response.status,409);
let creator=await post('/internal/creator-provenance/audit/human/finding',{memberUserId:'member:creator',sampleId,finding:{outcome:'verified',confidence:1,rationale:'Self review.'}});
assert.equal(creator.response.status,403);
result=await post('/internal/creator-provenance/audit/human/finding',{memberUserId:'member:b',sampleId,finding:{outcome:'unknown-origin',confidence:0.8,rationale:'No trusted origin was added.'}});
assert.equal(result.response.status,200);assert.equal(result.body.status,'reviewed');assert.equal(result.body.finding.reviewerKind,'human');assert.equal(result.body.finding.outcome,'unknown-origin');
const persisted=storage.rows.get(key);assert.equal(persisted.status,'reviewed');assert.equal(persisted.receipt.origin,'unknown','tribunal may not rewrite creation origin');assert.equal(persisted.originImmutable,true);assert.equal(persisted.rawPacketRetained,false);assert.equal(JSON.stringify(persisted).includes('private draft'),false);

console.log('Cloudflare Creator human tribunal endpoint contract passed');
