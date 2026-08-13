(()=>{
'use strict';
const LEGACY_KEY='fellowfare.mvp.state.v3';
const MARKET_KEY='fellowfare.marketplace.v2';
const DRAFT_KEY='civweave.fellowfare.listing-drafts.v1';
const PENDING_KEY='civweave.fellowfare.pending-threads.v1';
const DEMO_TITLES=new Set([
  'Pickup truck and hauling help',
  'Reclaimed windows for greenhouse build',
  'Weekly local bread buying circle',
  'Two hours of household reset help',
  'Shared workshop space one evening a week',
  'Flyer and one-page web design',
  'Friday bread circle',
  'North Country maker room'
]);
const DEMO_PEOPLE=new Set(['Mara Velez','Jules Chen','Noah Adebayo','Tess Morgan','River Patel']);
const DEMO_IDS=new Set(['t1','t2','t3','t4','t5','t6','a1','a2','pr1','pr2','ag1','m1','m2','m3','ev1','ev2']);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clean=value=>String(value??'').trim();
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const demoTitle=row=>DEMO_TITLES.has(clean(row?.title));
const demoId=row=>DEMO_IDS.has(clean(row?.id))||DEMO_IDS.has(clean(row?.legacyId))||DEMO_IDS.has(clean(row?.source?.sourceId));
const seedProfile=profile=>{
  if(!profile||typeof profile!=='object'||profile.userEdited===true||profile.source)return false;
  const trust=profile.trust||{};
  const exactIdentity=clean(profile.name)==='Cami'&&clean(profile.area)==='Watertown, NY'&&clean(profile.bio)==='Builder, designer, organizer, and neighbor.';
  const exactCounters=Number(profile.credits)===24&&Number(profile.completed)===17;
  const exactTrust=Number(trust.communication)===92&&Number(trust.reliability)===88&&Number(trust.quality)===90&&Number(trust.repair)===96;
  return exactIdentity&&(exactCounters||exactTrust);
};
function filterRows(rows,predicate){return Array.isArray(rows)?rows.filter(row=>!predicate(row)):rows}
function scrubLegacy(){
  const legacy=parse(localStorage.getItem(LEGACY_KEY),null);if(!legacy||typeof legacy!=='object')return false;
  const before=JSON.stringify(legacy);
  legacy.threads=filterRows(legacy.threads,row=>demoTitle(row)||demoId(row));
  legacy.assemblies=filterRows(legacy.assemblies,row=>demoTitle(row)||demoId(row));
  legacy.agreements=filterRows(legacy.agreements,row=>demoTitle(row)||demoId(row));
  legacy.proposals=filterRows(legacy.proposals,row=>demoId(row)||DEMO_IDS.has(clean(row?.threadId)));
  legacy.messages=filterRows(legacy.messages,row=>demoId(row));
  legacy.activity=filterRows(legacy.activity,row=>demoId(row));
  legacy.people=filterRows(legacy.people,row=>DEMO_PEOPLE.has(clean(row?.name))&&(demoId(row)||!row?.source));
  if(seedProfile(legacy.profile)){
    const settings=legacy.profile?.settings&&typeof legacy.profile.settings==='object'?legacy.profile.settings:{};
    legacy.profile={id:'me',name:'',area:'',bio:'',initials:'',trust:{},settings};
  }
  legacy.migrations={...(legacy.migrations||{}),fellowfareLiveDataPreflightV3At:new Date().toISOString()};
  if(JSON.stringify(legacy)!==before){write(LEGACY_KEY,legacy);return true}
  return false;
}
function scrubMarket(){
  const market=parse(localStorage.getItem(MARKET_KEY),null);if(!market||typeof market!=='object')return false;
  const before=JSON.stringify(market);
  market.listings=filterRows(market.listings,row=>demoTitle(row)||demoId(row));
  market.orders=filterRows(market.orders,row=>demoTitle(row)||demoId(row)||DEMO_IDS.has(clean(row?.listingId)));
  if(seedProfile(market.profile))market.profile={id:'me',name:'',area:'',bio:'',userEdited:false};
  market.migration={...(market.migration||{}),liveDataPreflightV3At:new Date().toISOString()};
  if(JSON.stringify(market)!==before){write(MARKET_KEY,market);return true}
  return false;
}
function scrubQueue(key){
  const rows=parse(localStorage.getItem(key),null);if(!Array.isArray(rows))return false;
  const next=rows.filter(row=>!demoTitle(row)&&!demoId(row));
  if(next.length===rows.length)return false;write(key,next);return true;
}
const changed=[scrubLegacy(),scrubMarket(),scrubQueue(DRAFT_KEY),scrubQueue(PENDING_KEY)].some(Boolean);
if(changed)dispatchEvent(new CustomEvent('fellowfare:demo-data-scrubbed',{detail:{version:3}}));
globalThis.CivweaveFellowFareLiveDataPreflightV3=Object.freeze({version:3,scrub(){return[scrubLegacy(),scrubMarket(),scrubQueue(DRAFT_KEY),scrubQueue(PENDING_KEY)].some(Boolean)}});
})();
