import accountWorker, { CivweaveAccountNode as BaseNode, CivweaveCapacityAccount } from './recovery-entry-v10.mjs';
import { PassportAccountService } from './hub-passport-account-v1.mjs';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const HEADERS = Object.freeze({ 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-civweave-node-id', 'access-control-max-age': '86400' });
function nodeIdFor(request) { const url = new URL(request.url); return clean(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'), 180).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
function response(payload, status = 200) { return Response.json(payload, { status, headers: HEADERS }); }
export { CivweaveCapacityAccount };

export class CivweaveAccountNode extends BaseNode {
  passportAccountService() { return new PassportAccountService(this.state, this.env, { vaultSecret: () => this.recoveryVaultSecret() }); }
  async authenticated(nodeId, input = {}) { await this.verifyMemberLogin(nodeId, clean(input.userId, 180), clean(input.credential, 400)); }
  async passportAccount(request, nodeId) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/account/')) return new Response(null, { status: 204, headers: HEADERS });
    if (request.method !== 'POST') return null;
    const input = await request.json().catch(() => ({})), service = this.passportAccountService();
    try {
      if (url.pathname === '/api/account/passport-account/ensure') { await this.authenticated(nodeId, input); return response(await service.ensureAccount(nodeId, input)); }
      if (url.pathname === '/api/account/passkey/register/begin') { await this.authenticated(nodeId, input); return response(await service.beginPassportRegistration(input)); }
      if (url.pathname === '/api/account/passkey/register/finish') return response(await service.finishPassportRegistration(input));
      if (url.pathname === '/api/account/passkey/login/begin') return response(await service.beginLogin(input));
      if (url.pathname === '/api/account/passkey/login/finish') return response(await service.finishLogin(input));
      if (url.pathname === '/api/account/recovery-email/begin') { await this.authenticated(nodeId, input); return response(await service.beginRecoveryEmail(input)); }
      if (url.pathname === '/api/account/recovery-email/verify') { await this.authenticated(nodeId, input); return response(await service.verifyRecoveryEmail(nodeId, input)); }
      if (url.pathname === '/api/account/passport-link/begin') return response(await service.beginPassportLink(nodeId, input));
      if (url.pathname === '/api/account/passport-link/authenticate') return response(await service.authenticatePassportLink(input));
      if (url.pathname === '/api/account/passport-link/finish') return response(await service.finishPassportLink(input));
      return null;
    } catch (error) { return response({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 500); }
  }
  async fetch(request) {
    const url = new URL(request.url), nodeId = nodeIdFor(request);
    if (nodeId && (url.pathname.startsWith('/api/account/passport-') || url.pathname.startsWith('/api/account/passkey/') || url.pathname.startsWith('/api/account/recovery-email/'))) { const handled = await this.passportAccount(request, nodeId); if (handled) return handled; }
    return super.fetch(request);
  }
}
export default accountWorker;
