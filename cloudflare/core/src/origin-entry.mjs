import core, { CivweaveCoreIdentity, launchTopology as baseLaunchTopology } from './index.mjs';

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
    return core.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    return core.scheduled?.(controller, env, ctx);
  }
};
