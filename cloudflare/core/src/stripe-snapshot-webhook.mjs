import { verifyStripeWebhook } from './index.mjs';
import { CloudflareMoneyEdge, moneyEdgeError } from './money-edge-with-memberships.mjs';

export const STRIPE_SNAPSHOT_WEBHOOK_PATHS = Object.freeze(new Set([
  '/api/money-edge/webhooks/stripe',
  '/api/stripe/webhook'
]));

const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const changes = result => Number(result?.meta?.changes ?? result?.changes ?? 0);
const iso = value => new Date(value).toISOString();
const json = (value, status = 200) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

async function receipt(env, eventId) {
  return env.DB.prepare(`SELECT event_id,event_type,livemode,processing_state,processing_attempts,
    processing_error,last_attempt_at,processed_at,received_at
    FROM stripe_events WHERE event_id=?1`).bind(eventId).first();
}

async function claimReceipt(env, eventId, now) {
  const at = iso(now);
  const staleBefore = iso(now - 5 * 60 * 1000);
  const result = await env.DB.prepare(`UPDATE stripe_events
    SET processing_state='processing',
        processing_attempts=processing_attempts+1,
        last_attempt_at=?1
    WHERE event_id=?2
      AND (
        processing_state IN ('received','error')
        OR (processing_state='processing' AND (last_attempt_at IS NULL OR last_attempt_at<=?3))
      )`)
    .bind(at, eventId, staleBefore).run();
  return changes(result) === 1;
}

export async function handleStripeSnapshotWebhook(request, env, {
  edge = null,
  now = () => Date.now()
} = {}) {
  const moneyEdge = edge || new CloudflareMoneyEdge(env);
  const rawBody = await request.text();
  const verification = await verifyStripeWebhook({
    rawBody,
    signatureHeader: request.headers.get('stripe-signature'),
    secret: env.STRIPE_CONNECT_WEBHOOK_SECRET,
    now: now()
  });
  if (!verification.ok) return json({ ok: false, error: verification.reason }, 400);

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return json({ ok: false, error: 'invalid-json' }, 400); }
  if (!event?.id || !event?.type) return json({ ok: false, error: 'stripe-event-missing-id-or-type' }, 400);

  const mode = moneyEdge.provider.mode;
  if ((mode === 'live' && !event.livemode) || (mode === 'sandbox' && event.livemode)) {
    return json({ ok: false, error: 'stripe-event-mode-mismatch' }, 400);
  }

  const receivedAt = iso(now());
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO stripe_events
    (event_id,event_type,livemode,payload_json,received_at,processing_state,processing_attempts,last_attempt_at,processed_at,processing_error)
    VALUES(?1,?2,?3,?4,?5,'received',0,NULL,NULL,NULL)`)
    .bind(clean(event.id, 180), clean(event.type, 180), event.livemode ? 1 : 0, rawBody, receivedAt).run();

  if (changes(inserted) === 0) {
    const existing = await receipt(env, event.id);
    if (existing?.processing_state === 'processed' && !existing.processing_error) {
      return json({ ok: true, duplicate: true, received: event.id, processingState: 'processed' });
    }
  }

  if (!await claimReceipt(env, event.id, now())) {
    const existing = await receipt(env, event.id);
    return json({
      ok: true,
      duplicate: true,
      received: event.id,
      processingState: existing?.processing_state || 'unknown',
      retryDeferred: existing?.processing_state === 'processing'
    });
  }

  try {
    const result = await moneyEdge.handleProviderEvent(event);
    const processedAt = iso(now());
    await env.DB.prepare(`UPDATE stripe_events
      SET processing_state='processed',processing_error=NULL,processed_at=?1,last_attempt_at=?2
      WHERE event_id=?3`)
      .bind(processedAt, processedAt, event.id).run();
    return json({ ok: true, received: event.id, result });
  } catch (error) {
    const failedAt = iso(now());
    await env.DB.prepare(`UPDATE stripe_events
      SET processing_state='error',processing_error=?1,last_attempt_at=?2,processed_at=NULL
      WHERE event_id=?3`)
      .bind(clean(error?.message || error), failedAt, event.id).run().catch(() => {});
    const safe = moneyEdgeError(error);
    return json(safe.body, safe.status);
  }
}