import fabricEntry from '../../node-cloud/src/server-ai-entry-v1.mjs';
import {
  CivweaveCloudNode,
  CivweaveCapacityAccount,
  normalizeNodeId,
} from '../../node-cloud/src/index.mjs';

export { CivweaveCapacityAccount };

const ACCOUNT_ORIGIN_KEY = 'civweave-account-edge-origin-v1';
const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const trimOrigin = value => clean(value).replace(/\/+$/g, '');
const json = (value, status = 200) => Response.json(value, {
  status,
  headers: { 'cache-control': 'no-store' },
});

export function scopeAccountNodeHtml(html, publicOrigin) {
  const origin = trimOrigin(publicOrigin);
  if (!origin) return String(html || '');
  return String(html || '').replaceAll('href="/api/', `href="${origin}/api/`);
}

export class CivweaveAccountNode extends CivweaveCloudNode {
  async accountOrigin() {
    return trimOrigin(await this.state.storage.get(ACCOUNT_ORIGIN_KEY));
  }

  async manifest(nodeId) {
    const manifest = await super.manifest(nodeId);
    const accountOrigin = await this.accountOrigin();
    if (!accountOrigin) return manifest;

    const publicOrigin = `${accountOrigin}/nodes/${manifest.nodeId}`;
    if (manifest.publicOrigin === publicOrigin && manifest.transport?.accountEdgePath === true) return manifest;

    const repaired = Object.freeze({
      ...manifest,
      publicOrigin,
      transport: Object.freeze({
        ...manifest.transport,
        accountEdgePath: true,
      }),
      updatedAt: new Date().toISOString(),
    });
    await this.state.storage.put('manifest', repaired);
    return repaired;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const nodeId = normalizeNodeId(
      request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'),
    );
    const accountOrigin = trimOrigin(request.headers.get('x-civweave-account-edge-origin'));
    if (nodeId && accountOrigin) await this.state.storage.put(ACCOUNT_ORIGIN_KEY, accountOrigin);

    const response = await super.fetch(request);
    if (
      response.ok &&
      nodeId &&
      request.method === 'GET' &&
      url.pathname === '/' &&
      response.headers.get('content-type')?.includes('text/html')
    ) {
      const manifest = await this.manifest(nodeId);
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      return new Response(scopeAccountNodeHtml(await response.text(), manifest.publicOrigin), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    if (response.ok && nodeId && request.method === 'POST' && url.pathname === '/internal/configure') {
      return json({ ok: true, manifest: await this.manifest(nodeId) }, response.status);
    }
    return response;
  }
}

function cloneRequest(request, url, headers) {
  return new Request(url, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: request.redirect,
  });
}

export function accountNodePath(pathname) {
  const match = String(pathname || '').match(/^\/nodes\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  const nodeId = normalizeNodeId(match[1]);
  if (!nodeId) return null;
  return Object.freeze({ nodeId, pathname: match[2] || '/' });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const accountOrigin = url.origin;
    const routed = accountNodePath(url.pathname);

    if (routed) {
      const domain = clean(env.NODE_DOMAIN, 255) || 'nodes.commonweave.earth';
      const internalUrl = new URL(request.url);
      internalUrl.hostname = `${routed.nodeId}.${domain}`;
      internalUrl.pathname = routed.pathname;
      const headers = new Headers(request.headers);
      headers.set('x-civweave-account-edge-origin', accountOrigin);
      headers.set('x-civweave-node-id', routed.nodeId);
      return fabricEntry.fetch(cloneRequest(request, internalUrl, headers), env, ctx);
    }

    if (/^\/api\/fabric\/nodes\/[a-zA-Z0-9-]+\/payouts$/.test(url.pathname)) {
      return json({
        ok: false,
        error: 'central-money-edge-required',
        message: 'Account-local starter nodes never receive the central payment authority secret.',
      }, 409);
    }

    const headers = new Headers(request.headers);
    headers.set('x-civweave-account-edge-origin', accountOrigin);
    return fabricEntry.fetch(cloneRequest(request, url, headers), env, ctx);
  },
};