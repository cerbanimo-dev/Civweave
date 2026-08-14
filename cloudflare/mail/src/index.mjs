import { DurableObject } from 'cloudflare:workers';
import PostalMime from 'postal-mime';

export const CIVWEAVE_MAIL_SCHEMA = 'civweave.mail.v1';
export const CIVWEAVE_MAIL_DOMAIN = 'civweave.cc';
export const CIVWEAVE_MAIL_MAX_MESSAGE_BYTES = 5 * 1024 * 1024;
export const CIVWEAVE_MAIL_RECOVERY_CODE_COUNT = 8;

const enc = new TextEncoder();
const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const jsonHeaders = Object.freeze({
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
});
const mailboxPattern = /^cw-[a-f0-9]{24}$/;
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const pendingTtlMs = 24 * 60 * 60 * 1000;

function b64url(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
function randomToken(bytes = 32) { return b64url(crypto.getRandomValues(new Uint8Array(bytes))); }
function randomMailboxLocal() {
  return `cw-${[...crypto.getRandomValues(new Uint8Array(12))].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function credentialHash(value) {
  return sha256Hex(`civweave.mail-credential.v1\n${clean(value, 400)}`);
}
async function recoveryHash(value) {
  return sha256Hex(`civweave.mail-recovery-code.v1\n${clean(value, 400)}`);
}
function safeEqual(a, b) {
  const left = enc.encode(String(a || ''));
  const right = enc.encode(String(b || ''));
  if (left.byteLength !== right.byteLength) return !crypto.subtle.timingSafeEqual(left, left);
  return crypto.subtle.timingSafeEqual(left, right);
}
function normalizeLocal(value) {
  const local = clean(value, 80).toLowerCase();
  if (!mailboxPattern.test(local)) throw Object.assign(new Error('Mailbox address is invalid.'), { status: 400 });
  return local;
}
function normalizeAddress(value) {
  const address = clean(value, 320).toLowerCase();
  const [local, domain, extra] = address.split('@');
  if (extra !== undefined || domain !== CIVWEAVE_MAIL_DOMAIN || !mailboxPattern.test(local || '')) {
    throw Object.assign(new Error('Civweave mailbox address is invalid.'), { status: 400 });
  }
  return `${local}@${domain}`;
}
function normalizeRecipient(value) {
  const address = clean(value, 320);
  if (!emailPattern.test(address) || address.length > 254) throw Object.assign(new Error('Recipient email is invalid.'), { status: 400 });
  return address;
}
function stripHtml(value) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
function messageKey(id) { return `message:${clean(id, 80)}`; }
function indexKey(timestamp, id) { return `index:${String(timestamp).padStart(16, '0')}:${clean(id, 80)}`; }
function publicAccount(account) {
  return Object.freeze({
    schema: CIVWEAVE_MAIL_SCHEMA,
    address: account.address,
    createdAt: account.createdAt,
    recoveryAcknowledged: Boolean(account.recoveryAcknowledgedAt),
    recoveryAcknowledgedAt: account.recoveryAcknowledgedAt || null,
    recoveryCodesRemaining: Array.isArray(account.recoveryHashes) ? account.recoveryHashes.length : 0,
  });
}
function summary(record) {
  return Object.freeze({
    id: record.id,
    direction: record.direction,
    from: record.from,
    to: record.to,
    subject: record.subject,
    preview: clean(record.text, 180),
    receivedAt: record.receivedAt || null,
    sentAt: record.sentAt || null,
    read: Boolean(record.readAt),
    attachmentCount: Array.isArray(record.attachments) ? record.attachments.length : 0,
  });
}
function statusError(message, status = 400, code = 'MAIL_ERROR') {
  return Object.assign(new Error(message), { status, code });
}

export class CivweaveMailbox extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
  }

  async account() { return this.ctx.storage.get('account'); }

  async exists() { return Boolean(await this.account()); }

  async initialize(address) {
    if (await this.account()) throw statusError('Mailbox already exists.', 409, 'MAILBOX_EXISTS');
    const normalized = normalizeAddress(address);
    const credential = randomToken(32);
    const recoveryCodes = Array.from({ length: CIVWEAVE_MAIL_RECOVERY_CODE_COUNT }, () => randomToken(32));
    const now = Date.now();
    const account = Object.freeze({
      schema: CIVWEAVE_MAIL_SCHEMA,
      address: normalized,
      credentialHash: await credentialHash(credential),
      recoveryHashes: await Promise.all(recoveryCodes.map(code => recoveryHash(code))),
      recoveryAcknowledgedAt: null,
      createdAt: new Date(now).toISOString(),
      pendingExpiresAt: new Date(now + pendingTtlMs).toISOString(),
    });
    await this.ctx.storage.put('account', account);
    await this.ctx.storage.setAlarm(now + pendingTtlMs);
    return Object.freeze({ account: publicAccount(account), credential, recoveryCodes, acknowledgementRequired: true });
  }

  async authorize(credential) {
    const account = await this.account();
    if (!account) throw statusError('Mailbox does not exist.', 404, 'MAILBOX_NOT_FOUND');
    const supplied = await credentialHash(credential);
    if (!safeEqual(supplied, account.credentialHash)) throw statusError('Mailbox credential is invalid.', 401, 'MAILBOX_UNAUTHORIZED');
    return account;
  }

  async profile(credential) {
    return publicAccount(await this.authorize(credential));
  }

  async acknowledgeRecovery(credential) {
    const account = await this.authorize(credential);
    const next = Object.freeze({ ...account, recoveryAcknowledgedAt: account.recoveryAcknowledgedAt || new Date().toISOString(), pendingExpiresAt: null });
    await this.ctx.storage.put('account', next);
    await this.ctx.storage.deleteAlarm();
    return publicAccount(next);
  }

  async reissueRecovery(credential) {
    const account = await this.authorize(credential);
    if (account.recoveryAcknowledgedAt) throw statusError('Recovery kit is already confirmed.', 409, 'RECOVERY_ALREADY_ACKNOWLEDGED');
    const recoveryCodes = Array.from({ length: CIVWEAVE_MAIL_RECOVERY_CODE_COUNT }, () => randomToken(32));
    const now = Date.now();
    const next = Object.freeze({
      ...account,
      recoveryHashes: await Promise.all(recoveryCodes.map(code => recoveryHash(code))),
      pendingExpiresAt: new Date(now + pendingTtlMs).toISOString(),
    });
    await this.ctx.storage.put('account', next);
    await this.ctx.storage.setAlarm(now + pendingTtlMs);
    return Object.freeze({ account: publicAccount(next), recoveryCodes, acknowledgementRequired: true });
  }

  async recover(code) {
    const account = await this.account();
    if (!account?.recoveryAcknowledgedAt) throw statusError('Mailbox recovery is not established.', 409, 'RECOVERY_NOT_READY');
    const candidate = await recoveryHash(code);
    const hashes = Array.isArray(account.recoveryHashes) ? account.recoveryHashes : [];
    const index = hashes.findIndex(hash => safeEqual(candidate, hash));
    if (index < 0) throw statusError('Recovery code is invalid or already used.', 401, 'RECOVERY_CODE_INVALID');
    const credential = randomToken(32);
    const nextHashes = hashes.filter((_, position) => position !== index);
    const next = Object.freeze({ ...account, credentialHash: await credentialHash(credential), recoveryHashes: nextHashes, lastRecoveredAt: new Date().toISOString() });
    await this.ctx.storage.put('account', next);
    return Object.freeze({ account: publicAccount(next), credential, recoveryMethod: 'offline-code' });
  }

  async receive(input) {
    const account = await this.account();
    if (!account?.recoveryAcknowledgedAt) return false;
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const record = Object.freeze({
      schema: CIVWEAVE_MAIL_SCHEMA,
      id,
      direction: 'inbound',
      from: clean(input.from, 320),
      to: account.address,
      subject: clean(input.subject || '(no subject)', 998),
      text: clean(input.text, 1_000_000),
      attachments: Array.isArray(input.attachments) ? input.attachments.slice(0, 32) : [],
      messageId: clean(input.messageId, 998) || null,
      receivedAt: new Date(timestamp).toISOString(),
      sentAt: null,
      readAt: null,
      rawSize: Math.max(0, Number(input.rawSize || 0)),
    });
    const key = indexKey(timestamp, id);
    await this.ctx.storage.put({ [messageKey(id)]: { ...record, indexKey: key }, [key]: summary(record) });
    return true;
  }

  async recordSent(credential, input) {
    const account = await this.authorize(credential);
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const record = Object.freeze({
      schema: CIVWEAVE_MAIL_SCHEMA,
      id,
      direction: 'sent',
      from: account.address,
      to: clean(input.to, 320),
      subject: clean(input.subject || '(no subject)', 998),
      text: clean(input.text, 1_000_000),
      attachments: [],
      messageId: clean(input.messageId, 998) || null,
      receivedAt: null,
      sentAt: new Date(timestamp).toISOString(),
      readAt: new Date(timestamp).toISOString(),
      rawSize: 0,
    });
    const key = indexKey(timestamp, id);
    await this.ctx.storage.put({ [messageKey(id)]: { ...record, indexKey: key }, [key]: summary(record) });
    return summary(record);
  }

  async listMessages(credential, limit = 50) {
    await this.authorize(credential);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const rows = await this.ctx.storage.list({ prefix: 'index:', reverse: true, limit: safeLimit });
    return [...rows.values()];
  }

  async getMessage(credential, id) {
    await this.authorize(credential);
    const record = await this.ctx.storage.get(messageKey(id));
    if (!record) throw statusError('Message not found.', 404, 'MESSAGE_NOT_FOUND');
    return Object.freeze({ ...record, indexKey: undefined });
  }

  async markRead(credential, id) {
    await this.authorize(credential);
    const record = await this.ctx.storage.get(messageKey(id));
    if (!record) throw statusError('Message not found.', 404, 'MESSAGE_NOT_FOUND');
    if (record.readAt) return summary(record);
    const next = Object.freeze({ ...record, readAt: new Date().toISOString() });
    await this.ctx.storage.put({ [messageKey(id)]: next, [record.indexKey]: summary(next) });
    return summary(next);
  }

  async deleteMessage(credential, id) {
    await this.authorize(credential);
    const record = await this.ctx.storage.get(messageKey(id));
    if (!record) return false;
    await this.ctx.storage.delete([messageKey(id), record.indexKey]);
    return true;
  }

  async alarm() {
    const account = await this.account();
    if (!account || account.recoveryAcknowledgedAt) return;
    if (Date.parse(account.pendingExpiresAt || 0) > Date.now()) {
      await this.ctx.storage.setAlarm(Date.parse(account.pendingExpiresAt));
      return;
    }
    await this.ctx.storage.deleteAll();
  }
}

function mailboxLocalFromAddress(address) {
  const normalized = clean(address, 320).toLowerCase();
  const [local, domain, extra] = normalized.split('@');
  if (extra !== undefined || domain !== CIVWEAVE_MAIL_DOMAIN || !mailboxPattern.test(local || '')) return '';
  return local;
}
function mailboxStub(env, local) {
  return env.MAILBOXES.getByName(normalizeLocal(local));
}
function authFrom(request) {
  const mailbox = mailboxLocalFromAddress(request.headers.get('x-civweave-mailbox') || '');
  const match = clean(request.headers.get('authorization'), 500).match(/^Bearer\s+([A-Za-z0-9_-]{40,200})$/i);
  if (!mailbox || !match) throw statusError('Mailbox authentication is required.', 401, 'MAILBOX_AUTH_REQUIRED');
  return { local: mailbox, credential: match[1] };
}
function responseJson(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: jsonHeaders });
}
function errorResponse(error) {
  const status = Number.isSafeInteger(error?.status) ? error.status : 500;
  return responseJson({ ok: false, error: clean(error?.message || error, 1200) || 'Mail service error.', code: clean(error?.code, 120) || 'MAIL_ERROR' }, status);
}
function attachmentMetadata(attachment) {
  const content = attachment?.content;
  const size = typeof content === 'string' ? Math.ceil(content.length * 0.75) : Number(content?.byteLength || 0);
  return Object.freeze({
    filename: clean(attachment?.filename || 'attachment', 260),
    mimeType: clean(attachment?.mimeType || 'application/octet-stream', 160),
    disposition: clean(attachment?.disposition || 'attachment', 40),
    contentId: clean(attachment?.contentId, 260) || null,
    size,
    stored: false,
  });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return responseJson({ ok: true, schema: CIVWEAVE_MAIL_SCHEMA, domain: CIVWEAVE_MAIL_DOMAIN, webOrigin: 'https://mail.civweave.cc' });
  }
  if (request.method === 'GET' && url.pathname === '/api/capabilities') {
    return responseJson({ ok: true, receive: true, send: Boolean(env.EMAIL?.send), maxInboundBytes: CIVWEAVE_MAIL_MAX_MESSAGE_BYTES, attachmentStorage: 'metadata-only-v1' });
  }
  if (request.method === 'POST' && url.pathname === '/api/signup') {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const local = randomMailboxLocal();
      const stub = mailboxStub(env, local);
      if (await stub.exists()) continue;
      const result = await stub.initialize(`${local}@${CIVWEAVE_MAIL_DOMAIN}`);
      return responseJson({ ok: true, ...result }, 201);
    }
    throw statusError('Could not allocate a mailbox. Try again.', 503, 'MAILBOX_ALLOCATION_BUSY');
  }
  if (request.method === 'POST' && url.pathname === '/api/recover') {
    const body = await request.json().catch(() => ({}));
    const local = mailboxLocalFromAddress(body.address || '');
    if (!local) throw statusError('Civweave mailbox address is invalid.', 400, 'MAILBOX_ADDRESS_INVALID');
    return responseJson({ ok: true, ...(await mailboxStub(env, local).recover(clean(body.code, 400))) });
  }

  const auth = authFrom(request);
  const stub = mailboxStub(env, auth.local);
  if (request.method === 'GET' && url.pathname === '/api/me') return responseJson({ ok: true, account: await stub.profile(auth.credential) });
  if (request.method === 'POST' && url.pathname === '/api/recovery/ack') return responseJson({ ok: true, account: await stub.acknowledgeRecovery(auth.credential) });
  if (request.method === 'POST' && url.pathname === '/api/recovery/reissue') return responseJson({ ok: true, ...(await stub.reissueRecovery(auth.credential)) });
  if (request.method === 'GET' && url.pathname === '/api/messages') return responseJson({ ok: true, messages: await stub.listMessages(auth.credential, url.searchParams.get('limit')) });
  const messageMatch = url.pathname.match(/^\/api\/messages\/([A-Za-z0-9-]{8,80})$/);
  if (messageMatch && request.method === 'GET') return responseJson({ ok: true, message: await stub.getMessage(auth.credential, messageMatch[1]) });
  if (messageMatch && request.method === 'DELETE') return responseJson({ ok: true, deleted: await stub.deleteMessage(auth.credential, messageMatch[1]) });
  const readMatch = url.pathname.match(/^\/api\/messages\/([A-Za-z0-9-]{8,80})\/read$/);
  if (readMatch && request.method === 'POST') return responseJson({ ok: true, message: await stub.markRead(auth.credential, readMatch[1]) });
  if (request.method === 'POST' && url.pathname === '/api/send') {
    if (!env.EMAIL?.send) throw statusError('Outbound Civweave Mail is not enabled on this Cloudflare account yet.', 503, 'MAIL_SEND_UNAVAILABLE');
    const body = await request.json().catch(() => ({}));
    const account = await stub.profile(auth.credential);
    const to = normalizeRecipient(body.to);
    const subject = clean(body.subject || '(no subject)', 998);
    const text = clean(body.text, 100_000);
    if (!text) throw statusError('Message body is required.', 400, 'MESSAGE_BODY_REQUIRED');
    let result;
    try {
      result = await env.EMAIL.send({ to, from: account.address, replyTo: account.address, subject, text });
    } catch (error) {
      const code = clean(error?.code, 120) || 'MAIL_SEND_FAILED';
      const status = code === 'E_RATE_LIMIT_EXCEEDED' || code === 'E_DAILY_LIMIT_EXCEEDED' ? 429 : 502;
      throw statusError(clean(error?.message || 'Cloudflare Email Service rejected the message.', 1200), status, code);
    }
    const sent = await stub.recordSent(auth.credential, { to, subject, text, messageId: result?.messageId });
    return responseJson({ ok: true, messageId: result?.messageId || null, message: sent }, 201);
  }
  return responseJson({ ok: false, error: 'not-found' }, 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env);
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Civweave Mail', { status: 200 });
    } catch (error) {
      console.error(JSON.stringify({ event: 'civweave-mail-http-error', message: clean(error?.message || error, 1200), code: clean(error?.code, 120) || null }));
      return errorResponse(error);
    }
  },

  async email(message, env) {
    const local = mailboxLocalFromAddress(message.to);
    if (!local) {
      message.setReject('Unknown Civweave mailbox.');
      return;
    }
    if (Number(message.rawSize || 0) > CIVWEAVE_MAIL_MAX_MESSAGE_BYTES) {
      message.setReject('Civweave Mail v1 accepts messages up to 5 MiB.');
      return;
    }
    try {
      const parsed = await PostalMime.parse(message.raw, {
        attachmentEncoding: 'base64',
        maxNestingDepth: 64,
        maxHeadersSize: 256 * 1024,
      });
      const stored = await mailboxStub(env, local).receive({
        from: message.from,
        subject: parsed.subject || message.headers.get('subject') || '(no subject)',
        text: parsed.text || stripHtml(parsed.html || ''),
        messageId: parsed.messageId || message.headers.get('message-id') || null,
        rawSize: message.rawSize,
        attachments: (parsed.attachments || []).map(attachmentMetadata),
      });
      if (!stored) message.setReject('Mailbox is not ready to receive mail.');
    } catch (error) {
      console.error(JSON.stringify({ event: 'civweave-mail-inbound-error', to: message.to, message: clean(error?.message || error, 1200) }));
      message.setReject('Civweave Mail could not safely parse this message.');
    }
  },
};
