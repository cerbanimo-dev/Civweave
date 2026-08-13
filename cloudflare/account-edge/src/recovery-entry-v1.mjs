import accountWorker, {
  CivweaveAccountNode as BaseAccountNode,
  CivweaveCapacityAccount,
} from './index.mjs';
import {
  HubAccountRecoveryService,
  handleHubAccountRecovery,
} from './hub-account-recovery-v1.mjs';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const nodeIdFor = request => {
  const url = new URL(request.url);
  return clean(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'), 180)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

export { CivweaveCapacityAccount };

export class CivweaveAccountNode extends BaseAccountNode {
  async recoveryVaultSecret() {
    const identity = await this.identity();
    const secret = clean(identity?.privateJwk?.d, 4000);
    if (!secret) throw Object.assign(new Error('Hub node recovery identity is unavailable.'), { status: 503 });
    return secret;
  }

  recoveryService() {
    return new HubAccountRecoveryService(this.state, this.env, {
      vaultSecret: () => this.recoveryVaultSecret(),
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const nodeId = nodeIdFor(request);
    if (nodeId && (url.pathname.startsWith('/api/account/') || request.method === 'OPTIONS')) {
      const response = await handleHubAccountRecovery(this.recoveryService(), request, nodeId);
      if (response) return response;
    }
    return super.fetch(request);
  }
}

export default accountWorker;
