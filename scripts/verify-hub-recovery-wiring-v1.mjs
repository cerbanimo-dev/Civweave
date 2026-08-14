import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const paths = [
  'cloudflare/account-edge/src/hub-account-recovery-v1.mjs',
  'cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs',
  'cloudflare/account-edge/src/recovery-entry-v4.mjs',
  'cloudflare/account-edge/src/recovery-entry-v6.mjs',
  'cloudflare/account-edge/wrangler.jsonc',
  'public/app/installer-online-fallback-v225.js',
  'public/app/civweave-brand.js',
  'public/app/hub-recovery-api-v1.js',
  'public/app/hub-recovery-ui-v1.js',
  'public/app/hub-delivery-intent-v1.js',
  'public/app/host-node-session-import-v1.js',
  'public/app/host-node-session-export-v1.js',
];
const source = Object.fromEntries(await Promise.all(paths.map(async path => [path, await readFile(path, 'utf8')])));

assert.match(source['cloudflare/account-edge/wrangler.jsonc'], /src\/recovery-entry-v6\.mjs/);
assert.match(source['cloudflare/account-edge/wrangler.jsonc'], /recover@recovery\.commonweave\.earth/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v6.mjs'], /async email\(message,env/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v6.mjs'], /message\.reply\(new EmailMessage/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v6.mjs'], /stub\.fetch/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v6.mjs'], /\/internal\/email-proof/);
assert.match(source['cloudflare/account-edge/src/recovery-entry-v6.mjs'], /not-found/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /inbound-email-proof/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /completeInboundVerification/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /completeInboundRecovery/);
assert.match(source['cloudflare/account-edge/src/hub-account-recovery-inbound-v1.mjs'], /paste this one-time code/);
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

console.log(JSON.stringify({ ok: true, schema: 'civweave.hub-recovery-wiring-check.v3', freeTierInboundProof: true, privateObjectBridge: true }));
