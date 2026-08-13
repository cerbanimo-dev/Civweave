import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { handleStripeSnapshotWebhook } from '../cloudflare/core/src/stripe-snapshot-webhook.mjs';

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql.replace(/\s+/g, ' ').trim(); this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() {
    if (this.sql.includes('FROM stripe_events WHERE event_id=?1')) return this.db.rows.get(this.args[0]) || null;
    throw new Error(`Unhandled first SQL: ${this.sql}`);
  }
  async run() {
    if (this.sql.startsWith('INSERT OR IGNORE INTO stripe_events')) {
      const [eventId, eventType, livemode, payloadJson, receivedAt] = this.args;
      if (this.db.rows.has(eventId)) return { meta: { changes: 0 } };
      this.db.rows.set(eventId, {
        event_id: eventId,
        event_type: eventType,
        livemode,
        payload_json: payloadJson,
        received_at: receivedAt,
        processing_state: 'received',
        processing_attempts: 0,
        processing_error: null,
        last_attempt_at: null,
        processed_at: null
      });
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("SET processing_state='processing'")) {
      const [lastAttemptAt, eventId, staleBefore] = this.args;
      const row = this.db.rows.get(eventId);
      if (!row) return { meta: { changes: 0 } };
      const claimable = ['received', 'error'].includes(row.processing_state)
        || (row.processing_state === 'processing' && (!row.last_attempt_at || row.last_attempt_at <= staleBefore));
      if (!claimable) return { meta: { changes: 0 } };
      row.processing_state = 'processing';
      row.processing_attempts += 1;
      row.last_attempt_at = lastAttemptAt;
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("SET processing_state='processed'")) {
      const [processedAt, lastAttemptAt, eventId] = this.args;
      const row = this.db.rows.get(eventId);
      row.processing_state = 'processed';
      row.processing_error = null;
      row.processed_at = processedAt;
      row.last_attempt_at = lastAttemptAt;
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("SET processing_state='error'")) {
      const [message, lastAttemptAt, eventId] = this.args;
      const row = this.db.rows.get(eventId);
      row.processing_state = 'error';
      row.processing_error = message;
      row.last_attempt_at = lastAttemptAt;
      row.processed_at = null;
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unhandled run SQL: ${this.sql}`);
  }
}
class FakeDB {
  constructor() { this.rows = new Map(); }
  prepare(sql) { return new FakeStatement(this, sql); }
}

const secret = 'whsec_retry_hardening_test';
const fixedNow = Date.parse('2026-08-11T21:00:00.000Z');
function signedRequest(event, now = fixedNow) {
  const raw = JSON.stringify(event);
  const timestamp = Math.floor(now / 1000);
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  return new Request('https://civweave-core.cerbanimo.workers.dev/api/money-edge/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': `t=${timestamp},v1=${signature}`, 'content-type': 'application/json' },
    body: raw
  });
}

const db = new FakeDB();
let calls = 0;
const edge = {
  provider: { mode: 'sandbox' },
  async handleProviderEvent() {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error('transient provider verification failure'), { status: 503 });
    return { applied: true };
  }
};
const env = { DB: db, STRIPE_CONNECT_WEBHOOK_SECRET: secret };
const event = { id: 'evt_retry_1', type: 'checkout.session.completed', livemode: false, data: { object: { id: 'cs_test_1', payment_status: 'paid' } } };

const first = await handleStripeSnapshotWebhook(signedRequest(event), env, { edge, now: () => fixedNow });
assert.equal(first.status, 503);
assert.equal(db.rows.get(event.id).processing_state, 'error');
assert.equal(db.rows.get(event.id).processing_attempts, 1);
assert.match(db.rows.get(event.id).processing_error, /transient provider verification failure/);

const retry = await handleStripeSnapshotWebhook(signedRequest(event, fixedNow + 1000), env, { edge, now: () => fixedNow + 1000 });
assert.equal(retry.status, 200);
assert.equal(db.rows.get(event.id).processing_state, 'processed');
assert.equal(db.rows.get(event.id).processing_attempts, 2);
assert.equal(db.rows.get(event.id).processing_error, null);
assert.equal(calls, 2, 'failed Stripe event must be reprocessed exactly once on retry');

const duplicate = await handleStripeSnapshotWebhook(signedRequest(event, fixedNow + 2000), env, { edge, now: () => fixedNow + 2000 });
assert.equal(duplicate.status, 200);
const duplicateBody = await duplicate.json();
assert.equal(duplicateBody.duplicate, true);
assert.equal(duplicateBody.processingState, 'processed');
assert.equal(calls, 2, 'processed duplicate must not reapply money state');

const inflightEvent = { id: 'evt_inflight_1', type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_test_1', amount_refunded: 100 } } };
db.rows.set(inflightEvent.id, {
  event_id: inflightEvent.id,
  event_type: inflightEvent.type,
  livemode: 0,
  payload_json: JSON.stringify(inflightEvent),
  received_at: new Date(fixedNow).toISOString(),
  processing_state: 'processing',
  processing_attempts: 1,
  processing_error: null,
  last_attempt_at: new Date(fixedNow).toISOString(),
  processed_at: null
});
const inflight = await handleStripeSnapshotWebhook(signedRequest(inflightEvent, fixedNow + 10_000), env, { edge, now: () => fixedNow + 10_000 });
const inflightBody = await inflight.json();
assert.equal(inflight.status, 200);
assert.equal(inflightBody.retryDeferred, true);
assert.equal(calls, 2, 'fresh in-flight duplicate must not execute concurrently');

const liveEvent = { ...event, id: 'evt_wrong_mode_1', livemode: true };
const wrongMode = await handleStripeSnapshotWebhook(signedRequest(liveEvent, fixedNow + 3000), env, { edge, now: () => fixedNow + 3000 });
assert.equal(wrongMode.status, 400);
assert.equal(db.rows.has(liveEvent.id), false, 'live event must fail closed while provider is sandbox');

console.log(JSON.stringify({
  ok: true,
  retryAfterFailure: true,
  duplicateIdempotency: true,
  concurrentDuplicateSuppression: true,
  providerModeFailClosed: true
}, null, 2));