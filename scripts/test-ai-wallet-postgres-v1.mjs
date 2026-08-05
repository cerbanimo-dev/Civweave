import assert from 'node:assert/strict';
import test from 'node:test';
import { PostgresAiWalletService } from '../lib/ai-wallet-postgres-v1.mjs';
import { assertActiveWalletDevice, registerWalletDeviceAndIssueSession, revokeWalletDevice } from '../lib/ai-wallet-account-v1.mjs';
import { verifyAiWalletSession } from '../lib/ai-wallet-auth-v1.mjs';

const CAPABILITY_SECRET = 'capability-secret-abcdefghijklmnopqrstuvwxyz-123456';
const AUTH_SECRET = 'auth-secret-abcdefghijklmnopqrstuvwxyz-123456';
const snapshot = overrides => ({ schema: 'commonweave.ai-wallet.v1', walletId: '00000000-0000-4000-8000-000000000001', userId: 'user:postgres', planId: 'thread', balanceCents: 200, reservedCents: 0, debtCents: 0, dailySpentCents: 0, dailyWindow: '2026-08-05', walletVersion: '00000000-0000-4000-8000-000000000002', reservations: {}, updatedAt: '2026-08-05T03:00:00.000Z', ...overrides });

test('Postgres adapter uses database functions and plan ceilings', async () => {
  const calls = []; let wallet = snapshot();
  const sql = async (text, params = []) => {
    calls.push({ text, params });
    if (text.includes('to_regnamespace')) return [{ ready: true }];
    if (text.includes('wallet_snapshot')) return [{ wallet }];
    if (text.includes('register_device')) return [{ registered: true }];
    if (text.includes('device_is_active')) return [{ active: true }];
    if (text.includes('credit_wallet')) { wallet = snapshot({ balanceCents: wallet.balanceCents + params[1] }); return [{ wallet }]; }
    if (text.includes('reserve_wallet')) { wallet = snapshot({ balanceCents: wallet.balanceCents, reservedCents: params[2], walletVersion: '00000000-0000-4000-8000-000000000003', reservations: { [params[1]]: { reservationId: params[1], maxCostCents: params[2], model: params[3], createdAt: '2026-08-05T03:00:00.000Z', expiresAt: '2026-08-05T03:15:00.000Z' } } }); return [{ wallet }]; }
    if (text.includes('settle_wallet')) { wallet = snapshot({ balanceCents: wallet.balanceCents - params[2], dailySpentCents: params[2], walletVersion: '00000000-0000-4000-8000-000000000004' }); return [{ wallet }]; }
    if (text.includes('ledger_entries')) return [{ entryId: 'entry:1', entryType: 'credit' }];
    throw new Error(`Unexpected SQL: ${text}`);
  };
  const service = await new PostgresAiWalletService({ sql, capabilitySecret: CAPABILITY_SECRET }).load();
  assert.equal(service.storage, 'neon-postgres-ledger');
  assert.equal(await service.registerDevice({ userId: 'user:postgres', deviceId: 'device:one' }), true);
  assert.equal((await service.credit({ userId: 'user:postgres', amountCents: 25, sourceId: 'source:one', planId: 'thread' })).balanceCents, 225);
  assert.match(await service.issueCapability({ userId: 'user:postgres', deviceId: 'device:one', models: ['gemini-flash-lite'], maxRequestCents: 10 }), /^[^.]+\.[^.]+\.[^.]+$/);
  assert.equal((await service.reserve({ userId: 'user:postgres', reservationId: 'reservation:one', maxCostCents: 10, model: 'gemini-flash-lite' })).reservedCents, 10);
  const reserveCall = calls.find(call => call.text.includes('reserve_wallet'));
  assert.equal(reserveCall.params[6], 10);
  assert.equal(reserveCall.params[7], 25);
  assert.equal((await service.settle({ userId: 'user:postgres', reservationId: 'reservation:one', actualCostCents: 6, requestId: 'request:one' })).dailySpentCents, 6);
  assert.equal((await service.listLedgerEntries({ userId: 'user:postgres' }))[0].entryType, 'credit');
});

test('registered device sessions can be issued and revoked', async () => {
  const state = { active: false };
  const walletService = { requireRegisteredDevices: true, async ensureWallet() { return snapshot(); }, async registerDevice() { state.active = true; return true; }, async isDeviceActive() { return state.active; }, async revokeDevice() { state.active = false; return true; } };
  const token = await registerWalletDeviceAndIssueSession({ walletService, userId: 'user:postgres', deviceId: 'device:one', ttlSeconds: 300 }, { authSecret: AUTH_SECRET });
  assert.equal(verifyAiWalletSession(token, { secret: AUTH_SECRET, deviceId: 'device:one' }).sub, 'user:postgres');
  assert.equal(await assertActiveWalletDevice(walletService, { userId: 'user:postgres', deviceId: 'device:one' }), true);
  assert.equal(await revokeWalletDevice(walletService, { userId: 'user:postgres', deviceId: 'device:one' }), true);
  await assert.rejects(() => assertActiveWalletDevice(walletService, { userId: 'user:postgres', deviceId: 'device:one' }), /revoked/);
});
