(()=>{
'use strict';
const VERSION='1.0.0';
if(globalThis.CivweaveFellowFareJurisdictionPolicyV1?.version===VERSION)return;
const MODES=Object.freeze(['default','classifieds','external_checkout','referrer_reporting','facilitator']);
const SPECIAL_REVIEW=new Set(['AL','ID','IL','IN','IA','ME','MA','NC','RI','UT','VA','WA']);
const YELLOW_GUARDRAIL=new Set(['CA','NV','TX']);
const STATES=['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
function entry(code){
 const special=SPECIAL_REVIEW.has(code),yellow=YELLOW_GUARDRAIL.has(code),ny=code==='NY';
 return Object.freeze({
  code,
  goodsCommerceMode:'seller_direct',
  marketplaceMode:ny?'external_checkout':special?'classifieds':'default',
  sellerDirectRequired:true,
  platformGoodsCheckout:false,
  platformCollectsGoodsProceeds:false,
  platformRoutesGoodsProceeds:false,
  goodsTransactionFee:false,
  structuredSellerPaymentMethods:true,
  taxCopilot:true,
  taxCollector:'seller',
  taxRemitter:'seller',
  review:special?'special':yellow?'guardrail':'standard',
  futureFacilitatorEligible:true,
  notes:ny?'Do not enable FellowFare-controlled goods checkout or tax collection without deliberate New York marketplace-provider review.':special?'Extra marketplace-facilitator review required before FellowFare materially participates in goods payment collection.':yellow?'Re-review if goods checkout, payment involvement, or transaction-specific fees materially change.':''
 });
}
const matrix=Object.freeze(Object.fromEntries(STATES.map(code=>[code,entry(code)])));
function normalize(value){return String(value||'').trim().toUpperCase().replace(/^US[-_]/,'').slice(0,2)}
function policy(value){
 const code=normalize(value);
 return matrix[code]||Object.freeze({code,goodsCommerceMode:'seller_direct',marketplaceMode:'default',sellerDirectRequired:true,platformGoodsCheckout:false,platformCollectsGoodsProceeds:false,platformRoutesGoodsProceeds:false,goodsTransactionFee:false,structuredSellerPaymentMethods:true,taxCopilot:true,taxCollector:'seller',taxRemitter:'seller',review:'unknown',futureFacilitatorEligible:true,notes:'Unknown jurisdiction: keep seller-direct and require review before adding platform goods checkout.'});
}
function requiresReview(value,change=''){
 const p=policy(value),text=String(change||'').toLowerCase();
 return p.review!=='standard'||/goods checkout|payment gateway|transaction fee|commission|percentage fee|collect.*proceeds|collect.*tax/.test(text);
}
const api=Object.freeze({
 version:VERSION,modes:MODES,states:Object.freeze([...STATES]),matrix,policy,requiresReview,
 specialReview:Object.freeze([...SPECIAL_REVIEW]),yellowGuardrail:Object.freeze([...YELLOW_GUARDRAIL]),
 defaultGoodsCommerceMode:'seller_direct',futureGoodsCommerceMode:'platform_facilitated',
 revenuePolicy:'node-membership-compute-service-not-goods-transaction-fee'
});
globalThis.CivweaveFellowFareJurisdictionPolicyV1=api;
})();
