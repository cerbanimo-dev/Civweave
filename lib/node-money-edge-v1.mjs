import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export const NODE_MONEY_EDGE_SCHEMA = 'civweave.node-money-edge.v1';
export const NODE_MONEY_EVENT_SCHEMA = 'civweave.node-payment-event.v1';
export const NODE_MONEY_CHALLENGE_DOMAIN = 'civweave.node-live-challenge.v1';
export const NODE_MONEY_REQUEST_DOMAIN = 'civweave.node-money-edge-request.v1';
export const MONEY_EDGE_EVENT_DOMAIN = 'civweave.money-edge-event.v1';

function configBool(value) { return value === true || ['1','true','yes','on'].includes(String(value ?? '').trim().toLowerCase()); }
export function loadNodeMoneyEdgeConfig(env = process.env) {
  return Object.freeze({
    liveMoneyEnabled: configBool(env.CIVWEAVE_MONEY_LIVE_ENABLED),
    emergencyStop: configBool(env.CIVWEAVE_MONEY_EMERGENCY_STOP),
    complianceApproved: configBool(env.CIVWEAVE_MONEY_COMPLIANCE_APPROVED),
    jurisdictionApproved: configBool(env.CIVWEAVE_MONEY_JURISDICTION_APPROVED),
    kycAmlReady: configBool(env.CIVWEAVE_MONEY_KYC_AML_READY),
    taxReportingReady: configBool(env.CIVWEAVE_MONEY_TAX_REPORTING_READY),
    termsApproved: configBool(env.CIVWEAVE_MONEY_TERMS_APPROVED)
  });
}

function text(value, label, max = 4000) {
  const normalized = String(value ?? '').trim().slice(0, max);
  if (!normalized) throw new TypeError(`${label} is required.`);
  return normalized;
}
function cents(value, label, { positive = false, max = 5_000_000 } = {}) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > max) throw new RangeError(`${label} must be ${positive ? 'a positive' : 'a non-negative'} integer no greater than ${max} cents.`);
  return value;
}
function bps(value, label = 'platformFeeBps') {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) throw new RangeError(`${label} must be an integer from 0 through 10000.`);
  return value;
}
function isoNow(now) { return new Date(now()).toISOString(); }
function cleanOrigin(value, { live = false } = {}) {
  const url = new URL(text(value, 'callbackUrl'));
  if (live && url.protocol !== 'https:') throw new RangeError('Live money node callback URLs must use HTTPS.');
  if (!['https:', 'http:'].includes(url.protocol)) throw new RangeError('Node callback URL must use HTTP or HTTPS.');
  return url.origin;
}
function safeReturnUrl(value, nodeOrigin) {
  const url = new URL(text(value, 'return URL'));
  if (url.origin !== nodeOrigin) throw new RangeError('Checkout return URLs must stay on the registered node origin.');
  return url.href;
}
function json(value) { return JSON.stringify(value ?? {}); }
function parseJson(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }
function sha256(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : Buffer.from(String(value))).digest('hex'); }
function parseSignedHeader(header) {
  const values = Object.fromEntries(String(header || '').split(',').map(part => part.trim().split('=', 2)).filter(parts => parts.length === 2));
  const timestamp = Number(values.t), keyId = String(values.kid || '').trim(), signature = String(values.sig || '').trim();
  if (!Number.isSafeInteger(timestamp) || !signature) throw new Error('Malformed Civweave money signature header.');
  return { timestamp, keyId, signature };
}
function verifyDetached({ publicKey, domain, timestamp, raw, signature }) {
  const message = Buffer.concat([Buffer.from(`${domain}\n${timestamp}\n`), Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw))]);
  return crypto.verify(null, message, publicKey, Buffer.from(signature, 'base64url'));
}
function signDetached({ privateKey, keyId, domain, timestamp, raw }) {
  const message = Buffer.concat([Buffer.from(`${domain}\n${timestamp}\n`), Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw))]);
  return `t=${timestamp},kid=${keyId},sig=${crypto.sign(null, message, privateKey).toString('base64url')}`;
}

export function verifyNodeChallenge({ nodeId, challenge, publicKey, signature }) {
  const raw = Buffer.from(`${text(nodeId, 'nodeId', 180)}\n${text(challenge, 'challenge', 300)}`);
  return verifyDetached({ publicKey, domain: NODE_MONEY_CHALLENGE_DOMAIN, timestamp: 0, raw, signature: text(signature, 'signature', 2000) });
}

export class NodeMoneyEdgeService {
  constructor({
    databasePath = path.join(process.env.DATA_DIR || './data', 'node-money-edge-v1.sqlite'),
    provider,
    privateKey = process.env.CIVWEAVE_MONEY_EDGE_PRIVATE_KEY || '',
    keyId = process.env.CIVWEAVE_MONEY_EDGE_KEY_ID || 'cerbanimo-money-edge-v1',
    config = loadNodeMoneyEdgeConfig(process.env),
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
    signatureToleranceSeconds = 300,
    maxTopUpCents = Number(process.env.CIVWEAVE_MONEY_MAX_TOPUP_CENTS || 100_000)
  } = {}) {
    this.provider = provider;
    this.privateKey = String(privateKey || '').trim();
    this.keyId = String(keyId || '').trim() || 'cerbanimo-money-edge-v1';
    this.config = { ...config };
    this.fetch = fetchImpl;
    this.now = now;
    this.signatureToleranceSeconds = signatureToleranceSeconds;
    this.maxTopUpCents = Math.max(100, Math.min(5_000_000, Number(maxTopUpCents) || 100_000));
    this.databasePath = path.resolve(databasePath);
    mkdirSync(path.dirname(this.databasePath), { recursive: true });
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;');
    this.#init();
  }

  #init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS money_edge_nodes(
        node_id TEXT PRIMARY KEY,
        operator_id TEXT NOT NULL,
        connected_account_id TEXT NOT NULL UNIQUE,
        callback_origin TEXT NOT NULL,
        receipt_public_key TEXT NOT NULL,
        platform_fee_bps INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS money_edge_topups(
        topup_id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        node_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        gross_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        platform_fee_cents INTEGER NOT NULL,
        processor_fee_cents INTEGER NOT NULL DEFAULT 0,
        user_credit_cents INTEGER NOT NULL,
        status TEXT NOT NULL,
        stripe_session_id TEXT UNIQUE,
        stripe_payment_intent_id TEXT,
        stripe_charge_id TEXT UNIQUE,
        stripe_balance_transaction_id TEXT,
        checkout_url TEXT,
        refunded_cents INTEGER NOT NULL DEFAULT 0,
        disputed_cents INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        settled_at TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(node_id) REFERENCES money_edge_nodes(node_id)
      );
      CREATE TABLE IF NOT EXISTS money_edge_deliveries(
        delivery_id TEXT PRIMARY KEY,
        source_event_id TEXT NOT NULL UNIQUE,
        topup_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        delivered_at TEXT,
        FOREIGN KEY(topup_id) REFERENCES money_edge_topups(topup_id),
        FOREIGN KEY(node_id) REFERENCES money_edge_nodes(node_id)
      );
      CREATE INDEX IF NOT EXISTS money_edge_delivery_pending_idx ON money_edge_deliveries(status,created_at);
      CREATE INDEX IF NOT EXISTS money_edge_topup_node_idx ON money_edge_topups(node_id,created_at DESC);
    `);
  }

  close() { this.db.close(); }

  readiness() {
    const provider = this.provider || {};
    const structuralBlockers = [];
    if (!provider.id) structuralBlockers.push('payment-provider-missing');
    if (typeof provider.createStandardAccount !== 'function') structuralBlockers.push('connect-account-creation-missing');
    if (typeof provider.createAccountLink !== 'function') structuralBlockers.push('connect-onboarding-link-missing');
    if (typeof provider.createTopUpCheckout !== 'function') structuralBlockers.push('checkout-creation-missing');
    if (typeof provider.verifyTopUpSession !== 'function') structuralBlockers.push('checkout-verification-missing');
    if (typeof provider.verifyWebhook !== 'function') structuralBlockers.push('webhook-verification-missing');
    if (!this.privateKey) structuralBlockers.push('money-edge-signing-key-missing');
    if (typeof this.fetch !== 'function') structuralBlockers.push('delivery-fetch-missing');
    const operationalBlockers = [];
    if (this.config.emergencyStop) operationalBlockers.push('emergency-stop-active');
    if (!this.config.liveMoneyEnabled) operationalBlockers.push('live-money-disabled');
    if (provider.mode !== 'live') operationalBlockers.push('provider-not-live');
    if (!provider.credentialsPresent) operationalBlockers.push('provider-credentials-missing');
    if (!provider.webhookVerificationReady) operationalBlockers.push('provider-webhook-verification-not-ready');
    if (!this.config.complianceApproved) operationalBlockers.push('compliance-approval-missing');
    if (!this.config.jurisdictionApproved) operationalBlockers.push('jurisdiction-approval-missing');
    if (!this.config.kycAmlReady) operationalBlockers.push('kyc-aml-readiness-missing');
    if (!this.config.taxReportingReady) operationalBlockers.push('tax-reporting-readiness-missing');
    if (!this.config.termsApproved) operationalBlockers.push('provider-terms-not-approved');
    return Object.freeze({
      schema: NODE_MONEY_EDGE_SCHEMA,
      provider: provider.id || null,
      providerMode: provider.mode || null,
      operatorPayouts: provider.operatorPayouts || null,
      integrationDoorReady: structuralBlockers.length === 0,
      liveReady: structuralBlockers.length === 0 && operationalBlockers.length === 0,
      structuralBlockers,
      operationalBlockers
    });
  }

  #node(nodeId) {
    return this.db.prepare('SELECT * FROM money_edge_nodes WHERE node_id = ?').get(text(nodeId, 'nodeId', 180)) || null;
  }
  #topupById(topupId) { return this.db.prepare('SELECT * FROM money_edge_topups WHERE topup_id = ?').get(text(topupId, 'topupId', 180)) || null; }
  #topupBySession(sessionId) { return this.db.prepare('SELECT * FROM money_edge_topups WHERE stripe_session_id = ?').get(text(sessionId, 'sessionId', 220)) || null; }
  #topupByCharge(chargeId) { return this.db.prepare('SELECT * FROM money_edge_topups WHERE stripe_charge_id = ?').get(text(chargeId, 'chargeId', 220)) || null; }

  verifyNodeRequest(nodeId, rawBody, signatureHeader) {
    const node = this.#node(nodeId);
    if (!node) throw Object.assign(new Error('Node is not registered with the money edge.'), { status: 404 });
    const { timestamp, signature } = parseSignedHeader(signatureHeader);
    if (Math.abs(Math.floor(this.now() / 1000) - timestamp) > this.signatureToleranceSeconds) throw Object.assign(new Error('Node money-edge request signature is outside the replay window.'), { status: 401 });
    if (!verifyDetached({ publicKey: node.receipt_public_key, domain: NODE_MONEY_REQUEST_DOMAIN, timestamp, raw: rawBody, signature })) throw Object.assign(new Error('Node money-edge request signature is invalid.'), { status: 401 });
    return node;
  }

  async #probeNode({ nodeId, operatorId, callbackOrigin }) {
    const manifestResponse = await this.fetch(new URL('/api/ai/node/manifest', callbackOrigin), { headers: { accept: 'application/json' }, cache: 'no-store' });
    const envelope = await manifestResponse.json().catch(() => ({}));
    if (!manifestResponse.ok) throw new Error('Money edge could not fetch the node manifest.');
    const manifest = envelope?.manifest || {};
    if (manifest.nodeId !== nodeId || manifest.operatorId !== operatorId) throw new Error('Node manifest identity does not match money-edge registration.');
    if (!manifest.publicKey) throw new Error('Live-money nodes must advertise a receipt public key.');
    const feeBps = bps(Number(manifest?.platformFee?.basisPoints), 'manifest platform fee');
    const challenge = crypto.randomBytes(32).toString('base64url');
    const response = await this.fetch(new URL('/api/ai/node/live/challenge', callbackOrigin), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ nodeId, challenge }) });
    const proof = await response.json().catch(() => ({}));
    if (!response.ok || !proof.signature) throw new Error('Node did not answer the live-money proof challenge.');
    if (!verifyNodeChallenge({ nodeId, challenge, publicKey: manifest.publicKey, signature: proof.signature })) throw new Error('Node live-money proof challenge signature is invalid.');
    return { manifest, publicKey: manifest.publicKey, platformFeeBps: feeBps };
  }

  async registerNode({ nodeId, operatorId, callbackUrl, email = null, country = null } = {}) {
    if (this.config.emergencyStop) throw new Error('Money edge emergency stop is active.');
    const id = text(nodeId, 'nodeId', 180), operator = text(operatorId, 'operatorId', 180);
    const live = this.provider?.mode === 'live';
    const callbackOrigin = cleanOrigin(callbackUrl, { live });
    const proof = await this.#probeNode({ nodeId: id, operatorId: operator, callbackOrigin });
    const existing = this.#node(id);
    let accountId = existing?.connected_account_id || null;
    if (!accountId) {
      const account = await this.provider.createStandardAccount({ nodeId: id, operatorId: operator, email, country, metadata: { civweave_callback_origin: callbackOrigin } });
      accountId = text(account?.id, 'Stripe connected account ID', 180);
    }
    const at = isoNow(this.now);
    this.db.prepare(`INSERT INTO money_edge_nodes(node_id,operator_id,connected_account_id,callback_origin,receipt_public_key,platform_fee_bps,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(node_id) DO UPDATE SET operator_id=excluded.operator_id,callback_origin=excluded.callback_origin,receipt_public_key=excluded.receipt_public_key,platform_fee_bps=excluded.platform_fee_bps,updated_at=excluded.updated_at`)
      .run(id, operator, accountId, callbackOrigin, proof.publicKey, proof.platformFeeBps, existing?.created_at || at, at);
    const refreshUrl = `${callbackOrigin}/app/node-ai-operator-v1.html?money=refresh`;
    const returnUrl = `${callbackOrigin}/app/node-ai-operator-v1.html?money=return`;
    const link = await this.provider.createAccountLink({ accountId, refreshUrl, returnUrl });
    return Object.freeze({ schema: NODE_MONEY_EDGE_SCHEMA, nodeId: id, operatorId: operator, connectedAccountId: accountId, onboardingUrl: link.url, onboardingExpiresAt: link.expires_at ? new Date(Number(link.expires_at) * 1000).toISOString() : null, platformFeeBps: proof.platformFeeBps, operatorPayouts: this.provider.operatorPayouts });
  }

  async operatorStatus(nodeId, rawBody, signatureHeader) {
    const node = this.verifyNodeRequest(nodeId, rawBody, signatureHeader);
    const account = await this.provider.retrieveAccount(node.connected_account_id);
    return Object.freeze({
      schema: NODE_MONEY_EDGE_SCHEMA,
      nodeId: node.node_id,
      operatorId: node.operator_id,
      connectedAccountId: node.connected_account_id,
      chargesEnabled: Boolean(account?.charges_enabled),
      payoutsEnabled: Boolean(account?.payouts_enabled),
      detailsSubmitted: Boolean(account?.details_submitted),
      requirementsCurrentlyDue: account?.requirements?.currently_due || [],
      requirementsPastDue: account?.requirements?.past_due || [],
      operatorPayouts: this.provider.operatorPayouts,
      moneyEdge: this.readiness()
    });
  }

  async createTopUp(input, rawBody, signatureHeader) {
    const nodeId = text(input?.nodeId, 'nodeId', 180);
    const node = this.verifyNodeRequest(nodeId, rawBody, signatureHeader);
    if (this.config.emergencyStop) throw new Error('Money edge emergency stop is active.');
    const readiness = this.readiness();
    if (this.provider.mode === 'live' && !readiness.liveReady) throw new Error(`Live node money is blocked: ${readiness.operationalBlockers.join(', ')}`);
    if (!readiness.integrationDoorReady) throw new Error(`Node money edge is incomplete: ${readiness.structuralBlockers.join(', ')}`);
    const userId = text(input.userId, 'userId', 180);
    const gross = cents(Number(input.grossCents), 'grossCents', { positive: true, max: this.maxTopUpCents });
    const currency = String(input.currency || 'USD').trim().toUpperCase();
    if (currency !== 'USD') throw new RangeError('Node money edge v1 currently accepts USD top-ups only.');
    const idempotencyKey = text(input.idempotencyKey, 'idempotencyKey', 180);
    const successUrl = safeReturnUrl(input.successUrl, node.callback_origin);
    const cancelUrl = safeReturnUrl(input.cancelUrl, node.callback_origin);
    const prior = this.db.prepare('SELECT * FROM money_edge_topups WHERE idempotency_key = ?').get(idempotencyKey);
    let topup = prior;
    if (prior) {
      if (prior.node_id !== nodeId || prior.user_id !== userId || Number(prior.gross_cents) !== gross) throw new Error('Top-up idempotency key was reused for a different request.');
      if (prior.checkout_url) return this.#publicTopUp(prior);
    } else {
      const topupId = `topup:${crypto.randomUUID()}`, at = isoNow(this.now), platformFeeCents = Math.floor(gross * Number(node.platform_fee_bps) / 10_000);
      this.db.prepare(`INSERT INTO money_edge_topups(topup_id,idempotency_key,node_id,user_id,gross_cents,currency,platform_fee_cents,user_credit_cents,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(topupId, idempotencyKey, nodeId, userId, gross, currency, platformFeeCents, gross, 'creating-checkout', at, at);
      topup = this.#topupById(topupId);
    }
    const session = await this.provider.createTopUpCheckout({
      accountId: node.connected_account_id,
      nodeId,
      userId,
      topupId: topup.topup_id,
      grossCents: gross,
      applicationFeeCents: Number(topup.platform_fee_cents),
      currency: currency.toLowerCase(),
      successUrl,
      cancelUrl,
      idempotencyKey: `civweave-${sha256(idempotencyKey).slice(0, 48)}`,
      displayName: `Civweave node credit · ${nodeId}`
    });
    const at = isoNow(this.now);
    this.db.prepare('UPDATE money_edge_topups SET stripe_session_id=?,checkout_url=?,status=?,updated_at=? WHERE topup_id=?')
      .run(text(session.id, 'Stripe session ID', 220), text(session.url, 'Stripe Checkout URL', 4000), 'checkout-created', at, topup.topup_id);
    return this.#publicTopUp(this.#topupById(topup.topup_id));
  }

  #publicTopUp(row) {
    if (!row) return null;
    return Object.freeze({ schema: 'civweave.node-money-topup.v1', topupId: row.topup_id, nodeId: row.node_id, userId: row.user_id, grossCents: Number(row.gross_cents), currency: row.currency, platformFeeCents: Number(row.platform_fee_cents), processorFeeCents: Number(row.processor_fee_cents || 0), userCreditCents: Number(row.user_credit_cents), status: row.status, checkoutUrl: row.checkout_url || null, createdAt: row.created_at, settledAt: row.settled_at || null, refundedCents: Number(row.refunded_cents || 0), disputedCents: Number(row.disputed_cents || 0) });
  }

  #signPayload(payload) {
    if (!this.privateKey) throw new Error('Money-edge event signing key is unavailable.');
    const raw = Buffer.from(json(payload));
    const timestamp = Math.floor(this.now() / 1000);
    return { raw, signature: signDetached({ privateKey: this.privateKey, keyId: this.keyId, domain: MONEY_EDGE_EVENT_DOMAIN, timestamp, raw }) };
  }

  #enqueueDelivery({ sourceEventId, topup, type, payload }) {
    const prior = this.db.prepare('SELECT * FROM money_edge_deliveries WHERE source_event_id = ?').get(sourceEventId);
    if (prior) return prior;
    const id = `delivery:${crypto.randomUUID()}`, at = isoNow(this.now);
    this.db.prepare('INSERT INTO money_edge_deliveries(delivery_id,source_event_id,topup_id,node_id,event_type,payload_json,status,attempts,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(id, sourceEventId, topup.topup_id, topup.node_id, type, json(payload), 'pending', 0, at, at);
    return this.db.prepare('SELECT * FROM money_edge_deliveries WHERE delivery_id = ?').get(id);
  }

  async #deliver(row) {
    const node = this.#node(row.node_id);
    if (!node) throw new Error('Delivery node is no longer registered.');
    const payload = parseJson(row.payload_json), { raw, signature } = this.#signPayload(payload);
    let response, error = null;
    try {
      response = await this.fetch(new URL('/api/ai/node/live/payments/webhook', node.callback_origin), { method: 'POST', headers: { 'content-type': 'application/json', 'x-civweave-money-edge-signature': signature }, body: raw });
      if (!response.ok) error = `node returned HTTP ${response.status}`;
    } catch (caught) { error = String(caught?.message || caught); }
    const at = isoNow(this.now), attempts = Number(row.attempts || 0) + 1;
    if (!error) this.db.prepare('UPDATE money_edge_deliveries SET status=?,attempts=?,last_error=NULL,updated_at=?,delivered_at=? WHERE delivery_id=?').run('delivered', attempts, at, at, row.delivery_id);
    else this.db.prepare('UPDATE money_edge_deliveries SET status=?,attempts=?,last_error=?,updated_at=? WHERE delivery_id=?').run('pending', attempts, error.slice(0, 1000), at, row.delivery_id);
    return !error;
  }

  async deliverPending({ limit = 50 } = {}) {
    const rows = this.db.prepare("SELECT * FROM money_edge_deliveries WHERE status='pending' ORDER BY created_at LIMIT ?").all(Math.max(1, Math.min(500, Number(limit) || 50)));
    let delivered = 0;
    for (const row of rows) if (await this.#deliver(row)) delivered += 1;
    return { attempted: rows.length, delivered, pending: rows.length - delivered };
  }

  async settleTopUpBySession(sessionId, sourceEventId) {
    const topup = this.#topupBySession(sessionId);
    if (!topup) throw Object.assign(new Error('Stripe Checkout Session is not registered with Civweave.'), { status: 404 });
    if (topup.status === 'settled') return this.#publicTopUp(topup);
    const node = this.#node(topup.node_id);
    const verified = await this.provider.verifyTopUpSession({ accountId: node.connected_account_id, sessionId: topup.stripe_session_id, nodeId: topup.node_id, userId: topup.user_id, topupId: topup.topup_id, grossCents: Number(topup.gross_cents), currency: topup.currency.toLowerCase() });
    const at = isoNow(this.now);
    this.db.prepare(`UPDATE money_edge_topups SET processor_fee_cents=?,stripe_payment_intent_id=?,stripe_charge_id=?,stripe_balance_transaction_id=?,status='settled',settled_at=?,updated_at=? WHERE topup_id=?`)
      .run(Number(verified.processorFeeCents || 0), verified.paymentIntentId, verified.chargeId, verified.balanceTransactionId, at, at, topup.topup_id);
    const current = this.#topupById(topup.topup_id);
    const payload = Object.freeze({
      schema: NODE_MONEY_EVENT_SCHEMA,
      id: sourceEventId,
      provider: this.provider.id,
      userId: current.user_id,
      type: 'topup.paid',
      grossCents: Number(current.gross_cents),
      processorFeeCents: Number(current.processor_fee_cents),
      userCreditCents: Number(current.user_credit_cents),
      externalAccountId: node.connected_account_id,
      metadata: { topupId: current.topup_id, stripeSessionId: current.stripe_session_id, stripeChargeId: current.stripe_charge_id },
      mintEffect: 0,
      supplyEffect: 0
    });
    const delivery = this.#enqueueDelivery({ sourceEventId, topup: current, type: payload.type, payload });
    await this.#deliver(delivery);
    return this.#publicTopUp(current);
  }

  async #handleRefund(event, charge) {
    const topup = this.#topupByCharge(charge.id);
    if (!topup) return { ignored: true, reason: 'unknown-charge' };
    const cumulative = cents(Number(charge.amount_refunded || 0), 'Stripe amount_refunded');
    const delta = cumulative - Number(topup.refunded_cents || 0);
    if (delta <= 0) return { ignored: true, reason: 'refund-already-applied' };
    const at = isoNow(this.now);
    this.db.prepare('UPDATE money_edge_topups SET refunded_cents=?,updated_at=? WHERE topup_id=?').run(cumulative, at, topup.topup_id);
    const current = this.#topupById(topup.topup_id), node = this.#node(current.node_id);
    const payload = Object.freeze({ schema: NODE_MONEY_EVENT_SCHEMA, id: event.id, provider: this.provider.id, userId: current.user_id, type: 'topup.refunded', amountCents: delta, userCreditCents: delta, externalAccountId: node.connected_account_id, metadata: { topupId: current.topup_id, stripeChargeId: charge.id, cumulativeRefundCents: cumulative }, mintEffect: 0, supplyEffect: 0 });
    const delivery = this.#enqueueDelivery({ sourceEventId: event.id, topup: current, type: payload.type, payload });
    await this.#deliver(delivery);
    return { applied: true, topup: this.#publicTopUp(current), deltaCents: delta };
  }

  async #handleDispute(event, dispute) {
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
    if (!chargeId) return { ignored: true, reason: 'missing-charge' };
    const topup = this.#topupByCharge(chargeId);
    if (!topup) return { ignored: true, reason: 'unknown-charge' };
    const cumulative = Math.max(Number(topup.disputed_cents || 0), cents(Number(dispute.amount || 0), 'Stripe dispute amount'));
    const delta = cumulative - Number(topup.disputed_cents || 0);
    if (delta <= 0) return { ignored: true, reason: 'dispute-already-applied' };
    const at = isoNow(this.now);
    this.db.prepare('UPDATE money_edge_topups SET disputed_cents=?,updated_at=? WHERE topup_id=?').run(cumulative, at, topup.topup_id);
    const current = this.#topupById(topup.topup_id), node = this.#node(current.node_id);
    const payload = Object.freeze({ schema: NODE_MONEY_EVENT_SCHEMA, id: event.id, provider: this.provider.id, userId: current.user_id, type: 'payment.chargeback', amountCents: delta, userCreditCents: delta, externalAccountId: node.connected_account_id, metadata: { topupId: current.topup_id, stripeChargeId: chargeId, disputeId: dispute.id }, mintEffect: 0, supplyEffect: 0 });
    const delivery = this.#enqueueDelivery({ sourceEventId: event.id, topup: current, type: payload.type, payload });
    await this.#deliver(delivery);
    return { applied: true, topup: this.#publicTopUp(current), deltaCents: delta };
  }

  async handleProviderEvent(event) {
    if (!event?.id || !event?.type) throw new TypeError('Provider event id and type are required.');
    const object = event?.data?.object || {};
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (object.payment_status && object.payment_status !== 'paid') return { ignored: true, reason: 'checkout-not-paid' };
      return { applied: true, topup: await this.settleTopUpBySession(text(object.id, 'Stripe session ID', 220), event.id) };
    }
    if (event.type === 'charge.refunded') return this.#handleRefund(event, object);
    if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.funds_withdrawn') return this.#handleDispute(event, object);
    return { ignored: true, reason: 'unsupported-provider-event' };
  }

  async refundTopUp({ nodeId, topupId, amountCents }, rawBody, signatureHeader) {
    const node = this.verifyNodeRequest(nodeId, rawBody, signatureHeader);
    const topup = this.#topupById(topupId);
    if (!topup || topup.node_id !== node.node_id) throw Object.assign(new Error('Top-up is not owned by this node.'), { status: 404 });
    if (!topup.stripe_charge_id || topup.status !== 'settled') throw new RangeError('Only settled top-ups can be refunded.');
    const remaining = Number(topup.gross_cents) - Number(topup.refunded_cents || 0);
    const amount = cents(Number(amountCents), 'amountCents', { positive: true, max: remaining });
    const refund = await this.provider.refundTopUp({ accountId: node.connected_account_id, chargeId: topup.stripe_charge_id, amountCents: amount, idempotencyKey: `civweave-refund-${sha256(`${topupId}\0${Number(topup.refunded_cents || 0)}\0${amount}`).slice(0, 48)}` });
    return Object.freeze({ schema: NODE_MONEY_EDGE_SCHEMA, topupId, refundId: refund.id, amountCents: Number(refund.amount || amount), status: refund.status || 'submitted', walletAdjustment: 'applied-on-verified-provider-refund-event' });
  }
}

export function signNodeMoneyEdgeRequest(rawBody, { privateKey, keyId = 'node-receipt-key', timestamp = Math.floor(Date.now() / 1000) } = {}) {
  return signDetached({ privateKey: text(privateKey, 'privateKey', 20000), keyId, domain: NODE_MONEY_REQUEST_DOMAIN, timestamp, raw: rawBody });
}

export function verifyMoneyEdgeEvent(rawBody, signatureHeader, { publicKey, toleranceSeconds = 300, now = () => Date.now() } = {}) {
  const { timestamp, signature } = parseSignedHeader(signatureHeader);
  if (Math.abs(Math.floor(now() / 1000) - timestamp) > toleranceSeconds) throw new Error('Money-edge event signature is outside the replay window.');
  if (!verifyDetached({ publicKey: text(publicKey, 'publicKey', 20000), domain: MONEY_EDGE_EVENT_DOMAIN, timestamp, raw: rawBody, signature })) throw new Error('Money-edge event signature is invalid.');
  return true;
}
