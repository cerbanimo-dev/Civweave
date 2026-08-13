(()=>{
'use strict';
const VERSION='1.0.0',MARKET_KEY='fellowfare.marketplace.v2';
if(globalThis.CivweaveFellowFareTaxRecordBridgeV1?.version===VERSION)return;
const parse=(v,f)=>{try{return JSON.parse(v)??f}catch{return f}},state=v=>String(v??'').toUpperCase().match(/\b[A-Z]{2}\b/)?.[0]||'';
function record(detail={}){
 const api=globalThis.CivweaveFellowFareTaxRecordsV1;if(!api)return false;const market=parse(localStorage.getItem(MARKET_KEY),{}),order=(market.orders||[]).find(x=>x?.id===detail.orderId),listing=(market.listings||[]).find(x=>x?.id===detail.listingId);if(!order||!listing)return false;
 const direct=Number(listing?.sellerPayment?.amountMinor),match=String(listing?.sellerPayment?.priceText||'').match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/),amountMinor=Number.isSafeInteger(direct)?direct:match?Math.round(Number(match[1])*100):0;
 const profile=api.profile(),taxability=listing?.tax?.exempt===true?'exempt':listing?.tax?.taxability||(profile.assumePhysicalGoodsTaxable?'taxable-assumed':'review'),deliveryState=state(order.deliveryState||order.deliveryArea||order.area||listing?.fulfillment?.area),estimate=api.estimate({amountMinor,deliveryState,taxability});
 return api.append({orderId:order.id,listingId:listing.id,title:listing.title||'',confirmedAt:detail.confirmedAt||new Date().toISOString(),...estimate});
}
addEventListener('civweave:goods-transaction-confirmed',event=>record(event.detail||{}));
globalThis.CivweaveFellowFareTaxRecordBridgeV1=Object.freeze({version:VERSION,record,platformCollectsTax:false});
})();
