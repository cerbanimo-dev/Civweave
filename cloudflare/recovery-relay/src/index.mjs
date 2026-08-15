import { EmailMessage } from 'cloudflare:email';

const enc = new TextEncoder();
const PROOF_TTL_MS = 24 * 60 * 60 * 1000;
const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const nowIso = now => new Date(now).toISOString();
const json = (value, status = 200) => Response.json(value, {
  status,
  headers: {
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  },
});

function normalizeEmail(value) {
  const email = clean(value, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new TypeError('Email address is invalid.');
  return email;
}
function recoveryMailbox(value) {
  const email = normalizeEmail(value);
  if (!/^recover@recovery\.[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('@recovery.commonweave.earth')) {
    throw new TypeError('Recovery mailbox is not an approved Civweave recovery address.');
  }
  return email;
}
function normalizeToken(value) {
  const token = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(token)) throw new TypeError('Recovery proof token is invalid.');
  return token;
}
function normalizePurpose(value) {
  const purpose = clean(value, 40);
  if (!['verify-email', 'recover-account'].includes(purpose)) throw new TypeError('Recovery proof purpose is invalid.');
  return purpose;
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function tokenHash(token) { return sha256Hex(`civweave.recovery-relay-token.v1\n${normalizeToken(token)}`); }
async function emailHash(email) { return sha256Hex(`civweave.hub-inbound-email-address.v1\n${normalizeEmail(email)}`); }
function proofKey(hash) { return `proof:${clean(hash, 128)}`; }
function parseSubject(value) {
  const match = clean(value, 500).match(/^Civweave (?:Guild|Hub) (verify-email|recover-account) ([A-Za-z0-9_-]{40,200})$/);
  return match ? Object.freeze({ purpose: match[1], token: match[2] }) : null;
}
function replyMime(from, to) {
  return [
    `From: Civweave Recovery <${from}>`,
    `To: ${to}`,
    'Subject: Civweave recovery email received',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    'Civweave received and authenticated your recovery proof email.',
    'Return to Civweave and paste the one-time code from the message you sent.',
    '',
    'The recovery relay stores no Guild resident ID, Passport ID, payment data, or message body.',
  ].join('\r\n');
}

export class CivweaveRecoveryProofRelay {
  constructor(state, env) { this.state = state; this.env = env; }

  async scheduleCleanup(deadline) {
    if (!this.state.storage.getAlarm || !this.state.storage.setAlarm) return;
    const current = await this.state.storage.getAlarm();
    if (current == null || current > deadline) await this.state.storage.setAlarm(deadline);
  }

  async approve(input = {}) {
    const token = normalizeToken(input.token), purpose = normalizePurpose(input.purpose), sender = normalizeEmail(input.from);
    const now = Date.now(), expires = now + PROOF_TTL_MS, hash = await tokenHash(token), key = proofKey(hash);
    const prior = await this.state.storage.get(key);
    const proof = Object.freeze({
      schema: 'civweave.recovery-proof-relay.v1',
      tokenHash: hash,
      purpose,
      emailHash: await emailHash(sender),
      approvedAt: prior?.approvedAt || nowIso(now),
      expiresAt: nowIso(expires),
    });
    await this.state.storage.put(key, proof);
    await this.scheduleCleanup(expires);
    return Object.freeze({ ok: true, approved: true, purpose, expiresAt: proof.expiresAt });
  }

  async status(token) {
    const key = proofKey(await tokenHash(token)), proof = await this.state.storage.get(key), now = Date.now();
    if (!proof) return Object.freeze({ ok: true, approved: false });
    if (Date.parse(proof.expiresAt) <= now) {
      await this.state.storage.delete(key);
      return Object.freeze({ ok: true, approved: false });
    }
    return Object.freeze({
      ok: true,
      approved: true,
      schema: proof.schema,
      purpose: proof.purpose,
      emailHash: proof.emailHash,
      approvedAt: proof.approvedAt,
      expiresAt: proof.expiresAt,
    });
  }

  async alarm() {
    const now = Date.now(), rows = await this.state.storage.list({ prefix: 'proof:' });
    let next = null;
    for (const [key, proof] of rows) {
      const expiry = Date.parse(proof?.expiresAt || 0);
      if (!Number.isFinite(expiry) || expiry <= now) await this.state.storage.delete(key);
      else if (next == null || expiry < next) next = expiry;
    }
    if (next != null && this.state.storage.setAlarm) await this.state.storage.setAlarm(next);
  }

  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/approve') return json(await this.approve(await request.json().catch(() => ({}))));
      if (request.method === 'POST' && url.pathname === '/status') return json(await this.status((await request.json().catch(() => ({}))).token));
      return json({ ok: false, error: 'not-found' }, 404);
    } catch (error) {
      return json({ ok: false, error: String(error?.message || error) }, 400);
    }
  }
}

function relayStub(env) { return env.PROOFS.get(env.PROOFS.idFromName('global')); }
async function callRelay(env, path, input) {
  const response = await relayStub(env).fetch(`https://relay.internal/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input || {}),
  });
  const packet = await response.json().catch(() => ({}));
  return json(packet, response.status);
}

async function handleEmail(message, env) {
  // The exact Cloudflare Email Routing rule is the authority for which inbox
  // may invoke this Worker. Validate the shape too, so an accidentally broad
  // future rule cannot turn the relay into a generic mailbox processor.
  const to = recoveryMailbox(message.to || '');
  const parsed = parseSubject(message.headers.get('subject') || '');
  if (!parsed) { message.setReject('Invalid Civweave recovery proof subject.'); return; }
  const from = normalizeEmail(message.from || '');

  // Cloudflare's Email Worker reply gate requires an authenticated incoming
  // sender. Only after a successful reply do we persist the sender proof.
  await message.reply(new EmailMessage(to, from, replyMime(to, from)));
  const response = await relayStub(env).fetch('https://relay.internal/approve', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...parsed, from }),
  });
  if (!response.ok) throw new Error(`Recovery relay approval returned HTTP ${response.status}.`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/recovery-proof/')) return new Response(null, { status: 204, headers: json({}).headers });
    if (request.method === 'POST' && url.pathname === '/api/recovery-proof/status') return callRelay(env, 'status', await request.json().catch(() => ({})));
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, schema: 'civweave.recovery-proof-relay.v1', mailboxMode: 'exact-email-routing-rule' });
    return json({ ok: false, error: 'not-found' }, 404);
  },
  async email(message, env) {
    try { await handleEmail(message, env); }
    catch (error) {
      console.error('Civweave recovery relay email failed', String(error?.message || error));
      try { message.setReject('Civweave could not authenticate this recovery proof.'); } catch {}
    }
  },
};
