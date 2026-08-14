import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { HubAccountRecoveryInboundService } from '../cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs';

const cryptoApi = globalThis.crypto || webcrypto;
const encoder = new TextEncoder();
async function emailHash(email) {
  const normalized = String(email).trim().toLowerCase();
  const digest = await cryptoApi.subtle.digest('SHA-256', encoder.encode(`civweave.hub-inbound-email-address.v1\n${normalized}`));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

class MemoryStorage {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.get(key); }
  async put(key, value) {
    if (key && typeof key === 'object' && !Array.isArray(key)) {
      for (const [name, item] of Object.entries(key)) this.map.set(name, item);
      return;
    }
    this.map.set(key, value);
  }
}

const relay = new Map();
const priorFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const target = new URL(String(url));
  assert.equal(target.origin, 'https://relay.test');
  const input = JSON.parse(String(init.body || '{}'));
  if (target.pathname === '/api/recovery-proof/status') {
    return Response.json(relay.get(input.token) || { ok: true, approved: false });
  }
  // Production relay proofs are not publicly consumable. Hubs enforce local
  // one-time use and the relay expires its email-hash proofs automatically.
  return Response.json({ ok: false, error: 'not-found' }, { status: 404 });
};

try {
  const storage = new MemoryStorage();
  const service = new HubAccountRecoveryInboundService(
    { storage },
    {
      HUB_RECOVERY_INBOUND_EMAIL: 'recover@recovery.commonweave.earth',
      HUB_RECOVERY_RELAY_URL: 'https://relay.test',
    },
    { vaultSecret: 'test-recovery-vault-secret-that-is-long-enough' },
  );

  const nodeId = 'garden-hub-a';
  const userId = 'resident:test-user-0001';
  const credential = 'A'.repeat(43);
  const email = 'person@example.com';
  const passportId = 'passport.test-1';

  const signup = await service.signup(nodeId, { userId, credential, email, passportId });
  assert.equal(signup.delivery.transport, 'inbound-email-proof');
  assert.equal(signup.delivery.mailbox, 'recover@recovery.commonweave.earth');
  assert.match(signup.delivery.subject, /^Civweave Hub verify-email /);
  assert.ok(!signup.delivery.subject.includes(nodeId), 'relay message must not expose the Hub/node id');
  await assert.rejects(
    () => service.completeInboundVerification(nodeId, signup.delivery.proofToken),
    /Send the prefilled recovery email/,
  );

  relay.set(signup.delivery.proofToken, {
    ok: true,
    approved: true,
    purpose: 'verify-email',
    emailHash: await emailHash(email),
  });
  assert.deepEqual(await service.completeInboundVerification(nodeId, signup.delivery.proofToken), { ok: true, verified: true });
  const status = await service.status({ userId, credential });
  assert.equal(status.account.emailVerified, true);
  assert.deepEqual(status.account.passportIds, [passportId]);
  await assert.rejects(
    () => service.completeInboundVerification(nodeId, signup.delivery.proofToken),
    /already used/,
  );

  const known = await service.requestRecoveryForNode(nodeId, { email });
  const unknownEmail = 'nobody@example.net';
  const unknown = await service.requestRecoveryForNode(nodeId, { email: unknownEmail });
  assert.equal(known.accepted, true);
  assert.equal(unknown.accepted, true);
  assert.equal(known.message, unknown.message);
  assert.equal(known.delivery.transport, unknown.delivery.transport);
  assert.deepEqual(Object.keys(known).sort(), Object.keys(unknown).sort());

  relay.set(known.delivery.proofToken, {
    ok: true,
    approved: true,
    purpose: 'recover-account',
    emailHash: await emailHash(email),
  });
  const recovered = await service.completeInboundRecovery(nodeId, known.delivery.proofToken);
  assert.equal(recovered.userId, userId);
  assert.equal(recovered.credential, credential);
  assert.deepEqual(recovered.passportIds, [passportId]);
  await assert.rejects(
    () => service.completeInboundRecovery(nodeId, known.delivery.proofToken),
    /already used/,
  );

  relay.set(unknown.delivery.proofToken, {
    ok: true,
    approved: true,
    purpose: 'recover-account',
    emailHash: await emailHash(unknownEmail),
  });
  await assert.rejects(
    () => service.completeInboundRecovery(nodeId, unknown.delivery.proofToken),
    /No recoverable Hub account was confirmed/,
  );

  const wrong = await service.requestRecoveryForNode(nodeId, { email });
  relay.set(wrong.delivery.proofToken, {
    ok: true,
    approved: true,
    purpose: 'recover-account',
    emailHash: await emailHash('attacker@example.org'),
  });
  await assert.rejects(
    () => service.completeInboundRecovery(nodeId, wrong.delivery.proofToken),
    /does not match this Hub recovery request/,
  );

  for (const proof of relay.values()) {
    assert.equal('userId' in proof, false, 'relay proof must never carry a Hub resident id');
    assert.equal('passportIds' in proof, false, 'relay proof must never carry Passport associations');
  }

  console.log(JSON.stringify({ ok: true, schema: 'civweave.hub-recovery-relay-test.v1', relayStoresIdentity: false, localOneTimeUse: true }));
} finally {
  globalThis.fetch = priorFetch;
}
