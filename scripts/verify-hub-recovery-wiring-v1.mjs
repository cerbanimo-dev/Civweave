import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const paths = [
  'cloudflare/account-edge/src/hub-account-recovery-v1.mjs',
  'cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs',
  'cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs',
  'cloudflare/account-edge/src/recovery-entry-v8.mjs',
  'cloudflare/account-edge/src/recovery-entry-v9.mjs',
  'cloudflare/account-edge/src/recovery-entry-v10.mjs',
  'cloudflare/account-edge/wrangler.jsonc',
  'cloudflare/node-cloud/wrangler.jsonc',
  'cloudflare/recovery-relay/src/index.mjs',
  'cloudflare/recovery-relay/wrangler.jsonc',
  '.github/workflows/deploy-civweave-pages.yml',
  '.github/workflows/enable-cloudflare-worker-subdomains-v1.yml',
  'scripts/resolve-cloudflare-recovery-zone-v1.mjs',
  'config/launch-topology-v1.json',
  'public/app/installer-repair-only-v1.js',
  'public/app/installer-online-fallback-v225.js',
  'public/app/civweave-brand.js',
  'public/app/hub-recovery-api-v1.js',
  'public/app/hub-recovery-ui-v1.js',
  'public/app/hub-delivery-intent-v1.js',
  'public/app/host-node-session-import-v1.js',
  'public/app/host-node-session-export-v1.js',
];
const source = Object.fromEntries(await Promise.all(paths.map(async path => [path, await readFile(path, 'utf8')])));

assert.match(source['cloudflare/account-edge/wrangler.jsonc'], /src\/recovery-entry-v10\.mjs/);
assert.match(source['cloudflare/account-edge/wrangler.jsonc'], /nodes\.civweave\.invalid/);
assert.doesNotMatch(source['cloudflare/account-edge/wrangler.jsonc'], /recover@/);
assert.doesNotMatch(source['cloudflare/account-edge/wrangler.jsonc'], /glaedn\.workers\.dev/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v10.mjs'], /HubAccountRecoveryOfflineService/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v10.mjs'], /civweave\.pages\.dev\/app\/recovery-relay-v1\.json/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v10.mjs'], /offline-code-only/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v10.mjs'], /validMailbox/);
assert.doesNotMatch(source['cloudflare/account-edge/src/recovery-entry-v10.mjs'], /HUB_RECOVERY_MAILBOX_PENDING/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs'], /HUB_OFFLINE_RECOVERY_CODE_COUNT = 8/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs'], /hub-offline-recovery:/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs'], /offlineRecoveryRemaining/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs'], /recoveryMethod: 'offline-code'/);
assert.doesNotMatch(source['cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs'], /storage\.put\([^\n]*codes/i, 'plaintext offline codes must not be persisted');
assert.match(source['cloudflare/recovery-relay/wrangler.jsonc'], /"name": "civweave-recovery-relay"/);
assert.match(source['cloudflare/recovery-relay/wrangler.jsonc'], /CivweaveRecoveryProofRelay/);
assert.doesNotMatch(source['cloudflare/recovery-relay/wrangler.jsonc'], /RECOVERY_MAILBOX/);
assert.match(source['cloudflare/recovery-relay/src/index.mjs'], /async email\(message, env/);
assert.match(source['cloudflare/recovery-relay/src/index.mjs'], /message\.reply\(new EmailMessage/);
assert.match(source['cloudflare/recovery-relay/src/index.mjs'], /exact-email-routing-rule/);
assert.match(source['cloudflare/recovery-relay/src/index.mjs'], /emailHash/);
assert.doesNotMatch(source['cloudflare/recovery-relay/src/index.mjs'], /passportId/i);
assert.doesNotMatch(source['cloudflare/recovery-relay/src/index.mjs'], /residentId/i);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /inbound-email-proof/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /authenticatedProof/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /completeInboundVerification/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /completeInboundRecovery/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /paste this one-time code/);
assert.doesNotMatch(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /glaedn\.workers\.dev/);
assert.match(source['scripts/resolve-cloudflare-recovery-zone-v1.mjs'], /civweave\|cerbanimo/);
assert.match(source['scripts/resolve-cloudflare-recovery-zone-v1.mjs'], /forbidden-recovery-zone/);
assert.match(source['scripts/resolve-cloudflare-recovery-zone-v1.mjs'], /commonweave\.earth/);
assert.match(source['.github/workflows/deploy-civweave-pages.yml'], /resolve-cloudflare-recovery-zone-v1\.mjs/);
assert.match(source['.github/workflows/deploy-civweave-pages.yml'], /recovery-relay-v1\.json/);
assert.match(source['.github/workflows/deploy-civweave-pages.yml'], /mailbox: process\.env\.RECOVERY_MAILBOX \|\| null/);
assert.match(source['.github/workflows/enable-cloudflare-worker-subdomains-v1.yml'], /resolve-cloudflare-recovery-zone-v1\.mjs/);
assert.match(source['.github/workflows/enable-cloudflare-worker-subdomains-v1.yml'], /RECOVERY_ZONE_ID/);
assert.match(source['.github/workflows/enable-cloudflare-worker-subdomains-v1.yml'], /pending-owned-zone/);
assert.match(source['config/launch-topology-v1.json'], /"domain": null/);
assert.match(source['config/launch-topology-v1.json'], /nodes\.civweave\.invalid/);
assert.match(source['cloudflare/node-cloud/wrangler.jsonc'], /nodes\.civweave\.invalid/);

const activeDomainSurfaces = ['cloudflare/account-edge/wrangler.jsonc','cloudflare/node-cloud/wrangler.jsonc','cloudflare/recovery-relay/wrangler.jsonc','.github/workflows/deploy-civweave-pages.yml','.github/workflows/enable-cloudflare-worker-subdomains-v1.yml','config/launch-topology-v1.json'];
for (const path of activeDomainSurfaces) assert.doesNotMatch(source[path], /(?:^|[^a-z])commonweave\.earth/i, `${path} must not depend on the unrelated commonweave.earth domain`);

assert.match(source['public/app/civweave-brand.js'], /hub-delivery-intent-v1\.js/);
assert.match(source['public/app/hub-delivery-intent-v1.js'], /mailto:/);
assert.match(source['public/app/hub-delivery-intent-v1.js'], /#cw-hub-recover-request/);
assert.match(source['public/app/installer-repair-only-v1.js'], /hub-recovery-api-v1\.js/);
assert.match(source['public/app/installer-repair-only-v1.js'], /browserRuntimePolicy:'installer-only-until-installed-display'/);
assert.match(source['public/app/installer-online-fallback-v225.js'], /retired:true/);
assert.match(source['public/app/installer-online-fallback-v225.js'], /browserRuntime:false/);
assert.match(source['public/app/hub-recovery-api-v1.js'], /recoveryKit:packet\.recoveryKit/);
assert.match(source['public/app/hub-recovery-api-v1.js'], /recoveryMethod/);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /Save these recovery codes now/);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /Use a saved recovery code/);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /Add a recovery email before creating this Hub account/);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /not written into your Passport or exposed to FellowFare/);
for (const path of paths.filter(path => /\.(?:js|mjs)$/.test(path))) {const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });assert.equal(result.status, 0, `${path} syntax failed: ${result.stderr || result.stdout}`);}

const recoveryNoStripeSurfaces = ['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs','cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs','cloudflare/account-edge/src/recovery-entry-v10.mjs','cloudflare/account-edge/wrangler.jsonc','cloudflare/recovery-relay/src/index.mjs','cloudflare/recovery-relay/wrangler.jsonc','scripts/resolve-cloudflare-recovery-zone-v1.mjs','public/app/hub-recovery-api-v1.js','public/app/hub-recovery-ui-v1.js','public/app/hub-delivery-intent-v1.js'];
for (const path of recoveryNoStripeSurfaces) assert.doesNotMatch(source[path], /stripe/i, `${path} must not add Stripe as a Hub recovery dependency`);
console.log(JSON.stringify({ok:true,schema:'civweave.hub-recovery-wiring-check.v8-install-only',freeTierInboundProof:true,offlineRecoveryCodes:true,offlineCodeCount:8,crossAccountRelay:true,relayDiscovery:'canonical-pages',ownedZoneOnly:true,unrelatedDomainGuard:true,relayStoresIdentity:false,browserRuntime:false}));
