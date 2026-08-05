import crypto from 'node:crypto';

export const AI_WALLET_SESSION_SCHEMA = 'commonweave.ai-wallet-session.v1';

const encode = value => Buffer.from(value).toString('base64url');
const decode = value => Buffer.from(value, 'base64url').toString('utf8');

function requiredString(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}

function requiredSecret(secret) {
  const value = requiredString(secret, 'secret');
  if (Buffer.byteLength(value) < 32) throw new RangeError('Wallet session signing secret must contain at least 32 bytes.');
  return value;
}

function signature(unsigned, secret) {
  return crypto.createHmac('sha256', requiredSecret(secret)).update(unsigned).digest('base64url');
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function issueAiWalletSession({
  userId,
  deviceId,
  roles = ['wallet:user'],
  ttlSeconds = 900,
  nowMs = Date.now(),
  sessionId = crypto.randomUUID()
}, { secret }) {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 86400) {
    throw new RangeError('Wallet session lifetime must be between 30 seconds and 24 hours.');
  }
  if (!Array.isArray(roles) || !roles.length) throw new TypeError('roles must contain at least one role.');
  const issuedAt = Math.floor(nowMs / 1000);
  const header = { alg: 'HS256', typ: 'CWAUTH1' };
  const payload = {
    schema: AI_WALLET_SESSION_SCHEMA,
    jti: requiredString(sessionId, 'sessionId'),
    sub: requiredString(userId, 'userId'),
    device: requiredString(deviceId, 'deviceId'),
    roles: [...new Set(roles.map(role => requiredString(role, 'role')))],
    iat: issuedAt,
    exp: issuedAt + ttlSeconds
  };
  const unsigned = `${encode(JSON.stringify(header))}.${encode(JSON.stringify(payload))}`;
  return `${unsigned}.${signature(unsigned, secret)}`;
}

export function verifyAiWalletSession(token, {
  secret,
  nowMs = Date.now(),
  deviceId,
  requiredRole = 'wallet:user'
}) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) throw new Error('Malformed Commonweave wallet session.');
  const [encodedHeader, encodedPayload, suppliedSignature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  if (!constantTimeEqual(suppliedSignature, signature(unsigned, secret))) throw new Error('Invalid Commonweave wallet session signature.');

  let header;
  let payload;
  try {
    header = JSON.parse(decode(encodedHeader));
    payload = JSON.parse(decode(encodedPayload));
  } catch {
    throw new Error('Commonweave wallet session is not valid JSON.');
  }
  if (header.alg !== 'HS256' || header.typ !== 'CWAUTH1') throw new Error('Unsupported Commonweave wallet session header.');
  if (payload.schema !== AI_WALLET_SESSION_SCHEMA) throw new Error('Unsupported Commonweave wallet session schema.');
  const now = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || payload.exp <= payload.iat) throw new Error('Commonweave wallet session has invalid timestamps.');
  if (payload.iat > now + 30) throw new Error('Commonweave wallet session was issued in the future.');
  if (payload.exp <= now) throw new Error('Commonweave wallet session has expired.');
  if (!Array.isArray(payload.roles)) throw new Error('Commonweave wallet session roles are invalid.');
  if (requiredRole && !payload.roles.includes(requiredRole)) throw new Error(`Commonweave wallet session lacks ${requiredRole}.`);
  if (deviceId && payload.device !== deviceId) throw new Error('Commonweave wallet session is bound to a different device.');
  return Object.freeze(payload);
}
