import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSETS,
  ContributionLedger,
  aggregateValidations,
  canonicalJson,
  hashObject,
  verifyObjectHash,
} from '../lib/contribution-ledger-v1.mjs';

const fixedClock = (() => {
  let tick = 0;
  return () => `2026-08-10T00:00:${String(tick++).padStart(2, '0')}.000Z`;
})();

function passingValidation(claimId, validatorId, deviceId, sourceType, evidenceClass, overrides = {}) {
  return {
    claimId,
    validatorId,
    deviceId,
    sourceType,
    evidenceClass,
    confidence: 0.95,
    calibration: 0.9,
    rubricScore: 0.94,
    passThreshold: 0.7,
    ...overrides,
  };
}

test('canonical hashes are order independent and tamper evident', () => {
  const a = { z: 1, nested: { b: 2, a: 1 } };
  const b = { nested: { a: 1, b: 2 }, z: 1 };
  assert.equal(canonicalJson(a), canonicalJson(b));
  const hash = hashObject(a);
  assert.equal(hash, hashObject(b));
  assert.equal(verifyObjectHash(a, hash), true);
  assert.equal(verifyObjectHash({ ...a, z: 2 }, hash), false);
});

test('weighted validation rewards strong evidence and penalizes strong failures', () => {
  const aggregate = aggregateValidations([
    passingValidation('c1', 'rubric', 'd1', 'deterministic', 'rubric'),
    passingValidation('c1', 'human', 'd2', 'human', 'artifact'),
    passingValidation('c1', 'model', 'd3', 'model', 'model-read'),
    passingValidation('c1', 'weak-fail', 'd4', 'peer', 'artifact-2', { rubricScore: 0.69, confidence: 0.8 }),
  ]);
  assert.ok(aggregate.confidence > 0.9, `expected high confidence, got ${aggregate.confidence}`);
  assert.equal(aggregate.evidenceDiversity, 3);
  assert.equal(aggregate.passingDevices, 3);

  const strongFailure = aggregateValidations([
    passingValidation('c1', 'pass', 'd1', 'human', 'artifact'),
    passingValidation('c1', 'fail', 'd2', 'deterministic', 'rubric', { rubricScore: 0.05, confidence: 0.99, calibration: 0.99 }),
  ]);
  assert.ok(strongFailure.confidence < 0.7, `strong failure should materially reduce confidence: ${strongFailure.confidence}`);
});

test('BUTTON mint requires confidence, evidence diversity, and cross-device validation', () => {
  const ledger = new ContributionLedger({ now: fixedClock, nodeId: 'node-a' });
  ledger.createClaim({
    claimId: 'labor:1',
    type: 'labor',
    subjectId: 'alice',
    evidenceRoot: 'sha256:evidence',
    rubricHash: 'sha256:rubric',
    effects: [{ asset: ASSETS.BUTTON, amount: 12 }, { asset: ASSETS.XP, amount: 40, skill: 'repair' }],
  });
  ledger.recordValidation(passingValidation('labor:1', 'rubric-v1', 'device-a', 'deterministic', 'rubric'));
  ledger.recordValidation(passingValidation('labor:1', 'model-v1', 'device-a', 'model', 'model-read'));
  let status = ledger.claimStatus('labor:1');
  assert.equal(status.confidenceSatisfied, true);
  assert.equal(status.diversitySatisfied, true);
  assert.equal(status.crossDeviceSatisfied, false);
  assert.equal(status.mintEligible, false);
  assert.throws(() => ledger.finalizeMint('labor:1'), /cross-device validation/);

  ledger.recordValidation(passingValidation('labor:1', 'human-v1', 'device-b', 'human', 'artifact'));
  status = ledger.claimStatus('labor:1');
  assert.equal(status.mintEligible, true);
  const mint = ledger.finalizeMint('labor:1');
  assert.equal(mint.status, 'active');
  assert.equal(ledger.balance('alice', ASSETS.BUTTON), 12);
  assert.equal(ledger.xpBalance('alice', 'repair'), 40);
  assert.throws(() => ledger.finalizeMint('labor:1'), /already minted/);
});

test('same validator/device pair cannot replay validation', () => {
  const ledger = new ContributionLedger({ now: fixedClock });
  ledger.createClaim({ claimId: 'learning:1', type: 'learning', subjectId: 'alice', effects: [{ asset: ASSETS.ACORN, amount: 3 }] });
  ledger.recordValidation(passingValidation('learning:1', 'model-v1', 'device-a', 'model', 'model-read'));
  assert.throws(() => ledger.recordValidation(passingValidation('learning:1', 'model-v1', 'device-a', 'model', 'different')), /already submitted/);
});

test('external settlement cannot mint contribution currency', () => {
  const ledger = new ContributionLedger({ now: fixedClock });
  ledger.createClaim({ claimId: 'labor:2', type: 'labor', subjectId: 'alice', effects: [{ asset: ASSETS.BUTTON, amount: 20 }] });
  ledger.recordValidation(passingValidation('labor:2', 'rubric', 'device-a', 'deterministic', 'rubric'));
  ledger.recordValidation(passingValidation('labor:2', 'human', 'device-b', 'human', 'artifact'));
  ledger.finalizeMint('labor:2');
  assert.equal(ledger.totalSupply(ASSETS.BUTTON), 20);

  const intent = ledger.createExchangeIntent({ intentId: 'sell:1', ownerId: 'alice', asset: ASSETS.BUTTON, amount: 8, targetAsset: 'USDC', minReceive: 2 });
  assert.equal(ledger.balance('alice', ASSETS.BUTTON), 12);
  assert.equal(ledger.lockedBalance('alice', ASSETS.BUTTON), 8);
  assert.equal(ledger.totalSupply(ASSETS.BUTTON), 20, 'locking must not alter supply');

  ledger.settleExchange({ intentId: intent.intentId, received: 2.5, provider: 'licensed-gateway', externalTx: 'base:0x123', recipientId: 'bob' });
  assert.equal(ledger.balance('bob', ASSETS.BUTTON), 8);
  assert.equal(ledger.totalSupply(ASSETS.BUTTON), 20, 'selling for external money must transfer existing BUTTON, never mint it');
  assert.equal(ledger.snapshot().exchangeIntents[0].status, 'settled');
});

test('cancelled exchange restores locked units without changing supply', () => {
  const ledger = new ContributionLedger({ now: fixedClock });
  ledger.createClaim({ claimId: 'learning:2', type: 'learning', subjectId: 'alice', effects: [{ asset: ASSETS.ACORN, amount: 5 }] });
  ledger.recordValidation(passingValidation('learning:2', 'model', 'device-a', 'model', 'model-read'));
  ledger.recordValidation(passingValidation('learning:2', 'human', 'device-a', 'human', 'artifact'));
  ledger.finalizeMint('learning:2');
  const before = ledger.totalSupply(ASSETS.ACORN);
  ledger.createExchangeIntent({ intentId: 'sell:a', ownerId: 'alice', asset: ASSETS.ACORN, amount: 2, targetAsset: 'USDC' });
  ledger.cancelExchangeIntent('sell:a');
  assert.equal(ledger.balance('alice', ASSETS.ACORN), 5);
  assert.equal(ledger.totalSupply(ASSETS.ACORN), before);
});

test('revoked challenged mint burns remaining currency and records liability for spent units', () => {
  const ledger = new ContributionLedger({ now: fixedClock });
  ledger.createClaim({ claimId: 'labor:3', type: 'labor', subjectId: 'alice', effects: [{ asset: ASSETS.BUTTON, amount: 10 }] });
  ledger.recordValidation(passingValidation('labor:3', 'rubric', 'device-a', 'deterministic', 'rubric'));
  ledger.recordValidation(passingValidation('labor:3', 'human', 'device-b', 'human', 'artifact'));
  const mint = ledger.finalizeMint('labor:3');
  const intent = ledger.createExchangeIntent({ intentId: 'spent:1', ownerId: 'alice', asset: ASSETS.BUTTON, amount: 6, targetAsset: 'USDC' });
  ledger.settleExchange({ intentId: intent.intentId, received: 2, recipientId: 'bob', externalTx: 'tx:1' });
  const challenge = ledger.openChallenge({ mintId: mint.mintId, challengerId: 'carol', reason: 'duplicate-artifact', evidenceRoot: 'sha256:challenge' });
  ledger.resolveChallenge({ challengeId: challenge.challengeId, outcome: 'revoked', resolution: 'evidence was duplicated from a prior claim' });
  assert.equal(ledger.balance('alice', ASSETS.BUTTON), 0);
  assert.equal(ledger.balance('bob', ASSETS.BUTTON), 6, 'already transferred units are not silently clawed back from an innocent holder');
  assert.equal(ledger.liability('alice', ASSETS.BUTTON), 6, 'originator carries the unresolved revoked issuance liability');
  assert.equal(ledger.totalSupply(ASSETS.BUTTON), 6, 'circulating tainted units remain visible until repaired rather than rewriting history');
});
