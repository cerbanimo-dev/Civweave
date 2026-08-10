import { createHash } from 'node:crypto';

export const MONEY_EDGE_PROTOCOL = 'civweave.money-edge.v1';
export const MONEY_EDGE_ASSETS = Object.freeze(['BUTTON', 'ACORN']);
export const MONEY_EDGE_CURRENCIES = Object.freeze(['USD', 'USDC']);
export const DEFAULT_MONEY_EDGE_POLICY = Object.freeze({
  liveMoneyEnabled: false,
  emergencyStop: false,
  sandboxAllowed: true,
  requireComplianceApproval: true,
  requireJurisdictionApproval: true,
  requireKycAmlReadiness: true,
  requireTaxReportingReadiness: true,
  maxInternalAmount: Object.freeze({ BUTTON: 500, ACORN: 100 }),
  maxExternalAmount: 1000,
});

const clone = value => value == null ? value : structuredClone(value);
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, normalized(value[key])]));
  }
  return value;
}
export function canonicalJson(value) { return JSON.stringify(normalized(value)); }
export function hashObject(value) { return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`; }
function clean(value, label, max = 220) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text.slice(0, max);
}
function positive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new TypeError(`${label} must be positive`);
  return number;
}
function bool(value) { return value === true || String(value || '').toLowerCase() === 'true'; }
function uniqueStrings(values = []) { return [...new Set(values.map(value => String(value).trim()).filter(Boolean))].sort(); }

export function loadMoneyEdgeConfig(env = process.env) {
  const jurisdictions = uniqueStrings(String(env.CIVWEAVE_MONEY_JURISDICTIONS || '').split(','));
  return Object.freeze({
    liveMoneyEnabled: bool(env.CIVWEAVE_MONEY_LIVE_ENABLED),
    emergencyStop: bool(env.CIVWEAVE_MONEY_EMERGENCY_STOP),
    providerId: String(env.CIVWEAVE_MONEY_PROVIDER || '').trim(),
    providerMode: String(env.CIVWEAVE_MONEY_PROVIDER_MODE || 'sandbox').trim().toLowerCase(),
    complianceApproved: bool(env.CIVWEAVE_MONEY_COMPLIANCE_APPROVED),
    jurisdictionApproved: bool(env.CIVWEAVE_MONEY_JURISDICTION_APPROVED),
    kycAmlReady: bool(env.CIVWEAVE_MONEY_KYC_AML_READY),
    taxReportingReady: bool(env.CIVWEAVE_MONEY_TAX_REPORTING_READY),
    termsApproved: bool(env.CIVWEAVE_MONEY_TERMS_APPROVED),
    jurisdictions,
  });
}

export function assertZeroMintAuthority(value, label = 'money edge record') {
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    for (const [key, child] of Object.entries(current)) {
      if ((key === 'mintEffect' || key === 'supplyEffect') && Number(child || 0) !== 0) {
        throw new Error(`${label} attempted non-zero ${key}`);
      }
      if (key === 'mintAuthority' && child) throw new Error(`${label} attempted mint authority`);
      if (child && typeof child === 'object') stack.push(child);
    }
  }
  return true;
}

function providerCapabilities(provider) {
  return {
    configured: Boolean(provider?.id),
    sandbox: provider?.mode === 'sandbox',
    live: provider?.mode === 'live',
    credentialsPresent: Boolean(provider?.credentialsPresent),
    createPayment: typeof provider?.createPayment === 'function',
    verifyReceipt: typeof provider?.verifyReceipt === 'function',
    fetchReceipt: typeof provider?.fetchReceipt === 'function',
    webhookVerificationReady: Boolean(provider?.webhookVerificationReady),
    refundsReady: typeof provider?.refund === 'function' || Boolean(provider?.refundsReady),
    reconciliationReady: typeof provider?.reconcile === 'function' || typeof provider?.fetchReceipt === 'function' || Boolean(provider?.reconciliationReady),
  };
}
function ledgerCapabilities(ledger) {
  return {
    reserve: typeof ledger?.reserveExistingAsset === 'function',
    release: typeof ledger?.releaseReservation === 'function',
    finalize: typeof ledger?.finalizeReservedTransfer === 'function',
    freeze: typeof ledger?.flagDispute === 'function' || typeof ledger?.freezeReservation === 'function',
  };
}

export function moneyIntegrationReadiness({ policy = {}, config = {}, provider = null, ledger = null } = {}) {
  const merged = { ...DEFAULT_MONEY_EDGE_POLICY, ...clone(policy), ...clone(config) };
  const pc = providerCapabilities(provider);
  const lc = ledgerCapabilities(ledger);
  const structuralBlockers = [];
  if (!lc.reserve) structuralBlockers.push('ledger-reservation-adapter-missing');
  if (!lc.release) structuralBlockers.push('ledger-release-adapter-missing');
  if (!lc.finalize) structuralBlockers.push('ledger-finality-adapter-missing');
  if (!pc.configured) structuralBlockers.push('provider-adapter-missing');
  if (!pc.createPayment) structuralBlockers.push('provider-create-payment-missing');
  if (!pc.verifyReceipt) structuralBlockers.push('provider-receipt-verifier-missing');
  if (!pc.reconciliationReady) structuralBlockers.push('provider-reconciliation-missing');
  if (!pc.refundsReady) structuralBlockers.push('provider-refund-hook-missing');

  const operationalBlockers = [];
  if (merged.emergencyStop) operationalBlockers.push('emergency-stop-active');
  if (!merged.liveMoneyEnabled) operationalBlockers.push('live-money-disabled');
  if (!pc.live) operationalBlockers.push('provider-not-live');
  if (!pc.credentialsPresent) operationalBlockers.push('provider-credentials-missing');
  if (!pc.webhookVerificationReady) operationalBlockers.push('provider-webhook-verification-not-ready');
  if (merged.requireComplianceApproval && !merged.complianceApproved) operationalBlockers.push('compliance-approval-missing');
  if (merged.requireJurisdictionApproval && !merged.jurisdictionApproved) operationalBlockers.push('jurisdiction-approval-missing');
  if (merged.requireKycAmlReadiness && !merged.kycAmlReady) operationalBlockers.push('kyc-aml-readiness-missing');
  if (merged.requireTaxReportingReadiness && !merged.taxReportingReady) operationalBlockers.push('tax-reporting-readiness-missing');
  if (!merged.termsApproved) operationalBlockers.push('provider-terms-not-approved');

  const sandboxReady = structuralBlockers.length === 0 && !merged.emergencyStop && (pc.sandbox || pc.live) && merged.sandboxAllowed;
  const integrationDoorReady = structuralBlockers.length === 0;
  const liveReady = integrationDoorReady && operationalBlockers.length === 0;
  return Object.freeze({
    protocol: MONEY_EDGE_PROTOCOL,
    sandboxReady,
    integrationDoorReady,
    liveReady,
    structuralBlockers,
    operationalBlockers,
    provider: pc,
    ledger: lc,
  });
}

export function normalizeMoneyOrder(input = {}, policy = DEFAULT_MONEY_EDGE_POLICY) {
  const asset = clean(input.asset, 'asset', 16).toUpperCase();
  if (!MONEY_EDGE_ASSETS.includes(asset)) throw new TypeError('money edge supports only BUTTON or ACORN');
  const currency = clean(input.externalCurrency, 'externalCurrency', 16).toUpperCase();
  if (!MONEY_EDGE_CURRENCIES.includes(currency)) throw new TypeError('money edge supports only USD or USDC settlement');
  const internalAmount = positive(input.internalAmount, 'internalAmount');
  const externalAmount = positive(input.externalAmount, 'externalAmount');
  const maxInternal = Number(policy.maxInternalAmount?.[asset] ?? DEFAULT_MONEY_EDGE_POLICY.maxInternalAmount[asset]);
  if (internalAmount > maxInternal) throw new Error('internal amount exceeds money-edge policy');
  if (externalAmount > Number(policy.maxExternalAmount ?? DEFAULT_MONEY_EDGE_POLICY.maxExternalAmount)) throw new Error('external amount exceeds money-edge policy');
  const sellerId = clean(input.sellerId, 'sellerId');
  const buyerId = clean(input.buyerId, 'buyerId');
  if (sellerId === buyerId) throw new Error('buyer and seller must differ');
  return Object.freeze({
    protocol: MONEY_EDGE_PROTOCOL,
    orderId: clean(input.orderId, 'orderId'),
    idempotencyKey: clean(input.idempotencyKey, 'idempotencyKey'),
    sellerId,
    buyerId,
    asset,
    internalAmount,
    externalCurrency: currency,
    externalAmount,
    expiresAt: clean(input.expiresAt, 'expiresAt', 64),
    metadata: clone(input.metadata || {}),
    mintEffect: 0,
    supplyEffect: 0,
  });
}

export class ContributionMoneyEdge {
  constructor({ ledgerAdapter, providerAdapter, policy = {}, config = {}, now = () => new Date().toISOString(), auditSink = null } = {}) {
    this.ledger = ledgerAdapter;
    this.provider = providerAdapter;
    this.policy = { ...DEFAULT_MONEY_EDGE_POLICY, ...clone(policy), ...clone(config) };
    this.now = now;
    this.auditSink = typeof auditSink === 'function' ? auditSink : null;
    this.orders = new Map();
    this.idempotency = new Map();
    this.receiptOwners = new Map();
    this.events = [];
  }

  readiness() { return moneyIntegrationReadiness({ policy: this.policy, provider: this.provider, ledger: this.ledger }); }

  #audit(type, detail = {}) {
    const event = Object.freeze({ protocol: MONEY_EDGE_PROTOCOL, type, at: this.now(), detail: clone(detail), mintEffect: 0, supplyEffect: 0 });
    assertZeroMintAuthority(event, 'money edge audit event');
    this.events.push(event);
    this.auditSink?.(clone(event));
    return event;
  }

  async createOrder(input) {
    if (this.policy.emergencyStop) throw new Error('money edge emergency stop is active');
    const order = normalizeMoneyOrder(input, this.policy);
    if (!Number.isFinite(Date.parse(order.expiresAt))) throw new TypeError('expiresAt must be an ISO date');
    const fingerprint = hashObject({ ...order, idempotencyKey: undefined });
    const priorOrderId = this.idempotency.get(order.idempotencyKey);
    if (priorOrderId) {
      const prior = this.orders.get(priorOrderId);
      if (prior.fingerprint !== fingerprint) throw new Error('idempotency key was reused for a different money order');
      return clone(prior);
    }
    if (this.orders.has(order.orderId)) throw new Error('money order already exists');
    const reservation = await this.ledger.reserveExistingAsset({
      orderId: order.orderId,
      sellerId: order.sellerId,
      buyerId: order.buyerId,
      asset: order.asset,
      amount: order.internalAmount,
    });
    assertZeroMintAuthority(reservation, 'ledger reservation');
    const row = {
      ...clone(order),
      fingerprint,
      status: 'reserved',
      reservationId: clean(reservation?.reservationId || order.orderId, 'reservationId'),
      createdAt: this.now(),
      providerPaymentId: null,
      providerReceiptId: null,
      externalProofHash: null,
      internalTransferHash: null,
      disputeReason: null,
    };
    this.orders.set(order.orderId, row);
    this.idempotency.set(order.idempotencyKey, order.orderId);
    this.#audit('MoneyOrderReservedV1', { orderId: row.orderId, reservationId: row.reservationId, asset: row.asset, amount: row.internalAmount });
    return clone(row);
  }

  async prepareExternalPayment(orderId) {
    const order = this.#order(orderId);
    if (this.policy.emergencyStop) throw new Error('money edge emergency stop is active');
    if (!['reserved', 'payment-prepared'].includes(order.status)) throw new Error(`money order cannot prepare payment in ${order.status}`);
    if (order.providerPaymentId) return clone(order);
    const readiness = this.readiness();
    if (!readiness.sandboxReady) throw new Error(`money edge is not structurally ready: ${readiness.structuralBlockers.join(', ')}`);
    if (this.provider.mode === 'live' && !readiness.liveReady) throw new Error(`live money is blocked: ${readiness.operationalBlockers.join(', ')}`);
    const payment = await this.provider.createPayment({
      reference: order.orderId,
      sellerId: order.sellerId,
      buyerId: order.buyerId,
      currency: order.externalCurrency,
      amount: order.externalAmount,
      expiresAt: order.expiresAt,
      metadata: clone(order.metadata),
    });
    assertZeroMintAuthority(payment, 'provider payment intent');
    order.providerPaymentId = clean(payment?.paymentId, 'provider payment id');
    order.status = 'payment-prepared';
    this.#audit('ExternalPaymentPreparedV1', { orderId: order.orderId, providerId: this.provider.id, paymentId: order.providerPaymentId });
    return clone(order);
  }

  async ingestSettlement(orderId, receipt) {
    const order = this.#order(orderId);
    if (this.policy.emergencyStop) throw new Error('money edge emergency stop is active');
    if (!['payment-prepared', 'external-settled'].includes(order.status)) throw new Error(`money order cannot accept settlement in ${order.status}`);
    const verified = await this.provider.verifyReceipt(clone(receipt), {
      orderId: order.orderId,
      paymentId: order.providerPaymentId,
      currency: order.externalCurrency,
      amount: order.externalAmount,
      sellerId: order.sellerId,
      buyerId: order.buyerId,
    });
    if (!verified?.ok) throw new Error(`provider settlement rejected: ${(verified?.errors || ['unverified receipt']).join(', ')}`);
    assertZeroMintAuthority(verified, 'provider settlement proof');
    const receiptId = clean(verified.receiptId || receipt?.receiptId, 'receiptId');
    const owner = this.receiptOwners.get(receiptId);
    if (owner && owner !== order.orderId) throw new Error('provider receipt is already consumed by another money order');
    if (order.providerReceiptId && order.providerReceiptId !== receiptId) throw new Error('money order already has a different provider receipt');
    this.receiptOwners.set(receiptId, order.orderId);
    order.providerReceiptId = receiptId;
    order.externalProofHash = hashObject(verified.proof || verified);
    order.status = 'external-settled';
    order.externalSettledAt = this.now();
    this.#audit('ExternalSettlementCertifiedV1', { orderId: order.orderId, providerId: this.provider.id, receiptId, proofHash: order.externalProofHash });
    return clone(order);
  }

  async finalizeInternalTransfer(orderId, proof = {}) {
    const order = this.#order(orderId);
    if (this.policy.emergencyStop) throw new Error('money edge emergency stop is active');
    if (order.status === 'settled') return clone(order);
    if (order.status !== 'external-settled') throw new Error('external settlement must be certified before internal transfer finality');
    const result = await this.ledger.finalizeReservedTransfer({
      reservationId: order.reservationId,
      orderId: order.orderId,
      sellerId: order.sellerId,
      buyerId: order.buyerId,
      asset: order.asset,
      amount: order.internalAmount,
      externalProofHash: order.externalProofHash,
      proof: clone(proof),
    });
    assertZeroMintAuthority(result, 'ledger transfer finality');
    order.internalTransferHash = clean(result?.transferHash, 'transferHash');
    order.status = 'settled';
    order.settledAt = this.now();
    this.#audit('MoneyOrderSettledV1', { orderId: order.orderId, receiptId: order.providerReceiptId, transferHash: order.internalTransferHash });
    return clone(order);
  }

  async cancelOrder(orderId, reason = 'user-cancelled') {
    const order = this.#order(orderId);
    if (order.status === 'cancelled') return clone(order);
    if (['external-settled', 'settled', 'disputed'].includes(order.status)) throw new Error(`money order cannot cancel in ${order.status}`);
    const release = await this.ledger.releaseReservation({ reservationId: order.reservationId, orderId: order.orderId, reason: String(reason) });
    assertZeroMintAuthority(release, 'ledger reservation release');
    order.status = 'cancelled';
    order.cancelledAt = this.now();
    order.cancelReason = String(reason);
    this.#audit('MoneyOrderCancelledV1', { orderId: order.orderId, reason: order.cancelReason });
    return clone(order);
  }

  async reconcile(orderId) {
    const order = this.#order(orderId);
    if (!order.providerPaymentId) return Object.freeze({ orderId: order.orderId, status: order.status, providerStatus: 'not-created', consistent: true });
    const receipt = await this.provider.fetchReceipt({ paymentId: order.providerPaymentId, orderId: order.orderId });
    const providerStatus = String(receipt?.status || 'unknown').toLowerCase();
    const externalSaysSettled = ['settled', 'paid', 'succeeded', 'completed'].includes(providerStatus);
    const localSaysSettled = ['external-settled', 'settled', 'disputed'].includes(order.status);
    const consistent = externalSaysSettled === localSaysSettled;
    if (!consistent) {
      order.status = order.status === 'settled' ? 'disputed' : order.status;
      order.disputeReason = 'reconciliation-mismatch';
      this.#audit('MoneyOrderReconciliationMismatchV1', { orderId: order.orderId, providerStatus, localStatus: order.status });
    }
    return Object.freeze({ orderId: order.orderId, status: order.status, providerStatus, consistent });
  }

  async openDispute(orderId, reason = 'external-payment-dispute') {
    const order = this.#order(orderId);
    if (!['external-settled', 'settled', 'disputed'].includes(order.status)) throw new Error('only externally settled money orders can be disputed');
    order.status = 'disputed';
    order.disputeReason = String(reason);
    order.disputedAt = this.now();
    if (typeof this.ledger.flagDispute === 'function') {
      const result = await this.ledger.flagDispute({ orderId: order.orderId, reservationId: order.reservationId, transferHash: order.internalTransferHash, reason: order.disputeReason });
      assertZeroMintAuthority(result, 'ledger dispute flag');
    }
    this.#audit('MoneyOrderDisputedV1', { orderId: order.orderId, reason: order.disputeReason, transferHash: order.internalTransferHash });
    return clone(order);
  }

  snapshot(orderId) { return clone(this.#order(orderId)); }

  #order(orderId) {
    const order = this.orders.get(String(orderId));
    if (!order) throw new Error(`unknown money order: ${orderId}`);
    return order;
  }
}
