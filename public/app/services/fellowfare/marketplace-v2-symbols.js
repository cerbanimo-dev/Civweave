(()=>{
'use strict';
if(globalThis.CivweaveFellowFareCurrencySymbols)return;

const SYMBOLS=Object.freeze({button:'🔘',acorn:'🌰'});
const REWARD_KEY='civweave.reward-ledger.v2';
const GOODS_KINDS=new Set(['product','resource']);
const TOKEN_KINDS=new Set(['service','learning','tutoring']);
const clean=(value,max=12000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const money=minor=>Number(minor)>0?`$${(Number(minor)/100).toFixed(2)}`:'';

function kindFor(term){return /^button/i.test(String(term||''))?'button':'acorn'}
function symbolFor(term){return SYMBOLS[kindFor(term)]}
function format(term){const value=clean(term,40);return value?`${symbolFor(value)} ${value}`:value}
function decorate(){return false}

function projection(){
 try{const value=globalThis.CivweaveCanonicalRewardsV2?.project?.();if(value)return value}catch{}
 const raw=parse(localStorage.getItem(REWARD_KEY),{}),entries=Array.isArray(raw?.entries)?raw.entries:[];
 return entries.reduce((out,row)=>{const amount=Number(row?.amount)||0;if(row?.assetType==='button')out.buttons+=amount;if(row?.assetType==='acorn')out.acorns+=amount;if(row?.assetType==='skill-xp')out.skillXp+=amount;return out},{buttons:0,acorns:0,skillXp:0});
}
async function copyText(text){
 try{await navigator.clipboard.writeText(text);return true}catch{}
 const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();let ok=false;try{ok=document.execCommand('copy')}catch{}area.remove();return ok;
}
function notify(text){let node=document.querySelector('#ffv2CapabilityToast,#ffv2Toast,#ffv2CurrencyToast');if(!node){node=document.createElement('div');node.id='ffv2CurrencyToast';node.className='ffv2-toast';document.body.append(node)}node.textContent=text;node.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>node.hidden=true,2600)}
function listingById(id){return globalThis.CivweaveFellowFareMarketplaceV2?.listings?.().find(row=>row?.id===id)||null}
function listingShareText(listing){
 const pricing=listing?.pricing||{},terms=[],kind=clean(listing?.kind,40).toLowerCase();
 if(GOODS_KINDS.has(kind)){
   const seller=listing?.sellerPayment||{};
   if(clean(seller.priceText,120))terms.push(clean(seller.priceText,120));
   if(Array.isArray(seller.methods)&&seller.methods.length)terms.push(`Seller accepts: ${seller.methods.map(x=>clean(x,80)).filter(Boolean).join(', ')}`);
   if(!terms.length)terms.push('Seller-direct payment terms');
 }else if(TOKEN_KINDS.has(kind)){
   if(Number(pricing.usdMinor)>0){const ready=listing?.sellerPayment?.mode==='stripe-direct'&&listing?.sellerPayment?.priceId;terms.push(`${money(pricing.usdMinor)} via ${ready?'provider Stripe direct checkout':'provider Stripe once setup completes'}`)}
   const fulfill=[];
   if(Number(pricing.buttons)>0)fulfill.push(`${Number(pricing.buttons)} ${format('Buttons')}`);
   if(Number(pricing.acorns)>0)fulfill.push(`${Number(pricing.acorns)} ${format('Acorns')}`);
   if(fulfill.length)terms.push(`Fulfill ${fulfill.join(' + ')}`);
   if(!terms.length&&pricing.gift)terms.push('gift/free');
 }else if(pricing.gift)terms.push('gift/free');
 return [listing?.title,listing?.description,listing?.fulfillment?.area&&`Area: ${listing.fulfillment.area}`,listing?.fulfillment?.timing&&`Timing: ${listing.fulfillment.timing}`,terms.length&&`Terms: ${terms.join(' · ')}`,GOODS_KINDS.has(kind)&&'Payment is arranged directly with the seller; FellowFare does not collect or route a goods payment.',TOKEN_KINDS.has(kind)&&Number(pricing.usdMinor)>0&&'USD checkout is a direct charge on the provider’s connected Stripe account. FellowFare receives only its application fee and does not route the provider’s sale proceeds.',TOKEN_KINDS.has(kind)&&(Number(pricing.buttons)>0||Number(pricing.acorns)>0)&&'Acorns/Buttons are fulfilled and burned; they are not transferred to the provider.'].filter(Boolean).join('\n');
}
async function shareListing(id){
 const listing=listingById(id);if(!listing)return;
 const text=listingShareText(listing);
 if(navigator.share){try{await navigator.share({title:listing.title,text});return}catch(error){if(error?.name==='AbortError')return}}
 notify(await copyText(text)?'Listing copied for sharing.':'Could not copy this listing on this device.');
}
async function onCapture(event){
 const wallet=event.target.closest?.('[data-ff-copy-wallet]');
 if(wallet){event.preventDefault();event.stopImmediatePropagation();const p=projection();const economy=globalThis.CivweaveFulfillmentEconomyV2||globalThis.CivweaveFulfillmentEconomyV1;const f=economy?.read?.()?.lifetimeFulfilled||{};const text=`FellowFare balances\n${SYMBOLS.button} Buttons: ${Number(p.buttons||0)}\n${SYMBOLS.acorn} Acorns: ${Number(p.acorns||0)}\nSkill XP: ${Number(p.skillXp||0)}\nLifetime fulfilled: ${Number(f.buttons||0)} ${SYMBOLS.button} / ${Number(f.acorns||0)} ${SYMBOLS.acorn}`;notify(await copyText(text)?'Balance diagnostics copied.':'Could not copy diagnostics.');return}
 const share=event.target.closest?.('[data-ff-cap-share]');
 if(share){event.preventDefault();event.stopImmediatePropagation();await shareListing(share.dataset.ffCapShare)}
}
function start(){document.addEventListener('click',onCapture,true)}
const api=Object.freeze({version:'3.1.0-source-truth',symbols:SYMBOLS,format,decorate,listingShareText,postPaintDecoration:false});
globalThis.CivweaveFellowFareCurrencySymbols=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
