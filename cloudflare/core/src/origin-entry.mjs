import core, { CivweaveCoreIdentity, launchTopology as baseLaunchTopology } from './charterkeeper-entry-v1.mjs';

export { CivweaveCoreIdentity };

export const CANONICAL_CIVWEAVE_INSTALL_ORIGIN = 'https://civweave.cc';

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

function retiredCommerceHostFee() {
  return json({
    schema: 'civweave.fellowfare-payment-boundary.v1',
    ok: false,
    code: 'commerce-host-fee-retired',
    message: 'FellowFare no longer charges or distributes a marketplace commerce host fee. Goods use seller-direct payment; services and learning use Acorn/Button fulfillment.'
  }, 410);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/launch-topology') {
      return json(launchTopologyFor(env));
    }
    if (url.pathname === '/api/commerce/host-fee/policy' || url.pathname === '/api/commerce/host-fee/quote') {
      return retiredCommerceHostFee();
    }
    return core.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    return core.scheduled?.(controller, env, ctx);
  }
};