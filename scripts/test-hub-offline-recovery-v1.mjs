import assert from 'node:assert/strict';
import { HubAccountRecoveryOfflineService, HUB_OFFLINE_RECOVERY_CODE_COUNT } from '../cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs';

class Storage {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.get(key); }
  async put(key, value) {
    if (key && typeof key === 'object' && value === undefined) {
      for (const [name, item] of Object.entries(key)) this.map.set(name, structuredClone(item));
      return;
    }
    this.map.set(key, structuredClone(value));
  }
  async delete(key) { return this.map.delete(key); }
}

const storage = new Storage();
let now = Date.parse('2026-08-14T05:00:00Z');
const service = new HubAccountRecoveryOfflineService(
  { storage },
  {},
  {
    vaultSecret: 'offline-recovery-test-vault-secret-1234567890',
    now: () => now,
    deliver: async () => ({ sent: false, transport: 'unconfigured' }),
  },
);
service.mailbox = () => '';

const credential = 'q'.repeat(48);
const userId = 'cwres:offline-resident-123456';
const signup = await service.signup('garden-offline', {
  userId,
  credential,
  email: 'offline@example.com',
  passportId: 'passport:offline-alpha',
});

assert.equal(signup.account.emailVerified, false, 'email may remain pending');
assert.equal(signup.account.offlineRecoveryReady, true);
assert.equal(signup.account.offlineRecoveryAcknowledged, false);
assert.equal(signup.account.fullyEstablished, false, 'unconfirmed recovery codes must not count as safely established');
assert.equal(signup.recoveryKit?.codes?.length, HUB_OFFLINE_RECOVERY_CODE_COUNT);
assert.equal(new Set(signup.recoveryKit.codes).size, HUB_OFFLINE_RECOVERY_CODE_COUNT);
assert.equal(signup.recoveryKit.acknowledgementRequired, true);
for (const code of signup.recoveryKit.codes) assert.match(code, /^[A-Za-z0-9_-]{40,200}$/);

let storageDump = JSON.stringify([...storage.map.entries()]);
for (const code of signup.recoveryKit.codes) assert.equal(storageDump.includes(code), false, 'plaintext recovery code must never be stored');
assert.equal(storageDump.includes(credential), false, 'plaintext device credential must remain encrypted at rest');

const firstUnconfirmedCode = signup.recoveryKit.codes[0];
const secondSignup = await service.signup('garden-offline', {
  userId,
  credential,
  email: 'offline@example.com',
  passportId: 'passport:offline-beta',
});
assert.equal(secondSignup.recoveryKit?.codes?.length, HUB_OFFLINE_RECOVERY_CODE_COUNT, 'an unconfirmed kit must be safely reissued');
assert.notDeepEqual(secondSignup.recoveryKit.codes, signup.recoveryKit.codes, 'reissued kit must be fresh');
await assert.rejects(() => service.completeRecovery(firstUnconfirmedCode), /invalid|expired|already used/i, 'reissue must invalidate the lost/unconfirmed kit');

storageDump = JSON.stringify([...storage.map.entries()]);
for (const code of secondSignup.recoveryKit.codes) assert.equal(storageDump.includes(code), false, 'reissued plaintext recovery code must never be stored');

const acknowledged = await service.acknowledgeOfflineRecovery(userId);
assert.equal(acknowledged.acknowledged, true);
assert.equal(acknowledged.account.offlineRecoveryAcknowledged, true);
assert.equal(acknowledged.account.fullyEstablished, true);

const thirdSignup = await service.signup('garden-offline', {
  userId,
  credential,
  email: 'offline@example.com',
  passportId: 'passport:offline-gamma',
});
assert.equal(thirdSignup.recoveryKit, null, 'acknowledged recovery codes must not be redisplayed or rotated on ordinary login');
assert.equal(thirdSignup.account.offlineRecoveryRemaining, HUB_OFFLINE_RECOVERY_CODE_COUNT);

const firstCode = secondSignup.recoveryKit.codes[0];
const restored = await service.completeRecovery(firstCode);
assert.equal(restored.recoveryMethod, 'offline-code');
assert.equal(restored.userId, userId);
assert.equal(restored.credential, credential);
assert.deepEqual(restored.passportIds, ['passport:offline-alpha', 'passport:offline-beta', 'passport:offline-gamma']);
assert.equal(restored.offlineRecoveryRemaining, HUB_OFFLINE_RECOVERY_CODE_COUNT - 1);
await assert.rejects(() => service.completeRecovery(firstCode), /invalid|expired|already used/i);

const status = await service.status({ userId, credential });
assert.equal(status.account.offlineRecoveryReady, true);
assert.equal(status.account.offlineRecoveryAcknowledged, true);
assert.equal(status.account.offlineRecoveryRemaining, HUB_OFFLINE_RECOVERY_CODE_COUNT - 1);
assert.equal(status.account.emailVerified, false);
assert.equal(status.account.fullyEstablished, true);

const secondCode = secondSignup.recoveryKit.codes[1];
now += 365 * 24 * 60 * 60 * 1000;
const later = await service.completeRecovery(secondCode);
assert.equal(later.credential, credential, 'offline recovery codes do not depend on an email TTL');
assert.equal(later.offlineRecoveryRemaining, HUB_OFFLINE_RECOVERY_CODE_COUNT - 2);

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.hub-offline-recovery-test.v2',
  codeCount: HUB_OFFLINE_RECOVERY_CODE_COUNT,
  plaintextStored: false,
  acknowledgementRequired: true,
  lostKitCanBeReissuedBeforeAcknowledgement: true,
  emailRequiredForOfflineRecovery: false,
}));
