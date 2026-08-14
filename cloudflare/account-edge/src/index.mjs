import legacyAccountEdge, {
  CivweaveAccountNode,
  accountNodePath,
  scopeAccountNodeHtml,
} from './index-legacy-v1.mjs';
import fabricEntry from '../../node-cloud/src/server-ai-entry-v2.mjs';
import { CivweaveUserPoolCapacityAccount as CivweaveCapacityAccount } from '../../node-cloud/src/capacity-user-pools-v2.mjs';

export { CivweaveAccountNode, CivweaveCapacityAccount, accountNodePath, scopeAccountNodeHtml };

const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
function cloneRequest(request, url, headers) {
  return new Request(url, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, redirect: request.redirect });
}
function isGenerate(pathname) { return pathname === '/api/ai/node/generate'; }

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') return legacyAccountEdge.fetch(request, env, ctx);
    const url = new URL(request.url), routed = accountNodePath(url.pathname);
    if (routed && isGenerate(routed.pathname)) {
      const domain = clean(env.NODE_DOMAIN, 255) || 'nodes.commonweave.earth', internalUrl = new URL(request.url);
      internalUrl.hostname = `${routed.nodeId}.${domain}`;
      internalUrl.pathname = routed.pathname;
      const headers = new Headers(request.headers);
      headers.set('x-civweave-account-edge-origin', url.origin);
      headers.set('x-civweave-node-id', routed.nodeId);
      return fabricEntry.fetch(cloneRequest(request, internalUrl, headers), env, ctx);
    }
    if (isGenerate(url.pathname) && request.headers.get('x-civweave-node-id')) {
      const headers = new Headers(request.headers);
      headers.set('x-civweave-account-edge-origin', url.origin);
      return fabricEntry.fetch(cloneRequest(request, url, headers), env, ctx);
    }
    return legacyAccountEdge.fetch(request, env, ctx);
  },
};
