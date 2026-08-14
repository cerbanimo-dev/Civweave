import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  answerRetrievalChallenge,
  buildCanonicalNodePayload,
  createFilesystemBackupStore,
  createNodeReconstructionBackup,
  decodeAbbaResidualExact,
  deriveAbbaCoordinate,
  encodeAbbaResidualExact,
  encodeLosslessChunk,
  pruneBackupStore,
  replicateBackup,
  restoreNodeReconstructionBackup,
  runBackupCycle,
  selectReplicaTargets,
  verifyRetrievalChallenge,
} from '../lib/node-reconstruction-backup-v1.mjs';

function abbaBytes(depth = 7) {
  let bits = [0];
  for (let i = 0; i < depth; i += 1) bits = bits.flatMap((bit) => bit ? [1, 0, 0, 1] : [0, 1, 1, 0]);
  const out = Buffer.alloc(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i += 1) if (bits[i]) out[i >> 3] |= 1 << (7 - (i & 7));
  return out;
}

async function tempStore(prefix) {
  return createFilesystemBackupStore(await mkdtemp(path.join(os.tmpdir(), prefix)));
}

const key = Buffer.alloc(32, 7);

const records = [
  { system: 'anarchadia', path: 'passport/ledger.json', sensitivity: 'portable-private', mediaType: 'application/json', content: { events: [{ id: 'e1', kind: 'XpRewardIssued', amount: 4 }] } },
  { system: 'civweave', path: 'intentions/current.json', sensitivity: 'portable-private', mediaType: 'application/json', content: { wish: 'build a community garden' } },
  { system: 'living-school', path: 'progress.json', sensitivity: 'portable-private', mediaType: 'application/json', content: { competencies: ['soil', 'planning'] } },
];

test('ABBA quarter residual codec round-trips exact bytes', () => {
  for (const source of [Buffer.alloc(0), Buffer.from('civweave'), randomBytes(4097), abbaBytes(8)]) {
    const encoded = encodeAbbaResidualExact(source);
    assert.deepEqual(decodeAbbaResidualExact(encoded), source);
  }
});

test('codec uses ABBA residuals only when minimum-description choice wins', () => {
  const structured = abbaBytes(10);
  const structuredChoice = encodeLosslessChunk(structured, { minimumAbbaSavingsBytes: 0 });
  assert.equal(structuredChoice.codec, 'abba-quarter-residual+deflate/v1');
  const randomChoice = encodeLosslessChunk(randomBytes(16 * 1024), { minimumAbbaSavingsBytes: 64 });
  assert.equal(randomChoice.codec, 'deflate-raw/v1');
});

test('canonical node payload is stable regardless of exporter ordering', () => {
  assert.deepEqual(buildCanonicalNodePayload(records), buildCanonicalNodePayload([...records].reverse()));
});

test('backup encrypts, restores, previews, and rejects tampering', async () => {
  const store = await tempStore('civweave-backup-');
  const result = await createNodeReconstructionBackup({ records, store, encryptionKey: key, keyId: 'node-backup-key-1', sequence: 3, sourceNodeId: 'node-alpha', chunkBytes: 128 });
  assert.equal(result.manifest.sequence, 3);
  assert.equal(result.manifest.sourceNodeId, 'node-alpha');
  assert.ok(result.manifest.chunks.length > 1);
  assert.match(result.manifest.chunks[0].abbaCoordinate, /^r\d+:[0-3]+:b[01]$/);

  const firstObject = await store.getObject(result.manifest.chunks[0].objectId);
  assert.equal(firstObject.includes(Buffer.from('community garden')), false, 'ciphertext must not expose backup plaintext');

  const preview = await restoreNodeReconstructionBackup({ manifest: result.manifest, store, encryptionKey: key, preview: true });
  assert.equal(preview.verified, true);
  assert.equal(preview.recordCount, 3);
  assert.deepEqual(preview.systems, { anarchadia: 1, civweave: 1, 'living-school': 1 });

  const restored = await restoreNodeReconstructionBackup({ manifest: result.manifest, store, encryptionKey: key });
  assert.equal(restored.verified, true);
  const garden = restored.records.find((record) => record.system === 'civweave');
  assert.deepEqual(garden.content, { wish: 'build a community garden' });

  const badManifest = structuredClone(result.manifest);
  badManifest.payloadBytes += 1;
  await assert.rejects(() => restoreNodeReconstructionBackup({ manifest: badManifest, store, encryptionKey: key }), /manifest authentication failed/i);
});

test('non-portable authority and implicit sensitivity are rejected', async () => {
  const store = await tempStore('civweave-backup-secret-');
  await assert.rejects(() => createNodeReconstructionBackup({
    records: [{ system: 'civweave', path: 'auth/session-token.json', sensitivity: 'portable-private', content: 'nope' }],
    store,
    encryptionKey: key,
    keyId: 'k1',
  }), /non-portable authority|credential/i);
  await assert.rejects(() => createNodeReconstructionBackup({
    records: [{ system: 'civweave', path: 'state.json', content: 'missing classification' }],
    store,
    encryptionKey: key,
    keyId: 'k1',
  }), /explicitly use portable/i);
});

test('unchanged chunks reuse content-addressed encrypted objects', async () => {
  const store = await tempStore('civweave-backup-delta-');
  const first = await createNodeReconstructionBackup({ records, store, encryptionKey: key, keyId: 'k1', sequence: 1, chunkBytes: 64 });
  const second = await createNodeReconstructionBackup({ records, store, encryptionKey: key, keyId: 'k1', sequence: 2, previousManifest: first.manifest, chunkBytes: 64 });
  assert.equal(second.newObjects, 0);
  assert.equal(second.reusedObjects, second.manifest.chunkCount);
  assert.equal(second.manifest.nodeRoot, first.manifest.nodeRoot);
});

test('replicas receive encrypted objects and can answer fresh retrieval challenges', async () => {
  const source = await tempStore('civweave-backup-source-');
  const replicaA = await tempStore('civweave-backup-replica-a-');
  const replicaB = await tempStore('civweave-backup-replica-b-');
  const result = await createNodeReconstructionBackup({ records, store: source, encryptionKey: key, keyId: 'k1' });
  const replication = await replicateBackup({ manifest: result.manifest, sourceStore: source, replicaStores: [replicaA, replicaB], requiredReplicas: 2 });
  assert.equal(replication.completed, 2);
  const objectId = result.manifest.chunks[0].objectId;
  const nonce = randomBytes(32).toString('hex');
  const response = await answerRetrievalChallenge(replicaA, objectId, nonce);
  assert.equal(verifyRetrievalChallenge(await source.getObject(objectId), objectId, nonce, response), true);
});

test('scheduled cycle advances sequence and retention removes old manifests safely', async () => {
  const store = await tempStore('civweave-backup-cycle-');
  for (let i = 0; i < 4; i += 1) {
    await runBackupCycle({
      exportRecords: async () => records.map((record) => record.system === 'civweave' ? { ...record, content: { wish: `garden-${i}` } } : record),
      store,
      encryptionKey: key,
      keyId: 'k1',
      retention: 2,
      chunkBytes: 128,
      createdAt: `2026-08-14T0${i}:00:00.000Z`,
    });
  }
  const manifests = await store.listManifests();
  assert.equal(manifests.length, 2);
  assert.deepEqual(manifests.map((manifest) => manifest.sequence), [3, 4]);
  const prune = await pruneBackupStore(store, { keep: 1 });
  assert.equal(prune.keptManifests, 1);
});

test('whole-node root deterministically maps chunks and replica candidates', () => {
  const root = '42'.repeat(32);
  assert.equal(deriveAbbaCoordinate(root, 9), deriveAbbaCoordinate(root, 9));
  const selected = selectReplicaTargets({ nodeRoot: root, objectId: 'ab'.repeat(32), targetIds: ['node-c', 'node-a', 'node-b', 'node-d'], replicas: 3 });
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected).size, 3);
});
