import assert from 'node:assert/strict';
import {buildC2paManifestIntent,C2PA_SOURCE_TYPES} from '../lib/creator-provenance-c2pa-v1.mjs';

const receipt={schema:'civweave.creation-receipt-summary.v1',sessionId:'creation:c2pa-test',mediaType:'video',artifactType:'video',eventCount:4,headHash:'head-secret-safe',origin:'ai-generated',aiUsed:true,finalizedAt:'2026-08-18T18:00:00.000Z',receiptHash:'receipt-safe'};
const packet={schema:'civweave.creation-packet.v1',sessionId:receipt.sessionId,mediaType:'video',artifactType:'video',eventCount:4,headHash:receipt.headHash,events:[
  {seq:1,timestamp:'2026-08-18T17:00:00.000Z',type:'video.record',actor:{kind:'human',id:'private-human-id'},payload:{content:'PRIVATE CAMERA TRANSCRIPT',contentDigest:'sha256:private-capture'}},
  {seq:2,timestamp:'2026-08-18T17:01:00.000Z',type:'media.import',actor:{kind:'external',id:'private-file-name.mov'},payload:{content:'PRIVATE IMPORT',contentDigest:'sha256:private-import'}},
  {seq:3,timestamp:'2026-08-18T17:02:00.000Z',type:'video.trim',actor:{kind:'civweave-ai',id:'weaveling',provider:'provider-secret',model:'model-secret',requestId:'request-secret'},payload:{prompt:'PRIVATE PROMPT',start:1,end:2}},
  {seq:4,timestamp:'2026-08-18T17:03:00.000Z',type:'session.checkpoint',actor:{kind:'deterministic',id:'creator-suite'},payload:{raw:'PRIVATE CHECKPOINT'}},
]};
const intent=buildC2paManifestIntent({receipt,packet,software:{name:'Civweave Creator Suite',version:'0.8.0'}});
assert.equal(intent.schema,'civweave.c2pa-manifest-intent.v1');
assert.equal(intent.credentialState,'unsigned-intent');
assert.equal(intent.requiresC2paSigner,true);
assert.equal(intent.verifiableCredential,false,'mapping intent must never masquerade as a signed Content Credential');
assert.equal(intent.actions[0].action,'c2pa.created');
assert.equal(intent.actions[0].digitalSourceType,C2PA_SOURCE_TYPES.digitalCapture,'camera recording establishes real-world digital capture at inception');
assert.ok(intent.actions.some(action=>action.action==='c2pa.placed'),'external material must become an ingredient placement rather than human-authored content');
assert.ok(intent.actions.some(action=>action.digitalSourceType===C2PA_SOURCE_TYPES.compositeWithTrainedAlgorithmicMedia),'AI transforms must remain publicly distinguishable from human-only edits');
assert.equal(intent.ingredients.length,1);assert.equal(intent.ingredients[0].relationship,'componentOf');assert.equal(intent.ingredients[0].origin,'unknown');
assert.equal(intent.publicReceipt.sessionId,receipt.sessionId);assert.equal(intent.publicReceipt.headHash,receipt.headHash);assert.equal(intent.publicReceipt.receiptHash,receipt.receiptHash);assert.equal(intent.privateDataExcluded,true);
const serialized=JSON.stringify(intent);
for(const secret of ['PRIVATE CAMERA TRANSCRIPT','PRIVATE IMPORT','PRIVATE PROMPT','PRIVATE CHECKPOINT','private-human-id','private-file-name.mov','provider-secret','model-secret','request-secret','sha256:private-capture','sha256:private-import'])assert.equal(serialized.includes(secret),false,`C2PA public intent leaked ${secret}`);
assert.equal(serialized.includes(packet.events[0].timestamp),false,'per-event timestamps stay private');

const generated=buildC2paManifestIntent({receipt:{...receipt,sessionId:'creation:ai',headHash:'ai-head',receiptHash:'ai-receipt',mediaType:'text',artifactType:'document',origin:'ai-generated',aiUsed:true},packet:{...packet,sessionId:'creation:ai',headHash:'ai-head',mediaType:'text',artifactType:'document',events:[{seq:1,type:'ai.generate',actor:{kind:'civweave-ai',provider:'private',model:'private'},payload:{output:'PRIVATE'}}],eventCount:1}});
assert.equal(generated.actions[0].digitalSourceType,C2PA_SOURCE_TYPES.trainedAlgorithmicMedia);
const human=buildC2paManifestIntent({receipt:{...receipt,sessionId:'creation:human',headHash:'human-head',receiptHash:'human-receipt',mediaType:'text',artifactType:'document',origin:'human-authored',aiUsed:false},packet:{...packet,sessionId:'creation:human',headHash:'human-head',mediaType:'text',artifactType:'document',events:[{seq:1,type:'text.replace',actor:{kind:'human',id:'private'},payload:{content:'PRIVATE'}}],eventCount:1}});
assert.equal(human.actions[0].digitalSourceType,C2PA_SOURCE_TYPES.digitalCreation);
const unknown=buildC2paManifestIntent({receipt:{...receipt,sessionId:'creation:unknown',headHash:'unknown-head',receiptHash:'unknown-receipt',origin:'unknown',aiUsed:false},packet:{...packet,sessionId:'creation:unknown',headHash:'unknown-head',events:[{seq:1,type:'media.import',actor:{kind:'external',id:'file'},payload:{content:'PRIVATE'}}],eventCount:1}});
assert.equal(unknown.actions[0].digitalSourceType,'http://c2pa.org/digitalsourcetype/empty','an imported component in a new project must not be relabeled as a human or AI creation');assert.equal(unknown.ingredients[0].origin,'unknown');

console.log('Creator C2PA public mapping contract passed');
