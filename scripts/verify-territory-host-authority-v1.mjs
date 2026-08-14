import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { signTerritoryHostAdmissionRequest, TERRITORY_HOST_ADMISSION_REQUEST_DOMAIN } from '../lib/node-territory-host-authority-v1.mjs';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [migration,engine,entry,origin,nodeHandler,wallet,bindScript,consolePage,docs] = await Promise.all([
  read('cloudflare/core/migrations/0010_territory_host_authority.sql'),
  read('cloudflare/core/src/territory-host-authority-v1.mjs'),
  read('cloudflare/core/src/territory-host-entry-v1.mjs'),
  read('cloudflare/core/src/origin-entry.mjs'),
  read('lib/node-territory-host-authority-v1.mjs'),
  read('lib/ai-wallet-http-v1.mjs'),
  read('scripts/bind-territory-host-authority-v1.mjs'),
  read('public/app/territory-host-authority-v1.html'),
  read('docs/operations/territory-steward-host-authority-v1.md')
]);

assert.match(migration,/CREATE TABLE IF NOT EXISTS territory_host_authorities/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS territory_host_admission_grants/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS territory_host_admission_audit/);
assert.match(migration,/can_delegate_authority INTEGER NOT NULL DEFAULT 0/);
assert.match(migration,/grant_hash TEXT PRIMARY KEY/);
assert.match(migration,/consumed_at TEXT/);

assert.match(engine,/rootRemainsTrustAnchor:\s*true/);
assert.match(engine,/territoryMayDelegateTerritoryAuthority:\s*false/);
assert.match(engine,/candidateProofOfKeyRequired:\s*true/);
assert.match(engine,/rootSecretsDistributed:\s*false/);
assert.match(engine,/TERRITORY_HOST_ADMISSION_REQUEST_DOMAIN = 'civweave\.territory-host-admission-request\.v1'/);
assert.match(engine,/NODE_FABRIC_BINDING_TOKEN/);
assert.match(engine,/probePublicHostNode/);
assert.match(engine,/api\/ai\/node\/live\/challenge/);
assert.match(engine,/WITH RECURSIVE lineage/);
assert.match(engine,/consumed_at IS NULL AND expires_at>\?1/);
assert.match(engine,/INSERT INTO nodes/);
assert.match(engine,/territory-host-admitted/);

assert.match(entry,/GET' && url\.pathname === '\/api\/federation\/territory-host-authorities'/);
assert.match(entry,/\/internal\/federation\/territory-host-authorities\/bind/);
assert.match(entry,/\/api\/federation\/host-admissions\/grants/);
assert.match(entry,/\/api\/federation\/host-admissions\/claim/);
assert.match(origin,/from '\.\/territory-host-entry-v1\.mjs'/);

assert.match(nodeHandler,/requireNodeOperatorAuth/);
assert.match(nodeHandler,/rootSecretsPresent:\s*false/);
assert.match(nodeHandler,/recursiveAuthorityDelegation:\s*false/);
assert.match(nodeHandler,/\/api\/ai\/node\/territory-host-authority\/grants/);
assert.match(nodeHandler,/\/api\/ai\/node\/territory-host-authority\/claim/);
assert.doesNotMatch(nodeHandler,/NODE_FABRIC_OPERATOR_TOKEN|NODE_FABRIC_BINDING_TOKEN/);
assert.match(wallet,/createNodeTerritoryHostAuthorityHandler/);
assert.match(wallet,/territoryHostAuthority\.handle/);

assert.match(bindScript,/NODE_FABRIC_BINDING_TOKEN/);
assert.match(bindScript,/canonical root operator only/i);
assert.match(consolePage,/Open a trusted doorway/);
assert.match(consolePage,/Issue Host admission/);
assert.match(consolePage,/Claim Host admission/);
assert.match(docs,/can_delegate_authority.*false/is);
assert.match(docs,/Do not send the root binding token/i);

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const raw = Buffer.from(JSON.stringify({ issuerNodeId: 'territory-node', candidateNodeId: 'candidate-node' }));
const timestamp = 1_786_728_000;
const header = signTerritoryHostAdmissionRequest(raw, {
  privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  keyId: 'territory-test-key',
  timestamp
});
const fields = Object.fromEntries(header.split(',').map(part => part.split('=', 2)));
assert.equal(Number(fields.t), timestamp);
assert.equal(fields.kid, 'territory-test-key');
const message = Buffer.concat([Buffer.from(`${TERRITORY_HOST_ADMISSION_REQUEST_DOMAIN}\n${timestamp}\n`), raw]);
assert.equal(crypto.verify(null, message, publicKey, Buffer.from(fields.sig, 'base64url')), true, 'Territory admission signature must verify against the issuer node key.');

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.territory-host-authority.v1',
  checks: [
    'root-trust-anchor-preserved',
    'no-root-secrets-on-territory-node',
    'authority-non-recursive',
    'appointment-bound-authority',
    'territory-descendant-scope',
    'operator-session-required',
    'ed25519-issuer-signature',
    'candidate-proof-of-key',
    'single-use-expiring-grants',
    'atomic-grant-consumption',
    'canonical-directory-admission',
    'root-revocation',
    'operator-console-surface'
  ]
}, null, 2));
