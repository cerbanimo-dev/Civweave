import liveCore from './live-entry.mjs';
import { handleStripeConnectV2Sample } from './stripe-connect-v2-sample.mjs';

// Keep the existing money-edge router intact and layer the documented Stripe
// Connect V2 sample on top. Interactive sample/admin routes are deliberately OFF
// in production unless STRIPE_CONNECT_SAMPLE_ENABLED=true. The thin webhook is
// different: it is server-to-server, verifies Stripe's signature, and must remain
// reachable so requirements/capability changes can arrive without exposing the UI.
export * from './live-entry.mjs';
export * from './stripe-connect-v2-sample.mjs';

const enabled = value => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
const THIN_WEBHOOK_PATH = '/api/connect-demo/webhooks/stripe-thin';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Always route the signed thin webhook. The handler itself requires both the
    // Stripe secret key and STRIPE_CONNECT_THIN_WEBHOOK_SECRET and rejects an
    // invalid/missing Stripe-Signature before processing an event.
    if (request.method === 'POST' && url.pathname === THIN_WEBHOOK_PATH) {
      const webhook = await handleStripeConnectV2Sample(request, env);
      if (webhook) return webhook;
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
