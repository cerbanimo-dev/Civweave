import accountWorker, { CivweaveAccountNode as BaseNode, CivweaveCapacityAccount } from './recovery-entry-v3.mjs';
import { handleHubAccountRecovery } from './hub-account-recovery-v1.mjs';
import { HubAccountRecoveryInboundService, handleHubAccountRecoveryInbound } from './hub-account-recovery-inbound-v1.mjs';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const nodeIdFor = request => {
  const url = new URL(request.url);
  return clean(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'), 180)
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
};

export { CivweaveCapacityAccount };

export class CivweaveAccountNode extends BaseNode {
  recoveryService() {
    const service = new HubAccountRecoveryInboundService(this.state, this.env, {
      vaultSecret: () => this.recoveryVaultSecret(),
    });
    const signup = service.signup.bind(service);
    service.signup = async (nodeId, input = {}) => {
      await this.verifyMemberLogin(nodeId, clean(input.userId, 180), clean(input.credential, 400));
      return signup(nodeId, input);
    };
    return service;
  }

  async fetch(request) {
    const url = new URL(request.url), nodeId = nodeIdFor(request);
    if (nodeId && (url.pathname.startsWith('/api/account/') || request.method === 'OPTIONS')) {
      const response = await handleHubAccountRecoveryInbound(this.recoveryService(), request, nodeId, handleHubAccountRecovery);
      if (response) return response;
    }
    return super.fetch(request);
  }
}

export default accountWorker;
