import assert from 'node:assert/strict';
import { encryptAuditEvidence, signDeviceProof } from '../public/creator-suite/audit/evidence-crypto-v1.mjs';
import { decryptAuditEvidence, ensureAuditEncryptionIdentity, publicAuditEncryptionIdentity, verifyDeviceProof } from '../cloudflare/node-cloud/src/creator-provenance-evidence-v1.mjs';

class Storage{constructor(){this.rows=new Map()}async get(key){return this.rows.get(key)}async put(key,value){this.rows.set(key,value)}}
const storage=new Storage(),guildIdentity=await ensureAuditEncryptionIdentity(storage,'guild:test',Date.parse('2026-08-18T12:00:00Z')),publicIdentity=publicAuditEncryptionIdentity(guildIdentity);
assert.equal(publicIdentity.publicJwk.d,undefined,'Guild audit public identity must not expose private key material');
const devicePair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),devicePublic=await crypto.subtle.exportKey('jwk',devicePair.publicKey);
const canonical=value=>JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])));
const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(devicePublic)))).toString('base64url').slice(0,24),deviceId=`device:${digest}`;
const proof=await signDeviceProof(devicePair.privateKey,{nodeId:'guild:test',deviceId,action:'list-requests',sampleId:'',timestamp:'2026-08-18T12:00:00.000Z',nonce:'nonce-1234567890'});
assert.equal((await verifyDeviceProof(devicePublic,proof,{now:Date.parse('2026-08-18T12:01:00Z')})).valid,true);
assert.equal((await verifyDeviceProof(devicePublic,{...proof,action:'submit-evidence'},{now:Date.parse('2026-08-18T12:01:00Z')})).valid,false);
assert.equal((await verifyDeviceProof(devicePublic,proof,{now:Date.parse('2026-08-18T13:00:00Z')})).reason,'proof-window');

const packet={schema:'civweave.creation-packet.v1',sessionId:'creation:test',mediaType:'text',artifactType:'document',sourceSystem:'creator-suite',startedAt:'2026-08-18T11:00:00.000Z',updatedAt:'2026-08-18T11:01:00.000Z',eventCount:0,headHash:'head-test',summary:{origin:'human-authored',aiUsed:false},events:[],packetHash:'packet-test'};
const request={requestId:'audit-request:guild:test:sample:1',sampleId:'sample:1',sessionId:'creation:test',receipt:{sessionId:'creation:test',headHash:'head-test'}};
const envelope=await encryptAuditEvidence(packet,request,publicIdentity);
assert.equal(envelope.schema,'civweave.creator-audit-evidence-encrypted.v1');
assert.ok(envelope.ephemeralPublicJwk.x&&envelope.ephemeralPublicJwk.y);
assert.equal(envelope.ephemeralPublicJwk.d,undefined);
const opened=await decryptAuditEvidence(storage,envelope,'guild:test');
assert.deepEqual(opened,packet);
await assert.rejects(()=>decryptAuditEvidence(storage,{...envelope,headHash:'other-head'},'guild:test'));
await assert.rejects(()=>encryptAuditEvidence(packet,{...request,receipt:{...request.receipt,headHash:'wrong'}},publicIdentity),/does not match/);

console.log('Creator selected-evidence browser/Cloudflare crypto contract passed');
