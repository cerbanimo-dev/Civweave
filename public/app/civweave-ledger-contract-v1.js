(()=>{
'use strict';
if(globalThis.CivweaveLedgerContractV1)return;

const VERSION='1.0.0';
const SCHEMA='civweave.ledger-contract.v1';
const ASSETS=Object.freeze({
  SKILL_XP:'skill-xp',
  ACORN:'acorn',
  BUTTON:'button',
  COTOKEN:'cotoken',
});
const OPERATIONS=Object.freeze({
  EARN:'earn',
  BURN:'burn',
  CORRECTION:'correction',
  REVERSAL:'reversal',
});
const TRANSFERABLE=Object.freeze({
  'skill-xp':false,
  acorn:false,
  button:false,
  cotoken:false,
});
const BURNABLE=Object.freeze({
  'skill-xp':false,
  acorn:true,
  button:true,
  cotoken:false,
});
const AUTHORITIES=Object.freeze({
  validation:'civweave.validation-ledger',
  rewards:'civweave.reward-ledger',
  contribution:'civweave.contribution-ledger',
  fulfillment:'civweave.fulfillment-ledger',
});
const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const allowedAsset=value=>Object.values(ASSETS).includes(value);
const allowedOperation=value=>Object.values(OPERATIONS).includes(value);

function normalizeAsset(value){
  const raw=clean(value,40).toLowerCase();
  if(['xp','skillxp','skill_xp','skill-xp'].includes(raw))return ASSETS.SKILL_XP;
  if(['acorn','acorns'].includes(raw))return ASSETS.ACORN;
  if(['button','buttons','coin','coins'].includes(raw))return ASSETS.BUTTON;
  if(['cotoken','cotokens','co-token','co-tokens'].includes(raw))return ASSETS.COTOKEN;
  return '';
}
function normalizeOperation(value,amount){
  const raw=clean(value,40).toLowerCase();
  if(allowedOperation(raw))return raw;
  return num(amount)<0?OPERATIONS.BURN:OPERATIONS.EARN;
}
function assertRewardMutation(input={}){
  const asset=normalizeAsset(input.assetType||input.asset),operation=normalizeOperation(input.operation,input.amount),amount=Math.abs(num(input.amount));
  if(!allowedAsset(asset)||asset===ASSETS.COTOKEN)throw new Error('Reward Ledger only accepts Skill XP, Acorns, and Buttons.');
  if(!amount)throw new Error('Reward amount must be non-zero.');
  if(operation===OPERATIONS.BURN&&!BURNABLE[asset])throw new Error(`${asset} is not burnable.`);
  if(operation===OPERATIONS.EARN&&num(input.amount)<0)throw new Error('Earn events must not carry a negative amount.');
  if(input.toAccountId||input.recipientId||input.transferTo||operation==='transfer')throw new Error(`${asset} is non-transferable; mint/reward and burn must be separate events.`);
  return{assetType:asset,operation,amount};
}
function fulfillmentSettlement(input={}){
  const fulfillmentId=clean(input.fulfillmentId||input.sourceId,240);
  const requesterId=clean(input.requesterId||input.requesterAccountId,180);
  const fulfillerId=clean(input.fulfillerId||input.fulfillerAccountId,180);
  const asset=normalizeAsset(input.assetType||input.asset);
  const burnAmount=Math.abs(num(input.burnAmount));
  const rewardAmount=Math.abs(num(input.rewardAmount??input.burnAmount));
  const validationRef=clean(input.validationRef||input.thresholdReceiptId,240);
  if(!fulfillmentId||!requesterId||!fulfillerId)throw new Error('Fulfillment settlement requires fulfillment, requester, and fulfiller IDs.');
  if(![ASSETS.ACORN,ASSETS.BUTTON].includes(asset))throw new Error('Fulfillment settlement supports only burnable Acorns or Buttons.');
  if(!burnAmount||!rewardAmount)throw new Error('Fulfillment burn and reward amounts must be non-zero.');
  if(requesterId===fulfillerId)throw new Error('Requester and fulfiller must be distinct for fulfillment settlement.');
  if(!validationRef)throw new Error('Fulfillment settlement requires a validation threshold reference.');
  return{
    schema:'civweave.fulfillment-settlement.v1',
    fulfillmentId,validationRef,assetType:asset,
    burn:{accountId:requesterId,operation:OPERATIONS.BURN,amount:burnAmount,sourceKey:`fulfillment:${fulfillmentId}:burn:${requesterId}:${asset}`},
    reward:{accountId:fulfillerId,operation:OPERATIONS.EARN,amount:rewardAmount,sourceKey:`fulfillment:${fulfillmentId}:reward:${fulfillerId}:${asset}`},
  };
}

const api=Object.freeze({VERSION,SCHEMA,ASSETS,OPERATIONS,TRANSFERABLE,BURNABLE,AUTHORITIES,normalizeAsset,normalizeOperation,assertRewardMutation,fulfillmentSettlement});
globalThis.CivweaveLedgerContractV1=api;
})();
