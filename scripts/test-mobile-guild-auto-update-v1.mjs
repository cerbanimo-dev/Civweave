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
assert.match(sw,/if\(await guildConfig\(\)\)return activeGuildResponse/);
assert.doesNotMatch(sw,/\/api\/.*(?:root|central).*key/i);

assert.match(selection,/CIVWEAVE_GUILD_RELEASE_CONFIG/);
assert.match(selection,/CIVWEAVE_RELEASE_TRUST_ANCHOR/);
assert.match(selection,/explicit:true/);
assert.match(selection,/trustReleasePartner/);

console.log(JSON.stringify({
  ok:true,
  schema:'civweave.decentralized-guild-release.test.v1',
  centralReleaseAuthority:false,
  centralKeyAuthority:false,
  guildRelay:true,
  localTrustAnchors:true,
  delegatedPartnerKeys:true,
  signedRevocations:true,
  guildOnlyTransportWhenSelected:true
}));
