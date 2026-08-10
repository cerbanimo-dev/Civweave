import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  ContributionMeshReplica,
  SqliteContributionMeshStore,
  createDeviceIdentity,
  createWalletIdentity,
  hashObject,
  signEventEnvelope,
  verifyEventEnvelope,
} from '../lib/contribution-mesh-v1.mjs';

function fixedClock() {
  let tick = 0;
  return () => `2026-08-10T01:00:${String(tick++).padStart(2,'0')}.000Z`;
}

async function mint(replica, walletId, amount = 12, parents = []) {
  return replica.append('MintFinalized', {
    mintId: `mint:${walletId}:${amount}`,
    claimId: `claim:${walletId}:${amount}`,
    subjectId: walletId,
    effects: [{ asset: 'BUTTON', amount }],
    aggregateConfidence: .92,
    evidenceDiversity: 3,
    passingDevices: 3,
  }, parents);
}

async function copyBundle(from, to) { return to.importBundle(from.exportBundle()); }

test('signed envelopes reject tampering and bind device id to public key', async () => {
  const identity = await createDeviceIdentity();
  const replica = new ContributionMeshReplica({ identity, now: fixedClock() });
  const event = await replica.createEvent('Probe', { value: 1 });
  const envelope = await signEventEnvelope(event, identity);
  assert.equal((await verifyEventEnvelope(envelope)).ok, true);
  const tampered = structuredClone(envelope);
  tampered.event.payload.value = 2;
  assert.equal((await verifyEventEnvelope(tampered)).ok, false);
});

test('causal children remain orphaned until parents arrive, then promote automatically', async () => {
  const source = new ContributionMeshReplica({ identity: await createDeviceIdentity(), now: fixedClock() });
  const target = new ContributionMeshReplica({ identity: await createDeviceIdentity(), now: fixedClock() });
  const parent = await source.append('Parent', { n: 1 });
  const child = await source.append('Child', { n: 2 }, [parent.event.hash]);
  let result = await target.ingestEnvelope(child);
  assert.equal(result.status, 'orphan');
  assert.equal(target.orphanRecords().length, 1);
  result = await target.ingestEnvelope(parent);
  assert.equal(result.status, 'active');
  assert.equal(target.orphanRecords().length, 0);
  assert.equal(target.getRecord(child.event.hash).status, 'active');
});

test('sqlite store survives process-style reopen with event status intact', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cw-contribution-mesh-'));
  const dbPath = path.join(dir, 'mesh.sqlite');
  try {
    const identity = await createDeviceIdentity();
    let store = new SqliteContributionMeshStore({ databasePath: dbPath });
    let replica = new ContributionMeshReplica({ identity, store, now: fixedClock() });
    const envelope = await replica.append('Persisted', { ok: true });
    const hash = envelope.event.hash;
    store.close();
    store = new SqliteContributionMeshStore({ databasePath: dbPath });
    replica = new ContributionMeshReplica({ identity, store, now: fixedClock() });
    assert.equal(replica.getRecord(hash).status, 'active');
    assert.equal(replica.activeEvents().length, 1);
    store.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('transfer must be authorized by the wallet root key', async () => {
  const senderDevice = await createDeviceIdentity();
  const wallet = await createWalletIdentity();
  const replica = new ContributionMeshReplica({ identity: senderDevice, now: fixedClock() });
  await mint(replica, wallet.walletId, 10);
  const pending = await replica.createPendingTransfer({ walletIdentity: wallet, toId: 'wallet:recipient', asset: 'BUTTON', amount: 4 });
  assert.equal(replica.transferStatus(pending.event.payload.transferId).status, 'pending');

  const forgedEvent = await replica.createEvent('TransferPending', {
    ...pending.event.payload,
    transferId: 'transfer:forged',
    toId: 'wallet:thief',
    ownerSignature: pending.event.payload.ownerSignature,
  });
  const forgedEnvelope = await signEventEnvelope(forgedEvent, senderDevice);
  const forged = await replica.ingestEnvelope(forgedEnvelope);
  assert.equal(forged.status, 'rejected');
  assert.match(forged.error, /wallet authorization/i);
});

test('offline transfer stays pending until independent witness finality, then moves balance once', async () => {
  const wallet = await createWalletIdentity();
  const sender = new ContributionMeshReplica({ identity: await createDeviceIdentity(), finalityWitnesses: 2, now: fixedClock() });
  const witnessA = new ContributionMeshReplica({ identity: await createDeviceIdentity(), finalityWitnesses: 2, now: fixedClock() });
  const witnessB = new ContributionMeshReplica({ identity: await createDeviceIdentity(), finalityWitnesses: 2, now: fixedClock() });
  const receiverId = (await createWalletIdentity()).walletId;

  await mint(sender, wallet.walletId, 10);
  const pending = await sender.createPendingTransfer({ walletIdentity: wallet, toId: receiverId, asset: 'BUTTON', amount: 6 });
  const transferId = pending.event.payload.transferId;
  assert.equal(sender.balance(wallet.walletId, 'BUTTON'), 10, 'pending transfer does not rewrite finalized balance');
  assert.equal(sender.availableBalance(wallet.walletId, 'BUTTON'), 4, 'pending transfer locks local spendable balance');
  assert.equal(sender.transferStatus(transferId).status, 'pending');
  await assert.rejects(() => sender.finalizeTransfer(transferId), /not ready/);

  await copyBundle(sender, witnessA);
  await witnessA.witnessTransfer(transferId);
  await copyBundle(witnessA, sender);
  assert.equal(sender.transferStatus(transferId).witnessCount, 1);
  assert.equal(sender.transferStatus(transferId).status, 'pending');

  await copyBundle(sender, witnessB);
  await witnessB.witnessTransfer(transferId);
  await copyBundle(witnessB, sender);
  assert.equal(sender.transferStatus(transferId).status, 'ready');
  await sender.finalizeTransfer(transferId);
  assert.equal(sender.transferStatus(transferId).status, 'final');
  assert.equal(sender.balance(wallet.walletId, 'BUTTON'), 4);
  assert.equal(sender.balance(receiverId, 'BUTTON'), 6);

  await sender.finalizeTransfer(transferId);
  assert.equal(sender.balance(wallet.walletId, 'BUTTON'), 4, 'duplicate finalization cannot double-debit');
});

test('same wallet nonce on conflicting transfers blocks finality', async () => {
  const wallet = await createWalletIdentity();
  const deviceA = await createDeviceIdentity();
  const deviceB = await createDeviceIdentity();
  const senderA = new ContributionMeshReplica({ identity: deviceA, finalityWitnesses: 1, now: fixedClock() });
  const senderB = new ContributionMeshReplica({ identity: deviceB, finalityWitnesses: 1, now: fixedClock() });
  const witness = new ContributionMeshReplica({ identity: await createDeviceIdentity(), finalityWitnesses: 1, now: fixedClock() });
  await mint(senderA, wallet.walletId, 10);
  await copyBundle(senderA, senderB);
  const t1 = await senderA.createPendingTransfer({ transferId: 'transfer:one', walletIdentity: wallet, toId: 'wallet:bob', asset: 'BUTTON', amount: 6, spendNonce: 1 });
  const t2 = await senderB.createPendingTransfer({ transferId: 'transfer:two', walletIdentity: wallet, toId: 'wallet:carol', asset: 'BUTTON', amount: 6, spendNonce: 1 });
  await witness.ingestEnvelope(t1);
  await witness.ingestEnvelope(t2);
  assert.equal(witness.transferStatus('transfer:one').status, 'conflict');
  assert.equal(witness.transferStatus('transfer:two').status, 'conflict');
  await assert.rejects(() => witness.witnessTransfer('transfer:one'), /conflicting spend nonce/);
});

test('bundle import is idempotent and exposes a causal frontier', async () => {
  const a = new ContributionMeshReplica({ identity: await createDeviceIdentity(), now: fixedClock() });
  const b = new ContributionMeshReplica({ identity: await createDeviceIdentity(), now: fixedClock() });
  const first = await a.append('One', { n: 1 });
  const second = await a.append('Two', { n: 2 }, [first.event.hash]);
  await copyBundle(a, b);
  await copyBundle(a, b);
  assert.equal(b.activeEvents().length, 2);
  assert.deepEqual(b.frontier(), [second.event.hash]);
  assert.equal(hashObject({ b: 2, a: 1 }), hashObject({ a: 1, b: 2 }));
});

test('a late conflicting spend disputes finality without rewriting the finalized transfer', async () => {
  const wallet = await createWalletIdentity();
  const sender = new ContributionMeshReplica({ identity: await createDeviceIdentity(), finalityWitnesses: 1, now: fixedClock() });
  const alternate = new ContributionMeshReplica({ identity: await createDeviceIdentity(), finalityWitnesses: 1, now: fixedClock() });
  const witness = new ContributionMeshReplica({ identity: await createDeviceIdentity(), finalityWitnesses: 1, now: fixedClock() });
  await mint(sender, wallet.walletId, 9);
  await copyBundle(sender, alternate);
  await sender.createPendingTransfer({ transferId: 'transfer:primary', walletIdentity: wallet, toId: 'wallet:bob', asset: 'BUTTON', amount: 5, spendNonce: 1 });
  await copyBundle(sender, witness);
  await witness.witnessTransfer('transfer:primary');
  await copyBundle(witness, sender);
  await sender.finalizeTransfer('transfer:primary');
  assert.equal(sender.balance(wallet.walletId, 'BUTTON'), 4);
  assert.equal(sender.transferStatus('transfer:primary').status, 'final');

  const conflicting = await alternate.createPendingTransfer({ transferId: 'transfer:late', walletIdentity: wallet, toId: 'wallet:carol', asset: 'BUTTON', amount: 5, spendNonce: 1 });
  await sender.ingestEnvelope(conflicting);
  assert.equal(sender.transferStatus('transfer:primary').status, 'disputed-final');
  assert.equal(sender.balance(wallet.walletId, 'BUTTON'), 4, 'late conflict flags dispute but does not roll back settled history');
});
