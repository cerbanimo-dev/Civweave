import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createNodeServiceManifest,
  quoteNodeTopUp,
  createUsageReceipt,
  createSettlementReceipt,
  signNodeReceipt,
  verifyNodeReceipt
} from '../lib/node-ai-marketplace-v1.mjs';
import { NodeAiLedger } from '../lib/node-ai-ledger-sqlite-v1.mjs';

function service(id, backend) {
  return { id, label: id, capabilities: ['chat', 'planning'], billing: { maxRequestCents: 100 }, backend };
}

test('node manifests can differentiate arbitrary model stacks without changing Cerbanimo fee policy', () => {
  const fireworks = createNodeServiceManifest({
    nodeId: 'node:north', operatorId: 'operator:a', displayName: 'North Node', platformFeeBps: 2000,
    services: [service('general', { provider: 'fireworks', model: 'deepseek-v4-flash' })]
  });
  const localGpu = createNodeServiceManifest({
    nodeId: 'node:forge', operatorId: 'operator:b', displayName: 'Forge Node', platformFeeBps: 2000,
    services: [service('general', { provider: 'self-hosted', model: 'custom-open-weight-v9' })]
  });
  assert.equal(fireworks.platformFee.basisPoints, 2000);
  assert.equal(localGpu.platformFee.basisPoints, 2000);
  assert.notEqual(fireworks.services[0].backend.provider, localGpu.services[0].backend.provider);
});

test('top-up economics contain no central provider reserve or provider share', () => {
  const quote = quoteNodeTopUp({ nodeId: 'node:north', grossCents: 2000, processorFeeCents: 89, platformFeeBps: 2000 });
  assert.equal(quote.platformFeeCents, 400);
  assert.equal(quote.nodeNetCashCents, 1511);
  assert.equal(quote.userCreditCents, 2000);
  assert.equal('providerReserveCents' in quote && quote.providerReserveCents !== undefined, false);
  assert.equal('providerShareBps' in quote && quote.providerShareBps !== undefined, false);
});

test('same top-up yields same Cerbanimo fee regardless of node backend', () => {
  const a = quoteNodeTopUp({ nodeId: 'node:a', grossCents: 5000, processorFeeCents: 175, platformFeeBps: 1800 });
  const b = quoteNodeTopUp({ nodeId: 'node:b', grossCents: 5000, processorFeeCents: 175, platformFeeBps: 1800 });
  assert.equal(a.platformFeeCents, b.platformFeeCents);
  assert.equal(a.platformFeeCents, 900);
});

test('signed receipts verify and tampering fails', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const receipt = createUsageReceipt({
    nodeId: 'node:north', walletId: 'wallet:1', serviceId: 'general', requestId: 'req:1', retailCostCents: 7,
    startedAt: '2026-08-09T18:00:00.000Z', completedAt: '2026-08-09T18:00:01.000Z', usage: { inputTokens: 100, outputTokens: 50 }
  });
  const signed = signNodeReceipt(receipt, { privateKey, keyId: 'north-1' });
  assert.equal(verifyNodeReceipt(signed, { publicKey }).requestId, 'req:1');
  const tampered = structuredClone(signed);
  tampered.payload.retailCostCents = 99;
  assert.throws(() => verifyNodeReceipt(tampered, { publicKey }), /hash does not match/);
});

test('settlement receipts support a periodic hash chain instead of synchronous central writes', () => {
  const first = createSettlementReceipt({
    nodeId: 'node:north', operatorId: 'operator:a', periodStart: '2026-08-01T00:00:00Z', periodEnd: '2026-08-02T00:00:00Z',
    grossTopupsCents: 10000, processorFeesCents: 300, platformFeeDueCents: 2000, userCreditsIssuedCents: 10000, topupCount: 5
  });
  const second = createSettlementReceipt({
    nodeId: 'node:north', operatorId: 'operator:a', periodStart: '2026-08-02T00:00:00Z', periodEnd: '2026-08-03T00:00:00Z',
    grossTopupsCents: 4000, processorFeesCents: 140, platformFeeDueCents: 800, userCreditsIssuedCents: 4000, topupCount: 2,
    previousReceiptHash: crypto.createHash('sha256').update(JSON.stringify(first)).digest('hex')
  });
  assert.ok(second.previousReceiptHash);
});

test('SQLite node ledger persists node-specific prepaid balance and retail inference charges', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'civweave-node-ledger-'));
  const databasePath = path.join(directory, 'node.sqlite');
  let ledger = new NodeAiLedger({ databasePath, nodeId: 'node:north', operatorId: 'operator:a', platformFeeBps: 2000 });
  const credited = ledger.creditTopUp({ userId: 'user:1', sourceId: 'pay:1', grossCents: 2000, processorFeeCents: 89 });
  assert.equal(credited.wallet.balanceCents, 2000);
  assert.equal(credited.quote.platformFeeCents, 400);
  assert.equal(ledger.creditTopUp({ userId: 'user:1', sourceId: 'pay:1', grossCents: 2000, processorFeeCents: 89 }).idempotent, true);

  const reserved = ledger.reserve({ userId: 'user:1', reservationId: 'r:1', serviceId: 'general', maxRetailCostCents: 25 });
  assert.equal(reserved.wallet.availableCents, 1975);
  const settled = ledger.settle({ userId: 'user:1', reservationId: 'r:1', actualRetailCostCents: 7, requestId: 'req:1' });
  assert.equal(settled.wallet.balanceCents, 1993);
  ledger.close();

  ledger = new NodeAiLedger({ databasePath, nodeId: 'node:north', operatorId: 'operator:a', platformFeeBps: 2000 });
  assert.equal(ledger.getWallet('user:1').balanceCents, 1993);
  const summary = ledger.settlementSummary({ periodStart: '2026-01-01T00:00:00Z', periodEnd: '2027-01-01T00:00:00Z' });
  assert.equal(summary.grossTopupsCents, 2000);
  assert.equal(summary.platformFeeDueCents, 400);
  assert.equal(summary.usageReceiptCount, 1);
  ledger.close();
});

test('chargeback adjustments cannot spend reserved credits and create debt rather than a negative wallet', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'civweave-node-ledger-debt-'));
  const ledger = new NodeAiLedger({ databasePath: path.join(directory, 'node.sqlite'), nodeId: 'node:north', operatorId: 'operator:a', platformFeeBps: 2000 });
  ledger.creditTopUp({ userId: 'user:1', sourceId: 'pay:1', grossCents: 500 });
  ledger.reserve({ userId: 'user:1', reservationId: 'r:1', serviceId: 'general', maxRetailCostCents: 400 });
  const adjusted = ledger.debitAdjustment({ userId: 'user:1', sourceId: 'cb:1', amountCents: 500, eventType: 'payment.chargeback' });
  assert.equal(adjusted.wallet.balanceCents, 400);
  assert.equal(adjusted.wallet.debtCents, 400);
  assert.equal(adjusted.wallet.availableCents, 0);
  assert.throws(() => ledger.reserve({ userId: 'user:1', reservationId: 'r:2', serviceId: 'general', maxRetailCostCents: 1 }), /unpaid refund or chargeback/);
  ledger.close();
});

test('inference gate lets node operators swap backend packages without exposing provider cost', async () => {
  const { NodeAiInferenceGate } = await import('../lib/node-ai-inference-gate-v1.mjs');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'civweave-node-gate-'));
  const ledger = new NodeAiLedger({ databasePath: path.join(directory, 'node.sqlite'), nodeId: 'node:gate', operatorId: 'operator:gate', platformFeeBps: 2000 });
  ledger.creditTopUp({ userId: 'user:gate', sourceId: 'pay:gate', grossCents: 2000, userCreditCents: 2000 });
  const manifest = createNodeServiceManifest({
    nodeId: 'node:gate', operatorId: 'operator:gate', displayName: 'Gate Node', platformFeeBps: 2000,
    services: [{ id: 'general', label: 'General', capabilities: ['chat'], billing: { maxRequestCents: 20 }, backend: { ownership: 'node-operator' } }]
  });
  const gate = new NodeAiInferenceGate({ ledger, manifest });
  gate.register('general', {
    async quote() { return { maxRetailCostCents: 10 }; },
    async execute() { return { output: 'hello', retailCostCents: 4, usage: { tokens: 123 }, backend: { package: 'operator-custom-v1' } }; }
  });
  const result = await gate.execute({ userId: 'user:gate', serviceId: 'general', request: { prompt: 'hi' }, requestId: 'request:gate' });
  assert.equal(result.output, 'hello');
  assert.equal(result.retailCostCents, 4);
  assert.equal(result.wallet.balanceCents, 1996);
  assert.equal(result.receipt.backend.package, 'operator-custom-v1');
  assert.equal('providerCostCents' in result, false);
  ledger.close();
});
