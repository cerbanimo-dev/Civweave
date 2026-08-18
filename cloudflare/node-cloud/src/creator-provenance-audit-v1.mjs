import { runDailyProvenanceAudit } from '../../../lib/creator-provenance-audit-runner-v1.mjs';

const RECEIPT_KIND = 'civweave.creation-receipt.v1';
const RECEIPT_SCHEMA = 'civweave.creation-receipt-summary.v1';
const OBJECT_SCHEMA = 'civweave.community-object.v1';
const PREFIX = 'creator-provenance:';
const RECEIPT_PREFIX = `${PREFIX}receipt:`;
const AUDIT_PREFIX = `${PREFIX}audit:`;
const REQUEST_PREFIX = `${PREFIX}request:`;
const POLICY_KEY = `${PREFIX}policy`;
const LATEST_KEY = `${PREFIX}audit-latest`;
const enc = new TextEncoder();

const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
function normalized(value) { if (Array.isArray(value)) return value.map(normalized); if (value && typeof value === 'object') { const out = {}; for (const key of Object.keys(value).sort()) if (value[key] !== undefined) out[key] = normalized(value[key]); return out; } return value; }
const canonical = value => JSON.stringify(normalized(value));
function b64(bytes) { let binary = ''; for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function unb64(value) { const raw = String(value || '').replace(/-/g, '+').replace(/_/g, '/'), padded = raw + '='.repeat((4 - raw.length % 4) % 4), binary = atob(padded); return Uint8Array.from(binary, char => char.charCodeAt(0)); }
async function sha256(value) { const bytes = typeof value === 'string' ? enc.encode(value) : value; return b64(await crypto.subtle.digest('SHA-256', bytes)); }
function signableObject(object) { return { schema: object.schema, id: object.id, revision: object.revision, kind: object.kind, purpose: object.purpose, audience: object.audience, consent: object.consent, payload: object.payload, payloadHash: object.payloadHash, parentIds: object.parentIds, createdAt: object.createdAt, updatedAt: object.updatedAt, expiresAt: object.expiresAt, origin: object.origin, hopLimit: object.hopLimit }; }
async function verify(publicKey, value, signature) { try { const key = await crypto.subtle.importKey('jwk', publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(signature), enc.encode(canonical(value))); } catch { return false; } }

export async function validateCreationReceiptObject(object = {}) {
  if (object.schema !== OBJECT_SCHEMA || object.kind !== RECEIPT_KIND) return { valid: false, reason: 'unsupported-object' };
  if (object.payload?.schema !== RECEIPT_SCHEMA) return { valid: false, reason: 'unsupported-receipt' };
  if (!['public', 'federated'].includes(clean(object.consent, 40))) return { valid: false, reason: 'cloud-audit-requires-federated-receipt' };
  if (!object.origin?.credential || !object.signature || !object.revisionHash || !object.payloadHash) return { valid: false, reason: 'unsigned-object' };
  if (await sha256(canonical(object.payload)) !== object.payloadHash) return { valid: false, reason: 'payload-hash' };
  const signable = signableObject(object);
  if (await sha256(canonical(signable)) !== object.revisionHash) return { valid: false, reason: 'revision-hash' };
  if (!await verify(object.origin.credential, signable, object.signature)) return { valid: false, reason: 'signature' };
  const fingerprint = (await sha256(canonical(object.origin.credential))).slice(0, 24);
  if (clean(object.origin.fingerprint, 80) !== fingerprint || clean(object.origin.nodeId, 180) !== `device:${fingerprint}`) return { valid: false, reason: 'origin-identity' };
  const receipt = object.payload;
  if (!clean(receipt.sessionId, 240) || !clean(receipt.headHash, 128) || !clean(receipt.receiptHash, 128)) return { valid: false, reason: 'receipt-identity' };
  return { valid: true, receipt };
}

function receiptKey(receipt) { return `${RECEIPT_PREFIX}${clean(receipt.finalizedAt, 10) || 'undated'}:${clean(receipt.headHash, 128)}:${clean(receipt.receiptHash, 128)}`; }
function requestKey(deviceId, sampleId) { return `${REQUEST_PREFIX}${clean(deviceId, 180)}:${clean(sampleId, 700)}`; }
function hash32(value) { let hash = 2166136261; for (const char of String(value || '')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
export function nextAuditAlarm(nodeId, now = Date.now()) {
  const date = new Date(now), next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 3, hash32(nodeId) % 60, 0, 0));
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}
export function previousUtcDay(now = Date.now()) { const date = new Date(now); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); }

export async function ingestCreationReceipt(storage, nodeId, object, now = Date.now()) {
  const validation = await validateCreationReceiptObject(object);
  if (!validation.valid) throw Object.assign(new Error(`Creation receipt rejected: ${validation.reason}`), { status: 400 });
  const receipt = validation.receipt, key = receiptKey(receipt), existing = await storage.get(key);
  if (!existing) await storage.put(key, Object.freeze({
    schema: 'civweave.guild-creator-receipt.v1', nodeId: clean(nodeId, 180), receipt,
    communityObjectId: clean(object.id, 500), revisionHash: clean(object.revisionHash, 128),
    originDeviceId: clean(object.origin?.nodeId, 180), originCredential: object.origin?.credential,
    receivedAt: new Date(now).toISOString(),
  }));
  if (typeof storage.getAlarm === 'function' && typeof storage.setAlarm === 'function') { const alarm = await storage.getAlarm(); if (alarm == null) await storage.setAlarm(nextAuditAlarm(nodeId, now)); }
  return { stored: !existing, key, receipt };
}

async function storageList(storage, prefix) { const rows = await storage.list({ prefix }); return rows instanceof Map ? rows : new Map(Object.entries(rows || {})); }
async function receiptRecordsForDay(storage, dayKey) { return [...(await storageList(storage, `${RECEIPT_PREFIX}${dayKey}:`)).values()].filter(row => row?.receipt); }
export async function listReceiptsForDay(storage, dayKey) { return (await receiptRecordsForDay(storage, dayKey)).map(row => row.receipt); }
async function createAuditRequests(storage, nodeId, dayKey, result) {
  const records = await receiptRecordsForDay(storage, dayKey), byReceipt = new Map(records.map(row => [`${row.receipt.sessionId}|${row.receipt.headHash}`, row])), created = [];
  for (const item of result.work || []) {
    const source = byReceipt.get(`${item.reviewRequest?.receipt?.sessionId || item.sessionId}|${item.reviewRequest?.receipt?.headHash || item.analysis?.headHash || ''}`) || records.find(row => row.receipt.sessionId === item.sessionId);
    if (!source?.originDeviceId || !source?.originCredential) continue;
    const requestId = `audit-request:${clean(nodeId, 180)}:${clean(item.sampleId, 700)}`, key = requestKey(source.originDeviceId, item.sampleId), prior = await storage.get(key);
    if (prior) { created.push(prior); continue; }
    const row = Object.freeze({
      schema: 'civweave.creator-audit-device-request.v1', requestId, nodeId: clean(nodeId, 180), dayKey,
      sampleId: clean(item.sampleId, 700), sessionId: clean(item.sessionId, 240), deviceId: source.originDeviceId,
      deviceCredential: source.originCredential, receipt: source.receipt, reviewLane: clean(item.reviewLane, 40),
      priorityReason: clean(item.priorityReason, 80), reviewRequest: item.reviewRequest, status: 'pending-evidence',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await storage.put(key, row); created.push(row);
  }
  return created;
}
export async function runGuildDailyAudit(storage, nodeId, secretSalt, now = Date.now()) {
  const dayKey = previousUtcDay(now), receipts = await listReceiptsForDay(storage, dayKey), policy = await storage.get(POLICY_KEY) || {};
  const result = await runDailyProvenanceAudit({ guildId: nodeId, dayKey, secretSalt, receipts, policy, allowModelReview: policy.allowModelReview !== false });
  const requests = await createAuditRequests(storage, nodeId, dayKey, result);
  const record = Object.freeze({ schema: 'civweave.guild-creator-audit-record.v1', nodeId: clean(nodeId, 180), generatedAt: new Date(now).toISOString(), requestCount: requests.length, result });
  await storage.put({ [`${AUDIT_PREFIX}${dayKey}`]: record, [LATEST_KEY]: record });
  if (typeof storage.setAlarm === 'function') await storage.setAlarm(nextAuditAlarm(nodeId, now + 60_000));
  return record;
}
export async function listDeviceAuditRequests(storage, deviceId, { status = 'pending-evidence' } = {}) {
  const rows = [...(await storageList(storage, `${REQUEST_PREFIX}${clean(deviceId, 180)}:`)).values()];
  return rows.filter(row => !status || row?.status === status).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
export async function readAuditRequest(storage, deviceId, sampleId) { return await storage.get(requestKey(deviceId, sampleId)) || null; }
export async function updateAuditRequest(storage, deviceId, sampleId, patch = {}) {
  const key = requestKey(deviceId, sampleId), prior = await storage.get(key); if (!prior) return null;
  const next = Object.freeze({ ...prior, ...patch, deviceId: prior.deviceId, deviceCredential: prior.deviceCredential, receipt: prior.receipt, reviewRequest: prior.reviewRequest, updatedAt: new Date().toISOString() });
  await storage.put(key, next); return next;
}
export async function readLatestGuildAudit(storage) { return await storage.get(LATEST_KEY) || null; }
export async function setGuildAuditPolicy(storage, policy = {}) { const safe = { ...policy }; delete safe.secretSalt; delete safe.key; await storage.put(POLICY_KEY, safe); return safe; }
export async function pruneGuildAuditStorage(storage, now = Date.now(), { auditDays = 30, requestDays = 30, receiptDays = 3650 } = {}) {
  const receiptCutoff = now - Math.max(30, receiptDays) * 86400000, auditCutoff = now - Math.max(7, auditDays) * 86400000, requestCutoff = now - Math.max(7, requestDays) * 86400000, deletes = [];
  for (const [key, row] of await storageList(storage, RECEIPT_PREFIX)) if (Date.parse(row?.receivedAt || 0) < receiptCutoff) deletes.push(key);
  for (const [key, row] of await storageList(storage, AUDIT_PREFIX)) if (key !== LATEST_KEY && Date.parse(row?.generatedAt || 0) < auditCutoff) deletes.push(key);
  for (const [key, row] of await storageList(storage, REQUEST_PREFIX)) if (Date.parse(row?.updatedAt || row?.createdAt || 0) < requestCutoff) deletes.push(key);
  if (deletes.length) await storage.delete(deletes);
  return { deleted: deletes.length };
}

export const CREATOR_PROVENANCE_AUDIT_KEYS = Object.freeze({ PREFIX, RECEIPT_PREFIX, AUDIT_PREFIX, REQUEST_PREFIX, POLICY_KEY, LATEST_KEY });
