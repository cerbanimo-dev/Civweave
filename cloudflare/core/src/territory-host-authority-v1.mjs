export const TERRITORY_HOST_AUTHORITY_SCHEMA = 'civweave.territory-host-authority.v1';
export const TERRITORY_HOST_ADMISSION_SCHEMA = 'civweave.territory-host-admission.v1';
export const TERRITORY_HOST_ADMISSION_REQUEST_DOMAIN = 'civweave.territory-host-admission-request.v1';
export const TERRITORY_HOST_NODE_CHALLENGE_DOMAIN = 'civweave.node-live-challenge.v1';

export const TERRITORY_HOST_AUTHORITY_POLICY = Object.freeze({
  rootRemainsTrustAnchor: true,
  territoryMayIssueHostAdmissions: true,
  territoryMayDelegateTerritoryAuthority: false,
  candidateProofOfKeyRequired: true,
  grantSingleUse: true,
  defaultGrantTtlSeconds: 900,
  maximumGrantTtlSeconds: 3600,
  maximumOpenGrantsPerAuthority: 50,
  scope: 'appointed-territory-and-descendants',
  revocation: 'root-immediate',
  rootSecretsDistributed: false
});

const enc = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const iso = value => new Date(value).toISOString();
const nowSeconds = value => Math.floor(value / 1000);
const slug = (value, max = 120) => clean(value, max).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

function required(value, label, max = 4000) {
  const out = clean(value, max);
  if (!out) throw Object.assign(new TypeError(`${label} is required.`), { status: 400 });
  return out;
}
function b64url(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
function fromB64url(value) {
  const normalized = String(value).replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function concatBytes(...parts) {
  const arrays = parts.map(part => part instanceof Uint8Array ? part : new Uint8Array(part));
  const out = new Uint8Array(arrays.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of arrays) { out.set(part, offset); offset += part.byteLength; }
  return out;
}
async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : enc.encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function secretEqual(left, right) {
  if (!left || !right) return false;
  const [a, b] = await Promise.all([sha256Hex(left), sha256Hex(right)]);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return b64url(data);
}
function publicCallbackBase(value) {
  const url = new URL(required(value, 'callbackUrl'));
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw Object.assign(new RangeError('Host admission callback must be a credential-free HTTPS URL.'), { status: 400 });
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || !host.includes('.') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    throw Object.assign(new RangeError('Host admission callback must use a public DNS hostname.'), { status: 400 });
  }
  const blocked = ['localhost', '.localhost', '.local', '.internal', '.home.arpa', '.example', '.invalid', '.test', '.onion'];
  if (blocked.some(suffix => host === suffix.replace(/^\./, '') || host.endsWith(suffix))) {
    throw Object.assign(new RangeError('Host admission callback must use a publicly routable hostname.'), { status: 400 });
  }
  url.search = '';
  url.hash = '';
  url.pathname = `${url.pathname.replace(/\/+$/g, '')}/`;
  return url.href;
}
function nodeEndpoint(base, pathname) {
  return new URL(String(pathname).replace(/^\/+/, ''), publicCallbackBase(base));
}
function pemToDer(pem) {
  const base64 = required(pem, 'publicKey', 20000)
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function importEd25519PublicKey(pem) {
  return crypto.subtle.importKey('spki', pemToDer(pem), { name: 'Ed25519' }, false, ['verify']);
}
function signatureHeaderParts(header) {
  const values = Object.fromEntries(String(header || '').split(',').map(part => part.trim().split('=', 2)).filter(parts => parts.length === 2));
  const timestamp = Number(values.t), keyId = clean(values.kid, 160), signature = clean(values.sig, 2000);
  if (!Number.isSafeInteger(timestamp) || !signature) throw Object.assign(new Error('Malformed territory host admission signature.'), { status: 401 });
  return { timestamp, keyId, signature };
}
async function verifyDetached({ publicKeyPem, domain, timestamp, raw, signature }) {
  const key = await importEd25519PublicKey(publicKeyPem);
  const body = raw instanceof Uint8Array ? raw : enc.encode(String(raw));
  const message = concatBytes(enc.encode(`${domain}\n${timestamp}\n`), body);
  return crypto.subtle.verify({ name: 'Ed25519' }, key, fromB64url(signature), message);
}
async function verifyChallenge({ nodeId, challenge, publicKeyPem, signature }) {
  return verifyDetached({
    publicKeyPem,
    domain: TERRITORY_HOST_NODE_CHALLENGE_DOMAIN,
    timestamp: 0,
    raw: enc.encode(`${nodeId}\n${challenge}`),
    signature
  });
}
function publicAuthority(row) {
  if (!row) return null;
  return Object.freeze({
    schema: TERRITORY_HOST_AUTHORITY_SCHEMA,
    authorityId: row.authority_id,
    appointmentId: row.appointment_id,
    territoryId: row.territory_id,
    stewardPublicName: row.public_name || null,
    issuerNodeId: row.issuer_node_id,
    issuerOperatorId: row.issuer_operator_id,
    issuerCallbackBase: row.issuer_callback_base,
    issuerKeyFingerprint: row.issuer_key_fingerprint,
    status: row.status,
    canIssueHostAdmissions: Number(row.can_issue_host_admissions) === 1,
    canDelegateAuthority: Number(row.can_delegate_authority) === 1,
    maxGrantTtlSeconds: Number(row.max_grant_ttl_seconds),
    createdAt: row.created_at,
    revokedAt: row.revoked_at || null
  });
}
async function audit(edge, eventType, fields = {}) {
  const at = iso(edge.now());
  await edge.db.prepare(`INSERT INTO territory_host_admission_audit
    (audit_id,event_type,authority_id,grant_id,territory_id,issuer_node_id,subject_node_id,payload_json,created_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)`)
    .bind(`host-audit:${crypto.randomUUID()}`, clean(eventType, 120), clean(fields.authorityId, 180) || null,
      clean(fields.grantId, 180) || null, clean(fields.territoryId, 120) || null, clean(fields.issuerNodeId, 180) || null,
      clean(fields.subjectNodeId, 180) || null, JSON.stringify(fields.payload || {}), at).run();
}

export async function probePublicHostNode(edge, { nodeId, operatorId, callbackUrl } = {}) {
  const id = slug(nodeId, 180), operator = required(operatorId, 'operatorId', 180), callbackBase = publicCallbackBase(callbackUrl);
  if (!id) throw Object.assign(new TypeError('nodeId is required.'), { status: 400 });
  const fetchImpl = edge.fetch || globalThis.fetch;
  const manifestResponse = await fetchImpl(nodeEndpoint(callbackBase, 'api/ai/node/manifest'), { headers: { accept: 'application/json' }, cache: 'no-store' });
  const envelope = await manifestResponse.json().catch(() => ({}));
  if (!manifestResponse.ok) throw Object.assign(new Error('Civweave core could not fetch the candidate node manifest.'), { status: 400 });
  const manifest = envelope?.manifest || envelope;
  if (slug(manifest?.nodeId, 180) !== id || clean(manifest?.operatorId, 180) !== operator) {
    throw Object.assign(new Error('Candidate node manifest identity does not match the requested host admission.'), { status: 400 });
  }
  const publicKey = clean(manifest?.publicKey, 20000);
  if (!publicKey) throw Object.assign(new TypeError('Candidate node must advertise an Ed25519 public key.'), { status: 400 });
  const challenge = randomToken(32);
  const proofResponse = await fetchImpl(nodeEndpoint(callbackBase, 'api/ai/node/live/challenge'), {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ nodeId: id, challenge }), cache: 'no-store'
  });
  const proof = await proofResponse.json().catch(() => ({}));
  if (!proofResponse.ok || !proof.signature) throw Object.assign(new Error('Candidate node did not answer the host-admission proof challenge.'), { status: 400 });
  if (!await verifyChallenge({ nodeId: id, challenge, publicKeyPem: publicKey, signature: proof.signature })) {
    throw Object.assign(new Error('Candidate node host-admission proof challenge signature is invalid.'), { status: 401 });
  }
  return Object.freeze({ nodeId: id, operatorId: operator, callbackBase, manifest, publicKey, keyFingerprint: await sha256Hex(publicKey) });
}

async function appointment(edge, appointmentId) {
  return edge.db.prepare(`SELECT s.*,t.territory_id AS scope_territory_id,t.active AS territory_active
    FROM money_edge_territory_stewards s JOIN money_edge_territories t ON t.territory_id=s.territory_id
    WHERE s.appointment_id=?1`).bind(required(appointmentId, 'appointmentId', 180)).first();
}
async function currentAuthorityForNode(edge, issuerNodeId) {
  const at = iso(edge.now());
  return edge.db.prepare(`SELECT a.*,s.public_name,s.appointment_status,s.effective_from,s.effective_until
    FROM territory_host_authorities a JOIN money_edge_territory_stewards s ON s.appointment_id=a.appointment_id
    WHERE a.issuer_node_id=?1 AND a.status='active' AND a.can_issue_host_admissions=1
      AND s.appointment_status='appointed' AND s.effective_from<=?2 AND (s.effective_until IS NULL OR s.effective_until>?2)
    ORDER BY a.created_at DESC LIMIT 1`).bind(slug(issuerNodeId, 180), at).first();
}
async function territoryInScope(edge, authorityTerritoryId, requestedTerritoryId) {
  const authority = clean(authorityTerritoryId, 120).toLowerCase(), requested = clean(requestedTerritoryId, 120).toLowerCase();
  if (!authority || !requested) return false;
  const row = await edge.db.prepare(`WITH RECURSIVE lineage(territory_id,parent_territory_id) AS (
      SELECT territory_id,parent_territory_id FROM money_edge_territories WHERE territory_id=?1 AND active=1
      UNION ALL
      SELECT t.territory_id,t.parent_territory_id FROM money_edge_territories t JOIN lineage l ON t.territory_id=l.parent_territory_id WHERE t.active=1
    ) SELECT territory_id FROM lineage WHERE territory_id=?2 LIMIT 1`).bind(requested, authority).first();
  return Boolean(row);
}

export async function publicTerritoryHostAuthorityRegistry(edge) {
  const rows = await edge.db.prepare(`SELECT a.*,s.public_name FROM territory_host_authorities a
    JOIN money_edge_territory_stewards s ON s.appointment_id=a.appointment_id
    ORDER BY a.territory_id,a.created_at DESC`).all();
  return Object.freeze({ schema: TERRITORY_HOST_AUTHORITY_SCHEMA, policy: TERRITORY_HOST_AUTHORITY_POLICY, authorities: (rows?.results || []).map(publicAuthority) });
}

export async function bindTerritoryHostAuthority(edge, input = {}, suppliedFabricToken = '') {
  if (!await secretEqual(suppliedFabricToken, edge.env?.NODE_FABRIC_BINDING_TOKEN || '')) {
    throw Object.assign(new Error('Territory host authority binding requires the private root fabric binding.'), { status: 403 });
  }
  const steward = await appointment(edge, input.appointmentId);
  if (!steward || Number(steward.territory_active) !== 1 || steward.appointment_status !== 'appointed') {
    throw Object.assign(new Error('Territory Steward appointment is not active.'), { status: 404 });
  }
  const at = iso(edge.now());
  if (steward.effective_from > at || (steward.effective_until && steward.effective_until <= at)) {
    throw Object.assign(new Error('Territory Steward appointment is outside its effective period.'), { status: 400 });
  }
  const proof = await probePublicHostNode(edge, input);
  await edge.db.prepare(`UPDATE territory_host_authorities SET status='revoked',revoked_at=?1,updated_at=?1
    WHERE status='active' AND (appointment_id=?2 OR issuer_node_id=?3)`).bind(at, steward.appointment_id, proof.nodeId).run();
  const authorityId = `territory-authority:${crypto.randomUUID()}`;
  await edge.db.prepare(`INSERT INTO territory_host_authorities
    (authority_id,appointment_id,territory_id,issuer_node_id,issuer_operator_id,issuer_callback_base,issuer_public_key,issuer_key_fingerprint,
     status,can_issue_host_admissions,can_delegate_authority,max_grant_ttl_seconds,created_at,updated_at,revoked_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,'active',1,0,?9,?10,?10,NULL)`)
    .bind(authorityId, steward.appointment_id, steward.territory_id, proof.nodeId, proof.operatorId, proof.callbackBase, proof.publicKey,
      proof.keyFingerprint, Math.min(TERRITORY_HOST_AUTHORITY_POLICY.maximumGrantTtlSeconds, Math.max(60, Number(input.maxGrantTtlSeconds) || TERRITORY_HOST_AUTHORITY_POLICY.maximumGrantTtlSeconds)), at).run();
  await audit(edge, 'territory-host-authority.bound', { authorityId, territoryId: steward.territory_id, issuerNodeId: proof.nodeId, payload: { appointmentId: steward.appointment_id, keyFingerprint: proof.keyFingerprint } });
  return publicAuthority(await edge.db.prepare(`SELECT a.*,s.public_name FROM territory_host_authorities a JOIN money_edge_territory_stewards s ON s.appointment_id=a.appointment_id WHERE a.authority_id=?1`).bind(authorityId).first());
}

export async function revokeTerritoryHostAuthority(edge, authorityId, suppliedFabricToken = '') {
  if (!await secretEqual(suppliedFabricToken, edge.env?.NODE_FABRIC_BINDING_TOKEN || '')) {
    throw Object.assign(new Error('Territory host authority revocation requires the private root fabric binding.'), { status: 403 });
  }
  const id = required(authorityId, 'authorityId', 180), at = iso(edge.now());
  const row = await edge.db.prepare('SELECT * FROM territory_host_authorities WHERE authority_id=?1').bind(id).first();
  if (!row) throw Object.assign(new Error('Territory host authority was not found.'), { status: 404 });
  await edge.db.prepare(`UPDATE territory_host_authorities SET status='revoked',revoked_at=?1,updated_at=?1 WHERE authority_id=?2`).bind(at, id).run();
  await audit(edge, 'territory-host-authority.revoked', { authorityId: id, territoryId: row.territory_id, issuerNodeId: row.issuer_node_id });
  return Object.freeze({ ...publicAuthority(row), status: 'revoked', revokedAt: at });
}

export async function issueTerritoryHostAdmission(edge, rawText, signatureHeader) {
  let input;
  try { input = JSON.parse(String(rawText || '{}')); } catch { throw Object.assign(new Error('Invalid host-admission JSON.'), { status: 400 }); }
  const issuerNodeId = slug(input.issuerNodeId, 180);
  if (!issuerNodeId) throw Object.assign(new TypeError('issuerNodeId is required.'), { status: 400 });
  const authority = await currentAuthorityForNode(edge, issuerNodeId);
  if (!authority) throw Object.assign(new Error('This node does not hold active Territory Steward host-admission authority.'), { status: 403 });
  const { timestamp, signature } = signatureHeaderParts(signatureHeader);
  if (Math.abs(nowSeconds(edge.now()) - timestamp) > 300) throw Object.assign(new Error('Territory host admission signature is outside the replay window.'), { status: 401 });
  if (!await verifyDetached({ publicKeyPem: authority.issuer_public_key, domain: TERRITORY_HOST_ADMISSION_REQUEST_DOMAIN, timestamp, raw: enc.encode(String(rawText || '')), signature })) {
    throw Object.assign(new Error('Territory host admission signature is invalid.'), { status: 401 });
  }
  const territoryId = clean(input.territoryId || authority.territory_id, 120).toLowerCase();
  if (!await territoryInScope(edge, authority.territory_id, territoryId)) {
    throw Object.assign(new Error('Territory Steward cannot sponsor a host outside the appointed territory or its descendants.'), { status: 403 });
  }
  const candidateHostId = slug(input.candidateHostId, 120), candidateNodeId = slug(input.candidateNodeId, 180);
  const candidateOperatorId = required(input.candidateOperatorId, 'candidateOperatorId', 180);
  if (!candidateHostId || !candidateNodeId) throw Object.assign(new TypeError('candidateHostId and candidateNodeId are required.'), { status: 400 });
  const candidateCallbackBase = publicCallbackBase(input.candidateCallbackUrl);
  const open = await edge.db.prepare(`SELECT COUNT(*) AS count FROM territory_host_admission_grants
    WHERE authority_id=?1 AND consumed_at IS NULL AND expires_at>?2`).bind(authority.authority_id, iso(edge.now())).first();
  if (Number(open?.count || 0) >= TERRITORY_HOST_AUTHORITY_POLICY.maximumOpenGrantsPerAuthority) {
    throw Object.assign(new Error('Territory host authority has too many unconsumed admission grants.'), { status: 429 });
  }
  const ttlSeconds = Math.max(60, Math.min(Number(input.ttlSeconds) || TERRITORY_HOST_AUTHORITY_POLICY.defaultGrantTtlSeconds,
    Number(authority.max_grant_ttl_seconds) || TERRITORY_HOST_AUTHORITY_POLICY.maximumGrantTtlSeconds,
    TERRITORY_HOST_AUTHORITY_POLICY.maximumGrantTtlSeconds));
  const token = randomToken(32), grantHash = await sha256Hex(`civweave.territory-host-admission.v1\n${token}`), grantId = `host-grant:${crypto.randomUUID()}`;
  const createdAt = iso(edge.now()), expiresAt = iso(edge.now() + ttlSeconds * 1000);
  await edge.db.prepare(`INSERT INTO territory_host_admission_grants
    (grant_hash,grant_id,authority_id,territory_id,candidate_host_id,candidate_node_id,candidate_operator_id,candidate_callback_base,created_at,expires_at,consumed_at,consumed_node_id)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,NULL,NULL)`)
    .bind(grantHash, grantId, authority.authority_id, territoryId, candidateHostId, candidateNodeId, candidateOperatorId, candidateCallbackBase, createdAt, expiresAt).run();
  await audit(edge, 'territory-host-admission.issued', { authorityId: authority.authority_id, grantId, territoryId, issuerNodeId, subjectNodeId: candidateNodeId, payload: { candidateHostId, expiresAt } });
  return Object.freeze({
    schema: TERRITORY_HOST_ADMISSION_SCHEMA,
    grantId,
    admissionGrant: token,
    singleUse: true,
    territoryId,
    candidateHostId,
    candidateNodeId,
    candidateOperatorId,
    candidateCallbackBase,
    issuedBy: publicAuthority(authority),
    createdAt,
    expiresAt
  });
}

export async function claimTerritoryHostAdmission(edge, input = {}) {
  const token = required(input.admissionGrant, 'admissionGrant', 1000);
  const grantHash = await sha256Hex(`civweave.territory-host-admission.v1\n${token}`);
  const row = await edge.db.prepare(`SELECT g.*,a.status AS authority_status,a.issuer_node_id,a.appointment_id,s.public_name
    FROM territory_host_admission_grants g JOIN territory_host_authorities a ON a.authority_id=g.authority_id
    JOIN money_edge_territory_stewards s ON s.appointment_id=a.appointment_id WHERE g.grant_hash=?1`).bind(grantHash).first();
  if (!row) throw Object.assign(new Error('Territory host admission grant is invalid.'), { status: 401 });
  const at = iso(edge.now());
  if (row.authority_status !== 'active') throw Object.assign(new Error('Territory host admission authority has been revoked.'), { status: 403 });
  if (row.consumed_at) throw Object.assign(new Error('Territory host admission grant has already been used.'), { status: 401 });
  if (row.expires_at <= at) throw Object.assign(new Error('Territory host admission grant has expired.'), { status: 401 });
  const hostId = slug(input.hostId, 120), nodeId = slug(input.nodeId, 180), operatorId = required(input.operatorId, 'operatorId', 180), callbackBase = publicCallbackBase(input.callbackUrl);
  if (hostId !== row.candidate_host_id || nodeId !== row.candidate_node_id || operatorId !== row.candidate_operator_id || callbackBase !== row.candidate_callback_base) {
    throw Object.assign(new Error('Territory host admission grant is bound to a different host identity.'), { status: 403 });
  }
  const proof = await probePublicHostNode(edge, { nodeId, operatorId, callbackUrl: callbackBase });
  const consumed = await edge.db.prepare(`UPDATE territory_host_admission_grants SET consumed_at=?1,consumed_node_id=?2
    WHERE grant_hash=?3 AND consumed_at IS NULL AND expires_at>?1`).bind(at, nodeId, grantHash).run();
  if (Number(consumed?.meta?.changes ?? consumed?.changes ?? 0) !== 1) throw Object.assign(new Error('Territory host admission grant could not be consumed.'), { status: 409 });
  const manifest = proof.manifest || {};
  const displayName = clean(manifest.displayName || hostId, 180) || hostId;
  const runtime = clean(manifest.runtime || 'civweave-host', 80) || 'civweave-host';
  const capabilities = Array.isArray(manifest.capabilities) ? [...new Set(manifest.capabilities.map(value => clean(value, 120)).filter(Boolean))] : [];
  await edge.db.prepare(`INSERT INTO nodes(node_id,operator_id,display_name,runtime,public_origin,capabilities_json,location_json,status,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,NULL,'active',?7)
    ON CONFLICT(node_id) DO UPDATE SET operator_id=excluded.operator_id,display_name=excluded.display_name,runtime=excluded.runtime,
      public_origin=excluded.public_origin,capabilities_json=excluded.capabilities_json,status='active',updated_at=excluded.updated_at`)
    .bind(nodeId, operatorId, displayName, runtime, callbackBase, JSON.stringify(capabilities), at).run();
  await audit(edge, 'territory-host-admission.claimed', { authorityId: row.authority_id, grantId: row.grant_id, territoryId: row.territory_id, issuerNodeId: row.issuer_node_id, subjectNodeId: nodeId, payload: { hostId, callbackBase, keyFingerprint: proof.keyFingerprint } });
  await edge.db.prepare(`INSERT INTO launch_audit(audit_id,event_type,subject_id,payload_json,created_at)
    VALUES(?1,'territory-host-admitted',?2,?3,?4)`)
    .bind(`territory-host:${crypto.randomUUID()}`, nodeId, JSON.stringify({ schema: TERRITORY_HOST_ADMISSION_SCHEMA, hostId, territoryId: row.territory_id, authorityId: row.authority_id, appointmentId: row.appointment_id, stewardPublicName: row.public_name, keyFingerprint: proof.keyFingerprint }), at).run();
  return Object.freeze({
    schema: TERRITORY_HOST_ADMISSION_SCHEMA,
    admitted: true,
    hostId,
    nodeId,
    operatorId,
    callbackBase,
    territoryId: row.territory_id,
    grantId: row.grant_id,
    authorityId: row.authority_id,
    stewardPublicName: row.public_name,
    nodeKeyFingerprint: proof.keyFingerprint,
    trustChain: Object.freeze(['civweave-core', `territory:${row.territory_id}`, `authority:${row.authority_id}`, `node:${nodeId}`]),
    admittedAt: at
  });
}
