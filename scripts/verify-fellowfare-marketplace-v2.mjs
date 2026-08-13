import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [cabinet,marketplace,styles,bridge,parent,liveData]=await Promise.all([
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/marketplace-v2.js'),
  read('public/app/services/fellowfare/marketplace-v2.css'),
  read('public/app/services/fellowfare/cabinet-bridge.js'),
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/civweave-live-data.js')
]);

for(const [name,source] of [['marketplace-v2.js',marketplace],['cabinet-bridge.js',bridge],['civweave-live-data.js',liveData]]){
  assert.doesNotThrow(()=>new Function(source),`${name} contains a JavaScript syntax error.`);
}

assert.ok(cabinet.includes('marketplace-v2.js'),'FellowFare cabinet does not load marketplace v2.');
assert.ok(cabinet.includes('marketplace-v2.css'),'FellowFare cabinet does not load marketplace v2 styles.');
assert.ok(!cabinet.includes('src="app.js"'),'Legacy demo-seeded FellowFare runtime is still active.');
assert.ok(cabinet.includes('/app/cw-reward-ledger-v2.js'),'Canonical Acorn/Button ledger is not loaded.');
assert.ok(cabinet.includes('/app/cerbanimo-commerce-distribution-v1.js'),'Cerbanimo commerce distribution contract is not loaded.');
assert.ok(cabinet.includes('/app/civweave-live-data.js'),'Cross-realm live data bridge is not loaded.');

assert.match(marketplace,/listings:\[\],orders:\[\]/,'Fresh FellowFare v2 state must start empty.');
assert.match(marketplace,/No listings loaded/,'Truthful empty market state is missing.');
assert.match(marketplace,/will not invent a market price/i,'Rook no-comparables refusal is missing.');
assert.match(marketplace,/civweave\.reward-ledger\.v2/,'Marketplace does not read canonical rewards.');
assert.match(marketplace,/civweave\.cerbanimo-commerce-receipts\.v1/,'Marketplace does not read commerce receipts.');
assert.match(marketplace,/readyForSale\|\|row\?\.readyForMarket/,'Cross-realm records are not gated on explicit market readiness.');
assert.match(marketplace,/serviceOriginRoyaltyBps:kind==='service'\?1000:0/,'Service listing policy does not carry the current origin royalty.');
assert.match(marketplace,/splitFeeBps:100/,'Product/service listing policy does not carry the 1% split fee.');
assert.match(marketplace,/MONEY_EDGE='https:\/\/civweave-core\.cerbanimo\.workers\.dev'/,'USD status is not tied to the canonical money authority.');
assert.ok(!/open needs[^\n]{0,80}\b2\b/i.test(marketplace),'Hard-coded market-count demo data returned.');
assert.ok(!/available offers[^\n]{0,80}\b3\b/i.test(marketplace),'Hard-coded offer-count demo data returned.');

for(const label of ['Products','Services','Learning','Tutoring','real records only'])assert.ok(parent.toLowerCase().includes(label.toLowerCase()),`Parent FellowFare shell is missing ${label}.`);
for(const label of ['Market','Sell','Orders','Wallet','You'])assert.ok(cabinet.includes(`>${label}<`)||cabinet.includes(`>${label}<span`),`Bottom navigation is missing ${label}.`);
assert.match(styles,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,'Desktop marketplace grid is missing.');
assert.match(styles,/@media\(max-width:640px\)/,'Mobile marketplace layout is missing.');
assert.match(bridge,/civweave:exchange-import/,'Reviewed parent exchange imports are no longer bridged.');
assert.match(liveData,/fellowfare\.marketplace\.v2/,'Civweave live data does not ingest FellowFare v2.');

console.log(JSON.stringify({
  ok:true,
  revision:'fellowfare-marketplace-v2-live-data',
  freshState:'empty',
  legacyDemoRuntimeActive:false,
  canonicalRewards:true,
  canonicalCommerce:true,
  explicitCrossRealmMarketDrafts:true,
  responsive:true
},null,2));
