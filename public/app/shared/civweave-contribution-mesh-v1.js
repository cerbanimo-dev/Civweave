(()=>{
'use strict';

const VERSION = '1.0.1';
const DB_NAME = 'civweave-contribution-mesh-v1';
const DB_VERSION = 1;

const EVENT_PROTOCOL = 'civweave.contribution-event.v1';
const ENVELOPE_PROTOCOL = 'civweave.contribution-mesh-envelope.v1';
const BUNDLE_PROTOCOL = 'civweave.contribution-mesh.v1';
const TRANSFER_PROTOCOL = 'civweave.transfer.v1';
const OBJECT_KIND = 'civweave.contribution.mesh-envelope.v1';
const TRANSFER_ASSETS = new Set(['BUTTON', 'ACORN']);

const listeners = new Set();
const encoder = new TextEncoder();

const now = () => new Date().toISOString();
const clone = (value) => value == null ? value : structuredClone(value);

function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) out[key] = normalized(value[key]);
    }
    return out;
  }
  return value;
}

function canonical(value) {
  return JSON.stringify(normalized(value));
}

function base64url(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value) {
  const raw = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256Hex(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashObject(value) {
  return `sha256:${await sha256Hex(canonical(value))}`;
}

function eventBody(event) {
  const body = clone(event || {});
  delete body.hash;
  return body;
}

async function verifyEventHash(event) {
  return Boolean(event?.hash) && await hashObject(eventBody(event)) === event.hash;
}

async function idForKey(prefix, publicKey) {
  return `${prefix}:${(await hashObject(publicKey)).slice(7, 31)}`;
}

async function deviceIdForKey(publicKey) {
  return idForKey('device', publicKey);
}

async function walletIdForKey(publicKey) {
  return idForKey('wallet', publicKey);
}

function emit(type, detail = {}) {
  const event = { type, detail, at: now() };
  for (const listener of listeners) {
    try { listener(event); } catch {}
  }
  try {
    dispatchEvent(new CustomEvent('civweave:contribution-mesh', { detail: event }));
  } catch {}
}

function mesh() {
  const api = globalThis.CivweaveLocalMeshV146;
  if (!api) throw new Error('CivweaveLocalMeshV146 is required');
  return api;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('events')) {
        const store = db.createObjectStore('events', { keyPath: 'eventHash' });
        store.createIndex('status', 'status');
        store.createIndex('type', 'type');
        store.createIndex('receivedAt', 'receivedAt');
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx(names, mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(names, mode);
    const stores = Object.fromEntries(
      names.map((name) => [name, transaction.objectStore(name)])
    );
    let result;
    try {
      result = work(stores, transaction);
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(
      transaction.error || new Error('Contribution mesh transaction aborted')
    );
  });
}

async function getRow(hash) {
  return tx(['events'], 'readonly', (stores) => req(stores.events.get(String(hash))));
}

async function listRows(status = null) {
  return tx(['events'], 'readonly', (stores) => (
    status
      ? req(stores.events.index('status').getAll(status))
      : req(stores.events.getAll())
  ));
}

async function putRow(envelope, status, reason = null) {
  const row = {
    eventHash: envelope.event.hash,
    type: String(envelope.event.type || 'Unknown'),
    signerDeviceId: String(envelope.signer?.deviceId || ''),
    status,
    reason,
    receivedAt: now(),
    envelope: clone(envelope),
  };
  await tx(['events'], 'readwrite', (stores) => stores.events.put(row));
  return row;
}

async function setStatus(hash, status, reason = null) {
  await tx(['events'], 'readwrite', (stores) => {
    const request = stores.events.get(String(hash));
    request.onsuccess = () => {
      const row = request.result;
      if (!row) return;
      row.status = status;
      row.reason = reason;
      stores.events.put(row);
    };
  });
}

async function getMeta(key, fallback = null) {
  const row = await tx(
    ['meta'],
    'readonly',
    (stores) => req(stores.meta.get(String(key)))
  );
  return row ? row.value : fallback;
}

async function setMeta(key, value) {
  await tx(
    ['meta'],
    'readwrite',
    (stores) => stores.meta.put({ key: String(key), value: clone(value) })
  );
  return value;
}

async function credentials() {
  const transportCredential = await mesh().credential();
  return {
    meshDeviceId: String(transportCredential.id || ''),
    deviceId: await deviceIdForKey(transportCredential.publicKey),
    publicKey: transportCredential.publicKey,
    privateKey: transportCredential.privateKey,
  };
}

async function walletIdentity() {
  const credential = await credentials();
  return {
    walletId: await walletIdForKey(credential.publicKey),
    publicKey: credential.publicKey,
    privateKey: credential.privateKey,
  };
}

function signableEnvelope(envelope) {
  return {
    schema: envelope.schema,
    event: envelope.event,
    signer: envelope.signer,
  };
}

async function signEnvelope(event) {
  if (!await verifyEventHash(event)) throw new Error('event hash mismatch');
  const credential = await credentials();
  const envelope = {
    schema: ENVELOPE_PROTOCOL,
    event: clone(event),
    signer: {
      deviceId: credential.deviceId,
      publicKey: clone(credential.publicKey),
    },
  };
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    credential.privateKey,
    encoder.encode(canonical(signableEnvelope(envelope)))
  );
  return { ...envelope, signature: base64url(signature) };
}

async function verifyEnvelope(envelope) {
  try {
    if (envelope?.schema !== ENVELOPE_PROTOCOL) {
      return { ok: false, error: 'unsupported envelope schema' };
    }
    if (!await verifyEventHash(envelope.event)) {
      return { ok: false, error: 'event hash mismatch' };
    }
    if (await deviceIdForKey(envelope.signer?.publicKey) !== envelope.signer?.deviceId) {
      return { ok: false, error: 'signer fingerprint mismatch' };
    }
    const key = await crypto.subtle.importKey(
      'jwk',
      envelope.signer.publicKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      fromBase64url(envelope.signature),
      encoder.encode(canonical(signableEnvelope(envelope)))
    );
    return ok ? { ok: true } : { ok: false, error: 'signature rejected' };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function nextSequence() {
  const credential = await credentials();
  const key = `sequence:${credential.deviceId}`;
  const next = Number(await getMeta(key, 0)) + 1;
  await setMeta(key, next);
  return next;
}

async function createEvent(type, payload, parents = []) {
  const credential = await credentials();
  const body = {
    protocol: EVENT_PROTOCOL,
    type: String(type),
    payload: clone(payload ?? {}),
    parents: [...new Set((parents || []).map(String).filter(Boolean))].sort(),
    nodeId: credential.deviceId,
    createdAt: now(),
    sequence: await nextSequence(),
  };
  return { ...body, hash: await hashObject(body) };
}

async function activeRows() {
  return listRows('active');
}

async function activeEvents() {
  return (await activeRows()).map((row) => row.envelope.event);
}

async function missingParents(event) {
  const missing = [];
  for (const parent of event.parents || []) {
    const row = await getRow(parent);
    if (row?.status !== 'active') missing.push(parent);
  }
  return missing;
}

function transferAuthBody(payload) {
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

async function signWalletAuth(payload, identity = null) {
  identity = identity || await walletIdentity();
  if (
    await walletIdForKey(identity.publicKey) !== identity.walletId ||
    payload.fromId !== identity.walletId
  ) {
    throw new Error('wallet identity mismatch');
  }
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identity.privateKey,
    encoder.encode(canonical(transferAuthBody(payload)))
  );
  return base64url(signature);
}

async function verifyWalletAuth(payload) {
  try {
    if (
      !payload.ownerPublicKey ||
      !payload.ownerSignature ||
      await walletIdForKey(payload.ownerPublicKey) !== payload.fromId
    ) {
      return false;
    }
    const key = await crypto.subtle.importKey(
      'jwk',
      payload.ownerPublicKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    return crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      fromBase64url(payload.ownerSignature),
      encoder.encode(canonical(transferAuthBody(payload)))
    );
  } catch {
    return false;
  }
}

function normalizeAsset(asset) {
  const value = String(asset || '').toUpperCase();
  if (!TRANSFER_ASSETS.has(value)) {
    throw new TypeError(`unsupported transfer asset: ${value || '(empty)'}`);
  }
  return value;
}

function positive(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError('amount must be positive');
  }
  return number;
}

function nonce(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new TypeError('spendNonce must be a non-negative safe integer');
  }
  return number;
}

async function transferRows(type) {
  return (await activeRows()).filter((row) => row.envelope.event.type === type);
}

async function pendingForId(transferId) {
  return (await transferRows('TransferPending')).find(
    (row) => row.envelope.event.payload?.transferId === String(transferId)
  ) || null;
}

function spendKey(payload) {
  return `${payload.fromId}\u0000${payload.asset}\u0000${payload.spendNonce}`;
}

async function conflictsFor(payload, hash) {
  return (await transferRows('TransferPending')).filter(
    (row) => (
      spendKey(row.envelope.event.payload || {}) === spendKey(payload) &&
      row.eventHash !== hash
    )
  );
}

async function witnessesFor(hash) {
  return (await transferRows('TransferWitnessed')).filter(
    (row) => row.envelope.event.payload?.transferHash === hash
  );
}

async function finalizationsFor(hash) {
  return (await transferRows('TransferFinalized')).filter(
    (row) => row.envelope.event.payload?.transferHash === hash
  );
}

async function finalizedOutgoingNonce(ownerId, asset) {
  const target = normalizeAsset(asset);
  let max = 0;
  for (const row of await transferRows('TransferFinalized')) {
    const payload = row.envelope.event.payload || {};
    if (payload.fromId === ownerId && payload.asset === target) {
      max = Math.max(max, Number(payload.spendNonce || 0));
    }
  }
  return max;
}

async function nextSpendNonce(ownerId, asset) {
  return (await finalizedOutgoingNonce(String(ownerId), normalizeAsset(asset))) + 1;
}

async function balance(ownerId, asset) {
  const owner = String(ownerId);
  const target = normalizeAsset(asset);
  let total = 0;
  const countedTransfers = new Set();

  for (const row of await activeRows()) {
    const event = row.envelope.event;
    const payload = event.payload || {};

    if (event.type === 'MintFinalized' && String(payload.subjectId || '') === owner) {
      for (const effect of payload.effects || []) {
        if (String(effect.asset || '').toUpperCase() === target) {
          total += Number(effect.amount || 0);
        }
      }
    }

    if (event.type === 'TransferFinalized') {
      const transferHash = String(payload.transferHash || '');
      if (!transferHash || countedTransfers.has(transferHash)) continue;
      countedTransfers.add(transferHash);
      if (payload.asset !== target) continue;
      if (payload.fromId === owner) total -= Number(payload.amount || 0);
      if (payload.toId === owner) total += Number(payload.amount || 0);
    }
  }

  return total;
}

async function transferStatus(transferId, { finalityWitnesses = 2 } = {}) {
  const pending = await pendingForId(transferId);
  if (!pending) {
    return {
      transferId: String(transferId),
      status: 'unknown',
      finalized: false,
      conflict: false,
      witnessCount: 0,
    };
  }

  const event = pending.envelope.event;
  const payload = event.payload || {};
  const conflict = (await conflictsFor(payload, event.hash)).length > 0;
  const witnessRows = await witnessesFor(event.hash);
  const witnesses = new Set(
    witnessRows
      .map((row) => row.signerDeviceId)
      .filter((id) => id && id !== pending.signerDeviceId)
  );
  const finalized = (await finalizationsFor(event.hash)).length > 0;

  let status = 'pending';
  if (finalized && conflict) status = 'disputed-final';
  else if (finalized) status = 'final';
  else if (conflict) status = 'conflict';
  else if (witnesses.size >= finalityWitnesses) status = 'ready';

  return {
    transferId: String(transferId),
    transferHash: event.hash,
    status,
    finalized,
    conflict,
    witnessCount: witnesses.size,
    requiredWitnesses: finalityWitnesses,
    witnesses: [...witnesses].sort(),
    spendNonce: Number(payload.spendNonce),
    fromId: payload.fromId,
    toId: payload.toId,
    asset: payload.asset,
    amount: Number(payload.amount),
  };
}

async function availableBalance(ownerId, asset, options = {}) {
  const owner = String(ownerId);
  const target = normalizeAsset(asset);
  const locks = new Map();

  for (const row of await transferRows('TransferPending')) {
    const payload = row.envelope.event.payload || {};
    if (payload.fromId !== owner || payload.asset !== target) continue;
    const status = await transferStatus(payload.transferId, options);
    if (!['pending', 'ready', 'conflict'].includes(status.status)) continue;
    const key = spendKey(payload);
    locks.set(key, Math.max(locks.get(key) || 0, Number(payload.amount || 0)));
  }

  const locked = [...locks.values()].reduce((sum, value) => sum + value, 0);
  return Math.max(0, (await balance(owner, target)) - locked);
}

async function semanticCheck(envelope, options = {}) {
  const event = envelope.event;
  const payload = event.payload || {};

  if (event.type === 'TransferPending') {
    if (payload.protocol !== TRANSFER_PROTOCOL) {
      return { ok: false, error: 'unsupported transfer protocol' };
    }
    if (!payload.transferId || !payload.fromId || !payload.toId) {
      return { ok: false, error: 'transfer identity fields are required' };
    }
    try {
      normalizeAsset(payload.asset);
      positive(payload.amount);
      nonce(payload.spendNonce);
    } catch (error) {
      return { ok: false, error: error.message };
    }
    if (!await verifyWalletAuth(payload)) {
      return { ok: false, error: 'wallet authorization rejected' };
    }
    return { ok: true };
  }

  if (event.type === 'TransferWitnessed') {
    const transferHash = String(payload.transferHash || '');
    const pending = await getRow(transferHash);
    if (
      !transferHash ||
      pending?.status !== 'active' ||
      pending.envelope.event.type !== 'TransferPending'
    ) {
      return { ok: false, error: 'witness references unavailable transfer' };
    }
    if (!(event.parents || []).includes(transferHash)) {
      return { ok: false, error: 'witness must parent transfer' };
    }
    if (payload.witnessDeviceId !== envelope.signer.deviceId) {
      return { ok: false, error: 'witness signer mismatch' };
    }
    if (pending.signerDeviceId === envelope.signer.deviceId) {
      return { ok: false, error: 'origin device cannot witness own transfer' };
    }
    return { ok: true };
  }

  if (event.type === 'TransferFinalized') {
    const transferHash = String(payload.transferHash || '');
    const pending = await getRow(transferHash);
    if (
      !transferHash ||
      pending?.status !== 'active' ||
      pending.envelope.event.type !== 'TransferPending'
    ) {
      return { ok: false, error: 'finalization references unavailable transfer' };
    }
    if (!(event.parents || []).includes(transferHash)) {
      return { ok: false, error: 'finalization must parent transfer' };
    }

    const transferPayload = pending.envelope.event.payload || {};
    if ((await conflictsFor(transferPayload, transferHash)).length) {
      return { ok: false, error: 'conflicting spend nonce prevents finality' };
    }

    const witnessRows = (await witnessesFor(transferHash)).filter(
      (row) => (event.parents || []).includes(row.eventHash)
    );
    const witnesses = new Set(
      witnessRows
        .map((row) => row.signerDeviceId)
        .filter((id) => id && id !== pending.signerDeviceId)
    );
    if (witnesses.size < Number(options.finalityWitnesses || 2)) {
      return { ok: false, error: 'insufficient independent transfer witnesses' };
    }

    for (const key of ['fromId', 'toId', 'asset', 'amount', 'spendNonce']) {
      if (payload[key] !== transferPayload[key]) {
        return { ok: false, error: `finalization ${key} mismatch` };
      }
    }
    return { ok: true };
  }

  return { ok: true };
}

async function reconcile(options = {}) {
  let promoted = 0;
  let changed = true;

  while (changed) {
    changed = false;
    for (const row of await listRows('orphan')) {
      if ((await missingParents(row.envelope.event)).length) continue;
      const semantic = await semanticCheck(row.envelope, options);
      if (!semantic.ok) {
        await setStatus(row.eventHash, 'rejected', semantic.error);
        changed = true;
        continue;
      }
      await setStatus(row.eventHash, 'active', null);
      promoted += 1;
      changed = true;
    }
  }

  return { promoted };
}

async function ingestEnvelope(envelope, options = {}) {
  const verified = await verifyEnvelope(envelope);
  if (!verified.ok) throw new Error(verified.error);

  const prior = await getRow(envelope.event.hash);
  if (prior?.status === 'active') {
    return { status: 'duplicate', hash: envelope.event.hash };
  }

  const missing = await missingParents(envelope.event);
  if (missing.length) {
    await putRow(
      envelope,
      'orphan',
      `missing parents: ${missing.join(',')}`
    );
    return {
      status: 'orphan',
      hash: envelope.event.hash,
      missingParents: missing,
    };
  }

  const semantic = await semanticCheck(envelope, options);
  if (!semantic.ok) {
    await putRow(envelope, 'rejected', semantic.error);
    return {
      status: 'rejected',
      hash: envelope.event.hash,
      error: semantic.error,
    };
  }

  await putRow(envelope, 'active');
  await reconcile(options);
  emit('event-active', {
    hash: envelope.event.hash,
    type: envelope.event.type,
  });
  return { status: 'active', hash: envelope.event.hash };
}

async function publishEnvelope(envelope, options = {}) {
  const { consent = 'federated', publish = true } = options;
  await ingestEnvelope(envelope, options);

  await mesh().createObject({
    id: `contribution:${envelope.event.hash}`,
    kind: OBJECT_KIND,
    purpose: 'replicate contribution ledger event',
    consent,
    payload: envelope,
    parentIds: (envelope.event.parents || []).map(
      (hash) => `contribution:${hash}`
    ),
    publish,
  });

  return envelope;
}

async function publishEvent(event, options = {}) {
  return publishEnvelope(await signEnvelope(event), options);
}

async function append(type, payload, parents = [], options = {}) {
  return publishEvent(await createEvent(type, payload, parents), options);
}

async function publishContributionEvent(event, options = {}) {
  if (!await verifyEventHash(event)) {
    throw new Error('contribution event hash mismatch');
  }
  return publishEvent(event, options);
}

async function createPendingTransfer(
  {
    transferId,
    wallet = null,
    fromId = null,
    toId,
    asset,
    amount,
    spendNonce,
    parents = [],
  } = {},
  options = {}
) {
  wallet = wallet || await walletIdentity();
  fromId = fromId || wallet.walletId;

  const target = normalizeAsset(asset);
  const value = positive(amount);
  const owner = String(fromId || '').trim();
  const recipient = String(toId || '').trim();
  if (!owner || !recipient) throw new TypeError('fromId and toId are required');

  const next = await nextSpendNonce(owner, target);
  const spend = spendNonce == null ? next : nonce(spendNonce);
  if (spend !== next) {
    throw new Error('transfer nonce must be the next finalized spend nonce');
  }
  if (await availableBalance(owner, target, options) < value) {
    throw new Error(`insufficient available ${target} balance`);
  }

  const credential = await credentials();
  const id = String(
    transferId ||
    `transfer:${await hashObject({
      owner,
      recipient,
      target,
      value,
      spend,
      deviceId: credential.deviceId,
      at: now(),
    })}`
  ).slice(0, 220);

  const payload = {
    protocol: TRANSFER_PROTOCOL,
    transferId: id,
    fromId: owner,
    toId: recipient,
    asset: target,
    amount: value,
    spendNonce: spend,
    ownerPublicKey: clone(wallet.publicKey),
  };
  payload.ownerSignature = await signWalletAuth(payload, wallet);

  return append('TransferPending', payload, parents, options);
}

async function witnessTransfer(transferId, options = {}) {
  const pending = await pendingForId(transferId);
  if (!pending) throw new Error(`unknown transfer: ${transferId}`);

  const credential = await credentials();
  const event = pending.envelope.event;
  const payload = event.payload || {};

  if (pending.signerDeviceId === credential.deviceId) {
    throw new Error('origin device cannot witness own transfer');
  }

  const status = await transferStatus(transferId, options);
  if (status.conflict) {
    throw new Error('conflicting spend nonce prevents witnessing');
  }
  if (payload.spendNonce !== await nextSpendNonce(payload.fromId, payload.asset)) {
    throw new Error('transfer is not at current spend nonce');
  }

  const finalizedBalance = await balance(payload.fromId, payload.asset);
  if (finalizedBalance < Number(payload.amount)) {
    throw new Error('insufficient finalized balance');
  }

  const prior = (await witnessesFor(event.hash)).find(
    (row) => row.signerDeviceId === credential.deviceId
  );
  if (prior) return prior.envelope;

  return append(
    'TransferWitnessed',
    {
      protocol: TRANSFER_PROTOCOL,
      transferId: payload.transferId,
      transferHash: event.hash,
      witnessDeviceId: credential.deviceId,
      observedBalance: finalizedBalance,
      spendNonce: payload.spendNonce,
    },
    [event.hash],
    options
  );
}

async function finalizeTransfer(transferId, options = {}) {
  const required = Number(options.finalityWitnesses || 2);
  const pending = await pendingForId(transferId);
  if (!pending) throw new Error(`unknown transfer: ${transferId}`);

  const status = await transferStatus(transferId, {
    ...options,
    finalityWitnesses: required,
  });
  if (status.finalized) {
    return (await finalizationsFor(status.transferHash))[0]?.envelope || null;
  }
  if (status.status !== 'ready') {
    throw new Error(`transfer is not ready for finality: ${status.status}`);
  }

  const payload = pending.envelope.event.payload;
  const witnessRows = (await witnessesFor(pending.eventHash))
    .filter((row) => row.signerDeviceId !== pending.signerDeviceId)
    .sort((a, b) => a.eventHash.localeCompare(b.eventHash));

  const chosen = [];
  const seen = new Set();
  for (const row of witnessRows) {
    if (seen.has(row.signerDeviceId)) continue;
    seen.add(row.signerDeviceId);
    chosen.push(row.eventHash);
    if (chosen.length >= required) break;
  }

  return append(
    'TransferFinalized',
    {
      protocol: TRANSFER_PROTOCOL,
      transferId: payload.transferId,
      transferHash: pending.eventHash,
      fromId: payload.fromId,
      toId: payload.toId,
      asset: payload.asset,
      amount: payload.amount,
      spendNonce: payload.spendNonce,
      witnessHashes: chosen,
    },
    [pending.eventHash, ...chosen],
    options
  );
}

async function frontier() {
  const events = await activeEvents();
  const parented = new Set(events.flatMap((event) => event.parents || []));
  return events
    .filter((event) => !parented.has(event.hash))
    .map((event) => event.hash)
    .sort();
}

async function exportBundle() {
  const credential = await credentials();
  return {
    schema: BUNDLE_PROTOCOL,
    exportedAt: now(),
    fromDeviceId: credential.deviceId,
    transportDeviceId: credential.meshDeviceId,
    envelopes: (await listRows())
      .filter((row) => row.status !== 'rejected')
      .map((row) => row.envelope),
  };
}

async function importBundle(bundle, options = {}) {
  if (
    bundle?.schema !== BUNDLE_PROTOCOL ||
    !Array.isArray(bundle.envelopes)
  ) {
    throw new Error('unsupported contribution mesh bundle');
  }
  const results = [];
  for (const envelope of bundle.envelopes) {
    try {
      results.push(await ingestEnvelope(envelope, options));
    } catch (error) {
      results.push({
        status: 'rejected',
        hash: envelope?.event?.hash || null,
        error: error.message,
      });
    }
  }
  return results;
}

async function syncFromLocalMesh(options = {}) {
  let imported = 0;
  for (const object of await mesh().listObjects()) {
    if (
      object?.kind !== OBJECT_KIND ||
      object?.payload?.schema !== ENVELOPE_PROTOCOL
    ) {
      continue;
    }
    const result = await ingestEnvelope(object.payload, options);
    if (result.status === 'active') imported += 1;
  }
  return { imported };
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let meshUnsubscribe = null;

function bind() {
  if (meshUnsubscribe || !globalThis.CivweaveLocalMeshV146?.subscribe) {
    return false;
  }

  meshUnsubscribe = globalThis.CivweaveLocalMeshV146.subscribe((event) => {
    if (event.type !== 'object-received') return;
    queueMicrotask(async () => {
      try {
        const object = await mesh().getObject(event.detail?.id);
        if (object?.kind === OBJECT_KIND && object?.payload) {
          await ingestEnvelope(object.payload);
        }
      } catch (error) {
        emit('ingest-error', { error: error.message });
      }
    });
  });

  syncFromLocalMesh().catch((error) => {
    emit('sync-error', { error: error.message });
  });
  return true;
}

function ready() {
  if (bind()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (bind() || count > 100) {
        clearInterval(timer);
        resolve(Boolean(globalThis.CivweaveLocalMeshV146));
      }
    }, 50);
  });
}

const api = Object.freeze({
  version: VERSION,
  DB_NAME,
  EVENT_PROTOCOL,
  ENVELOPE_PROTOCOL,
  BUNDLE_PROTOCOL,
  TRANSFER_PROTOCOL,
  OBJECT_KIND,
  ready,
  credentials,
  walletIdentity,
  createEvent,
  publishEvent,
  publishContributionEvent,
  ingestEnvelope,
  reconcile,
  activeEvents,
  frontier,
  balance,
  availableBalance,
  nextSpendNonce,
  transferStatus,
  createPendingTransfer,
  witnessTransfer,
  finalizeTransfer,
  exportBundle,
  importBundle,
  syncFromLocalMesh,
  subscribe,
  hashObject,
  verifyEventHash,
  verifyEnvelope,
  deviceIdForKey,
  walletIdForKey,
});

globalThis.CivweaveContributionMeshV1 = api;
ready().then(() => emit('ready', { version: VERSION }));

})();
