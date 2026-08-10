import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, chmodSync, renameSync, unlinkSync } from 'node:fs';

export const MONEY_EDGE_BOOTSTRAP_SCHEMA = 'civweave.money-edge-bootstrap.v1';

function clean(value, max = 20000) { return String(value ?? '').trim().slice(0, max); }
function canonicalPem(value) { return clean(value, 20000); }
function randomSecret() { return crypto.randomBytes(32).toString('base64url'); }
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
  try { const parsed = JSON.parse(readFileSync(filePath, 'utf8')); return parsed?.schema === MONEY_EDGE_BOOTSTRAP_SCHEMA ? parsed : null; }
  catch { return null; }
}
function generatePair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    privateKey: canonicalPem(privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()),
    publicKey: canonicalPem(publicKey.export({ type: 'spki', format: 'pem' }).toString())
  };
}

export function loadOrCreateMoneyEdgeIdentity({
  dataDir = process.env.DATA_DIR || './data',
  filePath = process.env.CIVWEAVE_MONEY_EDGE_IDENTITY_PATH || '',
  env = process.env,
  now = () => Date.now()
} = {}) {
  const target = path.resolve(filePath || path.join(dataDir, 'money-edge-identity-v1.json'));
  const prior = readState(target) || {};
  let privateKey = canonicalPem(env.CIVWEAVE_MONEY_EDGE_PRIVATE_KEY) || canonicalPem(prior.privateKey);
  let publicKey = canonicalPem(prior.publicKey);
  if (!privateKey) {
    const generated = generatePair();
    privateKey = generated.privateKey;
    publicKey = generated.publicKey;
  } else if (!publicKey) publicKey = canonicalPem(crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString());
  const fingerprint = crypto.createHash('sha256').update(publicKey).digest('hex');
  const state = {
    schema: MONEY_EDGE_BOOTSTRAP_SCHEMA,
    keyId: clean(env.CIVWEAVE_MONEY_EDGE_KEY_ID, 120) || clean(prior.keyId, 120) || `cerbanimo-edge-${fingerprint.slice(0, 12)}`,
    privateKey,
    publicKey,
    fingerprint,
    adminSecret: clean(env.CIVWEAVE_MONEY_EDGE_ADMIN_SECRET) || clean(prior.adminSecret) || randomSecret(),
    createdAt: prior.createdAt || new Date(now()).toISOString(),
    updatedAt: new Date(now()).toISOString()
  };
  atomicWrite(target, state);
  return Object.freeze({
    ...state,
    filePath: target,
    signingIdentityGeneratedLocally: !clean(env.CIVWEAVE_MONEY_EDGE_PRIVATE_KEY),
    adminCredentialGeneratedLocally: !clean(env.CIVWEAVE_MONEY_EDGE_ADMIN_SECRET)
  });
}
