import Stripe from 'stripe';

export const STRIPE_RECIPIENT_THIN_WEBHOOK_PATH = '/api/money-edge/webhooks/stripe-connect';
export const STRIPE_RECIPIENT_THIN_WEBHOOK_PATHS = new Set([
  STRIPE_RECIPIENT_THIN_WEBHOOK_PATH,
  '/api/connect-demo/webhooks/stripe-thin'
]);
export const STRIPE_RECIPIENT_THIN_EVENTS = Object.freeze([
  'v2.core.account[requirements].updated',
  'v2.core.account[configuration.recipient].capability_status_updated'
]);

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const iso = () => new Date().toISOString();
const json = (value, status = 200) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

function required(value, label, max = 4000) {
  const out = clean(value, max);
  if (!out) throw Object.assign(new TypeError(`${label} is required.`), { status: 400 });
  return out;
}

function stripeClient(env, fetchImpl = globalThis.fetch) {
  const secretKey = clean(env?.STRIPE_SECRET_KEY, 10000);
  if (!secretKey) {
    throw Object.assign(new Error('Stripe platform credential is not configured.'), { status: 503 });
  }
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(fetchImpl),
    appInfo: { name: 'Civweave Recipient Capability Watcher', version: '1' }
  });
}

function dbFor(env) {
  if (!env?.DB) throw Object.assign(new Error('Civweave D1 binding DB is required for Stripe recipient events.'), { status: 503 });
  return env.DB;
}

async function markThinEvent(env, eventId, eventType, accountId) {
  const result = await dbFor(env).prepare(`INSERT OR IGNORE INTO stripe_connect_thin_events(event_id,event_type,account_id,received_at)
    VALUES(?1,?2,?3,?4)`)
    .bind(required(eventId, 'eventId', 180), required(eventType, 'eventType', 220), clean(accountId, 180) || null, iso()).run();
  return Number(result?.meta?.changes ?? result?.changes ?? 0) === 1;
}

export async function retrieveRecipientStatus(client, accountId) {
  const account = await client.v2.core.accounts.retrieve(required(accountId, 'accountId', 180), {
    include: ['configuration.recipient', 'requirements']
  });
  const stripeTransfersStatus = clean(
    account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status || 'unknown',
    80
  ).toLowerCase();
  const requirementsStatus = clean(account?.requirements?.summary?.minimum_deadline?.status, 80) || null;
  return Object.freeze({
    accountId: account.id,
    accountModel: 'recipient',
    readyToReceiveTransfers: stripeTransfersStatus === 'active',
    stripeTransfersStatus,
    requirementsStatus,
    onboardingComplete: requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due',
    requirements: account.requirements || null
  });
}

export async function handleStripeRecipientThinWebhook(request, env, { fetchImpl = globalThis.fetch } = {}) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method-not-allowed' }, 405);

  const webhookSecret = clean(env?.STRIPE_CONNECT_THIN_WEBHOOK_SECRET, 10000);
  if (!webhookSecret) return json({ ok: false, error: 'stripe-recipient-thin-webhook-secret-not-configured' }, 503);

  const signature = clean(request.headers.get('stripe-signature'), 4000);
  if (!signature) return json({ ok: false, error: 'stripe-signature-missing' }, 400);

  const client = stripeClient(env, fetchImpl);
  const rawBody = await request.text();

  let notification;
  let event;
  try {
    notification = await client.parseEventNotificationAsync(rawBody, signature, webhookSecret);
    event = await notification.fetchEvent();
  } catch (error) {
    console.warn(JSON.stringify({ source: 'stripe-recipient-thin', verificationFailed: true, error: clean(error?.message || error, 500) }));
    return json({ ok: false, error: 'stripe-thin-event-verification-failed' }, 400);
  }

  const eventId = clean(event?.id, 180);
  const eventType = clean(event?.type, 220);
  const accountId = clean(notification?.related_object?.id || event?.related_object?.id, 180) || null;
  if (!eventId || !eventType) return json({ ok: false, error: 'stripe-thin-event-missing-id-or-type' }, 400);

  const firstSeen = await markThinEvent(env, eventId, eventType, accountId);
  if (!firstSeen) return json({ ok: true, received: true, duplicate: true, eventId, type: eventType, accountId });

  if (!STRIPE_RECIPIENT_THIN_EVENTS.includes(eventType)) {
    return json({ ok: true, received: true, ignored: true, eventId, type: eventType, accountId });
  }
  if (!accountId) return json({ ok: false, error: 'stripe-thin-event-missing-related-account', eventId, type: eventType }, 400);

  const updatedCapability = clean(event?.data?.updated_capability, 180) || null;
  const status = await retrieveRecipientStatus(client, accountId);
  console.log(JSON.stringify({
    source: 'stripe-recipient-thin',
    eventId,
    type: eventType,
    accountId,
    updatedCapability,
    readyToReceiveTransfers: status.readyToReceiveTransfers,
    stripeTransfersStatus: status.stripeTransfersStatus,
    requirementsStatus: status.requirementsStatus
  }));
  return json({ ok: true, received: true, eventId, type: eventType, accountId, updatedCapability, status });
}
