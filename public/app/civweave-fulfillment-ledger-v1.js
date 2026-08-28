(()=>{
'use strict';
if(globalThis.CivweaveFulfillmentLedgerV1)return;

const VERSION='1.1.0';
const KEY='civweave.fulfillment-ledger.v1';
const VALIDATION_KEY='civweave.validation-ledger.v1.1';
const SCHEMA='civweave.fulfillment-ledger.v1';
const ENTRY='civweave.fulfillment-entry.v1';
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const clone=value=>structuredClone(value);
const empty=()=>({schema:SCHEMA,version:1,entries:[],processedFulfillmentIds:[],updatedAt:now()});
const read=()=>{const value=parse(localStorage.getItem(KEY),null);return value?.schema===SCHEMA&&Array.isArray(value.entries)?value:empty()};
function write(ledger){ledger.updatedAt=now();localStorage.setItem(KEY,JSON.stringify(ledger));try{dispatchEvent(new CustomEvent('civweave:fulfillment-ledger-changed',{detail:clone(ledger)}))}catch{}return ledger}
function validationThreshold(validationRef){
  const ref=clean(validationRef,240),state=parse(localStorage.getItem(VALIDATION_KEY),{}),rows=Array.isArray(state?.thresholdReceipts)?state.thresholdReceipts:[];
  const receipt=rows.find(row=>clean(row?.id,240)===ref);
  if(!receipt)return null;
  if(receipt.outcome!=='pass'||receipt.payoutEligible!==true)return null;
  if(receipt.integrity!=='derived-from-weighted-confidence')return null;
  if(!Number.isFinite(Number(receipt.confidence))||Number(receipt.confidence)<.88)return null;
  if(!receipt.diversity?.satisfied)return null;
  return receipt;
}
function normalize(input={}){
  const contract=globalThis.CivweaveLedgerContractV1;
  if(!contract)throw new Error('Civweave ledger contract is required.');
  const settlement=contract.fulfillmentSettlement(input);
  return{
    schema:ENTRY,
    id:clean(input.id||`fulfillment:${settlement.fulfillmentId}`,240),
    fulfillmentId:settlement.fulfillmentId,
    requesterId:settlement.burn.accountId,
    fulfillerId:settlement.reward.accountId,
    assetType:settlement.assetType,
    burnAmount:settlement.burn.amount,
    rewardAmount:settlement.reward.amount,
    validationRef:settlement.validationRef,
    requestedOutcome:clean(input.requestedOutcome,2000)||undefined,
    proofContract:clean(input.proofContract,2000)||undefined,
    status:clean(input.status||'validated',80),
    burnSourceKey:settlement.burn.sourceKey,
    rewardSourceKey:settlement.reward.sourceKey,
    settlementEventIds:Array.isArray(input.settlementEventIds)?input.settlementEventIds.map(value=>clean(value,240)).filter(Boolean).slice(0,8):[],
    createdAt:clean(input.createdAt||now(),80),
    settledAt:input.settledAt?clean(input.settledAt,80):undefined,
  };
}
function record(input={}){
  const ledger=read(),entry=normalize(input),existing=ledger.entries.find(row=>row.fulfillmentId===entry.fulfillmentId);
  if(existing)return{entry:existing,duplicate:true,ledger};
  ledger.entries.push(entry);write(ledger);return{entry,duplicate:false,ledger};
}
async function settle(input={}){
  const rewards=globalThis.CivweaveCanonicalRewardsV2;
  if(!rewards)throw new Error('Canonical Reward Ledger v2 is required.');
  const ledger=read(),fulfillmentId=clean(input.fulfillmentId,240);
  if(ledger.processedFulfillmentIds.includes(fulfillmentId))return{duplicate:true,entry:ledger.entries.find(row=>row.fulfillmentId===fulfillmentId)||null};
  const prepared=normalize(input),threshold=validationThreshold(prepared.validationRef);
  if(!threshold)throw new Error('Fulfillment settlement requires an accepted canonical validation threshold receipt.');
  if(threshold.submissionId&&clean(input.submissionId||prepared.fulfillmentId,240)!==clean(threshold.submissionId,240)&&clean(prepared.fulfillmentId,240)!==clean(threshold.submissionId,240))throw new Error('Validation threshold does not authorize this fulfillment.');
  const burn=await rewards.appendEntry({
    accountId:prepared.requesterId,assetType:prepared.assetType,operation:'burn',amount:prepared.burnAmount,
    sourceSystem:'fellowfare',sourceKind:'fulfillment',sourceId:prepared.fulfillmentId,sourceKey:prepared.burnSourceKey,
    evidenceHash:prepared.validationRef,validatorIds:threshold.verdictReceiptIds,metadata:{validationRef:prepared.validationRef,fulfillmentId:prepared.fulfillmentId,role:'requester',validationConfidence:threshold.confidence}
  });
  const reward=await rewards.appendEntry({
    accountId:prepared.fulfillerId,assetType:prepared.assetType,operation:'earn',amount:prepared.rewardAmount,
    sourceSystem:'fellowfare',sourceKind:'fulfillment',sourceId:prepared.fulfillmentId,sourceKey:prepared.rewardSourceKey,
    evidenceHash:prepared.validationRef,validatorIds:threshold.verdictReceiptIds,metadata:{validationRef:prepared.validationRef,fulfillmentId:prepared.fulfillmentId,role:'fulfiller',validationConfidence:threshold.confidence}
  });
  prepared.status='settled';prepared.settledAt=now();prepared.settlementEventIds=[burn.entry.id,reward.entry.id];
  const existingIndex=ledger.entries.findIndex(row=>row.fulfillmentId===prepared.fulfillmentId);
  if(existingIndex>=0)ledger.entries[existingIndex]={...ledger.entries[existingIndex],...prepared,createdAt:ledger.entries[existingIndex].createdAt||prepared.createdAt};else ledger.entries.push(prepared);
  ledger.processedFulfillmentIds.push(prepared.fulfillmentId);write(ledger);
  return{duplicate:false,entry:prepared,burn:burn.entry,reward:reward.entry,validation:threshold};
}
const api=Object.freeze({VERSION,KEY,VALIDATION_KEY,SCHEMA,ENTRY,readLedger:read,record,settle,normalize,validationThreshold});
globalThis.CivweaveFulfillmentLedgerV1=api;
})();
