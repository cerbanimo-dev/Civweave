import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const provider = await readFile(new URL('../cloudflare/core/src/stripe-connect.mjs', import.meta.url), 'utf8');
const money = await readFile(new URL('../cloudflare/core/src/money-edge.mjs', import.meta.url), 'utf8');
const commerce = await readFile(new URL('../public/app/cerbanimo-commerce-distribution-v1.js', import.meta.url), 'utf8');
const preflight = await readFile(new URL('./verify-stripe-live-readiness-preflight.mjs', import.meta.url), 'utf8');
const humanGate = await readFile(new URL('../docs/finance/live-money-human-gate.md', import.meta.url), 'utf8');
const launch = await readFile(new URL('../docs/finance/node-money-edge-launch-v1.md', import.meta.url), 'utf8');

assert.match(provider, /STRIPE_CONNECT_ACCOUNT_MODEL = 'accounts-v2-marketplace-recipient'/);
assert.match(provider, /v2\.core\.accounts\.create/);
assert.match(provider, /dashboard: 'express'/);
assert.match(provider, /fees_collector: 'application'/);
assert.match(provider, /losses_collector: 'application'/);
assert.match(provider, /recipient:\s*\{/);
assert.match(provider, /stripe_transfers: \{ requested: true \}/);
assert.match(provider, /v2\.core\.accountLinks\.create/);
assert.match(provider, /configurations: \['recipient'\]/);
assert.match(provider, /platform-charge-separate-transfer/);
assert.match(provider, /source_transaction/);
assert.match(provider, /Compatibility only for sandbox\/legacy node registrations/);

assert.match(money, /TOPUP_ECONOMY = Object\.freeze\(\{ systemBps: 7000, hostBps: 2500, cerbanimoBps: 500 \}\)/);
assert.match(money, /fundsModel: 'platform-reserve-separate-transfer'/);
assert.match(money, /CIVWEAVE_MONEY_LIVE_ENABLED/);
assert.match(money, /CIVWEAVE_MONEY_COMPLIANCE_APPROVED/);
assert.match(money, /CIVWEAVE_MONEY_JURISDICTION_APPROVED/);
assert.match(money, /CIVWEAVE_MONEY_KYC_AML_READY/);
assert.match(money, /CIVWEAVE_MONEY_TAX_REPORTING_READY/);
assert.match(money, /CIVWEAVE_MONEY_TERMS_APPROVED/);

assert.match(commerce, /DEFAULT_COMMERCE_SPLIT_FEE_BPS=100/);
assert.match(commerce, /buyerChargeMinor=amountMinor\+splitFeeMinor/);
assert.match(commerce, /reducesContributorPayout:false/);
assert.match(commerce, /routesToAnnualPool:false/);
assert.match(commerce, /weightSource:'vested-cerbanimo-co-credits'/);

assert.match(preflight, /accounts-v2-marketplace-recipient/);
assert.match(preflight, /EXPECTED_COMMERCE_SPLIT_FEE_BPS = 100/);
assert.match(preflight, /mutationPerformed: false/);
assert.doesNotMatch(preflight, /\.create\(/, 'live preflight must remain read-only');
assert.doesNotMatch(preflight, /\.update\(/, 'live preflight must remain read-only');
assert.doesNotMatch(preflight, /\.del\(/, 'live preflight must remain read-only');

for (const gate of [
  'CIVWEAVE_MONEY_LIVE_ENABLED',
  'CIVWEAVE_MONEY_COMPLIANCE_APPROVED',
  'CIVWEAVE_MONEY_JURISDICTION_APPROVED',
  'CIVWEAVE_MONEY_KYC_AML_READY',
  'CIVWEAVE_MONEY_TAX_REPORTING_READY',
  'CIVWEAVE_MONEY_TERMS_APPROVED'
]) {
  assert.match(humanGate, new RegExp(`${gate}=false`), `${gate} must remain explicitly false before human launch approval`);
}
assert.match(humanGate, /stripe_transfers\.status = active/);
assert.match(humanGate, /listed commerce amount plus the 1% Cerbanimo split fee/);
assert.match(launch, /marketplace/);
assert.match(launch, /separate charges and transfers/);
assert.match(launch, /1% Cerbanimo split fee is added on top/);
assert.doesNotMatch(launch, /15% application fee/);
assert.doesNotMatch(humanGate, /15% application fee/);

console.log(JSON.stringify({
  ok: true,
  checks: [
    'accounts-v2-marketplace-recipient',
    'express-dashboard',
    'platform-pricing-and-loss-liability',
    'recipient-transfer-capability',
    'separate-charges-and-transfers',
    'commerce-one-percent-fee-on-top',
    'human-gates-fail-closed',
    'live-preflight-read-only',
    'stale-direct-charge-fee-language-removed'
  ]
}, null, 2));
