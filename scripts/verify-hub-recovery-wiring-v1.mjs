import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const paths = [
  'cloudflare/account-edge/src/hub-account-recovery-v1.mjs',
  'cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs',
  'cloudflare/account-edge/src/recovery-entry-v8.mjs',
  'cloudflare/account-edge/wrangler.jsonc',
  'cloudflare/recovery-relay/src/index.mjs',
  'cloudflare/recovery-relay/wrangler.jsonc',
  '.github/workflows/deploy-civweave-pages.yml',
  '.github/workflows/enable-cloudflare-worker-subdomains-v1.yml',
  'public/app/installer-online-fallback-v225.js',
  'public/app/civweave-brand.js',
  'public/app/hub-recovery-api-v1.js',
  'public/app/hub-recovery-ui-v1.js',
  'public/app/hub-delivery-intent-v1.js',
  'public/app/host-node-session-import-v1.js',
  'public/app/host-node-session-export-v1.js',
];
const source = Object.fromEntries(await Promise.all(paths.map(async path => [path, await readFile(path, 'utf8')])));

assert.match(source['cloudflare/account-edge/wrangler.jsonc'], /src\/recovery-entry-v8\.mjs/);
assert.match(source['cloudflare/account-edge/wrangler.jsonc'], /recover@recovery\.commonweave\.earth/);
assert.doesNotMatch(source['cloudflare/account-edge/wrangler.jsonc'], /glaedn\.workers\.dev/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v8.mjs'], /civweave\.pages\.dev\/app\/recovery-relay-v1\.json/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v8.mjs'], /civweave\.recovery-relay-discovery\.v1/);
assert.match(source['cloudflare/recovery-relay/wrangler.jsonc'], /"name": "civweave-recovery-relay"/);
assert.match(source['cloudflare/recovery-relay/wrangler.jsonc'], /CivweaveRecoveryProofRelay/);
assert.match(source['cloudflare/recovery-relay/src/index.mjs'], /async email\(message, env/);
assert.match(source['cloudflare/recovery-relay/src/index.mjs'], /message\.reply\(new EmailMessage/);
assert.match(source['cloudflare/recovery-relay/src/index.mjs'], /emailHash/);
assert.doesNotMatch(source['cloudflare/recovery-relay/src/index.mjs'], /passportId/i);
assert.doesNotMatch(source['cloudflare/recovery-relay/src/index.mjs'], /residentId/i);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /inbound-email-proof/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /authenticatedProof/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /completeInboundVerification/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /completeInboundRecovery/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /paste this one-time code/);
assert.match(source['.github/workflows/deploy-civweave-pages.yml'], /workers\/subdomain/);
assert.match(source['.github/workflows/deploy-civweave-pages.yml'], /recovery-relay-v1\.json/);
assert.match(source['.github/workflows/deploy-civweave-pages.yml'], /civweave\.recovery-relay-discovery\.v1/);
assert.match(source['.github/workflows/enable-cloudflare-worker-subdomains-v1.yml'], /workers\/subdomain/);
assert.match(source['.github/workflows/enable-cloudflare-worker-subdomains-v1.yml'], /RECOVERY_RELAY_URL/);
assert.match(source['public/app/civweave-brand.js'], /hub-delivery-intent-v1\.js/);
assert.match(source['public/app/hub-delivery-intent-v1.js'], /mailto:/);
assert.match(source['public/app/hub-delivery-intent-v1.js'], /#cw-hub-recover-request/);
assert.match(source['public/app/installer-online-fallback-v225.js'], /hub-recovery-api-v1\.js/);
assert.match(source['public/app/installer-online-fallback-v225.js'], /hub-recovery-ui-v1\.js/);
assert.match(source['public/app/hub-recovery-api-v1.js'], /\/nodes\/\$\{encodeURIComponent\(n\)\}\/api\/account\//);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /Add a recovery email before creating this Hub account/);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /not written into your Passport or exposed to FellowFare/);
for (const path of paths.filter(path => /\.(?:js|mjs)$/.test(path))) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${path} syntax failed: ${result.stderr || result.stdout}`);
}
for (const path of paths.filter(path => !path.endsWith('hub-account-recovery-v1.mjs'))) {
  assert.doesNotMatch(source[path], /stripe/i, `${path} must not add Stripe as a Hub recovery dependency`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.hub-recovery-wiring-check.v5',
  freeTierInboundProof: true,
  crossAccountRelay: true,
  relayDiscovery: 'canonical-pages',
  relayStoresIdentity: false,
}));
