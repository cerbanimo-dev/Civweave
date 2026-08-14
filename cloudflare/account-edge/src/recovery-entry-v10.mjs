import accountWorker, { CivweaveAccountNode as BaseNode, CivweaveCapacityAccount } from './recovery-entry-v7.mjs';
import { HubAccountRecoveryOfflineService } from './hub-account-recovery-offline-v1.mjs';

const DISCOVERY_URL = 'https://civweave.pages.dev/app/recovery-relay-v1.json';
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const CACHE_MS = 5 * 60 * 1000;
const ACCOUNT_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-civweave-node-id',
});
let cachedRecovery = null;
let cachedAt = 0;

function nodeIdFor(request) {
  const url = new URL(request.url);
  return clean(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'), 180)
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
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

export { CivweaveCapacityAccount };

export class CivweaveAccountNode extends BaseNode {
  recoveryService() {
    const service = new HubAccountRecoveryOfflineService(this.state, this.env, {
      vaultSecret: () => this.recoveryVaultSecret(),
    });
    const signup = service.signup.bind(service);
    service.signup = async (nodeId, input = {}) => {
      await this.verifyMemberLogin(nodeId, clean(input.userId, 180), clean(input.credential, 400));
      const recovery = await discoverRecovery().catch(() => Object.freeze({ relay: '', mailbox: '' }));
      service.mailbox = () => recovery.mailbox || '';
      return signup(nodeId, input);
    };
    const requestRecoveryForNode = service.requestRecoveryForNode.bind(service);
    service.requestRecoveryForNode = async (nodeId, input = {}) => {
      const recovery = await discoverRecovery().catch(() => Object.freeze({ relay: '', mailbox: '' }));
      service.mailbox = () => recovery.mailbox || '';
      if (!recovery.mailbox && !this.env?.HUB_RECOVERY_MAILER_URL && !this.env?.HUB_RECOVERY_EMAIL?.send) {
        return Object.freeze({
          ok: true,
          accepted: true,
          message: 'Email recovery is not available on this Hub yet. Use one of your saved one-time recovery codes.',
          delivery: Object.freeze({ sent: false, transport: 'offline-code-only' }),
        });
      }
      return requestRecoveryForNode(nodeId, input);
    };
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
    if (request.method === 'POST' && url.pathname === '/api/account/recovery/codes/ack') {
      const input = await request.json().catch(() => ({}));
      const nodeId = nodeIdFor(request);
      try {
        await this.verifyMemberLogin(nodeId, clean(input.userId, 180), clean(input.credential, 400));
        const result = await this.recoveryService().acknowledgeOfflineRecovery(clean(input.userId, 180));
        return Response.json(result, { headers: ACCOUNT_HEADERS });
      } catch (error) {
        return Response.json({ ok: false, error: String(error?.message || error) }, {
          status: Number.isSafeInteger(error?.status) ? error.status : 500,
          headers: ACCOUNT_HEADERS,
        });
      }
    }
    return super.fetch(request);
  }
}

export default accountWorker;
