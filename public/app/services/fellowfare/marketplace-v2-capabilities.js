(()=>{
'use strict';
if(globalThis.CivweaveFellowFareMarketplaceCapabilities)return;
const MARKET_KEY='fellowfare.marketplace.v2';
const REWARD_KEY='civweave.reward-ledger.v2';
const RECEIPT_KEY='civweave.cerbanimo-commerce-receipts.v1';
const clean=(value,max=4000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const api=()=>globalThis.CivweaveFellowFareMarketplaceV2;
function notify(text){
 let node=document.querySelector('#ffv2CapabilityToast');
 if(!node){node=document.createElement('div');node.id='ffv2CapabilityToast';node.className='ffv2-toast';document.body.append(node)}
 node.textContent=clean(text,300);node.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>node.hidden=true,2800);
}
async function copyText(text){
 const value=clean(text,12000);if(!value)return false;
 try{await navigator.clipboard.writeText(value);return true}catch{}
 const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();let ok=false;try{ok=document.execCommand('copy')}catch{}area.remove();return ok;
}
function download(name,payload){
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function listingById(id){return api()?.listings?.().find(row=>row.id===id)||null}
function listingShareText(listing){
 const pricing=listing?.pricing||{},terms=[];
 if(Number(pricing.usdMinor)>0)terms.push(`$${(Number(pricing.usdMinor)/100).toFixed(2)}`);
 if(Number(pricing.buttons)>0)terms.push(`${Number(pricing.buttons)} Buttons`);
 if(Number(pricing.acorns)>0)terms.push(`${Number(pricing.acorns)} Acorns`);
 if(pricing.barter)terms.push('barter');if(pricing.gift)terms.push('gift/free');
 return [listing?.title,listing?.description,listing?.fulfillment?.area&&`Area: ${listing.fulfillment.area}`,listing?.fulfillment?.timing&&`Timing: ${listing.fulfillment.timing}`,terms.length&&`Terms: ${terms.join(' · ')}`].filter(Boolean).join('\n');
}
async function shareListing(id){
 const listing=listingById(id);if(!listing){notify('That listing is no longer available.');return}
 const text=listingShareText(listing);
 if(navigator.share){try{await navigator.share({title:listing.title,text});return}catch(error){if(error?.name==='AbortError')return}}
 const ok=await copyText(text);notify(ok?'Listing copied for sharing.':'Could not copy this listing on this device.');
}
function marketState(){const state=parse(localStorage.getItem(MARKET_KEY),{});return state&&typeof state==='object'?state:{}}
function saveMarket(state,reason){state.updatedAt=now();localStorage.setItem(MARKET_KEY,JSON.stringify(state));dispatchEvent(new CustomEvent('fellowfare:marketplace-changed',{detail:{reason,updatedAt:state.updatedAt}}));api()?.render?.();}
function updateOrder(id,status){
 const state=marketState(),rows=Array.isArray(state.orders)?state.orders:[],order=rows.find(row=>row?.id===id);if(!order){notify('This arrangement is read-only or no longer exists.');return false}
 const prior=clean(order.status,60)||'pending';order.status=status;order.updatedAt=now();order.statusHistory=Array.isArray(order.statusHistory)?order.statusHistory:[];order.statusHistory.push({from:prior,to:status,at:order.updatedAt,actor:'me'});saveMarket(state,'arrangement-status');notify(`Arrangement marked ${status.replace(/-/g,' ')}.`);return true;
}
function orderActionButtons(order){
 const status=clean(order.status,60).toLowerCase();
 if(['completed','closed','cancelled','settled'].includes(status))return`<button type="button" class="quiet" data-ff-order-copy="${clean(order.id,220)}">Copy record</button>`;
 if(['pending','proposed'].includes(status))return`<button type="button" data-ff-order-action="in-progress" data-ff-order-id="${clean(order.id,220)}">Start work</button><button type="button" class="quiet" data-ff-order-action="cancelled" data-ff-order-id="${clean(order.id,220)}">Cancel</button><button type="button" class="quiet" data-ff-order-copy="${clean(order.id,220)}">Copy terms</button>`;
 if(['in-progress','in_progress','active','accepted'].includes(status))return`<button type="button" data-ff-order-action="fulfilled" data-ff-order-id="${clean(order.id,220)}">Mark fulfilled</button><button type="button" class="quiet" data-ff-order-action="cancelled" data-ff-order-id="${clean(order.id,220)}">Cancel</button><button type="button" class="quiet" data-ff-order-copy="${clean(order.id,220)}">Copy terms</button>`;
 if(status==='fulfilled')return`<button type="button" data-ff-order-action="completed" data-ff-order-id="${clean(order.id,220)}">Mark complete</button><button type="button" class="quiet" data-ff-order-copy="${clean(order.id,220)}">Copy record</button>`;
 return`<button type="button" class="quiet" data-ff-order-copy="${clean(order.id,220)}">Copy record</button>`;
}
function enhanceListings(){
 for(const card of document.querySelectorAll('.ffv2-listing[data-listing-id]')){
   const id=card.dataset.listingId;if(!id||card.querySelector('[data-ff-cap-share]'))continue;
   const actions=card.querySelector('.ffv2-card-actions');if(!actions)continue;
   const button=document.createElement('button');button.type='button';button.className='quiet';button.dataset.ffCapShare=id;button.textContent='Share';actions.append(button);
 }
}
function enhanceHeaders(){
 const route=document.body.dataset.ffRoute||location.hash.slice(1);
 const actions=document.querySelector('.ffv2-head-actions');if(!actions)return;
 if(['market','loom'].includes(route)&&!actions.querySelector('[data-ff-need-shortcut]')){
   const button=document.createElement('button');button.type='button';button.dataset.ffNeedShortcut='true';button.className='ffv2-secondary-action';button.textContent='List a need';actions.append(button);
 }
}
function enhanceOrders(){
 const state=marketState(),orders=Array.isArray(state.orders)?state.orders:[],unmatched=new Set(orders.map(row=>row.id));
 for(const card of document.querySelectorAll('.ffv2-order')){
   if(card.querySelector('.ffv2-live-order-actions'))continue;
   const title=clean(card.querySelector('h3')?.textContent,180),status=clean(card.querySelector('.ffv2-status')?.textContent,60).toLowerCase();
   const order=orders.find(row=>unmatched.has(row.id)&&clean(row.title,180)===title&&clean(row.status||'pending',60).toLowerCase()===status);
   if(!order)continue;unmatched.delete(order.id);card.dataset.ffOrderId=order.id;
   const actions=document.createElement('div');actions.className='ffv2-card-actions ffv2-live-order-actions';actions.innerHTML=orderActionButtons(order);card.append(actions);
 }
}
function rewardSnapshot(){
 let projection=null;try{projection=globalThis.CivweaveCanonicalRewardsV2?.project?.()||null}catch{}
 return{projection,ledger:parse(localStorage.getItem(REWARD_KEY),{}),commerceReceipts:parse(localStorage.getItem(RECEIPT_KEY),{}),marketplace:marketState(),exportedAt:now()};
}
function enhanceWallet(){
 if((document.body.dataset.ffRoute||location.hash.slice(1))!=='inbox')return;
 const panel=document.querySelector('.ffv2-money-panel');if(!panel||panel.querySelector('[data-ff-export-wallet]'))return;
 const actions=document.createElement('div');actions.className='ffv2-live-wallet-actions';actions.innerHTML='<button type="button" data-ff-export-wallet>Download ledger snapshot</button><button type="button" data-ff-copy-wallet>Copy balance diagnostics</button>';panel.append(actions);
}
function profileShareText(){
 const state=marketState(),p=state.profile||{},stats={listings:(state.listings||[]).length,open:(state.listings||[]).filter(row=>!['closed','completed','cancelled'].includes(clean(row?.status,60).toLowerCase())).length};
 return [p.name||'FellowFare profile',p.bio,p.area&&`Area: ${p.area}`,`${stats.open} open listing${stats.open===1?'':'s'}`].filter(Boolean).join('\n');
}
function enhanceProfile(){
 if((document.body.dataset.ffRoute||location.hash.slice(1))!=='profile')return;
 const form=document.querySelector('#ffv2ProfileForm .ffv2-form-actions');if(!form||form.querySelector('[data-ff-share-profile]'))return;
 const button=document.createElement('button');button.type='button';button.dataset.ffShareProfile='true';button.textContent='Share profile summary';form.append(button);
}
function enhance(){enhanceHeaders();enhanceListings();enhanceOrders();enhanceWallet();enhanceProfile()}
async function copyOrder(id){const order=(marketState().orders||[]).find(row=>row?.id===id);if(!order)return notify('Arrangement not found.');const text=[order.title,`Status: ${order.status||'pending'}`,order.note,`Created: ${order.createdAt||''}`].filter(Boolean).join('\n');notify(await copyText(text)?'Arrangement copied.':'Could not copy this arrangement.');}
async function handleClick(event){
 const share=event.target.closest?.('[data-ff-cap-share]');if(share){event.preventDefault();await shareListing(share.dataset.ffCapShare);return}
 if(event.target.closest?.('[data-ff-need-shortcut]')){event.preventDefault();api()?.openComposer?.('need');return}
 const action=event.target.closest?.('[data-ff-order-action]');if(action){event.preventDefault();updateOrder(action.dataset.ffOrderId,action.dataset.ffOrderAction);return}
 const copy=event.target.closest?.('[data-ff-order-copy]');if(copy){event.preventDefault();await copyOrder(copy.dataset.ffOrderCopy);return}
 if(event.target.closest?.('[data-ff-export-wallet]')){event.preventDefault();download(`fellowfare-ledger-${new Date().toISOString().slice(0,10)}.json`,rewardSnapshot());return}
 if(event.target.closest?.('[data-ff-copy-wallet]')){event.preventDefault();const snap=rewardSnapshot(),p=snap.projection||{};const text=`FellowFare balances\nButtons: ${Number(p.buttons||0)}\nAcorns: ${Number(p.acorns||0)}\nSkill XP: ${Number(p.skillXp||0)}\nCommerce receipts: ${Array.isArray(snap.commerceReceipts)?snap.commerceReceipts.length:Array.isArray(snap.commerceReceipts?.receipts)?snap.commerceReceipts.receipts.length:0}`;notify(await copyText(text)?'Balance diagnostics copied.':'Could not copy diagnostics.');return}
 if(event.target.closest?.('[data-ff-share-profile]')){event.preventDefault();const text=profileShareText();if(navigator.share){try{await navigator.share({title:'FellowFare profile',text});return}catch(error){if(error?.name==='AbortError')return}}notify(await copyText(text)?'Profile summary copied.':'Could not copy profile summary.');}
}
const observer=new MutationObserver(()=>requestAnimationFrame(enhance));
function start(){document.addEventListener('click',handleClick);observer.observe(document.querySelector('#main')||document.body,{childList:true,subtree:true});addEventListener('hashchange',()=>requestAnimationFrame(enhance));addEventListener('fellowfare:marketplace-changed',()=>requestAnimationFrame(enhance));enhance()}
globalThis.CivweaveFellowFareMarketplaceCapabilities=Object.freeze({version:'1.0.0',enhance,rewardSnapshot,updateOrder,shareListing});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
