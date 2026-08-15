(()=>{
'use strict';
if(globalThis.CivweaveFellowFareValueGuideV1)return;
const MARKET_KEY='fellowfare.marketplace.v2';
const DRAFT_KEY='civweave.fellowfare.listing-drafts.v1';
const GUIDE=()=>globalThis.CivweaveBasicValueV1;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let pendingValuation=null,enhancing=false;
function currentRoute(){return document.body.dataset.ffRoute||location.hash.slice(1)||'market'}
function state(){const value=parse(localStorage.getItem(MARKET_KEY),{});return value&&typeof value==='object'?value:{}}
function notifyMarketplaceStorage(newValue){
 try{dispatchEvent(new StorageEvent('storage',{key:MARKET_KEY,newValue,storageArea:localStorage,url:location.href}));return}catch{}
 try{const event=new Event('storage');Object.defineProperty(event,'key',{value:MARKET_KEY});Object.defineProperty(event,'newValue',{value:newValue});dispatchEvent(event)}catch{}
}
function rawCandidates(){
 const rows=[];
 const queued=parse(localStorage.getItem(DRAFT_KEY),[]);if(Array.isArray(queued))rows.push(...queued);
 const cerb=parse(localStorage.getItem('cerbanimo-pocket-constellary-v0.6'),{}),living=parse(localStorage.getItem('living-academy-v19-state'),{});
 for(const list of [cerb?.products,cerb?.services,cerb?.outcomes,cerb?.projects,living?.modules,living?.learningModules,living?.courses,living?.curricula])if(Array.isArray(list))rows.push(...list);
 return rows.filter(Boolean);
}
function candidate(id){const wanted=clean(id,220);return rawCandidates().find(row=>clean(row?.id||row?.draftId||row?.sourceId,220)===wanted)||null}
function baseline(kind,input={}){return GUIDE()?.baselineFor?.(kind,input)||{hours:0,buttons:0,acorns:0,basis:''}}
function baselineText(kind,input={}){
 const g=GUIDE(),b=baseline(kind,input),parts=[];
 if(b.buttons>0){const rate=num(b.wageRateButtonsPerHour||g?.guide?.labor?.wageButtonsPerHour||5);parts.push(`${g?.formatButtons?.(b.buttons)||`${b.buttons} 🔘 Buttons`} wage${rate?` at ${rate} 🔘/h`:''}`)}
 if(b.acorns>0)parts.push(g?.formatAcorns?.(b.acorns)||`${b.acorns} 🌰 Acorns`);
 if(kind==='learning'&&!parts.length)parts.push('50–500 🌰 Acorns');
 if(!parts.length)return b.hours>0?'No wage/value currency applies to this type.':'Add or import human-equivalent labor hours to calculate the shared wage/value reference.';
 return `${parts.join(' · ')}${b.hours>0?` from ${Number(b.hours.toFixed(2))} human-equivalent hour${b.hours===1?'':'s'}`:''}`;
}
function renderGuide(){
 if(currentRoute()!=='loom')return;
 const priceDesk=document.querySelector('.ffv2-rook-price');if(!priceDesk||document.querySelector('#ffv2BasicValueGuide'))return;
 const rows=GUIDE()?.chartRows?.()||[];
 const html=`<section id="ffv2BasicValueGuide" class="ffv2-value-guide" aria-labelledby="ffv2ValueGuideTitle"><div class="ffv2-section-head"><div><p class="ffv2-eyebrow">SHARED BASIC VALUE GUIDE</p><h2 id="ffv2ValueGuideTitle">Starting wage first. Market second.</h2></div></div><p class="ffv2-value-intro">Civweave uses one starting Button wage for everybody: 5 🔘 per human-equivalent labor hour. Models estimate hours, not rank-based rates. Learning and education keep their separate, more granular Acorn price scale. Live comparables may inform an asking price, but they never rewrite the worker wage rate or imply a Button/Acorn exchange rate.</p><div class="ffv2-value-table" role="table" aria-label="Civweave basic value guide">${rows.map(row=>`<article role="row"><strong role="cell">${esc(row.label)}</strong><b role="cell">${esc(row.value)}</b><small role="cell">${esc(row.note)}</small></article>`).join('')}</div></section>`;
 priceDesk.insertAdjacentHTML('beforebegin',html);
 const heading=priceDesk.querySelector('h2');if(heading)heading.textContent='Compare non-wage market terms with the live market.';
 const copy=priceDesk.querySelector('#ffv2PriceAdvice')||priceDesk.querySelector('p:not(.ffv2-eyebrow)');if(copy&&/only calculate|invent a market/i.test(copy.textContent))copy.textContent='Live comparables are the market layer. They can inform an asking price but never change the shared labor wage, and Rook still will not invent market evidence.';
}
function ensureComposerLabor(){
 const form=document.querySelector('#ffv2ComposerForm');if(!form||form.querySelector('[name="laborWorthHours"]'))return;
 const pricing=form.querySelector('.ffv2-grid-3');if(!pricing)return;
 const block=document.createElement('div');block.className='ffv2-value-composer';block.innerHTML='<label><span>Human-equivalent labor hours</span><input name="laborWorthHours" type="number" min="0" step="0.25" inputmode="decimal" placeholder="Model/task estimate"></label><div class="ffv2-value-baseline" id="ffv2ValueComposerBaseline"></div><button type="button" class="quiet" data-use-basic-value>Use wage/value suggestion</button>';
 pricing.insertAdjacentElement('afterend',block);updateComposer(form);
}
function draftHours(form){
 const id=clean(form?.elements?.draftId?.value,220),row=id?candidate(id):null;
 return GUIDE()?.sumLaborHours?.(row)||0;
}
function updateComposer(form){
 if(!form)return;const field=form.elements.laborWorthHours;if(!field)return;
 if(!num(field.value)){const hours=draftHours(form);if(hours>0)field.value=String(hours)}
 const kind=clean(form.elements.kind?.value,40),hours=Math.max(0,num(field.value));
 const box=form.querySelector('#ffv2ValueComposerBaseline');if(box)box.innerHTML=`<strong>Shared wage/value:</strong> ${esc(baselineText(kind,{hours,recommendedAcorns:candidate(clean(form.elements.draftId?.value,220))?.curriculumAcorns}))}<small>${hours?'Automation speed, title, seniority, prestige, and bargaining power do not alter the 5 🔘/h labor wage.':'Cerbanimo/Living School model-generated tasks carry the hours estimate automatically; you can also enter or revise it here.'}</small>`;
}
function applyBaseline(form){
 const kind=clean(form.elements.kind?.value,40),hours=Math.max(0,num(form.elements.laborWorthHours?.value)),raw=candidate(clean(form.elements.draftId?.value,220)),b=baseline(kind,{hours,recommendedAcorns:raw?.curriculumAcorns||raw?.valuation?.curriculumAcorns});
 if(['product','service','resource'].includes(kind)&&b.buttons>0)form.elements.buttons.value=String(b.buttons);
 else if(['tutoring','learning'].includes(kind)&&b.acorns>0)form.elements.acorns.value=String(b.acorns);
 updateComposer(form);
}
function decorateDrafts(){
 for(const card of document.querySelectorAll('.ffv2-draft-card[data-use-draft]')){
   if(card.querySelector('.ffv2-draft-baseline'))continue;const row=candidate(card.dataset.useDraft),hours=GUIDE()?.sumLaborHours?.(row)||0;if(!hours)continue;
   const kind=clean(row?.kind||row?.listingKind||row?.outcomeType||row?.type,40).toLowerCase()||(/living/i.test(clean(row?.sourceSystem||row?._draftSource,80))?'learning':'service');
   const small=document.createElement('small');small.className='ffv2-draft-baseline';small.textContent=`Shared wage/value: ${baselineText(kind,{hours,recommendedAcorns:row?.curriculumAcorns||row?.valuation?.curriculumAcorns})}`;card.append(small);
 }
}
function decorateListings(){
 const rows=state().listings||[];
 for(const card of document.querySelectorAll('.ffv2-listing[data-listing-id]')){
   if(card.querySelector('.ffv2-saved-baseline'))continue;const row=rows.find(item=>item?.id===card.dataset.listingId),valuation=row?.valuation;if(!valuation)continue;
   const b=valuation.baseline||baseline(row.kind,{hours:valuation.laborWorthHours,recommendedAcorns:valuation.curriculumAcorns});
   if(!(b.buttons>0||b.acorns>0))continue;const node=document.createElement('div');node.className='ffv2-saved-baseline';node.textContent=`Shared value: ${baselineText(row.kind,{hours:valuation.laborWorthHours,recommendedAcorns:valuation.curriculumAcorns})}`;card.querySelector('.ffv2-price')?.insertAdjacentElement('afterend',node);
 }
}
function savePublishedValuation(){
 if(!pendingValuation)return;const market=state(),listing=Array.isArray(market.listings)?market.listings[0]:null;if(!listing){pendingValuation=null;return}
 const matches=!pendingValuation.title||clean(listing.title,180)===pendingValuation.title;if(!matches)return;
 const b=baseline(listing.kind,{hours:pendingValuation.laborWorthHours,recommendedAcorns:pendingValuation.curriculumAcorns});listing.valuation={schema:'civweave.basic-value-estimate.v1',laborWorthHours:pendingValuation.laborWorthHours||0,curriculumAcorns:pendingValuation.curriculumAcorns||0,baseline:b,source:pendingValuation.source||'composer',updatedAt:new Date().toISOString()};market.updatedAt=new Date().toISOString();const serialized=JSON.stringify(market);localStorage.setItem(MARKET_KEY,serialized);notifyMarketplaceStorage(serialized);pendingValuation=null;requestAnimationFrame(()=>globalThis.CivweaveFellowFareMarketplaceV2?.render?.(currentRoute()));
}
function enhance(){if(enhancing)return;enhancing=true;requestAnimationFrame(()=>{try{renderGuide();ensureComposerLabor();decorateDrafts();decorateListings();const form=document.querySelector('#ffv2ComposerForm');if(form?.open||form?.closest('dialog')?.open)updateComposer(form)}finally{enhancing=false}})}
function clicks(event){
 const draft=event.target.closest?.('[data-use-draft]');if(draft)setTimeout(()=>{ensureComposerLabor();const form=document.querySelector('#ffv2ComposerForm'),row=candidate(draft.dataset.useDraft),hours=GUIDE()?.sumLaborHours?.(row)||0;if(form&&hours>0){form.elements.laborWorthHours.value=String(hours);updateComposer(form)}},0);
 const use=event.target.closest?.('[data-use-basic-value]');if(use){event.preventDefault();applyBaseline(use.closest('form'));}
}
function changes(event){if(event.target?.closest?.('#ffv2ComposerForm')&&['kind','laborWorthHours'].includes(event.target.name))updateComposer(event.target.form)}
function submits(event){
 if(event.target.id!=='ffv2ComposerForm')return;const form=event.target,hours=Math.max(0,num(form.elements.laborWorthHours?.value)),raw=candidate(clean(form.elements.draftId?.value,220));pendingValuation={title:clean(form.elements.title?.value,180),laborWorthHours:hours,curriculumAcorns:num(raw?.curriculumAcorns||raw?.valuation?.curriculumAcorns),source:raw?'cross-realm-model':'composer'};
}
function start(){document.addEventListener('click',clicks);document.addEventListener('input',changes);document.addEventListener('change',changes);document.addEventListener('submit',submits,true);addEventListener('hashchange',enhance);addEventListener('fellowfare:marketplace-changed',event=>{if(event.detail?.reason==='listing-published')savePublishedValuation();enhance()});new MutationObserver(enhance).observe(document.querySelector('#main')||document.body,{childList:true,subtree:true});enhance()}
const api=Object.freeze({version:'1.2.0',enhance,baselineText});globalThis.CivweaveFellowFareValueGuideV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
