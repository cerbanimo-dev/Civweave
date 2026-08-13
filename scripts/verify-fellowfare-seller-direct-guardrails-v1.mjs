import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [policy, methods, transactions, fulfillment, direct] = await Promise.all([
  read('public/app/services/fellowfare/jurisdiction-policy-v1.js'),
  read('public/app/services/fellowfare/seller-methods-v1.js'),
  read('public/app/services/fellowfare/seller-direct-transactions-v1.js'),
  read('public/app/services/fellowfare/fulfillment-economy-v2.js'),
  read('cloudflare/core/src/fellowfare-direct-commerce-v1.mjs')
]);
for (const source of [policy, methods, transactions]) assert.doesNotThrow(() => new Function(source));
assert.match(policy, /goodsCommerceMode:'seller_direct'/);
assert.match(policy, /platformGoodsCheckout:false/);
assert.match(policy, /platformCollectsGoodsProceeds:false/);
assert.match(policy, /platformRoutesGoodsProceeds:false/);
assert.match(policy, /goodsTransactionFee:false/);
assert.match(policy, /futureGoodsCommerceMode:'platform_facilitated'/);
assert.match(policy, /FACILITATOR_PREREQUISITES/);
assert.match(policy, /mayEnableFacilitator/);
assert.match(policy, /marketplaceMode:ny\?'external_checkout':'default'/);
assert.doesNotMatch(policy, /special\?'classifieds'/);
for (const mode of ['default','classifieds','external_checkout','referrer_reporting','facilitator']) assert.ok(policy.includes(`'${mode}'`));
for (const code of ['AL','ID','IL','IN','IA','ME','MA','NC','RI','UT','VA','WA']) assert.ok(policy.includes(`'${code}'`));
for (const code of ['CA','NV','TX']) assert.ok(policy.includes(`'${code}'`));
assert.match(methods, /platformCollectsPayment:false/);
assert.match(methods, /platformRoutesPayment:false/);
assert.match(methods, /platformEscrowsPayment:false/);
assert.match(methods, /platformSplitsPayment:false/);
assert.match(methods, /platformSettlesPayment:false/);
assert.match(transactions, /platformProcessedPayment:false/);
assert.match(transactions, /statusRecordIsProcessingEvidence:false/);
assert.match(transactions, /paymentProcessedByFellowFare:false/);
assert.match(fulfillment, /listing\.pricing=\{\.\.\.pricing,usdMinor:0,buttons:0,acorns:0\}/);
assert.match(fulfillment, /operation:'fulfillment-burn'/);
assert.match(fulfillment, /recipientCredited:false/);
assert.match(direct, /\['service', 'learning', 'tutoring'\]/);
assert.match(direct, /Physical\/community goods remain seller-direct outside FellowFare/);
assert.doesNotMatch(direct, /automatic_tax/);
assert.doesNotMatch(direct, /transfer_data|destination:/);
console.log(JSON.stringify({ok:true,revision:'fellowfare-seller-direct-guardrails-v1',goodsCommerceMode:'seller_direct',specialReviewStates:12,yellowGuardrailStates:3},null,2));
