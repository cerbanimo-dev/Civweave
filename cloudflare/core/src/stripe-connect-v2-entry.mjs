import liveCore from './live-entry.mjs';
import { CloudflareMoneyEdge } from './money-edge-with-memberships.mjs';
import { handleStripeConnectV2Sample } from './stripe-connect-v2-sample.mjs';
import { handleStripeSnapshotWebhook, STRIPE_SNAPSHOT_WEBHOOK_PATHS } from './stripe-snapshot-webhook.mjs';
import {
  handleStripeRecipientThinWebhook,
  STRIPE_RECIPIENT_THIN_CANONICAL_PATH,
  STRIPE_RECIPIENT_THIN_WEBHOOK_PATH
} from './stripe-recipient-thin-webhook.mjs';

// Marketplace seller-payment processing is intentionally disabled. Stripe remains
// available for node memberships, reserve payouts, and other non-marketplace rails.
// Existing commerce webhook settlement code stays reachable through the money edge
// so already-started legacy payments can finish/refund safely, but no new marketplace
// checkout or connected-recipient route is exposed here.
export * from './live-entry.mjs';
export * from './stripe-connect-v2-sample.mjs';
export * from './stripe-snapshot-webhook.mjs';
export * from './stripe-recipient-thin-webhook.mjs';

const enabled = value => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
const marketplacePaymentsDisabled = () => new Response(JSON.stringify({
  schema: 'civweave.fellowfare-payment-boundary.v1',
  ok: false,
  code: 'marketplace-checkout-disabled',
  message: 'FellowFare does not collect or route seller payments. Goods use seller-direct payment; services and learning use Acorn/Button fulfillment.'
}, null, 2), {
  status: 410,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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

    // Everything interactive stays sealed unless a sandbox opts in explicitly.
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
