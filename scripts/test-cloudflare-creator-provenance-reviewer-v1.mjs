import assert from 'node:assert/strict';
import { reviewProvenanceEvidence } from '../cloudflare/node-cloud/src/creator-provenance-reviewer-v1.mjs';

const baseRequest = {
  requestId: 'audit-request:guild-test:sample-1', sampleId: 'sample-1', priorityReason: 'routine', reviewLane: 'model',
  receipt: { sessionId: 'creation:1', headHash: 'head', receiptHash: 'receipt', origin: 'human-authored', aiUsed: false },
  packetVerification: { valid: true, reason: 'verified' },
  analysis: { outcome: 'verified', anomalyCount: 0, anomalies: [], detectorInferenceUsed: false },
  reviewRequest: { schema: 'civweave.creator-provenance-review-request.v1', reviewId: 'review:1', sampleId: 'sample-1', receipt: { origin: 'human-authored' }, provenanceAnalysis: { outcome: 'verified', anomalyCount: 0, anomalies: [], detectorInferenceUsed: false }, rubric: ['Never infer AI authorship from style.'], privacy: { minimumNecessaryEvidence: true, retainRawPacket: false, styleDetectionForbidden: true } },
};

let calls = 0;
const clean = await reviewProvenanceEvidence({ AI: { async run(){ calls++; throw new Error('must not call model for exact clean chain'); } } }, baseRequest, { modelReviewEnabled: true });
assert.equal(clean.status, 'reviewed');
assert.equal(clean.finding.reviewerKind, 'deterministic');
assert.equal(clean.finding.outcome, 'verified');
assert.equal(calls, 0);
assert.equal(clean.finding.rawPacketRetained, false);
assert.equal(clean.finding.detectorInferenceUsed, false);

const ai = await reviewProvenanceEvidence({}, { ...baseRequest, receipt: { ...baseRequest.receipt, origin: 'ai-generated', aiUsed: true }, analysis: { ...baseRequest.analysis, outcome: 'verified-with-ai' }, reviewRequest: { ...baseRequest.reviewRequest, receipt: { origin: 'ai-generated', aiUsed: true }, provenanceAnalysis: { outcome: 'verified-with-ai', anomalyCount: 0, anomalies: [], detectorInferenceUsed: false } } });
assert.equal(ai.status, 'reviewed');
assert.equal(ai.finding.outcome, 'verified-with-ai');
assert.equal(ai.finding.reviewerKind, 'deterministic');

const severeRequest = { ...baseRequest, priorityReason: 'dispute', analysis: { outcome: 'anomalous', anomalyCount: 1, anomalies: [{ code: 'origin-summary-conflict', severity: 'high', detail: 'Conflict.' }], detectorInferenceUsed: false } };
calls = 0;
const severe = await reviewProvenanceEvidence({ AI: { async run(){ calls++; return {}; } } }, severeRequest, { modelReviewEnabled: true });
assert.equal(severe.status, 'pending-human-review');
assert.equal(severe.finding, null);
assert.equal(calls, 0, 'disputes and severe anomalies must bypass model review');

let seenPrompt = '';
const mediumRequest = { ...baseRequest, analysis: { outcome: 'anomalous', anomalyCount: 1, anomalies: [{ code: 'bulk-external-paste', severity: 'medium', detail: 'Large external paste; not proof of AI.' }], detectorInferenceUsed: false }, reviewRequest: { ...baseRequest.reviewRequest, provenanceAnalysis: { outcome: 'anomalous', anomalyCount: 1, anomalies: [{ code: 'bulk-external-paste', severity: 'medium', detail: 'Large external paste; not proof of AI.' }], detectorInferenceUsed: false } } };
const modeled = await reviewProvenanceEvidence({ AI: { async run(_model,input){ seenPrompt = JSON.stringify(input); return { response: JSON.stringify({ outcome: 'unknown-origin', confidence: 0.72, rationale: 'The external material has no trusted creation chain.', findings: [{ code: 'external-origin', status: 'supported', detail: 'Origin remains unknown.' }] }) }; } } }, mediumRequest, { modelReviewEnabled: true, model: '@cf/meta/llama-3.1-8b-instruct-fast' });
assert.equal(modeled.status, 'reviewed');
assert.equal(modeled.finding.reviewerKind, 'model');
assert.equal(modeled.finding.outcome, 'unknown-origin');
assert.match(seenPrompt, /styleDetectionForbidden/);
assert.doesNotMatch(seenPrompt, /private draft|creation-packet|ciphertext|rawPacket/);

const failed = await reviewProvenanceEvidence({ AI: { async run(){ throw new Error('model unavailable'); } } }, mediumRequest, { modelReviewEnabled: true });
assert.equal(failed.status, 'pending-human-review');
assert.equal(failed.finding, null);
assert.match(failed.reason, /model unavailable/i);

const disabled = await reviewProvenanceEvidence({}, mediumRequest, { modelReviewEnabled: false });
assert.equal(disabled.status, 'pending-human-review');
assert.equal(disabled.finding, null);

console.log('Cloudflare Creator provenance reviewer contract passed');
