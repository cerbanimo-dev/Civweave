import crypto from 'node:crypto';
import net from 'node:net';

export const NODE_AI_OPERATOR_SESSION_SCHEMA = 'civweave.node-ai-operator-session.v1';
const PREFIX = 'cwop1';

function clean(value, max = 10000) { return String(value ?? '').trim().slice(0, max); }
function secretReady(value) { return Buffer.byteLength(clean(value)) >= 32; }
function b64json(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function parseJson64(value) { try { return JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8')); } catch { throw new Error('Malformed node operator session.'); } }
function mac(value, secret) { return crypto.createHmac('sha256', secret).update(value).digest('base64url'); }
function timingEqual(left, right) { const a = Buffer.from(String(left)); const b = Buffer.from(String(right)); return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b); }

export function issueNodeOperatorSession({ nodeId, secret, ttlSeconds = 8 * 60 * 60, now = () => Date.now() } = {}) {
  const normalizedNodeId = clean(nodeId, 180);
  if (!normalizedNodeId) throw new TypeError('nodeId is required.');
  if (!secretReady(secret)) throw new RangeError('Node operator session secret must contain at least 32 bytes.');
  const issuedAt = Math.floor(now() / 1000);
  const ttl = Math.max(60, Math.min(24 * 60 * 60, Number(ttlSeconds) || 8 * 60 * 60));
  const payload = b64json({ schema: NODE_AI_OPERATOR_SESSION_SCHEMA, sub: normalizedNodeId, role: 'node:operator', iat: issuedAt, exp: issuedAt + ttl, nonce: crypto.randomBytes(12).toString('base64url') });
  return `${PREFIX}.${payload}.${mac(`${PREFIX}.${payload}`, secret)}`;
}

export function verifyNodeOperatorSession(token, { nodeId, secret, now = () => Date.now() } = {}) {
  if (!secretReady(secret)) throw new Error('Node operator session verifier is unavailable.');
  const parts = clean(token, 12000).split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) throw new Error('Malformed node operator session.');
  const expected = mac(`${parts[0]}.${parts[1]}`, secret);
  if (!timingEqual(parts[2], expected)) throw new Error('Invalid node operator session.');
  const payload = parseJson64(parts[1]);
  if (payload?.schema !== NODE_AI_OPERATOR_SESSION_SCHEMA || payload?.role !== 'node:operator') throw new Error('Invalid node operator session role.');
  if (clean(payload.sub, 180) !== clean(nodeId, 180)) throw new Error('Node operator session belongs to a different node.');
  const nowSeconds = Math.floor(now() / 1000);
  if (!Number.isSafeInteger(payload.exp) || payload.exp <= nowSeconds) throw new Error('Node operator session expired.');
  if (!Number.isSafeInteger(payload.iat) || payload.iat > nowSeconds + 60) throw new Error('Node operator session has an invalid issue time.');
  return Object.freeze(payload);
}

export function isLoopbackOperatorRequest(req) {
  let address = clean(req?.socket?.remoteAddress || req?.connection?.remoteAddress || '', 200).toLowerCase().split('%')[0];
  if (!address) return false;
  if (address === '::1' || address === '127.0.0.1') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (mapped) address = mapped[1];
  if (net.isIP(address) === 4) return address.startsWith('127.');
  return false;
}

export function requireNodeOperatorAuth(req, { nodeId, secret, now = () => Date.now(), legacyHeader = 'x-civweave-internal-secret' } = {}) {
  const explicitSession = clean(req?.headers?.['x-civweave-operator-session'], 12000);
  if (explicitSession) return verifyNodeOperatorSession(explicitSession, { nodeId, secret, now });
  const supplied = clean(req?.headers?.[legacyHeader], 12000);
  if (supplied.startsWith(`${PREFIX}.`)) return verifyNodeOperatorSession(supplied, { nodeId, secret, now });
  if (!secretReady(secret) || !timingEqual(supplied, secret)) throw new Error('Invalid Civweave node operator authorization.');
  return Object.freeze({ schema: NODE_AI_OPERATOR_SESSION_SCHEMA, sub: clean(nodeId, 180), role: 'node:operator', legacy: true });
}
