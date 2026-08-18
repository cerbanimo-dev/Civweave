import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [cabinet,marketplace,preflight,capabilities,questPath,fulfillment,symbols,bridge,parent,parentJs,legacyShim,liveData,browserCommerce,directCommerce]=await Promise.all([
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/marketplace-v2.js'),
  read('public/app/services/fellowfare/live-data-preflight-v3.js'),
  read('public/app/services/fellowfare/marketplace-v2-capabilities.js'),
  read('public/app/services/fellowfare/civweave-quest-path-v266.js'),
  read('public/app/services/fellowfare/fulfillment-economy-v2.js'),
  read('public/app/services/fellowfare/marketplace-v2-symbols.js'),
  read('public/app/services/fellowfare/cabinet-bridge.js'),
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/fellowfare-cabinet-v144.js'),
  read('public/app/services/fellowfare/app.js'),
  read('public/app/civweave-live-data.js'),
  read('public/app/cerbanimo-commerce-distribution-v1.js'),
  read('cloudflare/core/src/fellowfare-direct-commerce-v1.mjs')
]);

for(const [name,source] of [
  ['marketplace-v2.js',marketplace],['live-data-preflight-v3.js',preflight],['marketplace-v2-capabilities.js',capabilities],['civweave-quest-path-v266.js',questPath],
  ['fulfillment-economy-v2.js',fulfillment],['marketplace-v2-symbols.js',symbols],['cabinet-bridge.js',bridge],
  ['fellowfare-cabinet-v144.js',parentJs],['civweave-live-data.js',liveData],['cerbanimo-commerce-distribution-v1.js',browserCommerce]
]) assert.doesNotThrow(()=>new Function(source),`${name} contains a JavaScript syntax error.`);

assert.ok(cabinet.includes('marketplace-v2.js'),'FellowFare cabinet does not load marketplace v2.');
assert.ok(cabinet.includes('live-data-preflight-v3.js'),'FellowFare demo-data preflight is not loaded.');
assert.ok(cabinet.includes('marketplace-v2-capabilities.js'),'FellowFare capability layer is not loaded.');
assert.ok(cabinet.includes('fulfillment-economy-v2.js'),'FellowFare fulfillment/direct-commerce economy is not loaded.');
assert.ok(cabinet.includes('fulfillment-economy-v1.js'),'Retained fulfillment v1 compatibility file is not carried.');
assert.ok(cabinet.indexOf('fulfillment-economy-v2.js')<cabinet.indexOf('fulfillment-economy-v1.js'),'Fulfillment v2 must boot before the v1 compatibility layer.');
assert.ok(cabinet.includes('/app/cw-reward-ledger-v2.js'),'Canonical Acorn/Button ledger is not loaded.');
assert.ok(cabinet.includes('/app/cerbanimo-commerce-distribution-v1.js'),'Fail-closed legacy commerce compatibility stub is not carried.');
assert.ok(cabinet.indexOf('marketplace-v2.js')<cabinet.indexOf('fulfillment-economy-v2.js'),'Economy policy must load after the base marketplace.');
assert.ok(!cabinet.includes('src="app.js"'),'Legacy FellowFare runtime is still the active cabinet entry.');
assert.ok(parent.includes('/app/services/fellowfare/civweave-quest-path-v266.js'),'FellowFare parent shell does not load the generated Quest work surface.');
for(const token of ['civweave.fellowfare.quest-work.v1','Prepare need listing','Check marketplace','openComposer','sourceId','evidence-recorded','plan.state===\'review\''])assert.ok(questPath.includes(token),`FellowFare generated Quest work surface is missing ${token}.`);

assert.match(legacyShim,/import '\.\/live-data-preflight-v3\.js'/);
assert.match(legacyShim,/import '\.\/marketplace-v2\.js'/);
assert.match(legacyShim,/import '\.\/marketplace-v2-capabilities\.js'/);
assert.match(legacyShim,/import '\.\/fulfillment-economy-v2\.js'/);
assert.match(legacyShim,/import '\.\/fulfillment-economy-v1\.js'/);
assert.doesNotMatch(legacyShim,/cerbanimo-commerce-distribution-v1/,'Legacy app shim should not reactivate old marketplace distribution.');

assert.match(marketplace,/listings:\[\],orders:\[\]/,'Fresh FellowFare v2 state must start empty.');
assert.match(marketplace,/will not invent a market price/i,'Rook no-comparables refusal is missing.');
assert.match(marketplace,/civweave\.reward-ledger\.v2/,'Marketplace does not read canonical rewards.');

// Goods remain hard seller-direct. Services/learning/tutoring may combine token
// fulfillment and provider-owned Stripe direct charges.
assert.match(fulfillment,/GOODS_KINDS=new Set\(\['product','resource'\]\)/);
assert.match(fulfillment,/TOKEN_KINDS=new Set\(\['service','learning','tutoring'\]\)/);
assert.match(fulfillment,/mode:'seller-direct'/);
assert.match(fulfillment,/platformCollectsPayment:false/);
assert.match(fulfillment,/platformRoutesPayment:false/);
assert.match(fulfillment,/listing\.pricing=\{\.\.\.pricing,usdMinor:0,buttons:0,acorns:0\}/,'Goods sanitizer does not remove platform/token price fields.');
assert.match(fulfillment,/tokenMode:'fulfillment-burn'/);
assert.match(fulfillment,/cashMode:cash\?'stripe-connect-direct-charge':'none'/);
assert.match(fulfillment,/merchantOfRecord:cash\?'connected-provider':null/);
assert.match(fulfillment,/platformCollectsGross:false/);
assert.match(fulfillment,/platformRoutesSellerProceeds:false/);
assert.match(fulfillment,/operation:'fulfillment-burn'/);
assert.match(fulfillment,/nonTransferable:true/);
assert.match(fulfillment,/recipientCredited:false/);
assert.match(fulfillment,/REWARD_PER_QUEST=5/);
assert.match(fulfillment,/MILESTONE_SIZE=100/);
assert.match(fulfillment,/MILESTONE_BONUS=10/);
for(const quest of ['finish-learning-module','fulfill-20-acorns','fulfill-20-buttons','post-need','post-offering'])assert.ok(fulfillment.includes(quest),`Daily quest pool is missing ${quest}.`);
assert.match(fulfillment,/buckets=\['progress','fulfillment','community'\]/,'Daily generator does not guarantee three distinct quest buckets.');
assert.match(fulfillment,/completeOrderWithFulfillment/,'Service/learning arrangements are not connected to fulfillment.');
assert.match(fulfillment,/learning_complete/,'Learning completions do not feed the reward system.');
assert.match(fulfillment,/cerbanimo_quest_complete/,'Cerbanimo quest completions do not feed the reward system.');
assert.match(fulfillment,/beginMerchantOnboarding/);
assert.match(fulfillment,/syncOwnCashListings/);
assert.match(fulfillment,/beginDirectCheckout/);
assert.match(fulfillment,/Offer USD, Acorn\/Button fulfillment, or both/);

assert.match(directCommerce,/dashboard: 'full'/);
assert.match(directCommerce,/fees_collector: 'stripe'/);
assert.match(directCommerce,/losses_collector: 'stripe'/);
assert.match(directCommerce,/application_fee_amount/);
assert.match(directCommerce,/merchantOfRecord: 'connected-account'/);
assert.doesNotMatch(directCommerce,/\/v1\/transfers|transfer_data|destination:/);
assert.match(directCommerce,/Direct FellowFare checkout is only available for services, learning, and tutoring/);

assert.match(browserCommerce,/commerceEnabled:false/,'Browser legacy commerce compatibility layer is not fail-closed.');
assert.match(browserCommerce,/marketplacePaymentMode:'disabled'/);
assert.match(browserCommerce,/buildDistribution:disabled/);
assert.match(browserCommerce,/stripeTransferInstructions:disabled/);
assert.match(browserCommerce,/recordSale:async\(\)=>disabled\(\)/);
assert.match(browserCommerce,/buildAnnualDistribution/,'Annual reserve payout rail was removed with legacy marketplace checkout.');

for(const title of ['Pickup truck and hauling help','Reclaimed windows for greenhouse build','Weekly local bread buying circle','Flyer and one-page web design'])assert.ok(preflight.includes(title),`Preflight does not recognize retired seed title: ${title}`);
assert.match(preflight,/market\.listings=filterRows/);
assert.match(preflight,/legacy\.threads=filterRows/);
assert.match(preflight,/scrubQueue\(DRAFT_KEY\)/);

for(const token of ['data-ff-cap-share','data-ff-need-shortcut','data-ff-order-action','Download ledger snapshot','Share profile summary'])assert.ok(capabilities.includes(token),`Live FellowFare capability layer is missing ${token}`);
assert.match(symbols,/does not collect or route a goods payment/,'Shared goods listings do not state the seller-direct payment boundary.');
assert.match(symbols,/provider Stripe direct checkout/,'Shared cash service listings do not state the direct-charge boundary.');
assert.match(symbols,/FellowFare receives only its application fee/,'Shared cash service listings do not state the platform-fee boundary.');
assert.match(symbols,/Acorns\/Buttons are fulfilled and burned/,'Shared token listings do not state fulfillment semantics.');

for(const label of ['Products','Services','Learning','Tutoring','real records only'])assert.ok(parent.toLowerCase().includes(label.toLowerCase()),`Parent FellowFare shell is missing ${label}.`);
for(const label of ['Market','Sell','Orders','Wallet','You'])assert.ok(cabinet.includes(`>${label}<`)||cabinet.includes(`>${label}<span`),`Bottom navigation is missing ${label}.`);
assert.match(parentJs,/MARKET_KEY='fellowfare\.marketplace\.v2'/,'Rook still reads only the retired exchange state.');
assert.match(parentJs,/not going to manufacture a market rate/i,'Rook deterministic fallback can still invent prices without comparables.');
assert.match(bridge,/civweave:exchange-import/,'Reviewed parent exchange imports no longer reach marketplace v2.');
assert.match(liveData,/fellowfare\.marketplace\.v2/,'Civweave live data does not ingest FellowFare v2.');

console.log(JSON.stringify({
  ok:true,
  revision:'fellowfare-marketplace-v2-fulfillment-direct-commerce-v2-quest-path-v266',
  generatedQuestPath:'review-before-publish-with-evidence-checkpoints',
  goodsPayment:'seller-direct',
  serviceLearningTokens:'fulfillment-burn',
  serviceLearningUsd:'stripe-connect-direct-charge',
  merchantOfRecord:'connected-provider',
  platformFee:'application-fee',
  platformCollectsGross:false,
  platformRoutesSellerProceeds:false,
  dailyQuestCount:3,
  dailyQuestReward:5,
  milestoneEvery:100,
  milestoneBonus:10,
  annualReserveDistribution:'preserved'
},null,2));