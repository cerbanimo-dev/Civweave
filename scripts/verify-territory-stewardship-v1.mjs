import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [engine,migration,money,entry,annual,resolution,cami,taki,anthony,saphirah,finance] = await Promise.all([
  read('cloudflare/core/src/territory-stewardship-v1.mjs'),
  read('cloudflare/core/migrations/0009_territory_stewardship.sql'),
  read('cloudflare/core/src/money-edge-with-memberships.mjs'),
  read('cloudflare/core/src/stripe-connect-v2-entry.mjs'),
  read('public/app/cerbanimo-commerce-distribution-v1.js'),
  read('docs/legal/stewardship/2026-08-14-territory-stewardship-resolution.md'),
  read('docs/legal/stewardship/agreement-cami-ryn-stormcaller-us.md'),
  read('docs/legal/stewardship/agreement-taki-japan.md'),
  read('docs/legal/stewardship/agreement-anthony-stematz-breitling-kansas-city-mo.md'),
  read('docs/legal/stewardship/agreement-saphirah-pociluyko-los-angeles-ca.md'),
  read('docs/finance/territory-stewardship-economy-v1.md')
]);

assert.match(engine,/cerbanimoGlobalShareBpsOfExistingCerbanimoShare:\s*5000/);
assert.match(engine,/territoryStewardshipShareBpsOfExistingCerbanimoShare:\s*5000/);
assert.match(engine,/hostNodeStewardShareInvariant:\s*true/);
assert.match(engine,/vacancyDestination:\s*'territory-operations-reserve'/);
assert.match(engine,/most-specific-appointed-territory-then-parent/);
assert.match(engine,/reserved-pending-onboarding/);
assert.match(engine,/retryPendingTerritoryShares/);
assert.match(engine,/reverseTerritoryShare/);

for (const name of ['Cami Ryn Stormcaller','Taki','Anthony Stematz-Breitling','Saphirah Pociluyko']) assert.ok(migration.includes(name), `Missing initial appointment: ${name}`);
for (const territory of ["'us'","'jp'","'us-mo-kc'","'us-ca-la'"]) assert.ok(migration.includes(territory), `Missing territory seed: ${territory}`);
assert.match(migration,/held-pending-onboarding/);
assert.match(migration,/pending-signature/);
assert.match(migration,/UNIQUE\(source_kind,source_id\)/);

assert.match(money,/sourceBoundary:\s*'existing-cerbanimo-share-only'/);
assert.match(money,/hostNodeStewardCutChanged:\s*false/);
assert.match(money,/settleTerritoryForTopup/);
assert.match(money,/settleTerritoryForMembership/);
assert.match(money,/settleTerritoryForFellowFareFee/);
assert.match(money,/reverseTerritoryForTopup/);
assert.match(money,/reverseTerritoryForFellowFareFee/);
assert.match(money,/retryPendingTerritoryShares/);

assert.match(entry,/GET' && url\.pathname === '\/api\/money-edge\/territories'/);
assert.match(entry,/POST' && url\.pathname === '\/api\/money-edge\/territories\/node'/);
assert.match(entry,/x-civweave-node-signature/);

assert.match(annual,/CERBANIMO_GLOBAL_SHARE_BPS_OF_CERBANIMO=5000/);
assert.match(annual,/TERRITORY_SHARE_BPS_OF_CERBANIMO=5000/);
assert.match(annual,/annual-territory-steward/);
assert.match(annual,/annual-territory-reserve/);
assert.match(annual,/hostShareChanged:false/);
assert.match(annual,/holdForPayout/);

for (const document of [resolution,cami,taki,anthony,saphirah]) {
  assert.match(document,/not equity/i);
  assert.match(document,/Host Node Steward/i);
  assert.match(document,/50%/);
}
assert.match(resolution,/most specific/i);
assert.match(resolution,/Territory Operations Reserve/i);
assert.match(finance,/70%.*25%.*2\.5%.*2\.5%/s);
assert.match(finance,/50%.*25%.*12\.5%.*12\.5%/s);
assert.match(finance,/95%.*2\.5%.*1\.25%.*1\.25%/s);

console.log(JSON.stringify({
  ok:true,
  schema:'civweave.territory-stewardship.v1',
  checks:[
    'existing-cerbanimo-share-only',
    'host-node-steward-cut-preserved',
    'cerbanimo-global-half',
    'territory-stewardship-half',
    'most-specific-territory-precedence',
    'vacancy-reserve',
    'agreement-and-payout-gates',
    'topup-routing',
    'membership-routing',
    'fellowfare-service-fee-routing',
    'refund-and-dispute-reversal',
    'annual-reserve-routing',
    'four-initial-appointments',
    'four-stewardship-agreements'
  ]
},null,2));
