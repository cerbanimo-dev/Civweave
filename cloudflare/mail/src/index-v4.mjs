import PostalMime from 'postal-mime';
import pmWorker, {
  CivweaveMailbox as PmMailbox,
  SYSTEM_MAILBOXES,
} from './index-v3.mjs';

const enc = new TextEncoder();
const FEEDBACK_SCHEMA = 'civweave.feedback-mail-batch.v1';
const noStore = { 'cache-control': 'no-store' };
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200) => Response.json(value, { status, headers: noStore });

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
async function authorizeFeedback(request, env) {
  const expected = clean(env.FEEDBACK_BATCH_TOKEN, 400);
  if (!expected) throw Object.assign(new Error('Feedback batch feed is not configured.'), { status: 503 });
  const header = clean(request.headers.get('authorization'), 1000), match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error('Feedback batch authorization is required.'), { status: 401 });
  const [left, right] = await Promise.all([
    sha256Hex(`civweave.feedback-batch.v1\n${clean(match[1], 400)}`),
    sha256Hex(`civweave.feedback-batch.v1\n${expected}`),
  ]);
  if (!constantEqual(left, right)) throw Object.assign(new Error('Feedback batch authorization failed.'), { status: 403 });
}

export class CivweaveMailbox extends PmMailbox {
  constructor(ctx, env) {
    super(ctx, env);
    this.feedbackCtx = ctx;
    this.feedbackCtx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS feedback_batch_state (
        message_id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        batched_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS feedback_batch_time ON feedback_batch_state(batched_at DESC);
    `);
  }

  async feedbackRows(limit = 60) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 60));
    return this.feedbackCtx.storage.sql.exec(`
      SELECT m.id,m.subject,m.preview,m.raw_key AS rawKey,m.received_at AS receivedAt,m.attachment_count AS attachmentCount
      FROM messages m
      LEFT JOIN feedback_batch_state f ON f.message_id=m.id
      WHERE m.folder='inbox' AND f.message_id IS NULL
      ORDER BY m.received_at ASC
      LIMIT ?
    `, safeLimit).toArray();
  }

  async markFeedbackBatch(messageIds, batchId) {
    const timestamp = new Date().toISOString(), id = clean(batchId, 120);
    if (!id) throw Object.assign(new Error('Feedback batch id is required.'), { status: 400 });
    for (const value of Array.isArray(messageIds) ? messageIds : []) {
      const messageId = clean(value, 120);
      if (!messageId) continue;
      this.feedbackCtx.storage.sql.exec('INSERT OR REPLACE INTO feedback_batch_state(message_id,batch_id,batched_at) VALUES(?,?,?)', messageId, id, timestamp);
    }
    return { ok: true, batchId: id };
  }
}

async function feedbackBatch(request, env) {
  await authorizeFeedback(request, env);
  const items = [];
  for (const guide of SYSTEM_MAILBOXES) {
    const box = env.MAILBOX.getByName(guide);
    await box.ensureSystem(guide);
    const rows = await box.feedbackRows(60);
    for (const row of rows) {
      if (items.length >= 200) break;
      const object = await env.MAIL_BLOBS.get(row.rawKey);
      if (!object) continue;
      let parsed = {};
      try { parsed = await PostalMime.parse(await object.arrayBuffer()); } catch { parsed = {}; }
      const text = String(parsed.text || '').slice(0, 12000);
      items.push({
        id: row.id,
        guide,
        receivedAt: row.receivedAt,
        subject: clean(parsed.subject || row.subject, 240),
        text,
        preview: clean(row.preview, 500),
        attachmentCount: Number(row.attachmentCount) || 0,
        source: 'guide-mail',
      });
    }
  }
  return json({ ok: true, schema: FEEDBACK_SCHEMA, items, senderIdentityIncluded: false });
}

async function feedbackAck(request, env) {
  await authorizeFeedback(request, env);
  const input = await request.json().catch(() => ({})), batchId = clean(input.batchId, 120);
  const byGuide = new Map();
  for (const item of Array.isArray(input.items) ? input.items : []) {
    const guide = clean(item?.guide, 64).toLowerCase(), id = clean(item?.id, 120);
    if (!SYSTEM_MAILBOXES.includes(guide) || !id) continue;
    if (!byGuide.has(guide)) byGuide.set(guide, []);
    byGuide.get(guide).push(id);
  }
  for (const [guide, ids] of byGuide) await env.MAILBOX.getByName(guide).markFeedbackBatch(ids, batchId);
  return json({ ok: true, schema: FEEDBACK_SCHEMA, batchId, acknowledged: [...byGuide.values()].reduce((sum, ids) => sum + ids.length, 0) });
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/api/feedback/batch') return await feedbackBatch(request, env);
      if (request.method === 'POST' && url.pathname === '/api/feedback/ack') return await feedbackAck(request, env);
    } catch (error) {
      if (url.pathname.startsWith('/api/feedback/')) return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 500);
      throw error;
    }
    return pmWorker.fetch(request, env, ctx);
  },
  async email(message, env, ctx) {
    return pmWorker.email(message, env, ctx);
  },
};

export default worker;
