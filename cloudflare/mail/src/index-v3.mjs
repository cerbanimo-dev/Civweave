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

export const SYSTEM_MAILBOXES = Object.freeze([
  'weaveling',
  'moss',
  'kamiya',
  'rook',
  'merlin',
]);
const SYSTEM_LOCAL_PARTS = new Set(SYSTEM_MAILBOXES);

const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });

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
function systemCredentialCandidate(value) {
  const candidate = clean(value, 240);
  return candidate.length >= 12 && candidate.length <= 200 && !/[\r\n\0]/.test(candidate);
}

export class CivweaveMailbox extends BaseCivweaveMailbox {
  constructor(ctx, env) {
    super(ctx, env);
    this.systemCtx = ctx;
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
}

async function ensureSystemMailbox(env, localPart) {
  const local = clean(localPart, 64).toLowerCase();
  if (!isSystemLocalPart(local)) return false;
  await env.MAILBOX.getByName(local).ensureSystem(local);
  return true;
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const domain = clean(env.MAIL_DOMAIN || MAIL_DOMAIN, 255).toLowerCase();

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
      const input = await request.clone().json().catch(() => ({}));
      if (isSystemLocalPart(input.localPart)) {
        return json({ ok: false, error: 'That address belongs to a Civweave system guide.' }, 409);
      }
    }

    const requestMailbox = localPartFromAddress(request.headers.get('x-civweave-mailbox'), domain);
    if (requestMailbox) await ensureSystemMailbox(env, requestMailbox);

    return baseWorker.fetch(request, env, ctx);
  },

  async email(message, env, ctx) {
    const domain = clean(env.MAIL_DOMAIN || MAIL_DOMAIN, 255).toLowerCase();
    const recipient = localPartFromAddress(message.to, domain);
    if (recipient) await ensureSystemMailbox(env, recipient);
    return baseWorker.email(message, env, ctx);
  },
};

export default worker;
