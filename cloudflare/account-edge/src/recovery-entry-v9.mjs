import accountWorker, { CivweaveAccountNode as BaseNode, CivweaveCapacityAccount } from './recovery-entry-v8.mjs';

const DISCOVERY_URL = 'https://civweave.cc/app/recovery-relay-v1.json';
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const CACHE_MS = 5 * 60 * 1000;
let cachedRecovery = null;
let cachedAt = 0;

function validMailbox(value) {
  const mailbox = clean(value, 320).toLowerCase();
  if (!mailbox) return '';
  if (!/^recover@recovery\.[^\s@]+\.[^\s@]+$/.test(mailbox)) throw new Error('invalid mailbox');
  if (mailbox.endsWith('@recovery.commonweave.earth')) throw new Error('forbidden mailbox');
  return mailbox;
}

async function discoverRecovery() {
  const now = Date.now();
  if (cachedRecovery && now - cachedAt < CACHE_MS) return cachedRecovery;
  const response = await fetch(`${DISCOVERY_URL}?t=${Math.floor(now / CACHE_MS)}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok || packet?.schema !== 'civweave.recovery-relay-discovery.v1') {
    throw Object.assign(new Error('Hub recovery discovery is unavailable.'), { status: 503 });
  }
  try {
    const url = new URL(clean(packet.url, 2000));
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid relay');
    cachedRecovery = Object.freeze({ relay: url.origin, mailbox: validMailbox(packet.mailbox) });
    cachedAt = now;
    return cachedRecovery;
  } catch {
    throw Object.assign(new Error('Hub recovery discovery returned an invalid endpoint or mailbox.'), { status: 503 });
  }
}

function outboundConfigured(env) {
  return Boolean(clean(env?.HUB_RECOVERY_MAILER_URL, 2000) || env?.HUB_RECOVERY_EMAIL?.send);
}

export { CivweaveCapacityAccount };

export class CivweaveAccountNode extends BaseNode {
  recoveryService() {
    const service = super.recoveryService();
    service.mailbox = () => cachedRecovery?.mailbox || '';
    service.relay = async (path, token) => {
      const recovery = cachedRecovery || await discoverRecovery();
      const response = await fetch(`${recovery.relay}/api/recovery-proof/${clean(path, 80)}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ token: clean(token, 400) }),
      });
      const packet = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(packet.error || `Recovery proof relay returned HTTP ${response.status}.`), { status: response.status });
      return packet;
    };
    return service;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/account/')) {
      let recovery;
      try { recovery = await discoverRecovery(); }
      catch (error) {
        return Response.json({ ok: false, error: String(error?.message || error), code: 'HUB_RECOVERY_DISCOVERY_UNAVAILABLE' }, {
          status: Number.isSafeInteger(error?.status) ? error.status : 503,
          headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
        });
      }
      if (!recovery.mailbox && !outboundConfigured(this.env) && (url.pathname === '/api/account/signup' || url.pathname === '/api/account/recovery/request')) {
        return Response.json({
          ok: false,
          error: 'This Hub does not yet have an owned recovery-email domain configured.',
          code: 'HUB_RECOVERY_MAILBOX_PENDING',
        }, {
          status: 503,
          headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
        });
      }
    }
    return super.fetch(request);
  }
}

export default accountWorker;
