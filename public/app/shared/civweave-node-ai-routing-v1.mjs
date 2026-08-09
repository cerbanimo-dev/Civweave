export const NODE_AI_ROUTING_SCHEMA = 'civweave.node-ai-routing.v1';
export const NODE_AI_SERVICE_MANIFEST_SCHEMA = 'civweave.node-ai-service-manifest.v1';
export const NODE_AI_SERVICE_ADVERT_KIND = 'civweave.node-ai.service-advert.v1';
export const NODE_AI_SETTLEMENT_BATCH_KIND = 'civweave.node-ai.settlement-batch.v1';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const uniq = values => [...new Set((Array.isArray(values) ? values : []).map(value => clean(value, 180)).filter(Boolean))];
const clamp = (value, min, max) => Math.max(min, Math.min(max, number(value, min)));

function manifestFromObject(object) {
  if (!object || object.kind !== NODE_AI_SERVICE_ADVERT_KIND) return null;
  const manifest = object.payload?.manifest || object.payload;
  if (manifest?.schema !== NODE_AI_SERVICE_MANIFEST_SCHEMA || !manifest.nodeId || !Array.isArray(manifest.services)) return null;
  return manifest;
}

export function extractNodeAiCandidates(objects, { nowMs = Date.now(), maxAgeMs = 6 * 60 * 60 * 1000 } = {}) {
  const byService = new Map();
  for (const object of Array.isArray(objects) ? objects : []) {
    const manifest = manifestFromObject(object);
    if (!manifest) continue;
    const observedAt = Date.parse(object.updatedAt || object.createdAt || manifest.generatedAt || 0);
    const ageMs = Number.isFinite(observedAt) ? Math.max(0, nowMs - observedAt) : Number.POSITIVE_INFINITY;
    if (ageMs > maxAgeMs) continue;
    for (const service of manifest.services) {
      if (!service?.id) continue;
      const candidate = {
        schema: NODE_AI_ROUTING_SCHEMA,
        nodeId: clean(manifest.nodeId, 180),
        operatorId: clean(manifest.operatorId, 180),
        displayName: clean(manifest.displayName || manifest.nodeId, 180),
        serviceId: clean(service.id, 120),
        serviceLabel: clean(service.label || service.id, 180),
        capabilities: uniq(service.capabilities),
        billing: structuredClone(service.billing || {}),
        backend: structuredClone(service.backend || {}),
        disclosures: structuredClone(service.disclosures || {}),
        privacy: structuredClone(manifest.privacy || {}),
        settlement: structuredClone(manifest.settlement || {}),
        publicKey: manifest.publicKey || null,
        generatedAt: manifest.generatedAt || null,
        observedAt: Number.isFinite(observedAt) ? new Date(observedAt).toISOString() : null,
        ageMs,
        sourceObjectId: object.id || null,
        sourceRevision: object.revision || null
      };
      const key = `${candidate.nodeId}\u0000${candidate.serviceId}`;
      const previous = byService.get(key);
      if (!previous || candidate.ageMs < previous.ageMs) byService.set(key, candidate);
    }
  }
  return [...byService.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId) || a.serviceId.localeCompare(b.serviceId));
}

function isThirdParty(candidate) {
  if (candidate.disclosures?.thirdPartyInference != null) return Boolean(candidate.disclosures.thirdPartyInference);
  if (candidate.privacy?.thirdPartyInference != null) return Boolean(candidate.privacy.thirdPartyInference);
  const mode = clean(candidate.privacy?.processing || candidate.disclosures?.processing).toLowerCase();
  return mode ? !['local', 'self-hosted', 'on-node', 'on-device'].includes(mode) : true;
}

export function routeNodeAiService({
  candidates,
  requiredCapabilities = [],
  maxRetailCostCents = null,
  maxMinimumChargeCents = null,
  preferredNodeIds = [],
  localNodeId = null,
  allowThirdPartyInference = true,
  latencyByNode = {},
  trustByNode = {},
  nowMs = Date.now(),
  maxAgeMs = 6 * 60 * 60 * 1000
} = {}) {
  const required = uniq(requiredCapabilities);
  const preferred = new Set(uniq(preferredNodeIds));
  const rejected = [];
  const scored = [];

  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const reasons = [];
    const missing = required.filter(capability => !candidate.capabilities.includes(capability));
    if (missing.length) reasons.push(`missing capabilities: ${missing.join(', ')}`);
    const serviceCeiling = Number(candidate.billing?.maxRequestCents);
    if (maxRetailCostCents != null && Number.isFinite(serviceCeiling) && maxRetailCostCents > serviceCeiling) reasons.push('request ceiling exceeds service limit');
    const minimum = Number(candidate.billing?.minimumChargeCents || 0);
    if (maxMinimumChargeCents != null && Number.isFinite(minimum) && minimum > maxMinimumChargeCents) reasons.push('minimum charge exceeds preference');
    if (!allowThirdPartyInference && isThirdParty(candidate)) reasons.push('third-party inference not allowed');
    const observedAt = Date.parse(candidate.observedAt || candidate.generatedAt || 0);
    const ageMs = Number.isFinite(observedAt) ? Math.max(0, nowMs - observedAt) : Number.POSITIVE_INFINITY;
    if (ageMs > maxAgeMs) reasons.push('service advert is stale');
    if (reasons.length) {
      rejected.push({ nodeId: candidate.nodeId, serviceId: candidate.serviceId, reasons });
      continue;
    }

    const components = {
      preferred: preferred.has(candidate.nodeId) ? 1000 : 0,
      local: localNodeId && candidate.nodeId === localNodeId ? 500 : 0,
      privacy: isThirdParty(candidate) ? 0 : 120,
      trust: Math.round(clamp(trustByNode[candidate.nodeId], 0, 1) * 150),
      latency: Math.round(120 * (1 - clamp(number(latencyByNode[candidate.nodeId], 1000), 0, 2000) / 2000)),
      freshness: Math.round(80 * (1 - clamp(ageMs, 0, maxAgeMs) / maxAgeMs)),
      priceFloor: Math.round(80 * (1 - clamp(minimum, 0, Math.max(100, maxMinimumChargeCents || 100)) / Math.max(100, maxMinimumChargeCents || 100)))
    };
    const score = Object.values(components).reduce((sum, value) => sum + value, 0);
    scored.push({ ...structuredClone(candidate), routing: { score, components, thirdPartyInference: isThirdParty(candidate) } });
  }

  scored.sort((a, b) => b.routing.score - a.routing.score
    || Number(a.billing?.minimumChargeCents || 0) - Number(b.billing?.minimumChargeCents || 0)
    || a.nodeId.localeCompare(b.nodeId)
    || a.serviceId.localeCompare(b.serviceId));

  return Object.freeze({
    schema: NODE_AI_ROUTING_SCHEMA,
    selected: scored[0] || null,
    alternatives: scored.slice(1),
    rejected,
    requiredCapabilities: required,
    evaluated: (Array.isArray(candidates) ? candidates : []).length,
    eligible: scored.length
  });
}
