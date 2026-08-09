import crypto from 'node:crypto';

export const AI_CAPABILITY_SCHEMA = 'civweave.node-ai-capability.v1';

const encode = value => Buffer.from(value).toString('base64url');
const decode = value => Buffer.from(value, 'base64url').toString('utf8');

function requiredString(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}
function requiredSecret(secret) {
  const value = requiredString(secret, 'secret');
  if (Buffer.byteLength(value) < 32) throw new RangeError('Capability signing secret must contain at least 32 bytes.');
  return value;
}
function sign(unsigned, secret) { return crypto.createHmac('sha256', requiredSecret(secret)).update(unsigned).digest('base64url'); }
function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left)); const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function serviceList(values) {
  if (!Array.isArray(values) || !values.length) throw new TypeError('serviceIds must contain at least one allowed node AI service.');
  return [...new Set(values.map(value => requiredString(value, 'serviceId')))];
}

export function issueAiCapability({
  userId,
  deviceId,
  nodeId,
  serviceIds,
  maxRetailCostCents,
  walletVersion,
  ttlSeconds = 900,
  nowMs = Date.now(),
  capabilityId = crypto.randomUUID()
}, { secret }) {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 3600) throw new RangeError('Capability lifetime must be between 30 and 3600 seconds.');
  if (!Number.isSafeInteger(maxRetailCostCents) || maxRetailCostCents < 1) throw new TypeError('maxRetailCostCents must be a positive integer.');
  const issuedAt = Math.floor(nowMs / 1000);
  const header = { alg: 'HS256', typ: 'CWNAI1' };
  const payload = {
    schema: AI_CAPABILITY_SCHEMA,
    jti: requiredString(capabilityId, 'capabilityId'),
    sub: requiredString(userId, 'userId'),
    device: requiredString(deviceId, 'deviceId'),
    node: requiredString(nodeId, 'nodeId'),
    services: serviceList(serviceIds),
    maxRetailCostCents,
    walletVersion: requiredString(walletVersion, 'walletVersion'),
    iat: issuedAt,
    exp: issuedAt + ttlSeconds
  };
  const unsigned = `${encode(JSON.stringify(header))}.${encode(JSON.stringify(payload))}`;
  return `${unsigned}.${sign(unsigned, secret)}`;
}

export function verifyAiCapability(token, {
  secret,
  nowMs = Date.now(),
  deviceId,
  nodeId,
  serviceId,
  estimatedRetailCostCents,
  expectedWalletVersion
}) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) throw new Error('Malformed Civweave node AI capability.');
  const [encodedHeader, encodedPayload, signature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  if (!constantTimeEqual(signature, sign(unsigned, secret))) throw new Error('Invalid Civweave node AI capability signature.');
  let header, payload;
  try { header = JSON.parse(decode(encodedHeader)); payload = JSON.parse(decode(encodedPayload)); }
  catch { throw new Error('Civweave node AI capability is not valid JSON.'); }
  if (header.alg !== 'HS256' || header.typ !== 'CWNAI1') throw new Error('Unsupported Civweave node AI capability header.');
  if (payload.schema !== AI_CAPABILITY_SCHEMA) throw new Error('Unsupported Civweave node AI capability schema.');
  const now = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || payload.exp <= payload.iat) throw new Error('Civweave node AI capability has invalid timestamps.');
  if (payload.iat > now + 30) throw new Error('Civweave node AI capability was issued in the future.');
  if (payload.exp <= now) throw new Error('Civweave node AI capability has expired.');
  if (deviceId && payload.device !== deviceId) throw new Error('Civweave node AI capability is bound to a different device.');
  if (nodeId && payload.node !== nodeId) throw new Error('Civweave node AI capability is bound to a different node.');
  if (serviceId && !payload.services.includes(serviceId)) throw new Error('Requested service is not allowed by this capability.');
  if (estimatedRetailCostCents != null) {
    if (!Number.isSafeInteger(estimatedRetailCostCents) || estimatedRetailCostCents < 0) throw new TypeError('estimatedRetailCostCents must be a non-negative integer.');
    if (estimatedRetailCostCents > payload.maxRetailCostCents) throw new Error('Estimated retail request cost exceeds the capability limit.');
  }
  if (expectedWalletVersion && payload.walletVersion !== expectedWalletVersion) throw new Error('Civweave node AI capability was revoked by a wallet update.');
  return Object.freeze(payload);
}
