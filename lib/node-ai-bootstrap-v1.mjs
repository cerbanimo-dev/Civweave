import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, chmodSync, renameSync, unlinkSync } from 'node:fs';

export const NODE_AI_BOOTSTRAP_SCHEMA = 'civweave.node-ai-bootstrap.v1';
export const DEFAULT_CIVWEAVE_MONEY_EDGE_URL = 'https://civweave-core.cerbanimo.workers.dev';

function clean(value, max = 10000) { return String(value ?? '').trim().slice(0, max); }
function randomSecret() { return crypto.randomBytes(32).toString('base64url'); }
function canonicalPem(value) { return clean(value, 20000); }
function fingerprint(publicKey) { return crypto.createHash('sha256').update(canonicalPem(publicKey)).digest('hex'); }
function derivePublicKey(privateKey) {
  return canonicalPem(crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString());
}
function generateReceiptKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: canonicalPem(publicKey.export({ type: 'spki', format: 'pem' }).toString()),
    privateKey: canonicalPem(privateKey.export({ type: 'pkcs8', format: 'pem' }).toString())
  };
}
function atomicWrite(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  try { chmodSync(temp, 0o600); } catch {}
  try { renameSync(temp, filePath); }
  catch (error) { try { unlinkSync(temp); } catch {} throw error; }
  try { chmodSync(filePath, 0o600); } catch {}
}
function readState(filePath) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    return parsed?.schema === NODE_AI_BOOTSTRAP_SCHEMA ? parsed : null;
  } catch { return null; }
}
function normalizeEdgeUrl(value) {
  const url = new URL(clean(value, 4000) || DEFAULT_CIVWEAVE_MONEY_EDGE_URL);
  if (url.protocol !== 'https:') throw new RangeError('Civweave money edge must use HTTPS.');
  return url.origin;
}

export class NodeAiBootstrapStore {
  constructor({
    dataDir = process.env.DATA_DIR || './data',
    filePath = process.env.NODE_AI_BOOTSTRAP_PATH || '',
    env = process.env,
    now = () => Date.now()
  } = {}) {
    this.env = env;
    this.now = now;
    this.filePath = path.resolve(filePath || path.join(dataDir, 'node-ai-bootstrap-v1.json'));
    this.state = this.#loadOrCreate();
  }

  #loadOrCreate() {
    const prior = readState(this.filePath) || {};
    let privateKey = canonicalPem(this.env.NODE_AI_RECEIPT_PRIVATE_KEY) || canonicalPem(prior.receiptPrivateKey);
    let publicKey = canonicalPem(this.env.NODE_AI_RECEIPT_PUBLIC_KEY) || canonicalPem(prior.receiptPublicKey);
    if (!privateKey) {
      const generated = generateReceiptKeypair();
      privateKey = generated.privateKey;
      publicKey = generated.publicKey;
    } else if (!publicKey) publicKey = derivePublicKey(privateKey);
    const keyFingerprint = fingerprint(publicKey);
    const nodeId = clean(this.env.NODE_AI_NODE_ID, 180) || clean(prior.nodeId, 180) || `node-${keyFingerprint.slice(0, 24)}`;
    const operatorId = clean(this.env.NODE_AI_OPERATOR_ID, 180) || clean(prior.operatorId, 180) || `operator-${keyFingerprint.slice(0, 24)}`;
    const state = {
      schema: NODE_AI_BOOTSTRAP_SCHEMA,
      nodeId,
      operatorId,
      receiptPrivateKey: privateKey,
      receiptPublicKey: publicKey,
      receiptKeyId: clean(this.env.NODE_AI_RECEIPT_KEY_ID, 120) || clean(prior.receiptKeyId, 120) || `node-${keyFingerprint.slice(0, 12)}`,
      authSecret: clean(this.env.NODE_AI_AUTH_SECRET) || clean(this.env.AI_WALLET_AUTH_SECRET) || clean(prior.authSecret) || randomSecret(),
      internalSecret: clean(this.env.NODE_AI_INTERNAL_SECRET) || clean(this.env.AI_WALLET_INTERNAL_SECRET) || clean(prior.internalSecret) || randomSecret(),
      capabilitySecret: clean(this.env.NODE_AI_CAPABILITY_SECRET) || clean(this.env.AI_WALLET_CAPABILITY_SECRET) || clean(prior.capabilitySecret) || randomSecret(),
      paymentWebhookSecret: clean(this.env.NODE_AI_PAYMENT_WEBHOOK_SECRET) || clean(this.env.AI_WALLET_PAYMENT_SECRET) || clean(prior.paymentWebhookSecret) || randomSecret(),
      moneyEdgeUrl: normalizeEdgeUrl(this.env.CIVWEAVE_MONEY_EDGE_URL || prior.moneyEdgeUrl || DEFAULT_CIVWEAVE_MONEY_EDGE_URL),
      moneyEdgePublicKey: canonicalPem(this.env.CIVWEAVE_MONEY_EDGE_PUBLIC_KEY) || canonicalPem(prior.moneyEdgePublicKey) || null,
      moneyEdgeKeyId: clean(prior.moneyEdgeKeyId, 120) || null,
      moneyEdgeFingerprint: clean(prior.moneyEdgeFingerprint, 128) || null,
      createdAt: prior.createdAt || new Date(this.now()).toISOString(),
      updatedAt: new Date(this.now()).toISOString()
    };
    atomicWrite(this.filePath, state);
    return state;
  }

  pinMoneyEdgeTrust({ publicKey, keyId = '', fingerprint: claimedFingerprint = '', origin = '' } = {}) {
    const normalizedKey = canonicalPem(publicKey);
    if (!normalizedKey) throw new TypeError('Money-edge public key is required.');
    const calculated = fingerprint(normalizedKey);
    if (claimedFingerprint && clean(claimedFingerprint, 128) !== calculated) throw new Error('Money-edge trust fingerprint does not match its public key.');
    if (origin && normalizeEdgeUrl(origin) !== this.state.moneyEdgeUrl) throw new Error('Money-edge trust document came from a different origin.');
    if (this.state.moneyEdgePublicKey && canonicalPem(this.state.moneyEdgePublicKey) !== normalizedKey) throw new Error('Money-edge trust root changed after this node pinned it.');
    this.state = {
      ...this.state,
      moneyEdgePublicKey: normalizedKey,
      moneyEdgeKeyId: clean(keyId, 120) || this.state.moneyEdgeKeyId,
      moneyEdgeFingerprint: calculated,
      updatedAt: new Date(this.now()).toISOString()
    };
    atomicWrite(this.filePath, this.state);
    return this.publicState();
  }

  publicState() {
    return Object.freeze({
      schema: NODE_AI_BOOTSTRAP_SCHEMA,
      nodeId: this.state.nodeId,
      operatorId: this.state.operatorId,
      receiptPublicKey: this.state.receiptPublicKey,
      receiptKeyId: this.state.receiptKeyId,
      moneyEdgeUrl: this.state.moneyEdgeUrl,
      moneyEdgeTrustPinned: Boolean(this.state.moneyEdgePublicKey),
      moneyEdgeKeyId: this.state.moneyEdgeKeyId,
      moneyEdgeFingerprint: this.state.moneyEdgeFingerprint,
      storage: this.filePath,
      secretsGeneratedLocally: true
    });
  }
}

export function loadOrCreateNodeAiBootstrap(options = {}) {
  return new NodeAiBootstrapStore(options);
}