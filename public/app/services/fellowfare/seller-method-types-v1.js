(()=>{
'use strict';
const VERSION='1.0.0';
if(globalThis.CivweaveFellowFareSellerMethodTypesV1?.version===VERSION)return;
const TYPES=Object.freeze([
 {id:'stripe_link',label:'Stripe seller link',kind:'external_link'},
 {id:'paypal',label:'PayPal seller link',kind:'external_link'},
 {id:'square',label:'Square seller link',kind:'external_link'},
 {id:'venmo',label:'Venmo',kind:'external_reference'},
 {id:'cash',label:'Cash at pickup / exchange',kind:'offline'},
 {id:'bank_transfer',label:'Bank transfer',kind:'seller_instructions'},
 {id:'other',label:'Other seller-provided method',kind:'seller_instructions'}
]);
globalThis.CivweaveFellowFareSellerMethodTypesV1=Object.freeze({version:VERSION,types:TYPES,ownership:'seller',platformControlsCharge:false,platformCollectsGoodsProceeds:false,platformRoutesGoodsProceeds:false});
})();
