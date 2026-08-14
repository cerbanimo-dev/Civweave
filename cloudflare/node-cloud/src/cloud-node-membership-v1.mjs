import { CivweaveCloudNode as BaseCloudNode } from './index.mjs';
import { handleHubAccountRecovery } from '../../account-edge/src/hub-account-recovery-v1.mjs';
import {
  HubAccountRecoveryInboundService,
  handleHubAccountRecoveryInbound,
} from '../../account-edge/src/hub-account-recovery-inbound-v1.mjs';

const enc = new TextEncoder();
const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);

async function loginHash(value) {
  const source = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(source)) {
    throw Object.assign(new TypeError('A valid device login credential is required.'), { status: 400 });
  }
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`civweave.host-login-credential.v1\n${source}`));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export class CivweaveCloudNode extends BaseCloudNode {
  async recoveryVaultSecret() {
    const identity = await this.identity();
    const secret = clean(identity?.privateJwk?.d, 4000);
    if (!secret) throw Object.assign(new Error('Hub node recovery identity is unavailable.'), { status: 503 });
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
      throw Object.assign(new Error(statusPacket.error || 'Recovery enrollment requires an existing Hub member login.'), { status: statusResponse.status });
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
    if (!response.ok) throw Object.assign(new Error(packet.error || 'Hub login verification failed.'), { status: response.status });
    if (!packet.idempotent) throw Object.assign(new Error('Recovery enrollment requires an existing Hub member login.'), { status: 409 });
    return true;
  }

  recoveryService() {
    const service = new HubAccountRecoveryInboundService(this.state, this.env, {
      vaultSecret: () => this.recoveryVaultSecret(),
    });
    const signup = service.signup.bind(service);
    service.signup = async (nodeId, input = {}) => {
      await this.verifyMemberLogin(nodeId, input.userId, input.credential);
      return signup(nodeId, input);
    };
    return service;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const nodeId = clean(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'), 180)
      .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (nodeId && (url.pathname.startsWith('/api/account/') || request.method === 'OPTIONS')) {
      const response = await handleHubAccountRecoveryInbound(this.recoveryService(), request, nodeId, handleHubAccountRecovery);
      if (response) return response;
    }
    return super.fetch(request);
  }

  async applyPaymentCapacity(nodeId, event) {
    if (event?.type === 'membership.paid' && event?.userId) {
      const response = await this.capacityStub().fetch('https://capacity.internal/members/ensure-membership-resident', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nodeId, userId: clean(event.userId), tierId: clean(event.tierId, 80) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(payload.error || `Capacity resident creation returned HTTP ${response.status}`), { status: response.status });
    }
    return super.applyPaymentCapacity(nodeId, event);
  }
}
