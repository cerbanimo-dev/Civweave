import liveCore from './live-entry.mjs';
import { CloudflareMoneyEdge } from './money-edge-with-memberships.mjs';
import { handleStripeConnectV2Sample } from './stripe-connect-v2-sample.mjs';
import { handleFellowFareDirectCommerce } from './fellowfare-direct-commerce-v1.mjs';
import { handleStripeSnapshotWebhook, STRIPE_SNAPSHOT_WEBHOOK_PATHS } from './stripe-snapshot-webhook.mjs';
import {
  handleStripeRecipientThinWebhook,
  STRIPE_RECIPIENT_THIN_CANONICAL_PATH,
  STRIPE_RECIPIENT_THIN_WEBHOOK_PATH
} from './stripe-recipient-thin-webhook.mjs';

// FellowFare has two deliberately different USD boundaries:
// 1. physical/community goods never enter a Civweave seller-payment rail;
// 2. services, learning, and tutoring may use Stripe Connect direct charges where
//    the connected provider is merchant of record and FellowFare receives only an
//    application fee. Civweave never collects the gross and then transfers proceeds.
// Existing legacy marketplace settlement remains reachable only through webhook
// recovery so already-started historical payments can finish/refund safely.
export * from './live-entry.mjs';
export * from './stripe-connect-v2-sample.mjs';
export * from './fellowfare-direct-commerce-v1.mjs';
export * from './stripe-snapshot-webhook.mjs';
export * from './stripe-recipient-thin-webhook.mjs';

const enabled = value => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
const marketplacePaymentsDisabled = () => new Response(JSON.stringify({
  schema: 'civweave.fellowfare-payment-boundary.v2',
  ok: false,
  code: 'marketplace-checkout-disabled',
  message: 'FellowFare does not collect or route physical-goods seller payments. Services, learning, and tutoring use fulfillment burn and/or connected-merchant Stripe direct charges.'
}, null, 2), {
  status: 410,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/fellowfare/direct-commerce/')) {
      const direct = await handleFellowFareDirectCommerce(request, env);
      if (direct) return direct;
    }

    // The retired platform-charge/separate-transfer marketplace route remains dead.
    // Do not use this path for the new direct-charge service/learning rail.
    if (url.pathname.startsWith('/api/money-edge/commerce/')) {
      return marketplacePaymentsDisabled();
    }

    // Route the connected-account snapshot payment webhook through the hardened
    // receipt state machine so failed processing can be retried safely instead of
    // being mistaken for an already-processed duplicate.
    if (request.method === 'POST' && STRIPE_SNAPSHOT_WEBHOOK_PATHS.has(url.pathname)) {
      return handleStripeSnapshotWebhook(request, env);
    }

    // New production destinations use the canonical money-edge route.
    if (request.method === 'POST' && url.pathname === STRIPE_RECIPIENT_THIN_CANONICAL_PATH) {
      return handleStripeRecipientThinWebhook(request, env);
    }

    // Preserve the old demo-shaped URL temporarily so any already-created event
    // destination keeps working while production migrates to the canonical path.
    if (request.method === 'POST' && url.pathname === STRIPE_RECIPIENT_THIN_WEBHOOK_PATH) {
      return handleStripeRecipientThinWebhook(request, env);
    }

    // Everything interactive in the old generic sample stays sealed unless a
    // sandbox opts in explicitly. FellowFare's direct-commerce endpoints above are
    // the production integration and retain their own live-money gate.
    if (enabled(env?.STRIPE_CONNECT_SAMPLE_ENABLED)) {
      const sample = await handleStripeConnectV2Sample(request, env);
      if (sample) return sample;
    }
    return liveCore.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    return liveCore.scheduled(controller, env, ctx);
  }
};
