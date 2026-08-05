import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AI_PLAN_CATALOG,
  allocateSubscriptionCharge,
  quoteTopUp,
  createWallet,
  availableCents,
  reserveWalletSpend,
  settleWalletSpend,
  cancelWalletReservation
} from '../lib/ai-wallet-policy-v1.mjs';
import { issueAiCapability, verifyAiCapability } from '../lib/ai-capability-token-v1.mjs';
import { AiWalletService } from '../lib/ai-wallet-service-v1.mjs';

const SECRET = 'commonweave-test-secret-that-is-longer-than-thirty-two-bytes';

test('plan ladder begins at $5 and improves provider share in the midrange and high end', () => {
  assert.equal(AI_PLAN_CATALOG.thread.monthlyPriceCents, 500);
  assert.equal(AI_PLAN_CATALOG.thread.targetReserveShareBps, 4000);
  assert.equal(AI_PLAN_CATALOG.weaver.targetReserveShareBps, 6000);
  assert.equal(AI_PLAN_CATALOG.node.targetReserveShareBps, 7500);
});

test('subscription allocation keeps reserve accounting separate from advertised allowance', () => {
  const allocation = allocateSubscriptionCharge({
    planId: 'weaver',
    grossCents: 3000,
    netDistributableCents: 2800
  });
  assert.equal(allocation.hostedAllowanceCents, 1800);
  assert.equal(allocation.providerReserveCents, 1680);
  assert.equal(allocation.platformOperatingCents, 1120);
  assert.equal(allocation.allowanceFundingGapCents, 120);
});

test('top-up bands improve at $20, $50, and $100', () => {
  assert.equal(quoteTopUp({ grossCents: 500, netDistributableCents: 450 }).providerShareBps, 5000);
  assert.equal(quoteTopUp({ grossCents: 2000, netDistributableCents: 1900 }).providerShareBps, 6000);
  assert.equal(quoteTopUp({ grossCents: 5000, netDistributableCents: 4800 }).providerShareBps, 7000);
  assert.equal(quoteTopUp({ grossCents: 10000, netDistributableCents: 9700 }).providerShareBps, 7500);
});

test('wallet reservations prevent overspend and return unused funds at settlement', () => {
  const wallet = createWallet({ walletId: 'wallet:test', userId: 'user:test', planId: 'weaver', balanceCents: 500 });
  const reserved = reserveWalletSpend(wallet, {
    reservationId: 'request:1',
    maxCostCents: 75,
    model: 'gemini-pro'
  });
  assert.equal(reserved.reservedCents, 75);
  assert.equal(availableCents(reserved), 425);

  const settled = settleWalletSpend(reserved, { reservationId: 'request:1', actualCostCents: 21 });
  assert.equal(settled.balanceCents, 479);
  assert.equal(settled.reservedCents, 0);
  assert.equal(settled.dailySpentCents, 21);
});

test('wallet reservations enforce model and per-request limits', () => {
  const wallet = createWallet({ walletId: 'wallet:test', userId: 'user:test', planId: 'thread', balanceCents: 20 });
  assert.throws(() => reserveWalletSpend(wallet, {
    reservationId: 'bad-model',
    maxCostCents: 5,
    model: 'gemini-pro'
  }), /not enabled/);
  assert.throws(() => reserveWalletSpend(wallet, {
    reservationId: 'too-large',
    maxCostCents: 11,
    model: 'gemini-flash'
  }), /per-request limit/);
});

test('cancelled reservations release the full hold', () => {
  const wallet = createWallet({ walletId: 'wallet:test', userId: 'user:test', planId: 'loom', balanceCents: 100 });
  const reserved = reserveWalletSpend(wallet, { reservationId: 'request:1', maxCostCents: 20, model: 'gemini-flash' });
  const cancelled = cancelWalletReservation(reserved, 'request:1');
  assert.equal(cancelled.reservedCents, 0);
  assert.equal(cancelled.balanceCents, 100);
});

test('capabilities are short-lived, device-bound, model-bound, and cost-bound', () => {
  const nowMs = Date.UTC(2026, 7, 5, 2, 0, 0);
  const token = issueAiCapability({
    userId: 'user:test',
    deviceId: 'device:test',
    planId: 'weaver',
    models: ['gemini-flash', 'gemini-pro'],
    maxRequestCents: 75,
    dailyLimitCents: 300,
    walletVersion: 'wallet-version-1',
    ttlSeconds: 300,
    nowMs,
    capabilityId: 'capability:test'
  }, { secret: SECRET });

  const verified = verifyAiCapability(token, {
    secret: SECRET,
    nowMs: nowMs + 60_000,
    deviceId: 'device:test',
    model: 'gemini-pro',
    estimatedCostCents: 50,
    expectedWalletVersion: 'wallet-version-1'
  });
  assert.equal(verified.sub, 'user:test');
  assert.throws(() => verifyAiCapability(token, { secret: SECRET, nowMs, deviceId: 'device:other' }), /different device/);
  assert.throws(() => verifyAiCapability(token, { secret: SECRET, nowMs, model: 'gemini-live' }), /not allowed/);
  assert.throws(() => verifyAiCapability(token, { secret: SECRET, nowMs, estimatedCostCents: 76 }), /exceeds/);
  assert.throws(() => verifyAiCapability(token, { secret: SECRET, nowMs: nowMs + 301_000 }), /expired/);
});

test('file-backed wallet service persists credits idempotently and rotates wallet versions', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'commonweave-ai-wallet-'));
  const filePath = path.join(directory, 'wallets.json');
  const service = await new AiWalletService({ filePath, capabilitySecret: SECRET }).load();
  await service.credit({ userId: 'user:test', amountCents: 1800, sourceId: 'invoice:1', planId: 'weaver' });
  await service.credit({ userId: 'user:test', amountCents: 1800, sourceId: 'invoice:1', planId: 'weaver' });
  const credited = service.getWallet('user:test');
  assert.equal(credited.balanceCents, 1800);

  const reserved = await service.reserve({
    userId: 'user:test',
    reservationId: 'request:1',
    maxCostCents: 75,
    model: 'gemini-pro'
  });
  const versionAfterReserve = reserved.walletVersion;
  const settled = await service.settle({ userId: 'user:test', reservationId: 'request:1', actualCostCents: 30 });
  assert.equal(settled.balanceCents, 1770);
  assert.notEqual(settled.walletVersion, versionAfterReserve);

  const persisted = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(persisted.wallets['user:test'].balanceCents, 1770);
  assert.equal(persisted.sourceEvents['invoice:1'].amountCents, 1800);
});

test('device credential extension forbids plaintext persistent API-key storage', async () => {
  const source = await readFile(new URL('../public/extensions/commonweave-device-credentials-v160.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage\s*\.\s*setItem\s*\(\s*LEGACY_PERSIST_KEY/);
  assert.match(source, /passphrase-encrypted device vault/);
  assert.match(source, /migrateLegacyPlaintext/);
});
