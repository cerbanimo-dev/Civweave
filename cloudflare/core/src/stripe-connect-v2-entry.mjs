import liveCore from './live-entry.mjs';
import { handleStripeConnectV2Sample } from './stripe-connect-v2-sample.mjs';

// Keep the existing money-edge router intact and layer the documented Stripe
// Connect V2 sample on top. A sample route returns null when it doesn't match,
// so all existing Civweave core endpoints continue through liveCore unchanged.
export * from './live-entry.mjs';
export * from './stripe-connect-v2-sample.mjs';

export default {
  async fetch(request, env, ctx) {
    const sample = await handleStripeConnectV2Sample(request, env);
    if (sample) return sample;
    return liveCore.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    return liveCore.scheduled(controller, env, ctx);
  }
};
