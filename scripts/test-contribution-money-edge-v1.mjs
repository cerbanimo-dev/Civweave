import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ContributionMoneyEdge,
  assertZeroMintAuthority,
  loadMoneyEdgeConfig,
  moneyIntegrationReadiness,
} from '../lib/contribution-money-edge-v1.mjs';
import { GATEWAY_PRESETS, validateErc20PaymentObservation, addressTopic } from '../lib/contribution-gateway-v1.mjs';
import { validateProviderReceipt, ProviderReceiptRegistry } from '../lib/contribution-provider-gateway-v1.mjs';
import { deterministicCommittee } from '../lib/contribution-validator-committee-v2.mjs';

function mockLedger() {
  const reservations = new Map();
  const transfers = new Map();
  return {
    reservations,
    transfers,
    async reserveExistingAsset(input) {
      if (reservations.has(input.orderId)) return reservations.get(input.orderId);
      const row = { reservationId: `reserve:${input.orderId}`, ...input, mintEffect: 0, supplyEffect: 0 };
      reservations.set(input.orderId, row);
      return row;
    },
    async releaseReservation({ orderId }) {
      const row = reservations.get(orderId);
      if (!row) throw new Error('reservation missing');
      reservations.delete(orderId);
      return { released: true, reservationId: row.reservationId, mintEffect: 0, supplyEffect: 0 };
    },
    async finalizeReservedTransfer(input) {
      if (!reservations.has(input.orderId)) throw new Error('reservation missing');
      const transferHash = `transfer:${input.orderId}`;
      transfers.set(input.orderId, { ...input, transferHash });
      return { transferHash, mintEffect: 0, supplyEffect: 0 };
    },
    async flagDispute(input) { return { flagged: true, ...input, mintEffect: 0, supplyEffect: 0 }; },
  };
}

function mockProvider({ mode = 'sandbox', liveReady = false } = {}) {
  const receipts = new Map();
  return {
    id: 'mock-provider',
    mode,
    credentialsPresent: liveReady,
    webhookVerificationReady: liveReady,
    refundsReady: true,
    reconciliationReady: true,
    async createPayment({ reference, currency, amount }) {
      return { paymentId: `pay:${reference}`, reference, currency, amount, mintEffect: 0, supplyEffect: 0 };
    },
    async verifyReceipt(receipt, context) {
      const errors = [];
      if (receipt.paymentId !== context.paymentId) errors.push('payment id mismatch');
      if (receipt.currency !== context.currency) errors.push('currency mismatch');
      if (Number(receipt.amount) < Number(context.amount)) errors.push('amount mismatch');
      if (!['settled', 'paid', 'succeeded', 'completed'].includes(String(receipt.status).toLowerCase())) errors.push('not settled');
      if (errors.length) return { ok: false, errors };
      receipts.set(context.paymentId, receipt);
      return { ok: true, receiptId: receipt.receiptId, proof: { paymentId: context.paymentId, receiptId: receipt.receiptId }, mintEffect: 0, supplyEffect: 0 };
    },
    async fetchReceipt({ paymentId }) { return receipts.get(paymentId) || { paymentId, status: 'pending' }; },
    async refund() { return { refunded: true, mintEffect: 0, supplyEffect: 0 }; },
  };
}

const future = () => new Date(Date.now() + 60_000).toISOString();
const order = (suffix = '1') => ({
  orderId: `order:${suffix}`,
  idempotencyKey: `idem:${suffix}`,
  sellerId: 'wallet:seller',
  buyerId: `wallet:buyer:${suffix}`,
  asset: 'BUTTON',
  internalAmount: 10,
  externalCurrency: 'USDC',
  externalAmount: 5,
  expiresAt: future(),
});

test('config is fail-closed for live money', () => {
  const config = loadMoneyEdgeConfig({});
  assert.equal(config.liveMoneyEnabled, false);
  assert.equal(config.emergencyStop, false);
  assert.equal(config.providerMode, 'sandbox');
});

test('structural integration door can be ready while live money remains disabled', () => {
  const readiness = moneyIntegrationReadiness({ ledger: mockLedger(), provider: mockProvider(), config: {} });
  assert.equal(readiness.integrationDoorReady, true);
  assert.equal(readiness.sandboxReady, true);
  assert.equal(readiness.liveReady, false);
  assert.ok(readiness.operationalBlockers.includes('live-money-disabled'));
});

test('live readiness requires every explicit provider and compliance gate', () => {
  const readiness = moneyIntegrationReadiness({
    ledger: mockLedger(),
    provider: mockProvider({ mode: 'live', liveReady: true }),
    config: {
      liveMoneyEnabled: true,
      complianceApproved: true,
      jurisdictionApproved: true,
      kycAmlReady: true,
      taxReportingReady: true,
      termsApproved: true,
    },
  });
  assert.equal(readiness.liveReady, true);
  assert.deepEqual(readiness.operationalBlockers, []);
});

test('sandbox lifecycle reserves existing value, certifies external settlement, then finalizes internal transfer', async () => {
  const ledger = mockLedger();
  const provider = mockProvider();
  const edge = new ContributionMoneyEdge({ ledgerAdapter: ledger, providerAdapter: provider });
  const created = await edge.createOrder(order('a'));
  assert.equal(created.status, 'reserved');
  assert.equal(ledger.reservations.size, 1);
  const prepared = await edge.prepareExternalPayment(created.orderId);
  assert.equal(prepared.status, 'payment-prepared');
  await assert.rejects(() => edge.finalizeInternalTransfer(created.orderId), /external settlement/);
  const settledExternal = await edge.ingestSettlement(created.orderId, {
    paymentId: prepared.providerPaymentId,
    receiptId: 'receipt:a',
    currency: 'USDC',
    amount: 5,
    status: 'settled',
  });
  assert.equal(settledExternal.status, 'external-settled');
  const final = await edge.finalizeInternalTransfer(created.orderId, { committeeCertificate: 'test' });
  assert.equal(final.status, 'settled');
  assert.equal(final.internalTransferHash, `transfer:${created.orderId}`);
  assert.equal(ledger.transfers.size, 1);
  assertZeroMintAuthority(edge.events);
});

test('idempotency key repeats the same order but rejects payload drift', async () => {
  const edge = new ContributionMoneyEdge({ ledgerAdapter: mockLedger(), providerAdapter: mockProvider() });
  const input = order('b');
  const first = await edge.createOrder(input);
  const second = await edge.createOrder(input);
  assert.equal(second.orderId, first.orderId);
  await assert.rejects(() => edge.createOrder({ ...input, externalAmount: 6 }), /idempotency key/);
});

test('provider receipt cannot be reused across two money orders', async () => {
  const edge = new ContributionMoneyEdge({ ledgerAdapter: mockLedger(), providerAdapter: mockProvider() });
  const a = await edge.createOrder(order('c1'));
  const b = await edge.createOrder(order('c2'));
  const pa = await edge.prepareExternalPayment(a.orderId);
  const pb = await edge.prepareExternalPayment(b.orderId);
  await edge.ingestSettlement(a.orderId, { paymentId: pa.providerPaymentId, receiptId: 'receipt:shared', currency: 'USDC', amount: 5, status: 'settled' });
  await assert.rejects(() => edge.ingestSettlement(b.orderId, { paymentId: pb.providerPaymentId, receiptId: 'receipt:shared', currency: 'USDC', amount: 5, status: 'settled' }), /already consumed/);
});

test('cancel releases reservation before external settlement and is blocked afterward', async () => {
  const ledger = mockLedger();
  const edge = new ContributionMoneyEdge({ ledgerAdapter: ledger, providerAdapter: mockProvider() });
  const a = await edge.createOrder(order('d1'));
  const cancelled = await edge.cancelOrder(a.orderId);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(ledger.reservations.size, 0);
  const b = await edge.createOrder(order('d2'));
  const pb = await edge.prepareExternalPayment(b.orderId);
  await edge.ingestSettlement(b.orderId, { paymentId: pb.providerPaymentId, receiptId: 'receipt:d2', currency: 'USDC', amount: 5, status: 'settled' });
  await assert.rejects(() => edge.cancelOrder(b.orderId), /cannot cancel/);
});

test('reconciliation mismatch and disputes never create mint authority', async () => {
  const provider = mockProvider();
  const edge = new ContributionMoneyEdge({ ledgerAdapter: mockLedger(), providerAdapter: provider });
  const created = await edge.createOrder(order('e'));
  const prepared = await edge.prepareExternalPayment(created.orderId);
  const before = await edge.reconcile(created.orderId);
  assert.equal(before.consistent, true);
  await edge.ingestSettlement(created.orderId, { paymentId: prepared.providerPaymentId, receiptId: 'receipt:e', currency: 'USDC', amount: 5, status: 'settled' });
  await edge.finalizeInternalTransfer(created.orderId);
  const disputed = await edge.openDispute(created.orderId, 'chargeback');
  assert.equal(disputed.status, 'disputed');
  assertZeroMintAuthority(edge.events);
});

test('emergency stop blocks new order and payment activity', async () => {
  const edge = new ContributionMoneyEdge({ ledgerAdapter: mockLedger(), providerAdapter: mockProvider(), config: { emergencyStop: true } });
  await assert.rejects(() => edge.createOrder(order('f')), /emergency stop/);
});

test('non-zero mint or supply effects are rejected at the boundary', () => {
  assert.throws(() => assertZeroMintAuthority({ mintEffect: 1 }), /non-zero mintEffect/);
  assert.throws(() => assertZeroMintAuthority({ nested: { supplyEffect: 2 } }), /non-zero supplyEffect/);
  assert.throws(() => assertZeroMintAuthority({ mintAuthority: true }), /mint authority/);
});

test('extracted Base USDC protocol keeps mainnet and Sepolia contracts explicit', () => {
  assert.equal(GATEWAY_PRESETS.baseUsdc.chainId, 8453);
  assert.equal(GATEWAY_PRESETS.baseUsdc.tokenAddress.toLowerCase(), '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
  assert.equal(GATEWAY_PRESETS.baseSepoliaUsdc.chainId, 84532);
  const sender = '0x2222222222222222222222222222222222222222';
  const recipient = '0x1111111111111111111111111111111111111111';
  const amount = 2500000n;
  const result = validateErc20PaymentObservation({
    intentId: 'gateway:test', sellerId: 'wallet:seller', buyerId: 'wallet:buyer', asset: 'BUTTON', amount: 10, transferId: 'transfer:test',
    external: { presetId: GATEWAY_PRESETS.baseUsdc.id, chainId: 8453, tokenSymbol: 'USDC', tokenAddress: GATEWAY_PRESETS.baseUsdc.tokenAddress, recipient, expectedSender: sender, amountAtomic: amount.toString(), amountPolicy: 'exact', finalityTag: 'finalized' },
    expiresAt: future(),
  }, {
    chainId: 8453, txHash: `0x${'ab'.repeat(32)}`, receiptStatus: '0x1', blockNumber: '0x64', blockHash: `0x${'cd'.repeat(32)}`, finalizedBlockNumber: '0x65',
    log: { address: GATEWAY_PRESETS.baseUsdc.tokenAddress, topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', addressTopic(sender), addressTopic(recipient)], data: `0x${amount.toString(16)}`, logIndex: '0x1' },
  });
  assert.equal(result.ok, true);
  assert.match(result.proofKey, /^evm:8453:/);
});

test('provider receipt adapter requires authenticity and prevents proof replay', async () => {
  const intent = { intentId: 'provider:test', sellerId: 'wallet:seller', buyerId: 'wallet:buyer', transferId: 'transfer:test', asset: 'ACORN', amount: 2, providerId: 'sandbox-bank', providerReference: 'ref:1', externalCurrency: 'USD', externalAmount: 4, amountPolicy: 'exact', expiresAt: future() };
  const receipt = { providerId: 'sandbox-bank', receiptId: 'receipt:1', providerReference: 'ref:1', currency: 'USD', amount: 4, status: 'settled' };
  const rejected = await validateProviderReceipt(intent, receipt);
  assert.equal(rejected.ok, false);
  const verified = await validateProviderReceipt(intent, receipt, { verifyAuthenticity: async () => true });
  assert.equal(verified.ok, true);
  const registry = new ProviderReceiptRegistry();
  registry.certify('intent-hash:1', verified);
  assert.throws(() => registry.certify('intent-hash:2', verified), /already consumed/);
});

test('validator committee selection stays root and device diverse with deterministic quorum', () => {
  const eligibleValidators = Array.from({ length: 5 }, (_, i) => ({ rootId: `root:${i}`, deviceId: `device:${i}`, registrationHash: `reg:${i}`, genesis: i < 3 }));
  const first = deterministicCommittee({ subjectHash: 'sha256:subject', epochSeed: 'epoch:1', eligibleValidators });
  const second = deterministicCommittee({ subjectHash: 'sha256:subject', epochSeed: 'epoch:1', eligibleValidators });
  assert.equal(first.safe, true);
  assert.equal(first.quorum, 4);
  assert.deepEqual(first.committee.map(v => v.rootId), second.committee.map(v => v.rootId));
  assert.equal(new Set(first.committee.map(v => v.rootId)).size, first.committee.length);
  assert.equal(new Set(first.committee.map(v => v.deviceId)).size, first.committee.length);
});
