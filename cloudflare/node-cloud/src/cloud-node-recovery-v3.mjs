import { CivweaveCloudNode as BaseCloudNode } from './cloud-node-recovery-v2.mjs';

const enc = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-civweave-node-id',
  'access-control-max-age': '86400',
});
const response = (payload, status = 200) => Response.json(payload, { status, headers: HEADERS });
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function nodeIdFor(request) {
  const url = new URL(request.url);
  return clean(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'), 180).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export class CivweaveCloudNode extends BaseCloudNode {
  async verifyStewardKey(input = {}) {
    const key = clean(input.stewardKey, 220);
    if (!/^[A-Za-z0-9_-]{40,200}$/.test(key)) throw Object.assign(new Error('A valid Hub Steward claim is required.'), { status: 401 });
    const stored = await this.state.storage.get('hub-location');
    if (!stored?.ownerKeyHash) throw Object.assign(new Error('Pair this Steward browser to the Hub before managing members.'), { status: 428, code: 'steward-pairing-required' });
    const hash = await sha256Hex(`civweave.hub-location-owner.v1\n${key}`);
    if (hash !== stored.ownerKeyHash) throw Object.assign(new Error('Hub Steward claim is invalid.'), { status: 403 });
    return true;
  }
  async capacityAdmin(pathname, body) {
    const stub = this.capacityStub();
    const result = await stub.fetch(`https://capacity.internal${pathname}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}),
    });
    const packet = await result.json().catch(() => ({}));
    if (!result.ok) throw Object.assign(new Error(packet.error || `Capacity administration returned HTTP ${result.status}.`), { status: result.status });
    return packet;
  }
  async stewardAccount(request, nodeId) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/account/steward/')) return new Response(null, { status: 204, headers: HEADERS });
    if (request.method !== 'POST' || !url.pathname.startsWith('/api/account/steward/')) return null;
    const input = await request.json().catch(() => ({}));
    try {
      await this.verifyStewardKey(input);
      if (url.pathname === '/api/account/steward/members') {
        return response(await this.capacityAdmin('/members/list', { nodeId }));
      }
      if (url.pathname === '/api/account/steward/member/remove') {
        return response(await this.capacityAdmin('/members/remove', {
          nodeId,
          userId: clean(input.userId, 180),
          reason: clean(input.reason, 500) || 'removed-by-host-steward',
          blockRejoin: input.blockRejoin === true,
        }));
      }
      if (url.pathname === '/api/account/steward/member/unblock') {
        return response(await this.capacityAdmin('/members/unblock', { nodeId, userId: clean(input.userId, 180) }));
      }
      return null;
    } catch (error) {
      return response({ ok: false, error: String(error?.message || error), ...(error?.code ? { code: error.code } : {}) }, Number.isSafeInteger(error?.status) ? error.status : 500);
    }
  }
  async fetch(request) {
    const nodeId = nodeIdFor(request);
    if (nodeId) {
      const steward = await this.stewardAccount(request, nodeId);
      if (steward) return steward;
    }
    return super.fetch(request);
  }
}
