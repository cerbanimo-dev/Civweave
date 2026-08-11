import liveCore from './live-entry.mjs';
import { handleStripeConnectV2Sample } from './stripe-connect-v2-sample.mjs';

// Keep the existing money-edge router intact and layer the documented Stripe
// Connect V2 sample on top. The sample is deliberately OFF in production unless
// STRIPE_CONNECT_SAMPLE_ENABLED=true is set for a sandbox/test deployment. That
// prevents a public Worker URL from becoming an unauthenticated Stripe admin UI.
export * from './live-entry.mjs';
export * from './stripe-connect-v2-sample.mjs';

const enabled = value => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

export default {
  async fetch(request, env, ctx) {
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
