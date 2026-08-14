const enc = new TextEncoder();

export const ACCOUNT_DIRECTORY_SCHEMA = 'civweave.account-directory.v1';
const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const PROOF_TTL_MS = 15 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const nowIso = now => new Date(now).toISOString();
function b64url(bytes) { const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); let binary = ''; for (const byte of data) binary += String.fromCharCode(byte); return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, ''); }
function randomToken(bytes = 32) { return b64url(crypto.getRandomValues(new Uint8Array(bytes))); }
function randomCode() { const bytes = crypto.getRandomValues(new Uint32Array(1)); return String(bytes[0] % 1_000_000).padStart(6, '0'); }
async function sha256Hex(value) { const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value))); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
function normalizeEmail(value) { const email = clean(value, 320).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw Object.assign(new TypeError('Enter a valid recovery email.'), { status: 400 }); return email; }
function normalizeLocator(value = {}) {
  let origin; try { origin = new URL(clean(value.origin, 1000)); } catch { throw Object.assign(new TypeError('Hub locator is invalid.'), { status: 400 }); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw Object.assign(new TypeError('Hub locator is invalid.'), { status: 400 });
  const nodeId = clean(value.nodeId, 180).toLowerCase(), accountId = clean(value.accountId, 180), accountName = clean(value.accountName, 64).toLowerCase();
  if (!/^[a-z0-9-]{1,120}$/.test(nodeId) || !/^hubacct:[A-Za-z0-9-]{16,180}$/.test(accountId) || !/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(accountName)) throw Object.assign(new TypeError('Hub locator is invalid.'), { status: 400 });
  return Object.freeze({ origin: origin.origin, nodeId, accountId, accountName });
}
function json(payload, status = 200) { return Response.json(payload, { status, headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } }); }
function emailKey(hash) { return `email:${hash}`; }
function challengeKey(hash) { return `challenge:${hash}`; }
function proofKey(hash) { return `proof:${hash}`; }
function rateKey(hash) { return `rate:${hash}`; }
async function mailer(env, message) {
  if (!env?.CERBANIMO_MAIL || typeof env.CERBANIMO_MAIL.sendRecovery !== 'function') throw Object.assign(new Error('Cerbanimo recovery mail is not configured.'), { status: 503 });
  try { const packet = await env.CERBANIMO_MAIL.sendRecovery(message); if (!packet?.ok) throw new Error(packet?.error || 'Cerbanimo mail did not confirm delivery.'); return packet; }
  catch (error) { throw Object.assign(new Error(error?.message || 'Cerbanimo recovery mail could not send.'), { status: Number.isSafeInteger(error?.status) ? error.status : 502 }); }
}

export class CivweaveAccountDirectory {
  constructor(state, env) { this.state = state; this.env = env || {}; }
  async begin(input = {}) {
    const email = normalizeEmail(input.email), emailHash = await sha256Hex(`civweave.account-directory.email.v1\n${email}`), rate = await this.state.storage.get(rateKey(emailHash)), now = Date.now();
    if (rate && now - Number(rate.at || 0) < RATE_WINDOW_MS) return Object.freeze({ ok: true, accepted: true, challengeToken: clean(rate.challengeToken, 400), message: 'Check that address for the next step.' });
    const challengeToken = randomToken(32), code = randomCode(), tokenHash = await sha256Hex(`civweave.account-directory.challenge.v1\n${challengeToken}`), codeHash = await sha256Hex(`civweave.account-directory.code.v1\n${challengeToken}\n${code}`);
    await this.state.storage.put({ [challengeKey(tokenHash)]: Object.freeze({ schema: ACCOUNT_DIRECTORY_SCHEMA, email, emailHash, codeHash, purpose: clean(input.purpose, 80) || 'recovery-email', createdAt: nowIso(now), expiresAt: now + CHALLENGE_TTL_MS }), [rateKey(emailHash)]: Object.freeze({ at: now, challengeToken, expiresAt: now + RATE_WINDOW_MS }) });
    await mailer(this.env, { to: email, subject: 'Your Civweave account verification code', text: `Your Civweave verification code is: ${code}\n\nEnter this code in Civweave. If you did not request this, you can ignore this message.`, html: `<p>Your Civweave verification code is:</p><p><strong style="font-size:24px;letter-spacing:.16em">${code}</strong></p><p>Enter this code in Civweave. If you did not request this, you can ignore this message.</p>`, purpose: 'account-link-or-recovery' });
    return Object.freeze({ ok: true, accepted: true, challengeToken, message: 'Check that address for the next step.' });
  }
  async verify(input = {}) {
    const challengeToken = clean(input.challengeToken, 400), code = clean(input.code, 40).replace(/\s+/g, '');
    if (!/^[A-Za-z0-9_-]{40,200}$/.test(challengeToken) || !/^\d{6}$/.test(code)) throw Object.assign(new Error('Verification code is invalid or expired.'), { status: 400 });
    const key = challengeKey(await sha256Hex(`civweave.account-directory.challenge.v1\n${challengeToken}`)), challenge = await this.state.storage.get(key);
    if (!challenge || Number(challenge.expiresAt) <= Date.now()) { if (challenge) await this.state.storage.delete(key); throw Object.assign(new Error('Verification code is invalid or expired.'), { status: 400 }); }
    const expected = await sha256Hex(`civweave.account-directory.code.v1\n${challengeToken}\n${code}`); if (expected !== challenge.codeHash) throw Object.assign(new Error('Verification code is invalid or expired.'), { status: 400 });
    await this.state.storage.delete(key); await this.state.storage.delete(rateKey(challenge.emailHash));
    const locator = await this.state.storage.get(emailKey(challenge.emailHash)) || null, proofToken = randomToken(32), proofHash = await sha256Hex(`civweave.account-directory.proof.v1\n${proofToken}`);
    await this.state.storage.put(proofKey(proofHash), Object.freeze({ schema: ACCOUNT_DIRECTORY_SCHEMA, email: challenge.email, emailHash: challenge.emailHash, existing: Boolean(locator), locator, createdAt: nowIso(Date.now()), expiresAt: Date.now() + PROOF_TTL_MS, consumedAt: null }));
    return Object.freeze({ ok: true, verified: true, proofToken, email: challenge.email, existing: Boolean(locator), locator });
  }
  async proof(token) {
    const value = clean(token, 400); if (!/^[A-Za-z0-9_-]{40,200}$/.test(value)) throw Object.assign(new Error('Email proof is invalid or expired.'), { status: 400 });
    const key = proofKey(await sha256Hex(`civweave.account-directory.proof.v1\n${value}`)), record = await this.state.storage.get(key);
    if (!record || record.consumedAt || Number(record.expiresAt) <= Date.now()) { if (record && Number(record.expiresAt) <= Date.now()) await this.state.storage.delete(key); throw Object.assign(new Error('Email proof is invalid or expired.'), { status: 400 }); }
    return { key, record, token: value };
  }
  async claim(input = {}) {
    const { key, record, token } = await this.proof(input.proofToken), current = await this.state.storage.get(emailKey(record.emailHash)) || null;
    if (current) return Object.freeze({ ok: true, existing: true, locator: current, proofToken: token, email: record.email });
    const locator = normalizeLocator(input.locator), now = Date.now();
    await this.state.storage.put({ [emailKey(record.emailHash)]: locator, [key]: Object.freeze({ ...record, existing: false, locator, consumedAt: nowIso(now) }) });
    return Object.freeze({ ok: true, existing: false, locator, email: record.email });
  }
  async consume(input = {}) {
    const { key, record } = await this.proof(input.proofToken), locator = await this.state.storage.get(emailKey(record.emailHash)) || record.locator || null;
    if (!locator) throw Object.assign(new Error('Verified recovery address is not linked to an online account.'), { status: 409 });
    await this.state.storage.put(key, Object.freeze({ ...record, existing: true, locator, consumedAt: nowIso(Date.now()) }));
    return Object.freeze({ ok: true, verified: true, existing: true, locator, email: record.email });
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
    if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
    const input = await request.json().catch(() => ({}));
    try {
      if (url.pathname.endsWith('/begin')) return json(await this.begin(input));
      if (url.pathname.endsWith('/verify')) return json(await this.verify(input));
      if (url.pathname.endsWith('/claim')) return json(await this.claim(input));
      if (url.pathname.endsWith('/consume')) return json(await this.consume(input));
      return json({ ok: false, error: 'Not found.' }, 404);
    } catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 500); }
  }
}
