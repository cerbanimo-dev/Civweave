import { sampleReceipts } from './creator-provenance-audit-sampler-v1.mjs';
import { analyzeCreationPacket } from './creator-provenance-anomaly-v1.mjs';
import { buildProvenanceReviewRequest, routeProvenanceReview } from './creator-provenance-review-v1.mjs';

const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);

function receiptOnlyAnalysis(receipt = {}, reason = 'detailed-evidence-not-opened') {
  const origin = clean(receipt.origin, 40) || 'unknown', aiUsed = Boolean(receipt.aiUsed);
  return Object.freeze({
    schema: 'civweave.creator-provenance-analysis.v1',
    sessionId: clean(receipt.sessionId, 240),
    packetHash: '',
    headHash: clean(receipt.headHash, 128),
    origin,
    aiUsed,
    outcome: origin === 'unknown' ? 'unknown-origin' : aiUsed || origin === 'ai-generated' ? 'verified-with-ai' : 'verified',
    anomalyCount: 0,
    anomalies: Object.freeze([]),
    detectorInferenceUsed: false,
    evidenceScope: 'receipt-only',
    note: reason,
  });
}

export async function runDailyProvenanceAudit(input = {}) {
  const batch = await sampleReceipts(input.receipts || [], {
    guildId: input.guildId,
    dayKey: input.dayKey,
    secretSalt: input.secretSalt,
    policy: input.policy,
    prioritySessionIds: input.prioritySessionIds,
    anomalySessionIds: input.anomalySessionIds,
    disputeSessionIds: input.disputeSessionIds,
  });
  const loadPacket = typeof input.loadPacket === 'function' ? input.loadPacket : null;
  const verifyPacket = typeof input.verifyPacket === 'function' ? input.verifyPacket : null;
  const results = [];

  for (const sample of batch.samples) {
    let analysis = receiptOnlyAnalysis(sample.receipt), packetAccessed = false, packetAvailable = false, packetError = '';
    if (loadPacket) {
      packetAccessed = true;
      try {
        const loaded = await loadPacket(sample);
        const packet = loaded?.packet || loaded;
        if (packet?.schema === 'civweave.creation-packet.v1') {
          packetAvailable = true;
          let verification = null;
          if (verifyPacket) verification = await verifyPacket(packet, sample);
          analysis = analyzeCreationPacket(packet, { verification });
        } else {
          packetError = 'Authorized detailed packet was unavailable or unreadable.';
          analysis = receiptOnlyAnalysis(sample.receipt, packetError);
        }
      } catch (error) {
        packetError = clean(error?.message || error, 800) || 'Authorized detailed packet could not be opened.';
        analysis = receiptOnlyAnalysis(sample.receipt, packetError);
      }
    }
    const reviewLane = routeProvenanceReview(sample, analysis, { allowModelReview: input.allowModelReview !== false });
    const reviewRequest = buildProvenanceReviewRequest({ ...sample, reviewLane }, analysis);
    results.push(Object.freeze({
      schema: 'civweave.creator-audit-work-item.v1',
      sampleId: sample.sampleId,
      sessionId: sample.receipt.sessionId,
      reviewLane,
      priorityReason: sample.priorityReason,
      packetAccessed,
      packetAvailable,
      packetError,
      analysis,
      reviewRequest,
    }));
  }

  return Object.freeze({
    schema: 'civweave.creator-daily-provenance-audit.v1',
    batchId: batch.batchId,
    guildId: batch.guildId,
    dayKey: batch.dayKey,
    eligibleCount: batch.eligibleCount,
    selectedCount: batch.selectedCount,
    packetAccessCount: results.filter(row => row.packetAccessed).length,
    detailedPacketCount: results.filter(row => row.packetAvailable).length,
    batch,
    work: Object.freeze(results),
    privacy: Object.freeze({
      samplingUsesReceiptsOnly: true,
      detailedPacketsRequestedOnlyAfterSelection: true,
      unselectedPacketsAccessed: false,
      styleDetectionUsed: false,
    }),
  });
}
