import baseWorker, { CivweaveCloudNode, CivweaveCapacityAccount, CivweaveAccountDirectory } from './server-ai-entry-v6.mjs';
import { nodeIdFromHostname, normalizeNodeId } from './index.mjs';

export { CivweaveCloudNode, CivweaveCapacityAccount, CivweaveAccountDirectory };

const CORS = Object.freeze({
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-civweave-node-id',
  'access-control-max-age': '86400',
});
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200) => Response.json(value, { status, headers: CORS });
function resolveNodeId(request, env) {
  const url = new URL(request.url), pathMatch = url.pathname.match(/^\/n\/([^/]+)\//), domain = env.NODE_DOMAIN || 'nodes.commonweave.earth';
  return normalizeNodeId(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId') || pathMatch?.[1] || nodeIdFromHostname(url.hostname, domain));
}
function nodeStub(env, nodeId) {
  if (!env.NODES) throw Object.assign(new Error('Node binding is unavailable.'), { status: 503 });
  return env.NODES.get(env.NODES.idFromName(nodeId));
}
async function nodePost(env, nodeId, pathname, body) {
  const response = await nodeStub(env, nodeId).fetch(`https://node.internal${pathname}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-civweave-node-id': nodeId }, body: JSON.stringify(body || {}),
  });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(packet.error || `Hub account service returned HTTP ${response.status}.`), { status: response.status, code: packet.code || '', packet });
  return packet;
}
async function coreFetch(env, url, init = {}, { allowNotFound = false } = {}) {
  if (!env.CORE?.fetch) throw Object.assign(new Error('Civweave commerce service is unavailable.'), { status: 503 });
  const response = await env.CORE.fetch(url, init), packet = await response.json().catch(() => ({}));
  if (response.status === 404 && allowNotFound) return null;
  if (!response.ok) throw Object.assign(new Error(packet.error || `Commerce service returned HTTP ${response.status}.`), { status: response.status, packet });
  return packet;
}
function accountRoute(url) {
  return url.pathname.match(/\/api\/account\/stripe\/(status|connect|onboard)$/)?.[1] || '';
}
async function readiness(env, nodeId, input) {
  const packet = await nodePost(env, nodeId, `/api/account/membership/readiness?nodeId=${encodeURIComponent(nodeId)}`, input);
  if (!packet?.account?.onlineMembershipReady) throw Object.assign(new Error('Finish Hub account recovery and 2FA before connecting Stripe.'), { status: 428, code: 'hub-account-security-required' });
  return packet.account;
}
function publicReturnOrigin(request) {
  const forwarded = clean(request.headers.get('x-civweave-account-edge-origin'), 1000);
  try {
    const candidate = new URL(forwarded || request.url);
    if (!['https:', 'http:'].includes(candidate.protocol) || candidate.username || candidate.password) throw new Error('invalid');
    if (candidate.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(candidate.hostname)) throw new Error('insecure');
    return candidate.origin;
  } catch { return 'https://civweave.cc'; }
}
function coreUrl(origin, pathname) {
  return new URL(pathname, `${origin}/`).href;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), route = accountRoute(url);
    if (!route) return baseWorker.fetch(request, env, ctx);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
    let nodeId = '';
    try { nodeId = resolveNodeId(request, env); } catch { nodeId = ''; }
    if (!nodeId) return json({ ok: false, error: 'Hub node id is required.' }, 400);
    const input = await request.json().catch(() => ({}));
    try {
      const account = await readiness(env, nodeId, input), userId = account.userId, publicOrigin = publicReturnOrigin(request);
      if (route === 'status') {
        const merchant = await coreFetch(env, coreUrl(publicOrigin, `/api/fellowfare/direct-commerce/accounts/${encodeURIComponent(userId)}`), { method: 'GET' }, { allowNotFound: true });
        return json({ ok: true, connected: Boolean(merchant), merchant, annualMemberRebateOptIn: Boolean(account.annualMemberRebateOptIn) });
      }
      if (route === 'connect') {
        const email = clean(input.email, 320);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new TypeError('A valid Stripe contact email is required.'), { status: 400 });
        const merchant = await coreFetch(env, coreUrl(publicOrigin, '/api/fellowfare/direct-commerce/accounts'), {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId, displayName: account.accountName, contactEmail: email, country: clean(input.country || 'us', 2).toLowerCase() }),
        });
        const rebate = await nodePost(env, nodeId, `/api/account/annual-member-rebate?nodeId=${encodeURIComponent(nodeId)}`, { ...input, optIn: input.annualMemberRebateOptIn === true });
        return json({ ok: true, connected: true, merchant, account: rebate.account, annualMemberRebateOptIn: Boolean(rebate.account?.annualMemberRebateOptIn) }, 201);
      }
      if (route === 'onboard') {
        const packet = await coreFetch(env, coreUrl(publicOrigin, `/api/fellowfare/direct-commerce/accounts/${encodeURIComponent(userId)}/onboard`), {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
        });
        return json({ ok: true, onboarding: packet });
      }
      return json({ ok: false, error: 'Unknown Stripe account route.' }, 404);
    } catch (error) {
      return json({ ok: false, error: String(error?.message || error), ...(error?.code ? { code: error.code } : {}) }, Number.isSafeInteger(error?.status) ? error.status : 500);
    }
  },
  async scheduled(controller, env, ctx) {
    if (typeof baseWorker.scheduled === 'function') return baseWorker.scheduled(controller, env, ctx);
  },
};
