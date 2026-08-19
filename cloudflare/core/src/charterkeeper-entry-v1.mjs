import baseCore from './territory-host-entry-v1.mjs';
import { CloudflareMoneyEdge, moneyEdgeError } from './money-edge-with-memberships.mjs';
import {
  CHARTERKEEPER_SCHEMA,
  CHARTERKEEPER_SETTLEMENT_SCHEMA,
  CHARTERKEEPER_POLICY,
  CHARTERKEEPER_TRAINING_MODULES,
  createCharter,
  recordCharterTraining,
  prepareCharterChild,
  acceptCharter,
  acceptCharterAgreement,
  endCharter,
  listCharters
} from './charterkeeper-v1.mjs';

export * from './territory-host-entry-v1.mjs';
export {
  CHARTERKEEPER_SCHEMA,
  CHARTERKEEPER_SETTLEMENT_SCHEMA,
  CHARTERKEEPER_POLICY,
  CHARTERKEEPER_TRAINING_MODULES
};

const encoder = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

async function charterkeeperRoute(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/money-edge/charters') && url.pathname !== '/api/money-edge/status') return null;
  const edge = new CloudflareMoneyEdge(env);
  try {
    if (request.method === 'GET' && url.pathname === '/api/money-edge/status') {
      return json({
        moneyEdge: Object.freeze({
          ...edge.readiness(),
          charterkeeping: Object.freeze({
            schema: CHARTERKEEPER_SCHEMA,
            settlementSchema: CHARTERKEEPER_SETTLEMENT_SCHEMA,
            policy: CHARTERKEEPER_POLICY,
            trainingModules: CHARTERKEEPER_TRAINING_MODULES,
            sourceBoundary: 'existing-cerbanimo-share-only',
            recursiveAncestorShares: false
          })
        }),
        authority: 'cloudflare-core',
        canonical: true
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/money-edge/charters') {
      const nodeId = clean(url.searchParams.get('nodeId'), 180);
      const result = await listCharters(edge, nodeId, new Uint8Array(), request.headers.get('x-civweave-node-signature'));
      return json(result);
    }

    if (request.method === 'POST' && url.pathname === '/api/money-edge/charters') {
      const rawText = await request.text();
      const input = JSON.parse(rawText || '{}');
      return json(await createCharter(edge, input, encoder.encode(rawText), request.headers.get('x-civweave-node-signature')), 201);
    }

    const action = url.pathname.match(/^\/api\/money-edge\/charters\/([^/]+)\/(training|prepare|accept|agreement|end)$/);
    if (request.method === 'POST' && action) {
      const charterId = decodeURIComponent(action[1]);
      const rawText = await request.text();
      const input = JSON.parse(rawText || '{}');
      const raw = encoder.encode(rawText);
      const signature = request.headers.get('x-civweave-node-signature');
      if (action[2] === 'training') return json(await recordCharterTraining(edge, charterId, input, raw, signature));
      if (action[2] === 'prepare') return json(await prepareCharterChild(edge, charterId, input, raw, signature));
      if (action[2] === 'accept') return json(await acceptCharter(edge, charterId, input, raw, signature));
      if (action[2] === 'agreement') return json(await acceptCharterAgreement(edge, charterId, input, raw, signature));
      if (action[2] === 'end') return json(await endCharter(edge, charterId, input, raw, signature));
    }

    if (url.pathname.startsWith('/api/money-edge/charters')) return json({ error: 'Charterkeeper route not found.' }, 404);
  } catch (error) {
    const safe = moneyEdgeError(error);
    return json(safe.body, safe.status);
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const charterkeeper = await charterkeeperRoute(request, env);
    if (charterkeeper) return charterkeeper;
    return baseCore.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    return baseCore.scheduled?.(controller, env, ctx);
  }
};
