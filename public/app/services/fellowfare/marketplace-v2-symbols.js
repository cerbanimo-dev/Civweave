(()=>{
'use strict';
if(globalThis.CivweaveFellowFareCurrencySymbols)return;

const SYMBOLS=Object.freeze({button:'🔘',acorn:'🌰'});
const REWARD_KEY='civweave.reward-ledger.v2';
const TERM_RE=/\b(Buttons?|Acorns?)\b/gi;
const GOODS_KINDS=new Set(['product','resource']);
const TOKEN_KINDS=new Set(['service','learning','tutoring']);
const clean=(value,max=12000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};

function kindFor(term){return /^button/i.test(term)?'button':'acorn'}
function symbolFor(term){return SYMBOLS[kindFor(term)]}
function format(term){const value=clean(term,40);return value?`${symbolFor(value)} ${value}`:value}

function decorateTextNode(node){
 if(!node?.nodeValue||!TERM_RE.test(node.nodeValue))return;
 TERM_RE.lastIndex=0;
 const parent=node.parentElement;
 if(!parent||parent.closest('.ffv2-currency-label,script,style,textarea,select,option,input'))return;
 const text=node.nodeValue,frag=document.createDocumentFragment();let last=0,match;
 while((match=TERM_RE.exec(text))){
   if(match.index>last)frag.append(document.createTextNode(text.slice(last,match.index)));
   const kind=kindFor(match[0]),wrap=document.createElement('span');
   wrap.className='ffv2-currency-label';wrap.dataset.ffCurrency=kind;
   const icon=document.createElement('span');icon.className='ffv2-currency-symbol';icon.setAttribute('aria-hidden','true');icon.textContent=SYMBOLS[kind];
   const label=document.createElement('span');label.textContent=match[0];
   wrap.append(icon,document.createTextNode(' '),label);frag.append(wrap);last=match.index+match[0].length;
 }
 if(last<text.length)frag.append(document.createTextNode(text.slice(last)));
 node.replaceWith(frag);
}
function decorate(root=document){
 const roots=root===document?[document.querySelector('#main'),...document.querySelectorAll('dialog')]:[root];
 for(const scope of roots.filter(Boolean)){
   const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,{acceptNode(node){
     if(!node.nodeValue?.match(TERM_RE))return NodeFilter.FILTER_REJECT;
     const parent=node.parentElement;if(!parent||parent.closest('.ffv2-currency-label,script,style,textarea,select,option,input'))return NodeFilter.FILTER_REJECT;
     return NodeFilter.FILTER_ACCEPT;
   }});
   const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(decorateTextNode);
 }
}
function projection(){
 try{const value=globalThis.CivweaveCanonicalRewardsV2?.project?.();if(value)return value}catch{}
 const raw=parse(localStorage.getItem(REWARD_KEY),{}),entries=Array.isArray(raw?.entries)?raw.entries:[];
 return entries.reduce((out,row)=>{const amount=Number(row?.amount)||0;if(row?.assetType==='button')out.buttons+=amount;if(row?.assetType==='acorn')out.acorns+=amount;if(row?.assetType==='skill-xp')out.skillXp+=amount;return out},{buttons:0,acorns:0,skillXp:0});
}
async function copyText(text){
 try{await navigator.clipboard.writeText(text);return true}catch{}
 const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();let ok=false;try{ok=document.execCommand('copy')}catch{}area.remove();return ok;
}
function notify(text){let node=document.querySelector('#ffv2CapabilityToast,#ffv2Toast');if(!node){node=document.createElement('div');node.id='ffv2CurrencyToast';node.className='ffv2-toast';document.body.append(node)}node.textContent=text;node.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>node.hidden=true,2600)}
function listingById(id){return globalThis.CivweaveFellowFareMarketplaceV2?.listings?.().find(row=>row?.id===id)||null}
function listingShareText(listing){
 const pricing=listing?.pricing||{},terms=[],kind=clean(listing?.kind,40).toLowerCase();
 if(GOODS_KINDS.has(kind)){
   const seller=listing?.sellerPayment||{};
   if(clean(seller.priceText,120))terms.push(clean(seller.priceText,120));
   if(Array.isArray(seller.methods)&&seller.methods.length)terms.push(`Seller accepts: ${seller.methods.map(x=>clean(x,80)).filter(Boolean).join(', ')}`);
   if(!terms.length)terms.push('Seller-direct payment terms');
 }else if(TOKEN_KINDS.has(kind)){
   const fulfill=[];
   if(Number(pricing.buttons)>0)fulfill.push(`${Number(pricing.buttons)} ${format('Buttons')}`);
   if(Number(pricing.acorns)>0)fulfill.push(`${Number(pricing.acorns)} ${format('Acorns')}`);
   if(fulfill.length)terms.push(`Fulfill ${fulfill.join(' + ')}`);
   else if(pricing.gift)terms.push('gift/free');
 }else{
   if(pricing.gift)terms.push('gift/free');
 }
 return [
   listing?.title,
   listing?.description,
   listing?.fulfillment?.area&&`Area: ${listing.fulfillment.area}`,
   listing?.fulfillment?.timing&&`Timing: ${listing.fulfillment.timing}`,
   terms.length&&`Terms: ${terms.join(' · ')}`,
   GOODS_KINDS.has(kind)&&'Payment is arranged directly with the seller; FellowFare does not collect or route it.',
   TOKEN_KINDS.has(kind)&&'Acorns/Buttons are fulfilled and burned; they are not transferred to the provider.'
 ].filter(Boolean).join('\n');
}
async function shareListing(id){
 const listing=listingById(id);if(!listing)return;
 const text=listingShareText(listing);
 if(navigator.share){try{await navigator.share({title:listing.title,text});return}catch(error){if(error?.name==='AbortError')return}}
 notify(await copyText(text)?'Listing copied for sharing.':'Could not copy this listing on this device.');
}
async function onCapture(event){
 const wallet=event.target.closest?.('[data-ff-copy-wallet]');
 if(wallet){event.preventDefault();event.stopImmediatePropagation();const p=projection();const f=globalThis.CivweaveFulfillmentEconomyV1?.read?.()?.lifetimeFulfilled||{};const text=`FellowFare balances\n${SYMBOLS.button} Buttons: ${Number(p.buttons||0)}\n${SYMBOLS.acorn} Acorns: ${Number(p.acorns||0)}\nSkill XP: ${Number(p.skillXp||0)}\nLifetime fulfilled: ${Number(f.buttons||0)} ${SYMBOLS.button} / ${Number(f.acorns||0)} ${SYMBOLS.acorn}`;notify(await copyText(text)?'Balance diagnostics copied.':'Could not copy diagnostics.');return}
 const share=event.target.closest?.('[data-ff-cap-share]');
 if(share){event.preventDefault();event.stopImmediatePropagation();await shareListing(share.dataset.ffCapShare);}
}
const observer=new MutationObserver(()=>requestAnimationFrame(()=>decorate()));
function start(){document.addEventListener('click',onCapture,true);observer.observe(document.body,{childList:true,subtree:true});addEventListener('hashchange',()=>requestAnimationFrame(()=>decorate()));addEventListener('fellowfare:marketplace-changed',()=>requestAnimationFrame(()=>decorate()));decorate()}
const api=Object.freeze({version:'2.0.0-fulfillment',symbols:SYMBOLS,format,decorate,listingShareText});
globalThis.CivweaveFellowFareCurrencySymbols=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
