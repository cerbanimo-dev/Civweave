(()=>{
'use strict';
if(globalThis.CivweaveCerbanimoCommerceV1)return;
const VERSION='1.1.0';
const SCHEMA='civweave.cerbanimo-commerce-distribution.v1';
const ANNUAL_SCHEMA='civweave.cerbanimo-annual-distribution.v1';
const RECEIPT_SCHEMA='civweave.cerbanimo-commerce-receipt.v1';
const STORAGE_KEY='civweave.cerbanimo-commerce-receipts.v1';
const DEFAULT_SERVICE_ORIGIN_ROYALTY_BPS=1000;
const DEFAULT_COMMERCE_SPLIT_FEE_BPS=100;
const DEFAULT_ANNUAL_RESERVE_SHARE_BPS=5000;
const DEFAULT_ANNUAL_HOST_BPS=1000;
const DEFAULT_ANNUAL_CERBANIMO_BPS=500;
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const list=v=>Array.isArray(v)?v:[];
const now=()=>new Date().toISOString();
const copy=v=>JSON.parse(JSON.stringify(v));
function integer(v,label,min=0){const n=Number(v);if(!Number.isSafeInteger(n)||n<min)throw new RangeError(`${label} must be an integer >= ${min}.`);return n}
function bps(v,label='basis points'){const n=integer(v,label,0);if(n>10000)throw new RangeError(`${label} must be <= 10000.`);return n}
function contributorId(row){return clean(row?.contributorId||row?.accountId||row?.userId||row?.passportId||row?.id,180)}
function normalizeContributors(rows=[]){
  const merged=new Map();
  for(const raw of list(rows)){
    if(!raw||typeof raw!=='object')continue;
    const id=contributorId(raw);if(!id)continue;
    const weight=Math.max(0,num(raw.weight??raw.cotokens??raw.coCredits??raw.credits??raw.amount??raw.shareBps));
    if(!weight)continue;
    const prior=merged.get(id)||{contributorId:id,contributorName:clean(raw.contributorName||raw.name||id,180),weight:0,stripeAccountId:clean(raw.stripeAccountId||raw.connectedAccountId,180)||null,sourceContributionIds:[]};
    prior.weight+=weight;
    if(!prior.stripeAccountId)prior.stripeAccountId=clean(raw.stripeAccountId||raw.connectedAccountId,180)||null;
    const sourceIds=list(raw.sourceContributionIds||raw.creditIds).map(x=>clean(x,220)).filter(Boolean);
    if(raw.id&&raw.id!==id)sourceIds.push(clean(raw.id,220));
    prior.sourceContributionIds=[...new Set([...prior.sourceContributionIds,...sourceIds])];
    merged.set(id,prior);
  }
  return [...merged.values()].sort((a,b)=>a.contributorId.localeCompare(b.contributorId));
}
function ownershipRows(value){
  if(Array.isArray(value))return value;
  if(!value||typeof value!=='object')return[];
  for(const key of ['contributors','shares','owners','ownership','credits'])if(Array.isArray(value[key]))return value[key];
  return[];
}
function vestedOwnership(endeavorId){
  try{return normalizeContributors(ownershipRows(globalThis.CivweaveRewardWeave?.ownership?.(endeavorId)))}catch{return[]}
}
function largestRemainder(total,rows){
  total=integer(total,'allocation total',0);const normalized=normalizeContributors(rows);if(!total)return normalized.map(r=>({...r,amount:0}));
  if(!normalized.length)throw new Error('At least one weighted contributor is required.');
  const weightTotal=normalized.reduce((s,r)=>s+r.weight,0);if(!(weightTotal>0))throw new Error('Contributor weight total must be positive.');
  const parts=normalized.map(r=>{const exact=total*r.weight/weightTotal,base=Math.floor(exact);return{...r,amount:base,_fraction:exact-base}});
  let remaining=total-parts.reduce((s,r)=>s+r.amount,0);
  [...parts].sort((a,b)=>b._fraction-a._fraction||a.contributorId.localeCompare(b.contributorId)).forEach(r=>{if(remaining>0){r.amount+=1;remaining-=1}});
  return parts.map(({_fraction,...r})=>r);
}
function rewardAlloc(total,rows){const hundredths=Math.round(Math.max(0,num(total))*100);return largestRemainder(hundredths,rows).map(r=>({...r,amount:Number((r.amount/100).toFixed(2))}))}
function roleAllocation(totalMinor,role,rows){return largestRemainder(totalMinor,rows).map(r=>({...r,role,amountMinor:r.amount,amount:undefined}))}
function rewardRoleAllocation(total,role,rows){return rewardAlloc(total,rows).map(r=>({...r,role}))}
function combineRewardRows(rows){
  const map=new Map();
  for(const row of rows){const id=row.contributorId,prior=map.get(id)||{contributorId:id,contributorName:row.contributorName,stripeAccountId:row.stripeAccountId||null,roles:[],amount:0};prior.amount=Number((prior.amount+num(row.amount)).toFixed(2));prior.roles=[...new Set([...prior.roles,row.role])];map.set(id,prior)}
  return [...map.values()].sort((a,b)=>a.contributorId.localeCompare(b.contributorId));
}
function combineCashRows(rows){
  const map=new Map();
  for(const row of rows){const id=row.contributorId,prior=map.get(id)||{contributorId:id,contributorName:row.contributorName,stripeAccountId:row.stripeAccountId||null,roles:[],amountMinor:0,sourceContributionIds:[]};prior.amountMinor+=row.amountMinor;prior.roles=[...new Set([...prior.roles,row.role])];prior.sourceContributionIds=[...new Set([...prior.sourceContributionIds,...list(row.sourceContributionIds)])];map.set(id,prior)}
  return [...map.values()].sort((a,b)=>a.contributorId.localeCompare(b.contributorId));
}
function resolveRows(explicit,endeavorId){const rows=normalizeContributors(explicit);return rows.length?rows:vestedOwnership(endeavorId)}
function feeMinor(amountMinor,feeBps){return Math.round(integer(amountMinor,'sale amount',0)*bps(feeBps,'commerceSplitFeeBps')/10000)}
function buildDistribution(input={}){
  const saleType=clean(input.saleType,20).toLowerCase();if(!['service','product'].includes(saleType))throw new TypeError('saleType must be service or product.');
  const saleId=clean(input.saleId||input.orderId,220);if(!saleId)throw new TypeError('saleId is required.');
  const endeavorId=clean(input.endeavorId||input.projectId||input.templateEndeavorId,220);
  const amountMinor=integer(input.saleAmountMinor??input.netAmountMinor??input.amountMinor,'saleAmountMinor',1);
  const currency=clean(input.currency||'USD',12).toUpperCase();
  const splitFeeBps=bps(input.commerceSplitFeeBps??DEFAULT_COMMERCE_SPLIT_FEE_BPS,'commerceSplitFeeBps');
  const splitFeeMinor=feeMinor(amountMinor,splitFeeBps),buyerChargeMinor=amountMinor+splitFeeMinor;
  const rewardBudget={acorns:Math.max(0,num(input.rewardBudget?.acorns)),buttons:Math.max(0,num(input.rewardBudget?.buttons))};
  const originRoyaltyBps=bps(input.serviceOriginRoyaltyBps??DEFAULT_SERVICE_ORIGIN_ROYALTY_BPS,'serviceOriginRoyaltyBps');
  let cashRows=[],acornRows=[],buttonRows=[],policy;
  if(saleType==='service'){
    const delivery=resolveRows(input.deliveryContributors,input.deliveryEndeavorId||endeavorId);if(!delivery.length)throw new Error('Service sale requires delivery contributors.');
    const origin=resolveRows(input.originContributors,input.originEndeavorId||input.templateEndeavorId||endeavorId);
    const royaltyMinor=origin.length?Math.floor(amountMinor*originRoyaltyBps/10000):0,deliveryMinor=amountMinor-royaltyMinor;
    cashRows=[...roleAllocation(deliveryMinor,'service-delivery',delivery),...(royaltyMinor?roleAllocation(royaltyMinor,'service-origin-royalty',origin):[])];
    const originRewardShare=origin.length?originRoyaltyBps:0;
    for(const [asset,total] of Object.entries(rewardBudget)){
      const originHundredths=origin.length?Math.floor(Math.round(total*100)*originRewardShare/10000):0,deliveryHundredths=Math.round(total*100)-originHundredths;
      const rows=[...rewardRoleAllocation(deliveryHundredths/100,'service-delivery',delivery),...(originHundredths?rewardRoleAllocation(originHundredths/100,'service-origin-royalty',origin):[])];
      if(asset==='acorns')acornRows=rows;else buttonRows=rows;
    }
    policy={mode:'service-delivery-plus-origin-royalty',serviceOriginRoyaltyBps:origin.length?originRoyaltyBps:0,serviceDeliveryBps:origin.length?10000-originRoyaltyBps:10000};
  }else{
    const product=resolveRows(input.productContributors,endeavorId);if(!product.length)throw new Error('Product sale requires product contributors.');
    cashRows=roleAllocation(amountMinor,'product-generation',product);acornRows=rewardRoleAllocation(rewardBudget.acorns,'product-generation',product);buttonRows=rewardRoleAllocation(rewardBudget.buttons,'product-generation',product);policy={mode:'product-generation-contribution-share'};
  }
  const payouts=combineCashRows(cashRows);if(payouts.reduce((s,r)=>s+r.amountMinor,0)!==amountMinor)throw new Error('Cash distribution must conserve the full sale amount.');
  return Object.freeze({schema:SCHEMA,version:VERSION,saleId,saleType,endeavorId:endeavorId||null,currency,saleAmountMinor:amountMinor,netAmountMinor:amountMinor,buyerChargeMinor,commerceSplitFee:{bps:splitFeeBps,amountMinor:splitFeeMinor,onTop:true,destination:'cerbanimo',reducesContributorPayout:false,routesToAnnualPool:false},settlementTiming:'immediate',routesToAnnualPool:false,annualPoolEligible:false,annualPoolContributionMinor:0,weightSource:'vested-cerbanimo-co-credits',cotokensConsumed:false,policy,payouts,rewards:{acorns:combineRewardRows(acornRows),buttons:combineRewardRows(buttonRows)},createdAt:clean(input.createdAt||now(),80)});
}
function buildAnnualDistribution(input={}){
  const annualId=clean(input.annualId||input.distributionId,220);if(!annualId)throw new TypeError('annualId is required.');
  const nodeId=clean(input.nodeId,180);if(!nodeId)throw new TypeError('nodeId is required.');
  const currency=clean(input.currency||'USD',12).toUpperCase();
  const eligibleReserveMinor=integer(input.eligibleReserveMinor??input.reserveMinor,'eligibleReserveMinor',0);
  const reserveShareBps=bps(input.reserveShareBps??DEFAULT_ANNUAL_RESERVE_SHARE_BPS,'reserveShareBps');
  const hostBps=bps(input.hostBps??DEFAULT_ANNUAL_HOST_BPS,'hostBps');
  const cerbanimoBps=bps(input.cerbanimoBps??DEFAULT_ANNUAL_CERBANIMO_BPS,'cerbanimoBps');
  if(hostBps+cerbanimoBps>10000)throw new RangeError('Annual host and Cerbanimo shares cannot exceed 100%.');
  const contributorBps=10000-hostBps-cerbanimoBps;
  const annualPayoutMinor=Math.floor(eligibleReserveMinor*reserveShareBps/10000),retainedReserveMinor=eligibleReserveMinor-annualPayoutMinor;
  const buckets=largestRemainder(annualPayoutMinor,[{contributorId:'annual-contributors',weight:contributorBps},{contributorId:'annual-node-host',weight:hostBps},{contributorId:'annual-cerbanimo',weight:cerbanimoBps}]);
  const bucket=id=>buckets.find(row=>row.contributorId===id)?.amount||0;
  const contributorPoolMinor=bucket('annual-contributors'),hostAmountMinor=bucket('annual-node-host'),cerbanimoAmountMinor=bucket('annual-cerbanimo');
  const participants=normalizeContributors(input.contributors||input.participantContributors);
  if(contributorPoolMinor&&!participants.length)throw new Error('Annual contributor pool requires eligible cotoken contributors.');
  const participantRows=contributorPoolMinor?roleAllocation(contributorPoolMinor,'annual-cotoken-contributor',participants):[];
  const host={contributorId:clean(input.host?.contributorId||input.hostId||`node-host:${nodeId}`,180),contributorName:clean(input.host?.contributorName||input.host?.name||'Node host',180),stripeAccountId:clean(input.host?.stripeAccountId||input.hostStripeAccountId,180)||null,weight:1};
  const cerbanimo={contributorId:clean(input.cerbanimo?.contributorId||input.cerbanimoId||'cerbanimo',180),contributorName:clean(input.cerbanimo?.contributorName||input.cerbanimo?.name||'Cerbanimo',180),stripeAccountId:clean(input.cerbanimo?.stripeAccountId||input.cerbanimoStripeAccountId,180)||null,weight:1};
  const hostRows=hostAmountMinor?roleAllocation(hostAmountMinor,'annual-node-host',[host]):[];
  const cerbanimoRows=cerbanimoAmountMinor?roleAllocation(cerbanimoAmountMinor,'annual-cerbanimo',[cerbanimo]):[];
  const payouts=combineCashRows([...participantRows,...hostRows,...cerbanimoRows]);
  if(payouts.reduce((sum,row)=>sum+row.amountMinor,0)!==annualPayoutMinor)throw new Error('Annual distribution must conserve the full payout amount.');
  return Object.freeze({schema:ANNUAL_SCHEMA,version:VERSION,annualId,nodeId,currency,eventDate:clean(input.eventDate||`${new Date().getUTCFullYear()}-12-01`,40),eligibleReserveMinor,reserveShareBps,annualPayoutMinor,retainedReserveMinor,policy:{basis:'annual-payout',contributorBps,hostBps,cerbanimoBps},weightSource:'eligible-cerbanimo-cotokens',cotokensConsumed:false,payouts,createdAt:clean(input.createdAt||now(),80)});
}
function stripeTransferInstructions(distribution,{sourceTransaction,transferGroup}={}){
  const source=clean(sourceTransaction,220);if(!source)throw new TypeError('sourceTransaction is required for Stripe commerce transfers.');
  return distribution.payouts.filter(x=>x.amountMinor>0).map((p,index)=>({schema:'civweave.cerbanimo-commerce-transfer.v1',saleId:distribution.saleId,recipientId:p.contributorId,destinationAccountId:p.stripeAccountId||null,amountCents:p.amountMinor,currency:distribution.currency.toLowerCase(),sourceTransaction:source,transferGroup:clean(transferGroup||`cerbanimo-sale:${distribution.saleId}`,180),idempotencyKey:`cerbanimo-sale-${distribution.saleId}-${p.contributorId}-${index+1}`,metadata:{civweave_schema:SCHEMA,civweave_sale_id:distribution.saleId,civweave_sale_type:distribution.saleType,civweave_recipient_id:p.contributorId,civweave_roles:p.roles.join(','),civweave_annual_pool:'excluded',civweave_split_fee_bps:String(distribution.commerceSplitFee?.bps||0),civweave_split_fee_minor:String(distribution.commerceSplitFee?.amountMinor||0)}}));
}
function annualStripeTransferInstructions(distribution,{transferGroup}={}){
  if(distribution?.schema!==ANNUAL_SCHEMA)throw new TypeError('Annual distribution is required.');
  return distribution.payouts.filter(x=>x.amountMinor>0).map((p,index)=>({schema:'civweave.cerbanimo-annual-transfer.v1',annualId:distribution.annualId,recipientId:p.contributorId,destinationAccountId:p.stripeAccountId||null,amountCents:p.amountMinor,currency:distribution.currency.toLowerCase(),fundingMode:'platform-reserve',transferGroup:clean(transferGroup||`cerbanimo-annual:${distribution.annualId}`,180),idempotencyKey:`cerbanimo-annual-${distribution.annualId}-${p.contributorId}-${index+1}`,metadata:{civweave_schema:ANNUAL_SCHEMA,civweave_annual_id:distribution.annualId,civweave_node_id:distribution.nodeId,civweave_recipient_id:p.contributorId,civweave_roles:p.roles.join(','),civweave_event_date:distribution.eventDate}}));
}
function receiptStore(){try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');return v?.schema===RECEIPT_SCHEMA&&Array.isArray(v.receipts)?v:{schema:RECEIPT_SCHEMA,receipts:[]}}catch{return{schema:RECEIPT_SCHEMA,receipts:[]}}}
function writeReceipt(distribution){const store=receiptStore(),existing=store.receipts.find(x=>x.saleId===distribution.saleId);if(existing)return{receipt:existing,duplicate:true};const receipt={...copy(distribution),schema:RECEIPT_SCHEMA,recordedAt:now()};store.receipts.push(receipt);store.updatedAt=now();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store))}catch{}return{receipt,duplicate:false}}
async function issueRewardRows(distribution){const ledger=globalThis.CivweaveCanonicalRewardsV2;if(!ledger?.appendEntry)return[];const results=[];for(const [asset,rows] of Object.entries(distribution.rewards))for(const row of rows){if(!(row.amount>0))continue;results.push(await ledger.appendEntry({accountId:row.contributorId,assetType:asset==='acorns'?'acorn':'button',amount:row.amount,sourceSystem:'cerbanimo',sourceKind:'exchange',sourceId:distribution.saleId,sourceKey:`cerbanimo:commerce:${distribution.saleId}:${asset}:${row.contributorId}`,metadata:{saleType:distribution.saleType,roles:row.roles,immediateCommerce:true,routesToAnnualPool:false,weightSource:distribution.weightSource}}))}return results}
async function recordSale(input={}){const distribution=buildDistribution(input),stored=writeReceipt(distribution);if(stored.duplicate)return{distribution:stored.receipt,duplicate:true,rewardResults:[]};const rewardResults=await issueRewardRows(distribution);try{globalThis.dispatchEvent?.(new CustomEvent('civweave:cerbanimo-commerce-payout-ready',{detail:{distribution,transferInstructions:input.sourceTransaction?stripeTransferInstructions(distribution,{sourceTransaction:input.sourceTransaction,transferGroup:input.transferGroup}):[]}}))}catch{}return{distribution,duplicate:false,rewardResults}}
const api=Object.freeze({VERSION,SCHEMA,ANNUAL_SCHEMA,STORAGE_KEY,DEFAULT_SERVICE_ORIGIN_ROYALTY_BPS,DEFAULT_COMMERCE_SPLIT_FEE_BPS,DEFAULT_ANNUAL_RESERVE_SHARE_BPS,DEFAULT_ANNUAL_HOST_BPS,DEFAULT_ANNUAL_CERBANIMO_BPS,normalizeContributors,vestedOwnership,largestRemainder,buildDistribution,buildAnnualDistribution,stripeTransferInstructions,annualStripeTransferInstructions,recordSale,readReceipts:()=>receiptStore()});
globalThis.CivweaveCerbanimoCommerceV1=api;
})();
