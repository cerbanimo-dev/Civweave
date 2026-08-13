(()=>{
'use strict';
const VERSION='1.0.0',MARKET_KEY='fellowfare.marketplace.v2';
if(globalThis.CivweaveFellowFareSellerDirectTransactionsV1?.version===VERSION)return;
const GOODS=new Set(['product','resource']),now=()=>new Date().toISOString(),clean=(v,n=220)=>String(v??'').trim().slice(0,n),parse=(v,f)=>{try{return JSON.parse(v)??f}catch{return f}};
function market(){const v=parse(localStorage.getItem(MARKET_KEY),{});return v&&typeof v==='object'?v:{}}
function save(v,reason){v.updatedAt=now();localStorage.setItem(MARKET_KEY,JSON.stringify(v));dispatchEvent(new CustomEvent('fellowfare:marketplace-changed',{detail:{reason,updatedAt:v.updatedAt}}));globalThis.CivweaveFellowFareMarketplaceV2?.render?.()}
function listingFor(v,order){return(v.listings||[]).find(x=>x?.id===order?.listingId)||globalThis.CivweaveFellowFareMarketplaceV2?.listings?.().find(x=>x?.id===order?.listingId)||null}
function update(orderId,action,methodId=''){
 const v=market(),order=(v.orders||[]).find(x=>x?.id===orderId);if(!order)return false;const listing=listingFor(v,order);if(!listing||!GOODS.has(clean(listing.kind,40).toLowerCase()))return false;
 const p=order.sellerDirectPayment&&typeof order.sellerDirectPayment==='object'?order.sellerDirectPayment:{};
 order.sellerDirectPayment={schema:'fellowfare.seller-direct-payment-status.v1',mode:'seller-direct-external',methodId:clean(methodId||p.methodId,80)||null,buyerMarkedPaidAt:action==='buyer-paid'?(p.buyerMarkedPaidAt||now()):p.buyerMarkedPaidAt||null,sellerConfirmedAt:action==='seller-confirm'?(p.sellerConfirmedAt||now()):p.sellerConfirmedAt||null,platformProcessedPayment:false,platformCollectedProceeds:false,platformRoutedProceeds:false,statusRecordIsProcessingEvidence:false,updatedAt:now()};
 order.updatedAt=now();save(v,`seller-direct-${action}`);
 if(action==='seller-confirm')try{dispatchEvent(new CustomEvent('civweave:goods-transaction-confirmed',{detail:{orderId:order.id,listingId:listing.id,kind:listing.kind,title:listing.title,confirmedAt:order.sellerDirectPayment.sellerConfirmedAt,paymentProcessedByFellowFare:false,evidenceType:'counterparty-confirmed-external-payment-status'}}))}catch{}
 return true;
}
function enhance(){
 const v=market();for(const card of document.querySelectorAll('.ffv2-order')){if(card.querySelector('[data-ff-seller-direct-status]'))continue;const id=card.dataset.ffOrderId;if(!id)continue;const order=(v.orders||[]).find(x=>x?.id===id),listing=listingFor(v,order);if(!order||!listing||!GOODS.has(clean(listing.kind,40).toLowerCase()))continue;
  const box=document.createElement('div');box.dataset.ffSellerDirectStatus='true';box.className='ffv2-card-actions';const p=order.sellerDirectPayment||{};
  if(listing.ownerId==='me')box.innerHTML=p.sellerConfirmedAt?'<small>Seller confirmed external payment received.</small>':`<button type="button" data-ff-seller-confirm="${id}">Confirm payment received</button>`;
  else box.innerHTML=p.buyerMarkedPaidAt?'<small>You marked this seller-controlled payment as paid.</small>':`<button type="button" data-ff-buyer-paid="${id}">Mark externally paid</button>`;
  box.insertAdjacentHTML('beforeend','<small>FellowFare tracks transaction state only. This record is not evidence that FellowFare processed the payment.</small>');card.append(box);
 }
}
function click(e){const buyer=e.target.closest?.('[data-ff-buyer-paid]');if(buyer){e.preventDefault();update(buyer.dataset.ffBuyerPaid,'buyer-paid');requestAnimationFrame(enhance);return}const seller=e.target.closest?.('[data-ff-seller-confirm]');if(seller){e.preventDefault();update(seller.dataset.ffSellerConfirm,'seller-confirm');requestAnimationFrame(enhance)}}
const observer=new MutationObserver(()=>requestAnimationFrame(enhance));
function start(){document.addEventListener('click',click,true);addEventListener('hashchange',()=>requestAnimationFrame(enhance));addEventListener('fellowfare:marketplace-changed',()=>requestAnimationFrame(enhance));observer.observe(document.querySelector('#main')||document.body,{childList:true,subtree:true});enhance()}
globalThis.CivweaveFellowFareSellerDirectTransactionsV1=Object.freeze({version:VERSION,update,goodsCommerceMode:'seller_direct',statusRecordIsPaymentProcessingEvidence:false});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
