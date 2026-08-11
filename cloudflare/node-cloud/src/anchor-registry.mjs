export const ANCHOR_SCHEMA = 'civweave.hub-anchor.v1';
export const ANCHOR_CHECKPOINT_SCHEMA = 'civweave.hub-recovery-checkpoint.v1';
export const ANCHOR_STIPEND_SCHEMA = 'civweave.anchor-button-stipend.v1';
export const ANCHOR_RECEIPT_DOMAIN = 'civweave.anchor-stipend-receipt.v1';
export const ANCHOR_SYNC_DOMAIN = 'civweave.anchor-sync.v1';
export const ANCHOR_PAIR_DOMAIN = 'civweave.anchor-pair.v1';
export const ANCHOR_PROOF_DOMAIN = 'civweave.anchor-storage-proof.v1';
export const ANCHOR_CHECKPOINT_DOMAIN = 'civweave.anchor-checkpoint.v1';

export const ANCHOR_POLICY = Object.freeze({
  pairingTtlMs: 30 * 60 * 1000,
  challengeTtlMs: 15 * 60 * 1000,
  proofFreshMs: 72 * 60 * 60 * 1000,
  checkpointFreshMs: 36 * 60 * 60 * 1000,
  minimumRecoveryCoverageBps: 9500,
  maxPaidAnchorsPerNode: 3,
  stipendButtonsByRank: Object.freeze([3, 2, 1]),
  maxOpaqueStateChars: 600_000,
  maxCheckpointHistory: 14,
  maxReceiptHistory: 5000,
});

const enc = new TextEncoder();
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const nowIso = now => new Date(now).toISOString();
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
const array = value => Array.isArray(value) ? value : [];

function b64url(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
function fromB64url(value) {
  const normalized = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : enc.encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function pemToDer(pem) {
  const base64 = clean(pem, 20000).replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  if (!base64) throw Object.assign(new TypeError('Anchor signing public key is invalid.'), { status: 400 });
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function derToPem(der) {
  const bytes = der instanceof Uint8Array ? der : new Uint8Array(der);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  return `-----BEGIN PUBLIC KEY-----\n${(base64.match(/.{1,64}/g) || []).join('\n')}\n-----END PUBLIC KEY-----`;
}
async function importAnchorKey(pem) {
  try { return await crypto.subtle.importKey('spki', pemToDer(pem), { name: 'Ed25519' }, false, ['verify']); }
  catch { throw Object.assign(new TypeError('Anchor signing public key must be Ed25519.'), { status: 400 }); }
}
async function verifyAnchorSignature(publicKeyPem, message, signature) {
  try {
    const key = await importAnchorKey(publicKeyPem);
    return crypto.subtle.verify({ name: 'Ed25519' }, key, fromB64url(signature), enc.encode(message));
  } catch { return false; }
}
function randomToken(bytes = 32) { const value = new Uint8Array(bytes); crypto.getRandomValues(value); return b64url(value); }
function weekKey(now = Date.now()) {
  const d = new Date(now); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); d.setUTCHours(0, 0, 0, 0); return d.toISOString().slice(0, 10);
}
function parseTime(value) { const parsed = Date.parse(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function nodeKey(nodeId) { return clean(nodeId, 180).toLowerCase(); }
function anchorPrefix(nodeId) { return `anchor:${nodeKey(nodeId)}:`; }
function checkpointPrefix(nodeId) { return `checkpoint:${nodeKey(nodeId)}:`; }
function stipendPrefix(nodeId) { return `stipend:${nodeKey(nodeId)}:`; }
function publicAnchor(anchor) {
  return {
    anchorId: anchor.anchorId,
    displayName: anchor.displayName,
    deviceClass: anchor.deviceClass,
    state: anchor.state,
    pairedAt: anchor.pairedAt,
    lastProofAt: anchor.lastProofAt || null,
    lastCheckpointId: anchor.lastCheckpointId || null,
    recoveryCoverageBps: Number(anchor.recoveryCoverageBps || 0),
    proofCount: Number(anchor.proofCount || 0),
  };
}
export function anchorHealth(anchor, checkpoint, now = Date.now(), policy = ANCHOR_POLICY) {
  const checkpointAt = parseTime(checkpoint?.createdAt), proofAt = parseTime(anchor?.lastProofAt);
  const checkpointFresh = Boolean(checkpointAt && now - checkpointAt <= policy.checkpointFreshMs);
  const proofFresh = Boolean(proofAt && now - proofAt <= policy.proofFreshMs);
  const hasLatest = Boolean(checkpoint?.checkpointId && anchor?.lastCheckpointId === checkpoint.checkpointId);
  const recoveryCoverageBps = Math.min(10000, Math.max(0, Number(anchor?.recoveryCoverageBps || 0)));
  const coverageOk = recoveryCoverageBps >= policy.minimumRecoveryCoverageBps;
  const healthy = anchor?.state === 'active' && checkpointFresh && proofFresh && hasLatest && coverageOk;
  const reason = healthy ? 'recoverable' : anchor?.state !== 'active' ? 'inactive' : !checkpointFresh ? 'checkpoint-stale' : !proofFresh ? 'proof-stale' : !hasLatest ? 'latest-checkpoint-not-proven' : 'recovery-coverage-low';
  return Object.freeze({ healthy, reason, checkpointFresh, proofFresh, hasLatest, coverageOk, recoveryCoverageBps });
}
export function resilienceSummary(anchors, checkpoint, now = Date.now(), policy = ANCHOR_POLICY) {
  const rows = array(anchors).map(anchor => ({ anchor, health: anchorHealth(anchor, checkpoint, now, policy) }));
  const healthy = rows.filter(row => row.health.healthy);
  const resilienceClass = healthy.length >= 2 ? 'redundantly-anchored' : healthy.length === 1 ? 'locally-anchored' : 'cloud-only';
  return Object.freeze({
    schema: 'civweave.hub-resilience.v1', resilienceClass,
    totalAnchors: rows.length, healthyAnchors: healthy.length,
    latestCheckpointId: checkpoint?.checkpointId || null, latestCheckpointAt: checkpoint?.createdAt || null,
    recoveryCoverageBps: healthy.length ? Math.min(...healthy.map(row => row.health.recoveryCoverageBps)) : 0,
    backupRecommended: healthy.length === 0,
    reminderLevel: healthy.length === 0 ? 'insistent' : healthy.length === 1 ? 'recommend-redundancy' : 'healthy',
  });
}
export function stipendPlan(anchors, checkpoint, now = Date.now(), policy = ANCHOR_POLICY) {
  const healthy = array(anchors)
    .map(anchor => ({ anchor, health: anchorHealth(anchor, checkpoint, now, policy) }))
    .filter(row => row.health.healthy)
    .sort((a, b) => String(a.anchor.pairedAt).localeCompare(String(b.anchor.pairedAt)) || String(a.anchor.anchorId).localeCompare(String(b.anchor.anchorId)));
  const seenKeys = new Set(); const selected = [];
  for (const row of healthy) {
    const fingerprint = clean(row.anchor.keyFingerprint, 180);
    if (!fingerprint || seenKeys.has(fingerprint)) continue;
    seenKeys.add(fingerprint); selected.push(row);
    if (selected.length >= policy.maxPaidAnchorsPerNode) break;
  }
  return selected.map((row, index) => Object.freeze({
    rank: index + 1, anchorId: row.anchor.anchorId, recipientId: row.anchor.recipientId,
    buttons: policy.stipendButtonsByRank[index] || 0, checkpointId: checkpoint.checkpointId,
    recoveryCoverageBps: row.health.recoveryCoverageBps,
  })).filter(item => item.buttons > 0 && item.recipientId);
}
export function externalSettlementPolicy({ cloudReachable = true, reconciled = true, recoveryCoverageBps = 10000 } = {}, policy = ANCHOR_POLICY) {
  const recoveryMode = !cloudReachable || !reconciled || Number(recoveryCoverageBps) < policy.minimumRecoveryCoverageBps;
  return Object.freeze({ recoveryMode, externalSettlementAllowed: !recoveryMode, contributionRecordingAllowed: true, reason: !cloudReachable ? 'cloud-unreachable' : !reconciled ? 'ledger-reconciliation-pending' : Number(recoveryCoverageBps) < policy.minimumRecoveryCoverageBps ? 'recovery-coverage-insufficient' : 'normal' });
}

export class CivweaveAnchorRegistry {
  constructor(state, env) { this.state = state; this.env = env; }
  async identity() {
    let identity = await this.state.storage.get('registry-identity');
    if (identity?.privateJwk?.d && identity?.publicKey) return identity;
    const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey), spki = await crypto.subtle.exportKey('spki', pair.publicKey), publicKey = derToPem(spki), fingerprint = await sha256Hex(publicKey);
    identity = { schema: 'civweave.anchor-registry-identity.v1', privateJwk, publicKey, keyId: `anchor-registry-${fingerprint.slice(0, 12)}`, fingerprint, createdAt: nowIso(Date.now()) };
    await this.state.storage.put('registry-identity', identity); return identity;
  }
  async signDomain(domain, unsigned) {
    const identity = await this.identity(), key = await crypto.subtle.importKey('jwk', identity.privateJwk, { name: 'Ed25519' }, false, ['sign']);
    const signature = await crypto.subtle.sign({ name: 'Ed25519' }, key, enc.encode(`${domain}\n${canonical(unsigned)}`));
    return { ...unsigned, keyId: identity.keyId, signature: b64url(signature) };
  }
  async signReceipt(unsigned) { return this.signDomain(ANCHOR_RECEIPT_DOMAIN, unsigned); }
  async anchors(nodeId) { const rows = await this.state.storage.list({ prefix: anchorPrefix(nodeId) }); return [...rows.values()]; }
  async latestCheckpoint(nodeId) {
    const latestId = await this.state.storage.get(`checkpoint-latest:${nodeKey(nodeId)}`); return latestId ? this.state.storage.get(`${checkpointPrefix(nodeId)}${latestId}`) : null;
  }
  async nodeIds() { const rows = await this.state.storage.list({ prefix: 'node:' }); return [...rows.keys()].map(key => key.slice(5)); }
  async ensureNode(nodeId) { const id = nodeKey(nodeId); if (!id) throw Object.assign(new TypeError('nodeId is required.'), { status: 400 }); await this.state.storage.put(`node:${id}`, { nodeId: id, updatedAt: nowIso(Date.now()) }); return id; }

  async startPairing(input) {
    const nodeId = await this.ensureNode(input.nodeId), recipientId = clean(input.recipientId, 240);
    if (!recipientId) throw Object.assign(new TypeError('recipientId is required for Button stipends.'), { status: 400 });
    const token = randomToken(), tokenHash = await sha256Hex(token), now = Date.now();
    const grant = { schema: 'civweave.anchor-pairing-grant.v1', tokenHash, nodeId, recipientId, displayName: clean(input.displayName || 'Local Anchor', 160), createdAt: nowIso(now), expiresAt: nowIso(now + ANCHOR_POLICY.pairingTtlMs), consumedAt: null };
    await this.state.storage.put(`pair:${tokenHash}`, grant);
    return { ...grant, tokenHash: undefined, token };
  }
  async pair(input) {
    const nodeId = nodeKey(input.nodeId), token = clean(input.grant, 1000), signingPublicKey = clean(input.signingPublicKey, 20000);
    if (!nodeId || !token || !signingPublicKey) throw Object.assign(new TypeError('nodeId, grant, and signingPublicKey are required.'), { status: 400 });
    const tokenHash = await sha256Hex(token), key = `pair:${tokenHash}`, grant = await this.state.storage.get(key);
    if (!grant || grant.nodeId !== nodeId || grant.consumedAt || parseTime(grant.expiresAt) <= Date.now()) throw Object.assign(new Error('Anchor pairing grant is invalid or expired.'), { status: 401 });
    const message = `${ANCHOR_PAIR_DOMAIN}\n${nodeId}\n${token}`;
    if (!await verifyAnchorSignature(signingPublicKey, message, clean(input.signature, 4000))) throw Object.assign(new Error('Anchor pairing proof is invalid.'), { status: 401 });
    const keyFingerprint = `sha256:${await sha256Hex(signingPublicKey)}`, existing = (await this.anchors(nodeId)).find(anchor => anchor.keyFingerprint === keyFingerprint);
    if (existing) return { anchor: publicAnchor(existing), paired: false, idempotent: true };
    const anchorId = `anchor:${crypto.randomUUID()}`, now = Date.now();
    const anchor = { schema: ANCHOR_SCHEMA, anchorId, nodeId, recipientId: grant.recipientId, displayName: clean(input.displayName || grant.displayName || 'Local Anchor', 160), deviceClass: clean(input.deviceClass || 'personal-computer', 80), signingPublicKey, keyFingerprint, state: 'active', pairedAt: nowIso(now), lastProofAt: null, lastCheckpointId: null, recoveryCoverageBps: 0, proofCount: 0 };
    await this.state.storage.put(`${anchorPrefix(nodeId)}${anchorId}`, anchor);
    await this.state.storage.put(key, { ...grant, consumedAt: nowIso(now), anchorId });
    const priorCheckpoint = await this.latestCheckpoint(nodeId);
    if (priorCheckpoint) await this.publishCheckpoint({ ...priorCheckpoint, checkpointId: '', createdAt: '', source: 'anchor-pairing-continuity-refresh' });
    return { anchor: publicAnchor(anchor), paired: true, idempotent: false };
  }
  async publishCheckpoint(input) {
    const nodeId = await this.ensureNode(input.nodeId), prior = await this.latestCheckpoint(nodeId), now = Date.now(), source = clean(input.source || 'cloudflare-host-snapshot', 120), passiveRefresh = source === 'cloudflare-node-daily-snapshot', recoveryCoverageBps = Math.max(0, Math.min(10000, Number(input.recoveryCoverageBps ?? prior?.recoveryCoverageBps ?? 10000) || 0));
    const carriedEnvelope = clean(input.stateEnvelope || prior?.stateEnvelope, ANCHOR_POLICY.maxOpaqueStateChars) || null;
    const body = {
      schema: ANCHOR_CHECKPOINT_SCHEMA,
      checkpointId: clean(input.checkpointId, 220) || `checkpoint:${crypto.randomUUID()}`,
      nodeId,
      createdAt: clean(input.createdAt, 100) || nowIso(now),
      source,
      nodeManifest: input.nodeManifest && typeof input.nodeManifest === 'object' ? input.nodeManifest : prior?.nodeManifest || null,
      capacitySnapshot: input.capacitySnapshot && typeof input.capacitySnapshot === 'object' ? input.capacitySnapshot : prior?.capacitySnapshot || null,
      ledgerFrontier: passiveRefresh && prior?.ledgerFrontier ? prior.ledgerFrontier : input.ledgerFrontier && typeof input.ledgerFrontier === 'object' ? input.ledgerFrontier : prior?.ledgerFrontier || null,
      softwareManifest: input.softwareManifest && typeof input.softwareManifest === 'object' ? input.softwareManifest : prior?.softwareManifest || null,
      stateEnvelope: carriedEnvelope,
      stateEnvelopeFormat: clean(input.stateEnvelopeFormat || prior?.stateEnvelopeFormat || (carriedEnvelope ? 'opaque-encrypted' : 'none'), 80),
      recoveryCoverageBps,
    };
    const continuityAnchors = (await this.anchors(nodeId)).filter(anchor => anchor.state === 'active').map(anchor => ({ anchorId: anchor.anchorId, keyFingerprint: anchor.keyFingerprint, signingPublicKey: anchor.signingPublicKey, pairedAt: anchor.pairedAt }));
    const unsigned = { ...body, continuityAnchors }, checkpointHash = await sha256Hex(canonical(unsigned));
    const checkpoint = await this.signDomain(ANCHOR_CHECKPOINT_DOMAIN, { ...unsigned, checkpointHash });
    await this.state.storage.put(`${checkpointPrefix(nodeId)}${checkpoint.checkpointId}`, checkpoint);
    await this.state.storage.put(`checkpoint-latest:${nodeId}`, checkpoint.checkpointId);
    const rows = await this.state.storage.list({ prefix: checkpointPrefix(nodeId) });
    const old = [...rows.entries()].sort((a, b) => parseTime(b[1].createdAt) - parseTime(a[1].createdAt)).slice(ANCHOR_POLICY.maxCheckpointHistory);
    await Promise.all(old.map(([key]) => this.state.storage.delete(key)));
    return checkpoint;
  }
  async sync(input) {
    const nodeId = nodeKey(input.nodeId), anchorId = clean(input.anchorId, 240), timestamp = Number(input.timestamp), anchor = await this.state.storage.get(`${anchorPrefix(nodeId)}${anchorId}`);
    if (!anchor || anchor.state !== 'active') throw Object.assign(new Error('Anchor is not paired.'), { status: 404 });
    if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) throw Object.assign(new Error('Anchor sync timestamp is outside the replay window.'), { status: 401 });
    const message = `${ANCHOR_SYNC_DOMAIN}\n${nodeId}\n${anchorId}\n${timestamp}`;
    if (!await verifyAnchorSignature(anchor.signingPublicKey, message, clean(input.signature, 4000))) throw Object.assign(new Error('Anchor sync signature is invalid.'), { status: 401 });
    const checkpoint = await this.latestCheckpoint(nodeId); if (!checkpoint) throw Object.assign(new Error('No recovery checkpoint exists for this hub yet.'), { status: 404 });
    const challengeId = `challenge:${crypto.randomUUID()}`, nonce = randomToken(24), now = Date.now();
    await this.state.storage.put(challengeId, { challengeId, nonce, nodeId, anchorId, checkpointId: checkpoint.checkpointId, checkpointHash: checkpoint.checkpointHash, createdAt: nowIso(now), expiresAt: nowIso(now + ANCHOR_POLICY.challengeTtlMs), consumedAt: null });
    return { checkpoint, challenge: { challengeId, nonce, checkpointId: checkpoint.checkpointId, checkpointHash: checkpoint.checkpointHash, expiresAt: nowIso(now + ANCHOR_POLICY.challengeTtlMs) } };
  }
  async prove(input) {
    const nodeId = nodeKey(input.nodeId), anchorId = clean(input.anchorId, 240), challengeId = clean(input.challengeId, 240), anchorKey = `${anchorPrefix(nodeId)}${anchorId}`;
    const [anchor, challenge, checkpoint] = await Promise.all([this.state.storage.get(anchorKey), this.state.storage.get(challengeId), this.latestCheckpoint(nodeId)]);
    if (!anchor || !challenge || challenge.nodeId !== nodeId || challenge.anchorId !== anchorId || challenge.consumedAt || parseTime(challenge.expiresAt) <= Date.now()) throw Object.assign(new Error('Storage proof challenge is invalid or expired.'), { status: 401 });
    if (!checkpoint || challenge.checkpointId !== checkpoint.checkpointId || challenge.checkpointHash !== checkpoint.checkpointHash) throw Object.assign(new Error('Storage proof targets an obsolete recovery checkpoint.'), { status: 409 });
    const message = `${ANCHOR_PROOF_DOMAIN}\n${challengeId}\n${nodeId}\n${anchorId}\n${challenge.checkpointId}\n${challenge.checkpointHash}\n${challenge.nonce}`;
    if (!await verifyAnchorSignature(anchor.signingPublicKey, message, clean(input.signature, 4000))) throw Object.assign(new Error('Anchor storage proof signature is invalid.'), { status: 401 });
    const now = Date.now(), recoveryCoverageBps = Math.max(0, Math.min(10000, Number(input.recoveryCoverageBps ?? checkpoint.recoveryCoverageBps) || 0)), next = { ...anchor, lastProofAt: nowIso(now), lastCheckpointId: checkpoint.checkpointId, recoveryCoverageBps, proofCount: Number(anchor.proofCount || 0) + 1 };
    await this.state.storage.put(anchorKey, next); await this.state.storage.put(challengeId, { ...challenge, consumedAt: nowIso(now) });
    return { ok: true, anchor: publicAnchor(next), health: anchorHealth(next, checkpoint, now) };
  }
  async status(nodeId, admin = false) {
    const [anchors, checkpoint] = await Promise.all([this.anchors(nodeId), this.latestCheckpoint(nodeId)]), summary = resilienceSummary(anchors, checkpoint);
    return { ...summary, anchors: admin ? anchors.map(anchor => ({ ...publicAnchor(anchor), recipientId: anchor.recipientId, keyFingerprint: anchor.keyFingerprint })) : anchors.map(publicAnchor) };
  }
  async runStipends(nodeId, now = Date.now()) {
    const [anchors, checkpoint] = await Promise.all([this.anchors(nodeId), this.latestCheckpoint(nodeId)]);
    if (!checkpoint) return { week: weekKey(now), nodeId, created: [], skipped: 'no-checkpoint' };
    const week = weekKey(now), plan = stipendPlan(anchors, checkpoint, now), created = [];
    for (const item of plan) {
      const key = `${stipendPrefix(nodeId)}${week}:${item.anchorId}`, existing = await this.state.storage.get(key);
      if (existing) { created.push({ ...existing, idempotent: true }); continue; }
      const unsigned = {
        schema: ANCHOR_STIPEND_SCHEMA,
        receiptId: `anchor-stipend:${week}:${nodeKey(nodeId)}:${item.anchorId}`,
        week, nodeId: nodeKey(nodeId), anchorId: item.anchorId, recipientId: item.recipientId,
        currency: 'button', amount: item.buttons, rank: item.rank,
        source: 'hub-anchor-stipend', checkpointId: item.checkpointId,
        recoveryCoverageBps: item.recoveryCoverageBps, issuedAt: nowIso(now),
      };
      const receipt = await this.signReceipt(unsigned); await this.state.storage.put(key, receipt); created.push({ ...receipt, idempotent: false });
    }
    return { week, nodeId: nodeKey(nodeId), created };
  }
  async runAllStipends(now = Date.now()) { const results = []; for (const nodeId of await this.nodeIds()) results.push(await this.runStipends(nodeId, now)); return results; }
  async receipts(recipientId = '') {
    const rows = await this.state.storage.list({ prefix: 'stipend:' }), filter = clean(recipientId, 240);
    return [...rows.values()].filter(row => !filter || row.recipientId === filter).sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt))).slice(0, ANCHOR_POLICY.maxReceiptHistory);
  }
  async fetch(request) {
    const url = new URL(request.url), input = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    try {
      if (request.method === 'GET' && url.pathname === '/trust') { const identity = await this.identity(); return json({ schema: 'civweave.anchor-registry-trust.v1', keyId: identity.keyId, algorithm: 'Ed25519', publicKey: identity.publicKey, fingerprint: identity.fingerprint }); }
      if (request.method === 'GET' && url.pathname === '/nodes') return json({ nodes: await this.nodeIds() });
      if (request.method === 'POST' && url.pathname === '/pairing/start') return json({ pairing: await this.startPairing(input) }, 201);
      if (request.method === 'POST' && url.pathname === '/pair') return json(await this.pair(input), 201);
      if (request.method === 'POST' && url.pathname === '/checkpoint') return json({ checkpoint: await this.publishCheckpoint(input) }, 201);
      if (request.method === 'POST' && url.pathname === '/sync') return json(await this.sync(input));
      if (request.method === 'POST' && url.pathname === '/proof') return json(await this.prove(input));
      if (request.method === 'GET' && url.pathname === '/status') return json(await this.status(url.searchParams.get('nodeId') || '', url.searchParams.get('admin') === '1'));
      if (request.method === 'POST' && url.pathname === '/stipends/run') return json(await this.runStipends(input.nodeId, Number(input.now) || Date.now()));
      if (request.method === 'POST' && url.pathname === '/stipends/run-all') return json({ results: await this.runAllStipends(Number(input.now) || Date.now()) });
      if (request.method === 'GET' && url.pathname === '/stipends') return json({ receipts: await this.receipts(url.searchParams.get('recipientId') || '') });
      return json({ ok: false, error: 'not-found' }, 404);
    } catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 400); }
  }
}
