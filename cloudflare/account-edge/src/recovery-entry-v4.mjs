import { EmailMessage } from 'cloudflare:email';
import accountWorker, {
  CivweaveAccountNode as RecoveryAccountNode,
  CivweaveCapacityAccount,
} from './recovery-entry-v3.mjs';
import { handleHubAccountRecovery } from './hub-account-recovery-v1.mjs';
import {
  HubAccountRecoveryInboundService,
  handleHubAccountRecoveryInbound,
  parseInboundProofSubject,
} from './hub-account-recovery-inbound-v1.mjs';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const normalizeMailbox = value => {
  const email = clean(value, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Recovery mailbox is invalid.');
  return email;
};
const nodeIdFor = request => {
  const url = new URL(request.url);
  return clean(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'), 180)
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
};

function replyMime(from, to) {
  return [
    `From: Civweave Hub <${from}>`,
    `To: ${to}`,
    'Subject: Civweave recovery email received',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    'Civweave received your Hub recovery proof. Return to Civweave to finish verification or recovery.',
    '',
    'This message contains no Passport history, activity, purchase, or payment information.',
  ].join('\r\n');
}

export { CivweaveCapacityAccount };

export class CivweaveAccountNode extends RecoveryAccountNode {
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

  async approveInboundEmailProof(input) {
    return this.recoveryService().approveInboundProof(input);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const nodeId = nodeIdFor(request);
    if (nodeId && (url.pathname.startsWith('/api/account/') || request.method === 'OPTIONS')) {
      const response = await handleHubAccountRecoveryInbound(this.recoveryService(), request, nodeId, handleHubAccountRecovery);
      if (response) return response;
    }
    return super.fetch(request);
  }
}

async function handleRecoveryEmail(message, env) {
  const mailbox = normalizeMailbox(env.HUB_RECOVERY_INBOUND_EMAIL || '');
  const to = normalizeMailbox(message.to || '');
  if (to !== mailbox) {
    message.setReject('Unknown Civweave recovery mailbox.');
    return;
  }
  const parsed = parseInboundProofSubject(message.headers.get('subject') || '');
  if (!parsed) {
    message.setReject('Invalid Civweave recovery proof subject.');
    return;
  }
  const from = normalizeMailbox(message.from || '');
  await message.reply(new EmailMessage(to, from, replyMime(to, from)));
  const stub = env.NODES.get(env.NODES.idFromName(parsed.nodeId));
  await stub.approveInboundEmailProof({ ...parsed, from });
}

export default {
  async fetch(request, env, ctx) { return accountWorker.fetch(request, env, ctx); },
  async email(message, env, ctx) {
    try { await handleRecoveryEmail(message, env); }
    catch (error) {
      console.error('Civweave recovery email proof failed', String(error?.message || error));
      try { message.setReject('Civweave could not validate this recovery proof.'); } catch {}
    }
  },
};
