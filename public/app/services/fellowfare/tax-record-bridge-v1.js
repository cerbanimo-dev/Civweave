(()=>{
'use strict';
const VERSION='1.1.0',MARKET_KEY='fellowfare.marketplace.v2';
if(globalThis.CivweaveFellowFareTaxRecordBridgeV1?.version===VERSION)return;
const parse=(v,f)=>{try{return JSON.parse(v)??f}catch{return f}},state=v=>String(v??'').toUpperCase().match(/\b[A-Z]{2}\b/)?.[0]||'',clean=(v,n=600)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
function taxability(listing,profile){
 if(listing?.tax?.exempt===true)return'exempt';
 if(listing?.tax?.taxability)return clean(listing.tax.taxability,60);
 const text=clean(`${listing?.category||''} ${listing?.title||''} ${listing?.description||''}`,1000).toLowerCase();
 if(/grocery|food|clothing|medicine|medical|prescription|digital good|download/.test(text))return'review-category-varies';
 return profile?.assumePhysicalGoodsTaxable?'taxable-assumed':'review';
}
function record(detail={}){
 const api=globalThis.CivweaveFellowFareTaxRecordsV1;if(!api)return false;const market=parse(localStorage.getItem(MARKET_KEY),{}),order=(market.orders||[]).find(x=>x?.id===detail.orderId),listing=(market.listings||[]).find(x=>x?.id===detail.listingId);if(!order||!listing)return false;
 const direct=Number(listing?.sellerPayment?.amountMinor),match=String(listing?.sellerPayment?.priceText||'').match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/),amountMinor=Number.isSafeInteger(direct)?direct:match?Math.round(Number(match[1])*100):0;
 const profile=api.profile(),deliveryState=state(order.deliveryState||order.deliveryArea||order.area||listing?.fulfillment?.area),explicitRate=Number(order?.taxRateBps??listing?.tax?.rateBps),rateBps=Number.isFinite(explicitRate)&&explicitRate>=0?explicitRate:null,estimate=api.estimate({amountMinor,deliveryState,taxability:taxability(listing,profile),rateBps});
 return api.append({orderId:order.id,listingId:listing.id,title:listing.title||'',confirmedAt:detail.confirmedAt||new Date().toISOString(),sellerState:state(profile.sellerState||market?.profile?.area),buyerOrDeliveryState:deliveryState,...estimate});
}
addEventListener('civweave:goods-transaction-confirmed',event=>record(event.detail||{}));
globalThis.CivweaveFellowFareTaxRecordBridgeV1=Object.freeze({version:VERSION,record,taxability,platformCollectsTax:false,platformRemitsTax:false});
})();