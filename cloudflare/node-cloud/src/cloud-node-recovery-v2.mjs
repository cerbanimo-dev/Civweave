import { CivweaveCloudNode as BaseCloudNode } from './cloud-node-recovery-v1.mjs';
import { PassportAccountService } from '../../account-edge/src/hub-passport-account-v5.mjs';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const HEADERS = Object.freeze({ 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-civweave-node-id', 'access-control-max-age': '86400' });
function nodeIdFor(request) { const url = new URL(request.url); return clean(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'), 180).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
function response(payload, status = 200) { return Response.json(payload, { status, headers: HEADERS }); }
function errorPayload(error) {
  return {
    ok: false,
    error: String(error?.message || error),
    ...(error?.code ? { code: clean(error.code, 120) } : {}),
    ...(Array.isArray(error?.activeDevices) ? { activeDevices: error.activeDevices } : {}),
    ...(error?.account ? { account: error.account } : {}),
  };
}

export class CivweaveCloudNode extends BaseCloudNode {
  passportAccountService() { return new PassportAccountService(this.state, this.env, { vaultSecret: () => this.recoveryVaultSecret() }); }
  async internalSessionBinding(request) {
    const url = new URL(request.url);
    if (url.hostname !== 'node.internal' || request.method !== 'POST') return null;
    const input = await request.json().catch(() => ({})), service = this.passportAccountService();
    try {
      if (url.pathname === '/internal/account/session/bind') return response(await service.bindCapacitySession(input));
      if (url.pathname === '/internal/account/session/check') return response(await service.checkCapacitySession(input));
      return null;
    } catch (error) { return response(errorPayload(error), Number.isSafeInteger(error?.status) ? error.status : 500); }
  }
  async passportAccount(request, nodeId) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/account/')) return new Response(null, { status: 204, headers: HEADERS });
    if (request.method !== 'POST') return null;
    const input = await request.json().catch(() => ({})), service = this.passportAccountService();
    try {
      // Account security is intentionally available before Hub admission. A provisional
      // device identity consumes no seat until /session/authorize succeeds.
      if (url.pathname === '/api/account/passport-account/ensure') return response(await service.ensureAccount(nodeId, input));
      if (url.pathname === '/api/account/passkey/register/begin') return response(await service.beginPassportRegistration(input));
      if (url.pathname === '/api/account/passkey/register/finish') return response(await service.finishPassportRegistration(input));
      if (url.pathname === '/api/account/passkey/login/begin') return response(await service.beginLogin(input));
      if (url.pathname === '/api/account/passkey/login/finish') return response(await service.finishLogin(input));
      if (url.pathname === '/api/account/recovery-email/begin') return response(await service.beginRecoveryEmail(input));
      if (url.pathname === '/api/account/recovery-email/verify') return response(await service.verifyRecoveryEmail(nodeId, input));
      if (url.pathname === '/api/account/recovery-kit/ack') return response(await service.acknowledgeRecoveryKit(input));
      if (url.pathname === '/api/account/recovery-kit/regenerate') return response(await service.regenerateRecoveryKit(input));
      if (url.pathname === '/api/account/recovery-kit/complete') return response(await service.consumeRecoveryCode(input));
      if (url.pathname === '/api/account/totp/begin') return response(await service.beginTotp(input));
      if (url.pathname === '/api/account/totp/verify') return response(await service.verifyTotp(input));
      if (url.pathname === '/api/account/membership/readiness') return response(await service.membershipReadiness(input));
      if (url.pathname === '/api/account/session/authorize') return response(await service.authorizeSession(input));
      if (url.pathname === '/api/account/devices') return response(await service.listDevices(input));
      if (url.pathname === '/api/account/device/deactivate') return response(await service.deactivateDevice(input));
      if (url.pathname === '/api/account/device/remove') return response(await service.removeDevice(input));
      if (url.pathname === '/api/account/passport/detach') return response(await service.detachPassport(input));
      if (url.pathname === '/api/account/annual-member-rebate') return response(await service.setAnnualMemberRebateOptIn(input));
      if (url.pathname === '/api/account/passport-link/begin') return response(await service.beginPassportLink(nodeId, input));
      if (url.pathname === '/api/account/passport-link/authenticate') return response(await service.authenticatePassportLink(input));
      if (url.pathname === '/api/account/passport-link/finish') return response(await service.finishPassportLink(input));
      return null;
    } catch (error) { return response(errorPayload(error), Number.isSafeInteger(error?.status) ? error.status : 500); }
  }
  async fetch(request) {
    const internal = await this.internalSessionBinding(request);
    if (internal) return internal;
    const url = new URL(request.url), nodeId = nodeIdFor(request);
    if (nodeId && url.pathname.startsWith('/api/account/')) {
      const handled = await this.passportAccount(request, nodeId);
      if (handled) return handled;
    }
    return super.fetch(request);
  }
}
