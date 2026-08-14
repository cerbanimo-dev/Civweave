import { PassportAccountService as BasePassportAccountService, HUB_ACCOUNT_POLICY } from './hub-passport-account-v3.mjs';

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const accountKey = accountId => `hub-account:${clean(accountId, 180)}`;

export { HUB_ACCOUNT_POLICY };

export class PassportAccountService extends BasePassportAccountService {
  async regenerateRecoveryKit(input = {}) {
    let account = await this.assertCredential(input);
    account = Object.freeze({ ...account, recoveryKitRegenerateRequestedAt: new Date(this.now()).toISOString(), updatedAt: new Date(this.now()).toISOString() });
    await this.state.storage.put(accountKey(account.accountId), account);
    const packet = await this.issueRecoveryKit(account);
    return Object.freeze({
      ok: true,
      recoveryKit: packet.recoveryKit,
      account: (await this.membershipReadiness(input)).account,
    });
  }
  async finishPassportLink(input = {}) {
    const packet = await super.finishPassportLink(input);
    if ((packet?.passportIds || packet?.account?.passportIds || []).length > HUB_ACCOUNT_POLICY.maxPassports) {
      throw Object.assign(new RangeError('This account has reached its Passport association limit.'), { status: 409 });
    }
    return packet;
  }
}
