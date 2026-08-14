import baseWorker, { CivweaveCloudNode, CivweaveAccountDirectory } from './server-ai-entry-v5.mjs';
import { CivweaveCapacityAccount } from './capacity-membership-admin-v1.mjs';
import { nodeIdFromHostname, normalizeNodeId } from './index.mjs';

export { CivweaveCloudNode, CivweaveCapacityAccount, CivweaveAccountDirectory };

const CORS = Object.freeze({
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-civweave-node-id',
  'access-control-max-age': '86400',
});
const clean = (value, max = 20000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200) => Response.json(value, { status, headers: CORS });
function bearer(request) {
  const value = clean(request.headers.get('authorization'), 20000);
  return /^Bearer\s+/i.test(value) ? value.replace(/^Bearer\s+/i, '') : '';
}
function resolveNodeId(request, env) {
  const url = new URL(request.url), pathMatch = url.pathname.match(/^\/n\/([^/]+)\//);
  const domain = env.NODE_DOMAIN || 'nodes.commonweave.earth';
  return normalizeNodeId(
    request.headers.get('x-civweave-node-id')
      || url.searchParams.get('nodeId')
      || pathMatch?.[1]
      || nodeIdFromHostname(url.hostname, domain)
  );
}
function nodeStub(env, nodeId) {
  if (!env.NODES) throw Object.assign(new Error('Node binding is unavailable.'), { status: 503 });
  return env.NODES.get(env.NODES.idFromName(nodeId));
}
function capacityStub(env) {
  if (!env.CAPACITY) throw Object.assign(new Error('Capacity binding is unavailable.'), { status: 503 });
  return env.CAPACITY.get(env.CAPACITY.idFromName('civweave-account'));
}
async function nodePost(env, nodeId, pathname, body) {
  const response = await nodeStub(env, nodeId).fetch(`https://node.internal${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-civweave-node-id': nodeId },
    body: JSON.stringify(body || {}),
  });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(packet.error || `Hub account service returned HTTP ${response.status}.`);
    error.status = response.status; error.code = packet.code || ''; error.packet = packet; throw error;
  }
  return packet;
}
async function capacityPost(env, pathname, body) {
  const response = await capacityStub(env).fetch(`https://capacity.internal${pathname}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}),
  });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(packet.error || `Capacity service returned HTTP ${response.status}.`), { status: response.status });
  return packet;
}
function isSessionPost(request, url) {
  return request.method === 'POST' && (url.pathname === '/api/ai/node/session' || /\/api\/ai\/node\/session$/.test(url.pathname));
}
function isDeviceBoundRequest(request, url) {
  if (!bearer(request)) return false;
  return url.pathname === '/api/ai/node/session'
    || /\/api\/ai\/node\/session$/.test(url.pathname)
    || url.pathname.startsWith('/api/ai/node/')
    || /\/api\/ai\/node\//.test(url.pathname)
    || url.pathname.startsWith('/api/browser/tool')
    || url.pathname.startsWith('/api/commerce/');
}
async function accountAuthorize(env, nodeId, input) {
  return nodePost(env, nodeId, `/api/account/session/authorize?nodeId=${encodeURIComponent(nodeId)}`, input);
}
async function bindSession(env, nodeId, authorization, packet) {
  const session = packet?.capacitySession;
  if (!session?.token) throw Object.assign(new Error('Hub did not return a capacity session to bind to this device.'), { status: 502 });
  return nodePost(env, nodeId, '/internal/account/session/bind', {
    userId: authorization.userId,
    deviceId: authorization.deviceId,
    token: session.token,
    expiresAt: session.expiresAt || null,
  });
}
async function checkBoundSession(env, nodeId, token) {
  return nodePost(env, nodeId, '/internal/account/session/check', { token });
}
async function annotateMember(env, nodeId, authorization) {
  const account = authorization?.account || {};
  return capacityPost(env, '/members/annotate-account', {
    nodeId,
    userId: authorization.userId,
    accountId: account.accountId,
    accountName: account.accountName,
    passportIds: account.passportIds || [],
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let nodeId = '';
    try { nodeId = resolveNodeId(request, env); } catch { nodeId = ''; }

    if (isSessionPost(request, url) && nodeId) {
      const input = await request.clone().json().catch(() => ({}));
      let authorization;
      try {
        authorization = await accountAuthorize(env, nodeId, input);
      } catch (error) {
        return json({
          ok: false,
          error: String(error?.message || error),
          ...(error?.code ? { code: error.code } : {}),
          ...(error?.packet?.account ? { account: error.packet.account } : {}),
          ...(Array.isArray(error?.packet?.activeDevices) ? { activeDevices: error.packet.activeDevices } : {}),
        }, Number.isSafeInteger(error?.status) ? error.status : 500);
      }
      const headers = new Headers(request.headers);
      headers.set('content-type', 'application/json');
      const canonical = new Request(request, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...input, userId: authorization.userId, credential: authorization.credential }),
      });
      const response = await baseWorker.fetch(canonical, env, ctx);
      if (!response.ok) return response;
      const packet = await response.clone().json().catch(() => ({}));
      try {
        await annotateMember(env, nodeId, authorization);
        await bindSession(env, nodeId, authorization, packet);
      } catch (error) {
        return json({ ok: false, error: `Hub login succeeded but account binding failed: ${error.message || error}` }, Number.isSafeInteger(error?.status) ? error.status : 503);
      }
      return response;
    }

    if (nodeId && isDeviceBoundRequest(request, url)) {
      try { await checkBoundSession(env, nodeId, bearer(request)); }
      catch (error) {
        return json({ ok: false, error: String(error?.message || error), ...(error?.code ? { code: error.code } : {}) }, Number.isSafeInteger(error?.status) ? error.status : 401);
      }
    }

    return baseWorker.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    if (typeof baseWorker.scheduled === 'function') return baseWorker.scheduled(controller, env, ctx);
  },
};
