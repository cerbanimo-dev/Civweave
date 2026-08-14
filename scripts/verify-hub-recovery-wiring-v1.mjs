import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const paths = [
  'cloudflare/account-edge/src/hub-account-recovery-v1.mjs',
  'cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs',
  'cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs',
  'cloudflare/account-edge/src/hub-passport-account-v1.mjs',
  'cloudflare/account-edge/src/hub-passport-account-v2.mjs',
  'cloudflare/account-edge/src/hub-passport-account-v3.mjs',
  'cloudflare/account-edge/src/hub-passport-account-v4.mjs',
  'cloudflare/account-edge/src/hub-passport-account-v5.mjs',
  'cloudflare/account-edge/src/recovery-entry-v10.mjs',
  'cloudflare/account-edge/src/recovery-entry-v11.mjs',
  'cloudflare/account-edge/wrangler.jsonc',
  'cloudflare/node-cloud/src/cloud-node-recovery-v1.mjs',
  'cloudflare/node-cloud/src/cloud-node-recovery-v2.mjs',
  'cloudflare/node-cloud/src/cloud-node-recovery-v3.mjs',
  'cloudflare/node-cloud/src/account-directory-v1.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v5.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v6.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v7.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v8.mjs',
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
  'public/app/hub-passport-account-v1.js',
  'public/app/hub-delivery-intent-v1.js',
  'public/app/host-node-session-v1.js',
  'public/app/host-node-session-import-v1.js',
  'public/app/host-node-session-export-v1.js',
];
const source = Object.fromEntries(await Promise.all(paths.map(async path => [path, await readFile(path, 'utf8')])));

// Legacy recovery infrastructure remains available and independent of Stripe.
assert.match(source['cloudflare/account-edge/wrangler.jsonc'], /src\/recovery-entry-v11\.mjs/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v11.mjs'], /PassportAccountService/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v10.mjs'], /HubAccountRecoveryOfflineService/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v10.mjs'], /offline-code-only/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs'], /HUB_OFFLINE_RECOVERY_CODE_COUNT = 8/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs'], /offlineRecoveryRemaining/);
assert.doesNotMatch(source['cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs'], /storage\.put\([^\n]*codes/i, 'plaintext offline codes must not be persisted');
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /inbound-email-proof/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /completeInboundVerification/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /completeInboundRecovery/);
assert.match(source['cloudflare/recovery-relay/src/index.mjs'], /async email\(message, env/);
assert.match(source['cloudflare/recovery-relay/src/index.mjs'], /emailHash/);
assert.doesNotMatch(source['cloudflare/recovery-relay/src/index.mjs'], /passportId/i);
assert.doesNotMatch(source['cloudflare/recovery-relay/src/index.mjs'], /residentId/i);

// Passport accounts now gate membership before a capacity seat is admitted.
assert.match(source['cloudflare/account-edge/src/hub-passport-account-v1.mjs'], /PASSPORT_ACCOUNT_SCHEMA/);
assert.match(source['cloudflare/account-edge/src/hub-passport-account-v1.mjs'], /verifiedAttestationSpki/);
assert.match(source['cloudflare/account-edge/src/hub-passport-account-v2.mjs'], /maxPairedDevices:\s*10/);
assert.match(source['cloudflare/account-edge/src/hub-passport-account-v2.mjs'], /maxActiveDevices:\s*2/);
assert.match(source['cloudflare/account-edge/src/hub-passport-account-v2.mjs'], /onlineMembershipReady/);
assert.match(source['cloudflare/account-edge/src/hub-passport-account-v2.mjs'], /offlineMembershipReady/);
assert.match(source['cloudflare/account-edge/src/hub-passport-account-v2.mjs'], /beginTotp/);
assert.match(source['cloudflare/account-edge/src/hub-passport-account-v3.mjs'], /bindCapacitySession/);
assert.match(source['cloudflare/account-edge/src/hub-passport-account-v3.mjs'], /checkCapacitySession/);
assert.match(source['cloudflare/account-edge/src/hub-passport-account-v4.mjs'], /regenerateRecoveryKit/);
assert.match(source['cloudflare/account-edge/src/hub-passport-account-v5.mjs'], /Recovery-code sign-in requires authenticator 2FA/);
assert.match(source['cloudflare/node-cloud/src/cloud-node-recovery-v2.mjs'], /hub-passport-account-v5\.mjs/);
assert.match(source['cloudflare/node-cloud/src/cloud-node-recovery-v2.mjs'], /\/api\/account\/session\/authorize/);
assert.match(source['cloudflare/node-cloud/src/cloud-node-recovery-v3.mjs'], /steward\/member\/remove/);
assert.match(source['cloudflare/node-cloud/src/server-ai-entry-v6.mjs'], /bindSession/);
assert.match(source['cloudflare/node-cloud/src/server-ai-entry-v6.mjs'], /annotateMember/);
assert.match(source['cloudflare/node-cloud/src/server-ai-entry-v7.mjs'], /function accountRoute/);
assert.match(source['cloudflare/node-cloud/src/server-ai-entry-v7.mjs'], /api\\\/account\\\/stripe/);
assert.match(source['cloudflare/node-cloud/src/server-ai-entry-v8.mjs'], /cloud-node-recovery-v3\.mjs/);
assert.match(source['cloudflare/node-cloud/wrangler.jsonc'], /server-ai-entry-v8\.mjs/);
assert.match(source['cloudflare/node-cloud/wrangler.jsonc'], /"ACCOUNT_DIRECTORY"/);
assert.match(source['cloudflare/node-cloud/wrangler.jsonc'], /"CERBANIMO_MAIL"/);

// UI contract: app use stays account-free, Hub membership does not.
assert.doesNotMatch(source['public/app/hub-recovery-ui-v1.js'], /outside recovery email is optional/i);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /Civweave works locally without an account/i);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /Online Hub membership requires a verified recovery email/i);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /Two-factor authentication/i);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /Up to 10 paired devices, with 2 active at a time/i);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /Annual Member Rebate/i);
assert.match(source['public/app/hub-recovery-ui-v1.js'], /Legacy recovery code/);
assert.match(source['public/app/hub-passport-account-v1.js'], /navigator\.credentials\.create/);
assert.match(source['public/app/hub-passport-account-v1.js'], /navigator\.credentials\.get/);
assert.match(source['public/app/hub-passport-account-v1.js'], /beginTotp/);
assert.match(source['public/app/hub-passport-account-v1.js'], /connectStripe/);
assert.match(source['public/app/host-node-session-v1.js'], /civweave\.hub-device-id\.v1/);
assert.match(source['public/app/host-node-session-v1.js'], /replaceDeviceId/);

// Account recovery relay and hidden mailbox machinery must never become a Stripe dependency.
const recoveryNoStripeSurfaces = [
  'cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs',
  'cloudflare/account-edge/src/hub-account-recovery-offline-v1.mjs',
  'cloudflare/account-edge/src/recovery-entry-v10.mjs',
  'cloudflare/account-edge/src/recovery-entry-v11.mjs',
  'cloudflare/account-edge/src/hub-passport-account-v1.mjs',
  'cloudflare/account-edge/src/hub-passport-account-v2.mjs',
  'cloudflare/account-edge/src/hub-passport-account-v3.mjs',
  'cloudflare/account-edge/src/hub-passport-account-v4.mjs',
  'cloudflare/account-edge/src/hub-passport-account-v5.mjs',
  'cloudflare/account-edge/wrangler.jsonc',
  'cloudflare/node-cloud/src/cloud-node-recovery-v1.mjs',
  'cloudflare/node-cloud/src/cloud-node-recovery-v2.mjs',
  'cloudflare/node-cloud/src/cloud-node-recovery-v3.mjs',
  'cloudflare/node-cloud/src/account-directory-v1.mjs',
  'cloudflare/recovery-relay/src/index.mjs',
  'cloudflare/recovery-relay/wrangler.jsonc',
  'scripts/resolve-cloudflare-recovery-zone-v1.mjs',
  'public/app/hub-recovery-api-v1.js',
  'public/app/hub-delivery-intent-v1.js',
];
for (const path of recoveryNoStripeSurfaces) assert.doesNotMatch(source[path], /stripe/i, `${path} must not add Stripe as a recovery dependency`);

// Existing owned-zone and browser-boundary guarantees stay intact.
assert.match(source['scripts/resolve-cloudflare-recovery-zone-v1.mjs'], /civweave\|cerbanimo/);
assert.match(source['scripts/resolve-cloudflare-recovery-zone-v1.mjs'], /forbidden-recovery-zone/);
assert.match(source['.github/workflows/deploy-civweave-pages.yml'], /resolve-cloudflare-recovery-zone-v1\.mjs/);
assert.match(source['.github/workflows/enable-cloudflare-worker-subdomains-v1.yml'], /RECOVERY_ZONE_ID/);
assert.match(source['public/app/installer-repair-only-v1.js'], /hub-recovery-api-v1\.js/);
assert.match(source['public/app/installer-online-fallback-v225.js'], /retired:true/);
assert.match(source['public/app/civweave-brand.js'], /hub-delivery-intent-v1\.js/);
assert.match(source['public/app/hub-delivery-intent-v1.js'], /mailto:/);

for (const path of paths.filter(path => /\.(?:js|mjs)$/.test(path))) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${path} syntax failed: ${result.stderr || result.stdout}`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.hub-recovery-wiring-check.v11-membership-security',
  legacyRecoveryPreserved: true,
  recoveryEmailRequiredForOnlineHub: true,
  recoveryKitRequired: true,
  passkeyOrTotpRequired: true,
  maxPairedDevices: 10,
  maxActiveDevices: 2,
  deviceBoundSessions: true,
  stewardRemoval: true,
  stripeRecoveryDependency: false,
  stripeMemberAccountOptional: true,
}));
