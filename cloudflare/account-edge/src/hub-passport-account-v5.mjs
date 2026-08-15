import { PassportAccountService as BasePassportAccountService, HUB_ACCOUNT_POLICY } from './hub-passport-account-v4.mjs';

const enc = new TextEncoder();
const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const accountKey = accountId => `hub-account:${clean(accountId, 180)}`;
const recoveryCodeKey = hash => `hub-passport-recovery-code:${clean(hash, 128)}`;

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function normalizeRecoveryCode(value) {
  const code = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(code)) throw Object.assign(new TypeError('Recovery code is invalid.'), { status: 400 });
  return code;
}

export { HUB_ACCOUNT_POLICY };

export class PassportAccountService extends BasePassportAccountService {
  async consumeRecoveryCode(input = {}) {
    const code = normalizeRecoveryCode(input.code);
    const hash = await sha256Hex(`civweave.passport-recovery-code.v1\n${code}`);
    const record = await this.state.storage.get(recoveryCodeKey(hash));
    if (!record?.accountId) throw Object.assign(new Error('Recovery code is invalid or already used.'), { status: 404 });
    const account = await this.state.storage.get(accountKey(record.accountId));
    if (!account) throw Object.assign(new Error('Hub account is unavailable.'), { status: 404 });
    if (!account.totpVerifiedAt || !account.totpSecretVault) {
      throw Object.assign(new Error('Recovery-code sign-in requires authenticator 2FA. Use an existing account passkey instead.'), { status: 409, code: 'recovery-passkey-required' });
    }
    if (!await this.verifyExistingTotp(account, input.totpCode)) {
      throw Object.assign(new Error('Authenticator code did not match.'), { status: 403, code: 'totp-required' });
    }
    return super.consumeRecoveryCode(input);
  }
}
