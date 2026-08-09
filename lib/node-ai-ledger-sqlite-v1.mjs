import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { quoteNodeTopUp } from './node-ai-marketplace-v1.mjs';

const LEDGER_SCHEMA = 'civweave.node-ai-ledger.v1';
const WALLET_SCHEMA = 'civweave.node-ai-wallet.v1';

function text(value, label, max = 500) {
  const normalized = String(value ?? '').trim().slice(0, max);
  if (!normalized) throw new TypeError(`${label} is required.`);
  return normalized;
}
function cents(value, label, { positive = false } = {}) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) throw new TypeError(`${label} must be ${positive ? 'a positive' : 'a non-negative'} integer number of cents.`);
  return value;
}
function iso(value = new Date().toISOString(), label = 'at') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${label} must be a valid date.`);
  return date.toISOString();
}
function json(value) { return JSON.stringify(value ?? {}); }
function parseJson(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }
function safeInt(value) { return Number(value || 0); }

export class NodeAiLedger {
  constructor({ databasePath, nodeId, operatorId, platformFeeBps }) {
    this.nodeId = text(nodeId, 'nodeId', 180);
    this.operatorId = text(operatorId, 'operatorId', 180);
    if (!Number.isSafeInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 10_000) throw new RangeError('platformFeeBps must be an integer from 0 through 10000.');
    this.platformFeeBps = platformFeeBps;
    this.storage = 'node-sqlite-ledger';
    this.requireRegisteredDevices = true;
    this.databasePath = path.resolve(text(databasePath, 'databasePath', 4000));
    mkdirSync(path.dirname(this.databasePath), { recursive: true });
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;');
    this.#initialize();
  }

  #initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS node_ai_wallets (
        node_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        wallet_id TEXT NOT NULL UNIQUE,
        balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents >= 0),
        debt_cents INTEGER NOT NULL DEFAULT 0 CHECK(debt_cents >= 0),
        version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(node_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS node_ai_devices (
        device_id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        public_key TEXT,
        label TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        revoked_at TEXT
      );
      CREATE TABLE IF NOT EXISTS node_ai_payment_events (
        source_id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        gross_cents INTEGER NOT NULL DEFAULT 0,
        processor_fee_cents INTEGER NOT NULL DEFAULT 0,
        user_credit_cents INTEGER NOT NULL DEFAULT 0,
        platform_fee_cents INTEGER NOT NULL DEFAULT 0,
        node_net_cash_cents INTEGER NOT NULL DEFAULT 0,
        payload_hash TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS node_ai_reservations (
        reservation_id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        max_retail_cost_cents INTEGER NOT NULL CHECK(max_retail_cost_cents > 0),
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS node_ai_ledger (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        user_id TEXT,
        kind TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        related_id TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS node_ai_ledger_user_idx ON node_ai_ledger(node_id, user_id, sequence DESC);
      CREATE INDEX IF NOT EXISTS node_ai_payment_period_idx ON node_ai_payment_events(node_id, created_at);
      CREATE INDEX IF NOT EXISTS node_ai_reservation_expiry_idx ON node_ai_reservations(node_id, expires_at);
    `);
  }

  close() { this.db.close(); }

  #tx(operation) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  #walletRow(userId) {
    return this.db.prepare('SELECT * FROM node_ai_wallets WHERE node_id = ? AND user_id = ?').get(this.nodeId, text(userId, 'userId', 180));
  }

  #reservedCents(userId) {
    const row = this.db.prepare('SELECT COALESCE(SUM(max_retail_cost_cents), 0) AS total FROM node_ai_reservations WHERE node_id = ? AND user_id = ?').get(this.nodeId, text(userId, 'userId', 180));
    return safeInt(row?.total);
  }

  #publicWallet(row) {
    if (!row) return null;
    const balanceCents = safeInt(row.balance_cents);
    const debtCents = safeInt(row.debt_cents);
    const reservedCents = this.#reservedCents(row.user_id);
    const unreservedCents = Math.max(0, balanceCents - reservedCents);
    return Object.freeze({
      schema: WALLET_SCHEMA,
      nodeId: row.node_id,
      walletId: row.wallet_id,
      userId: row.user_id,
      balanceCents,
      reservedCents,
      unreservedCents,
      availableCents: debtCents > 0 ? 0 : unreservedCents,
      debtCents,
      walletVersion: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  ensureWallet({ userId }) {
    const id = text(userId, 'userId', 180);
    const found = this.#walletRow(id);
    if (found) return this.#publicWallet(found);
    const at = new Date().toISOString();
    try {
      this.db.prepare(`INSERT INTO node_ai_wallets(node_id,user_id,wallet_id,balance_cents,debt_cents,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`)
        .run(this.nodeId, id, `wallet:${crypto.randomUUID()}`, 0, 0, crypto.randomUUID(), at, at);
    } catch (error) {
      if (!/UNIQUE|constraint/i.test(String(error?.message || ''))) throw error;
    }
    return this.#publicWallet(this.#walletRow(id));
  }

  getWallet(userId) { return this.#publicWallet(this.#walletRow(userId)); }

  registerDevice({ userId, deviceId, publicKey = null, label = null, metadata = {} }) {
    const owner = text(userId, 'userId', 180);
    const id = text(deviceId, 'deviceId', 180);
    this.ensureWallet({ userId: owner });
    const prior = this.db.prepare('SELECT * FROM node_ai_devices WHERE device_id = ?').get(id);
    if (prior && (prior.user_id !== owner || prior.node_id !== this.nodeId)) throw new Error('Device is already bound to a different node user.');
    const at = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO node_ai_devices(device_id,node_id,user_id,public_key,label,metadata_json,created_at,last_seen_at,revoked_at)
      VALUES(?,?,?,?,?,?,?,?,NULL)
      ON CONFLICT(device_id) DO UPDATE SET public_key=excluded.public_key,label=excluded.label,metadata_json=excluded.metadata_json,last_seen_at=excluded.last_seen_at,revoked_at=NULL
    `).run(id, this.nodeId, owner, publicKey || prior?.public_key || null, label || prior?.label || null, json({ ...parseJson(prior?.metadata_json), ...(metadata || {}) }), prior?.created_at || at, at);
    return true;
  }

  revokeDevice({ userId, deviceId }) {
    const result = this.db.prepare('UPDATE node_ai_devices SET revoked_at = ? WHERE device_id = ? AND node_id = ? AND user_id = ? AND revoked_at IS NULL')
      .run(new Date().toISOString(), text(deviceId, 'deviceId', 180), this.nodeId, text(userId, 'userId', 180));
    return Number(result.changes || 0) > 0;
  }

  isDeviceActive({ userId, deviceId }) {
    return Boolean(this.db.prepare('SELECT 1 AS active FROM node_ai_devices WHERE device_id = ? AND node_id = ? AND user_id = ? AND revoked_at IS NULL')
      .get(text(deviceId, 'deviceId', 180), this.nodeId, text(userId, 'userId', 180)));
  }

  creditTopUp({ userId, sourceId, grossCents, processorFeeCents = 0, userCreditCents = grossCents, payloadHash = null, metadata = {}, at = new Date().toISOString() }) {
    const owner = text(userId, 'userId', 180);
    const source = text(sourceId, 'sourceId', 240);
    const timestamp = iso(at);
    const quote = quoteNodeTopUp({ nodeId: this.nodeId, grossCents, processorFeeCents, platformFeeBps: this.platformFeeBps, userCreditCents });
    return this.#tx(() => {
      const prior = this.db.prepare('SELECT * FROM node_ai_payment_events WHERE source_id = ?').get(source);
      if (prior) {
        if (prior.user_id !== owner || prior.node_id !== this.nodeId) throw new Error('Payment source ID is already bound to a different node user.');
        return { wallet: this.#publicWallet(this.#walletRow(owner)), quote: Object.freeze({ ...quote, platformFeeCents: safeInt(prior.platform_fee_cents), nodeNetCashCents: safeInt(prior.node_net_cash_cents), userCreditCents: safeInt(prior.user_credit_cents) }), idempotent: true };
      }
      let wallet = this.#walletRow(owner);
      if (!wallet) {
        const createdAt = timestamp;
        this.db.prepare(`INSERT INTO node_ai_wallets(node_id,user_id,wallet_id,balance_cents,debt_cents,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`)
          .run(this.nodeId, owner, `wallet:${crypto.randomUUID()}`, 0, 0, crypto.randomUUID(), createdAt, createdAt);
        wallet = this.#walletRow(owner);
      }
      const debt = safeInt(wallet.debt_cents);
      const appliedToDebtCents = Math.min(debt, quote.userCreditCents);
      const creditedToBalanceCents = quote.userCreditCents - appliedToDebtCents;
      this.db.prepare('UPDATE node_ai_wallets SET balance_cents = balance_cents + ?, debt_cents = debt_cents - ?, version = ?, updated_at = ? WHERE node_id = ? AND user_id = ?')
        .run(creditedToBalanceCents, appliedToDebtCents, crypto.randomUUID(), timestamp, this.nodeId, owner);
      this.db.prepare(`INSERT INTO node_ai_payment_events(source_id,node_id,user_id,event_type,gross_cents,processor_fee_cents,user_credit_cents,platform_fee_cents,node_net_cash_cents,payload_hash,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(source, this.nodeId, owner, 'topup.paid', quote.grossCents, quote.processorFeeCents, quote.userCreditCents, quote.platformFeeCents, quote.nodeNetCashCents, payloadHash, json({ ...metadata, appliedToDebtCents, creditedToBalanceCents }), timestamp);
      this.db.prepare('INSERT INTO node_ai_ledger(node_id,user_id,kind,amount_cents,related_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(this.nodeId, owner, 'topup-credit', creditedToBalanceCents, source, json({ grossCents: quote.grossCents, platformFeeCents: quote.platformFeeCents, appliedToDebtCents, ...metadata }), timestamp);
      this.db.prepare('INSERT INTO node_ai_ledger(node_id,user_id,kind,amount_cents,related_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(this.nodeId, owner, 'cerbanimo-platform-fee-accrual', quote.platformFeeCents, source, json({ feeBasis: 'gross-topup', platformFeeBps: this.platformFeeBps }), timestamp);
      return { wallet: this.#publicWallet(this.#walletRow(owner)), quote, idempotent: false };
    });
  }

  debitAdjustment({ userId, sourceId, amountCents, eventType = 'topup.refunded', payloadHash = null, metadata = {}, at = new Date().toISOString() }) {
    const owner = text(userId, 'userId', 180);
    const source = text(sourceId, 'sourceId', 240);
    const amount = cents(amountCents, 'amountCents', { positive: true });
    const timestamp = iso(at);
    return this.#tx(() => {
      const prior = this.db.prepare('SELECT * FROM node_ai_payment_events WHERE source_id = ?').get(source);
      if (prior) {
        if (prior.user_id !== owner || prior.node_id !== this.nodeId) throw new Error('Adjustment source ID is already bound to a different node user.');
        return { wallet: this.#publicWallet(this.#walletRow(owner)), idempotent: true };
      }
      const wallet = this.#walletRow(owner);
      if (!wallet) throw new RangeError(`No node AI wallet exists for ${owner}.`);
      const reserved = this.#reservedCents(owner);
      const available = Math.max(0, safeInt(wallet.balance_cents) - reserved);
      const recoveredCents = Math.min(available, amount);
      const debtAddedCents = amount - recoveredCents;
      this.db.prepare('UPDATE node_ai_wallets SET balance_cents = balance_cents - ?, debt_cents = debt_cents + ?, version = ?, updated_at = ? WHERE node_id = ? AND user_id = ?')
        .run(recoveredCents, debtAddedCents, crypto.randomUUID(), timestamp, this.nodeId, owner);
      this.db.prepare(`INSERT INTO node_ai_payment_events(source_id,node_id,user_id,event_type,gross_cents,processor_fee_cents,user_credit_cents,platform_fee_cents,node_net_cash_cents,payload_hash,metadata_json,created_at) VALUES(?,?,?,?,0,0,?,0,0,?,?,?)`)
        .run(source, this.nodeId, owner, text(eventType, 'eventType', 80), amount, payloadHash, json({ ...metadata, recoveredCents, debtAddedCents }), timestamp);
      this.db.prepare('INSERT INTO node_ai_ledger(node_id,user_id,kind,amount_cents,related_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(this.nodeId, owner, text(eventType, 'eventType', 80), -recoveredCents, source, json({ debtAddedCents, ...metadata }), timestamp);
      return { wallet: this.#publicWallet(this.#walletRow(owner)), idempotent: false, recoveredCents, debtAddedCents };
    });
  }

  reserve({ userId, reservationId, serviceId, maxRetailCostCents, metadata = {}, ttlSeconds = 900, at = new Date().toISOString() }) {
    const owner = text(userId, 'userId', 180);
    const id = text(reservationId, 'reservationId', 180);
    const service = text(serviceId, 'serviceId', 120);
    const maximum = cents(maxRetailCostCents, 'maxRetailCostCents', { positive: true });
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 3600) throw new RangeError('Reservation lifetime must be between 30 and 3600 seconds.');
    const timestamp = iso(at);
    return this.#tx(() => {
      const existing = this.db.prepare('SELECT * FROM node_ai_reservations WHERE reservation_id = ?').get(id);
      if (existing) {
        if (existing.node_id !== this.nodeId || existing.user_id !== owner) throw new Error('Reservation ID is already bound to another node user.');
        return { wallet: this.#publicWallet(this.#walletRow(owner)), reservation: this.#publicReservation(existing), idempotent: true };
      }
      const wallet = this.#walletRow(owner);
      if (!wallet) throw new RangeError(`No node AI wallet exists for ${owner}.`);
      if (safeInt(wallet.debt_cents) > 0) throw new RangeError('Node AI wallet has an unpaid refund or chargeback balance.');
      const available = Math.max(0, safeInt(wallet.balance_cents) - this.#reservedCents(owner));
      if (available < maximum) throw new RangeError('Insufficient node AI balance.');
      const expiresAt = new Date(Date.parse(timestamp) + ttlSeconds * 1000).toISOString();
      this.db.prepare('INSERT INTO node_ai_reservations(reservation_id,node_id,user_id,service_id,max_retail_cost_cents,metadata_json,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(id, this.nodeId, owner, service, maximum, json(metadata), timestamp, expiresAt);
      this.db.prepare('UPDATE node_ai_wallets SET version = ?, updated_at = ? WHERE node_id = ? AND user_id = ?').run(crypto.randomUUID(), timestamp, this.nodeId, owner);
      return { wallet: this.#publicWallet(this.#walletRow(owner)), reservation: this.#publicReservation(this.db.prepare('SELECT * FROM node_ai_reservations WHERE reservation_id = ?').get(id)), idempotent: false };
    });
  }

  #publicReservation(row) {
    if (!row) return null;
    return Object.freeze({ reservationId: row.reservation_id, nodeId: row.node_id, userId: row.user_id, serviceId: row.service_id, maxRetailCostCents: safeInt(row.max_retail_cost_cents), metadata: parseJson(row.metadata_json), createdAt: row.created_at, expiresAt: row.expires_at });
  }

  settle({ userId, reservationId, actualRetailCostCents, requestId = null, metadata = {}, at = new Date().toISOString() }) {
    const owner = text(userId, 'userId', 180);
    const id = text(reservationId, 'reservationId', 180);
    const actual = cents(actualRetailCostCents, 'actualRetailCostCents');
    const timestamp = iso(at);
    return this.#tx(() => {
      const reservation = this.db.prepare('SELECT * FROM node_ai_reservations WHERE reservation_id = ?').get(id);
      if (!reservation || reservation.node_id !== this.nodeId || reservation.user_id !== owner) throw new RangeError(`Unknown node AI reservation: ${id}`);
      if (actual > safeInt(reservation.max_retail_cost_cents)) throw new RangeError('Actual retail cost cannot exceed the reserved maximum.');
      const wallet = this.#walletRow(owner);
      if (!wallet) throw new RangeError(`No node AI wallet exists for ${owner}.`);
      if (safeInt(wallet.balance_cents) < actual) throw new RangeError('Node AI wallet balance changed below settlement cost.');
      this.db.prepare('DELETE FROM node_ai_reservations WHERE reservation_id = ?').run(id);
      this.db.prepare('UPDATE node_ai_wallets SET balance_cents = balance_cents - ?, version = ?, updated_at = ? WHERE node_id = ? AND user_id = ?')
        .run(actual, crypto.randomUUID(), timestamp, this.nodeId, owner);
      this.db.prepare('INSERT INTO node_ai_ledger(node_id,user_id,kind,amount_cents,related_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(this.nodeId, owner, 'inference-retail-charge', -actual, requestId || id, json({ reservationId: id, serviceId: reservation.service_id, ...metadata }), timestamp);
      return { wallet: this.#publicWallet(this.#walletRow(owner)), serviceId: reservation.service_id, retailCostCents: actual };
    });
  }

  cancel({ userId, reservationId, at = new Date().toISOString() }) {
    const owner = text(userId, 'userId', 180);
    const id = text(reservationId, 'reservationId', 180);
    const timestamp = iso(at);
    return this.#tx(() => {
      const reservation = this.db.prepare('SELECT * FROM node_ai_reservations WHERE reservation_id = ?').get(id);
      if (!reservation || reservation.node_id !== this.nodeId || reservation.user_id !== owner) return { wallet: this.#publicWallet(this.#walletRow(owner)), cancelled: false };
      this.db.prepare('DELETE FROM node_ai_reservations WHERE reservation_id = ?').run(id);
      this.db.prepare('UPDATE node_ai_wallets SET version = ?, updated_at = ? WHERE node_id = ? AND user_id = ?').run(crypto.randomUUID(), timestamp, this.nodeId, owner);
      return { wallet: this.#publicWallet(this.#walletRow(owner)), cancelled: true };
    });
  }

  expireReservations({ at = new Date().toISOString(), limit = 500 } = {}) {
    const timestamp = iso(at);
    const rows = this.db.prepare('SELECT reservation_id,user_id FROM node_ai_reservations WHERE node_id = ? AND expires_at <= ? ORDER BY expires_at LIMIT ?').all(this.nodeId, timestamp, Math.max(1, Math.min(5000, Number(limit) || 500)));
    if (!rows.length) return 0;
    return this.#tx(() => {
      let count = 0;
      const touched = new Set();
      for (const row of rows) {
        const result = this.db.prepare('DELETE FROM node_ai_reservations WHERE reservation_id = ? AND node_id = ?').run(row.reservation_id, this.nodeId);
        if (Number(result.changes || 0)) { count += 1; touched.add(row.user_id); }
      }
      for (const userId of touched) this.db.prepare('UPDATE node_ai_wallets SET version = ?, updated_at = ? WHERE node_id = ? AND user_id = ?').run(crypto.randomUUID(), timestamp, this.nodeId, userId);
      return count;
    });
  }

  listLedgerEntries({ userId = null, limit = 100, beforeSequence = null } = {}) {
    const bounded = Math.max(1, Math.min(500, Number(limit) || 100));
    const clauses = ['node_id = ?']; const args = [this.nodeId];
    if (userId) { clauses.push('user_id = ?'); args.push(text(userId, 'userId', 180)); }
    if (beforeSequence != null) { clauses.push('sequence < ?'); args.push(Number(beforeSequence)); }
    args.push(bounded);
    return this.db.prepare(`SELECT sequence,user_id,kind,amount_cents,related_id,metadata_json,created_at FROM node_ai_ledger WHERE ${clauses.join(' AND ')} ORDER BY sequence DESC LIMIT ?`).all(...args).map(row => ({ sequence: safeInt(row.sequence), userId: row.user_id, kind: row.kind, amountCents: safeInt(row.amount_cents), relatedId: row.related_id, metadata: parseJson(row.metadata_json), createdAt: row.created_at }));
  }

  settlementSummary({ periodStart, periodEnd }) {
    const start = iso(periodStart, 'periodStart');
    const end = iso(periodEnd, 'periodEnd');
    if (Date.parse(end) <= Date.parse(start)) throw new RangeError('periodEnd must be after periodStart.');
    const row = this.db.prepare(`
      SELECT COUNT(*) AS topup_count,
             COALESCE(SUM(gross_cents),0) AS gross,
             COALESCE(SUM(processor_fee_cents),0) AS processor,
             COALESCE(SUM(user_credit_cents),0) AS credits,
             COALESCE(SUM(platform_fee_cents),0) AS platform_fee,
             COALESCE(SUM(node_net_cash_cents),0) AS node_net
      FROM node_ai_payment_events
      WHERE node_id = ? AND event_type = 'topup.paid' AND created_at >= ? AND created_at < ?
    `).get(this.nodeId, start, end);
    const usage = this.db.prepare(`SELECT COUNT(*) AS count FROM node_ai_ledger WHERE node_id = ? AND kind = 'inference-retail-charge' AND created_at >= ? AND created_at < ?`).get(this.nodeId, start, end);
    return Object.freeze({
      schema: LEDGER_SCHEMA,
      nodeId: this.nodeId,
      operatorId: this.operatorId,
      platformFeeBps: this.platformFeeBps,
      periodStart: start,
      periodEnd: end,
      topupCount: safeInt(row.topup_count),
      grossTopupsCents: safeInt(row.gross),
      processorFeesCents: safeInt(row.processor),
      userCreditsIssuedCents: safeInt(row.credits),
      platformFeeDueCents: safeInt(row.platform_fee),
      nodeNetCashCents: safeInt(row.node_net),
      usageReceiptCount: safeInt(usage?.count)
    });
  }
}
