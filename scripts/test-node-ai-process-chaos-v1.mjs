import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { NodeAiLedger } from '../lib/node-ai-ledger-sqlite-v1.mjs';
import { NodeAiInferenceGate } from '../lib/node-ai-inference-gate-v1.mjs';
import { createNodeServiceManifest } from '../lib/node-ai-marketplace-v1.mjs';

const workerUrl = new URL('./node-ai-process-chaos-worker-v1.mjs', import.meta.url);
const workerPath = fileURLToPath(workerUrl);
const NODE_ID = 'node:process-chaos';
const OPERATOR_ID = 'operator:process-chaos';
const BPS = 2000;
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

function openLedger(databasePath) {
  return new NodeAiLedger({ databasePath, nodeId: NODE_ID, operatorId: OPERATOR_ID, platformFeeBps: BPS });
}

async function oneShot(config) {
  const child = spawn(process.execPath, [workerPath, encode({ nodeId: NODE_ID, operatorId: OPERATOR_ID, platformFeeBps: BPS, ...config })], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const [code, signal] = await once(child, 'exit');
  assert.equal(code, 0, `worker failed (${signal || 'no-signal'}): ${stderr || stdout}`);
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.ok(lines.length, `worker produced no JSON: ${stderr}`);
  return JSON.parse(lines.at(-1));
}

async function startHolding(config, phase) {
  const child = spawn(process.execPath, [workerPath, encode({ nodeId: NODE_ID, operatorId: OPERATOR_ID, platformFeeBps: BPS, ...config })], { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let buffer = '';
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`worker did not reach ${phase}: ${stderr}`)), 10_000);
    child.stdout.on('data', chunk => {
      buffer += chunk;
      for (;;) {
        const index = buffer.indexOf('\n');
        if (index < 0) break;
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const message = JSON.parse(line);
        if (message.phase === phase) {
          clearTimeout(timeout);
          resolve(message);
        }
      }
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`worker exited before ${phase}: code=${code} signal=${signal} ${stderr}`));
    });
  });
  await ready;
  return child;
}

async function kill(child) {
  child.kill('SIGKILL');
  const [code, signal] = await once(child, 'exit');
  assert.equal(code, null);
  assert.equal(signal, 'SIGKILL');
}

async function withDatabase(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cw-node-ai-process-chaos-'));
  const databasePath = path.join(dir, 'node.sqlite');
  try { return await run(databasePath); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

function paymentCount(ledger, userId) {
  return Number(ledger.db.prepare('SELECT COUNT(*) count FROM node_ai_payment_events WHERE node_id=? AND user_id=?').get(NODE_ID, userId)?.count || 0);
}
function chargeCount(ledger, requestId) {
  return Number(ledger.db.prepare("SELECT COUNT(*) count FROM node_ai_ledger WHERE node_id=? AND kind='inference-retail-charge' AND related_id=?").get(NODE_ID, requestId)?.count || 0);
}

await test('multiple OS processes serialize top-ups, duplicate events, reservation races, and settlement races', async () => {
  await withDatabase(async databasePath => {
    const userId = 'user:concurrent-topups';
    let ledger = openLedger(databasePath);
    ledger.creditTopUp({ userId, sourceId: 'seed:concurrent', grossCents: 10_000 });
    ledger.close();

    const writers = 6;
    const writesPerWorker = 60;
    const amountCents = 7;
    const results = await Promise.all(Array.from({ length: writers }, (_, workerIndex) => oneShot({
      action: 'topup-loop', databasePath, userId, count: writesPerWorker, amountCents, prefix: `parallel:${workerIndex}`
    })));
    assert.equal(results.reduce((sum, row) => sum + row.credited, 0), writers * writesPerWorker);
    assert.equal(results.reduce((sum, row) => sum + row.idempotent, 0), 0);

    ledger = openLedger(databasePath);
    assert.equal(ledger.getWallet(userId).balanceCents, 10_000 + writers * writesPerWorker * amountCents);
    assert.equal(paymentCount(ledger, userId), 1 + writers * writesPerWorker);
    ledger.close();

    const duplicateSource = 'parallel:duplicate:one';
    const duplicateResults = await Promise.all(Array.from({ length: 8 }, () => oneShot({ action: 'duplicate-topup', databasePath, userId, sourceId: duplicateSource, amountCents: 777 })));
    assert.equal(duplicateResults.filter(row => row.idempotent === false).length, 1);
    assert.equal(duplicateResults.filter(row => row.idempotent === true).length, 7);

    ledger = openLedger(databasePath);
    assert.equal(ledger.getWallet(userId).balanceCents, 10_000 + writers * writesPerWorker * amountCents + 777);
    assert.equal(Number(ledger.db.prepare('SELECT COUNT(*) count FROM node_ai_payment_events WHERE source_id=?').get(duplicateSource)?.count || 0), 1);

    const reserveUser = 'user:reservation-race';
    ledger.creditTopUp({ userId: reserveUser, sourceId: 'seed:reserve-race', grossCents: 500 });
    ledger.close();

    const reservationIds = Array.from({ length: 10 }, (_, index) => `race:reservation:${index}`);
    const reserveResults = await Promise.all(reservationIds.map(reservationId => oneShot({ action: 'reserve-once', databasePath, userId: reserveUser, reservationId, maxRetailCostCents: 100 })));
    const reserved = reserveResults.filter(row => row.reserved);
    assert.equal(reserved.length, 5, `expected exactly five backed reservations: ${JSON.stringify(reserveResults)}`);

    const contested = reserved[0].reservationId;
    const settleResults = await Promise.all(Array.from({ length: 4 }, (_, index) => oneShot({ action: 'settle-once', databasePath, userId: reserveUser, reservationId: contested, actualRetailCostCents: 60, requestId: `race:settle:${contested}:${index}` })));
    assert.equal(settleResults.filter(row => row.settled).length, 1);

    ledger = openLedger(databasePath);
    const wallet = ledger.getWallet(reserveUser);
    assert.equal(wallet.balanceCents, 440);
    assert.equal(wallet.reservedCents, 400);
    assert.equal(wallet.availableCents, 40);
    assert.equal(Number(ledger.db.prepare("SELECT COUNT(*) count FROM node_ai_ledger WHERE node_id=? AND user_id=? AND kind='inference-retail-charge'").get(NODE_ID, reserveUser)?.count || 0), 1);
    for (const row of ledger.db.prepare('SELECT reservation_id FROM node_ai_reservations WHERE node_id=? AND user_id=?').all(NODE_ID, reserveUser)) ledger.cancel({ userId: reserveUser, reservationId: row.reservation_id });
    ledger.close();
  });
});

await test('SIGKILL rolls back partial reserve and settlement transactions', async () => {
  await withDatabase(async databasePath => {
    const userId = 'user:kill-rollback';
    let ledger = openLedger(databasePath);
    ledger.creditTopUp({ userId, sourceId: 'seed:kill', grossCents: 1000 });
    ledger.close();

    let child = await startHolding({ action: 'hold-uncommitted-reserve', databasePath, userId, reservationId: 'kill:reserve:partial', maxRetailCostCents: 400 }, 'uncommitted-reserve');
    await kill(child);

    ledger = openLedger(databasePath);
    assert.equal(ledger.getWallet(userId).balanceCents, 1000);
    assert.equal(ledger.getWallet(userId).reservedCents, 0);
    assert.equal(Number(ledger.db.prepare('SELECT COUNT(*) count FROM node_ai_reservations WHERE reservation_id=?').get('kill:reserve:partial')?.count || 0), 0);
    ledger.reserve({ userId, reservationId: 'kill:settle:committed-reservation', serviceId: 'general', maxRetailCostCents: 400, ttlSeconds: 900 });
    ledger.close();

    child = await startHolding({ action: 'hold-uncommitted-settle', databasePath, userId, reservationId: 'kill:settle:committed-reservation', actualRetailCostCents: 250, requestId: 'kill:settle:partial' }, 'uncommitted-settle');
    await kill(child);

    ledger = openLedger(databasePath);
    const wallet = ledger.getWallet(userId);
    assert.equal(wallet.balanceCents, 1000);
    assert.equal(wallet.reservedCents, 400);
    assert.equal(chargeCount(ledger, 'kill:settle:partial'), 0);
    assert.ok(ledger.db.prepare('SELECT reservation_id FROM node_ai_reservations WHERE reservation_id=?').get('kill:settle:committed-reservation'));
    ledger.cancel({ userId, reservationId: 'kill:settle:committed-reservation' });
    ledger.close();
  });
});

await test('lost delivery after committed settlement replays receipt without a second provider call or charge', async () => {
  await withDatabase(async databasePath => {
    const userId = 'user:delivery-loss';
    const requestId = 'request:delivery-loss';
    const reservationId = `retail:${requestId}`;
    const receipt = { schema: 'civweave.test-receipt.v1', requestId, marker: 'durable-replay' };
    let ledger = openLedger(databasePath);
    ledger.creditTopUp({ userId, sourceId: 'seed:delivery-loss', grossCents: 1000 });
    ledger.reserve({ userId, reservationId, serviceId: 'general', maxRetailCostCents: 300, ttlSeconds: 900 });
    ledger.close();

    const child = await startHolding({ action: 'commit-inference-hold', databasePath, userId, reservationId, requestId, serviceId: 'general', actualRetailCostCents: 250, receipt }, 'committed');
    await kill(child);

    ledger = openLedger(databasePath);
    assert.equal(ledger.getWallet(userId).balanceCents, 750);
    assert.equal(ledger.getWallet(userId).reservedCents, 0);
    assert.equal(chargeCount(ledger, requestId), 1);
    assert.deepEqual(ledger.getInferenceSettlement({ userId, requestId, serviceId: 'general' }).receipt, receipt);

    let quoteCalls = 0;
    let executeCalls = 0;
    const manifest = createNodeServiceManifest({
      nodeId: NODE_ID,
      operatorId: OPERATOR_ID,
      displayName: 'Process chaos node',
      platformFeeBps: BPS,
      services: [{ id: 'general', label: 'General', capabilities: ['chat'], billing: { minimumChargeCents: 1, maxRequestCents: 500 }, backend: { provider: 'test' } }]
    });
    const gate = new NodeAiInferenceGate({
      ledger,
      manifest,
      serviceHandlers: {
        general: {
          quote: async () => { quoteCalls += 1; return { maxRetailCostCents: 300 }; },
          execute: async () => { executeCalls += 1; return { retailCostCents: 250, output: 'must-not-run' }; }
        }
      }
    });
    const replay = await gate.execute({ userId, serviceId: 'general', request: { prompt: 'retry after lost response' }, requestId });
    assert.equal(replay.replayed, true);
    assert.equal(replay.replayOutputAvailable, false);
    assert.equal(replay.output, null);
    assert.deepEqual(replay.receipt, receipt);
    assert.equal(quoteCalls, 0);
    assert.equal(executeCalls, 0);
    assert.equal(ledger.getWallet(userId).balanceCents, 750);
    assert.equal(chargeCount(ledger, requestId), 1);
    ledger.close();
  });
});

await test('same request ID cannot execute concurrently and a completed request becomes replayable', async () => {
  await withDatabase(async databasePath => {
    const userId = 'user:gate-race';
    const requestId = 'request:gate-race';
    const ledger = openLedger(databasePath);
    ledger.creditTopUp({ userId, sourceId: 'seed:gate-race', grossCents: 1000 });
    const manifest = createNodeServiceManifest({
      nodeId: NODE_ID,
      operatorId: OPERATOR_ID,
      displayName: 'Gate race node',
      platformFeeBps: BPS,
      services: [{ id: 'general', label: 'General', capabilities: ['chat'], billing: { minimumChargeCents: 1, maxRequestCents: 500 }, backend: { provider: 'test' } }]
    });
    let executeCalls = 0;
    let releaseFirst;
    const firstCanFinish = new Promise(resolve => { releaseFirst = resolve; });
    let firstStarted;
    const firstStartedPromise = new Promise(resolve => { firstStarted = resolve; });
    const gate = new NodeAiInferenceGate({
      ledger,
      manifest,
      serviceHandlers: {
        general: {
          quote: async () => ({ maxRetailCostCents: 300, ttlSeconds: 60 }),
          execute: async () => {
            executeCalls += 1;
            firstStarted();
            await firstCanFinish;
            return { retailCostCents: 200, output: { answer: 'one execution' }, usage: { calls: 1 } };
          }
        }
      }
    });

    const first = gate.execute({ userId, serviceId: 'general', request: { prompt: 'same' }, requestId });
    await firstStartedPromise;
    await assert.rejects(
      gate.execute({ userId, serviceId: 'general', request: { prompt: 'same' }, requestId }),
      error => error?.code === 'NODE_AI_REQUEST_IN_PROGRESS'
    );
    assert.equal(ledger.getWallet(userId).reservedCents, 300, 'second request must not cancel the first reservation');
    releaseFirst();
    const completed = await first;
    assert.equal(completed.replayed, false);
    assert.deepEqual(completed.output, { answer: 'one execution' });
    assert.equal(executeCalls, 1);
    assert.equal(ledger.getWallet(userId).balanceCents, 800);
    assert.equal(chargeCount(ledger, requestId), 1);

    const replay = await gate.execute({ userId, serviceId: 'general', request: { prompt: 'same' }, requestId });
    assert.equal(replay.replayed, true);
    assert.equal(replay.output, null);
    assert.equal(executeCalls, 1);
    assert.equal(ledger.getWallet(userId).balanceCents, 800);
    assert.equal(chargeCount(ledger, requestId), 1);
    ledger.close();
  });
});

await test('process death after provider completion but before local settlement preserves the reservation and never invents a charge', async () => {
  await withDatabase(async databasePath => {
    const userId = 'user:provider-gap';
    const reservationId = 'retail:request:provider-gap';
    let ledger = openLedger(databasePath);
    ledger.creditTopUp({ userId, sourceId: 'seed:provider-gap', grossCents: 1000 });
    const reserved = ledger.reserve({ userId, reservationId, serviceId: 'general', maxRetailCostCents: 300, ttlSeconds: 30 });
    const expiresAt = reserved.reservation.expiresAt;
    ledger.close();

    const child = await startHolding({ action: 'provider-completed-hold', databasePath, userId, reservationId }, 'provider-completed');
    await kill(child);

    ledger = openLedger(databasePath);
    let wallet = ledger.getWallet(userId);
    assert.equal(wallet.balanceCents, 1000);
    assert.equal(wallet.reservedCents, 300);
    assert.equal(chargeCount(ledger, 'request:provider-gap'), 0);
    assert.equal(ledger.expireReservations({ at: new Date(Date.parse(expiresAt) + 1).toISOString() }), 1);
    wallet = ledger.getWallet(userId);
    assert.equal(wallet.balanceCents, 1000);
    assert.equal(wallet.reservedCents, 0);
    assert.equal(wallet.availableCents, 1000);
    ledger.close();
  });
});

console.log(JSON.stringify({
  ok: true,
  revision: 'node-ai-process-chaos-v1',
  contracts: {
    multiProcessSQLiteSerialization: true,
    duplicateEventIdempotencyUnderRace: true,
    reservationOversubscriptionBlocked: true,
    settlementRaceSingleCharge: true,
    sigkillRollback: true,
    committedSettlementReceiptReplay: true,
    concurrentRequestProviderSuppression: true,
    providerGapEconomicSafety: true,
    providerExecutionContract: 'at-least-once across a process death after external completion and before durable local settlement; exactly-once economic settlement per request ID'
  }
}, null, 2));
