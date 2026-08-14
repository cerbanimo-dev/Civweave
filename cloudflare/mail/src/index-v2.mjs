import PostalMime from 'postal-mime';
import { DurableObject } from 'cloudflare:workers';
import { EmailMessage } from 'cloudflare:email';
import { MAIL_CSS, MAIL_HTML, MAIL_JS } from './ui.mjs';

const enc = new TextEncoder();
export const MAIL_SCHEMA = 'civweave.mail.v2';
export const MAIL_DOMAIN = 'civweave.cc';
export const MAX_RAW_BYTES = 25 * 1024 * 1024;
const MAX_BODY_CHARS = 200_000;
const RECOVERY_CODE_COUNT = 8;
const SETUP_TTL_MS = 30 * 60 * 1000;
const RESERVED_LOCAL_PARTS = new Set(['abuse', 'admin', 'mailer-daemon', 'postmaster', 'recover', 'recovery', 'root', 'security', 'support']);
const noStore = { 'cache-control': 'no-store' };

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const stripCtl = (value, max = 4000) => clean(value, max).replace(/[\r\n\0]+/g, ' ');
const nowIso = () => new Date().toISOString();
const json = (value, status = 200) => Response.json(value, { status, headers: noStore });

function randomSecret(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
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
function normalizeLocalPart(value, { allowReserved = false } = {}) {
  const local = clean(value, 64).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,61}[a-z0-9])?$/.test(local) || local.includes('..')) throw Object.assign(new Error('Mailbox name must use 1–63 lowercase letters, numbers, dots, dashes, or underscores.'), { status: 400 });
  if (!allowReserved && RESERVED_LOCAL_PARTS.has(local)) throw Object.assign(new Error('That mailbox name is reserved for Civweave operations.'), { status: 409 });
  return local;
}
function parseAddress(value, domain, { allowReserved = true } = {}) {
  const raw = clean(value, 320).toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at <= 0 || raw.slice(at + 1) !== domain) throw Object.assign(new Error(`Address must be at ${domain}.`), { status: 400 });
  const tagged = raw.slice(0, at), base = tagged.split('+', 1)[0];
  const localPart = normalizeLocalPart(base, { allowReserved });
  return { localPart, address: `${localPart}@${domain}` };
}
function previewText(value) { return clean(String(value || '').replace(/\s+/g, ' '), 280); }
function safeDate(value) { const ms = Date.parse(value || ''); return Number.isFinite(ms) ? new Date(ms).toISOString() : nowIso(); }
function rawKeyFor(id) { const d = new Date(); return `raw/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${id}.eml`; }
function buildRawMessage({ from, to, subject, body, messageId }) {
  const safeSubject = stripCtl(subject, 240);
  const safeBody = String(body ?? '').slice(0, MAX_BODY_CHARS).replace(/\r?\n/g, '\r\n');
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${safeSubject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}@civweave.cc>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '', safeBody, '',
  ].join('\r\n');
}
async function makeRecoveryKit() {
  const accessKey = randomSecret(), recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomSecret());
  const accessHash = await sha256Hex(`civweave.mail-access.v1\n${accessKey}`);
  const recovery = await Promise.all(recoveryCodes.map(async code => ({ code, hash: await sha256Hex(`civweave.mail-recovery.v1\n${code}`) })));
  return { accessKey, accessHash, recoveryCodes, recovery };
}
function secretValid(value) { return /^[A-Za-z0-9_-]{40,200}$/.test(clean(value, 240)); }

export class CivweaveMailbox extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS account (
        id INTEGER PRIMARY KEY CHECK (id = 1), local_part TEXT NOT NULL UNIQUE,
        access_hash TEXT NOT NULL, setup_hash TEXT, setup_expires INTEGER,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS recovery_codes (hash TEXT PRIMARY KEY, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, folder TEXT NOT NULL, from_addr TEXT NOT NULL, to_addr TEXT NOT NULL,
        subject TEXT NOT NULL, preview TEXT NOT NULL, raw_key TEXT NOT NULL, received_at TEXT NOT NULL,
        unread INTEGER NOT NULL DEFAULT 1, attachment_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS messages_folder_time ON messages(folder, received_at DESC);
    `);
  }

  account() { return this.ctx.storage.sql.exec('SELECT * FROM account WHERE id = 1').toArray()[0] || null; }
  async exists() { return Boolean(this.account()); }

  async replaceKit(localPart, setupKey) {
    const kit = await makeRecoveryKit(), setupHash = await sha256Hex(`civweave.mail-setup.v1\n${setupKey}`), timestamp = nowIso(), expires = Date.now() + SETUP_TTL_MS;
    this.ctx.storage.sql.exec('DELETE FROM recovery_codes');
    for (const item of kit.recovery) this.ctx.storage.sql.exec('INSERT INTO recovery_codes(hash, created_at) VALUES(?, ?)', item.hash, timestamp);
    const existing = this.account();
    if (existing) this.ctx.storage.sql.exec('UPDATE account SET access_hash=?, setup_hash=?, setup_expires=?, updated_at=? WHERE id=1', kit.accessHash, setupHash, expires, timestamp);
    else this.ctx.storage.sql.exec('INSERT INTO account(id, local_part, access_hash, setup_hash, setup_expires, created_at, updated_at) VALUES(1, ?, ?, ?, ?, ?, ?)', localPart, kit.accessHash, setupHash, expires, timestamp, timestamp);
    return Object.freeze({ address: `${localPart}@${MAIL_DOMAIN}`, accessKey: kit.accessKey, recoveryCodes: kit.recoveryCodes, recoveryKitPending: true });
  }

  async claim(localPart, setupKey) {
    if (!secretValid(setupKey)) throw Object.assign(new Error('Mailbox setup key is invalid.'), { status: 400 });
    const existing = this.account(), setupHash = await sha256Hex(`civweave.mail-setup.v1\n${setupKey}`);
    if (existing) {
      if (!existing.setup_hash || Number(existing.setup_expires) <= Date.now() || !constantEqual(existing.setup_hash, setupHash)) throw Object.assign(new Error('That Civweave Mail address is already claimed.'), { status: 409 });
      return this.replaceKit(existing.local_part, setupKey);
    }
    return this.replaceKit(localPart, setupKey);
  }

  async authenticate(accessKey) {
    const record = this.account();
    if (!record || !secretValid(accessKey)) throw Object.assign(new Error('Mail access key is invalid.'), { status: 401 });
    const hash = await sha256Hex(`civweave.mail-access.v1\n${accessKey}`);
    if (!constantEqual(hash, record.access_hash)) throw Object.assign(new Error('Mail access key is invalid.'), { status: 401 });
    return record;
  }

  async acknowledgeKit(accessKey) {
    await this.authenticate(accessKey);
    this.ctx.storage.sql.exec('UPDATE account SET setup_hash=NULL, setup_expires=NULL, updated_at=? WHERE id=1', nowIso());
    return Object.freeze({ ok: true, acknowledged: true });
  }

  async recover(recoveryCode, setupKey) {
    if (!secretValid(recoveryCode) || !secretValid(setupKey)) throw Object.assign(new Error('Recovery code or setup key is invalid.'), { status: 400 });
    const record = this.account();
    if (!record) throw Object.assign(new Error('Mailbox does not exist.'), { status: 404 });
    const hash = await sha256Hex(`civweave.mail-recovery.v1\n${recoveryCode}`), row = this.ctx.storage.sql.exec('SELECT hash FROM recovery_codes WHERE hash=?', hash).toArray()[0];
    if (!row) throw Object.assign(new Error('Recovery code is invalid or already used.'), { status: 401 });
    return this.replaceKit(record.local_part, setupKey);
  }

  async list(accessKey, folder = 'inbox', limit = 60) {
    await this.authenticate(accessKey);
    const safeFolder = folder === 'sent' ? 'sent' : 'inbox', safeLimit = Math.max(1, Math.min(100, Number(limit) || 60));
    return this.ctx.storage.sql.exec('SELECT id,folder,from_addr AS "from",to_addr AS "to",subject,preview,received_at AS receivedAt,unread,attachment_count AS attachmentCount FROM messages WHERE folder=? ORDER BY received_at DESC LIMIT ?', safeFolder, safeLimit).toArray().map(row => ({ ...row, unread: Boolean(row.unread) }));
  }

  async message(accessKey, id) {
    await this.authenticate(accessKey);
    const row = this.ctx.storage.sql.exec('SELECT id,folder,from_addr AS "from",to_addr AS "to",subject,preview,raw_key AS rawKey,received_at AS receivedAt,unread,attachment_count AS attachmentCount FROM messages WHERE id=?', clean(id, 120)).toArray()[0];
    if (!row) throw Object.assign(new Error('Message not found.'), { status: 404 });
    if (row.folder === 'inbox' && row.unread) this.ctx.storage.sql.exec('UPDATE messages SET unread=0 WHERE id=?', row.id);
    return { ...row, unread: false };
  }

  async deliver(meta) {
    if (!this.account()) throw Object.assign(new Error('Mailbox does not exist.'), { status: 404 });
    this.ctx.storage.sql.exec('INSERT OR IGNORE INTO messages(id,folder,from_addr,to_addr,subject,preview,raw_key,received_at,unread,attachment_count) VALUES(?,\'inbox\',?,?,?,?,?,?,1,?)', meta.id, meta.from, meta.to, meta.subject, meta.preview, meta.rawKey, meta.receivedAt, Number(meta.attachmentCount) || 0);
    return { ok: true };
  }

  async recordSent(accessKey, meta) {
    await this.authenticate(accessKey);
    this.ctx.storage.sql.exec('INSERT OR IGNORE INTO messages(id,folder,from_addr,to_addr,subject,preview,raw_key,received_at,unread,attachment_count) VALUES(?,\'sent\',?,?,?,?,?,?,0,?)', meta.id, meta.from, meta.to, meta.subject, meta.preview, meta.rawKey, meta.receivedAt, Number(meta.attachmentCount) || 0);
    return { ok: true };
  }
}

function mailboxAuth(request, env) {
  const domain = clean(env.MAIL_DOMAIN || MAIL_DOMAIN, 255).toLowerCase();
  const parsed = parseAddress(request.headers.get('x-civweave-mailbox'), domain);
  const header = clean(request.headers.get('authorization'), 1000), match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error('Mail access key is required.'), { status: 401 });
  return { ...parsed, accessKey: clean(match[1], 400), box: env.MAILBOX.getByName(parsed.localPart), domain };
}
function claimNodeId(token) {
  const value = clean(token, 500), dot = value.indexOf('.');
  if (dot < 1) throw Object.assign(new Error('Hub mail claim token is invalid.'), { status: 400 });
  const nodeId = value.slice(0, dot).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!nodeId) throw Object.assign(new Error('Hub mail claim token is invalid.'), { status: 400 });
  return nodeId;
}
async function consumeHubClaim(env, claimToken) {
  if (!env.ACCOUNT_EDGE?.fetch) throw Object.assign(new Error('Hub claim verifier is unavailable.'), { status: 503 });
  const nodeId = claimNodeId(claimToken);
  const response = await env.ACCOUNT_EDGE.fetch(`https://civweave-host-edge.internal/nodes/${encodeURIComponent(nodeId)}/api/account/mail/claim/consume`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-civweave-node-id': nodeId }, body: JSON.stringify({ claimToken: clean(claimToken, 500) }),
  });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok || packet?.ok !== true) throw Object.assign(new Error(packet.error || 'Hub mail claim was not accepted.'), { status: response.status || 403 });
}
async function parseStoredMessage(env, meta) {
  const object = await env.MAIL_BLOBS.get(meta.rawKey);
  if (!object) throw Object.assign(new Error('Stored message body is unavailable.'), { status: 410 });
  const raw = await object.arrayBuffer(), parsed = await PostalMime.parse(raw);
  return { ...meta, text: String(parsed.text || '').slice(0, 2_000_000), attachmentCount: Array.isArray(parsed.attachments) ? parsed.attachments.length : meta.attachmentCount, attachments: (parsed.attachments || []).slice(0, 50).map(item => ({ filename: stripCtl(item.filename || 'attachment', 240), mimeType: clean(item.mimeType, 180), size: item.content?.byteLength || 0 })) };
}
async function storeRaw(env, id, raw) {
  const rawKey = rawKeyFor(id);
  await env.MAIL_BLOBS.put(rawKey, raw, { httpMetadata: { contentType: 'message/rfc822' }, customMetadata: { schema: MAIL_SCHEMA } });
  return rawKey;
}
function contentResponse(body, type) {
  return new Response(body, { headers: { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" } });
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url), domain = clean(env.MAIL_DOMAIN || MAIL_DOMAIN, 255).toLowerCase();
    try {
      if (request.method === 'GET' && url.pathname === '/') return contentResponse(MAIL_HTML, 'text/html; charset=utf-8');
      if (request.method === 'GET' && url.pathname === '/mail.css') return contentResponse(MAIL_CSS, 'text/css; charset=utf-8');
      if (request.method === 'GET' && url.pathname === '/mail.js') return contentResponse(MAIL_JS, 'text/javascript; charset=utf-8');
      if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, schema: MAIL_SCHEMA, domain, internalDelivery: true, externalOutbound: Boolean(env.EMAIL?.send) && clean(env.EXTERNAL_OUTBOUND, 40) === 'enabled' });

      if (request.method === 'POST' && url.pathname === '/api/claim') {
        const input = await request.json().catch(() => ({})), localPart = normalizeLocalPart(input.localPart), setupKey = clean(input.setupKey, 240), claimToken = clean(input.claimToken, 500);
        if (!secretValid(setupKey)) throw Object.assign(new Error('Mailbox setup key is invalid.'), { status: 400 });
        await consumeHubClaim(env, claimToken);
        const packet = await env.MAILBOX.getByName(localPart).claim(localPart, setupKey);
        return json({ ok: true, ...packet });
      }

      if (request.method === 'POST' && url.pathname === '/api/recover') {
        const input = await request.json().catch(() => ({})), localPart = normalizeLocalPart(input.localPart);
        const packet = await env.MAILBOX.getByName(localPart).recover(clean(input.recoveryCode, 240), clean(input.setupKey, 240));
        return json({ ok: true, ...packet });
      }

      if (request.method === 'POST' && url.pathname === '/api/recovery-kit/ack') {
        const auth = mailboxAuth(request, env);
        return json(await auth.box.acknowledgeKit(auth.accessKey));
      }

      if (request.method === 'GET' && url.pathname === '/api/messages') {
        const auth = mailboxAuth(request, env), folder = url.searchParams.get('folder') === 'sent' ? 'sent' : 'inbox';
        return json({ ok: true, address: auth.address, folder, messages: await auth.box.list(auth.accessKey, folder) });
      }

      if (request.method === 'GET' && url.pathname.startsWith('/api/messages/')) {
        const auth = mailboxAuth(request, env), id = decodeURIComponent(url.pathname.slice('/api/messages/'.length));
        return json({ ok: true, message: await parseStoredMessage(env, await auth.box.message(auth.accessKey, id)) });
      }

      if (request.method === 'POST' && url.pathname === '/api/send') {
        const auth = mailboxAuth(request, env), input = await request.json().catch(() => ({}));
        await auth.box.authenticate(auth.accessKey);
        const toRaw = clean(input.to, 320).toLowerCase(), subject = stripCtl(input.subject, 240), body = String(input.body ?? '').slice(0, MAX_BODY_CHARS);
        if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(toRaw) || toRaw.length > 254 || !body.trim()) throw Object.assign(new Error('A valid recipient and message body are required.'), { status: 400 });
        const id = crypto.randomUUID(), receivedAt = nowIso(), from = auth.address, raw = buildRawMessage({ from, to: toRaw, subject, body, messageId: id });
        const at = toRaw.lastIndexOf('@'), recipientDomain = at > 0 ? toRaw.slice(at + 1) : '';
        if (recipientDomain === domain) {
          const recipient = parseAddress(toRaw, domain), recipientBox = env.MAILBOX.getByName(recipient.localPart);
          if (!await recipientBox.exists()) throw Object.assign(new Error('That Civweave Mail address does not exist.'), { status: 404 });
          const rawKey = await storeRaw(env, id, raw);
          const meta = { id, from, to: recipient.address, subject, preview: previewText(body), rawKey, receivedAt, attachmentCount: 0 };
          try {
            await recipientBox.deliver(meta);
          } catch (error) {
            await env.MAIL_BLOBS.delete(rawKey);
            throw error;
          }
          try {
            await auth.box.recordSent(auth.accessKey, meta);
          } catch (error) {
            console.error(JSON.stringify({ event: 'civweave-mail-sent-copy-error', id, error: String(error?.message || error) }));
            return json({ ok: true, external: false, id, sentCopy: false });
          }
          return json({ ok: true, external: false, id, sentCopy: true });
        }
        if (!env.EMAIL?.send || clean(env.EXTERNAL_OUTBOUND, 40) !== 'enabled') throw Object.assign(new Error('External outbound mail is not enabled yet. Civweave-to-Civweave mail works now.'), { status: 503 });
        const rawKey = await storeRaw(env, id, raw);
        const meta = { id, from, to: toRaw, subject, preview: previewText(body), rawKey, receivedAt, attachmentCount: 0 };
        try {
          await env.EMAIL.send(new EmailMessage(from, toRaw, raw));
        } catch (error) {
          await env.MAIL_BLOBS.delete(rawKey);
          throw error;
        }
        try {
          await auth.box.recordSent(auth.accessKey, meta);
        } catch (error) {
          console.error(JSON.stringify({ event: 'civweave-mail-sent-copy-error', id, external: true, error: String(error?.message || error) }));
          return json({ ok: true, external: true, id, sentCopy: false });
        }
        return json({ ok: true, external: true, id, sentCopy: true });
      }

      return json({ ok: false, error: 'not-found' }, 404);
    } catch (error) {
      console.error(JSON.stringify({ event: 'civweave-mail-http-error', error: String(error?.message || error) }));
      return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 500);
    }
  },

  async email(message, env) {
    const domain = clean(env.MAIL_DOMAIN || MAIL_DOMAIN, 255).toLowerCase();
    try {
      if (Number(message.rawSize) > MAX_RAW_BYTES) { message.setReject('Message is too large for Civweave Mail.'); return; }
      const recipient = parseAddress(message.to, domain), box = env.MAILBOX.getByName(recipient.localPart);
      if (!await box.exists()) { message.setReject('Civweave Mailbox does not exist.'); return; }
      const raw = await new Response(message.raw).arrayBuffer(), parsed = await PostalMime.parse(raw), id = crypto.randomUUID(), rawKey = await storeRaw(env, id, raw);
      const text = parsed.text || String(parsed.html || '').replace(/<[^>]*>/g, ' '), receivedAt = safeDate(parsed.date), subject = stripCtl(parsed.subject || message.headers.get('subject') || '', 240);
      await box.deliver({ id, from: clean(message.from || parsed.from?.address || '', 320).toLowerCase(), to: recipient.address, subject, preview: previewText(text), rawKey, receivedAt, attachmentCount: Array.isArray(parsed.attachments) ? parsed.attachments.length : 0 });
    } catch (error) {
      console.error(JSON.stringify({ event: 'civweave-mail-inbound-error', error: String(error?.message || error), to: clean(message.to, 320) }));
      message.setReject('Civweave Mail could not accept this message.');
    }
  },
};

export default worker;
