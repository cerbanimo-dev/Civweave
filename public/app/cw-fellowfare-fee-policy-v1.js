(()=>{
'use strict';
if(globalThis.CivweaveFellowFareFeePolicyV1)return;
const VERSION='1.0.0';
const POLICY=Object.freeze({
  id:'fellowfare.transaction-fee.v1',
  totalBps:100,
  hostBps:50,
  cerbanimoBps:50,
  cerbanimoAccountId:'treasury:cerbanimo-llc',
  cerbanimoLabel:'Cerbanimo LLC',
  description:'1% total FellowFare transaction fee, split evenly between the serving host and Cerbanimo LLC.'
});
const META_KEY='fellowfare.skill-market-meta.v1';
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const round=value=>Number(num(value).toFixed(8));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const fmt=value=>new Intl.NumberFormat(undefined,{maximumFractionDigits:4}).format(num(value));
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
function readSkillMeta(){const value=parse(localStorage.getItem(META_KEY),null);return value?.threads&&typeof value.threads==='object'?value:{threads:{}}}
function quoteForThread(threadId,context={}){const meta=readSkillMeta().threads?.[threadId];if(!meta)return null;return quote({...context,amount:meta.units,assetType:meta.currency,threadId})}
function settlementReceiptForThread(threadId,context={}){const meta=readSkillMeta().threads?.[threadId];if(!meta)return null;return settlementReceipt({...context,amount:meta.units,assetType:meta.currency,threadId})}
function assetLabel(asset,amount){if(asset==='button')return Number(amount)===1?'Button':'Buttons';if(asset==='acorn')return Number(amount)===1?'Acorn':'Acorns';return asset}
function feeSentence(feeQuote){if(!feeQuote?.eligible)return'No FellowFare transaction fee applies.';const host=feeQuote.splits.find(row=>row.role==='serving-host')?.amount||0,company=feeQuote.splits.find(row=>row.role==='cerbanimo-llc')?.amount||0,label=assetLabel(feeQuote.assetType,feeQuote.gross);return `${fmt(feeQuote.gross)} ${label} gross · ${fmt(feeQuote.providerNet)} to provider · ${fmt(host)} to host · ${fmt(company)} to Cerbanimo LLC`;}
function ensureStyle(){if(document.querySelector('style[data-ff-fee-policy-v1]'))return;const style=document.createElement('style');style.dataset.ffFeePolicyV1='';style.textContent=`.ff-fee-quote{display:block;margin-top:7px;font-size:.7rem;font-weight:750;opacity:.78}.cw-fee-proof{position:relative;z-index:2;margin-top:7px;padding:7px 9px;border-left:3px solid currentColor;font-size:.7rem;opacity:.78}`;document.head.append(style)}
function renderComposerQuote(){const output=document.querySelector('#skillMarketCurrency');if(!output)return;let fee=output.querySelector('.ff-fee-quote');if(!fee){fee=document.createElement('small');fee.className='ff-fee-quote';output.append(fee)}const units=num(document.querySelector('#skillMarketUnits')?.value),intent=document.querySelector('#skillMarketIntent')?.value||'labor',assetType=intent==='learning'?'acorn':'button';const feeQuote=quote({amount:units,assetType});fee.textContent=units>0?`FellowFare fee: ${feeSentence(feeQuote)}. Total fee is 1%, split 0.5% / 0.5%.`:'FellowFare takes 1% of completed paid exchanges: 0.5% to the serving host and 0.5% to Cerbanimo LLC.'}
function renderThreadQuotes(){const meta=readSkillMeta();for(const [threadId] of Object.entries(meta.threads||{})){const trigger=document.querySelector(`[data-open-thread="${CSS.escape(threadId)}"]`),card=trigger?.closest('.thread-card');if(card&&!card.querySelector('[data-ff-fee-thread]')){const line=document.createElement('div');line.dataset.ffFeeThread='';line.className='cw-fee-proof';line.textContent=`Settlement · ${feeSentence(quoteForThread(threadId))}`;(card.querySelector('[data-cw-skill-proof]')||card.querySelector('.thread-meta')||card).insertAdjacentElement('afterend',line)}const detail=document.querySelector('#detailContent');if(detail?.dataset.cwSkillThread===threadId&&!detail.querySelector('[data-ff-fee-detail]')){const line=document.createElement('p');line.dataset.ffFeeDetail='';line.className='cw-fee-proof';line.textContent=`FellowFare settlement · ${feeSentence(quoteForThread(threadId))}. The fee is shown before settlement and travels in the same asset.`;(detail.querySelector('[data-cw-skill-proof]')||detail.querySelector('.detail-hero')||detail).insertAdjacentElement('afterend',line)}}}
let queued=false;function render(){queued=false;ensureStyle();renderComposerQuote();renderThreadQuotes()}function queue(){if(queued)return;queued=true;(globalThis.requestAnimationFrame||setTimeout)(render,0)}
function boot(){render();document.addEventListener('input',event=>{if(['skillMarketUnits','skillMarketIntent'].includes(event.target?.id))queue()});document.addEventListener('change',event=>{if(['skillMarketUnits','skillMarketIntent','threadCategory'].includes(event.target?.id))queue()});addEventListener('fellowfare:skill-market-meta',queue);addEventListener('storage',event=>{if(event.key===META_KEY)queue()});new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true})}
const api=Object.freeze({version:VERSION,policy:POLICY,normalizeAsset,hostAccountId,isFeeEligible,quote,settlementReceipt,quoteForThread,settlementReceiptForThread,feeSentence});
globalThis.CivweaveFellowFareFeePolicyV1=api;
try{dispatchEvent(new CustomEvent('fellowfare:fee-policy-ready',{detail:{version:VERSION,policy:POLICY}}))}catch{}
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
