import { availableCents, getAiPlan } from './ai-wallet-policy-v1.mjs';
import { issueAiCapability } from './ai-capability-token-v1.mjs';

function clean(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}
function positiveInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new TypeError(`${label} must be a positive safe integer.`);
  return value;
}
function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative safe integer.`);
  return value;
}
function metadataJson(value) {
  if (value === undefined || value === null) return '{}';
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('metadata must be an object.');
  return JSON.stringify(value);
}
function normalizeWallet(wallet) {
  if (!wallet || typeof wallet !== 'object') return null;
  const reservations = wallet.reservations && typeof wallet.reservations === 'object' ? wallet.reservations : {};
  return {
    ...wallet,
    balanceCents: Number(wallet.balanceCents),
    reservedCents: Number(wallet.reservedCents),
    debtCents: Number(wallet.debtCents || 0),
    dailySpentCents: Number(wallet.dailySpentCents),
    reservations: Object.fromEntries(Object.entries(reservations).map(([id, item]) => [id, { ...item, maxCostCents: Number(item.maxCostCents) }]))
  };
}
const firstValue = (rows, key) => rows?.[0]?.[key] ?? null;

export class PostgresAiWalletService {
  constructor({ connectionString, capabilitySecret, sql, queryTimeoutMs = 10_000 } = {}) {
    this.connectionString = connectionString ? clean(connectionString, 'connectionString') : '';
    this.capabilitySecret = clean(capabilitySecret, 'capabilitySecret');
    if (!sql && !this.connectionString) throw new TypeError('connectionString is required when sql is not supplied.');
    if (!Number.isSafeInteger(queryTimeoutMs) || queryTimeoutMs < 100 || queryTimeoutMs > 60_000) throw new RangeError('queryTimeoutMs must be between 100 and 60000 milliseconds.');
    this.sql = sql || null;
    this.queryTimeoutMs = queryTimeoutMs;
    this.storage = 'neon-postgres-ledger';
    this.requireRegisteredDevices = true;
  }
  async #query(text, params = []) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('AI wallet database query timed out.')), this.queryTimeoutMs);
    timeout.unref?.();
    try { return await this.sql(text, params, { fetchOptions: { signal: controller.signal } }); }
    finally { clearTimeout(timeout); }
  }
  async load() {
    if (!this.sql) {
      let neon;
      try { ({ neon } = await import('@neondatabase/serverless')); }
      catch (error) { throw new Error('Postgres wallet storage requires @neondatabase/serverless. Install it before enabling AI_WALLET_STORAGE=postgres.', { cause: error }); }
      this.sql = neon(this.connectionString);
    }
    const rows = await this.#query("SELECT to_regnamespace('civweave_ai_wallet') IS NOT NULL AS ready");
    if (!rows?.[0]?.ready) throw new Error('The Civweave AI wallet schema is not installed. Run db/migrations/001-ai-wallet-ledger.sql first.');
    return this;
  }
  async flush() {}
  async getWallet(userId) {
    const rows = await this.#query('SELECT civweave_ai_wallet.wallet_snapshot($1) AS wallet', [clean(userId, 'userId')]);
    return normalizeWallet(firstValue(rows, 'wallet'));
  }
  async getSourceEvent(sourceId) {
    const rows = await this.#query(`SELECT source_id AS "sourceId", user_id AS "userId", event_type AS "type", amount_cents::int AS "amountCents", payload_hash AS "payloadHash", metadata, processed_at AS "processedAt" FROM civweave_ai_wallet.payment_events WHERE source_id = $1`, [clean(sourceId, 'sourceId')]);
    return rows?.[0] || null;
  }
  async ensureWallet({ userId, planId = 'local' }) {
    getAiPlan(planId);
    const rows = await this.#query('SELECT civweave_ai_wallet.ensure_wallet($1,$2) AS wallet', [clean(userId, 'userId'), planId]);
    return normalizeWallet(firstValue(rows, 'wallet'));
  }
  async registerDevice({ userId, deviceId, publicKey = null, label = null, metadata = {} }) {
    const rows = await this.#query('SELECT civweave_ai_wallet.register_device($1,$2,$3,$4,$5::jsonb) AS registered', [clean(userId, 'userId'), clean(deviceId, 'deviceId'), publicKey || null, label || null, metadataJson(metadata)]);
    return Boolean(firstValue(rows, 'registered'));
  }
  async revokeDevice({ userId, deviceId }) {
    const rows = await this.#query('SELECT civweave_ai_wallet.revoke_device($1,$2) AS revoked', [clean(userId, 'userId'), clean(deviceId, 'deviceId')]);
    return Boolean(firstValue(rows, 'revoked'));
  }
  async isDeviceActive({ userId, deviceId }) {
    const rows = await this.#query('SELECT civweave_ai_wallet.device_is_active($1,$2) AS active', [clean(userId, 'userId'), clean(deviceId, 'deviceId')]);
    return Boolean(firstValue(rows, 'active'));
  }
  async credit({ userId, amountCents, sourceId, planId, eventType = 'credit', payloadHash = null, metadata = {} }) {
    positiveInteger(amountCents, 'amountCents');
    if (planId) getAiPlan(planId);
    const rows = await this.#query('SELECT civweave_ai_wallet.credit_wallet($1,$2,$3,$4,$5,$6,$7::jsonb) AS wallet', [clean(userId, 'userId'), amountCents, clean(sourceId, 'sourceId'), planId || null, clean(eventType, 'eventType'), payloadHash || null, metadataJson(metadata)]);
    return normalizeWallet(firstValue(rows, 'wallet'));
  }
  async debit({ userId, amountCents, sourceId, planId, eventType = 'debit', payloadHash = null, metadata = {} }) {
    positiveInteger(amountCents, 'amountCents');
    if (planId) getAiPlan(planId);
    const rows = await this.#query('SELECT civweave_ai_wallet.debit_wallet($1,$2,$3,$4,$5,$6,$7::jsonb) AS wallet', [clean(userId, 'userId'), amountCents, clean(sourceId, 'sourceId'), planId || null, clean(eventType, 'eventType'), payloadHash || null, metadataJson(metadata)]);
    return normalizeWallet(firstValue(rows, 'wallet'));
  }
  async reserve({ userId, reservationId, maxCostCents, model, metadata = {}, ttlSeconds = 900 }) {
    positiveInteger(ttlSeconds, 'ttlSeconds', 900);
    if (ttlSeconds < 30) throw new RangeError('Reservation lifetime must be between 30 and 900 seconds.');
    const wallet = await this.getWallet(userId);
    if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${userId}.`);
    const plan = getAiPlan(wallet.planId);
    if (!plan.allowedHostedModels.includes(model)) throw new RangeError(`Model ${model} is not enabled for the ${plan.id} plan.`);
    const rows = await this.#query('SELECT civweave_ai_wallet.reserve_wallet($1,$2,$3,$4,$5::jsonb,$6,$7,$8) AS wallet', [clean(userId, 'userId'), clean(reservationId, 'reservationId'), positiveInteger(maxCostCents, 'maxCostCents'), clean(model, 'model'), metadataJson(metadata), ttlSeconds, plan.maxRequestCents, plan.dailyHostedLimitCents]);
    return normalizeWallet(firstValue(rows, 'wallet'));
  }
  async expireReservations({ userId, at = new Date().toISOString() }) {
    const timestamp = new Date(at);
    if (Number.isNaN(timestamp.getTime())) throw new TypeError('at must be a valid date.');
    const rows = await this.#query('SELECT civweave_ai_wallet.expire_reservations($1,$2::timestamptz) AS wallet', [clean(userId, 'userId'), timestamp.toISOString()]);
    return normalizeWallet(firstValue(rows, 'wallet'));
  }
  async reconcileExpiredReservations({ at = new Date().toISOString(), limit = 100 } = {}) {
    const timestamp = new Date(at);
    if (Number.isNaN(timestamp.getTime())) throw new TypeError('at must be a valid date.');
    positiveInteger(limit, 'limit', 1000);
    const rows = await this.#query(`WITH targets AS (SELECT DISTINCT user_id FROM civweave_ai_wallet.reservations WHERE status='active' AND expires_at <= $1::timestamptz ORDER BY user_id LIMIT $2) SELECT user_id AS "userId", civweave_ai_wallet.expire_reservations(user_id,$1::timestamptz) AS wallet FROM targets`, [timestamp.toISOString(), limit]);
    return rows.map(row => ({ userId: row.userId, wallet: normalizeWallet(row.wallet) }));
  }
  async settle({ userId, reservationId, actualCostCents, requestId = null, metadata = {} }) {
    nonNegativeInteger(actualCostCents, 'actualCostCents');
    const rows = await this.#query('SELECT civweave_ai_wallet.settle_wallet($1,$2,$3,$4,$5::jsonb) AS wallet', [clean(userId, 'userId'), clean(reservationId, 'reservationId'), actualCostCents, requestId || null, metadataJson(metadata)]);
    return normalizeWallet(firstValue(rows, 'wallet'));
  }
  async cancel({ userId, reservationId, metadata = {} }) {
    const rows = await this.#query('SELECT civweave_ai_wallet.cancel_wallet($1,$2,$3::jsonb) AS wallet', [clean(userId, 'userId'), clean(reservationId, 'reservationId'), metadataJson(metadata)]);
    return normalizeWallet(firstValue(rows, 'wallet'));
  }
  async listLedgerEntries({ userId, limit = 100, before = null }) {
    positiveInteger(limit, 'limit', 500);
    const beforeDate = before ? new Date(before) : null;
    if (beforeDate && Number.isNaN(beforeDate.getTime())) throw new TypeError('before must be a valid date.');
    return this.#query(`SELECT entry_id::text AS "entryId", user_id AS "userId", entry_type AS "entryType", delta_balance_cents::int AS "deltaBalanceCents", delta_reserved_cents::int AS "deltaReservedCents", delta_debt_cents::int AS "deltaDebtCents", source_id AS "sourceId", reservation_id AS "reservationId", request_id AS "requestId", wallet_version::text AS "walletVersion", metadata, created_at AS "createdAt" FROM civweave_ai_wallet.ledger_entries WHERE user_id=$1 AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz) ORDER BY created_at DESC, entry_id DESC LIMIT $3`, [clean(userId, 'userId'), beforeDate?.toISOString() || null, limit]);
  }
  async issueCapability({ userId, deviceId, models, maxRequestCents, ttlSeconds = 900 }) {
    const wallet = await this.getWallet(userId);
    if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${userId}.`);
    if (wallet.debtCents > 0) throw new RangeError('Hosted-AI wallet has an unpaid refund or chargeback balance.');
    if (!await this.isDeviceActive({ userId, deviceId })) throw new Error('Wallet device is not registered or has been revoked.');
    const plan = getAiPlan(wallet.planId);
    const allowedModels = Array.isArray(models) && models.length ? [...new Set(models)] : [...plan.allowedHostedModels];
    if (!allowedModels.length || allowedModels.some(model => !plan.allowedHostedModels.includes(model))) throw new RangeError(`Requested model set exceeds the ${plan.id} plan.`);
    if (!Number.isSafeInteger(maxRequestCents) || maxRequestCents < 1 || maxRequestCents > plan.maxRequestCents) throw new RangeError(`Capability exceeds the ${plan.id} per-request limit.`);
    if (availableCents(wallet) < maxRequestCents) throw new RangeError('Insufficient hosted-AI balance for this capability ceiling.');
    return issueAiCapability({ userId, deviceId, planId: wallet.planId, models: allowedModels, maxRequestCents, dailyLimitCents: plan.dailyHostedLimitCents, walletVersion: wallet.walletVersion, ttlSeconds }, { secret: this.capabilitySecret });
  }
}
