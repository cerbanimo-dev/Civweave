import { PassportAccountService as BasePassportAccountService, HUB_ACCOUNT_POLICY } from './hub-passport-account-v2.mjs';

const clean = (value, max = 20000) => String(value ?? '').trim().slice(0, max);
const accountKey = accountId => `hub-account:${clean(accountId, 180)}`;
const residentKey = userId => `hub-resident:${clean(userId, 180)}`;
const sessionKey = hash => `hub-capacity-session:${clean(hash, 128)}`;
const enc = new TextEncoder();

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function token(value) {
  const out = clean(value, 16000);
  if (out.length < 40) throw Object.assign(new TypeError('Capacity session token is invalid.'), { status: 400 });
  return out;
}
function deviceId(value) {
  const out = clean(value, 180);
  if (!/^[A-Za-z0-9:._-]{12,180}$/.test(out)) throw Object.assign(new TypeError('A valid device id is required.'), { status: 400 });
  return out;
}

export { HUB_ACCOUNT_POLICY };

export class PassportAccountService extends BasePassportAccountService {
  async accountForUserId(userId) {
    const id = await this.state.storage.get(residentKey(userId));
    return id ? this.state.storage.get(accountKey(id)) : null;
  }
  async bindCapacitySession(input = {}) {
    const account = await this.accountForUserId(input.userId);
    if (!account) throw Object.assign(new Error('Hub account is unavailable.'), { status: 404 });
    const id = deviceId(input.deviceId);
    const active = new Set(Array.isArray(account.activeDeviceIds) ? account.activeDeviceIds : []);
    if (!active.has(id)) throw Object.assign(new Error('This device is not active on the Hub account.'), { status: 403 });
    const rawToken = token(input.token), hash = await sha256Hex(`civweave.capacity-session-device.v1\n${rawToken}`);
    const expiresAt = clean(input.expiresAt, 80);
    await this.state.storage.put(sessionKey(hash), Object.freeze({
      schema: 'civweave.capacity-session-device.v1',
      accountId: account.accountId,
      userId: account.userId,
      deviceId: id,
      expiresAt: expiresAt || null,
      boundAt: new Date(this.now()).toISOString(),
    }));
    return Object.freeze({ ok: true, bound: true, deviceId: id });
  }
  async checkCapacitySession(input = {}) {
    const rawToken = token(input.token), hash = await sha256Hex(`civweave.capacity-session-device.v1\n${rawToken}`);
    const binding = await this.state.storage.get(sessionKey(hash));
    if (!binding) throw Object.assign(new Error('This Hub session predates device binding. Sign in again.'), { status: 401, code: 'session-device-rebind-required' });
    if (binding.expiresAt && Date.parse(binding.expiresAt) <= this.now()) {
      await this.state.storage.delete(sessionKey(hash));
      throw Object.assign(new Error('Hub session expired.'), { status: 401 });
    }
    const account = await this.state.storage.get(accountKey(binding.accountId));
    if (!account) throw Object.assign(new Error('Hub account is unavailable.'), { status: 401 });
    const active = new Set(Array.isArray(account.activeDeviceIds) ? account.activeDeviceIds : []);
    if (!active.has(binding.deviceId)) throw Object.assign(new Error('This device session was deactivated.'), { status: 401, code: 'device-session-deactivated' });
    return Object.freeze({ ok: true, active: true, accountId: account.accountId, userId: account.userId, deviceId: binding.deviceId });
  }
}
