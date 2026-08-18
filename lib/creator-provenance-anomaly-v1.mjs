const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const actorKind = event => clean(event?.actor?.kind, 40).toLowerCase();
const eventType = event => clean(event?.type, 120).toLowerCase();
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function anomaly(code, severity, event, detail, evidence = {}) {
  return Object.freeze({
    schema: 'civweave.creator-provenance-anomaly.v1',
    code,
    severity,
    seq: Math.max(0, Math.round(finite(event?.seq))),
    eventId: clean(event?.id, 240),
    eventType: eventType(event),
    detail: clean(detail, 800),
    evidence: Object.freeze({ ...evidence }),
  });
}

export function analyzeCreationPacket(packet = {}, options = {}) {
  const events = Array.isArray(packet.events) ? packet.events : [];
  const anomalies = [];
  const verification = options.verification && typeof options.verification === 'object' ? options.verification : null;

  if (packet.schema !== 'civweave.creation-packet.v1') {
    anomalies.push(anomaly('packet-schema', 'high', null, 'Packet schema is not the Civweave creation packet v1 contract.'));
  }
  if (Math.max(0, Math.round(finite(packet.eventCount))) !== events.length) {
    anomalies.push(anomaly('event-count-mismatch', 'high', null, 'Packet event count does not match the included event records.', { declared: finite(packet.eventCount), actual: events.length }));
  }
  if (events.length && clean(packet.headHash, 128) !== clean(events.at(-1)?.hash, 128)) {
    anomalies.push(anomaly('head-hash-mismatch', 'high', events.at(-1), 'Packet head hash does not match the final included event hash.'));
  }
  if (verification && verification.valid === false) {
    anomalies.push(anomaly('cryptographic-verification-failed', 'critical', null, `Canonical provenance verification failed: ${clean(verification.reason, 160) || 'unknown reason'}.`));
  }

  let previousSeq = 0;
  let previousTimestamp = null;
  for (const event of events) {
    const seq = Math.round(finite(event?.seq)), type = eventType(event), kind = actorKind(event), payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
    if (seq !== previousSeq + 1) anomalies.push(anomaly('sequence-gap', 'high', event, 'Event sequence is missing, duplicated, or reordered.', { expected: previousSeq + 1, actual: seq }));
    previousSeq = seq;

    const timestamp = Date.parse(clean(event?.timestamp, 80));
    if (Number.isFinite(timestamp) && Number.isFinite(previousTimestamp) && timestamp < previousTimestamp) {
      anomalies.push(anomaly('wall-clock-regression', 'low', event, 'Wall-clock timestamp moved backward. Sequence order remains authoritative; this may be an ordinary clock change.', { deltaMilliseconds: timestamp - previousTimestamp }));
    }
    if (Number.isFinite(timestamp)) previousTimestamp = timestamp;

    if ((type.startsWith('ai.') || kind === 'civweave-ai') && kind !== 'civweave-ai') {
      anomalies.push(anomaly('ai-event-actor-mismatch', 'high', event, 'An AI semantic event is not attributed to the Civweave AI actor class.'));
    }
    if (kind === 'civweave-ai') {
      const missing = ['provider', 'model', 'requestId'].filter(key => !clean(event?.actor?.[key], key === 'model' ? 240 : 180));
      if (missing.length) anomalies.push(anomaly('ai-attribution-incomplete', 'high', event, `AI event is missing required route attribution: ${missing.join(', ')}.`, { missing }));
    }

    if (type === 'external.paste') {
      const length = Math.max(0, finite(payload.length));
      if (length >= 2000) anomalies.push(anomaly('bulk-external-paste', 'medium', event, 'A large external paste entered the creation session. This establishes external/unknown origin for that material; it does not prove AI use.', { length }));
    }
    if (type === 'media.import' || type === 'external.import') {
      const size = Math.max(0, finite(payload.size));
      anomalies.push(anomaly('external-media-import', size >= 5 * 1024 * 1024 ? 'medium' : 'info', event, 'External media entered the session without native Civweave creation history.', { size, mimeType: clean(payload.mimeType, 120) }));
    }
  }

  const summary = packet?.summary && typeof packet.summary === 'object' ? packet.summary : {};
  const origin = clean(summary.origin || packet.origin, 40) || 'unknown';
  const aiUsed = Boolean(summary.aiUsed);
  if (origin === 'human-authored' && events.some(event => actorKind(event) === 'external')) {
    anomalies.push(anomaly('origin-summary-conflict', 'high', null, 'Packet claims human-authored origin while containing external-origin events.'));
  }
  if (origin === 'human-authored' && events.some(event => actorKind(event) === 'civweave-ai' || eventType(event).startsWith('ai.'))) {
    anomalies.push(anomaly('origin-summary-conflict', 'critical', null, 'Packet claims human-authored origin while containing AI-origin events.'));
  }

  const severe = anomalies.some(row => ['critical', 'high'].includes(row.severity));
  const medium = anomalies.some(row => row.severity === 'medium');
  let outcome = 'verified';
  if (verification?.valid === false || anomalies.some(row => ['cryptographic-verification-failed', 'head-hash-mismatch', 'event-count-mismatch', 'sequence-gap'].includes(row.code))) outcome = 'broken-chain';
  else if (severe || medium) outcome = 'anomalous';
  else if (origin === 'unknown') outcome = 'unknown-origin';
  else if (aiUsed || origin === 'ai-generated') outcome = 'verified-with-ai';

  return Object.freeze({
    schema: 'civweave.creator-provenance-analysis.v1',
    sessionId: clean(packet.sessionId, 240),
    packetHash: clean(packet.packetHash, 128),
    headHash: clean(packet.headHash, 128),
    origin,
    aiUsed,
    outcome,
    anomalyCount: anomalies.length,
    anomalies: Object.freeze(anomalies),
    detectorInferenceUsed: false,
    note: 'This analysis uses provenance structure and recorded creation events only. It does not infer AI authorship from writing, audio, or visual style.',
  });
}
