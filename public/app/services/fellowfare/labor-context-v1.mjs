import labor from '../../shared/labor-intelligence-core-v1.mjs?v=core-labor-v1';

const VERSION='1.1.0-fellowfare-market-v2';
const LEGACY_KEY='fellowfare.mvp.state.v3';
const MARKET_KEY='fellowfare.marketplace.v2';
const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const legacyState=()=>{const value=parse(localStorage.getItem(LEGACY_KEY),{});return value&&typeof value==='object'?value:{}};
const marketState=()=>{const value=parse(localStorage.getItem(MARKET_KEY),{});return value&&typeof value==='object'?value:{}};
const saveLegacy=value=>localStorage.setItem(LEGACY_KEY,JSON.stringify(value));
const saveMarket=value=>localStorage.setItem(MARKET_KEY,JSON.stringify(value));
function queryForListing(listing={}){return clean([listing.title,listing.description,listing.kind,listing.fulfillment?.quantity,listing.fulfillment?.timing,listing.fulfillment?.area].filter(Boolean).join(' '),12000)}
function queryForThread(thread={}){return clean([thread.title,thread.description,thread.category,thread.quantity,thread.when].filter(Boolean).join(' '),12000)}
function queryForAgreement(agreement={}){return clean([agreement.title,agreement.category,agreement.note,JSON.stringify(agreement.terms||{}),...(agreement.milestones||[]).map(row=>row.title||'')].filter(Boolean).join(' '),12000)}
function toast(message){if(globalThis.CivweaveFellowFareMarketplaceV2&&document.querySelector('#ffv2Toast')){const node=document.querySelector('#ffv2Toast');node.textContent=message;node.hidden=false;setTimeout(()=>node.hidden=true,4200);return}const region=document.querySelector('#toastRegion');if(!region)return;const node=document.createElement('div');node.className='toast';node.textContent=message;region.append(node);setTimeout(()=>node.remove(),4200)}
function post(target,kind,title,payload){if(window.parent===window)return;window.parent.postMessage({type:'civweave:handoff',contractVersion:'civweave.handoff.v1',sourceApplication:'fellowfare',target,kind,title,payload,automaticEffect:false},location.origin)}

export async function enrichListing(listingId){
  const current=marketState(),listing=(current.listings||[]).find(row=>row.id===listingId);if(!listing)return null;
  const query=queryForListing(listing);if(!labor.isLaborQuery(query))return listing;
  const context=await labor.enrichWorkContext(query,{occupationLimit:3,forceOccupations:true});
  listing.laborContext=context;
  listing.normalizedOccupationRefs=(context.occupations||[]).map(row=>row.occupationCode).filter(Boolean);
  listing.normalizedSkillRefs=Array.isArray(context.normalizedSkillRefs)?context.normalizedSkillRefs:[];
  listing.updatedAt=new Date().toISOString();saveMarket(current);
  try{dispatchEvent(new CustomEvent('fellowfare:labor-context-enriched',{detail:{listingId,occupationRefs:listing.normalizedOccupationRefs}}))}catch{}
  return listing;
}
export async function enrichThread(threadId){
  const current=legacyState(),thread=(current.threads||[]).find(row=>row.id===threadId);if(!thread)return null;
  const query=queryForThread(thread);if(!labor.isLaborQuery(query))return thread;
  const context=await labor.enrichWorkContext(query,{occupationLimit:3,forceOccupations:true});
  thread.laborContext=context;thread.normalizedOccupationRefs=(context.occupations||[]).map(row=>row.occupationCode).filter(Boolean);thread.updatedAt=new Date().toISOString();saveLegacy(current);
  try{dispatchEvent(new CustomEvent('fellowfare:labor-context-enriched',{detail:{threadId,occupationRefs:thread.normalizedOccupationRefs}}))}catch{}
  return thread;
}
async function enrichNewestListing(before=[]){const current=marketState(),prior=new Set(before),listing=(current.listings||[]).find(row=>!prior.has(row.id)&&row.ownerId==='me');if(!listing)return null;return enrichListing(listing.id)}
async function enrichNewestThread(before=[]){const current=legacyState(),prior=new Set(before),thread=(current.threads||[]).find(row=>!prior.has(row.id)&&row.ownerId==='me');if(!thread)return null;return enrichThread(thread.id)}

async function handoffWork(id){
  const market=marketState(),legacy=legacyState();
  const arrangement=(market.orders||[]).find(row=>row.id===id),agreement=(legacy.agreements||[]).find(row=>row.id===id),source=arrangement||agreement;if(!source)return;
  const listing=arrangement?(market.listings||[]).find(row=>row.id===arrangement.listingId):null;
  const query=listing?queryForListing(listing):queryForAgreement(source),context=await labor.enrichWorkContext(query,{occupationLimit:3,forceOccupations:true});
  post('cerbanimo','exchange-to-work',`Coordinate · ${source.title||listing?.title||'FellowFare arrangement'}`,{agreement:agreement?{id:agreement.id,title:agreement.title,category:agreement.category,terms:agreement.terms,milestones:agreement.milestones,participants:agreement.participants,status:agreement.status}:null,arrangement:arrangement?{id:arrangement.id,listingId:arrangement.listingId,title:arrangement.title,note:arrangement.note,status:arrangement.status}:null,listing:listing?{id:listing.id,title:listing.title,kind:listing.kind,description:listing.description,fulfillment:listing.fulfillment}:null,laborContext:context,occupationRefs:(context.occupations||[]).map(row=>row.occupationCode).filter(Boolean),authority:{fellowfare:'listing, agreement, settlement, repair',cerbanimo:'work planning, proof, review'},automaticEffect:false});
  toast(context.occupations?.length?'Sent to Cerbanimo with O*NET/ESCO labor context.':'Sent to Cerbanimo. Core labor context is unavailable, so the market text was preserved unchanged.');
}
async function handoffLearning(id){
  const market=marketState(),legacy=legacyState(),listing=(market.listings||[]).find(row=>row.id===id),thread=(legacy.threads||[]).find(row=>row.id===id),source=listing||thread;if(!source)return;
  let context=source.laborContext||null;const query=listing?queryForListing(listing):queryForThread(thread);if(labor.isLaborQuery(query))context=await labor.enrichWorkContext(query,{occupationLimit:3,forceOccupations:true});
  post('living','market-skill-gap',`Learn for · ${source.title}`,{listing:listing?{id:listing.id,kind:listing.kind,mode:listing.mode,title:listing.title,description:listing.description,fulfillment:listing.fulfillment}:null,thread:thread?{id:thread.id,mode:thread.mode,title:thread.title,description:thread.description,category:thread.category}:null,laborContext:context,occupationRefs:(context?.occupations||[]).map(row=>row.occupationCode).filter(Boolean),prompt:`Build the smallest practical learning path that would help someone meet this market need or offer this capability honestly: ${source.title}. Use occupational references only to identify capability/skill coverage, never as procedural authority.`,automaticEffect:false});
  toast(context?.occupations?.length?'Sent to Living School with labor capability context.':'Sent to Living School with the original market context.');
}

let beforeLegacySubmit=[],beforeMarketSubmit=[];
document.addEventListener('submit',event=>{
  if(event.target?.id==='composerForm'){
    beforeLegacySubmit=(legacyState().threads||[]).map(row=>row.id);
    queueMicrotask(()=>enrichNewestThread(beforeLegacySubmit).catch(error=>console.warn('[FellowFare labor context]',error)));
  }
  if(event.target?.id==='ffv2ComposerForm'){
    beforeMarketSubmit=(marketState().listings||[]).map(row=>row.id);
    setTimeout(()=>enrichNewestListing(beforeMarketSubmit).catch(error=>console.warn('[FellowFare labor context v2]',error)),0);
  }
},false);

document.addEventListener('click',event=>{
  const work=event.target.closest?.('[data-handoff-work]'),learning=event.target.closest?.('[data-handoff-learning]');if(!work&&!learning)return;
  event.preventDefault();event.stopImmediatePropagation();const job=work?handoffWork(work.dataset.handoffWork):handoffLearning(learning.dataset.handoffLearning);job.catch(error=>{console.warn('[FellowFare labor handoff]',error);toast('The labor context handoff could not be prepared. Nothing was published or committed.')});
},true);

globalThis.CivweaveFellowFareLaborContextV1=Object.freeze({version:VERSION,enrichListing,enrichThread,handoffWork,handoffLearning,laborContext:marketState,occupationRefs:queryForListing});
