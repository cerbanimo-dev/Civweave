import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { CivweaveCloudNode, creatorProvenanceInternalToken } from '../cloudflare/node-cloud/src/cloud-node-provenance-v1.mjs';
import { encryptAuditEvidence, signDeviceProof } from '../public/creator-suite/audit/evidence-crypto-v1.mjs';

class Storage {
  constructor(){this.rows=new Map();this.alarm=null}
  async get(key){return this.rows.get(key)}
  async put(key,value){if(typeof key==='object'&&value===undefined)for(const[k,v]of Object.entries(key))this.rows.set(k,v);else this.rows.set(key,value)}
  async list({prefix=''}={}){return new Map([...this.rows].filter(([key])=>key.startsWith(prefix)))}
  async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])this.rows.delete(key)}
  async getAlarm(){return this.alarm}
  async setAlarm(value){this.alarm=Number(value)}
}

const provenanceSource=await fs.readFile(new URL('../public/app/content-provenance-v1.js',import.meta.url),'utf8');
const browser=vm.createContext({console,crypto,TextEncoder,TextDecoder,structuredClone,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},dispatchEvent(){}});browser.globalThis=browser;
vm.runInContext(provenanceSource,browser,{filename:'content-provenance-v1.js'});
const provenance=browser.CivweaveContentProvenanceV1;
let session=provenance.createSession({id:'creation:evidence-test',mediaType:'text',artifactType:'document',sourceSystem:'creator-suite',startedAt:'2026-08-18T12:00:00.000Z'});
session=await provenance.recordEvent(session,{id:'event:evidence-1',timestamp:'2026-08-18T12:00:01.000Z',type:'text.insert',actor:{kind:'human',id:'creator'},payload:{length:12,contentDigest:'sha256:content'}});
const finalized=await provenance.finalizeSession(session,{id:'artifact:test',metadata:{}}),packet=await provenance.makePacket(finalized.session),receipt=finalized.receipt;

const devicePair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),devicePublic=await crypto.subtle.exportKey('jwk',devicePair.publicKey);
const normalized=value=>Array.isArray(value)?value.map(normalized):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,normalized(value[key])])):value;
const fingerprint=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalized(devicePublic))))).toString('base64url').slice(0,24),deviceId=`device:${fingerprint}`;
const nodeId='guild-test',sampleId='audit:guild-test:2026-08-18:creation:evidence-test:head',requestId=`audit-request:${nodeId}:${sampleId}`;
const storage=new Storage();
storage.rows.set(`creator-provenance:request:${deviceId}:${sampleId}`,{
  schema:'civweave.creator-audit-device-request.v1',requestId,nodeId,dayKey:'2026-08-18',sampleId,sessionId:receipt.sessionId,deviceId,deviceCredential:devicePublic,
  receipt:{schema:'civweave.creation-receipt-summary.v1',sessionId:receipt.sessionId,mediaType:receipt.mediaType,artifactType:receipt.artifactType,eventCount:receipt.eventCount,headHash:receipt.headHash,origin:receipt.origin,aiUsed:receipt.aiUsed,finalizedAt:receipt.finalizedAt,receiptHash:receipt.receiptHash},
  reviewLane:'model',priorityReason:'routine',reviewRequest:{schema:'civweave.creator-provenance-review-request.v1'},status:'pending-evidence',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
});
const env={NODE_FABRIC_SESSION_SECRET:'creator-provenance-test-secret-1234567890'},state={storage},node=new CivweaveCloudNode(state,env),internal=await creatorProvenanceInternalToken(env);
const headers={'content-type':'application/json','x-civweave-node-id':nodeId,'x-civweave-internal-provenance':internal};

const listProof=await signDeviceProof(devicePair.privateKey,{nodeId,deviceId,action:'list-requests',timestamp:new Date().toISOString(),nonce:'list-proof-nonce-123456789'});
let response=await node.fetch(new Request(`https://node.internal/internal/creator-provenance/audit/requests?nodeId=${nodeId}`,{method:'POST',headers,body:JSON.stringify({publicJwk:devicePublic,proof:listProof})})),body=await response.json();
assert.equal(response.status,200);assert.equal(body.requests.length,1);assert.equal(body.requests[0].deviceCredential,undefined);assert.ok(body.auditEncryption.publicJwk);assert.equal(body.auditEncryption.publicJwk.d,undefined);
const auditEncryption=body.auditEncryption,envelope=await encryptAuditEvidence(packet,body.requests[0],auditEncryption),submitProof=await signDeviceProof(devicePair.privateKey,{nodeId,deviceId,action:'submit-evidence',sampleId,timestamp:new Date().toISOString(),nonce:'submit-proof-nonce-123456789'});
response=await node.fetch(new Request(`https://node.internal/internal/creator-provenance/audit/evidence?nodeId=${nodeId}`,{method:'POST',headers,body:JSON.stringify({publicJwk:devicePublic,proof:submitProof,sampleId,envelope})}));body=await response.json();
assert.equal(response.status,200);assert.equal(body.verification.valid,true);assert.equal(body.analysis.outcome,'verified');assert.equal(body.rawPacketRetained,false);assert.equal(body.request.status,'pending-review');assert.equal(body.request.rawPacketRetained,false);assert.equal(body.request.encryptedEvidenceRetained,false);
const persisted=JSON.stringify([...storage.rows.values()]);
assert.equal(persisted.includes(packet.packetHash),false,'plaintext packet hash from detailed evidence must not be persisted in Durable Object state');
assert.equal(persisted.includes(JSON.stringify(packet.events[0].payload)),false,'plaintext packet event payload must not be persisted in Durable Object state');
assert.equal(persisted.includes(envelope.ciphertext),false,'selected evidence ciphertext must be discarded after review extraction');

const replay=await node.fetch(new Request(`https://node.internal/internal/creator-provenance/audit/evidence?nodeId=${nodeId}`,{method:'POST',headers,body:JSON.stringify({publicJwk:devicePublic,proof:submitProof,sampleId,envelope})}));
assert.equal(replay.status,409);assert.match((await replay.json()).error,/already used/);
const wrongPair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),wrongPublic=await crypto.subtle.exportKey('jwk',wrongPair.publicKey),wrongProof=await signDeviceProof(wrongPair.privateKey,{nodeId,deviceId,action:'list-requests',timestamp:new Date().toISOString(),nonce:'wrong-key-proof-nonce-123'});
const wrong=await node.fetch(new Request(`https://node.internal/internal/creator-provenance/audit/requests?nodeId=${nodeId}`,{method:'POST',headers,body:JSON.stringify({publicJwk:wrongPublic,proof:wrongProof})}));
assert.equal(wrong.status,401);

console.log('Cloudflare selected Creator evidence handshake contract passed');
