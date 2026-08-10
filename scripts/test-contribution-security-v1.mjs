import test from 'node:test';
import assert from 'node:assert/strict';
import { createWalletIdentity } from '../lib/contribution-mesh-v1.mjs';
import {
  createPolicyAnchorDraft,
  signPolicyAnchor,
  finalizePolicyAnchor,
  verifyPolicyAnchor,
  createRecoveryKit,
  recoverWallet,
  ValidatorRegistry,
  assessTransferRisk,
  SlidingWindowRateLimiter,
  preflightEnvelope,
  detectWitnessEquivocation,
  launchSecurityStatus,
  walletIdForPublicKey,
} from '../lib/contribution-security-v1.mjs';

async function roots(count = 4) {
  return Promise.all(Array.from({ length: count }, () => createWalletIdentity()));
}

async function anchorFor(wallets, policy = {}) {
  const draft = createPolicyAnchorDraft({
    federationId: 'test-federation',
    epochSeed: 'epoch:test:1',
    genesisValidators: wallets.slice(0, 3).map((wallet) => ({ rootId: wallet.walletId, publicKey: wallet.publicKey })),
    policy,
  });
  const signatures = [];
  for (const wallet of wallets.slice(0, 3)) signatures.push(await signPolicyAnchor(draft, wallet));
  return finalizePolicyAnchor(draft, signatures);
}

test('policy anchors require a real 2/3+1 genesis signature quorum', async () => {
  const wallets = await roots(3);
  const draft = createPolicyAnchorDraft({
    federationId: 'anchor-test',
    genesisValidators: wallets.map((wallet) => ({ rootId: wallet.walletId, publicKey: wallet.publicKey })),
  });
  assert.equal(draft.threshold, 3);
  const two = finalizePolicyAnchor(draft, [await signPolicyAnchor(draft, wallets[0]), await signPolicyAnchor(draft, wallets[1])]);
  assert.equal((await verifyPolicyAnchor(two)).ok, false);
  const three = finalizePolicyAnchor(draft, [...two.signatures, await signPolicyAnchor(draft, wallets[2])]);
  const verified = await verifyPolicyAnchor(three);
  assert.equal(verified.ok, true);
  assert.equal(verified.signatures, 3);

  const tampered = structuredClone(three);
  tampered.policy.maxOfflineAmount.BUTTON = 999999;
  assert.equal((await verifyPolicyAnchor(tampered)).ok, false, 'policy changes must invalidate the anchor');
});

test('wallet recovery reconstructs the same wallet from threshold guardian shares', async () => {
  const wallet = await createWalletIdentity();
  const kit = createRecoveryKit({
    walletId: wallet.walletId,
    walletPrivateJwk: wallet.privateKey,
    guardianIds: ['guardian:a', 'guardian:b', 'guardian:c'],
    threshold: 2,
  });
  assert.equal(kit.guardianShares.length, 3);
  const recovered = recoverWallet({ bundle: kit.bundle, shares: [kit.guardianShares[0], kit.guardianShares[2]] });
  assert.equal(recovered.walletId, wallet.walletId);
  assert.equal(walletIdForPublicKey(recovered.publicKey), wallet.walletId);
  assert.equal(recovered.privateKey.d, wallet.privateKey.d);
  assert.throws(() => recoverWallet({ bundle: kit.bundle, shares: [kit.guardianShares[0]] }), /insufficient valid guardian shares/);

  const forged = structuredClone(kit.guardianShares[1]);
  forged.share = forged.share.slice(0, -2) + 'AA';
  assert.throws(() => recoverWallet({ bundle: kit.bundle, shares: [kit.guardianShares[0], forged] }), /insufficient valid guardian shares/);
});

test('validator admission is root-diverse, recovery-gated, attested, bonded and contribution-aged', async () => {
  const wallets = await roots(4);
  const anchor = await anchorFor(wallets, {
    minValidatorAgeMs: 0,
    minContributionEvents: 3,
    minBondButtons: 5,
    minAttestations: 2,
    committeeSize: 5,
  });
  const registry = new ValidatorRegistry({ anchor, policy: anchor.policy });
  const now = new Date().toISOString();
  for (let index = 0; index < 3; index += 1) {
    registry.register({
      rootId: wallets[index].walletId,
      publicKey: wallets[index].publicKey,
      deviceId: `device:genesis-${index}`,
      joinedAt: now,
      lastSeenAt: now,
      recoveryReady: true,
    });
  }
  registry.register({
    rootId: wallets[3].walletId,
    publicKey: wallets[3].publicKey,
    deviceId: 'device:candidate',
    joinedAt: now,
    lastSeenAt: now,
    recoveryReady: true,
    contributionEvents: 3,
    bondButtons: 5,
  });
  assert.equal(registry.eligible().find((row) => row.rootId === wallets[3].walletId).eligible, false);
  registry.attest({ attestorRootId: wallets[0].walletId, targetRootId: wallets[3].walletId, pairingReceiptId: 'pair:a' });
  registry.attest({ attestorRootId: wallets[1].walletId, targetRootId: wallets[3].walletId, pairingReceiptId: 'pair:b' });
  const candidate = registry.eligible().find((row) => row.rootId === wallets[3].walletId);
  assert.equal(candidate.eligible, true);
  assert.equal(candidate.attestationCount, 2);

  const first = registry.committeeFor('sha256:subject');
  const second = registry.committeeFor('sha256:subject');
  assert.deepEqual(first, second, 'committee selection must be deterministic');
  assert.equal(new Set(first.committee.map((row) => row.rootId)).size, first.committee.length, 'one root gets at most one committee seat');
  assert.equal(first.safe, true);
  assert.ok(first.quorum >= 3);

  registry.slash(wallets[0].walletId, { reason: 'equivocation' });
  assert.equal(registry.eligible().find((row) => row.rootId === wallets[0].walletId).eligible, false);
});

test('risk policy fails closed under partitions, missing recovery, missing anchor and insufficient quorum', () => {
  const base = {
    asset: 'BUTTON', amount: 6, availableBalance: 100, eligibleValidatorRoots: 5,
    recoveryReady: false, policyAnchored: true, networkOnline: true,
  };
  const missingRecovery = assessTransferRisk(base);
  assert.equal(missingRecovery.allowedToCreate, false);
  assert.ok(missingRecovery.reasons.includes('recovery-required'));

  const partition = assessTransferRisk({ ...base, recoveryReady: true, amount: 26, networkOnline: false });
  assert.equal(partition.allowedToCreate, false);
  assert.ok(partition.reasons.includes('offline-value-limit'));

  const unanchored = assessTransferRisk({ ...base, recoveryReady: true, amount: 1, policyAnchored: false });
  assert.equal(unanchored.allowedToCreate, true);
  assert.equal(unanchored.pendingOnly, true);
  assert.equal(unanchored.allowedToFinalize, false);
  assert.ok(unanchored.reasons.includes('policy-anchor-required'));

  const noQuorum = assessTransferRisk({ ...base, recoveryReady: true, amount: 1, eligibleValidatorRoots: 2 });
  assert.equal(noQuorum.allowedToFinalize, false);
  assert.ok(noQuorum.reasons.includes('insufficient-validator-roots'));
});

test('rate and envelope guards reject replay-amplifying or oversized traffic', () => {
  let clock = 1000;
  const limiter = new SlidingWindowRateLimiter({ now: () => clock });
  assert.equal(limiter.allow('wallet:a:pending', { limit: 2, windowMs: 1000 }), true);
  assert.equal(limiter.allow('wallet:a:pending', { limit: 2, windowMs: 1000 }), true);
  assert.equal(limiter.allow('wallet:a:pending', { limit: 2, windowMs: 1000 }), false);
  clock += 1001;
  assert.equal(limiter.allow('wallet:a:pending', { limit: 2, windowMs: 1000 }), true);

  const envelope = { event: { createdAt: new Date(1000).toISOString() }, payload: 'ok' };
  assert.equal(preflightEnvelope(envelope, { now: 1000 }).ok, true);
  const future = { event: { createdAt: new Date(1000 + 6 * 60 * 1000).toISOString() } };
  assert.equal(preflightEnvelope(future, { now: 1000 }).ok, false);
  const huge = { event: { createdAt: new Date(1000).toISOString() }, payload: 'x'.repeat(140 * 1024) };
  assert.equal(preflightEnvelope(huge, { now: 1000 }).ok, false);
});

test('objective witness equivocation is detectable without trusting a slashing authority', () => {
  const pendingA = { hash: 'pending:a', type: 'TransferPending', payload: { fromId: 'wallet:a', asset: 'BUTTON', spendNonce: 1 } };
  const pendingB = { hash: 'pending:b', type: 'TransferPending', payload: { fromId: 'wallet:a', asset: 'BUTTON', spendNonce: 1 } };
  const rows = [
    { event: pendingA },
    { event: pendingB },
    { event: { type: 'TransferWitnessed', payload: { transferHash: 'pending:a', witnessDeviceId: 'device:w' } } },
    { event: { type: 'TransferWitnessed', payload: { transferHash: 'pending:b', witnessDeviceId: 'device:w' } } },
  ];
  const faults = detectWitnessEquivocation(rows);
  assert.equal(faults.length, 1);
  assert.equal(faults[0].reason, 'witness-equivocation');
});

test('launch readiness requires wallet recovery, anchored policy, validator quorum and disabled offramps', () => {
  const notReady = launchSecurityStatus({
    anchorVerification: { ok: false }, eligibleValidatorRoots: 2, recoveryReady: false, secureWalletReady: true,
  });
  assert.equal(notReady.readyForContributionValue, false);
  assert.equal(notReady.transferMode, 'pending-only');

  const ready = launchSecurityStatus({
    anchorVerification: { ok: true }, eligibleValidatorRoots: 3, recoveryReady: true, secureWalletReady: true,
  });
  assert.equal(ready.readyForContributionValue, true);
  assert.equal(ready.transferMode, 'committee-finality');
  assert.equal(ready.externalOfframpsEnabled, false);
});
