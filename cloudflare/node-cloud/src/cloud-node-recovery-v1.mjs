import { CivweaveCloudNode as BaseCloudNode } from './cloud-node-hosting-v1.mjs';
import { handleHubAccountRecovery } from '../../account-edge/src/hub-account-recovery-v1.mjs';
import { handleHubAccountRecoveryInbound } from '../../account-edge/src/hub-account-recovery-inbound-v1.mjs';
import { HubAccountRecoveryOfflineService } from '../../account-edge/src/hub-account-recovery-offline-v1.mjs';

const DISCOVERY_URL = 'https://civweave.pages.dev/app/recovery-relay-v1.json';
const CACHE_MS = 5 * 60 * 1000;
const enc = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const ACCOUNT_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-civweave-node-id',
  'access-control-max-age': '86400',
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

async function loginHash(value) {
  const source = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(source)) {
    throw Object.assign(new TypeError('A valid device login credential is required.'), { status: 400 });
  }
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`civweave.host-login-credential.v1\n${source}`));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
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
    throw Object.assign(new Error('Guild recovery discovery is unavailable.'), { status: 503 });
  }
  try {
    const url = new URL(clean(packet.url, 2000));
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid relay');
    cachedRecovery = Object.freeze({ relay: url.origin, mailbox: validMailbox(packet.mailbox) });
    cachedAt = now;
    return cachedRecovery;
  } catch {
    throw Object.assign(new Error('Guild recovery discovery returned an invalid endpoint or mailbox.'), { status: 503 });
  }
}

export class CivweaveCloudNode extends BaseCloudNode {
  async recoveryVaultSecret() {
    const identity = await this.identity();
    const secret = clean(identity?.privateJwk?.d, 4000);
    if (!secret) throw Object.assign(new Error('Guild recovery identity is unavailable.'), { status: 503 });
    return secret;
  }

  async verifyMemberLogin(nodeId, userId, credential) {
    const capacity = this.capacityStub();
    const statusResponse = await capacity.fetch('https://capacity.internal/members/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nodeId, userId: clean(userId, 180) }),
    });
    if (!statusResponse.ok) {
      const statusPacket = await statusResponse.json().catch(() => ({}));
      throw Object.assign(new Error(statusPacket.error || 'Recovery enrollment requires an existing Guild member login.'), { status: statusResponse.status });
    }
    const response = await capacity.fetch('https://capacity.internal/members/admit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nodeId,
        userId: clean(userId, 180),
        seatClass: 'community',
        billingStatus: 'free',
        loginCredentialHash: await loginHash(credential),
      }),
    });
    const packet = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(packet.error || 'Guild login verification failed.'), { status: response.status });
    if (!packet.idempotent) throw Object.assign(new Error('Recovery enrollment requires an existing Guild member login.'), { status: 409 });
    return true;
  }

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
          message: 'Email recovery is not available on this Guild yet. Use one of your saved one-time recovery codes.',
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
    const nodeId = nodeIdFor(request);
    if (request.method === 'POST' && url.pathname === '/api/account/recovery/codes/ack') {
      const input = await request.json().catch(() => ({}));
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
    if (nodeId && (url.pathname.startsWith('/api/account/') || request.method === 'OPTIONS')) {
      const response = await handleHubAccountRecoveryInbound(this.recoveryService(), request, nodeId, handleHubAccountRecovery);
      if (response) return response;
    }
    return super.fetch(request);
  }
}
