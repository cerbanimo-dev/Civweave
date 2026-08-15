import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const syntax=relative=>{
  const result=spawnSync(process.execPath,['--check',path.join(root,relative)],{encoding:'utf8'});
  assert.equal(result.status,0,`${relative} syntax error:\n${result.stderr||result.stdout}`);
};

const [cabinet,marketplace,preflight,capabilities,fulfillment,symbols,bridge,parent,native,liveData,browserCommerce,directCommerce]=await Promise.all([
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/marketplace-v2.js'),
  read('public/app/services/fellowfare/live-data-preflight-v3.js'),
  read('public/app/services/fellowfare/marketplace-v2-capabilities.js'),
  read('public/app/services/fellowfare/fulfillment-economy-v2.js'),
  read('public/app/services/fellowfare/marketplace-v2-symbols.js'),
  read('public/app/services/fellowfare/cabinet-bridge.js'),
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/fellowfare-native.js'),
  read('public/app/civweave-live-data.js'),
  read('public/app/cerbanimo-commerce-distribution-v1.js'),
  read('cloudflare/core/src/fellowfare-direct-commerce-v1.mjs')
]);

for(const file of [
  'public/app/services/fellowfare/marketplace-v2.js',
  'public/app/services/fellowfare/live-data-preflight-v3.js',
  'public/app/services/fellowfare/marketplace-v2-capabilities.js',
  'public/app/services/fellowfare/fulfillment-economy-v2.js',
  'public/app/services/fellowfare/marketplace-v2-symbols.js',
  'public/app/services/fellowfare/cabinet-bridge.js',
  'public/app/fellowfare-native.js',
  'public/app/civweave-live-data.js',
  'public/app/cerbanimo-commerce-distribution-v1.js'
]) syntax(file);

assert.match(cabinet,/marketplace-v2\.js/);
assert.match(cabinet,/live-data-preflight-v3\.js/);
assert.match(cabinet,/marketplace-v2-capabilities\.js/);
assert.match(cabinet,/fulfillment-economy-v2\.js/);
assert.doesNotMatch(cabinet,/fulfillment-economy-v1\.js|src="app\.js"/);
assert.match(cabinet,/\/app\/cw-reward-ledger-v2\.js/);
assert.match(cabinet,/\/app\/cerbanimo-commerce-distribution-v1\.js/);
assert.ok(cabinet.indexOf('marketplace-v2.js')<cabinet.indexOf('fulfillment-economy-v2.js'),'economy policy must load after base marketplace');

assert.doesNotMatch(parent,/<iframe\b/i);
assert.match(parent,/\/app\/fellowfare-native\.js/);
assert.doesNotMatch(parent,/fellowfare-native-host-v207|fellowfare-native-scroll-v208|fellowfare-cabinet-v144\.js|fulfillment-economy-v1|services\/fellowfare\/app\.js/);
assert.match(native,/CivweaveFellowFareMarketplaceV2/);
assert.match(native,/routeTo\(route\)/);
for(const forbidden of ['contentWindow','contentDocument','postMessage','MutationObserver',"createElement('script')",'new Function','eval('])assert.ok(!native.includes(forbidden),`native bridge contains ${forbidden}`);

assert.match(marketplace,/listings:\[\],orders:\[\]/,'fresh FellowFare state must start empty');
assert.match(marketplace,/will not invent a market price/i,'Rook no-comparables refusal missing');
assert.match(marketplace,/civweave\.reward-ledger\.v2/,'marketplace does not read canonical rewards');
assert.match(marketplace,/routeTo/,'direct route API missing');

assert.match(fulfillment,/GOODS_KINDS=new Set\(\['product','resource'\]\)/);
assert.match(fulfillment,/TOKEN_KINDS=new Set\(\['service','learning','tutoring'\]\)/);
assert.match(fulfillment,/mode:'seller-direct'/);
assert.match(fulfillment,/platformCollectsPayment:false/);
assert.match(fulfillment,/platformRoutesPayment:false/);
assert.match(fulfillment,/listing\.pricing=\{\.\.\.pricing,usdMinor:0,buttons:0,acorns:0\}/);
assert.match(fulfillment,/tokenMode:'fulfillment-burn'/);
assert.match(fulfillment,/cashMode:cash\?'stripe-connect-direct-charge':'none'/);
assert.match(fulfillment,/merchantOfRecord:cash\?'connected-provider':null/);
assert.match(fulfillment,/operation:'fulfillment-burn'/);
assert.match(fulfillment,/nonTransferable:true/);
assert.match(fulfillment,/recipientCredited:false/);
assert.match(fulfillment,/REWARD_PER_QUEST=5/);
assert.match(fulfillment,/MILESTONE_SIZE=100/);
assert.match(fulfillment,/MILESTONE_BONUS=10/);
for(const quest of ['finish-learning-module','fulfill-20-acorns','fulfill-20-buttons','post-need','post-offering'])assert.ok(fulfillment.includes(quest),`daily quest pool missing ${quest}`);
assert.match(fulfillment,/completeOrderWithFulfillment/);
assert.match(fulfillment,/learning_complete/);
assert.match(fulfillment,/cerbanimo_quest_complete/);
assert.match(fulfillment,/beginMerchantOnboarding/);
assert.match(fulfillment,/syncOwnCashListings/);
assert.match(fulfillment,/beginDirectCheckout/);

assert.match(directCommerce,/dashboard: 'full'/);
assert.match(directCommerce,/application_fee_amount/);
assert.match(directCommerce,/merchantOfRecord: 'connected-account'/);
assert.doesNotMatch(directCommerce,/\/v1\/transfers|transfer_data|destination:/);
assert.match(directCommerce,/Direct FellowFare checkout is only available for services, learning, and tutoring/);

assert.match(browserCommerce,/commerceEnabled:false/);
assert.match(browserCommerce,/marketplacePaymentMode:'disabled'/);
assert.match(browserCommerce,/buildDistribution:disabled/);
assert.match(browserCommerce,/stripeTransferInstructions:disabled/);
assert.match(browserCommerce,/buildAnnualDistribution/);

for(const title of ['Pickup truck and hauling help','Reclaimed windows for greenhouse build','Weekly local bread buying circle','Flyer and one-page web design'])assert.ok(preflight.includes(title),`preflight does not recognize retired seed title: ${title}`);
assert.match(preflight,/market\.listings=filterRows/);
assert.match(preflight,/legacy\.threads=filterRows/);
for(const token of ['data-ff-cap-share','data-ff-need-shortcut','data-ff-order-action','Download ledger snapshot','Share profile summary'])assert.ok(capabilities.includes(token),`capability layer missing ${token}`);
assert.match(symbols,/does not collect or route a goods payment/);
assert.match(symbols,/provider Stripe direct checkout/);
assert.match(symbols,/FellowFare receives only its application fee/);
assert.match(symbols,/Acorns\/Buttons are fulfilled and burned/);
assert.match(bridge,/civweave:exchange-import/);
assert.match(liveData,/fellowfare\.marketplace\.v2/);

for(const label of ['Market','Sell','Orders','Wallet','You'])assert.ok(parent.includes(`>${label}<`)||parent.includes(`>${label}<span`),`parent navigation missing ${label}`);

console.log(JSON.stringify({ok:true,revision:'fellowfare-marketplace-canonical-native',goodsPayment:'seller-direct',serviceLearningTokens:'fulfillment-burn',serviceLearningUsd:'stripe-connect-direct-charge',merchantOfRecord:'connected-provider',platformFee:'application-fee',dailyQuestCount:3,dailyQuestReward:5,milestoneEvery:100,milestoneBonus:10},null,2));
