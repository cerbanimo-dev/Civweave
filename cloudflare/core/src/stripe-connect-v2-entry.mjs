import liveCore from './live-entry.mjs';
import { handleStripeConnectV2Sample } from './stripe-connect-v2-sample.mjs';
import { handleStripeSnapshotWebhook, STRIPE_SNAPSHOT_WEBHOOK_PATHS } from './stripe-snapshot-webhook.mjs';
import {
  handleStripeRecipientThinWebhook,
  STRIPE_RECIPIENT_THIN_CANONICAL_PATH,
  STRIPE_RECIPIENT_THIN_WEBHOOK_PATH
} from './stripe-recipient-thin-webhook.mjs';

// Keep the existing money-edge router intact and layer the documented Stripe
// Connect V2 sample on top. Interactive sample/admin routes are deliberately OFF
// in production unless STRIPE_CONNECT_SAMPLE_ENABLED=true. Both Stripe webhooks
// remain server-to-server and signature-protected.
export * from './live-entry.mjs';
export * from './stripe-connect-v2-sample.mjs';
export * from './stripe-snapshot-webhook.mjs';
export * from './stripe-recipient-thin-webhook.mjs';

const enabled = value => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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
