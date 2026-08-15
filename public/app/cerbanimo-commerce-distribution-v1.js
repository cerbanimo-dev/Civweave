(()=>{
'use strict';
if(globalThis.CivweaveCerbanimoCommerceV1)return;

const VERSION='2.1.0-territory-stewardship';
const SCHEMA='civweave.cerbanimo-commerce-distribution.v1';
const ANNUAL_SCHEMA='civweave.cerbanimo-annual-distribution.v1';
const RECEIPT_SCHEMA='civweave.cerbanimo-commerce-receipt.v1';
const STORAGE_KEY='civweave.cerbanimo-commerce-receipts.v1';
const DEFAULT_ANNUAL_RESERVE_SHARE_BPS=5000;
const DEFAULT_ANNUAL_HOST_BPS=1000;
const DEFAULT_ANNUAL_CERBANIMO_BPS=500;
const CERBANIMO_GLOBAL_SHARE_BPS_OF_CERBANIMO=5000;
const TERRITORY_SHARE_BPS_OF_CERBANIMO=5000;
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const list=v=>Array.isArray(v)?v:[];
const now=()=>new Date().toISOString();

function disabled(){
  const error=new Error('FellowFare marketplace payment processing is disabled. Goods use seller-direct payment; services and learning use Acorn/Button fulfillment.');
  error.code='FELLOWFARE_MARKETPLACE_CHECKOUT_DISABLED';
  throw error;
}
function integer(v,label,min=0){
  const n=Number(v);
  if(!Number.isSafeInteger(n)||n<min)throw new RangeError(`${label} must be an integer >= ${min}.`);
  return n;
}
function bps(v,label='basis points'){
  const n=integer(v,label,0);
  if(n>10000)throw new RangeError(`${label} must be <= 10000.`);
  return n;
}
function contributorId(row){return clean(row?.contributorId||row?.accountId||row?.userId||row?.passportId||row?.id,180)}
function normalizeContributors(rows=[]){
  const merged=new Map();
  for(const raw of list(rows)){
    if(!raw||typeof raw!=='object')continue;
    const id=contributorId(raw);if(!id)continue;
    const weight=Math.max(0,num(raw.weight??raw.cotokens??raw.coCredits??raw.credits??raw.amount??raw.shareBps));
    if(!weight)continue;
    const prior=merged.get(id)||{
      contributorId:id,
      contributorName:clean(raw.contributorName||raw.name||id,180),
      weight:0,
      stripeAccountId:clean(raw.stripeAccountId||raw.connectedAccountId,180)||null,
      sourceContributionIds:[]
    };
    prior.weight+=weight;
    if(!prior.stripeAccountId)prior.stripeAccountId=clean(raw.stripeAccountId||raw.connectedAccountId,180)||null;
    const sourceIds=list(raw.sourceContributionIds||raw.creditIds).map(x=>clean(x,220)).filter(Boolean);
    if(raw.id&&raw.id!==id)sourceIds.push(clean(raw.id,220));
    prior.sourceContributionIds=[...new Set([...prior.sourceContributionIds,...sourceIds])];
    merged.set(id,prior);
  }
  return[...merged.values()].sort((a,b)=>a.contributorId.localeCompare(b.contributorId));
}
function largestRemainder(total,rows){
  total=integer(total,'allocation total',0);
  const normalized=normalizeContributors(rows);
  if(!total)return normalized.map(r=>({...r,amount:0}));
  if(!normalized.length)throw new Error('At least one weighted contributor is required.');
  const weightTotal=normalized.reduce((s,r)=>s+r.weight,0);
  if(!(weightTotal>0))throw new Error('Contributor weight total must be positive.');
  const parts=normalized.map(r=>{
    const exact=total*r.weight/weightTotal,base=Math.floor(exact);
    return{...r,amount:base,_fraction:exact-base};
  });
  let remaining=total-parts.reduce((s,r)=>s+r.amount,0);
  [...parts].sort((a,b)=>b._fraction-a._fraction||a.contributorId.localeCompare(b.contributorId)).forEach(r=>{
    if(remaining>0){r.amount+=1;remaining-=1}
  });
  return parts.map(({_fraction,...r})=>r);
}
function roleAllocation(totalMinor,role,rows){
  return largestRemainder(totalMinor,rows).map(r=>({...r,role,amountMinor:r.amount,amount:undefined}));
}
function combineCashRows(rows){
  const map=new Map();
  for(const row of rows){
    const id=row.contributorId;
    const prior=map.get(id)||{
      contributorId:id,
      contributorName:row.contributorName,
      stripeAccountId:row.stripeAccountId||null,
      roles:[],
      amountMinor:0,
      sourceContributionIds:[],
      holdForPayout:Boolean(row.holdForPayout),
      territoryId:row.territoryId||null
    };
    prior.amountMinor+=row.amountMinor;
    prior.roles=[...new Set([...prior.roles,row.role])];
    prior.sourceContributionIds=[...new Set([...prior.sourceContributionIds,...list(row.sourceContributionIds)])];
    prior.holdForPayout=prior.holdForPayout||Boolean(row.holdForPayout);
    if(!prior.territoryId&&row.territoryId)prior.territoryId=row.territoryId;
    map.set(id,prior);
  }
  return[...map.values()].sort((a,b)=>a.contributorId.localeCompare(b.contributorId));
}
function splitCerbanimoBps(cerbanimoBps){
  const gross=bps(cerbanimoBps,'cerbanimoBps');
  const cerbanimoGlobalBps=Math.floor(gross*CERBANIMO_GLOBAL_SHARE_BPS_OF_CERBANIMO/10000);
  return{cerbanimoGlobalBps,territoryStewardshipBps:gross-cerbanimoGlobalBps};
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
  const {cerbanimoGlobalBps,territoryStewardshipBps}=splitCerbanimoBps(cerbanimoBps);
  const annualPayoutMinor=Math.floor(eligibleReserveMinor*reserveShareBps/10000);
  const retainedReserveMinor=eligibleReserveMinor-annualPayoutMinor;
  const buckets=largestRemainder(annualPayoutMinor,[
    {contributorId:'annual-contributors',weight:contributorBps},
    {contributorId:'annual-node-host',weight:hostBps},
    {contributorId:'annual-cerbanimo-global',weight:cerbanimoGlobalBps},
    {contributorId:'annual-territory-stewardship',weight:territoryStewardshipBps}
  ]);
  const bucket=id=>buckets.find(row=>row.contributorId===id)?.amount||0;
  const contributorPoolMinor=bucket('annual-contributors');
  const hostAmountMinor=bucket('annual-node-host');
  const cerbanimoGlobalAmountMinor=bucket('annual-cerbanimo-global');
  const territoryAmountMinor=bucket('annual-territory-stewardship');
  const participants=normalizeContributors(input.contributors||input.participantContributors);
  if(contributorPoolMinor&&!participants.length)throw new Error('Annual contributor pool requires eligible cotoken contributors.');
  const participantRows=contributorPoolMinor?roleAllocation(contributorPoolMinor,'annual-cotoken-contributor',participants):[];
  const host={
    contributorId:clean(input.host?.contributorId||input.hostId||`node-host:${nodeId}`,180),
    contributorName:clean(input.host?.contributorName||input.host?.name||'Guildkeeper',180),
    stripeAccountId:clean(input.host?.stripeAccountId||input.hostStripeAccountId,180)||null,
    weight:1
  };
  const cerbanimo={
    contributorId:clean(input.cerbanimo?.contributorId||input.cerbanimoId||'cerbanimo-global',180),
    contributorName:clean(input.cerbanimo?.contributorName||input.cerbanimo?.name||'Cerbanimo Global',180),
    stripeAccountId:clean(input.cerbanimo?.stripeAccountId||input.cerbanimoStripeAccountId,180)||null,
    weight:1
  };
  const territoryId=clean(input.territoryId||input.territory?.territoryId||'unassigned',120).toLowerCase();
  const stewardInput=input.territorySteward||input.steward||null;
  const territoryPayoutReady=Boolean(stewardInput&&clean(stewardInput.stripeAccountId||stewardInput.connectedAccountId,180));
  const territory={
    contributorId:territoryPayoutReady
      ? clean(stewardInput.contributorId||stewardInput.appointmentId||`territory-steward:${territoryId}`,180)
      : `territory-reserve:${territoryId}`,
    contributorName:territoryPayoutReady
      ? clean(stewardInput.contributorName||stewardInput.publicName||stewardInput.name||'Charterkeeper',180)
      : `Territory Operations Reserve · ${territoryId}`,
    stripeAccountId:territoryPayoutReady?clean(stewardInput.stripeAccountId||stewardInput.connectedAccountId,180):null,
    territoryId,
    holdForPayout:!territoryPayoutReady,
    weight:1
  };
  const hostRows=hostAmountMinor?roleAllocation(hostAmountMinor,'annual-node-host',[host]):[];
  const cerbanimoRows=cerbanimoGlobalAmountMinor?roleAllocation(cerbanimoGlobalAmountMinor,'annual-cerbanimo-global',[cerbanimo]):[];
  const territoryRows=territoryAmountMinor?roleAllocation(territoryAmountMinor,territoryPayoutReady?'annual-territory-steward':'annual-territory-reserve',[territory]).map(row=>({...row,territoryId,holdForPayout:!territoryPayoutReady})):[];
  const payouts=combineCashRows([...participantRows,...hostRows,...cerbanimoRows,...territoryRows]);
  if(payouts.reduce((sum,row)=>sum+row.amountMinor,0)!==annualPayoutMinor)throw new Error('Annual distribution must conserve the full payout amount.');
  return Object.freeze({
    schema:ANNUAL_SCHEMA,
    version:VERSION,
    annualId,
    nodeId,
    territoryId,
    currency,
    eventDate:clean(input.eventDate||`${new Date().getUTCFullYear()}-12-01`,40),
    eligibleReserveMinor,
    reserveShareBps,
    annualPayoutMinor,
    retainedReserveMinor,
    policy:{
      basis:'annual-payout',
      contributorBps,
      hostBps,
      existingCerbanimoBps:cerbanimoBps,
      cerbanimoGlobalBps,
      territoryStewardshipBps,
      hostShareChanged:false,
      sourceBoundary:'existing-cerbanimo-share-only'
    },
    weightSource:'eligible-cerbanimo-cotokens',
    cotokensConsumed:false,
    payouts,
    heldTerritoryPayoutMinor:payouts.filter(row=>row.holdForPayout).reduce((sum,row)=>sum+row.amountMinor,0),
    createdAt:clean(input.createdAt||now(),80)
  });
}
function annualStripeTransferInstructions(distribution,{transferGroup}={}){
  if(distribution?.schema!==ANNUAL_SCHEMA)throw new TypeError('Annual distribution is required.');
  return distribution.payouts.filter(x=>x.amountMinor>0&&x.stripeAccountId&&!x.holdForPayout).map((p,index)=>({
    schema:'civweave.cerbanimo-annual-transfer.v1',
    annualId:distribution.annualId,
    recipientId:p.contributorId,
    destinationAccountId:p.stripeAccountId,
    amountCents:p.amountMinor,
    currency:distribution.currency.toLowerCase(),
    fundingMode:'platform-reserve',
    transferGroup:clean(transferGroup||`cerbanimo-annual:${distribution.annualId}`,180),
    idempotencyKey:`cerbanimo-annual-${distribution.annualId}-${p.contributorId}-${index+1}`,
    metadata:{
      civweave_schema:ANNUAL_SCHEMA,
      civweave_annual_id:distribution.annualId,
      civweave_node_id:distribution.nodeId,
      civweave_territory_id:distribution.territoryId||'',
      civweave_recipient_id:p.contributorId,
      civweave_roles:p.roles.join(','),
      civweave_event_date:distribution.eventDate
    }
  }));
}
function receiptStore(){
  try{
    const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    return v?.schema===RECEIPT_SCHEMA&&Array.isArray(v.receipts)?v:{schema:RECEIPT_SCHEMA,receipts:[]};
  }catch{return{schema:RECEIPT_SCHEMA,receipts:[]}}
}
const api=Object.freeze({
  VERSION,
  SCHEMA,
  ANNUAL_SCHEMA,
  STORAGE_KEY,
  commerceEnabled:false,
  marketplacePaymentMode:'disabled',
  goodsPaymentMode:'seller-direct',
  serviceLearningMode:'acorn-button-fulfillment-burn',
  DEFAULT_ANNUAL_RESERVE_SHARE_BPS,
  DEFAULT_ANNUAL_HOST_BPS,
  DEFAULT_ANNUAL_CERBANIMO_BPS,
  CERBANIMO_GLOBAL_SHARE_BPS_OF_CERBANIMO,
  TERRITORY_SHARE_BPS_OF_CERBANIMO,
  normalizeContributors,
  largestRemainder,
  splitCerbanimoBps,
  buildDistribution:disabled,
  stripeTransferInstructions:disabled,
  recordSale:async()=>disabled(),
  buildAnnualDistribution,
  annualStripeTransferInstructions,
  readReceipts:()=>receiptStore()
});
globalThis.CivweaveCerbanimoCommerceV1=api;
})();
