const enc = new TextEncoder();
const DEFAULT_POLICY = Object.freeze({
  schema: 'civweave.creator-audit-policy.v1',
  baseSampleRate: 0.01,
  maxDailySamples: 50,
  prioritySampleRate: 1,
  disputePriority: true,
  anomalyPriority: true,
  modelReviewShare: 0.5,
  humanReviewShare: 0.5,
  detailedRetentionDays: 7,
  receiptRetentionDays: 3650,
});

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

export function normalizeAuditPolicy(input = {}) {
  const baseSampleRate = clamp(input.baseSampleRate, 0, 0.25, DEFAULT_POLICY.baseSampleRate);
  const prioritySampleRate = clamp(input.prioritySampleRate, baseSampleRate, 1, DEFAULT_POLICY.prioritySampleRate);
  let modelReviewShare = clamp(input.modelReviewShare, 0, 1, DEFAULT_POLICY.modelReviewShare);
  let humanReviewShare = clamp(input.humanReviewShare, 0, 1, DEFAULT_POLICY.humanReviewShare);
  const total = modelReviewShare + humanReviewShare;
  if (total > 1) { modelReviewShare /= total; humanReviewShare /= total; }
  return Object.freeze({
    schema: DEFAULT_POLICY.schema,
    baseSampleRate,
    maxDailySamples: Math.max(1, Math.min(500, Math.round(Number(input.maxDailySamples) || DEFAULT_POLICY.maxDailySamples))),
    prioritySampleRate,
    disputePriority: input.disputePriority !== false,
    anomalyPriority: input.anomalyPriority !== false,
    modelReviewShare,
    humanReviewShare,
    detailedRetentionDays: Math.max(0, Math.min(90, Math.round(Number(input.detailedRetentionDays) || DEFAULT_POLICY.detailedRetentionDays))),
    receiptRetentionDays: Math.max(30, Math.min(36500, Math.round(Number(input.receiptRetentionDays) || DEFAULT_POLICY.receiptRetentionDays))),
  });
}

export function normalizeReceipt(input = {}) {
  const receipt = input?.payload?.schema === 'civweave.creation-receipt-summary.v1' ? input.payload : input?.receipt || input;
  return Object.freeze({
    schema: 'civweave.creation-receipt-summary.v1',
    sessionId: clean(receipt.sessionId, 240),
    mediaType: clean(receipt.mediaType, 60),
    artifactType: clean(receipt.artifactType, 120),
    eventCount: Math.max(0, Math.round(Number(receipt.eventCount) || 0)),
    headHash: clean(receipt.headHash, 128),
    origin: clean(receipt.origin, 40) || 'unknown',
    aiUsed: Boolean(receipt.aiUsed),
    finalizedAt: clean(receipt.finalizedAt, 80),
    receiptHash: clean(receipt.receiptHash, 128),
  });
}

async function hashBytes(value) {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto is required for provenance sampling.');
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}

export async function samplingScore(receiptInput, { dayKey, secretSalt } = {}) {
  const receipt = normalizeReceipt(receiptInput), day = clean(dayKey, 40), salt = clean(secretSalt, 4000);
  if (!day) throw new TypeError('dayKey is required for provenance sampling.');
  if (salt.length < 16) throw new TypeError('A secret sampling salt of at least 16 characters is required.');
  if (!receipt.sessionId || !receipt.headHash) throw new TypeError('A committed creation receipt is required for sampling.');
  const bytes = await hashBytes(`civweave.creator-audit-sample.v1\n${day}\n${salt}\n${receipt.sessionId}\n${receipt.headHash}\n${receipt.receiptHash}`);
  let value = 0n;
  for (const byte of bytes.subarray(0, 8)) value = (value << 8n) | BigInt(byte);
  return Number(value) / Number(2n ** 64n);
}

function reviewLane(score, policy) {
  const modelEnd = policy.modelReviewShare;
  const humanEnd = modelEnd + policy.humanReviewShare;
  const lane = (score * 104729) % 1;
  if (lane < modelEnd) return 'model';
  if (lane < humanEnd) return 'human';
  return 'hybrid';
}

export async function sampleReceipts(receipts = [], options = {}) {
  const policy = normalizeAuditPolicy(options.policy), dayKey = clean(options.dayKey, 40), secretSalt = clean(options.secretSalt, 4000), guildId = clean(options.guildId || 'local-guild', 180);
  const priorityIds = new Set((options.prioritySessionIds || []).map(value => clean(value, 240)).filter(Boolean));
  const anomalyIds = new Set((options.anomalySessionIds || []).map(value => clean(value, 240)).filter(Boolean));
  const disputeIds = new Set((options.disputeSessionIds || []).map(value => clean(value, 240)).filter(Boolean));
  const unique = new Map();
  for (const source of Array.isArray(receipts) ? receipts : []) {
    const receipt = normalizeReceipt(source);
    if (!receipt.sessionId || !receipt.headHash) continue;
    const key = `${receipt.sessionId}|${receipt.headHash}`;
    if (!unique.has(key)) unique.set(key, receipt);
  }
  const candidates = [];
  for (const receipt of unique.values()) {
    const score = await samplingScore(receipt, { dayKey, secretSalt });
    const disputed = policy.disputePriority && disputeIds.has(receipt.sessionId);
    const anomalous = policy.anomalyPriority && anomalyIds.has(receipt.sessionId);
    const priority = priorityIds.has(receipt.sessionId) || disputed || anomalous;
    const threshold = priority ? policy.prioritySampleRate : policy.baseSampleRate;
    if (score >= threshold) continue;
    candidates.push(Object.freeze({
      schema: 'civweave.creator-audit-sample.v1',
      sampleId: `audit:${guildId}:${dayKey}:${receipt.sessionId}:${receipt.headHash.slice(0, 16)}`,
      guildId,
      dayKey,
      receipt,
      score,
      threshold,
      priority,
      priorityReason: disputed ? 'dispute' : anomalous ? 'anomaly' : priority ? 'policy' : 'routine',
      reviewLane: reviewLane(score, policy),
    }));
  }
  candidates.sort((a, b) => Number(b.priority) - Number(a.priority) || a.score - b.score || a.sampleId.localeCompare(b.sampleId));
  const samples = candidates.slice(0, policy.maxDailySamples);
  return Object.freeze({
    schema: 'civweave.creator-audit-sample-batch.v1',
    batchId: `audit-batch:${guildId}:${dayKey}`,
    guildId,
    dayKey,
    policy,
    eligibleCount: unique.size,
    selectedCount: samples.length,
    samples,
  });
}

export { DEFAULT_POLICY };
