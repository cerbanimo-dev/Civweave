import { createHash } from 'node:crypto';

export const CONTRIBUTION_GATEWAY_PROTOCOL = 'civweave.contribution-gateway.v1';
export const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const GATEWAY_EVENT_TYPES = Object.freeze({
  INTENT: 'GatewayIntentOpenedV1',
  CLAIM: 'GatewayPaymentClaimedV1',
  COMMITTEE_OPEN: 'GatewayCommitteeOpenedV1',
  OBSERVATION: 'GatewayPaymentObservedV1',
  PAYMENT_CERTIFIED: 'GatewayPaymentCertifiedV1',
  CANCELLED: 'GatewayCancelledV1',
  SETTLED: 'GatewaySettledV1',
  DISPUTED: 'GatewayDisputedV1',
});

export const GATEWAY_PRESETS = Object.freeze({
  baseUsdc: Object.freeze({
    id: 'base-usdc',
    chainId: 8453,
    chainName: 'Base Mainnet',
    tokenSymbol: 'USDC',
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    tokenDecimals: 6,
    rpcUrl: 'https://mainnet.base.org',
    finalityTag: 'finalized',
  }),
  baseSepoliaUsdc: Object.freeze({
    id: 'base-sepolia-usdc',
    chainId: 84532,
    chainName: 'Base Sepolia',
    tokenSymbol: 'USDC',
    tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    tokenDecimals: 6,
    rpcUrl: 'https://sepolia.base.org',
    finalityTag: 'finalized',
  }),
});

function clone(value) { return value == null ? value : structuredClone(value); }
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, normalized(value[key])]));
  return value;
}
export function canonicalJson(value) { return JSON.stringify(normalized(value)); }
export function hashObject(value) { return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`; }

export function normalizeEvmAddress(value) {
  const address = String(value || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) throw new TypeError('invalid EVM address');
  return address;
}
export function normalizeTxHash(value) {
  const hash = String(value || '').toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(hash)) throw new TypeError('invalid transaction hash');
  return hash;
}
export function addressTopic(address) { return `0x${'0'.repeat(24)}${normalizeEvmAddress(address).slice(2)}`; }
export function topicAddress(topic) {
  const value = String(topic || '').toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(value)) throw new TypeError('invalid indexed address topic');
  return normalizeEvmAddress(`0x${value.slice(-40)}`);
}
export function parseHexQuantity(value) {
  const text = String(value ?? '');
  if (!/^0x[0-9a-f]+$/i.test(text)) throw new TypeError('invalid hex quantity');
  return BigInt(text);
}
function positiveAmount(value, label = 'amount') {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new TypeError(`${label} must be positive`);
  return amount;
}
function positiveAtomic(value) {
  const amount = BigInt(String(value));
  if (amount <= 0n) throw new TypeError('external atomic amount must be positive');
  return amount;
}
function nonNegativeInteger(value, label) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new TypeError(`${label} must be a non-negative integer`);
  return n;
}

export function externalProofKey({ chainId, txHash, logIndex }) {
  return `evm:${Number(chainId)}:${normalizeTxHash(txHash)}:${nonNegativeInteger(logIndex, 'logIndex')}`;
}

export function normalizeGatewayIntent(input = {}) {
  const asset = String(input.asset || '').toUpperCase();
  if (!['BUTTON', 'ACORN'].includes(asset)) throw new TypeError('gateway can transfer only BUTTON or ACORN');
  const route = input.external || {};
  const intent = {
    protocol: CONTRIBUTION_GATEWAY_PROTOCOL,
    intentId: String(input.intentId || '').trim(),
    sellerId: String(input.sellerId || '').trim(),
    buyerId: String(input.buyerId || '').trim(),
    asset,
    amount: positiveAmount(input.amount),
    transferId: String(input.transferId || '').trim(),
    external: {
      kind: 'evm-erc20',
      presetId: String(route.presetId || ''),
      chainId: nonNegativeInteger(route.chainId, 'chainId'),
      tokenSymbol: String(route.tokenSymbol || 'USDC').toUpperCase(),
      tokenAddress: normalizeEvmAddress(route.tokenAddress),
      recipient: normalizeEvmAddress(route.recipient),
      expectedSender: route.expectedSender ? normalizeEvmAddress(route.expectedSender) : null,
      amountAtomic: positiveAtomic(route.amountAtomic).toString(),
      amountPolicy: route.amountPolicy === 'exact' ? 'exact' : 'at-least',
      finalityTag: String(route.finalityTag || 'finalized'),
    },
    expiresAt: String(input.expiresAt || ''),
  };
  for (const [key, value] of Object.entries({ intentId: intent.intentId, sellerId: intent.sellerId, buyerId: intent.buyerId, transferId: intent.transferId })) {
    if (!value) throw new TypeError(`${key} is required`);
  }
  if (!Number.isFinite(Date.parse(intent.expiresAt))) throw new TypeError('expiresAt must be an ISO date');
  if (intent.sellerId === intent.buyerId) throw new Error('gateway seller and buyer must differ');
  return Object.freeze(intent);
}

export function validateErc20PaymentObservation(intentInput, observationInput) {
  const intent = normalizeGatewayIntent(intentInput);
  const observation = clone(observationInput || {});
  const errors = [];
  let txHash = '';
  let tokenAddress = '';
  let recipient = '';
  let sender = '';
  let amountAtomic = 0n;
  let logIndex = -1;
  try { txHash = normalizeTxHash(observation.txHash); } catch (error) { errors.push(error.message); }
  if (Number(observation.chainId) !== intent.external.chainId) errors.push('wrong chain');
  const receiptStatus = observation.receiptStatus === 1 || observation.receiptStatus === '0x1' || observation.receiptStatus === '1';
  if (!receiptStatus) errors.push('transaction receipt failed');
  if (observation.removed === true || observation.log?.removed === true) errors.push('transfer log was removed');
  try { tokenAddress = normalizeEvmAddress(observation.log?.address); } catch { errors.push('invalid token contract'); }
  if (tokenAddress && tokenAddress !== intent.external.tokenAddress) errors.push('wrong token contract');
  const topics = observation.log?.topics || [];
  if (String(topics[0] || '').toLowerCase() !== ERC20_TRANSFER_TOPIC) errors.push('not an ERC-20 Transfer log');
  try { sender = topicAddress(topics[1]); } catch { errors.push('invalid transfer sender'); }
  try { recipient = topicAddress(topics[2]); } catch { errors.push('invalid transfer recipient'); }
  if (recipient && recipient !== intent.external.recipient) errors.push('wrong payment recipient');
  if (intent.external.expectedSender && sender && sender !== intent.external.expectedSender) errors.push('wrong payment sender');
  try { amountAtomic = parseHexQuantity(observation.log?.data); } catch { errors.push('invalid transfer amount'); }
  const required = BigInt(intent.external.amountAtomic);
  if (intent.external.amountPolicy === 'exact' ? amountAtomic !== required : amountAtomic < required) errors.push('insufficient or mismatched payment amount');
  try { logIndex = Number(parseHexQuantity(observation.log?.logIndex)); if (!Number.isSafeInteger(logIndex) || logIndex < 0) throw new Error(); } catch { errors.push('invalid transfer log index'); }
  let blockNumber = -1n;
  let finalizedBlockNumber = -1n;
  try { blockNumber = parseHexQuantity(observation.blockNumber); } catch { errors.push('invalid payment block number'); }
  try { finalizedBlockNumber = parseHexQuantity(observation.finalizedBlockNumber); } catch { errors.push('missing finalized block observation'); }
  if (blockNumber >= 0n && finalizedBlockNumber >= 0n && finalizedBlockNumber < blockNumber) errors.push('payment block is not finalized');
  if (!/^0x[0-9a-f]{64}$/i.test(String(observation.blockHash || ''))) errors.push('invalid payment block hash');
  const ok = errors.length === 0;
  return Object.freeze({
    ok,
    errors,
    proofKey: ok ? externalProofKey({ chainId: intent.external.chainId, txHash, logIndex }) : null,
    normalized: ok ? Object.freeze({
      chainId: intent.external.chainId,
      txHash,
      blockNumber: Number(blockNumber),
      blockHash: String(observation.blockHash).toLowerCase(),
      finalizedBlockNumber: Number(finalizedBlockNumber),
      logIndex,
      tokenAddress,
      sender,
      recipient,
      amountAtomic: amountAtomic.toString(),
      rpcObserverId: String(observation.rpcObserverId || ''),
    }) : null,
  });
}

export class ContributionGatewayBook {
  constructor({ now = () => new Date().toISOString() } = {}) {
    this.now = now;
    this.intents = new Map();
    this.observations = new Map();
    this.certificates = new Map();
    this.proofOwners = new Map();
    this.events = [];
  }
  #event(type, payload) {
    const body = { protocol: CONTRIBUTION_GATEWAY_PROTOCOL, type, payload: clone(payload), createdAt: this.now(), sequence: this.events.length + 1 };
    const event = Object.freeze({ ...body, hash: hashObject(body) });
    this.events.push(event);
    return event;
  }
  openIntent(input) {
    const intent = normalizeGatewayIntent(input);
    if (this.intents.has(intent.intentId)) throw new Error('gateway intent already exists');
    const event = this.#event(GATEWAY_EVENT_TYPES.INTENT, { ...intent, supplyEffect: 0, mintEffect: 0 });
    this.intents.set(intent.intentId, { ...clone(intent), eventHash: event.hash, status: 'awaiting-payment' });
    return clone(this.intents.get(intent.intentId));
  }
  claimPayment(intentId, txHash) {
    const intent = this.#intent(intentId);
    if (!['awaiting-payment', 'payment-claimed'].includes(intent.status)) throw new Error(`gateway intent cannot accept payment claim in ${intent.status}`);
    const hash = normalizeTxHash(txHash);
    const event = this.#event(GATEWAY_EVENT_TYPES.CLAIM, { intentId: intent.intentId, intentHash: intent.eventHash, txHash: hash });
    intent.status = 'payment-claimed';
    intent.claimHash = event.hash;
    intent.txHash = hash;
    return clone(intent);
  }
  recordObservation(input) {
    const intent = this.#intent(input.intentId);
    if (intent.status === 'cancelled' || intent.status === 'expired' || intent.status === 'settled') throw new Error(`gateway intent cannot accept observations in ${intent.status}`);
    if (!intent.txHash) throw new Error('payment must be claimed before observation');
    const rootId = String(input.observerRootId || '').trim();
    const deviceId = String(input.observerDeviceId || '').trim();
    if (!rootId || !deviceId) throw new TypeError('observer root and device are required');
    const validation = validateErc20PaymentObservation(intent, input.observation);
    if (!validation.ok) throw new Error(`external payment rejected: ${validation.errors.join(', ')}`);
    if (validation.normalized.txHash !== intent.txHash) throw new Error('observation does not match claimed transaction');
    const byIntent = this.observations.get(intent.intentId) || new Map();
    if ([...byIntent.values()].some((row) => row.observerRootId === rootId)) throw new Error('observer root already submitted');
    if ([...byIntent.values()].some((row) => row.observerDeviceId === deviceId)) throw new Error('observer device already submitted');
    const event = this.#event(GATEWAY_EVENT_TYPES.OBSERVATION, {
      intentId: intent.intentId,
      intentHash: intent.eventHash,
      claimHash: intent.claimHash,
      observerRootId: rootId,
      observerDeviceId: deviceId,
      committeeHash: String(input.committeeHash || ''),
      decision: 'pass',
      proofKey: validation.proofKey,
      proof: validation.normalized,
    });
    byIntent.set(rootId, { ...event.payload, eventHash: event.hash });
    this.observations.set(intent.intentId, byIntent);
    return clone(byIntent.get(rootId));
  }
  certifyPayment({ intentId, committeeRoots = [], committeeHash, quorum }) {
    const intent = this.#intent(intentId);
    if (!intent.claimHash) throw new Error('payment claim is unavailable');
    if (intent.status === 'cancelled' || intent.status === 'expired') throw new Error('cancelled or expired gateway intent cannot certify');
    const roots = new Set((committeeRoots || []).map(String));
    const need = Math.max(2, nonNegativeInteger(quorum, 'quorum'));
    const rows = [...(this.observations.get(intent.intentId)?.values() || [])].filter((row) => roots.has(row.observerRootId) && row.committeeHash === String(committeeHash || ''));
    const grouped = new Map();
    for (const row of rows) {
      const list = grouped.get(row.proofKey) || [];
      list.push(row);
      grouped.set(row.proofKey, list);
    }
    const candidates = [...grouped.entries()].filter(([, list]) => new Set(list.map((row) => row.observerRootId)).size >= need);
    if (candidates.length !== 1) throw new Error('gateway payment lacks one selected-root proof quorum');
    const [proofKey, witnesses] = candidates[0];
    const priorOwner = this.proofOwners.get(proofKey);
    if (priorOwner && priorOwner !== intent.intentId) throw new Error('external payment proof is already consumed by another gateway intent');
    const event = this.#event(GATEWAY_EVENT_TYPES.PAYMENT_CERTIFIED, {
      intentId: intent.intentId,
      intentHash: intent.eventHash,
      claimHash: intent.claimHash,
      proofKey,
      committeeHash: String(committeeHash || ''),
      quorum: need,
      witnessHashes: witnesses.slice(0, need).map((row) => row.eventHash),
      supplyEffect: 0,
      mintEffect: 0,
    });
    this.proofOwners.set(proofKey, intent.intentId);
    this.certificates.set(intent.intentId, { ...event.payload, eventHash: event.hash });
    intent.status = 'payment-certified';
    intent.paymentCertificateHash = event.hash;
    return clone(this.certificates.get(intent.intentId));
  }
  settle({ intentId, transferCertificateHash }) {
    const intent = this.#intent(intentId);
    const cert = this.certificates.get(intent.intentId);
    if (!cert || intent.status !== 'payment-certified') {
      if (intent.status === 'settled') return clone(intent);
      throw new Error('external payment must be certified before settlement');
    }
    const transferHash = String(transferCertificateHash || '').trim();
    if (!transferHash) throw new TypeError('committee transfer certificate is required');
    const event = this.#event(GATEWAY_EVENT_TYPES.SETTLED, {
      intentId: intent.intentId,
      paymentCertificateHash: cert.eventHash,
      transferCertificateHash: transferHash,
      proofKey: cert.proofKey,
      internalAsset: intent.asset,
      internalAmount: intent.amount,
      supplyEffect: 0,
      mintEffect: 0,
    });
    intent.status = 'settled';
    intent.settlementHash = event.hash;
    intent.transferCertificateHash = transferHash;
    return clone(intent);
  }
  cancel(intentId) {
    const intent = this.#intent(intentId);
    if (['payment-certified', 'settled'].includes(intent.status)) throw new Error('certified or settled gateway intent cannot be cancelled');
    if (intent.status === 'cancelled') return clone(intent);
    const event = this.#event(GATEWAY_EVENT_TYPES.CANCELLED, { intentId: intent.intentId, intentHash: intent.eventHash, supplyEffect: 0, mintEffect: 0 });
    intent.status = 'cancelled';
    intent.cancelHash = event.hash;
    return clone(intent);
  }
  expire(intentId, at = Date.now()) {
    const intent = this.#intent(intentId);
    if (['payment-certified', 'settled'].includes(intent.status)) throw new Error('certified or settled gateway intent cannot expire');
    if (at < Date.parse(intent.expiresAt)) throw new Error('gateway intent is not expired');
    if (intent.status === 'expired') return clone(intent);
    const event = this.#event('GatewayExpiredV1', { intentId: intent.intentId, intentHash: intent.eventHash, supplyEffect: 0, mintEffect: 0 });
    intent.status = 'expired';
    intent.expireHash = event.hash;
    return clone(intent);
  }
  dispute(intentId, reason = 'external-proof-conflict') {
    const intent = this.#intent(intentId);
    if (!['payment-certified', 'settled'].includes(intent.status)) throw new Error('only certified or settled gateway payments can be disputed');
    const event = this.#event(GATEWAY_EVENT_TYPES.DISPUTED, { intentId: intent.intentId, reason: String(reason), priorStatus: intent.status, supplyEffect: 0, mintEffect: 0 });
    intent.status = intent.status === 'settled' ? 'disputed-settled' : 'disputed-certified';
    intent.disputeHash = event.hash;
    return clone(intent);
  }
  status(intentId) { return clone(this.#intent(intentId)); }
  #intent(intentId) {
    const intent = this.intents.get(String(intentId));
    if (!intent) throw new Error(`unknown gateway intent: ${intentId}`);
    return intent;
  }
}
