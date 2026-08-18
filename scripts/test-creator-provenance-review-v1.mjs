import assert from 'node:assert/strict';
import { additiveReviewRecord, buildProvenanceReviewRequest, normalizeProvenanceFinding, routeProvenanceReview } from '../lib/creator-provenance-review-v1.mjs';

const sample = {
  schema: 'civweave.creator-audit-sample.v1', sampleId: 'audit:guild:day:session:hash', guildId: 'guild:test', dayKey: '2026-08-18',
  priorityReason: 'routine', reviewLane: 'model',
  receipt: { sessionId: 'creation:1', mediaType: 'text', artifactType: 'document', eventCount: 3, headHash: 'head', origin: 'human-authored', aiUsed: false, receiptHash: 'receipt' },
};
const analysis = { outcome: 'verified', anomalyCount: 0, anomalies: [], detectorInferenceUsed: false };
const request = buildProvenanceReviewRequest(sample, analysis);
assert.equal(request.requestedLane, 'model');
assert.equal(request.privacy.styleDetectionForbidden, true);
assert.equal(request.privacy.retainRawPacket, false);
assert.ok(request.rubric.some(row => /Never infer AI authorship from style/.test(row)));
assert.equal(routeProvenanceReview(sample, analysis, { allowModelReview: true }), 'model');

const severe = { outcome: 'anomalous', anomalies: [{ code: 'ai-attribution-incomplete', severity: 'high' }] };
assert.equal(routeProvenanceReview(sample, severe, { allowModelReview: true }), 'human');
assert.equal(routeProvenanceReview({ ...sample, priorityReason: 'dispute' }, analysis, { allowModelReview: true }), 'human');

const finding = normalizeProvenanceFinding({ outcome: 'verified', confidence: 0.91, rationale: 'Chain and actor records are consistent.', findings: [{ code: 'chain', status: 'supported', detail: 'Verified.' }] }, { reviewId: request.reviewId, sampleId: sample.sampleId, reviewerKind: 'model', reviewerId: 'model:test' });
assert.equal(finding.detectorInferenceUsed, false);
assert.equal(finding.rawPacketRetained, false);
assert.equal(finding.reviewerKind, 'model');

const record = additiveReviewRecord(sample.receipt, finding);
assert.equal(record.creationOrigin, 'human-authored');
assert.equal(record.reviewOutcome, 'verified');
assert.equal(record.originImmutable, true);

const invalid = normalizeProvenanceFinding({ outcome: 'definitely-ai-because-style' }, { reviewerKind: 'model' });
assert.equal(invalid.outcome, 'needs-human-review');

console.log('Creator provenance review contract passed');
