import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const templateRoot=join(repoRoot,'cloudflare/mobile-guild-edge');
const config=JSON.parse(readFileSync(join(templateRoot,'civweave-update.json'),'utf8'));
const workflow=readFileSync(join(templateRoot,'.github/workflows/civweave-auto-update.yml'),'utf8');
const wrangler=JSON.parse(readFileSync(join(templateRoot,'wrangler.jsonc'),'utf8'));
const relay=readFileSync(join(templateRoot,'src/release-relay-entry.mjs'),'utf8');
const sw=readFileSync(join(repoRoot,'public/service-worker-release-generation-v1.js'),'utf8');
const selection=readFileSync(join(repoRoot,'public/app/host-node-status-selection-v1.js'),'utf8');
const builder=readFileSync(join(repoRoot,'scripts/build-guild-release-package-v1.mjs'),'utf8');

assert.equal(config.schema,'civweave.guild-partner-release-relay.v1');
assert.equal(config.mode,'partner-relay');
assert.equal(config.automaticCentralUpstream,false);
assert.equal(config.releaseManifestSchema,'civweave.guild-release-manifest.v1');
assert.equal(config.trustBundleSchema,'civweave.release-trust-bundle.v1');
assert.equal(wrangler.main,'src/release-relay-entry.mjs');

assert.doesNotMatch(workflow,/schedule\s*:/);
assert.doesNotMatch(workflow,/cerbanimo-dev\/Civweave|git clone|sourceRepository|SOURCE_CHANNEL/);
assert.match(workflow,/workflow_dispatch/);
assert.match(workflow,/contents:\s*read/);

for(const route of [
  '/api/civweave-release/current',
  '/api/civweave-release/asset',
  '/api/civweave-release/import',
  '/api/civweave-release/relay',
  '/api/civweave-trust/bundle',
  '/api/civweave-trust/import'
]) assert.ok(relay.includes(route),`Guild release relay route missing: ${route}`);
assert.match(relay,/authenticateGuild/);
assert.match(relay,/membershipHash/);
assert.match(relay,/Partner Guild asset hash mismatch/);

assert.match(sw,/civweave\.release-trust-bundle\.v1/);
assert.match(sw,/civweave\.release-key-delegation\.v1/);
assert.match(sw,/civweave\.release-key-revocation\.v1/);
assert.match(sw,/explicit-local-import/);
assert.match(sw,/signer\.capabilities\.includes\('release'\)/);
assert.match(sw,/issuer\.capabilities\.includes\('delegate'\)/);
assert.match(sw,/issuer\.capabilities\.includes\('revoke'\)/);
assert.match(sw,/Guild release asset hash mismatch/);
assert.match(sw,/async function activeGuildRelease\(\)/);
assert.match(sw,/if\(active\)return activeGuildResponse\(pathname,request\.method,active\)/);
assert.match(sw,/A selected Guild does not become exclusive application transport until a complete signed release is installed/);
assert.match(sw,/CIVWEAVE_GUILD_RELEASE_CLEAR/);
assert.doesNotMatch(sw,/\/api\/.*(?:root|central).*key/i);

assert.match(selection,/CIVWEAVE_GUILD_RELEASE_CONFIG/);
assert.match(selection,/CIVWEAVE_RELEASE_TRUST_ANCHOR/);
assert.match(selection,/explicit:true/);
assert.match(selection,/trustReleasePartner/);
assert.match(selection,/legacy-mobile-guild-not-release-capable/);
assert.match(selection,/CIVWEAVE_GUILD_RELEASE_CLEAR/);

for(const path of [
  '/app/generation-lifecycle-v2.js',
  '/app/settings-local-route-v331.js',
  '/app/settings-local-loader-v337.js',
  '/app/shared-guide-surface-v236.js',
  '/app/guide-chat-surface-v350.js',
  '/app/local-ai/gemma4-current-registry-authority-v1.js',
  '/app/local-ai/gemma4-weave-draft-pipeline-v1.js',
  '/app/generation-failure-inspector-v1.js',
  '/app/human-message-bubble-v1.js',
  '/app/human-chat-network-v1.js',
  '/app/human-chat-guild-context-v1.js'
]) {
  assert.ok(sw.includes(`'${path}'`),`release worker missing required shell path ${path}`);
  assert.ok(builder.includes(`'${path}'`),`signed package builder missing required shell path ${path}`);
}

console.log(JSON.stringify({
  ok:true,
  schema:'civweave.decentralized-guild-release.test.v1',
  centralReleaseAuthority:false,
  centralKeyAuthority:false,
  guildRelay:true,
  localTrustAnchors:true,
  delegatedPartnerKeys:true,
  signedRevocations:true,
  guildOnlyTransportAfterCompatibleSignedRelease:true,
  legacyGuildSafeCutover:true
}));
