import accountWorker, { CivweaveAccountNode as BaseNode, CivweaveCapacityAccount } from './index.mjs';
import { HubAccountRecoveryService, handleHubAccountRecovery } from './hub-account-recovery-v1.mjs';

const enc = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const nodeIdFor = request => {
  const url = new URL(request.url);
  return clean(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'), 180)
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
};
async function loginHash(value) {
  const source = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(source)) throw Object.assign(new TypeError('A valid device login credential is required.'), { status: 400 });
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`civweave.host-login-credential.v1\n${source}`));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export { CivweaveCapacityAccount };

export class CivweaveAccountNode extends BaseNode {
  async recoveryVaultSecret() {
    const identity = await this.identity();
    const secret = clean(identity?.privateJwk?.d, 4000);
    if (!secret) throw Object.assign(new Error('Guild recovery identity is unavailable.'), { status: 503 });
    return secret;
  }
  async verifyMember(nodeId, userId, credential) {
    const response = await this.capacityStub().fetch('https://capacity.internal/members/admit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nodeId, userId, seatClass: 'community', billingStatus: 'free', loginCredentialHash: await loginHash(credential) }),
    });
    const packet = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(packet.error || 'Guild login verification failed.'), { status: response.status });
    if (!packet.idempotent) throw Object.assign(new Error('Recovery enrollment requires an existing Guild member login.'), { status: 409 });
  }
  recoveryService() {
    const service = new HubAccountRecoveryService(this.state, this.env, { vaultSecret: () => this.recoveryVaultSecret() });
    const signup = service.signup.bind(service);
    service.signup = async (nodeId, input = {}) => {
      await this.verifyMember(nodeId, clean(input.userId, 180), clean(input.credential, 400));
      return signup(nodeId, input);
    };
    return service;
  }
  async fetch(request) {
    const url = new URL(request.url), nodeId = nodeIdFor(request);
    if (nodeId && (url.pathname.startsWith('/api/account/') || request.method === 'OPTIONS')) {
      const response = await handleHubAccountRecovery(this.recoveryService(), request, nodeId);
      if (response) return response;
    }
    return super.fetch(request);
  }
}

export default accountWorker;
