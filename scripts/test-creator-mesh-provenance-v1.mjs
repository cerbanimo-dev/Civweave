import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../public/creator-suite/shared/mesh-provenance-v1.js', import.meta.url), 'utf8');
const created = [];
const mesh = {
  async createObject(input) { created.push(structuredClone(input)); return structuredClone(input); },
  async listObjects() { return structuredClone(created); },
  async syncGateway(origin) { return { ok: true, origin }; },
};
const context = vm.createContext({
  console,
  structuredClone,
  setInterval,
  clearInterval,
  URL,
  location: { href: 'https://civweave.test/creator-suite/' },
  document: { scripts: [], head: { append() {} } },
  CivweaveLocalMeshV146: mesh,
});
vm.runInContext(source, context, { filename: 'mesh-provenance-v1.js' });
const api = context.CivweaveCreatorMeshProvenanceV1;
assert.ok(api, 'mesh provenance API must load');

const receipt = {
  schema: 'civweave.creation-receipt.v1',
  sessionId: 'creation:test',
  mediaType: 'text',
  artifactType: 'document',
  eventCount: 4,
  headHash: 'abc123',
  origin: 'human-authored',
  aiUsed: false,
  finalizedAt: '2026-08-18T12:00:00.000Z',
  receiptHash: 'receipt123',
  events: [{ content: 'private draft must not enter receipt object' }],
};

const local = await api.commitReceipt(receipt, { consent: 'private' });
assert.equal(local.kind, 'civweave.creation-receipt.v1');
assert.equal(local.consent, 'private');
assert.equal(local.publish, false);
assert.equal(local.payload.sessionId, receipt.sessionId);
assert.equal('events' in local.payload, false, 'compact ledger receipt must not contain detailed history');

await assert.rejects(
  () => api.commitReceipt(receipt, { consent: 'direct' }),
  /requires an audience/,
);

await assert.rejects(
  () => api.storeEnvelope({ schema: 'civweave.creation-packet.v1' }, receipt),
  /Only encrypted Creator Suite provenance packets/,
);

const envelope = {
  schema: 'civweave.creation-packet-encrypted.v1',
  algorithm: 'AES-GCM-256',
  iv: 'iv',
  ciphertext: 'ciphertext',
  packetHash: 'packet123',
};
const shared = await api.storeEnvelope(envelope, receipt, { consent: 'group', audience: ['guild:test'] });
assert.equal(shared.kind, 'civweave.creation-provenance-envelope.v1');
assert.equal(shared.consent, 'group');
assert.deepEqual(Array.from(shared.audience), ['guild:test']);
assert.equal(shared.payload.envelope.ciphertext, 'ciphertext');
assert.equal(shared.payload.receipt.sessionId, receipt.sessionId);

const receipts = await api.listReceipts();
assert.equal(receipts.length, 1);
const packets = await api.listEnvelopes();
assert.equal(packets.length, 1);
assert.deepEqual(await api.syncGateway('https://guild.example'), { ok: true, origin: 'https://guild.example' });

console.log('Creator Suite mesh provenance contract passed');
