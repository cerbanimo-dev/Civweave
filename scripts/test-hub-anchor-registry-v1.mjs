import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  CivweaveAnchorRegistry,
  ANCHOR_PAIR_DOMAIN,
  ANCHOR_SYNC_DOMAIN,
  ANCHOR_PROOF_DOMAIN,
  ANCHOR_RECEIPT_DOMAIN,
} from '../cloudflare/node-cloud/src/anchor-registry.mjs';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.get(key); }
  async put(key, value) { this.map.set(key, structuredClone(value)); }
  async delete(key) { this.map.delete(key); }
  async list({ prefix = '' } = {}) { return new Map([...this.map].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key, structuredClone(value)])); }
}
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
const pair = crypto.generateKeyPairSync('ed25519');
const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const sign = message => crypto.sign(null, Buffer.from(message), pair.privateKey).toString('base64url');

test('pairs, stores, proves, and issues an idempotent weekly Button receipt', async () => {
  const registry = new CivweaveAnchorRegistry({ storage: new MemoryStorage() }, {});
  const nodeId = 'garden-hub';
  const grant = await registry.startPairing({ nodeId, recipientId: 'passport:cami', displayName: 'Laptop Anchor' });
  const paired = await registry.pair({ nodeId, grant: grant.token, signingPublicKey: publicKey, signature: sign(`${ANCHOR_PAIR_DOMAIN}\n${nodeId}\n${grant.token}`) });
  assert.equal(paired.paired, true);

  const checkpoint = await registry.publishCheckpoint({ nodeId, recoveryCoverageBps: 10000, nodeManifest: { nodeId }, ledgerFrontier: { head: 'abc' } });
  assert.equal(checkpoint.continuityAnchors.length, 1);
  assert.ok(checkpoint.signature);

  const timestamp = Date.now();
  const sync = await registry.sync({ nodeId, anchorId: paired.anchor.anchorId, timestamp, signature: sign(`${ANCHOR_SYNC_DOMAIN}\n${nodeId}\n${paired.anchor.anchorId}\n${timestamp}`) });
  const c = sync.challenge;
  const proofMessage = `${ANCHOR_PROOF_DOMAIN}\n${c.challengeId}\n${nodeId}\n${paired.anchor.anchorId}\n${c.checkpointId}\n${c.checkpointHash}\n${c.nonce}`;
  const proof = await registry.prove({ nodeId, anchorId: paired.anchor.anchorId, challengeId: c.challengeId, signature: sign(proofMessage), recoveryCoverageBps: 10000 });
  assert.equal(proof.health.healthy, true);

  const payout = await registry.runStipends(nodeId, Date.now());
  assert.equal(payout.created.length, 1);
  assert.equal(payout.created[0].currency, 'button');
  assert.equal(payout.created[0].amount, 3);
  assert.equal(payout.created[0].recipientId, 'passport:cami');
  assert.ok(payout.created[0].signature);

  const duplicate = await registry.runStipends(nodeId, Date.now());
  assert.equal(duplicate.created[0].idempotent, true);

  const trust = await registry.identity();
  const verifyKey = crypto.createPublicKey(trust.publicKey);
  const { signature, keyId, idempotent, ...unsigned } = payout.created[0];
  assert.ok(keyId);
  assert.equal(crypto.verify(null, Buffer.from(`${ANCHOR_RECEIPT_DOMAIN}\n${canonical(unsigned)}`), verifyKey, Buffer.from(signature, 'base64url')), true);
});
