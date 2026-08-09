import crypto from 'node:crypto';

export const NODE_AI_PROTOCOL = 'civweave.node-ai.v1';
export const NODE_SERVICE_MANIFEST_SCHEMA = 'civweave.node-ai-service-manifest.v1';
export const NODE_TOPUP_QUOTE_SCHEMA = 'civweave.node-ai-topup-quote.v1';
export const NODE_USAGE_RECEIPT_SCHEMA = 'civweave.node-ai-usage-receipt.v1';
export const NODE_SETTLEMENT_RECEIPT_SCHEMA = 'civweave.node-ai-settlement-receipt.v1';
export const NODE_SIGNED_RECEIPT_SCHEMA = 'civweave.node-ai-signed-receipt.v1';

function text(value, label, max = 500) {
  const normalized = String(value ?? '').trim().slice(0, max);
  if (!normalized) throw new TypeError(`${label} is required.`);
  return normalized;
}

function cents(value, label, { positive = false } = {}) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new TypeError(`${label} must be ${positive ? 'a positive' : 'a non-negative'} integer number of cents.`);
  }
  return value;
}

function bps(value, label = 'platformFeeBps') {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new RangeError(`${label} must be an integer from 0 through 10000.`);
  }
  return value;
}

function iso(value, label) {
  const date = new Date(value ?? new Date().toISOString());
  if (Number.isNaN(date.getTime())) throw new TypeError(`${label} must be a valid date.`);
  return date.toISOString();
}

function uniqueStrings(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
  return [...new Set(values.map((value, index) => text(value, `${label}[${index}]`, 180)))];
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

export function canonicalJson(value) {
  const normalize = input => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.keys(input).sort().filter(key => input[key] !== undefined).map(key => [key, normalize(input[key])]));
    }
    if (typeof input === 'bigint') return input.toString();
    return input;
  };
  return JSON.stringify(normalize(value));
}

export function hashCanonical(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function createNodeServiceManifest({
  nodeId,
  operatorId,
  displayName,
  platformFeeBps,
  services,
  privacy = {},
  settlement = {},
  publicKey = null,
  generatedAt = new Date().toISOString(),
  metadata = {}
}) {
  const normalizedServices = (Array.isArray(services) ? services : []).map((service, index) => {
    if (!service || typeof service !== 'object' || Array.isArray(service)) throw new TypeError(`services[${index}] must be an object.`);
    const id = text(service.id, `services[${index}].id`, 120);
    const capabilities = uniqueStrings(service.capabilities || [], `services[${index}].capabilities`);
    const billing = service.billing && typeof service.billing === 'object' ? clone(service.billing) : {};
    if (billing.minimumChargeCents != null) cents(billing.minimumChargeCents, `services[${index}].billing.minimumChargeCents`);
    if (billing.maxRequestCents != null) cents(billing.maxRequestCents, `services[${index}].billing.maxRequestCents`, { positive: true });
    return Object.freeze({
      id,
      label: text(service.label || id, `services[${index}].label`, 180),
      capabilities,
      billing: {
        currency: String(billing.currency || 'USD').trim().toUpperCase().slice(0, 12),
        unit: String(billing.unit || 'node-credit-cent').trim().slice(0, 80),
        ...(billing.minimumChargeCents != null ? { minimumChargeCents: billing.minimumChargeCents } : {}),
        ...(billing.maxRequestCents != null ? { maxRequestCents: billing.maxRequestCents } : {})
      },
      backend: service.backend && typeof service.backend === 'object' ? clone(service.backend) : {},
      disclosures: service.disclosures && typeof service.disclosures === 'object' ? clone(service.disclosures) : {}
    });
  });
  if (!normalizedServices.length) throw new TypeError('services must contain at least one node AI service.');
  const ids = normalizedServices.map(service => service.id);
  if (new Set(ids).size !== ids.length) throw new RangeError('Node AI service IDs must be unique.');

  return Object.freeze({
    schema: NODE_SERVICE_MANIFEST_SCHEMA,
    protocol: NODE_AI_PROTOCOL,
    nodeId: text(nodeId, 'nodeId', 180),
    operatorId: text(operatorId, 'operatorId', 180),
    displayName: text(displayName, 'displayName', 180),
    platformFee: {
      beneficiary: 'Cerbanimo LLC',
      feeBasis: 'gross-topup',
      basisPoints: bps(platformFeeBps)
    },
    services: normalizedServices,
    privacy: clone(privacy),
    settlement: {
      cadence: String(settlement.cadence || 'periodic').trim().slice(0, 80),
      meshPublication: settlement.meshPublication !== false,
      ...clone(settlement)
    },
    ...(publicKey ? { publicKey: String(publicKey) } : {}),
    metadata: clone(metadata),
    generatedAt: iso(generatedAt, 'generatedAt')
  });
}

export function quoteNodeTopUp({
  nodeId,
  grossCents,
  processorFeeCents = 0,
  platformFeeBps,
  userCreditCents = grossCents,
  currency = 'USD'
}) {
  const gross = cents(grossCents, 'grossCents', { positive: true });
  const processor = cents(processorFeeCents, 'processorFeeCents');
  const feeRate = bps(platformFeeBps);
  const credit = cents(userCreditCents, 'userCreditCents', { positive: true });
  if (processor > gross) throw new RangeError('processorFeeCents cannot exceed grossCents.');
  const platformFeeCents = Math.floor(gross * feeRate / 10_000);
  if (processor + platformFeeCents > gross) throw new RangeError('Processor and platform fees cannot exceed the top-up gross amount.');
  return Object.freeze({
    schema: NODE_TOPUP_QUOTE_SCHEMA,
    protocol: NODE_AI_PROTOCOL,
    nodeId: text(nodeId, 'nodeId', 180),
    currency: String(currency || 'USD').trim().toUpperCase().slice(0, 12),
    grossCents: gross,
    processorFeeCents: processor,
    platformFeeBps: feeRate,
    platformFeeCents,
    userCreditCents: credit,
    nodeNetCashCents: gross - processor - platformFeeCents
  });
}

export function createUsageReceipt({
  nodeId,
  walletId,
  serviceId,
  requestId,
  retailCostCents,
  startedAt,
  completedAt = new Date().toISOString(),
  usage = {},
  backend = {},
  outcome = 'completed',
  metadata = {}
}) {
  const started = iso(startedAt || completedAt, 'startedAt');
  const completed = iso(completedAt, 'completedAt');
  if (Date.parse(completed) < Date.parse(started)) throw new RangeError('completedAt cannot precede startedAt.');
  return Object.freeze({
    schema: NODE_USAGE_RECEIPT_SCHEMA,
    protocol: NODE_AI_PROTOCOL,
    receiptId: `usage:${crypto.randomUUID()}`,
    nodeId: text(nodeId, 'nodeId', 180),
    walletId: text(walletId, 'walletId', 180),
    serviceId: text(serviceId, 'serviceId', 120),
    requestId: text(requestId, 'requestId', 180),
    retailCostCents: cents(retailCostCents, 'retailCostCents'),
    usage: clone(usage),
    backend: clone(backend),
    outcome: text(outcome, 'outcome', 80),
    metadata: clone(metadata),
    startedAt: started,
    completedAt: completed
  });
}

export function createSettlementReceipt({
  nodeId,
  operatorId,
  periodStart,
  periodEnd,
  grossTopupsCents,
  processorFeesCents = 0,
  platformFeeDueCents,
  userCreditsIssuedCents,
  topupCount,
  usageReceiptCount = 0,
  previousReceiptHash = null,
  metadata = {}
}) {
  const start = iso(periodStart, 'periodStart');
  const end = iso(periodEnd, 'periodEnd');
  if (Date.parse(end) <= Date.parse(start)) throw new RangeError('periodEnd must be after periodStart.');
  return Object.freeze({
    schema: NODE_SETTLEMENT_RECEIPT_SCHEMA,
    protocol: NODE_AI_PROTOCOL,
    receiptId: `settlement:${crypto.randomUUID()}`,
    nodeId: text(nodeId, 'nodeId', 180),
    operatorId: text(operatorId, 'operatorId', 180),
    periodStart: start,
    periodEnd: end,
    grossTopupsCents: cents(grossTopupsCents, 'grossTopupsCents'),
    processorFeesCents: cents(processorFeesCents, 'processorFeesCents'),
    platformFeeDueCents: cents(platformFeeDueCents, 'platformFeeDueCents'),
    userCreditsIssuedCents: cents(userCreditsIssuedCents, 'userCreditsIssuedCents'),
    topupCount: cents(topupCount, 'topupCount'),
    usageReceiptCount: cents(usageReceiptCount, 'usageReceiptCount'),
    previousReceiptHash: previousReceiptHash ? text(previousReceiptHash, 'previousReceiptHash', 128) : null,
    metadata: clone(metadata),
    createdAt: new Date().toISOString()
  });
}

export function signNodeReceipt(receipt, { privateKey, keyId = 'node-default' }) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw new TypeError('receipt must be an object.');
  if (!privateKey) throw new TypeError('privateKey is required.');
  const payload = clone(receipt);
  delete payload.signature;
  const signature = crypto.sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString('base64url');
  return Object.freeze({
    schema: NODE_SIGNED_RECEIPT_SCHEMA,
    payload,
    payloadHash: hashCanonical(payload),
    signature: {
      algorithm: 'Ed25519',
      keyId: text(keyId, 'keyId', 120),
      value: signature
    }
  });
}

export function verifyNodeReceipt(envelope, { publicKey }) {
  if (envelope?.schema !== NODE_SIGNED_RECEIPT_SCHEMA) throw new Error('Unsupported signed node receipt schema.');
  if (envelope?.signature?.algorithm !== 'Ed25519') throw new Error('Unsupported node receipt signature algorithm.');
  if (!publicKey) throw new TypeError('publicKey is required.');
  const expectedHash = hashCanonical(envelope.payload);
  if (expectedHash !== envelope.payloadHash) throw new Error('Node receipt payload hash does not match.');
  const valid = crypto.verify(
    null,
    Buffer.from(canonicalJson(envelope.payload)),
    publicKey,
    Buffer.from(String(envelope.signature.value || ''), 'base64url')
  );
  if (!valid) throw new Error('Invalid node receipt signature.');
  return Object.freeze(clone(envelope.payload));
}
