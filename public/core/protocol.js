export const PROTOCOL_VERSION = 'commonweave.mesh.v1';
export const SYSTEMS = Object.freeze(['commonweave', 'living-school', 'cerbanimo', 'fellowfare', 'anarchadia']);
export const MESSAGE_TYPES = Object.freeze([
  'presence',
  'friend.request',
  'trade.request',
  'trade.offer',
  'validation.request',
  'validation.receipt',
  'task.request',
  'learning.request',
  'materials.request'
]);

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function createEnvelope({ type, origin, payload, ttl = 4, target = null, now = Date.now(), id = crypto.randomUUID() }) {
  if (!MESSAGE_TYPES.includes(type)) throw new Error(`Unsupported message type: ${type}`);
  if (!origin) throw new Error('Envelope origin is required.');
  return {
    schema: PROTOCOL_VERSION,
    id,
    type,
    origin,
    target,
    createdAt: new Date(now).toISOString(),
    hops: 0,
    ttl: Math.max(1, Math.min(8, Number(ttl) || 4)),
    payload: structuredClone(payload ?? {})
  };
}

export function forwardEnvelope(envelope) {
  if (!envelope || envelope.schema !== PROTOCOL_VERSION) return null;
  if (Number(envelope.hops) >= Number(envelope.ttl)) return null;
  return { ...structuredClone(envelope), hops: Number(envelope.hops) + 1 };
}

export function validateEnvelope(envelope) {
  const errors = [];
  if (!envelope || typeof envelope !== 'object') errors.push('Envelope must be an object.');
  if (envelope?.schema !== PROTOCOL_VERSION) errors.push('Protocol version mismatch.');
  if (!MESSAGE_TYPES.includes(envelope?.type)) errors.push('Unsupported message type.');
  if (!envelope?.id || !envelope?.origin) errors.push('Envelope identity is incomplete.');
  if (!Number.isFinite(Number(envelope?.hops)) || !Number.isFinite(Number(envelope?.ttl))) errors.push('Envelope hop data is invalid.');
  if (Number(envelope?.hops) > Number(envelope?.ttl)) errors.push('Envelope exceeded its TTL.');
  const serialized = JSON.stringify(envelope?.payload ?? {});
  if (/api[_-]?key|authorization|bearer\s+[a-z0-9._-]+|private[_-]?key|passphrase/i.test(serialized)) {
    errors.push('Envelope payload appears to contain a secret.');
  }
  return { ok: errors.length === 0, errors };
}
