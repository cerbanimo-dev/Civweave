import baseWorker from './server-ai-entry-v4.mjs';
import { CivweaveCloudNode } from './cloud-node-recovery-v2.mjs';
import { CivweaveCapacityAccount } from './capacity-hosting-plan-v1.mjs';
import { CivweaveAccountDirectory } from './account-directory-v1.mjs';

export { CivweaveCloudNode, CivweaveCapacityAccount, CivweaveAccountDirectory };

const headers = Object.freeze({
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-civweave-node-id',
  'access-control-max-age': '86400',
});
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200) => Response.json(value, { status, headers });

async function directory(request, env) {
  const id = env.ACCOUNT_DIRECTORY?.idFromName?.('global'), stub = id ? env.ACCOUNT_DIRECTORY.get(id) : null;
  if (!stub) return json({ ok: false, error: 'Account directory is unavailable.' }, 503);
  return stub.fetch(request);
}

function capacityStub(env) {
  const id = env.CAPACITY?.idFromName?.('civweave-account'), stub = id ? env.CAPACITY.get(id) : null;
  if (!stub) throw Object.assign(new Error('Capacity service is unavailable.'), { status: 503 });
  return stub;
}
async function capacityPost(env, pathname, body) {
  const response = await capacityStub(env).fetch(`https://capacity.internal${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || `Capacity returned HTTP ${response.status}.`), { status: response.status });
  return payload;
}

async function authenticatedMember(request, env, ctx) {
  const source = new URL(request.url), sessionUrl = new URL('/api/ai/node/session', source.origin);
  const explicitNode = clean(source.searchParams.get('nodeId') || request.headers.get('x-civweave-node-id'), 180);
  if (explicitNode) sessionUrl.searchParams.set('nodeId', explicitNode);
  const forwardedHeaders = new Headers({ accept: 'application/json' });
  const authorization = clean(request.headers.get('authorization'), 20000);
  if (authorization) forwardedHeaders.set('authorization', authorization);
  if (explicitNode) forwardedHeaders.set('x-civweave-node-id', explicitNode);
  const response = await baseWorker.fetch(new Request(sessionUrl, { method: 'GET', headers: forwardedHeaders }), env, ctx);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Guild member session is invalid.'), { status: response.status || 401 });
  const nodeId = clean(payload.nodeId || payload.member?.nodeId || explicitNode, 180), userId = clean(payload.userId || payload.member?.userId, 180);
  if (!nodeId || !userId) throw Object.assign(new Error('Guild member session did not resolve a resident.'), { status: 401 });
  return Object.freeze({ nodeId, userId, member: payload.member || null, quota: payload.quota || null });
}

async function humanValidation(request, env, ctx, action) {
  try {
    const member = await authenticatedMember(request, env, ctx);
    const input = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    let payload;
    if (action === 'request') payload = await capacityPost(env, '/human-validation/requests/open', { ...input, nodeId: member.nodeId, requesterUserId: member.userId });
    else if (action === 'claim') payload = await capacityPost(env, '/human-validation/claims', { ...input, nodeId: member.nodeId, validatorUserId: member.userId });
    else payload = await capacityPost(env, '/human-validation/status', { nodeId: member.nodeId, userId: member.userId });
    return json({ ok: true, nodeId: member.nodeId, userId: member.userId, ...payload });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/account-directory/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      return directory(request, env);
    }
    if (url.pathname.startsWith('/api/node/human-validation/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (url.pathname === '/api/node/human-validation/request' && request.method === 'POST') return humanValidation(request, env, ctx, 'request');
      if (url.pathname === '/api/node/human-validation/claim' && request.method === 'POST') return humanValidation(request, env, ctx, 'claim');
      if (url.pathname === '/api/node/human-validation/status' && ['GET', 'POST'].includes(request.method)) return humanValidation(request, env, ctx, 'status');
      return json({ ok: false, error: 'Method not allowed.' }, 405);
    }
    return baseWorker.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) { if (typeof baseWorker.scheduled === 'function') return baseWorker.scheduled(controller, env, ctx); },
};
