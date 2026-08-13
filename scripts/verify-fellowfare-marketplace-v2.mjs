import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [cabinet,marketplace,styles,contrast,preflight,capabilities,bridge,parent,parentJs,legacyShim,liveData]=await Promise.all([
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/marketplace-v2.js'),
  read('public/app/services/fellowfare/marketplace-v2.css'),
  read('public/app/services/fellowfare/marketplace-v2-contrast.css'),
  read('public/app/services/fellowfare/live-data-preflight-v3.js'),
  read('public/app/services/fellowfare/marketplace-v2-capabilities.js'),
  read('public/app/services/fellowfare/cabinet-bridge.js'),
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/fellowfare-cabinet-v144.js'),
  read('public/app/services/fellowfare/app.js'),
  read('public/app/civweave-live-data.js')
]);

for(const [name,source] of [
  ['marketplace-v2.js',marketplace],['live-data-preflight-v3.js',preflight],['marketplace-v2-capabilities.js',capabilities],
  ['cabinet-bridge.js',bridge],['fellowfare-cabinet-v144.js',parentJs],['civweave-live-data.js',liveData]
]) assert.doesNotThrow(()=>new Function(source),`${name} contains a JavaScript syntax error.`);

assert.ok(cabinet.includes('marketplace-v2.js'),'FellowFare cabinet does not load marketplace v2.');
assert.ok(cabinet.includes('marketplace-v2.css'),'FellowFare cabinet does not load marketplace v2 styles.');
assert.ok(cabinet.includes('marketplace-v2-contrast.css'),'FellowFare contrast override is not loaded.');
assert.ok(cabinet.includes('live-data-preflight-v3.js'),'FellowFare demo-data preflight is not loaded.');
assert.ok(cabinet.includes('marketplace-v2-capabilities.js'),'FellowFare capability layer is not loaded.');
assert.ok(cabinet.indexOf('live-data-preflight-v3.js')<cabinet.indexOf('marketplace-v2.js'),'Demo-data scrub must run before marketplace boot.');
assert.ok(!cabinet.includes('src="app.js"'),'Legacy FellowFare runtime is still the active cabinet entry.');
assert.ok(cabinet.includes('/app/cw-reward-ledger-v2.js'),'Canonical Acorn/Button ledger is not loaded.');
assert.ok(cabinet.includes('/app/cerbanimo-commerce-distribution-v1.js'),'Cerbanimo commerce distribution contract is not loaded.');
assert.ok(cabinet.includes('/app/civweave-live-data.js'),'Cross-realm live data bridge is not loaded.');

assert.match(legacyShim,/import '\.\/live-data-preflight-v3\.js'/,'Old cached cabinet HTML does not scrub retired demo state.');
assert.match(legacyShim,/import '\.\/marketplace-v2\.js'/,'Old cached cabinet HTML cannot recover into marketplace v2.');
assert.match(legacyShim,/import '\.\/marketplace-v2-capabilities\.js'/,'Old cached cabinet HTML does not gain live page capabilities.');
assert.doesNotMatch(legacyShim,/starterState|Friday bread circle|North Country maker room/,'Legacy app.js still contains the retired demo marketplace.');
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

for(const title of ['Pickup truck and hauling help','Reclaimed windows for greenhouse build','Weekly local bread buying circle','Flyer and one-page web design'])assert.ok(preflight.includes(title),`Preflight does not recognize retired seed title: ${title}`);
assert.match(preflight,/market\.listings=filterRows/,'Preflight does not remove retired records from marketplace v2 state.');
assert.match(preflight,/legacy\.threads=filterRows/,'Preflight does not remove retired records from legacy exchange state.');
assert.match(preflight,/scrubQueue\(DRAFT_KEY\)/,'Preflight does not clear retired draft-queue records.');

assert.match(capabilities,/data-ff-cap-share/,'Market cards do not expose a real share capability.');
assert.match(capabilities,/data-ff-need-shortcut/,'Market/Sell pages do not expose a need-listing shortcut.');
assert.match(capabilities,/data-ff-order-action/,'Orders do not expose real local lifecycle actions.');
assert.match(capabilities,/fulfilled/,'Orders cannot be marked fulfilled.');
assert.match(capabilities,/Download ledger snapshot/,'Wallet does not expose canonical ledger export.');
assert.match(capabilities,/Share profile summary/,'Profile does not expose portable profile sharing.');
assert.match(capabilities,/civweave\.reward-ledger\.v2/,'Capability layer does not export canonical reward data.');
assert.match(capabilities,/civweave\.cerbanimo-commerce-receipts\.v1/,'Capability layer does not export commerce receipts.');

assert.match(contrast,/--ff-amber:#e5a231/,'FellowFare saffron identity is not present.');
assert.match(contrast,/--ff-copper:#a95e2d/,'FellowFare copper identity is not present.');
assert.match(contrast,/--ff-green:#1f5a70/,'Primary FellowFare action color still leans green instead of ink-blue.');
assert.match(contrast,/thread-card\[data-mode="offer"\]::before\{background:#d89a31/,'Legacy offer cards are not recolored away from Living School green.');

for(const label of ['Products','Services','Learning','Tutoring','real records only'])assert.ok(parent.toLowerCase().includes(label.toLowerCase()),`Parent FellowFare shell is missing ${label}.`);
for(const label of ['Market','Sell','Orders','Wallet','You'])assert.ok(cabinet.includes(`>${label}<`)||cabinet.includes(`>${label}<span`),`Bottom navigation is missing ${label}.`);
assert.match(parent,/ffv2=live-capabilities-r1/,'Parent shell is not cache-busting the live capability cabinet.');
assert.match(parentJs,/MARKET_KEY='fellowfare\.marketplace\.v2'/,'Rook still reads only the retired exchange state.');
assert.match(parentJs,/not going to manufacture a market rate/i,'Rook deterministic fallback can still invent prices without comparables.');
assert.match(styles,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,'Desktop marketplace grid is missing.');
assert.match(styles,/@media\(max-width:640px\)/,'Mobile marketplace layout is missing.');
assert.match(bridge,/civweave:exchange-import/,'Reviewed parent exchange imports are no longer bridged.');
assert.match(liveData,/fellowfare\.marketplace\.v2/,'Civweave live data does not ingest FellowFare v2.');

console.log(JSON.stringify({
  ok:true,
  revision:'fellowfare-marketplace-v2-live-capabilities',
  freshState:'empty',
  retiredDemoRuntime:'scrubbed-before-render',
  canonicalRewards:true,
  canonicalCommerce:true,
  explicitCrossRealmMarketDrafts:true,
  rookUsesV2Market:true,
  responsive:true,
  saffronCopperInkBlueIdentity:true,
  marketShare:true,
  orderLifecycle:true,
  walletExport:true,
  profileShare:true
},null,2));
