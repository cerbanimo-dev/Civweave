const OUTCOMES = new Set(['verified','verified-with-ai','unknown-origin','broken-chain','anomalous','needs-human-review']);
const REVIEWERS = new Set(['model','human','hybrid']);
const clean = (value, max = 1600) => String(value ?? '').trim().slice(0, max);
const list = value => Array.isArray(value) ? value : [];

export function buildProvenanceReviewRequest(sample = {}, analysis = {}) {
  const receipt = sample.receipt || {};
  if (sample.schema !== 'civweave.creator-audit-sample.v1') throw new TypeError('A Creator audit sample is required.');
  return Object.freeze({
    schema: 'civweave.creator-provenance-review-request.v1',
    reviewId: `review:${sample.sampleId}`,
    sampleId: clean(sample.sampleId, 500),
    guildId: clean(sample.guildId, 180),
    dayKey: clean(sample.dayKey, 40),
    requestedLane: REVIEWERS.has(sample.reviewLane) ? sample.reviewLane : 'hybrid',
    priorityReason: clean(sample.priorityReason, 80),
    receipt: Object.freeze({
      sessionId: clean(receipt.sessionId, 240), mediaType: clean(receipt.mediaType, 60), artifactType: clean(receipt.artifactType, 120),
      eventCount: Number(receipt.eventCount || 0), headHash: clean(receipt.headHash, 128), origin: clean(receipt.origin, 40),
      aiUsed: Boolean(receipt.aiUsed), finalizedAt: clean(receipt.finalizedAt, 80), receiptHash: clean(receipt.receiptHash, 128),
    }),
    provenanceAnalysis: Object.freeze({
      outcome: clean(analysis.outcome, 60), anomalyCount: Number(analysis.anomalyCount || 0),
      anomalies: list(analysis.anomalies).slice(0, 64).map(row => ({ code: clean(row?.code, 120), severity: clean(row?.severity, 40), seq: Number(row?.seq || 0), detail: clean(row?.detail, 800) })),
      detectorInferenceUsed: false,
    }),
    rubric: Object.freeze([
      'Confirm whether the supplied creation chain and receipt are cryptographically/structurally consistent.',
      'Confirm that recorded actor classes agree with the claimed origin summary.',
      'Confirm that every Civweave AI event has provider, model, and request attribution.',
      'Treat external imports or pastes as external/unknown origin unless trusted provenance establishes otherwise.',
      'Return unknown or needs-human-review when the evidence cannot establish a stronger claim. Never infer AI authorship from style.',
    ]),
    privacy: Object.freeze({ minimumNecessaryEvidence: true, retainRawPacket: false, styleDetectionForbidden: true }),
  });
}

export function normalizeProvenanceFinding(input = {}, context = {}) {
  const outcome = OUTCOMES.has(clean(input.outcome, 60)) ? clean(input.outcome, 60) : 'needs-human-review';
  const reviewerKind = REVIEWERS.has(clean(context.reviewerKind || input.reviewerKind, 40)) ? clean(context.reviewerKind || input.reviewerKind, 40) : 'human';
  const findings = list(input.findings || input.evidence).slice(0, 64).map(item => ({
    code: clean(item?.code, 120) || 'review-note',
    status: ['supported','unsupported','uncertain'].includes(clean(item?.status, 40)) ? clean(item.status, 40) : 'uncertain',
    detail: clean(item?.detail || item?.note, 1200),
    eventSeq: Math.max(0, Math.round(Number(item?.eventSeq || item?.seq) || 0)),
  }));
  return Object.freeze({
    schema: 'civweave.creator-provenance-review-finding.v1',
    reviewId: clean(context.reviewId || input.reviewId, 600),
    sampleId: clean(context.sampleId || input.sampleId, 600),
    reviewerKind,
    reviewerId: clean(context.reviewerId || input.reviewerId, 240),
    outcome,
    findings: Object.freeze(findings),
    rationale: clean(input.rationale || input.reason, 2400),
    confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)),
    detectorInferenceUsed: false,
    rawPacketRetained: false,
    reviewedAt: clean(context.reviewedAt || input.reviewedAt, 80) || new Date().toISOString(),
  });
}

export function routeProvenanceReview(sample = {}, analysis = {}, policy = {}) {
  const severe = list(analysis.anomalies).some(row => ['critical','high'].includes(clean(row?.severity, 40)));
  if (analysis.outcome === 'broken-chain' || severe || sample.priorityReason === 'dispute') return 'human';
  if (sample.reviewLane === 'model' && policy.allowModelReview !== false) return 'model';
  if (sample.reviewLane === 'human') return 'human';
  return policy.allowModelReview === false ? 'human' : 'hybrid';
}

export function additiveReviewRecord(receipt = {}, finding = {}) {
  return Object.freeze({
    schema: 'civweave.creator-provenance-review-record.v1',
    sessionId: clean(receipt.sessionId, 240),
    headHash: clean(receipt.headHash, 128),
    receiptHash: clean(receipt.receiptHash, 128),
    creationOrigin: clean(receipt.origin, 40) || 'unknown',
    reviewOutcome: OUTCOMES.has(clean(finding.outcome, 60)) ? clean(finding.outcome, 60) : 'needs-human-review',
    finding,
    originImmutable: true,
    recordedAt: new Date().toISOString(),
  });
}

export { OUTCOMES };
