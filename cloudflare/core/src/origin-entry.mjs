import core, { CivweaveCoreIdentity, launchTopology as baseLaunchTopology } from './index.mjs';
import { COMMERCE_HOST_FEE_SCHEMA, splitCommerceHostFee, assertCommerceHostFeeConservation } from './commerce-node-fees.mjs';

export { CivweaveCoreIdentity };

export const CANONICAL_CIVWEAVE_INSTALL_ORIGIN = 'https://civweave.pages.dev';

const json = (value, status = 200) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

export function launchTopologyFor(env = {}) {
  return Object.freeze({
    ...baseLaunchTopology,
    canonicalInstallOrigin: String(env.CIVWEAVE_CANONICAL_INSTALL_ORIGIN || CANONICAL_CIVWEAVE_INSTALL_ORIGIN),
    platformFeeBps: Number(env.CIVWEAVE_PLATFORM_FEE_BPS || baseLaunchTopology.platformFeeBps || 500)
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/launch-topology') {
      return json(launchTopologyFor(env));
    }
    if (request.method === 'GET' && url.pathname === '/api/commerce/host-fee/policy') {
      return json({
        schema: COMMERCE_HOST_FEE_SCHEMA,
        oneHostFeeMaximum: true,
        sameNode: '100-percent-single-host',
        crossNode: '50-50-buyer-seller-home-hosts',
        singleParticipatingHost: '100-percent-participating-host',
        noParticipatingHost: 'system-retained',
        relayNodesEligible: false,
        feeRateDefinedBy: 'checkout-policy'
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/commerce/host-fee/quote') {
      try {
        const input = await request.json();
        return json(assertCommerceHostFeeConservation(splitCommerceHostFee(input)));
      } catch (error) {
        return json({ error: String(error?.message || error) }, 400);
      }
    }
    return core.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    return core.scheduled?.(controller, env, ctx);
  }
};
