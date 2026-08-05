import crypto from 'node:crypto';

export const AI_CAPABILITY_SCHEMA = 'commonweave.ai-capability.v1';

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

function sign(unsigned, secret) {
  return crypto.createHmac('sha256', requiredSecret(secret)).update(unsigned).digest('base64url');
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function issueAiCapability({
  userId,
  deviceId,
  planId,
  models,
  maxRequestCents,
  dailyLimitCents,
  walletVersion,
  ttlSeconds = 900,
  nowMs = Date.now(),
  capabilityId = crypto.randomUUID()
}, { secret }) {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 3600) {
    throw new RangeError('Capability lifetime must be between 30 and 3600 seconds.');
  }
  if (!Array.isArray(models) || !models.length) throw new TypeError('models must contain at least one allowed model.');
  if (!Number.isSafeInteger(maxRequestCents) || maxRequestCents < 1) throw new TypeError('maxRequestCents must be a positive integer.');
  if (!Number.isSafeInteger(dailyLimitCents) || dailyLimitCents < maxRequestCents) throw new TypeError('dailyLimitCents must be at least maxRequestCents.');

  const issuedAt = Math.floor(nowMs / 1000);
  const header = { alg: 'HS256', typ: 'CWAI1' };
  const payload = {
    schema: AI_CAPABILITY_SCHEMA,
    jti: requiredString(capabilityId, 'capabilityId'),
    sub: requiredString(userId, 'userId'),
    device: requiredString(deviceId, 'deviceId'),
    plan: requiredString(planId, 'planId'),
    models: [...new Set(models.map(model => requiredString(model, 'model')))],
    maxRequestCents,
    dailyLimitCents,
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
  model,
  estimatedCostCents,
  expectedWalletVersion
}) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) throw new Error('Malformed Commonweave AI capability.');
  const [encodedHeader, encodedPayload, signature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  if (!constantTimeEqual(signature, sign(unsigned, secret))) throw new Error('Invalid Commonweave AI capability signature.');

  let header;
  let payload;
  try {
    header = JSON.parse(decode(encodedHeader));
    payload = JSON.parse(decode(encodedPayload));
  } catch {
    throw new Error('Commonweave AI capability is not valid JSON.');
  }
  if (header.alg !== 'HS256' || header.typ !== 'CWAI1') throw new Error('Unsupported Commonweave AI capability header.');
  if (payload.schema !== AI_CAPABILITY_SCHEMA) throw new Error('Unsupported Commonweave AI capability schema.');

  const now = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || payload.exp <= payload.iat) {
    throw new Error('Commonweave AI capability has invalid timestamps.');
  }
  if (payload.iat > now + 30) throw new Error('Commonweave AI capability was issued in the future.');
  if (payload.exp <= now) throw new Error('Commonweave AI capability has expired.');
  if (deviceId && payload.device !== deviceId) throw new Error('Commonweave AI capability is bound to a different device.');
  if (model && !payload.models.includes(model)) throw new Error('Requested model is not allowed by this capability.');
  if (estimatedCostCents != null) {
    if (!Number.isSafeInteger(estimatedCostCents) || estimatedCostCents < 0) throw new TypeError('estimatedCostCents must be a non-negative integer.');
    if (estimatedCostCents > payload.maxRequestCents) throw new Error('Estimated request cost exceeds the capability limit.');
  }
  if (expectedWalletVersion && payload.walletVersion !== expectedWalletVersion) {
    throw new Error('Commonweave AI capability was revoked by a wallet update.');
  }

  return Object.freeze(payload);
}
