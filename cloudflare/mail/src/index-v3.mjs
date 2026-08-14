import baseWorker, {
  CivweaveMailbox as BaseCivweaveMailbox,
  MAIL_DOMAIN,
  MAIL_SCHEMA,
} from './index-v2.mjs';
import {
  LOW_TRAFFIC_POLICY,
  recommendedWorkerInterval,
  trafficMode,
} from './low-traffic-policy.mjs';

const enc = new TextEncoder();
const SYSTEM_ACCESS_HASH = 'f67b1cf2ce801f94253964ad0cf2585713584a4511ee7412ba125c6567ebd65c';
const PM_SCHEMA = 'civweave.pm-relay.v1';
const PM_ENVELOPE_KIND = 'civweave.pm.envelope.v1';
const PM_SUFFIX = '_pm';
const PM_MAX_ENVELOPE_BYTES = 256 * 1024;
const USERNAME_RESERVED = new Set(['abuse', 'admin', 'mailer-daemon', 'postmaster', 'recover', 'recovery', 'root', 'security', 'support', 'system']);

export const SYSTEM_MAILBOXES = Object.freeze([
  'weaveling',
  'moss',
  'kamiya',
  'rook',
  'merlin',
]);
const SYSTEM_LOCAL_PARTS = new Set(SYSTEM_MAILBOXES);
for (const name of SYSTEM_MAILBOXES) USERNAME_RESERVED.add(name);

const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
const pmHeaders = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-civweave-pm-username',
  'access-control-max-age': '86400',
  'cache-control': 'no-store',
});
const pmJson = (value, status = 200) => Response.json(value, { status, headers: pmHeaders });

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function constantEqual(a, b) {
  const aa = String(a || ''), bb = String(b || '');
  const length = Math.max(aa.length, bb.length, 1);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < length; i += 1) diff |= (aa.charCodeAt(i % Math.max(1, aa.length)) || 0) ^ (bb.charCodeAt(i % Math.max(1, bb.length)) || 0);
  return diff === 0;
}
function localPartFromAddress(value, domain = MAIL_DOMAIN) {
  const raw = clean(value, 320).toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at <= 0 || raw.slice(at + 1) !== domain) return '';
  return raw.slice(0, at).split('+', 1)[0];
}
function isSystemLocalPart(value) {
  return SYSTEM_LOCAL_PARTS.has(clean(value, 64).toLowerCase());
}
function isPmLocalPart(value) {
  const local = clean(value, 64).toLowerCase();
  return local.length > PM_SUFFIX.length && local.endsWith(PM_SUFFIX);
}
function normalizeUsername(value) {
  const username = clean(value, 32).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/.test(username) || username.includes('..')) {
    throw Object.assign(new Error('Username must be 3–32 lowercase letters, numbers, dots, dashes, or underscores.'), { status: 400 });
  }
  if (USERNAME_RESERVED.has(username)) throw Object.assign(new Error('That username is reserved by Civweave.'), { status: 409 });
  return username;
}
function pmLocalPart(username) { return `${normalizeUsername(username)}${PM_SUFFIX}`; }
function systemCredentialCandidate(value) {
  const candidate = clean(value, 240);
  return candidate.length >= 12 && candidate.length <= 200 && !/[\r\n\0]/.test(candidate);
}
function normalizePublicKeyJwk(value) {
  const source = value && typeof value === 'object' ? value : {};
  const x = clean(source.x, 160), y = clean(source.y, 160);
  if (source.kty !== 'EC' || source.crv !== 'P-256' || !/^[A-Za-z0-9_-]{40,100}$/.test(x) || !/^[A-Za-z0-9_-]{40,100}$/.test(y)) {
    throw Object.assign(new Error('Private-messaging public key must be a P-256 EC JWK.'), { status: 400 });
  }
  return Object.freeze({ kty: 'EC', crv: 'P-256', x, y, ext: true, key_ops: [] });
}
async function keyFingerprint(publicKey) {
  const normalized = normalizePublicKeyJwk(publicKey);
  return sha256Hex(`civweave.pm-key.v1\n${JSON.stringify(normalized)}`);
}
function bearer(request) {
  const header = clean(request.headers.get('authorization'), 1000), match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error('Private-messaging access key is required.'), { status: 401 });
  return clean(match[1], 400);
}
function pmAuth(request, env) {
  const username = normalizeUsername(request.headers.get('x-civweave-pm-username'));
  return { username, accessKey: bearer(request), box: env.MAILBOX.getByName(pmLocalPart(username)) };
}
function pmEnvelopeKey(id) {
  const d = new Date();
  return `pm/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${id}.json`;
}
function validateEnvelope(input) {
  const envelope = input && typeof input === 'object' ? input : {};
  if (envelope.kind !== PM_ENVELOPE_KIND) throw Object.assign(new Error('Unsupported private-message envelope.'), { status: 400 });
  const id = clean(envelope.id, 80);
  if (!/^[a-f0-9]{8}-[a-f0-9-]{27,40}$/i.test(id)) throw Object.assign(new Error('Private-message envelope id is invalid.'), { status: 400 });
  const ciphertext = clean(envelope.ciphertext, 360_000), iv = clean(envelope.iv, 80);
  const senderFingerprint = clean(envelope.senderFingerprint, 80).toLowerCase();
  const recipientFingerprint = clean(envelope.recipientFingerprint, 80).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(senderFingerprint) || !/^[a-f0-9]{64}$/.test(recipientFingerprint)) throw Object.assign(new Error('Private-message key fingerprints are invalid.'), { status: 400 });
  if (!/^[A-Za-z0-9_-]{12,360000}$/.test(ciphertext) || !/^[A-Za-z0-9_-]{12,80}$/.test(iv)) throw Object.assign(new Error('Encrypted private-message payload is invalid.'), { status: 400 });
  const senderPublicKey = normalizePublicKeyJwk(envelope.senderPublicKey);
  const normalized = Object.freeze({
    kind: PM_ENVELOPE_KIND,
    version: 1,
    id,
    createdAt: clean(envelope.createdAt, 64),
    alg: 'ECDH-P256+HKDF-SHA256+AES-256-GCM',
    senderFingerprint,
    recipientFingerprint,
    senderPublicKey,
    iv,
    ciphertext,
  });
  const bytes = enc.encode(JSON.stringify(normalized)).byteLength;
  if (bytes > PM_MAX_ENVELOPE_BYTES) throw Object.assign(new Error('Private message is too large for the relay.'), { status: 413 });
  return normalized;
}

export class CivweaveMailbox extends BaseCivweaveMailbox {
  constructor(ctx, env) {
    super(ctx, env);
    this.systemCtx = ctx;
    this.systemCtx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS pm_identity (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        username TEXT NOT NULL UNIQUE,
        public_key_jwk TEXT NOT NULL,
        key_fingerprint TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pm_messages (
        id TEXT PRIMARY KEY,
        envelope_key TEXT NOT NULL,
        sender_fingerprint TEXT NOT NULL,
        received_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS pm_messages_time ON pm_messages(received_at DESC);
    `);
  }

  async ensureSystem(localPart) {
    const local = clean(localPart, 64).toLowerCase();
    if (!isSystemLocalPart(local)) return false;
    const existing = this.account();
    if (existing) return existing.local_part === local;
    const timestamp = new Date().toISOString();
    this.systemCtx.storage.sql.exec(
      'INSERT INTO account(id, local_part, access_hash, setup_hash, setup_expires, created_at, updated_at) VALUES(1, ?, ?, NULL, NULL, ?, ?)',
      local,
      SYSTEM_ACCESS_HASH,
      timestamp,
      timestamp,
    );
    return true;
  }

  async authenticate(credential) {
    const record = this.account();
    if (record && isSystemLocalPart(record.local_part) && systemCredentialCandidate(credential)) {
      const hash = await sha256Hex(`civweave.mail-access.v1\n${credential}`);
      if (constantEqual(hash, SYSTEM_ACCESS_HASH)) return record;
    }
    return super.authenticate(credential);
  }

  pmIdentity() {
    const row = this.systemCtx.storage.sql.exec('SELECT username,public_key_jwk AS publicKeyJwk,key_fingerprint AS fingerprint,created_at AS createdAt,updated_at AS updatedAt FROM pm_identity WHERE id=1').toArray()[0];
    if (!row) return null;
    return { ...row, publicKey: JSON.parse(row.publicKeyJwk) };
  }

  async configurePm(username, publicKey, accessKey) {
    const account = await super.authenticate(accessKey);
    const expectedLocal = pmLocalPart(username);
    if (account.local_part !== expectedLocal) throw Object.assign(new Error('Private-messaging account binding is invalid.'), { status: 409 });
    const normalizedKey = normalizePublicKeyJwk(publicKey), fingerprint = await keyFingerprint(normalizedKey), timestamp = new Date().toISOString();
    const existing = this.pmIdentity();
    if (existing && existing.username !== username) throw Object.assign(new Error('Private-messaging username is already bound.'), { status: 409 });
    if (existing && existing.fingerprint !== fingerprint) throw Object.assign(new Error('Private-messaging key rotation requires the dedicated recovery flow.'), { status: 409 });
    this.systemCtx.storage.sql.exec(
      'INSERT INTO pm_identity(id,username,public_key_jwk,key_fingerprint,created_at,updated_at) VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at',
      username,
      JSON.stringify(normalizedKey),
      fingerprint,
      existing?.createdAt || timestamp,
      timestamp,
    );
    return { username, publicKey: normalizedKey, fingerprint };
  }

  async pmProfile() {
    return this.pmIdentity();
  }

  async listPm(accessKey, limit = 100) {
    await super.authenticate(accessKey);
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
    return this.systemCtx.storage.sql.exec('SELECT id,sender_fingerprint AS senderFingerprint,received_at AS receivedAt FROM pm_messages ORDER BY received_at DESC LIMIT ?', safeLimit).toArray();
  }

  async pmMessage(accessKey, id) {
    await super.authenticate(accessKey);
    const row = this.systemCtx.storage.sql.exec('SELECT id,envelope_key AS envelopeKey,sender_fingerprint AS senderFingerprint,received_at AS receivedAt FROM pm_messages WHERE id=?', clean(id, 80)).toArray()[0];
    if (!row) throw Object.assign(new Error('Private message not found.'), { status: 404 });
    return row;
  }

  async deliverPm(meta) {
    if (!this.pmIdentity()) throw Object.assign(new Error('Private-messaging username does not exist.'), { status: 404 });
    this.systemCtx.storage.sql.exec('INSERT OR IGNORE INTO pm_messages(id,envelope_key,sender_fingerprint,received_at) VALUES(?,?,?,?)', meta.id, meta.envelopeKey, meta.senderFingerprint, meta.receivedAt);
    return { ok: true };
  }

  async ackPm(accessKey, id) {
    const row = await this.pmMessage(accessKey, id);
    this.systemCtx.storage.sql.exec('DELETE FROM pm_messages WHERE id=?', row.id);
    return row;
  }
}

async function ensureSystemMailbox(env, localPart) {
  const local = clean(localPart, 64).toLowerCase();
  if (!isSystemLocalPart(local)) return false;
  await env.MAILBOX.getByName(local).ensureSystem(local);
  return true;
}

async function claimPm(request, env, ctx) {
  const input = await request.json().catch(() => ({}));
  const username = normalizeUsername(input.username), localPart = pmLocalPart(username);
  const publicKey = normalizePublicKeyJwk(input.publicKey);
  const internalUrl = new URL(request.url); internalUrl.pathname = '/api/claim';
  const internalRequest = new Request(internalUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ localPart, claimToken: clean(input.claimToken, 500), setupKey: clean(input.setupKey, 240) }),
  });
  const response = await baseWorker.fetch(internalRequest, env, ctx), packet = await response.json().catch(() => ({}));
  if (!response.ok || packet?.ok !== true) return pmJson({ ok: false, error: packet.error || 'Private username claim failed.' }, response.status || 400);
  const profile = await env.MAILBOX.getByName(localPart).configurePm(username, publicKey, packet.accessKey);
  return pmJson({
    ok: true,
    username,
    accessKey: packet.accessKey,
    recoveryCodes: packet.recoveryCodes || [],
    fingerprint: profile.fingerprint,
    publicKey: profile.publicKey,
    transport: 'mesh-first-hidden-mail-relay',
  });
}

async function pmDirectory(env, username) {
  const normalized = normalizeUsername(username), profile = await env.MAILBOX.getByName(pmLocalPart(normalized)).pmProfile();
  if (!profile) return pmJson({ ok: false, error: 'Private-messaging username not found.' }, 404);
  return pmJson({ ok: true, username: normalized, publicKey: profile.publicKey, fingerprint: profile.fingerprint });
}

async function sendPm(request, env) {
  const auth = pmAuth(request, env), sender = await auth.box.pmProfile();
  await auth.box.authenticate(auth.accessKey);
  if (!sender || sender.username !== auth.username) throw Object.assign(new Error('Private-messaging identity is not configured.'), { status: 409 });
  const input = await request.json().catch(() => ({})), toUsername = normalizeUsername(input.toUsername), envelope = validateEnvelope(input.envelope);
  const recipientBox = env.MAILBOX.getByName(pmLocalPart(toUsername)), recipient = await recipientBox.pmProfile();
  if (!recipient) throw Object.assign(new Error('Private-messaging recipient not found.'), { status: 404 });
  const senderEnvelopeFingerprint = await keyFingerprint(envelope.senderPublicKey);
  if (!constantEqual(senderEnvelopeFingerprint, sender.fingerprint) || !constantEqual(envelope.senderFingerprint, sender.fingerprint)) throw Object.assign(new Error('Private-message sender key does not match the authenticated username.'), { status: 403 });
  if (!constantEqual(envelope.recipientFingerprint, recipient.fingerprint)) throw Object.assign(new Error('Recipient key changed; refresh the contact before sending.'), { status: 409 });
  const envelopeKey = pmEnvelopeKey(envelope.id), receivedAt = new Date().toISOString(), payload = JSON.stringify(envelope);
  await env.MAIL_BLOBS.put(envelopeKey, payload, { httpMetadata: { contentType: 'application/json' }, customMetadata: { schema: PM_SCHEMA, kind: PM_ENVELOPE_KIND } });
  try {
    await recipientBox.deliverPm({ id: envelope.id, envelopeKey, senderFingerprint: sender.fingerprint, receivedAt });
  } catch (error) {
    await env.MAIL_BLOBS.delete(envelopeKey);
    throw error;
  }
  return pmJson({ ok: true, id: envelope.id, relay: 'hidden-mail', duplicateSafe: true });
}

async function listPm(request, env) {
  const auth = pmAuth(request, env), messages = await auth.box.listPm(auth.accessKey);
  return pmJson({ ok: true, username: auth.username, messages });
}

async function readPm(request, env, id) {
  const auth = pmAuth(request, env), meta = await auth.box.pmMessage(auth.accessKey, id), object = await env.MAIL_BLOBS.get(meta.envelopeKey);
  if (!object) throw Object.assign(new Error('Encrypted private-message envelope is unavailable.'), { status: 410 });
  const envelope = validateEnvelope(await object.json());
  return pmJson({ ok: true, message: { id: meta.id, receivedAt: meta.receivedAt, envelope } });
}

async function ackPm(request, env, id) {
  const auth = pmAuth(request, env), meta = await auth.box.ackPm(auth.accessKey, id);
  await env.MAIL_BLOBS.delete(meta.envelopeKey);
  return pmJson({ ok: true, id: meta.id, acknowledged: true });
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const domain = clean(env.MAIL_DOMAIN || MAIL_DOMAIN, 255).toLowerCase();

    if (url.pathname.startsWith('/api/pm/') && request.method === 'OPTIONS') return new Response(null, { status: 204, headers: pmHeaders });
    try {
      if (request.method === 'GET' && url.pathname === '/api/pm/health') return pmJson({ ok: true, schema: PM_SCHEMA, transport: 'mesh-first-hidden-mail-relay', externalEmail: false, paidMailSeparate: true });
      if (request.method === 'POST' && url.pathname === '/api/pm/claim') return await claimPm(request, env, ctx);
      if (request.method === 'GET' && url.pathname.startsWith('/api/pm/directory/')) return await pmDirectory(env, decodeURIComponent(url.pathname.slice('/api/pm/directory/'.length)));
      if (request.method === 'POST' && url.pathname === '/api/pm/send') return await sendPm(request, env);
      if (request.method === 'GET' && url.pathname === '/api/pm/inbox') return await listPm(request, env);
      if (url.pathname.startsWith('/api/pm/messages/')) {
        const id = decodeURIComponent(url.pathname.slice('/api/pm/messages/'.length));
        if (request.method === 'GET') return await readPm(request, env, id);
        if (request.method === 'DELETE') return await ackPm(request, env, id);
      }
    } catch (error) {
      if (url.pathname.startsWith('/api/pm/')) return pmJson({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 500);
      throw error;
    }

    if (request.method === 'GET' && url.pathname === '/api/system-mailboxes') {
      return json({
        ok: true,
        schema: MAIL_SCHEMA,
        addresses: SYSTEM_MAILBOXES.map(local => `${local}@${domain}`),
        credentials: 'bootstrap-password-supported',
        lowTrafficPolicy: LOW_TRAFFIC_POLICY,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/worker-interval') {
      const input = await request.clone().json().catch(() => ({}));
      const intervalMs = recommendedWorkerInterval(input);
      return json({ ok: true, mode: trafficMode(input), intervalMs });
    }

    if (request.method === 'POST' && url.pathname === '/api/claim') {
      return json({ ok: false, error: 'Public @civweave.cc mailboxes are not part of the free messaging identity. Paid mail uses a separate entitlement-gated claim flow.' }, 403);
    }

    const requestMailbox = localPartFromAddress(request.headers.get('x-civweave-mailbox'), domain);
    if (requestMailbox) await ensureSystemMailbox(env, requestMailbox);
    if (isPmLocalPart(requestMailbox)) return json({ ok: false, error: 'Hidden _pm transport identities cannot use public mail APIs.' }, 403);

    return baseWorker.fetch(request, env, ctx);
  },

  async email(message, env, ctx) {
    const domain = clean(env.MAIL_DOMAIN || MAIL_DOMAIN, 255).toLowerCase();
    const recipient = localPartFromAddress(message.to, domain);
    if (isPmLocalPart(recipient)) {
      message.setReject('This Civweave address is an internal private-messaging transport identity and cannot receive internet email.');
      return;
    }
    if (recipient) await ensureSystemMailbox(env, recipient);
    return baseWorker.email(message, env, ctx);
  },
};

export default worker;
