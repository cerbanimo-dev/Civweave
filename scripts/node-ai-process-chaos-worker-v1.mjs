import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { NodeAiLedger } from '../lib/node-ai-ledger-sqlite-v1.mjs';

function decode(raw) {
  if (!raw) throw new TypeError('Encoded worker config is required.');
  return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
}
function output(payload) { process.stdout.write(`${JSON.stringify(payload)}\n`); }
function openLedger(config) {
  return new NodeAiLedger({
    databasePath: config.databasePath,
    nodeId: config.nodeId,
    operatorId: config.operatorId || 'operator:process-chaos',
    platformFeeBps: Number.isSafeInteger(config.platformFeeBps) ? config.platformFeeBps : 2000
  });
}
function hold() { setInterval(() => {}, 60_000); }

const config = decode(process.argv[2]);
const action = String(config.action || '');

if (action === 'topup-loop') {
  const ledger = openLedger(config);
  try {
    let credited = 0;
    let idempotent = 0;
    for (let index = 0; index < config.count; index += 1) {
      const result = ledger.creditTopUp({
        userId: config.userId,
        sourceId: `${config.prefix}:${index}`,
        grossCents: config.amountCents,
        processorFeeCents: 0
      });
      if (result.idempotent) idempotent += 1;
      else credited += 1;
    }
    output({ ok: true, action, credited, idempotent });
  } finally { ledger.close(); }
} else if (action === 'duplicate-topup') {
  const ledger = openLedger(config);
  try {
    const result = ledger.creditTopUp({ userId: config.userId, sourceId: config.sourceId, grossCents: config.amountCents, processorFeeCents: 0 });
    output({ ok: true, action, idempotent: result.idempotent });
  } finally { ledger.close(); }
} else if (action === 'reserve-once') {
  const ledger = openLedger(config);
  try {
    try {
      const result = ledger.reserve({ userId: config.userId, reservationId: config.reservationId, serviceId: config.serviceId || 'general', maxRetailCostCents: config.maxRetailCostCents, ttlSeconds: config.ttlSeconds || 900 });
      output({ ok: true, action, reserved: true, idempotent: result.idempotent, reservationId: config.reservationId });
    } catch (error) {
      output({ ok: true, action, reserved: false, error: String(error?.message || error), reservationId: config.reservationId });
    }
  } finally { ledger.close(); }
} else if (action === 'settle-once') {
  const ledger = openLedger(config);
  try {
    try {
      const result = ledger.settle({ userId: config.userId, reservationId: config.reservationId, actualRetailCostCents: config.actualRetailCostCents, requestId: config.requestId || config.reservationId });
      output({ ok: true, action, settled: true, retailCostCents: result.retailCostCents, reservationId: config.reservationId });
    } catch (error) {
      output({ ok: true, action, settled: false, error: String(error?.message || error), reservationId: config.reservationId });
    }
  } finally { ledger.close(); }
} else if (action === 'hold-uncommitted-reserve') {
  const db = new DatabaseSync(config.databasePath);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
  const wallet = db.prepare('SELECT * FROM node_ai_wallets WHERE node_id=? AND user_id=?').get(config.nodeId, config.userId);
  if (!wallet) throw new Error('Wallet missing before crash-reserve simulation.');
  const at = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 900_000).toISOString();
  db.prepare('INSERT INTO node_ai_reservations(reservation_id,node_id,user_id,service_id,max_retail_cost_cents,metadata_json,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(config.reservationId, config.nodeId, config.userId, config.serviceId || 'general', config.maxRetailCostCents, '{}', at, expiresAt);
  db.prepare('UPDATE node_ai_wallets SET version=?,updated_at=? WHERE node_id=? AND user_id=?').run(crypto.randomUUID(), at, config.nodeId, config.userId);
  output({ ok: true, action, phase: 'uncommitted-reserve' });
  hold();
} else if (action === 'hold-uncommitted-settle') {
  const db = new DatabaseSync(config.databasePath);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
  const reservation = db.prepare('SELECT * FROM node_ai_reservations WHERE reservation_id=?').get(config.reservationId);
  if (!reservation) throw new Error('Reservation missing before crash-settle simulation.');
  const at = new Date().toISOString();
  db.prepare('DELETE FROM node_ai_reservations WHERE reservation_id=?').run(config.reservationId);
  db.prepare('UPDATE node_ai_wallets SET balance_cents=balance_cents-?,version=?,updated_at=? WHERE node_id=? AND user_id=?')
    .run(config.actualRetailCostCents, crypto.randomUUID(), at, config.nodeId, config.userId);
  db.prepare('INSERT INTO node_ai_ledger(node_id,user_id,kind,amount_cents,related_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(config.nodeId, config.userId, 'inference-retail-charge', -config.actualRetailCostCents, config.requestId || config.reservationId, '{}', at);
  output({ ok: true, action, phase: 'uncommitted-settle' });
  hold();
} else if (action === 'commit-inference-hold') {
  const ledger = openLedger(config);
  const result = ledger.settleInference({
    userId: config.userId,
    reservationId: config.reservationId,
    requestId: config.requestId,
    serviceId: config.serviceId || 'general',
    actualRetailCostCents: config.actualRetailCostCents,
    receipt: config.receipt,
    metadata: { processChaos: true }
  });
  output({ ok: true, action, phase: 'committed', idempotent: result.idempotent, retailCostCents: result.retailCostCents });
  hold();
} else if (action === 'provider-completed-hold') {
  const ledger = openLedger(config);
  try {
    const row = ledger.db.prepare('SELECT reservation_id FROM node_ai_reservations WHERE reservation_id=? AND node_id=? AND user_id=?').get(config.reservationId, config.nodeId, config.userId);
    if (!row) throw new Error('Reservation missing before provider-completed crash simulation.');
    output({ ok: true, action, phase: 'provider-completed' });
    hold();
  } catch (error) {
    ledger.close();
    throw error;
  }
} else {
  throw new RangeError(`Unknown process-chaos worker action: ${action}`);
}
