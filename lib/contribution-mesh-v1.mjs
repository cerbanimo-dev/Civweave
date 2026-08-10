import { createHash, webcrypto } from 'node:crypto';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const subtle = webcrypto.subtle;
const encoder = new TextEncoder();

export const CONTRIBUTION_MESH_PROTOCOL = 'civweave.contribution-mesh.v1';
export const CONTRIBUTION_MESH_EVENT_PROTOCOL = 'civweave.contribution-event.v1';
export const CONTRIBUTION_MESH_ENVELOPE_PROTOCOL = 'civweave.contribution-mesh-envelope.v1';
export const TRANSFER_PROTOCOL = 'civweave.transfer.v1';
export const TRANSFER_ASSETS = Object.freeze(['BUTTON', 'ACORN']);

function clone(value) { return value == null ? value : structuredClone(value); }
function nowIso() { return new Date().toISOString(); }
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, normalized(value[key])]));
  }
  return value;
}
export function canonicalJson(value) { return JSON.stringify(normalized(value)); }
export function hashObject(value) { return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`; }
export function eventBody(event) {
  const body = clone(event || {});
  delete body.hash;
  return body;
}
export function verifyEventHash(event) { return Boolean(event?.hash) && hashObject(eventBody(event)) === event.hash; }

function base64url(bytes) { return Buffer.from(bytes).toString('base64url'); }
function fromBase64url(value) { return Buffer.from(String(value || ''), 'base64url'); }

function identityIdForPublicKey(prefix, publicKey) {
  return `${prefix}:${hashObject(publicKey).slice('sha256:'.length, 'sha256:'.length + 24)}`;
}
export function deviceIdForPublicKey(publicKey) { return identityIdForPublicKey('device', publicKey); }
export function walletIdForPublicKey(publicKey) { return identityIdForPublicKey('wallet', publicKey); }

async function createIdentity(prefix, explicitId) {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = await subtle.exportKey('jwk', pair.publicKey);
  const privateKey = await subtle.exportKey('jwk', pair.privateKey);
  const derived = identityIdForPublicKey(prefix, publicKey);
  if (explicitId && explicitId !== derived) throw new Error(`${prefix} identity id must match its public key`);
  return Object.freeze({ id: derived, publicKey, privateKey });
}

export async function createDeviceIdentity({ deviceId } = {}) {
  const identity = await createIdentity('device', deviceId);
  return Object.freeze({ deviceId: identity.id, publicKey: identity.publicKey, privateKey: identity.privateKey });
}

export async function createWalletIdentity({ walletId } = {}) {
  const identity = await createIdentity('wallet', walletId);
  return Object.freeze({ walletId: identity.id, publicKey: identity.publicKey, privateKey: identity.privateKey });
}

function signableEnvelope(envelope) {
  return { schema: envelope.schema, event: envelope.event, signer: envelope.signer };
}

async function importPrivateKey(jwk) {
  return subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}
async function importPublicKey(jwk) {
  return subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

export async function signEventEnvelope(event, identity) {
  if (!verifyEventHash(event)) throw new Error('event hash is invalid');
  if (!identity?.deviceId || !identity?.publicKey || !identity?.privateKey) throw new TypeError('device identity is incomplete');
  const expectedDeviceId = deviceIdForPublicKey(identity.publicKey);
  if (identity.deviceId !== expectedDeviceId) throw new Error('device identity does not match its public key');
  const envelope = {
    schema: CONTRIBUTION_MESH_ENVELOPE_PROTOCOL,
    event: clone(event),
    signer: { deviceId: identity.deviceId, publicKey: clone(identity.publicKey) },
  };
  const key = await importPrivateKey(identity.privateKey);
  const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(canonicalJson(signableEnvelope(envelope))));
  return Object.freeze({ ...envelope, signature: base64url(signature) });
}

export async function verifyEventEnvelope(envelope) {
  try {
    if (envelope?.schema !== CONTRIBUTION_MESH_ENVELOPE_PROTOCOL) return { ok: false, error: 'unsupported envelope schema' };
    if (!verifyEventHash(envelope.event)) return { ok: false, error: 'event hash mismatch' };
    const expectedDeviceId = deviceIdForPublicKey(envelope.signer?.publicKey);
    if (!envelope.signer?.deviceId || envelope.signer.deviceId !== expectedDeviceId) return { ok: false, error: 'signer fingerprint mismatch' };
    const key = await importPublicKey(envelope.signer.publicKey);
    const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromBase64url(envelope.signature), encoder.encode(canonicalJson(signableEnvelope(envelope))));
    return ok ? { ok: true } : { ok: false, error: 'signature rejected' };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

function transferAuthorizationBody(payload) {
  return {
    protocol: payload.protocol,
    transferId: payload.transferId,
    fromId: payload.fromId,
    toId: payload.toId,
    asset: payload.asset,
    amount: payload.amount,
    spendNonce: payload.spendNonce,
  };
}

async function signWalletAuthorization(payload, walletIdentity) {
  if (!walletIdentity?.walletId || !walletIdentity?.publicKey || !walletIdentity?.privateKey) throw new TypeError('wallet identity is required');
  if (walletIdForPublicKey(walletIdentity.publicKey) !== walletIdentity.walletId) throw new Error('wallet identity does not match its public key');
  if (payload.fromId !== walletIdentity.walletId) throw new Error('transfer fromId does not match wallet identity');
  const key = await importPrivateKey(walletIdentity.privateKey);
  const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(canonicalJson(transferAuthorizationBody(payload))));
  return base64url(signature);
}

async function verifyWalletAuthorization(payload) {
  try {
    if (!payload.ownerPublicKey || !payload.ownerSignature) return false;
    if (walletIdForPublicKey(payload.ownerPublicKey) !== payload.fromId) return false;
    const key = await importPublicKey(payload.ownerPublicKey);
    return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromBase64url(payload.ownerSignature), encoder.encode(canonicalJson(transferAuthorizationBody(payload))));
  } catch { return false; }
}

export class MemoryContributionMeshStore {
  constructor() { this.rows = new Map(); this.meta = new Map(); }
  putEnvelope(envelope, { status = 'active', reason = null, receivedAt = nowIso() } = {}) {
    const hash = envelope.event.hash;
    if (!this.rows.has(hash)) this.rows.set(hash, { envelope: clone(envelope), status, reason, receivedAt });
    else {
      const row = this.rows.get(hash);
      row.envelope = clone(envelope);
      row.status = status;
      row.reason = reason;
    }
    return this.getEnvelope(hash);
  }
  getEnvelope(hash) { const row = this.rows.get(String(hash)); return row ? clone(row) : null; }
  hasEvent(hash) { return this.rows.has(String(hash)); }
  setStatus(hash, status, reason = null) { const row = this.rows.get(String(hash)); if (!row) return false; row.status = status; row.reason = reason; return true; }
  listEnvelopes({ status } = {}) { return [...this.rows.values()].filter((row) => !status || row.status === status).map(clone); }
  getMeta(key, fallback = null) { return this.meta.has(String(key)) ? clone(this.meta.get(String(key))) : fallback; }
  setMeta(key, value) { this.meta.set(String(key), clone(value)); return clone(value); }
  close() {}
}

export class SqliteContributionMeshStore {
  constructor({ databasePath }) {
    if (!databasePath) throw new TypeError('databasePath is required');
    this.databasePath = path.resolve(String(databasePath));
    mkdirSync(path.dirname(this.databasePath), { recursive: true });
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contribution_mesh_events (
        event_hash TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        signer_device_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active','orphan','rejected')),
        reason TEXT,
        envelope_json TEXT NOT NULL,
        received_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS contribution_mesh_status_idx ON contribution_mesh_events(status, received_at);
      CREATE TABLE IF NOT EXISTS contribution_mesh_meta (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
    `);
  }
  putEnvelope(envelope, { status = 'active', reason = null, receivedAt = nowIso() } = {}) {
    const event = envelope.event;
    this.db.prepare(`
      INSERT INTO contribution_mesh_events(event_hash,event_type,signer_device_id,status,reason,envelope_json,received_at)
      VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(event_hash) DO UPDATE SET status=excluded.status,reason=excluded.reason,envelope_json=excluded.envelope_json
    `).run(event.hash, String(event.type || 'Unknown'), String(envelope.signer?.deviceId || ''), status, reason, JSON.stringify(envelope), receivedAt);
    return this.getEnvelope(event.hash);
  }
  getEnvelope(hash) {
    const row = this.db.prepare('SELECT * FROM contribution_mesh_events WHERE event_hash = ?').get(String(hash));
    if (!row) return null;
    return { envelope: JSON.parse(row.envelope_json), status: row.status, reason: row.reason, receivedAt: row.received_at };
  }
  hasEvent(hash) { return Boolean(this.db.prepare('SELECT 1 AS yes FROM contribution_mesh_events WHERE event_hash = ?').get(String(hash))); }
  setStatus(hash, status, reason = null) {
    const result = this.db.prepare('UPDATE contribution_mesh_events SET status = ?, reason = ? WHERE event_hash = ?').run(status, reason, String(hash));
    return Number(result.changes || 0) > 0;
  }
  listEnvelopes({ status } = {}) {
    const rows = status
      ? this.db.prepare('SELECT * FROM contribution_mesh_events WHERE status = ? ORDER BY received_at, event_hash').all(status)
      : this.db.prepare('SELECT * FROM contribution_mesh_events ORDER BY received_at, event_hash').all();
    return rows.map((row) => ({ envelope: JSON.parse(row.envelope_json), status: row.status, reason: row.reason, receivedAt: row.received_at }));
  }
  getMeta(key, fallback = null) {
    const row = this.db.prepare('SELECT value_json FROM contribution_mesh_meta WHERE key = ?').get(String(key));
    return row ? JSON.parse(row.value_json) : fallback;
  }
  setMeta(key, value) {
    this.db.prepare('INSERT INTO contribution_mesh_meta(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json').run(String(key), JSON.stringify(value));
    return clone(value);
  }
  close() { this.db.close(); }
}

function normalizeTransferAsset(asset) {
  const normalizedAsset = String(asset || '').toUpperCase();
  if (!TRANSFER_ASSETS.includes(normalizedAsset)) throw new TypeError(`unsupported transfer asset: ${normalizedAsset || '(empty)'}`);
  return normalizedAsset;
}
function positiveAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new TypeError('transfer amount must be a positive finite number');
  return amount;
}
function nonNegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new TypeError(`${label} must be a non-negative safe integer`);
  return number;
}

export class ContributionMeshReplica {
  constructor({ store = new MemoryContributionMeshStore(), identity, finalityWitnesses = 2, now = nowIso } = {}) {
    if (!identity?.deviceId || !identity?.publicKey || !identity?.privateKey) throw new TypeError('identity is required');
    this.store = store;
    this.identity = identity;
    this.finalityWitnesses = Math.max(1, nonNegativeInteger(finalityWitnesses, 'finalityWitnesses'));
    this.now = now;
  }

  async nextSequence() {
    const key = `sequence:${this.identity.deviceId}`;
    const next = Number(this.store.getMeta(key, 0)) + 1;
    this.store.setMeta(key, next);
    return next;
  }

  async createEvent(type, payload, parents = []) {
    const body = {
      protocol: CONTRIBUTION_MESH_EVENT_PROTOCOL,
      type: String(type),
      payload: clone(payload ?? {}),
      parents: [...new Set((parents || []).map(String).filter(Boolean))].sort(),
      nodeId: this.identity.deviceId,
      createdAt: this.now(),
      sequence: await this.nextSequence(),
    };
    return Object.freeze({ ...body, hash: hashObject(body) });
  }

  async publishEvent(event) {
    const envelope = await signEventEnvelope(event, this.identity);
    await this.ingestEnvelope(envelope);
    return envelope;
  }

  async append(type, payload, parents = []) { return this.publishEvent(await this.createEvent(type, payload, parents)); }

  getRecord(hash) { return this.store.getEnvelope(String(hash)); }
  activeRecords() { return this.store.listEnvelopes({ status: 'active' }); }
  orphanRecords() { return this.store.listEnvelopes({ status: 'orphan' }); }
  activeEvents() { return this.activeRecords().map((row) => row.envelope.event); }

  hasActiveEvent(hash) { return this.store.getEnvelope(String(hash))?.status === 'active'; }
  missingParents(event) { return (event.parents || []).filter((hash) => !this.hasActiveEvent(hash)); }

  #transferPendingEvents() { return this.activeRecords().filter((row) => row.envelope.event.type === 'TransferPending'); }
  #transferFinalizationEvents() { return this.activeRecords().filter((row) => row.envelope.event.type === 'TransferFinalized'); }
  #transferWitnessEvents() { return this.activeRecords().filter((row) => row.envelope.event.type === 'TransferWitnessed'); }

  #pendingForTransfer(transferId) {
    return this.#transferPendingEvents().find((row) => row.envelope.event.payload?.transferId === String(transferId)) || null;
  }
  #spendKey(payload) { return `${payload.fromId}\u0000${payload.asset}\u0000${payload.spendNonce}`; }
  #pendingWithSpendKey(key) { return this.#transferPendingEvents().filter((row) => this.#spendKey(row.envelope.event.payload || {}) === key); }
  #witnessesForHash(transferHash) { return this.#transferWitnessEvents().filter((row) => row.envelope.event.payload?.transferHash === transferHash); }
  #finalizationsForHash(transferHash) { return this.#transferFinalizationEvents().filter((row) => row.envelope.event.payload?.transferHash === transferHash); }

  finalizedOutgoingNonce(ownerId, asset) {
    const targetAsset = normalizeTransferAsset(asset);
    let max = 0;
    for (const row of this.#transferFinalizationEvents()) {
      const payload = row.envelope.event.payload || {};
      if (payload.fromId === ownerId && payload.asset === targetAsset) max = Math.max(max, Number(payload.spendNonce || 0));
    }
    return max;
  }

  nextSpendNonce(ownerId, asset) { return this.finalizedOutgoingNonce(String(ownerId), normalizeTransferAsset(asset)) + 1; }

  balance(ownerId, asset) {
    const owner = String(ownerId);
    const targetAsset = normalizeTransferAsset(asset);
    let total = 0;
    const countedTransfers = new Set();
    for (const row of this.activeRecords()) {
      const event = row.envelope.event;
      if (event.type === 'MintFinalized') {
        const payload = event.payload || {};
        if (String(payload.subjectId || '') !== owner) continue;
        for (const effect of payload.effects || []) if (String(effect.asset || '').toUpperCase() === targetAsset) total += Number(effect.amount || 0);
      }
      if (event.type === 'TransferFinalized') {
        const payload = event.payload || {};
        const transferHash = String(payload.transferHash || '');
        if (!transferHash || countedTransfers.has(transferHash)) continue;
        countedTransfers.add(transferHash);
        if (payload.asset !== targetAsset) continue;
        if (payload.fromId === owner) total -= Number(payload.amount || 0);
        if (payload.toId === owner) total += Number(payload.amount || 0);
      }
    }
    return total;
  }

  availableBalance(ownerId, asset) {
    const owner = String(ownerId);
    const targetAsset = normalizeTransferAsset(asset);
    const locks = new Map();
    for (const row of this.#transferPendingEvents()) {
      const payload = row.envelope.event.payload || {};
      if (payload.fromId !== owner || payload.asset !== targetAsset) continue;
      const status = this.transferStatus(payload.transferId);
      if (!['pending', 'ready', 'conflict'].includes(status.status)) continue;
      const key = this.#spendKey(payload);
      locks.set(key, Math.max(locks.get(key) || 0, Number(payload.amount || 0)));
    }
    return Math.max(0, this.balance(owner, targetAsset) - [...locks.values()].reduce((sum, amount) => sum + amount, 0));
  }

  transferStatus(transferId) {
    const pending = this.#pendingForTransfer(transferId);
    if (!pending) return { transferId: String(transferId), status: 'unknown', finalized: false, conflict: false, witnessCount: 0 };
    const event = pending.envelope.event;
    const payload = event.payload || {};
    const conflictRows = this.#pendingWithSpendKey(this.#spendKey(payload));
    const conflict = conflictRows.some((row) => row.envelope.event.hash !== event.hash);
    const witnessRows = this.#witnessesForHash(event.hash);
    const witnesses = new Set(witnessRows.map((row) => row.envelope.signer.deviceId).filter((id) => id && id !== pending.envelope.signer.deviceId));
    const finalized = this.#finalizationsForHash(event.hash).length > 0;
    let status = 'pending';
    if (finalized && conflict) status = 'disputed-final';
    else if (finalized) status = 'final';
    else if (conflict) status = 'conflict';
    else if (witnesses.size >= this.finalityWitnesses) status = 'ready';
    return {
      transferId: String(transferId), transferHash: event.hash, status, finalized, conflict,
      witnessCount: witnesses.size, requiredWitnesses: this.finalityWitnesses, witnesses: [...witnesses].sort(),
      spendNonce: Number(payload.spendNonce), fromId: payload.fromId, toId: payload.toId, asset: payload.asset, amount: Number(payload.amount),
    };
  }

  async #semanticCheck(envelope) {
    const event = envelope.event;
    const payload = event.payload || {};
    if (event.type === 'TransferPending') {
      if (payload.protocol !== TRANSFER_PROTOCOL) return { ok: false, error: 'unsupported transfer protocol' };
      if (!payload.transferId || !payload.fromId || !payload.toId) return { ok: false, error: 'transfer identity fields are required' };
      try { normalizeTransferAsset(payload.asset); positiveAmount(payload.amount); nonNegativeInteger(payload.spendNonce, 'spendNonce'); }
      catch (error) { return { ok: false, error: error.message }; }
      if (!await verifyWalletAuthorization(payload)) return { ok: false, error: 'wallet authorization rejected' };
      return { ok: true };
    }
    if (event.type === 'TransferWitnessed') {
      const transferHash = String(payload.transferHash || '');
      const pending = this.getRecord(transferHash);
      if (!transferHash || pending?.status !== 'active' || pending.envelope.event.type !== 'TransferPending') return { ok: false, error: 'witness references an unavailable transfer' };
      if (!(event.parents || []).includes(transferHash)) return { ok: false, error: 'witness must causally parent the transfer' };
      if (payload.witnessDeviceId !== envelope.signer.deviceId) return { ok: false, error: 'witness device does not match signer' };
      if (pending.envelope.signer.deviceId === envelope.signer.deviceId) return { ok: false, error: 'origin device cannot witness its own transfer' };
      return { ok: true };
    }
    if (event.type === 'TransferFinalized') {
      const transferHash = String(payload.transferHash || '');
      const pending = this.getRecord(transferHash);
      if (!transferHash || pending?.status !== 'active' || pending.envelope.event.type !== 'TransferPending') return { ok: false, error: 'finalization references an unavailable transfer' };
      if (!(event.parents || []).includes(transferHash)) return { ok: false, error: 'finalization must causally parent the transfer' };
      const transferPayload = pending.envelope.event.payload || {};
      const conflict = this.#pendingWithSpendKey(this.#spendKey(transferPayload)).some((row) => row.envelope.event.hash !== transferHash);
      if (conflict) return { ok: false, error: 'conflicting spend nonce prevents finality' };
      const witnessRows = this.#witnessesForHash(transferHash).filter((row) => (event.parents || []).includes(row.envelope.event.hash));
      const witnesses = new Set(witnessRows.map((row) => row.envelope.signer.deviceId).filter((id) => id && id !== pending.envelope.signer.deviceId));
      if (witnesses.size < this.finalityWitnesses) return { ok: false, error: 'insufficient independent transfer witnesses' };
      for (const key of ['fromId','toId','asset','amount','spendNonce']) if (payload[key] !== transferPayload[key]) return { ok: false, error: `finalization ${key} does not match transfer` };
      return { ok: true };
    }
    return { ok: true };
  }

  async ingestEnvelope(envelope, { receivedAt = this.now() } = {}) {
    const cryptographic = await verifyEventEnvelope(envelope);
    if (!cryptographic.ok) throw new Error(cryptographic.error);
    const hash = envelope.event.hash;
    const prior = this.store.getEnvelope(hash);
    if (prior?.status === 'active') return { status: 'duplicate', hash };
    const missing = this.missingParents(envelope.event);
    if (missing.length) {
      this.store.putEnvelope(envelope, { status: 'orphan', reason: `missing parents: ${missing.join(',')}`, receivedAt });
      return { status: 'orphan', hash, missingParents: missing };
    }
    const semantic = await this.#semanticCheck(envelope);
    if (!semantic.ok) {
      this.store.putEnvelope(envelope, { status: 'rejected', reason: semantic.error, receivedAt });
      return { status: 'rejected', hash, error: semantic.error };
    }
    this.store.putEnvelope(envelope, { status: 'active', reason: null, receivedAt });
    await this.reconcileOrphans();
    return { status: 'active', hash };
  }

  async reconcileOrphans() {
    let promoted = 0;
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of this.orphanRecords()) {
        const event = row.envelope.event;
        if (this.missingParents(event).length) continue;
        const semantic = await this.#semanticCheck(row.envelope);
        if (!semantic.ok) {
          this.store.setStatus(event.hash, 'rejected', semantic.error);
          changed = true;
          continue;
        }
        this.store.setStatus(event.hash, 'active', null);
        promoted += 1;
        changed = true;
      }
    }
    return { promoted };
  }

  async createPendingTransfer({ transferId, walletIdentity, fromId = walletIdentity?.walletId, toId, asset, amount, spendNonce, parents = [] }) {
    const normalizedAsset = normalizeTransferAsset(asset);
    const normalizedAmount = positiveAmount(amount);
    const owner = String(fromId || '').trim();
    const recipient = String(toId || '').trim();
    if (!owner || !recipient) throw new TypeError('fromId and toId are required');
    const nonce = spendNonce == null ? this.nextSpendNonce(owner, normalizedAsset) : nonNegativeInteger(spendNonce, 'spendNonce');
    if (nonce !== this.nextSpendNonce(owner, normalizedAsset)) throw new Error('transfer nonce must be the next finalized spend nonce');
    if (this.availableBalance(owner, normalizedAsset) < normalizedAmount) throw new Error(`insufficient available ${normalizedAsset} balance`);
    const id = String(transferId || `transfer:${hashObject({ owner, recipient, normalizedAsset, normalizedAmount, nonce, deviceId: this.identity.deviceId, at: this.now() })}`).slice(0, 220);
    const transfer = {
      protocol: TRANSFER_PROTOCOL, transferId: id, fromId: owner, toId: recipient, asset: normalizedAsset,
      amount: normalizedAmount, spendNonce: nonce, ownerPublicKey: clone(walletIdentity?.publicKey),
    };
    transfer.ownerSignature = await signWalletAuthorization(transfer, walletIdentity);
    return this.append('TransferPending', transfer, parents);
  }

  async witnessTransfer(transferId) {
    const pending = this.#pendingForTransfer(transferId);
    if (!pending) throw new Error(`unknown transfer: ${transferId}`);
    const event = pending.envelope.event;
    const payload = event.payload || {};
    if (pending.envelope.signer.deviceId === this.identity.deviceId) throw new Error('origin device cannot witness its own transfer');
    const status = this.transferStatus(transferId);
    if (status.conflict) throw new Error('conflicting spend nonce prevents witnessing');
    if (payload.spendNonce !== this.nextSpendNonce(payload.fromId, payload.asset)) throw new Error('transfer is not at the current spend nonce');
    const balance = this.balance(payload.fromId, payload.asset);
    if (balance < Number(payload.amount)) throw new Error('transfer owner does not have sufficient finalized balance');
    const prior = this.#witnessesForHash(event.hash).find((row) => row.envelope.signer.deviceId === this.identity.deviceId);
    if (prior) return prior.envelope;
    return this.append('TransferWitnessed', {
      protocol: TRANSFER_PROTOCOL, transferId: payload.transferId, transferHash: event.hash,
      witnessDeviceId: this.identity.deviceId, observedBalance: balance, spendNonce: payload.spendNonce,
    }, [event.hash]);
  }

  async finalizeTransfer(transferId) {
    const pending = this.#pendingForTransfer(transferId);
    if (!pending) throw new Error(`unknown transfer: ${transferId}`);
    const status = this.transferStatus(transferId);
    if (status.finalized) return this.#finalizationsForHash(status.transferHash)[0]?.envelope || null;
    if (status.status !== 'ready') throw new Error(`transfer is not ready for finality: ${status.status}`);
    const payload = pending.envelope.event.payload;
    const witnesses = this.#witnessesForHash(pending.envelope.event.hash)
      .filter((row) => row.envelope.signer.deviceId !== pending.envelope.signer.deviceId)
      .sort((a, b) => a.envelope.event.hash.localeCompare(b.envelope.event.hash));
    const chosen = [];
    const seen = new Set();
    for (const row of witnesses) {
      const deviceId = row.envelope.signer.deviceId;
      if (seen.has(deviceId)) continue;
      seen.add(deviceId);
      chosen.push(row.envelope.event.hash);
      if (chosen.length >= this.finalityWitnesses) break;
    }
    return this.append('TransferFinalized', {
      protocol: TRANSFER_PROTOCOL, transferId: payload.transferId, transferHash: pending.envelope.event.hash,
      fromId: payload.fromId, toId: payload.toId, asset: payload.asset, amount: payload.amount,
      spendNonce: payload.spendNonce, witnessHashes: chosen,
    }, [pending.envelope.event.hash, ...chosen]);
  }

  frontier() {
    const active = this.activeEvents();
    const parented = new Set(active.flatMap((event) => event.parents || []));
    return active.filter((event) => !parented.has(event.hash)).map((event) => event.hash).sort();
  }

  exportBundle() {
    return {
      schema: CONTRIBUTION_MESH_PROTOCOL,
      exportedAt: this.now(),
      fromDeviceId: this.identity.deviceId,
      envelopes: this.store.listEnvelopes().filter((row) => row.status !== 'rejected').map((row) => row.envelope),
    };
  }

  async importBundle(bundle) {
    if (bundle?.schema !== CONTRIBUTION_MESH_PROTOCOL || !Array.isArray(bundle.envelopes)) throw new Error('unsupported contribution mesh bundle');
    const results = [];
    for (const envelope of bundle.envelopes) {
      try { results.push(await this.ingestEnvelope(envelope)); }
      catch (error) { results.push({ status: 'rejected', hash: envelope?.event?.hash || null, error: error.message }); }
    }
    return results;
  }
}
