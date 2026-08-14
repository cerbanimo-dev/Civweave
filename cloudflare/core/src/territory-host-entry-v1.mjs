import baseCore from './stripe-connect-v2-entry.mjs';
import { CloudflareMoneyEdge, moneyEdgeError } from './money-edge-with-memberships.mjs';
import {
  publicTerritoryHostAuthorityRegistry,
  bindTerritoryHostAuthority,
  revokeTerritoryHostAuthority,
  issueTerritoryHostAdmission,
  claimTerritoryHostAdmission
} from './territory-host-authority-v1.mjs';

export * from './stripe-connect-v2-entry.mjs';
export * from './territory-host-authority-v1.mjs';

const json = (value, status = 200) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

async function territoryHostRoute(request, env) {
  const url = new URL(request.url);
  const edge = new CloudflareMoneyEdge(env);
  try {
    if (request.method === 'GET' && url.pathname === '/api/federation/territory-host-authorities') {
      return json(await publicTerritoryHostAuthorityRegistry(edge));
    }
    if (request.method === 'POST' && url.pathname === '/internal/federation/territory-host-authorities/bind') {
      const result = await bindTerritoryHostAuthority(edge, await request.json(), request.headers.get('x-civweave-fabric-token') || '');
      return json({ ok: true, authority: result }, 201);
    }
    const revoke = url.pathname.match(/^\/internal\/federation\/territory-host-authorities\/([^/]+)\/revoke$/);
    if (request.method === 'POST' && revoke) {
      const result = await revokeTerritoryHostAuthority(edge, decodeURIComponent(revoke[1]), request.headers.get('x-civweave-fabric-token') || '');
      return json({ ok: true, authority: result });
    }
    if (request.method === 'POST' && url.pathname === '/api/federation/host-admissions/grants') {
      const rawText = await request.text();
      const result = await issueTerritoryHostAdmission(edge, rawText, request.headers.get('x-civweave-node-signature'));
      return json({ admission: result }, 201);
    }
    if (request.method === 'POST' && url.pathname === '/api/federation/host-admissions/claim') {
      const result = await claimTerritoryHostAdmission(edge, await request.json());
      return json({ admission: result }, 201);
    }
  } catch (error) {
    const safe = moneyEdgeError(error);
    return json(safe.body, safe.status);
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const delegated = await territoryHostRoute(request, env);
    if (delegated) return delegated;
    return baseCore.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    return baseCore.scheduled?.(controller, env, ctx);
  }
};
