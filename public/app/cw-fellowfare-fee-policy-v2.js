(()=>{
'use strict';
if(globalThis.CivweaveFellowFareFeePolicyV2)return;
const VERSION='2.0.0';
const POLICY=Object.freeze({
  id:'fellowfare.network-surcharge.v2',
  networkFeeBps:100,
  hostBps:50,
  cerbanimoBps:50,
  appliesTo:'stripe-mediated-goods-and-services-only',
  internalTokenFeeBps:0,
  sellerPriceProtected:true,
  description:'A 1% FellowFare network surcharge is added to qualifying fiat commerce: 0.5% for the serving host and 0.5% for Cerbanimo LLC. The seller subtotal is not reduced.'
});
const clean=(v,n=180)=>String(v??'').trim().slice(0,n);
const int=(v,min=0)=>{const n=Number(v);return Number.isSafeInteger(n)&&n>=min?n:min};
function isQualifyingCommerce(input={}){
  const kind=clean(input.kind||input.transactionKind,60).toLowerCase();
  const rail=clean(input.rail||input.paymentRail,40).toLowerCase();
  const asset=clean(input.currency||'usd',12).toLowerCase();
  if(['button','buttons','acorn','acorns'].includes(asset)||rail==='internal')return false;
  if(['gift','donation','refund','reversal','reward','mint','topup','membership','peer-transfer','cash-transfer','money-transfer','token-cashout'].includes(kind))return false;
  return ['stripe','stripe-connect','fiat'].includes(rail)&&['goods','service','labor','learning','market','commerce','booking','commission','repair','delivery','sale'].includes(kind||'market');
}
function quoteFiat(input={}){
  const sellerSubtotalCents=int(input.sellerSubtotalCents??input.amountCents,0);
  const eligible=sellerSubtotalCents>0&&isQualifyingCommerce(input);
  const networkFeeCents=eligible?Math.ceil(sellerSubtotalCents*POLICY.networkFeeBps/10000):0;
  const hostFeeCents=eligible?Math.floor(networkFeeCents/2):0;
  const cerbanimoFeeCents=networkFeeCents-hostFeeCents;
  const processorRecoveryCents=int(input.processorRecoveryCents,0);
  return Object.freeze({
    schema:'fellowfare.checkout-quote.v2',policyId:POLICY.id,eligible,currency:clean(input.currency||'USD',12).toUpperCase(),
    sellerSubtotalCents,networkFeeCents,processorRecoveryCents,
    buyerTotalCents:sellerSubtotalCents+networkFeeCents+processorRecoveryCents,
    sellerTransferCents:sellerSubtotalCents,hostFeeCents,cerbanimoFeeCents,
    servingHostId:clean(input.servingHostId||input.hubId||input.nodeId)||null,
    accounting:Object.freeze({sellerPriceProtected:true,networkFeeAddedOnTop:true,processorRecoverySeparate:true})
  });
}
function quoteInternal(input={}){
  const amount=Math.max(0,Number(input.amount)||0),asset=clean(input.assetType||input.currency,20).toLowerCase();
  if(!['button','buttons','acorn','acorns'].includes(asset))throw new TypeError('Internal FellowFare quotes are only for Buttons or Acorns.');
  return Object.freeze({schema:'fellowfare.internal-quote.v2',assetType:asset.startsWith('button')?'button':'acorn',amount,networkFee:0,providerReceives:amount,policyId:POLICY.id});
}
function receipt(input={}){const q=quoteFiat(input);return Object.freeze({...q,schema:'fellowfare.network-fee-receipt.v2',transactionId:clean(input.transactionId||input.agreementId||input.threadId),agreementId:clean(input.agreementId)||null,threadId:clean(input.threadId)||null,createdAt:clean(input.createdAt||new Date().toISOString(),80)});}
const api=Object.freeze({version:VERSION,policy:POLICY,isQualifyingCommerce,quoteFiat,quoteInternal,receipt});
globalThis.CivweaveFellowFareFeePolicyV2=api;
try{dispatchEvent(new CustomEvent('fellowfare:fee-policy-ready',{detail:{version:VERSION,policy:POLICY}}))}catch{}
})();
