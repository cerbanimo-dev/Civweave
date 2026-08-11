import { StripeConnectWorkerProvider } from './stripe-connect.mjs';

export const NODE_MONEY_EDGE_SCHEMA = 'civweave.node-money-edge.v1';
export const NODE_MONEY_EVENT_SCHEMA = 'civweave.node-payment-event.v1';
export const NODE_MONEY_CHALLENGE_DOMAIN = 'civweave.node-live-challenge.v1';
export const NODE_MONEY_REQUEST_DOMAIN = 'civweave.node-money-edge-request.v1';
export const MONEY_EDGE_EVENT_DOMAIN = 'civweave.money-edge-event.v1';
export const NODE_MONEY_ENROLLMENT_SCHEMA = 'civweave.node-money-enrollment-grant.v1';
export const TOPUP_ECONOMY = Object.freeze({ systemBps: 7000, hostBps: 2500, cerbanimoBps: 500 });

const enc = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const bool = value => value === true || ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
const iso = now => new Date(now()).toISOString();
const sleepSafeStatus = error => Number.isSafeInteger(error?.status) ? error.status : 500;

function required(value, label, max = 4000) {
  const out = clean(value, max);
  if (!out) throw Object.assign(new TypeError(`${label} is required.`), { status: 400 });
  return out;
}
function integer(value, label, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw Object.assign(new RangeError(`${label} must be an integer from ${min} through ${max}.`), { status: 400 });
  }
  return parsed;
}
function concatBytes(...parts) {
  const arrays = parts.map(part => part instanceof Uint8Array ? part : new Uint8Array(part));
  const size = arrays.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of arrays) { out.set(part, offset); offset += part.byteLength; }
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
function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return b64url(value);
}
async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : enc.encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function pemToDer(pem) {
  const base64 = required(pem, 'publicKey', 20000)
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!base64) throw Object.assign(new TypeError('Public key PEM is invalid.'), { status: 400 });
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
export function derToPem(der) {
  const bytes = der instanceof Uint8Array ? der : new Uint8Array(der);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}
async function importEd25519PublicKey(pem) {
  return crypto.subtle.importKey('spki', pemToDer(pem), { name: 'Ed25519' }, false, ['verify']);
}
function signatureHeaderParts(header) {
  const values = Object.fromEntries(
    String(header || '').split(',').map(part => part.trim().split('=', 2)).filter(parts => parts.length === 2)
  );
  const timestamp = Number(values.t);
  const keyId = clean(values.kid, 120);
  const signature = clean(values.sig, 2000);
  if (!Number.isSafeInteger(timestamp) || !signature) {
    throw Object.assign(new Error('Malformed Civweave money signature header.'), { status: 401 });
  }
  return { timestamp, keyId, signature };
}
async function verifyDetached({ publicKeyPem, domain, timestamp, raw, signature }) {
  const key = await importEd25519PublicKey(publicKeyPem);
  const prefix = enc.encode(`${domain}\n${timestamp}\n`);
  const body = raw instanceof Uint8Array ? raw : enc.encode(String(raw));
  return crypto.subtle.verify({ name: 'Ed25519' }, key, fromB64url(signature), concatBytes(prefix, body));
}
async function verifyChallenge({ nodeId, challenge, publicKeyPem, signature }) {
  return verifyDetached({
    publicKeyPem,
    domain: NODE_MONEY_CHALLENGE_DOMAIN,
    timestamp: 0,
    raw: enc.encode(`${nodeId}\n${challenge}`),
    signature
  });
}
function d1Changes(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}
function callbackOrigin(value, nodeDomain = 'nodes.commonweave.earth') {
  const url = new URL(required(value, 'callbackUrl'));
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw Object.assign(new RangeError('Money-edge callback must be a credential-free HTTPS origin.'), { status: 400 });
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const suffix = `.${clean(nodeDomain, 255).toLowerCase()}`;
  if (!host.endsWith(suffix) || host.slice(0, -suffix.length).includes('.') || !host.slice(0, -suffix.length)) {
    throw Object.assign(new RangeError(`Money-edge callback must use a dedicated *.${nodeDomain} host.`), { status: 400 });
  }
  return url.origin;
}
function safeReturnUrl(value, expectedOrigin) {
  const url = new URL(required(value, 'return URL'));
  if (url.protocol !== 'https:' || url.origin !== expectedOrigin) {
    throw Object.assign(new RangeError('Checkout return URLs must stay on the registered HTTPS node origin.'), { status: 400 });
  }
  return url.href;
}
export function splitTopupServiceNet(serviceNetCents) {
  const net = integer(serviceNetCents, 'serviceNetCents', 0, 50_000_000);
  const systemReserveCents = Math.floor(net * TOPUP_ECONOMY.systemBps / 10_000);
  const hostShareCents = Math.floor(net * TOPUP_ECONOMY.hostBps / 10_000);
  return Object.freeze({
    serviceNetCents: net,
    systemReserveCents,
    hostShareCents,
    cerbanimoShareCents: net - systemReserveCents - hostShareCents,
  });
}
function proportional(total, part, whole) {
  if (!whole || !total || !part) return 0;
  return Math.max(0, Math.min(total, Math.floor(total * part / whole)));
}
function publicTopup(row) {
  if (!row) return null;
  return Object.freeze({
    schema: 'civweave.node-money-topup.v2',
    topupId: row.topup_id,
    nodeId: row.node_id,
    userId: row.user_id,
    grossCents: Number(row.gross_cents),
    currency: row.currency,
    processorFeeCents: Number(row.processor_fee_cents || 0),
    serviceNetCents: Number(row.service_net_cents || 0),
    systemReserveCents: Number(row.system_reserve_cents || row.user_credit_cents || 0),
    hostShareCents: Number(row.host_share_cents || 0),
    cerbanimoShareCents: Number(row.cerbanimo_share_cents || row.platform_fee_cents || 0),
    platformFeeCents: Number(row.cerbanimo_share_cents || row.platform_fee_cents || 0),
    userCreditCents: Number(row.system_reserve_cents || row.user_credit_cents || 0),
    hostTransferId: row.stripe_transfer_id || null,
    status: row.status,
    checkoutUrl: row.checkout_url || null,
    createdAt: row.created_at,
    settledAt: row.settled_at || null,
    refundedCents: Number(row.refunded_cents || 0),
    refundedGrossCents: Number(row.refunded_gross_cents || 0),
    disputedCents: Number(row.disputed_cents || 0),
    disputedGrossCents: Number(row.disputed_gross_cents || 0)
  });
}

export class CloudflareMoneyEdge {
  constructor(env, { fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
    this.env = env;
    this.db = env.DB;
    this.fetch = fetchImpl;
    this.now = now;
    this.nodeDomain = clean(env.NODE_DOMAIN || 'nodes.commonweave.earth', 255);
    this.platformFeeBps = integer(env.CIVWEAVE_PLATFORM_FEE_BPS ?? TOPUP_ECONOMY.cerbanimoBps, 'CIVWEAVE_PLATFORM_FEE_BPS', 0, 10000);
    this.maxTopupCents = integer(env.CIVWEAVE_MONEY_MAX_TOPUP_CENTS ?? 100000, 'CIVWEAVE_MONEY_MAX_TOPUP_CENTS', 100, 5000000);
    this.signatureToleranceSeconds = integer(env.CIVWEAVE_MONEY_SIGNATURE_TOLERANCE_SECONDS ?? 300, 'signature tolerance', 30, 3600);
    this.enrollmentTtlSeconds = integer(env.CIVWEAVE_MONEY_ENROLLMENT_TTL_SECONDS ?? 600, 'enrollment TTL', 60, 3600);
    this.provider = new StripeConnectWorkerProvider({
      secretKey: env.STRIPE_SECRET_KEY || '',
      webhookSecret: env.STRIPE_CONNECT_WEBHOOK_SECRET || '',
      apiVersion: env.STRIPE_API_VERSION || '',
      fetchImpl
    });
  }

  readiness() {
    const structuralBlockers = [];
    if (!this.db) structuralBlockers.push('d1-binding-missing');
    if (!this.env.IDENTITY) structuralBlockers.push('identity-durable-object-binding-missing');
    if (!this.provider.credentialsPresent) structuralBlockers.push('provider-credentials-missing');
    if (!this.provider.webhookVerificationReady) structuralBlockers.push('provider-webhook-verification-not-ready');
    const operationalBlockers = [];
    if (bool(this.env.CIVWEAVE_MONEY_EMERGENCY_STOP)) operationalBlockers.push('emergency-stop-active');
    if (!bool(this.env.CIVWEAVE_MONEY_LIVE_ENABLED)) operationalBlockers.push('live-money-disabled');
    if (this.provider.mode !== 'live') operationalBlockers.push('provider-not-live');
    if (!bool(this.env.CIVWEAVE_MONEY_COMPLIANCE_APPROVED)) operationalBlockers.push('compliance-approval-missing');
    if (!bool(this.env.CIVWEAVE_MONEY_JURISDICTION_APPROVED)) operationalBlockers.push('jurisdiction-approval-missing');
    if (!bool(this.env.CIVWEAVE_MONEY_KYC_AML_READY)) operationalBlockers.push('kyc-aml-readiness-missing');
    if (!bool(this.env.CIVWEAVE_MONEY_TAX_REPORTING_READY)) operationalBlockers.push('tax-reporting-readiness-missing');
    if (!bool(this.env.CIVWEAVE_MONEY_TERMS_APPROVED)) operationalBlockers.push('provider-terms-not-approved');
    return Object.freeze({
      schema: NODE_MONEY_EDGE_SCHEMA,
      authority: 'cloudflare-core',
      canonical: true,
      provider: this.provider.id,
      providerMode: this.provider.mode,
      operatorPayouts: this.provider.operatorPayouts,
      platformFeeBps: TOPUP_ECONOMY.cerbanimoBps,
      topupEconomy: TOPUP_ECONOMY,
      fundsModel: 'platform-reserve-separate-transfer',
      enrollment: 'proof-of-key-short-lived-grant',
      callbackPolicy: `dedicated-subdomain-of-${this.nodeDomain}`,
      integrationDoorReady: structuralBlockers.length === 0,
      liveReady: structuralBlockers.length === 0 && operationalBlockers.length === 0,
      structuralBlockers,
      operationalBlockers
    });
  }

  identityStub() {
    if (!this.env.IDENTITY) throw Object.assign(new Error('Money-edge identity binding is unavailable.'), { status: 503 });
    return this.env.IDENTITY.get(this.env.IDENTITY.idFromName('cerbanimo-money-edge'));
  }

  async trustDocument(origin = '') {
    const response = await this.identityStub().fetch('https://identity.internal/trust');
    const trust = await response.json();
    if (!response.ok) throw Object.assign(new Error('Money-edge trust identity is unavailable.'), { status: 503 });
    return { ...trust, origin: clean(origin, 4000) };
  }

  async signEvent(raw) {
    const timestamp = Math.floor(this.now() / 1000);
    const response = await this.identityStub().fetch('https://identity.internal/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        domain: MONEY_EDGE_EVENT_DOMAIN,
        timestamp,
        payload: b64url(raw instanceof Uint8Array ? raw : enc.encode(String(raw)))
      })
    });
    const result = await response.json();
    if (!response.ok || !result.signature) throw Object.assign(new Error('Money-edge event signing failed.'), { status: 503 });
    return `t=${timestamp},kid=${result.keyId},sig=${result.signature}`;
  }

  async node(nodeId) {
    return this.db.prepare('SELECT * FROM money_edge_nodes WHERE node_id=?1').bind(required(nodeId, 'nodeId', 180)).first();
  }
  async topupById(id) {
    return this.db.prepare('SELECT * FROM money_edge_topups WHERE topup_id=?1').bind(required(id, 'topupId', 180)).first();
  }
  async topupBySession(id) {
    return this.db.prepare('SELECT * FROM money_edge_topups WHERE stripe_session_id=?1').bind(required(id, 'sessionId', 220)).first();
  }
  async topupByCharge(id) {
    return this.db.prepare('SELECT * FROM money_edge_topups WHERE stripe_charge_id=?1').bind(required(id, 'chargeId', 220)).first();
  }

  async verifyNodeRequest(nodeId, raw, header) {
    const node = await this.node(nodeId);
    if (!node) throw Object.assign(new Error('Node is not registered with the Cloudflare money edge.'), { status: 404 });
    const { timestamp, signature } = signatureHeaderParts(header);
    if (Math.abs(Math.floor(this.now() / 1000) - timestamp) > this.signatureToleranceSeconds) {
      throw Object.assign(new Error('Node money-edge request signature is outside the replay window.'), { status: 401 });
    }
    const ok = await verifyDetached({
      publicKeyPem: node.receipt_public_key,
      domain: NODE_MONEY_REQUEST_DOMAIN,
      timestamp,
      raw,
      signature
    });
    if (!ok) throw Object.assign(new Error('Node money-edge request signature is invalid.'), { status: 401 });
    return node;
  }

  async probeNode({ nodeId, operatorId, callbackUrl }) {
    const origin = callbackOrigin(callbackUrl, this.nodeDomain);
    const manifestResponse = await this.fetch(new URL('/api/ai/node/manifest', origin), {
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });
    const envelope = await manifestResponse.json().catch(() => ({}));
    if (!manifestResponse.ok) throw Object.assign(new Error('Money edge could not fetch the node manifest.'), { status: 400 });
    const manifest = envelope?.manifest || envelope;
    if (manifest.nodeId !== nodeId || manifest.operatorId !== operatorId) {
      throw Object.assign(new Error('Node manifest identity does not match money-edge enrollment.'), { status: 400 });
    }
    const publicKey = required(manifest.publicKey, 'node receipt public key', 20000);
    const challenge = randomToken(32);
    const proofResponse = await this.fetch(new URL('/api/ai/node/live/challenge', origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ nodeId, challenge })
    });
    const proof = await proofResponse.json().catch(() => ({}));
    if (!proofResponse.ok || !proof.signature) throw Object.assign(new Error('Node did not answer the live-money proof challenge.'), { status: 400 });
    if (!await verifyChallenge({ nodeId, challenge, publicKeyPem: publicKey, signature: proof.signature })) {
      throw Object.assign(new Error('Node live-money proof challenge signature is invalid.'), { status: 401 });
    }
    return { origin, manifest, publicKey };
  }

  async createEnrollmentGrant({ nodeId, operatorId, callbackUrl } = {}) {
    if (bool(this.env.CIVWEAVE_MONEY_EMERGENCY_STOP)) throw Object.assign(new Error('Money edge emergency stop is active.'), { status: 503 });
    const id = required(nodeId, 'nodeId', 180);
    const operator = required(operatorId, 'operatorId', 180);
    const proof = await this.probeNode({ nodeId: id, operatorId: operator, callbackUrl });
    const token = randomToken(32);
    const grantHash = await sha256Hex(token);
    const createdAt = iso(this.now());
    const expiresAt = iso(this.now() + this.enrollmentTtlSeconds * 1000);
    await this.db.prepare(`INSERT INTO money_edge_enrollment_grants
      (grant_hash,node_id,operator_id,callback_origin,receipt_public_key,platform_fee_bps,created_at,expires_at,consumed_at)
      VALUES(?1,?2,?3,?4,?5,?6,?7,?8,NULL)`)
      .bind(grantHash, id, operator, proof.origin, proof.publicKey, TOPUP_ECONOMY.cerbanimoBps, createdAt, expiresAt).run();
    return Object.freeze({
      schema: NODE_MONEY_ENROLLMENT_SCHEMA,
      token,
      nodeId: id,
      operatorId: operator,
      callbackOrigin: proof.origin,
      platformFeeBps: TOPUP_ECONOMY.cerbanimoBps,
      topupEconomy: TOPUP_ECONOMY,
      expiresAt
    });
  }

  async consumeGrant({ token, nodeId, operatorId, callbackOrigin: origin, publicKey }) {
    const grantHash = await sha256Hex(required(token, 'enrollmentGrant', 1000));
    const grant = await this.db.prepare('SELECT * FROM money_edge_enrollment_grants WHERE grant_hash=?1').bind(grantHash).first();
    if (!grant) throw Object.assign(new Error('Enrollment grant is invalid.'), { status: 401 });
    if (grant.consumed_at) throw Object.assign(new Error('Enrollment grant was already used.'), { status: 401 });
    if (Date.parse(grant.expires_at) <= this.now()) throw Object.assign(new Error('Enrollment grant expired.'), { status: 401 });
    if (grant.node_id !== nodeId || grant.operator_id !== operatorId || grant.callback_origin !== origin || grant.receipt_public_key !== publicKey) {
      throw Object.assign(new Error('Enrollment grant is bound to a different node identity.'), { status: 401 });
    }
    const result = await this.db.prepare('UPDATE money_edge_enrollment_grants SET consumed_at=?1 WHERE grant_hash=?2 AND consumed_at IS NULL')
      .bind(iso(this.now()), grantHash).run();
    if (d1Changes(result) !== 1) throw Object.assign(new Error('Enrollment grant could not be consumed exactly once.'), { status: 401 });
    return grant;
  }

  async registerNode({ nodeId, operatorId, callbackUrl, enrollmentGrant, email = '', country = '' } = {}) {
    if (bool(this.env.CIVWEAVE_MONEY_EMERGENCY_STOP)) throw Object.assign(new Error('Money edge emergency stop is active.'), { status: 503 });
    const id = required(nodeId, 'nodeId', 180);
    const operator = required(operatorId, 'operatorId', 180);
    const proof = await this.probeNode({ nodeId: id, operatorId: operator, callbackUrl });
    const grant = await this.consumeGrant({ token: enrollmentGrant, nodeId: id, operatorId: operator, callbackOrigin: proof.origin, publicKey: proof.publicKey });
    const existing = await this.node(id);
    if (existing && (existing.operator_id !== operator || existing.receipt_public_key !== proof.publicKey)) {
      throw Object.assign(new Error('Existing node registration belongs to a different operator identity.'), { status: 409 });
    }
    const accountId = existing?.connected_account_id || (await this.provider.createConnectedAccount({ nodeId: id, operatorId: operator, email, country })).id;
    const at = iso(this.now());
    await this.db.prepare(`INSERT INTO money_edge_nodes
      (node_id,operator_id,connected_account_id,callback_origin,receipt_public_key,platform_fee_bps,created_at,updated_at)
      VALUES(?1,?2,?3,?4,?5,?6,?7,?8)
      ON CONFLICT(node_id) DO UPDATE SET operator_id=excluded.operator_id,connected_account_id=excluded.connected_account_id,callback_origin=excluded.callback_origin,receipt_public_key=excluded.receipt_public_key,platform_fee_bps=excluded.platform_fee_bps,updated_at=excluded.updated_at`)
      .bind(id, operator, accountId, proof.origin, proof.publicKey, TOPUP_ECONOMY.cerbanimoBps, existing?.created_at || at, at).run();
    const link = await this.provider.createAccountLink({ accountId, refreshUrl: `${proof.origin}/app/node-ai-operator-v1.html?money=refresh`, returnUrl: `${proof.origin}/app/node-ai-operator-v1.html?money=return` });
    return Object.freeze({
      schema: NODE_MONEY_EDGE_SCHEMA,
      authority: 'cloudflare-core',
      nodeId: id,
      operatorId: operator,
      connectedAccountId: accountId,
      onboardingUrl: link.url,
      onboardingExpiresAt: link.expires_at ? new Date(Number(link.expires_at) * 1000).toISOString() : null,
      platformFeeBps: TOPUP_ECONOMY.cerbanimoBps,
      topupEconomy: TOPUP_ECONOMY,
      operatorPayouts: this.provider.operatorPayouts,
      enrollment: 'proof-of-key-short-lived-grant'
    });
  }

  async operatorStatus(nodeId, raw, signatureHeader) {
    const node = await this.verifyNodeRequest(nodeId, raw, signatureHeader);
    const account = await this.provider.retrieveAccount(node.connected_account_id);
    return Object.freeze({
      schema: NODE_MONEY_EDGE_SCHEMA,
      authority: 'cloudflare-core',
      nodeId: node.node_id,
      operatorId: node.operator_id,
      connectedAccountId: node.connected_account_id,
      platformFeeBps: TOPUP_ECONOMY.cerbanimoBps,
      topupEconomy: TOPUP_ECONOMY,
      fundsModel: 'platform-reserve-separate-transfer',
      chargesEnabled: Boolean(account?.charges_enabled),
      payoutsEnabled: Boolean(account?.payouts_enabled),
      detailsSubmitted: Boolean(account?.details_submitted),
      requirementsCurrentlyDue: account?.requirements?.currently_due || [],
      requirementsPastDue: account?.requirements?.past_due || [],
      operatorPayouts: this.provider.operatorPayouts,
      moneyEdge: this.readiness()
    });
  }

  async createTopUp(input, raw, signatureHeader) {
    const nodeId = required(input?.nodeId, 'nodeId', 180);
    const node = await this.verifyNodeRequest(nodeId, raw, signatureHeader);
    if (bool(this.env.CIVWEAVE_MONEY_EMERGENCY_STOP)) throw Object.assign(new Error('Money edge emergency stop is active.'), { status: 503 });
    const readiness = this.readiness();
    if (this.provider.mode === 'live' && !readiness.liveReady) throw Object.assign(new Error(`Live node money is blocked: ${readiness.operationalBlockers.join(', ')}`), { status: 503 });
    const userId = required(input.userId, 'userId', 180);
    const gross = integer(input.grossCents, 'grossCents', 1, this.maxTopupCents);
    const currency = clean(input.currency || 'USD', 12).toUpperCase();
    if (currency !== 'USD') throw Object.assign(new RangeError('Node money edge v1 currently accepts USD top-ups only.'), { status: 400 });
    const idempotencyKey = required(input.idempotencyKey, 'idempotencyKey', 180);
    const successUrl = safeReturnUrl(input.successUrl, node.callback_origin);
    const cancelUrl = safeReturnUrl(input.cancelUrl, node.callback_origin);
    const prior = await this.db.prepare('SELECT * FROM money_edge_topups WHERE idempotency_key=?1').bind(idempotencyKey).first();
    let topup = prior;
    if (prior) {
      if (prior.node_id !== nodeId || prior.user_id !== userId || Number(prior.gross_cents) !== gross) throw Object.assign(new Error('Top-up idempotency key was reused for a different request.'), { status: 409 });
      if (prior.checkout_url) return publicTopup(prior);
    } else {
      const topupId = `topup:${crypto.randomUUID()}`;
      const at = iso(this.now());
      await this.db.prepare(`INSERT INTO money_edge_topups
        (topup_id,idempotency_key,node_id,user_id,gross_cents,currency,platform_fee_cents,processor_fee_cents,user_credit_cents,status,created_at,updated_at,refunded_cents,disputed_cents)
        VALUES(?1,?2,?3,?4,?5,?6,0,0,0,'creating-checkout',?7,?8,0,0)`)
        .bind(topupId, idempotencyKey, nodeId, userId, gross, currency, at, at).run();
      topup = await this.topupById(topupId);
    }
    const hashedIdempotency = (await sha256Hex(idempotencyKey)).slice(0, 48);
    const session = await this.provider.createTopUpCheckout({
      accountId: node.connected_account_id,
      nodeId,
      userId,
      topupId: topup.topup_id,
      grossCents: gross,
      currency: currency.toLowerCase(),
      successUrl,
      cancelUrl,
      idempotencyKey: `civweave-${hashedIdempotency}`,
      displayName: `Civweave compute credit · ${nodeId}`
    });
    const at = iso(this.now());
    await this.db.prepare(`UPDATE money_edge_topups SET stripe_session_id=?1,checkout_url=?2,status='checkout-pending',updated_at=?3 WHERE topup_id=?4`)
      .bind(session.id, session.url || null, at, topup.topup_id).run();
    return publicTopup(await this.topupById(topup.topup_id));
  }

  async enqueueDelivery(sourceEventId, topup, payload) {
    const id = `delivery:${crypto.randomUUID()}`;
    const at = iso(this.now());
    await this.db.prepare(`INSERT OR IGNORE INTO money_edge_deliveries
      (delivery_id,source_event_id,topup_id,node_id,event_type,payload_json,status,attempts,last_error,created_at,updated_at,delivered_at)
      VALUES(?1,?2,?3,?4,?5,?6,'pending',0,NULL,?7,?8,NULL)`)
      .bind(id, sourceEventId, topup.topup_id, topup.node_id, payload.type, JSON.stringify(payload), at, at).run();
    return this.db.prepare('SELECT * FROM money_edge_deliveries WHERE source_event_id=?1').bind(sourceEventId).first();
  }

  async deliver(row) {
    const node = await this.node(row.node_id);
    if (!node) throw Object.assign(new Error('Delivery node is no longer registered.'), { status: 404 });
    const rawText = row.payload_json;
    const raw = enc.encode(rawText);
    const signature = await this.signEvent(raw);
    let error = '';
    try {
      const response = await this.fetch(new URL('/api/ai/node/live/payments/webhook', node.callback_origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-civweave-money-edge-signature': signature },
        body: rawText
      });
      if (!response.ok) error = `node returned HTTP ${response.status}`;
    } catch (caught) {
      error = clean(caught?.message || caught, 1000);
    }
    const at = iso(this.now());
    const attempts = Number(row.attempts || 0) + 1;
    if (!error) {
      await this.db.prepare(`UPDATE money_edge_deliveries SET status='delivered',attempts=?1,last_error=NULL,updated_at=?2,delivered_at=?3 WHERE delivery_id=?4`)
        .bind(attempts, at, at, row.delivery_id).run();
      return true;
    }
    await this.db.prepare(`UPDATE money_edge_deliveries SET status='pending',attempts=?1,last_error=?2,updated_at=?3 WHERE delivery_id=?4`)
      .bind(attempts, error, at, row.delivery_id).run();
    return false;
  }

  async deliverPending({ limit = 100 } = {}) {
    const bounded = integer(Number(limit) || 100, 'delivery limit', 1, 250);
    const page = await this.db.prepare(`SELECT * FROM money_edge_deliveries WHERE status='pending' ORDER BY created_at LIMIT ?1`).bind(bounded).all();
    const rows = page.results || [];
    let delivered = 0;
    for (const row of rows) if (await this.deliver(row)) delivered += 1;
    return { attempted: rows.length, delivered, pending: rows.length - delivered };
  }

  async settleTopUpBySession(sessionId, sourceEventId) {
    const topup = await this.topupBySession(sessionId);
    if (!topup) throw Object.assign(new Error('Stripe Checkout Session is not registered with Civweave.'), { status: 404 });
    if (topup.status === 'settled') return publicTopup(topup);
    const node = await this.node(topup.node_id);
    const verified = await this.provider.verifyTopUpSession({
      accountId: node.connected_account_id,
      sessionId: topup.stripe_session_id,
      nodeId: topup.node_id,
      userId: topup.user_id,
      topupId: topup.topup_id,
      grossCents: Number(topup.gross_cents),
      currency: topup.currency.toLowerCase()
    });
    const serviceNet = Math.max(0, Math.min(Number(topup.gross_cents), Number(verified.netCents ?? Number(topup.gross_cents) - Number(verified.processorFeeCents || 0))));
    const split = splitTopupServiceNet(serviceNet);
    let transfer = null;
    if (split.hostShareCents > 0) {
      transfer = await this.provider.createHostTransfer({
        accountId: node.connected_account_id,
        amountCents: split.hostShareCents,
        currency: topup.currency.toLowerCase(),
        sourceTransaction: verified.chargeId,
        transferGroup: `civweave-topup:${topup.topup_id}`,
        idempotencyKey: `civweave-host-${(await sha256Hex(topup.topup_id)).slice(0, 48)}`,
        metadata: { civweave_topup_id: topup.topup_id, civweave_node_id: topup.node_id, civweave_split: 'host-25' }
      });
    }
    const at = iso(this.now());
    await this.db.prepare(`UPDATE money_edge_topups SET
      processor_fee_cents=?1,service_net_cents=?2,system_reserve_cents=?3,host_share_cents=?4,cerbanimo_share_cents=?5,
      platform_fee_cents=?6,user_credit_cents=?7,stripe_transfer_id=?8,stripe_payment_intent_id=?9,stripe_charge_id=?10,stripe_balance_transaction_id=?11,
      status='settled',settled_at=?12,updated_at=?13 WHERE topup_id=?14`)
      .bind(Number(verified.processorFeeCents || 0), split.serviceNetCents, split.systemReserveCents, split.hostShareCents, split.cerbanimoShareCents,
        split.cerbanimoShareCents, split.systemReserveCents, transfer?.id || null, verified.paymentIntentId, verified.chargeId, verified.balanceTransactionId,
        at, at, topup.topup_id).run();
    const current = await this.topupById(topup.topup_id);
    const payload = Object.freeze({
      schema: NODE_MONEY_EVENT_SCHEMA,
      id: sourceEventId,
      provider: this.provider.id,
      userId: current.user_id,
      type: 'topup.paid',
      grossCents: Number(current.gross_cents),
      processorFeeCents: Number(current.processor_fee_cents),
      serviceNetCents: Number(current.service_net_cents),
      systemReserveCents: Number(current.system_reserve_cents),
      hostShareCents: Number(current.host_share_cents),
      cerbanimoShareCents: Number(current.cerbanimo_share_cents),
      platformFeeBps: TOPUP_ECONOMY.cerbanimoBps,
      platformFeeCents: Number(current.cerbanimo_share_cents),
      userCreditCents: Number(current.system_reserve_cents),
      externalAccountId: node.connected_account_id,
      metadata: {
        topupId: current.topup_id,
        stripeSessionId: current.stripe_session_id,
        stripeChargeId: current.stripe_charge_id,
        stripeTransferId: current.stripe_transfer_id,
        feeAuthority: 'cerbanimo-money-edge',
        infrastructureAuthority: 'cloudflare-core',
        fundsModel: 'platform-reserve-separate-transfer',
        split: '70-system-25-host-5-cerbanimo'
      },
      mintEffect: 0,
      supplyEffect: 0
    });
    const delivery = await this.enqueueDelivery(sourceEventId, current, payload);
    await this.deliver(delivery);
    return publicTopup(current);
  }

  async reverseHostShare(topup, { grossAmountCents, kind, eventId } = {}) {
    const gross = Number(topup.gross_cents || 0), hostShare = Number(topup.host_share_cents || 0);
    if (!topup.stripe_transfer_id || gross <= 0 || hostShare <= 0) return 0;
    const column = kind === 'dispute' ? 'host_dispute_reversed_cents' : 'host_refund_reversed_cents';
    const otherColumn = kind === 'dispute' ? 'host_refund_reversed_cents' : 'host_dispute_reversed_cents';
    const current = Number(topup[column] || 0), other = Number(topup[otherColumn] || 0);
    const target = Math.min(proportional(hostShare, grossAmountCents, gross), Math.max(0, hostShare - other));
    const delta = Math.max(0, target - current);
    if (!delta) return 0;
    await this.provider.reverseHostTransfer({
      transferId: topup.stripe_transfer_id,
      amountCents: delta,
      idempotencyKey: `civweave-${kind}-host-${(await sha256Hex(`${eventId}:${topup.topup_id}:${delta}`)).slice(0, 48)}`,
      metadata: { civweave_topup_id: topup.topup_id, civweave_reason: kind }
    });
    return delta;
  }

  async handleRefund(event, charge) {
    const topup = await this.topupByCharge(required(charge.id, 'Stripe charge ID', 220));
    if (!topup) return { ignored: true, reason: 'unknown-charge' };
    const gross = Number(topup.gross_cents || 0);
    const cumulativeGross = Math.min(Number(charge.amount_refunded || 0), gross);
    const grossDelta = cumulativeGross - Number(topup.refunded_gross_cents || 0);
    if (grossDelta <= 0) return { ignored: true, reason: 'refund-already-applied' };
    const maxRefundCredit = Math.max(0, Number(topup.user_credit_cents || 0) - Number(topup.disputed_cents || 0));
    const cumulativeCredit = Math.min(proportional(Number(topup.user_credit_cents || 0), cumulativeGross, gross), maxRefundCredit);
    const creditDelta = Math.max(0, cumulativeCredit - Number(topup.refunded_cents || 0));
    const hostDelta = await this.reverseHostShare(topup, { grossAmountCents: cumulativeGross, kind: 'refund', eventId: event.id });
    const at = iso(this.now());
    await this.db.prepare('UPDATE money_edge_topups SET refunded_gross_cents=?1,refunded_cents=?2,host_refund_reversed_cents=host_refund_reversed_cents+?3,updated_at=?4 WHERE topup_id=?5')
      .bind(cumulativeGross, cumulativeCredit, hostDelta, at, topup.topup_id).run();
    const current = await this.topupById(topup.topup_id);
    if (creditDelta > 0) {
      const node = await this.node(current.node_id);
      const payload = Object.freeze({
        schema: NODE_MONEY_EVENT_SCHEMA,
        id: event.id,
        provider: this.provider.id,
        userId: current.user_id,
        type: 'topup.refunded',
        grossRefundCents: grossDelta,
        amountCents: creditDelta,
        userCreditCents: creditDelta,
        externalAccountId: node.connected_account_id,
        metadata: { topupId: current.topup_id, stripeChargeId: charge.id, cumulativeRefundGrossCents: cumulativeGross, hostShareReversedCents: hostDelta },
        mintEffect: 0,
        supplyEffect: 0
      });
      const delivery = await this.enqueueDelivery(event.id, current, payload);
      await this.deliver(delivery);
    }
    return { applied: true, topup: publicTopup(current), grossDeltaCents: grossDelta, creditDeltaCents: creditDelta, hostShareReversedCents: hostDelta };
  }

  async handleDispute(event, dispute) {
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
    if (!chargeId) return { ignored: true, reason: 'dispute-charge-missing' };
    const topup = await this.topupByCharge(chargeId);
    if (!topup) return { ignored: true, reason: 'unknown-charge' };
    const gross = Number(topup.gross_cents || 0);
    const cumulativeGross = Math.min(Number(dispute.amount || 0), gross);
    const grossDelta = cumulativeGross - Number(topup.disputed_gross_cents || 0);
    if (grossDelta <= 0) return { ignored: true, reason: 'dispute-already-applied' };
    const maxDisputeCredit = Math.max(0, Number(topup.user_credit_cents || 0) - Number(topup.refunded_cents || 0));
    const cumulativeCredit = Math.min(proportional(Number(topup.user_credit_cents || 0), cumulativeGross, gross), maxDisputeCredit);
    const creditDelta = Math.max(0, cumulativeCredit - Number(topup.disputed_cents || 0));
    const hostDelta = await this.reverseHostShare(topup, { grossAmountCents: cumulativeGross, kind: 'dispute', eventId: event.id });
    const at = iso(this.now());
    await this.db.prepare('UPDATE money_edge_topups SET disputed_gross_cents=?1,disputed_cents=?2,host_dispute_reversed_cents=host_dispute_reversed_cents+?3,updated_at=?4 WHERE topup_id=?5')
      .bind(cumulativeGross, cumulativeCredit, hostDelta, at, topup.topup_id).run();
    const current = await this.topupById(topup.topup_id);
    if (creditDelta > 0) {
      const node = await this.node(current.node_id);
      const payload = Object.freeze({
        schema: NODE_MONEY_EVENT_SCHEMA,
        id: event.id,
        provider: this.provider.id,
        userId: current.user_id,
        type: 'payment.chargeback',
        grossDisputeCents: grossDelta,
        amountCents: creditDelta,
        userCreditCents: creditDelta,
        externalAccountId: node.connected_account_id,
        metadata: { topupId: current.topup_id, stripeChargeId: chargeId, disputeId: dispute.id, hostShareReversedCents: hostDelta },
        mintEffect: 0,
        supplyEffect: 0
      });
      const delivery = await this.enqueueDelivery(event.id, current, payload);
      await this.deliver(delivery);
    }
    return { applied: true, topup: publicTopup(current), grossDeltaCents: grossDelta, creditDeltaCents: creditDelta, hostShareReversedCents: hostDelta };
  }

  async handleProviderEvent(event) {
    const object = event?.data?.object || {};
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (object.payment_status && object.payment_status !== 'paid') return { ignored: true, reason: 'checkout-not-paid' };
      return { applied: true, topup: await this.settleTopUpBySession(required(object.id, 'Stripe session ID', 220), event.id) };
    }
    if (event.type === 'charge.refunded') return this.handleRefund(event, object);
    if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.funds_withdrawn') return this.handleDispute(event, object);
    return { ignored: true, reason: 'unsupported-provider-event' };
  }

  async refundTopUp({ nodeId, topupId, amountCents }, raw, signatureHeader) {
    const node = await this.verifyNodeRequest(nodeId, raw, signatureHeader);
    const topup = await this.topupById(topupId);
    if (!topup || topup.node_id !== node.node_id) throw Object.assign(new Error('Top-up is not owned by this node.'), { status: 404 });
    if (!topup.stripe_charge_id || topup.status !== 'settled') throw Object.assign(new Error('Top-up is not settled and refundable.'), { status: 400 });
    const remaining = Number(topup.gross_cents) - Number(topup.refunded_gross_cents || 0);
    const amount = integer(amountCents, 'amountCents', 1, remaining);
    const refund = await this.provider.refundTopUp({
      chargeId: topup.stripe_charge_id,
      amountCents: amount,
      idempotencyKey: `civweave-refund-${(await sha256Hex(`${topupId}:${amount}:${topup.refunded_gross_cents || 0}`)).slice(0, 48)}`
    });
    return Object.freeze({ schema: NODE_MONEY_EDGE_SCHEMA, authority: 'cloudflare-core', topupId, refundId: refund.id, amountCents: amount, status: refund.status || 'pending-webhook' });
  }
}

export function moneyEdgeError(error) {
  const status = sleepSafeStatus(error);
  const message = status >= 500 ? 'Civweave Cloudflare money edge request failed.' : clean(error?.message || error, 1200);
  return { status, body: { error: message } };
}
