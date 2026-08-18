import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = await fs.readFile(new URL('../public/app/content-provenance-v1.js', import.meta.url), 'utf8');

function loadApi(){
  const context = {
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    structuredClone,
    console,
    Date,
    JSON,
    Object,
    Array,
    Set,
    Map,
    Promise,
    Uint8Array,
    CustomEvent: class CustomEvent { constructor(type, init={}){ this.type=type; this.detail=init.detail; } },
    dispatchEvent(){ return true; }
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'content-provenance-v1.js' });
  return context.CivweaveContentProvenanceV1;
}

const api = loadApi();
assert.ok(api, 'content provenance API must load');
assert.equal(typeof api.createSession, 'function');
assert.equal(typeof api.recordEvent, 'function');
assert.equal(typeof api.verifySession, 'function');
assert.equal(typeof api.summarizeSession, 'function');
assert.equal(typeof api.finalizeSession, 'function');
assert.equal(typeof api.makePacket, 'function');

let human = api.createSession({ id:'session-human', mediaType:'text', artifactType:'document', sourceSystem:'cerbanimo' });
human = await api.recordEvent(human, {
  type:'text.insert',
  actor:{ kind:'human', id:'passport:test-human' },
  payload:{ offset:0, length:11, contentDigest:'sha256:hello-world' }
});
human = await api.recordEvent(human, {
  type:'text.format',
  actor:{ kind:'human', id:'passport:test-human' },
  payload:{ range:[0,11], mark:'strong' }
});

const humanVerification = await api.verifySession(human);
assert.equal(humanVerification.valid, true);
assert.equal(humanVerification.eventCount, 2);
assert.equal(humanVerification.headHash, human.headHash);

const humanSummary = api.summarizeSession(human);
assert.equal(humanSummary.origin, 'human-authored');
assert.equal(humanSummary.aiUsed, false);
assert.equal(humanSummary.actorCounts.human, 2);

const humanFinal = await api.finalizeSession(human, { id:'artifact-human', title:'Human draft', metadata:{} });
assert.equal(humanFinal.receipt.schema, 'civweave.creation-receipt.v1');
assert.equal(humanFinal.receipt.origin, 'human-authored');
assert.equal(api.read(humanFinal.artifact).origin, 'human-authored');

let mixed = api.createSession({ id:'session-mixed', mediaType:'text', artifactType:'document', sourceSystem:'cerbanimo' });
mixed = await api.recordEvent(mixed, {
  type:'text.insert',
  actor:{ kind:'human', id:'passport:test-human' },
  payload:{ offset:0, length:7, contentDigest:'sha256:opening' }
});
mixed = await api.recordEvent(mixed, {
  type:'ai.generate',
  actor:{ kind:'civweave-ai', id:'kamiya', provider:'cloudflare-workers-ai', model:'test-model', requestId:'req-1' },
  payload:{ target:'document', acceptedLength:120, outputDigest:'sha256:ai-output' }
});
mixed = await api.recordEvent(mixed, {
  type:'text.replace',
  actor:{ kind:'human', id:'passport:test-human' },
  payload:{ range:[20,40], replacementDigest:'sha256:human-rewrite' }
});

const mixedSummary = api.summarizeSession(mixed);
assert.equal(mixedSummary.origin, 'ai-generated');
assert.equal(mixedSummary.aiUsed, true);
assert.equal(mixedSummary.actorCounts['civweave-ai'], 1);
assert.equal(mixedSummary.actorCounts.human, 2);

const mixedFinal = await api.finalizeSession(mixed, { id:'artifact-mixed', metadata:{} });
assert.equal(mixedFinal.receipt.origin, 'ai-generated');
assert.equal(api.read(mixedFinal.artifact).origin, 'ai-generated');
assert.equal(api.read(mixedFinal.artifact).generation.provider, 'cloudflare-workers-ai');

let external = api.createSession({ id:'session-external', mediaType:'audio', artifactType:'audio', sourceSystem:'civweave' });
external = await api.recordEvent(external, {
  type:'external.import',
  actor:{ kind:'external', id:'file-import' },
  payload:{ mediaType:'audio', contentDigest:'sha256:external-file' }
});
assert.equal(api.summarizeSession(external).origin, 'unknown');

const packet = await api.makePacket(mixed);
assert.equal(packet.schema, 'civweave.creation-packet.v1');
assert.equal(packet.sessionId, mixed.id);
assert.equal(packet.headHash, mixed.headHash);
assert.equal(packet.eventCount, mixed.events.length);
assert.ok(packet.packetHash);
assert.equal(JSON.stringify(packet).includes('full raw private draft'), false);

const tampered = structuredClone(mixed);
tampered.events[0].payload.length = 999;
const tamperedVerification = await api.verifySession(tampered);
assert.equal(tamperedVerification.valid, false);
assert.equal(tamperedVerification.reason, 'event-hash-mismatch');

const reordered = structuredClone(mixed);
[reordered.events[0], reordered.events[1]] = [reordered.events[1], reordered.events[0]];
const reorderedVerification = await api.verifySession(reordered);
assert.equal(reorderedVerification.valid, false);

console.log('content creation provenance contract tests passed');
