import accountWorker, { CivweaveAccountNode as BaseNode, CivweaveCapacityAccount } from './recovery-entry-v7.mjs';

const DISCOVERY_URL = 'https://civweave.pages.dev/app/recovery-relay-v1.json';
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
let cachedRelay = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000;

async function discoverRelay() {
  const now = Date.now();
  if (cachedRelay && now - cachedAt < CACHE_MS) return cachedRelay;
  const response = await fetch(`${DISCOVERY_URL}?t=${Math.floor(now / CACHE_MS)}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok || packet?.schema !== 'civweave.recovery-relay-discovery.v1') {
    throw Object.assign(new Error('Hub recovery proof relay discovery is unavailable.'), { status: 503 });
  }
  const raw = clean(packet.url, 2000);
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid');
    cachedRelay = url.origin;
    cachedAt = now;
    return cachedRelay;
  } catch {
    throw Object.assign(new Error('Hub recovery proof relay discovery returned an invalid endpoint.'), { status: 503 });
  }
}

export { CivweaveCapacityAccount };

export class CivweaveAccountNode extends BaseNode {
  recoveryService() {
    const service = super.recoveryService();
    service.relay = async (path, token) => {
      const relay = await discoverRelay();
      const response = await fetch(`${relay}/api/recovery-proof/${clean(path, 80)}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ token: clean(token, 400) }),
      });
      const packet = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw Object.assign(new Error(packet.error || `Recovery proof relay returned HTTP ${response.status}.`), { status: response.status });
      }
      return packet;
    };
    return service;
  }
}

export default accountWorker;
