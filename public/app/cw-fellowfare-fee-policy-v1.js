(()=>{
'use strict';
if(globalThis.CivweaveFellowFareFeePolicyV1)return;
const VERSION='1.0.0';
const POLICY=Object.freeze({
  id:'fellowfare.market-rake.v1',
  totalBps:100,
  hostBps:50,
  cerbanimoBps:50,
  cerbanimoAccountId:'treasury:cerbanimo-llc',
  cerbanimoLabel:'Cerbanimo LLC',
  description:'1% total FellowFare transaction fee, split evenly between the serving host and Cerbanimo LLC.'
});
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const round=value=>Number(num(value).toFixed(8));
function normalizeAsset(value){const asset=clean(value,40).toLowerCase();if(['button','buttons'].includes(asset))return'button';if(['acorn','acorns'].includes(asset))return'acorn';if(['usd','dollar','dollars'].includes(asset))return'USD';if(asset==='usdc')return'USDC';return clean(value,20)}
function hostAccountId({hostAccountId='',hubId='',nodeId=''}={}){const explicit=clean(hostAccountId);if(explicit)return explicit;const host=clean(hubId||nodeId);return host?`host:${host}`:'host:local-unresolved'}
function isFeeEligible({amount,assetType,kind='market'}={}){const type=clean(kind,40).toLowerCase();return num(amount)>0&&Boolean(normalizeAsset(assetType))&&!['gift','donation','refund','reversal','reward','mint'].includes(type)}
function quote(input={}){
  const gross=Math.max(0,num(input.amount));
  const assetType=normalizeAsset(input.assetType||input.currency||'button');
  const eligible=isFeeEligible({amount:gross,assetType,kind:input.kind});
  const hostFee=eligible?round(gross*POLICY.hostBps/10000):0;
  const cerbanimoFee=eligible?round(gross*POLICY.cerbanimoBps/10000):0;
  const fee=round(hostFee+cerbanimoFee);
  return{
    schema:'fellowfare.fee-quote.v1',policyId:POLICY.id,assetType,gross,fee,providerNet:round(Math.max(0,gross-fee)),totalBps:eligible?POLICY.totalBps:0,eligible,
    splits:[
      {role:'provider',amount:round(Math.max(0,gross-fee))},
      {role:'serving-host',accountId:hostAccountId(input),amount:hostFee,bps:eligible?POLICY.hostBps:0},
      {role:'cerbanimo-llc',accountId:POLICY.cerbanimoAccountId,label:POLICY.cerbanimoLabel,amount:cerbanimoFee,bps:eligible?POLICY.cerbanimoBps:0}
    ].filter(row=>row.amount>0)
  };
}
function settlementReceipt(input={}){
  const feeQuote=quote(input);
  return{
    schema:'fellowfare.fee-split-receipt.v1',policyId:feeQuote.policyId,
    transactionId:clean(input.transactionId||input.agreementId||input.threadId),threadId:clean(input.threadId)||undefined,agreementId:clean(input.agreementId)||undefined,
    assetType:feeQuote.assetType,gross:feeQuote.gross,fee:feeQuote.fee,providerNet:feeQuote.providerNet,splits:feeQuote.splits,
    servingHostId:clean(input.hubId||input.nodeId||input.hostAccountId)||undefined,
    sourceReceiptId:clean(input.sourceReceiptId||input.ledgerReceiptId)||undefined,createdAt:clean(input.createdAt||new Date().toISOString(),80)
  };
}
const api=Object.freeze({version:VERSION,policy:POLICY,normalizeAsset,hostAccountId,isFeeEligible,quote,settlementReceipt});
globalThis.CivweaveFellowFareFeePolicyV1=api;
try{dispatchEvent(new CustomEvent('fellowfare:fee-policy-ready',{detail:{version:VERSION,policy:POLICY}}))}catch{}
})();
