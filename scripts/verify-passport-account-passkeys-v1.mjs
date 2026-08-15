import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// The lifecycle verifier now owns the behavioral tests for usernames, recovery,
// TOTP/passkeys, device limits, stable seat identity, offline LAN admission, and
// Steward removal. Keep this historical gate as a compatibility sentinel for the
// browser-facing security contract that originally lived here.
await import('./verify-hub-account-lifecycle-v2.mjs');

const root=path.resolve(import.meta.dirname,'..');
const client=fs.readFileSync(path.join(root,'public/app/hub-passport-account-v1.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/app/hub-recovery-ui-v1.js'),'utf8');
const serverV1=fs.readFileSync(path.join(root,'cloudflare/account-edge/src/hub-passport-account-v1.mjs'),'utf8');
const serverV2=fs.readFileSync(path.join(root,'cloudflare/account-edge/src/hub-passport-account-v2.mjs'),'utf8');
const cloudConfig=fs.readFileSync(path.join(root,'cloudflare/node-cloud/wrangler.jsonc'),'utf8');

assert.match(client,/navigator\.credentials\.create/);
assert.match(client,/navigator\.credentials\.get/);
assert.match(client,/beginTotp/);
assert.match(client,/connectStripe/);
assert.match(serverV1,/verifiedAttestationSpki/);
assert.match(serverV2,/maxPairedDevices:\s*10/);
assert.match(serverV2,/maxActiveDevices:\s*2/);
assert.match(serverV2,/onlineMembershipReady/);
assert.match(serverV2,/offlineMembershipReady/);
assert.doesNotMatch(ui,/outside recovery email is optional/i);
assert.match(ui,/Online Hub membership requires a verified recovery email/i);
assert.match(ui,/Two-factor authentication/i);
assert.match(ui,/Annual Member Rebate/i);
assert.match(cloudConfig,/server-ai-entry-v8\.mjs/);

console.log(JSON.stringify({ok:true,schema:'civweave.passport-account-passkeys.verify.v2',usernameRequired:true,recoveryRequiredForHub:true,twoFactorRequiredForHub:true,offlineTotpFallback:true,maxPairedDevices:10,maxActiveDevices:2,stripeOptional:true},null,2));
