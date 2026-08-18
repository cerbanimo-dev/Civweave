import assert from 'node:assert/strict';
import {
  ingestCreationReceipt, listDeviceAuditRequests, listReceiptsForDay, nextAuditAlarm, previousUtcDay,
  pruneGuildAuditStorage, readLatestGuildAudit, runGuildDailyAudit, setGuildAuditPolicy,
  validateCreationReceiptObject,
} from '../cloudflare/node-cloud/src/creator-provenance-audit-v1.mjs';
import { samplingScore } from '../lib/creator-provenance-audit-sampler-v1.mjs';

const enc = new TextEncoder();
const normalized = value => Array.isArray(value) ? value.map(normalized) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, normalized(value[key])])) : value;
const canonical = value => JSON.stringify(normalized(value));
const b64 = bytes => Buffer.from(bytes).toString('base64url');
const sha = async value => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(typeof value === 'string' ? value : canonical(value)))));
const signable = object => ({ schema: object.schema, id: object.id, revision: object.revision, kind: object.kind, purpose: object.purpose, audience: object.audience, consent: object.consent, payload: object.payload, payloadHash: object.payloadHash, parentIds: object.parentIds, createdAt: object.createdAt, updatedAt: object.updatedAt, expiresAt: object.expiresAt, origin: object.origin, hopLimit: object.hopLimit });

async function signedReceipt(day = '2026-08-17') {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey), fingerprint = (await sha(publicKey)).slice(0, 24);
  const payload = { schema: 'civweave.creation-receipt-summary.v1', sessionId: 'creation:test', mediaType: 'text', artifactType: 'document', eventCount: 3, headHash: 'head-hash', origin: 'human-authored', aiUsed: false, finalizedAt: `${day}T18:00:00.000Z`, receiptHash: 'receipt-hash' };
  const object = { schema: 'civweave.community-object.v1', id: 'creation-receipt:test', revision: 1, kind: 'civweave.creation-receipt.v1', purpose: 'receipt', audience: [], consent: 'federated', payload, payloadHash: await sha(payload), parentIds: [], createdAt: `${day}T18:00:00.000Z`, updatedAt: `${day}T18:00:00.000Z`, expiresAt: null, origin: { nodeId: `device:${fingerprint}`, credential: publicKey, fingerprint }, hopLimit: 4 };
  object.revisionHash = await sha(signable(object));
  object.signature = b64(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, enc.encode(canonical(signable(object))))));
  return object;
}

class Storage {
  constructor() { this.rows = new Map(); this.alarm = null; }
  async get(key) { return this.rows.get(key); }
  async put(key, value) { if (typeof key === 'object' && value === undefined) for (const [k, v] of Object.entries(key)) this.rows.set(k, v); else this.rows.set(key, value); }
  async list({ prefix = '' } = {}) { return new Map([...this.rows].filter(([key]) => key.startsWith(prefix))); }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.rows.delete(key); }
  async getAlarm() { return this.alarm; }
  async setAlarm(value) { this.alarm = Number(value); }
}

const now = Date.parse('2026-08-18T08:00:00.000Z'), object = await signedReceipt('2026-08-17');
assert.deepEqual(await validateCreationReceiptObject(object), { valid: true, receipt: object.payload });
const tampered = structuredClone(object); tampered.payload.eventCount = 99;
assert.equal((await validateCreationReceiptObject(tampered)).valid, false);
const privateObject = structuredClone(object); privateObject.consent = 'private';
assert.equal((await validateCreationReceiptObject(privateObject)).reason, 'cloud-audit-requires-federated-receipt');

const storage = new Storage();
const first = await ingestCreationReceipt(storage, 'guild:test', object, now);
assert.equal(first.stored, true);
assert.ok(storage.alarm > now);
assert.equal((await ingestCreationReceipt(storage, 'guild:test', object, now)).stored, false, 'same signed receipt must dedupe');
assert.equal((await listReceiptsForDay(storage, '2026-08-17')).length, 1);
const storedReceipt = [...storage.rows.values()].find(row => row?.schema === 'civweave.guild-creator-receipt.v1');
assert.equal(storedReceipt.originDeviceId, object.origin.nodeId);
assert.deepEqual(storedReceipt.originCredential, object.origin.credential, 'receipt record must retain only the public device credential needed to authenticate later evidence release');
assert.equal(previousUtcDay(now), '2026-08-17');
assert.ok(nextAuditAlarm('guild:test', now) > now);
await setGuildAuditPolicy(storage, { baseSampleRate: 0.25, maxDailySamples: 10, secretSalt: 'must-not-store' });
assert.equal(storage.rows.get('creator-provenance:policy').secretSalt, undefined);
let auditSalt = '';
for (let i = 0; i < 1000; i++) { const candidate = `guild-private-sampling-secret-v1-${i}`; if (await samplingScore(object.payload, { dayKey: '2026-08-17', secretSalt: candidate }) < 0.25) { auditSalt = candidate; break; } }
assert.ok(auditSalt, 'test vector must find a deterministic selected receipt');
const audit = await runGuildDailyAudit(storage, 'guild:test', auditSalt, now);
assert.equal(audit.result.guildId, 'guild:test');
assert.equal(audit.result.dayKey, '2026-08-17');
assert.equal(audit.result.eligibleCount, 1);
assert.equal(audit.result.selectedCount, 1);
assert.equal(audit.requestCount, 1);
assert.equal(audit.result.privacy.unselectedPacketsAccessed, false);
const requests = await listDeviceAuditRequests(storage, object.origin.nodeId);
assert.equal(requests.length, 1);
assert.equal(requests[0].sessionId, object.payload.sessionId);
assert.equal(requests[0].status, 'pending-evidence');
assert.deepEqual(requests[0].deviceCredential, object.origin.credential);
assert.equal((await readLatestGuildAudit(storage)).schema, 'civweave.guild-creator-audit-record.v1');

storage.rows.set('creator-provenance:audit:2000-01-01', { generatedAt: '2000-01-02T00:00:00.000Z' });
const pruned = await pruneGuildAuditStorage(storage, now, { auditDays: 30, receiptDays: 3650 });
assert.ok(pruned.deleted >= 1);

console.log('Cloudflare Guild provenance Durable Object audit contract passed');
