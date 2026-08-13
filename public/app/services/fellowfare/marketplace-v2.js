(()=>{
'use strict';
if(globalThis.CivweaveFellowFareMarketplaceV2)return;

const VERSION='2.0.0-live-market';
const SCHEMA='fellowfare.marketplace.v2';
const LISTING_SCHEMA='fellowfare.listing.v2';
const STORE_KEY='fellowfare.marketplace.v2';
const DRAFT_KEY='civweave.fellowfare.listing-drafts.v1';
const LEGACY_KEY='fellowfare.mvp.state.v3';
const COMMERCE_RECEIPTS_KEY='civweave.cerbanimo-commerce-receipts.v1';
const MONEY_EDGE='https://civweave-core.cerbanimo.workers.dev';
const ROUTES=['market','loom','assemblies','inbox','profile'];
const KINDS=['product','service','learning','tutoring','resource','request','collective'];
const KIND_LABELS={product:'Product',service:'Service',learning:'Learning module',tutoring:'Tutoring',resource:'Material / resource',request:'Need / request',collective:'Collective'};
const ACTIVE_STATUSES=new Set(['open','active','forming','assembling','pending','accepted','in-progress','in_progress']);
const now=()=>new Date().toISOString();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const copy=value=>JSON.parse(JSON.stringify(value));
const clean=(value,max=4000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const moneyMinor=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?`$${(Number(value)/100).toFixed(2)}`:'';
const uid=prefix=>`${prefix}:${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const storageEvent=detail=>dispatchEvent(new CustomEvent('fellowfare:marketplace-changed',{detail}));

const DEMO_THREADS=new Map([
 ['t1','Pickup truck and hauling help'],['t2','Reclaimed windows for greenhouse build'],['t3','Weekly local bread buying circle'],
 ['t4','Two hours of household reset help'],['t5','Shared workshop space one evening a week'],['t6','Flyer and one-page web design']
]);
const DEMO_PEOPLE=new Map([['p1','Mara Velez'],['p2','Jules Chen'],['p3','Noah Adebayo'],['p4','Tess Morgan'],['p5','River Patel']]);
const DEMO_ASSEMBLIES=new Map([['a1','Friday bread circle'],['a2','North Country maker room']]);
const DEMO_PROPOSALS=new Set(['pr1','pr2']);
const DEMO_MESSAGES=new Set(['m1','m2','m3']);
const DEMO_ACTIVITY=new Set(['ev1','ev2']);

function blankState(){return{schema:SCHEMA,version:2,profile:{id:'me',name:'',area:'',bio:'',userEdited:false},listings:[],orders:[],settings:{marketRadius:'',showClosed:false},migration:{},updatedAt:now()}}
function readState(){const raw=parse(localStorage.getItem(STORE_KEY),null);if(raw?.schema===SCHEMA)return{...blankState(),...raw,profile:{...blankState().profile,...(raw.profile||{})},listings:Array.isArray(raw.listings)?raw.listings:[],orders:Array.isArray(raw.orders)?raw.orders:[],migration:{...(raw.migration||{})}};return blankState()}
function saveState(reason='update') {state.updatedAt=now();localStorage.setItem(STORE_KEY,JSON.stringify(state));storageEvent({reason,updatedAt:state.updatedAt});return state}

function looksLikeSeedProfile(profile){
 if(!profile||profile.userEdited||profile.source||profile.updatedAt)return false;
 const trust=profile.trust||{};
 return profile.name==='Cami'&&profile.area==='Watertown, NY'&&profile.bio==='Builder, designer, organizer, and neighbor.'&&Number(profile.credits)===24&&Number(profile.completed)===17&&Number(trust.communication)===92&&Number(trust.reliability)===88&&Number(trust.quality)===90&&Number(trust.repair)===96;
}
function scrubLegacyDemoState(){
 const legacy=parse(localStorage.getItem(LEGACY_KEY),null);if(!legacy||typeof legacy!=='object')return false;
 let changed=false;
 const filterExact=(rows,matcher)=>Array.isArray(rows)?rows.filter(row=>{const remove=matcher(row);if(remove)changed=true;return!remove}):rows;
 legacy.people=filterExact(legacy.people,row=>DEMO_PEOPLE.get(row?.id)===row?.name);
 legacy.threads=filterExact(legacy.threads,row=>DEMO_THREADS.get(row?.id)===row?.title);
 legacy.proposals=filterExact(legacy.proposals,row=>DEMO_PROPOSALS.has(row?.id)&&['t2','t3'].includes(row?.threadId));
 legacy.agreements=filterExact(legacy.agreements,row=>row?.id==='ag1'&&row?.title==='Weekly local bread buying circle');
 legacy.assemblies=filterExact(legacy.assemblies,row=>DEMO_ASSEMBLIES.get(row?.id)===row?.title);
 legacy.messages=filterExact(legacy.messages,row=>DEMO_MESSAGES.has(row?.id));
 legacy.activity=filterExact(legacy.activity,row=>DEMO_ACTIVITY.has(row?.id));
 if(looksLikeSeedProfile(legacy.profile)){
   const preservedSettings=legacy.profile?.settings&&typeof legacy.profile.settings==='object'?legacy.profile.settings:{};
   legacy.profile={id:'me',name:'',area:'',bio:'',initials:'',trust:{},settings:preservedSettings};changed=true;
 }
 if(changed){legacy.migrations={...(legacy.migrations||{}),fellowfareMarketplaceV2SeedScrubbedAt:now()};localStorage.setItem(LEGACY_KEY,JSON.stringify(legacy));}
 return changed;
}

let state=readState();
if(!state.migration?.legacySeedScrubbedAt){const changed=scrubLegacyDemoState();state.migration.legacySeedScrubbedAt=now();state.migration.legacySeedRecordsRemoved=Boolean(changed);saveState('legacy-seed-scrub')}

function legacyState(){return parse(localStorage.getItem(LEGACY_KEY),{})||{}}
function legacyKind(thread){
 if(thread?.mode==='need')return'request';
 if(thread?.mode==='collective')return'collective';
 const category=clean(thread?.category,80).toLowerCase();
 if(/service|work|repair|transport/.test(category))return'service';
 if(/learning|teach|tutor/.test(category))return'tutoring';
 return'resource';
}
function normalizeLegacyThread(thread){
 const numeric=Number(thread?.amount);
 const amountMinor=Number.isFinite(numeric)&&numeric>0?Math.round(numeric*100):0;
 return{schema:LISTING_SCHEMA,id:`legacy:${clean(thread?.id,180)}`,legacyId:clean(thread?.id,180),kind:legacyKind(thread),mode:thread?.mode==='need'?'need':'offer',title:clean(thread?.title,180)||'Untitled listing',description:clean(thread?.description,2400),pricing:{usdMinor:amountMinor,buttons:0,acorns:0,gift:Array.isArray(thread?.methods)&&thread.methods.includes('Gift'),barter:Array.isArray(thread?.methods)&&thread.methods.includes('Barter'),legacyLabel:clean(thread?.amountLabel,100)},fulfillment:{area:clean(thread?.area,160),timing:clean(thread?.when,160),quantity:clean(thread?.quantity,160),partial:Boolean(thread?.partial)},source:{system:'fellowfare',sourceId:clean(thread?.id,180),legacy:true},ownerId:clean(thread?.ownerId,180)||'unknown',status:clean(thread?.status,80)||'open',createdAt:thread?.createdAt||'',updatedAt:thread?.updatedAt||thread?.createdAt||''};
}
function allListings(){
 const own=(state.listings||[]).filter(Boolean).map(row=>({...row,source:{system:'fellowfare',...(row.source||{})}}));
 const seen=new Set(own.map(row=>row.source?.sourceId||row.legacyId).filter(Boolean));
 const legacy=(legacyState().threads||[]).filter(row=>row&&DEMO_THREADS.get(row.id)!==row.title&&!seen.has(row.id)).map(normalizeLegacyThread);
 return[...own,...legacy].sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
}
function profile(){
 if(state.profile?.userEdited)return state.profile;
 const legacy=legacyState().profile||{};
 if(legacy.userEdited||legacy.source||legacy.updatedAt)return{id:'me',name:clean(legacy.name,120),area:clean(legacy.area,160),bio:clean(legacy.bio,400),userEdited:true};
 return state.profile;
}
function rewardProjection(){
 try{const projection=globalThis.CivweaveCanonicalRewardsV2?.project?.();if(projection)return projection}catch{}
 const raw=parse(localStorage.getItem('civweave.reward-ledger.v2'),{}),entries=Array.isArray(raw?.entries)?raw.entries:[];
 return entries.reduce((out,row)=>{const amount=Number(row?.amount)||0;if(row?.assetType==='acorn')out.acorns+=amount;if(row?.assetType==='button')out.buttons+=amount;if(row?.assetType==='skill-xp')out.skillXp+=amount;return out},{acorns:0,buttons:0,skillXp:0,entries});
}
function commerceReceipts(){const raw=parse(localStorage.getItem(COMMERCE_RECEIPTS_KEY),{});return Array.isArray(raw)?raw:Array.isArray(raw?.receipts)?raw.receipts:[]}
function draftRows(){const rows=parse(localStorage.getItem(DRAFT_KEY),[]);return Array.isArray(rows)?rows.filter(Boolean):[]}
function explicitFlag(row){return Boolean(row?.readyForSale||row?.readyForMarket||row?.marketplaceDraft||row?.marketDraft||row?.publishToFellowfare||row?.fellowfareListingDraft||row?.commerce?.readyForSale)}
function crossRealmCandidates(){
 const rows=[...draftRows().map(row=>({...row,_draftSource:'queue'}))];
 const cerb=parse(localStorage.getItem('cerbanimo-pocket-constellary-v0.6'),{}),living=parse(localStorage.getItem('living-academy-v19-state'),{});
 const add=(source,items)=>{for(const row of Array.isArray(items)?items:[]){if(row&&explicitFlag(row))rows.push({...row,_draftSource:source})}};
 add('cerbanimo',cerb?.products);add('cerbanimo',cerb?.services);add('cerbanimo',cerb?.outcomes);add('cerbanimo',cerb?.projects);
 add('living',living?.modules);add('living',living?.learningModules);add('living',living?.courses);add('living',living?.curricula);
 const seen=new Set();
 return rows.map((row,index)=>{
   const id=clean(row?.id||row?.draftId||row?.sourceId||`${row._draftSource||'draft'}:${index}`,200);
   if(seen.has(id))return null;seen.add(id);
   let kind=clean(row?.kind||row?.listingKind||row?.outcomeType||row?.type,40).toLowerCase();
   if(row?._draftSource==='living'&&!['learning','tutoring'].includes(kind))kind='learning';
   if(!KINDS.includes(kind))kind='resource';
   return{id,title:clean(row?.title||row?.name||row?.subject,180)||'Untitled market draft',description:clean(row?.description||row?.summary||row?.intent,2000),kind,sourceSystem:clean(row?.sourceSystem||row?._draftSource||'civweave',80),sourceId:clean(row?.sourceId||row?.id,180),endeavorId:clean(row?.endeavorId||row?.projectId||row?.questId,180),pricing:row?.pricing||row?.price||{},raw:row};
 }).filter(Boolean);
}
function active(listing){return !listing?.status||ACTIVE_STATUSES.has(clean(listing.status,50).toLowerCase())}
function ownListing(listing){return listing?.ownerId==='me'}
function formatPrice(listing){
 const p=listing?.pricing||{},parts=[];
 if(Number(p.usdMinor)>0)parts.push(moneyMinor(Number(p.usdMinor)));
 if(Number(p.buttons)>0)parts.push(`${Number(p.buttons)} Buttons`);
 if(Number(p.acorns)>0)parts.push(`${Number(p.acorns)} Acorns`);
 if(p.gift)parts.push('Gift');if(p.barter)parts.push('Barter');
 if(!parts.length&&p.legacyLabel)parts.push(clean(p.legacyLabel,80));
 return parts.length?parts.join(' · '):'Terms not priced yet';
}
function sourceLabel(listing){const s=listing?.source?.system||'fellowfare';return({cerbanimo:'Cerbanimo',living:'Living School','node-ai':'Node AI',fellowfare:'FellowFare'})[s]||s}
function marketStats(){const listings=allListings().filter(active),receipts=commerceReceipts();return{active:listings.length,offers:listings.filter(row=>row.mode!=='need').length,requests:listings.filter(row=>row.mode==='need'||row.kind==='request').length,sales:receipts.filter(row=>/settled|completed|paid|success/i.test(clean(row?.status,80))||row?.distribution).length}}
function notify(text){let node=document.querySelector('#ffv2Toast');if(!node){node=document.createElement('div');node.id='ffv2Toast';node.className='ffv2-toast';document.body.append(node)}node.textContent=clean(text,300);node.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>node.hidden=true,3200)}

const main=document.querySelector('#main');
function routeName(){const hash=location.hash.slice(1);return ROUTES.includes(hash)?hash:'market'}
function routeTo(route){const next=ROUTES.includes(route)?route:'market';if(location.hash!==`#${next}`)history.replaceState(null,'',`#${next}`);render(next);window.scrollTo({top:0,behavior:'smooth'})}

function renderShellTitle(eyebrow,title,body,actions=''){return`<header class="ffv2-page-head"><div><p class="ffv2-eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1><p>${esc(body)}</p></div>${actions?`<div class="ffv2-head-actions">${actions}</div>`:''}</header>`}
function metric(label,value,note=''){return`<article class="ffv2-metric"><strong>${esc(value)}</strong><span>${esc(label)}</span>${note?`<small>${esc(note)}</small>`:''}</article>`}
function emptyState(title,body,action=''){return`<section class="ffv2-empty"><span aria-hidden="true">◇</span><h2>${esc(title)}</h2><p>${esc(body)}</p>${action}</section>`}
function listingCard(listing){
 const p=formatPrice(listing),kind=KIND_LABELS[listing.kind]||'Listing',mine=ownListing(listing),status=clean(listing.status||'open',60);
 return`<article class="ffv2-listing" data-listing-id="${esc(listing.id)}">
   <div class="ffv2-listing-top"><div><span class="ffv2-chip">${esc(kind)}</span><span class="ffv2-source">${esc(sourceLabel(listing))}</span></div><span class="ffv2-status">${esc(status)}</span></div>
   <h3>${esc(listing.title)}</h3><p>${esc(listing.description||'No description supplied.')}</p>
   <div class="ffv2-price">${esc(p)}</div>
   <dl class="ffv2-meta"><div><dt>Where</dt><dd>${esc(listing.fulfillment?.area||'Not specified')}</dd></div><div><dt>When</dt><dd>${esc(listing.fulfillment?.timing||'Flexible / not specified')}</dd></div></dl>
   <div class="ffv2-card-actions">${mine?`<button type="button" data-close-listing="${esc(listing.id)}">${active(listing)?'Close listing':'Closed'}</button>`:`<button type="button" data-arrange-listing="${esc(listing.id)}">Start arrangement</button>`}<button type="button" class="quiet" data-view-listing="${esc(listing.id)}">Details</button></div>
 </article>`;
}

function renderMarket(){
 const stats=marketStats(),rewards=rewardProjection(),listings=allListings().filter(row=>state.settings.showClosed||active(row));
 main.innerHTML=`${renderShellTitle('FELLOWFARE MARKET','The market that is actually here.','Products, services, learning, tutoring, materials, needs, and collective work. Every card below comes from stored or explicitly shared data.','<button type="button" class="ffv2-primary" data-open-composer="offer">List something</button>')}
 <section class="ffv2-metrics" aria-label="Live market totals">${metric('active listings',stats.active)}${metric('offers',stats.offers)}${metric('open requests',stats.requests)}${metric('recorded commerce receipts',commerceReceipts().length)}</section>
 <section class="ffv2-toolbar"><label class="ffv2-search"><span>Search</span><input id="ffv2Search" type="search" placeholder="Search actual listings"></label><label><span>Type</span><select id="ffv2Kind"><option value="all">Everything</option>${KINDS.map(kind=>`<option value="${kind}">${esc(KIND_LABELS[kind])}</option>`).join('')}</select></label><label class="ffv2-check"><input id="ffv2Closed" type="checkbox" ${state.settings.showClosed?'checked':''}><span>Show closed</span></label></section>
 <section class="ffv2-wallet-strip"><div><small>Your canonical balances</small><strong>${Number(rewards.buttons||0).toLocaleString()} Buttons · ${Number(rewards.acorns||0).toLocaleString()} Acorns</strong></div><button type="button" data-route-jump="inbox">Open wallet</button></section>
 <section><div class="ffv2-section-head"><div><p class="ffv2-eyebrow">DISCOVERY</p><h2>Available now</h2></div><p id="ffv2ResultCount">${listings.length} listing${listings.length===1?'':'s'}</p></div><div id="ffv2ListingGrid" class="ffv2-listing-grid">${listings.length?listings.map(listingCard).join(''):emptyState('No listings loaded','Nothing is being padded out with sample inventory. Create a listing, import a reviewed handoff, or connect to real marketplace data to populate this screen.','<button type="button" data-open-composer="offer">Create the first listing</button>')}</div></section>
 <section class="ffv2-node-card"><div><p class="ffv2-eyebrow">NODE SERVICES</p><h2>AI compute is a node market, not fake inventory.</h2><p>Node AI services are discovered from signed node advertisements and keep their own balances and pricing. Open Finder to see what is currently reachable.</p></div><button type="button" data-open-node-ai>Open Node Finder</button></section>`;
 bindMarketFilters(listings);
}
function bindMarketFilters(rows){
 const search=document.querySelector('#ffv2Search'),kind=document.querySelector('#ffv2Kind'),grid=document.querySelector('#ffv2ListingGrid'),count=document.querySelector('#ffv2ResultCount');
 const update=()=>{const q=clean(search?.value,200).toLowerCase(),k=kind?.value||'all';const filtered=rows.filter(row=>(k==='all'||row.kind===k)&&(!q||[row.title,row.description,row.fulfillment?.area,KIND_LABELS[row.kind],sourceLabel(row)].join(' ').toLowerCase().includes(q)));grid.innerHTML=filtered.length?filtered.map(listingCard).join(''):emptyState('No matching listings','The loaded market has no records matching these filters.');count.textContent=`${filtered.length} listing${filtered.length===1?'':'s'}`};
 search?.addEventListener('input',update);kind?.addEventListener('change',update);document.querySelector('#ffv2Closed')?.addEventListener('change',event=>{state.settings.showClosed=event.target.checked;saveState('show-closed');renderMarket()});
}

function median(values){const nums=values.map(Number).filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b);if(!nums.length)return 0;const m=Math.floor(nums.length/2);return nums.length%2?nums[m]:Math.round((nums[m-1]+nums[m])/2)}
function comparableSuggestion(kind,excludeId=''){const rows=allListings().filter(row=>active(row)&&row.kind===kind&&row.id!==excludeId),usd=median(rows.map(row=>row.pricing?.usdMinor)),buttons=median(rows.map(row=>row.pricing?.buttons)),acorns=median(rows.map(row=>row.pricing?.acorns));return{count:rows.length,usd,buttons,acorns}}
function candidateCard(draft){return`<button type="button" class="ffv2-draft-card" data-use-draft="${esc(draft.id)}"><span>${esc(KIND_LABELS[draft.kind]||draft.kind)}</span><strong>${esc(draft.title)}</strong><small>${esc(draft.sourceSystem)} · explicitly marked for market use</small></button>`}
function renderSell(){
 const candidates=crossRealmCandidates();
 main.innerHTML=`${renderShellTitle('SELL WITH ROOK','Turn real work into a real listing.','Products, repeatable services, learning modules, tutoring, materials, needs, and collective asks all belong here. Publishing requires an explicit human action.','<button type="button" class="ffv2-primary" data-open-composer="offer">New listing</button>')}
 <section class="ffv2-policy-grid"><article><span>PRODUCTS</span><h2>Finished things for sale</h2><p>When linked to a Cerbanimo endeavor, sale distribution follows vested contribution weights. The listed USD amount remains the contributor payout base.</p></article><article><span>SERVICES</span><h2>Repeatable work packages</h2><p>Service delivery can preserve the current 10% origin/template royalty while the delivery pool goes to the people doing the sold instance.</p></article><article><span>LEARNING</span><h2>Modules + tutoring</h2><p>Learning modules can be priced in Acorns. Tutoring can use Buttons, USD, barter, or combinations chosen by the seller.</p></article></section>
 <section class="ffv2-rook-price"><div><p class="ffv2-eyebrow">ROOK'S PRICE DESK</p><h2>Price from comparables, or say we cannot.</h2><p id="ffv2PriceAdvice">Choose a listing type. Rook will only calculate from actual loaded comparables and will not invent a market rate.</p></div><label><span>Compare</span><select id="ffv2CompareKind">${KINDS.filter(k=>!['request','collective'].includes(k)).map(k=>`<option value="${k}">${esc(KIND_LABELS[k])}</option>`).join('')}</select></label></section>
 <section><div class="ffv2-section-head"><div><p class="ffv2-eyebrow">READY FROM OTHER REALMS</p><h2>Reviewed market drafts</h2></div><span>${candidates.length}</span></div>${candidates.length?`<div class="ffv2-draft-grid">${candidates.map(candidateCard).join('')}</div>`:emptyState('No cross-realm sale drafts','Cerbanimo or Living School records appear here only when they are explicitly marked ready for FellowFare. Ordinary projects and learning records are never silently advertised.')}</section>`;
 const select=document.querySelector('#ffv2CompareKind'),advice=document.querySelector('#ffv2PriceAdvice');const update=()=>{const s=comparableSuggestion(select.value);const parts=[];if(s.usd)parts.push(moneyMinor(s.usd));if(s.buttons)parts.push(`${s.buttons} Buttons`);if(s.acorns)parts.push(`${s.acorns} Acorns`);advice.textContent=s.count?`${s.count} loaded comparable${s.count===1?'':'s'}. Median observed terms: ${parts.length?parts.join(' · '):'none of those comparables has numeric pricing yet'}.`:'No live comparables are loaded for this type. Rook will not invent a market price.'};select.addEventListener('change',update);update();
}

function orderRows(){
 const rows=[];
 for(const order of state.orders||[])rows.push({id:order.id,type:'order',title:order.title||'Arrangement',status:order.status||'pending',detail:order.note||'',updatedAt:order.updatedAt||order.createdAt||'',source:'FellowFare v2'});
 const legacy=legacyState();
 for(const row of legacy.proposals||[])rows.push({id:`proposal:${row.id}`,type:'proposal',title:allListings().find(x=>x.legacyId===row.threadId)?.title||'Exchange proposal',status:row.status||'pending',detail:row.message||'',updatedAt:row.updatedAt||row.createdAt||'',source:'Legacy exchange'});
 for(const row of legacy.agreements||[])rows.push({id:`agreement:${row.id}`,type:'agreement',title:row.title||'Agreement',status:row.status||'active',detail:row.terms?.scope||'',updatedAt:row.updatedAt||row.createdAt||'',source:'Exchange ledger'});
 for(const row of legacy.assemblies||[])rows.push({id:`assembly:${row.id}`,type:'assembly',title:row.title||'Assembly',status:row.status||'forming',detail:Array.isArray(row.commitments)?`${row.commitments.length} recorded commitment${row.commitments.length===1?'':'s'}`:'',updatedAt:row.updatedAt||row.createdAt||'',source:'Collective exchange'});
 return rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
function orderCard(row){return`<article class="ffv2-order"><div><span class="ffv2-chip">${esc(row.type)}</span><span class="ffv2-status">${esc(row.status)}</span></div><h3>${esc(row.title)}</h3><p>${esc(row.detail||'No additional detail recorded.')}</p><small>${esc(row.source)}</small></article>`}
function renderOrders(){const rows=orderRows(),activeRows=rows.filter(row=>!/(complete|completed|closed|cancelled|settled)/i.test(row.status)),done=rows.filter(row=>!activeRows.includes(row));main.innerHTML=`${renderShellTitle('ARRANGEMENTS','From listing to fulfilled exchange.','Orders, proposals, agreements, collective assemblies, evidence, settlement, and repair belong in one lifecycle instead of five disconnected demos.')}
 <section class="ffv2-metrics">${metric('needs action',activeRows.filter(row=>/(pending|proposed|review|required)/i.test(row.status)).length)}${metric('in progress',activeRows.length)}${metric('completed / closed',done.length)}${metric('commerce receipts',commerceReceipts().length)}</section>
 <section><div class="ffv2-section-head"><div><p class="ffv2-eyebrow">CURRENT</p><h2>Active arrangements</h2></div><span>${activeRows.length}</span></div>${activeRows.length?`<div class="ffv2-order-grid">${activeRows.map(orderCard).join('')}</div>`:emptyState('Nothing is in motion','Accepted proposals, buyer arrangements, collective commitments, and agreements will appear here when they actually exist.')}</section>
 ${done.length?`<section><div class="ffv2-section-head"><div><p class="ffv2-eyebrow">HISTORY</p><h2>Completed and closed</h2></div><span>${done.length}</span></div><div class="ffv2-order-grid">${done.map(orderCard).join('')}</div></section>`:''}`}

let moneyStatus={state:'idle',data:null,error:''};
async function refreshMoneyStatus(){moneyStatus={state:'loading',data:null,error:''};renderMoneyStatusNode();try{const response=await fetch(`${MONEY_EDGE}/api/money-edge/status`,{cache:'no-store',headers:{accept:'application/json'}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(clean(data?.error,300)||`Money edge returned ${response.status}`);moneyStatus={state:'ready',data,error:''}}catch(error){moneyStatus={state:'error',data:null,error:clean(error.message,300)}}renderMoneyStatusNode()}
function renderMoneyStatusNode(){const node=document.querySelector('#ffv2MoneyStatus');if(!node)return;if(moneyStatus.state==='loading'){node.innerHTML='<strong>Checking Cloudflare money authority…</strong><span>No payment readiness is being assumed.</span>';return}if(moneyStatus.state==='error'){node.innerHTML=`<strong>Money authority unavailable from this device</strong><span>${esc(moneyStatus.error||'Unable to fetch status.')}</span>`;return}if(moneyStatus.state==='ready'){const d=moneyStatus.data||{},live=Boolean(d.live?.enabled??d.liveEnabled??d.enabled);node.innerHTML=`<strong>${live?'Live money enabled by authority':'Live money is not enabled'}</strong><span>Authority responded successfully. ${live?'Transactions still follow the current human and Stripe gates.':'FellowFare will not pretend USD checkout is available.'}</span>`;return}node.innerHTML='<strong>Status not checked yet</strong><span>Open or refresh this page to query the canonical money authority.</span>'}
function receiptCard(row){const distribution=row?.distribution||row;const saleType=clean(distribution?.saleType||row?.saleType,30)||'commerce';const amount=Number(distribution?.saleAmountMinor||row?.saleAmountMinor||0);return`<article class="ffv2-receipt"><span>${esc(saleType)}</span><strong>${amount?esc(moneyMinor(amount)):'Recorded commerce event'}</strong><small>${esc(row?.createdAt||distribution?.createdAt||'No timestamp')}</small></article>`}
function renderWallet(){const rewards=rewardProjection(),receipts=commerceReceipts();main.innerHTML=`${renderShellTitle('WALLET + SETTLEMENT','Only balances and rails we can actually verify.','Buttons and Acorns come from the canonical reward ledger. USD readiness comes from the money authority, not a decorative balance.')}
 <section class="ffv2-balance-grid"><article><span>BUTTONS</span><strong>${Number(rewards.buttons||0).toLocaleString()}</strong><small>Canonical reward ledger</small></article><article><span>ACORNS</span><strong>${Number(rewards.acorns||0).toLocaleString()}</strong><small>Canonical reward ledger</small></article><article><span>SKILL XP</span><strong>${Number(rewards.skillXp||0).toLocaleString()}</strong><small>Across canonical skill receipts</small></article></section>
 <section class="ffv2-money-panel"><div><p class="ffv2-eyebrow">USD PAYMENT RAIL</p><h2>Cloudflare money authority</h2><div id="ffv2MoneyStatus" class="ffv2-money-status"></div></div><button type="button" data-refresh-money>Refresh status</button></section>
 <section class="ffv2-policy-note"><h2>Current commerce rules</h2><p><strong>Product:</strong> the listed USD amount is the contributor payout base and follows vested Cerbanimo contribution weights when the listing carries an endeavor link.</p><p><strong>Service:</strong> the current default is a 10% origin/template royalty and 90% delivery pool when eligible origin contributors exist.</p><p><strong>Fee:</strong> the current Cerbanimo commerce split fee is 1% added on top of the listed USD price, not taken out of contributor payout.</p><p><strong>Annual reserve:</strong> direct product/service sales remain separate from the December 1 AI-reserve distribution.</p></section>
 <section><div class="ffv2-section-head"><div><p class="ffv2-eyebrow">RECEIPTS</p><h2>Recorded commerce</h2></div><span>${receipts.length}</span></div>${receipts.length?`<div class="ffv2-receipt-grid">${receipts.map(receiptCard).join('')}</div>`:emptyState('No commerce receipts on this device','FellowFare will not display fictional sales, earnings, or payout history.')}</section>`;renderMoneyStatusNode();if(moneyStatus.state==='idle')refreshMoneyStatus();}

function ownStats(){const listings=allListings().filter(ownListing),orders=state.orders||[];return{listings:listings.length,open:listings.filter(active).length,orders:orders.length}}
function renderProfile(){const p=profile(),stats=ownStats();main.innerHTML=`${renderShellTitle('YOUR MARKET IDENTITY','Portable where it is real. Empty where it is not.','Profile fields are user-supplied. FellowFare no longer creates a fake reputation score, location, completed-cycle count, or credit balance.')}
 <section class="ffv2-profile-card"><div class="ffv2-avatar">${esc((p.name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'?')}</div><div><h2>${esc(p.name||'No marketplace name set')}</h2><p>${esc(p.bio||'No marketplace bio set.')}</p><small>${esc(p.area||'No area set')}</small></div></section>
 <section class="ffv2-metrics">${metric('your listings',stats.listings)}${metric('open now',stats.open)}${metric('v2 arrangements',stats.orders)}${metric('commerce receipts',commerceReceipts().length)}</section>
 <form id="ffv2ProfileForm" class="ffv2-form"><div class="ffv2-section-head"><div><p class="ffv2-eyebrow">PROFILE</p><h2>Edit marketplace identity</h2></div></div><label><span>Name</span><input name="name" maxlength="120" value="${esc(p.name||'')}"></label><label><span>Area</span><input name="area" maxlength="160" value="${esc(p.area||'')}" placeholder="Optional city, region, remote, or delivery area"></label><label class="wide"><span>Bio</span><textarea name="bio" maxlength="400" rows="4">${esc(p.bio||'')}</textarea></label><div class="ffv2-form-actions wide"><button type="submit" class="ffv2-primary">Save profile</button><button type="button" data-export-market>Export my FellowFare data</button><label class="ffv2-import"><span>Import FellowFare v2 data</span><input type="file" data-import-market accept="application/json,.json"></label></div></form>
 <section class="ffv2-trust-empty"><p class="ffv2-eyebrow">CONTEXTUAL TRUST</p><h2>No score without evidence.</h2><p>Reviews and fulfillment evidence can be summarized here when they exist. A fresh profile starts blank rather than at a flattering invented percentage.</p></section>`}

function render(route=routeName()){
 document.body.dataset.ffRoute=route;
 document.querySelectorAll('[data-route]').forEach(button=>{button.classList.toggle('is-active',button.dataset.route===route);button.toggleAttribute('aria-current',button.dataset.route===route)});
 if(route==='market')renderMarket();else if(route==='loom')renderSell();else if(route==='assemblies')renderOrders();else if(route==='inbox')renderWallet();else renderProfile();
}

function normalizePricing(input={}){const usd=Number(input.usdMinor??input.usd??0),buttons=Number(input.buttons||0),acorns=Number(input.acorns||0);return{usdMinor:Number.isFinite(usd)?Math.max(0,Math.round(usd)):0,buttons:Number.isFinite(buttons)?Math.max(0,buttons):0,acorns:Number.isFinite(acorns)?Math.max(0,acorns):0,gift:Boolean(input.gift),barter:Boolean(input.barter)}}
function normalizeListing(input={}){
 const kind=KINDS.includes(clean(input.kind,40).toLowerCase())?clean(input.kind,40).toLowerCase():'resource';
 const mode=kind==='request'?'need':clean(input.mode,20)==='need'?'need':'offer';
 const title=clean(input.title,180);if(!title)throw new Error('A listing title is required.');
 return{schema:LISTING_SCHEMA,id:clean(input.id,220)||uid('listing'),kind,mode,title,description:clean(input.description,2400),pricing:normalizePricing(input.pricing),fulfillment:{area:clean(input.fulfillment?.area||input.area,160),timing:clean(input.fulfillment?.timing||input.timing,160),quantity:clean(input.fulfillment?.quantity||input.quantity,160),partial:Boolean(input.fulfillment?.partial??input.partial)},source:{system:clean(input.source?.system||input.sourceSystem||'fellowfare',80),sourceId:clean(input.source?.sourceId||input.sourceId,180)||null,endeavorId:clean(input.source?.endeavorId||input.endeavorId,180)||null},commerce:['product','service'].includes(kind)?{saleType:kind,serviceOriginRoyaltyBps:kind==='service'?1000:0,splitFeeBps:100}:null,ownerId:clean(input.ownerId,180)||'me',status:clean(input.status,60)||'open',createdAt:input.createdAt||now(),updatedAt:now()};
}
function publishListing(input){const listing=normalizeListing(input);state.listings.unshift(listing);saveState('listing-published');render(routeName());return listing}
function enqueueDraft(input){const rows=draftRows(),draft={...copy(input),draftId:clean(input?.draftId||input?.id,180)||uid('draft'),marketplaceDraft:true,createdAt:input?.createdAt||now()};rows.unshift(draft);localStorage.setItem(DRAFT_KEY,JSON.stringify(rows.slice(0,500)));storageEvent({reason:'draft-enqueued',draftId:draft.draftId});return draft}
function closeListing(id){const listing=state.listings.find(row=>row.id===id);if(!listing)return false;listing.status='closed';listing.updatedAt=now();saveState('listing-closed');render(routeName());return true}
function startArrangement(listingId,note=''){const listing=allListings().find(row=>row.id===listingId);if(!listing)throw new Error('Listing not found.');const order={schema:'fellowfare.arrangement.v2',id:uid('arrangement'),listingId:listing.id,title:listing.title,note:clean(note,1200),status:'pending',createdAt:now(),updatedAt:now(),counterpartyOwnerId:listing.ownerId||'unknown'};state.orders.unshift(order);saveState('arrangement-started');return order}

function ensureDialogs(){if(document.querySelector('#ffv2Composer'))return;document.body.insertAdjacentHTML('beforeend',`<dialog id="ffv2Composer" class="ffv2-dialog"><form method="dialog" id="ffv2ComposerForm" class="ffv2-dialog-card"><header><div><p class="ffv2-eyebrow">NEW LISTING</p><h2>Put something real on FellowFare</h2></div><button value="cancel" class="ffv2-icon" aria-label="Close">×</button></header><div class="ffv2-dialog-body"><input type="hidden" name="draftId"><div class="ffv2-grid-2"><label><span>Type</span><select name="kind">${KINDS.map(k=>`<option value="${k}">${esc(KIND_LABELS[k])}</option>`).join('')}</select></label><label><span>Side</span><select name="mode"><option value="offer">I offer this</option><option value="need">I need this</option></select></label></div><label><span>Title</span><input name="title" maxlength="180" required></label><label><span>Description</span><textarea name="description" rows="4" maxlength="2400"></textarea></label><div class="ffv2-grid-3"><label><span>USD price</span><input name="usd" type="number" min="0" step="0.01" placeholder="0.00"></label><label><span>Buttons</span><input name="buttons" type="number" min="0" step="0.01"></label><label><span>Acorns</span><input name="acorns" type="number" min="0" step="0.01"></label></div><div class="ffv2-grid-2"><label><span>Area / delivery</span><input name="area" maxlength="160"></label><label><span>Timing</span><input name="timing" maxlength="160"></label></div><label><span>Quantity / scope</span><input name="quantity" maxlength="160"></label><div class="ffv2-check-row"><label><input type="checkbox" name="gift"><span>Gift / free</span></label><label><input type="checkbox" name="barter"><span>Barter welcome</span></label><label><input type="checkbox" name="partial"><span>Partial fulfillment helps</span></label></div><div id="ffv2ComposerAdvice" class="ffv2-advice"></div><button type="submit" value="publish" class="ffv2-primary">Publish listing</button></div></form></dialog><dialog id="ffv2Detail" class="ffv2-dialog"><article class="ffv2-dialog-card" id="ffv2DetailBody"></article></dialog><dialog id="ffv2Arrange" class="ffv2-dialog"><form method="dialog" id="ffv2ArrangeForm" class="ffv2-dialog-card"><header><div><p class="ffv2-eyebrow">ARRANGEMENT</p><h2 id="ffv2ArrangeTitle">Start arrangement</h2></div><button value="cancel" class="ffv2-icon" aria-label="Close">×</button></header><div class="ffv2-dialog-body"><input type="hidden" name="listingId"><label><span>Message / terms to carry forward</span><textarea name="note" rows="5" maxlength="1200" placeholder="What would you like to arrange?"></textarea></label><p class="ffv2-advice">This creates a pending local arrangement. It does not pay, accept terms for another person, or claim the seller agreed.</p><button type="submit" value="start" class="ffv2-primary">Create pending arrangement</button></div></form></dialog>`)}
function updateComposerAdvice(form){const kind=form.elements.kind.value,s=comparableSuggestion(kind),advice=document.querySelector('#ffv2ComposerAdvice'),parts=[];if(s.usd)parts.push(moneyMinor(s.usd));if(s.buttons)parts.push(`${s.buttons} Buttons`);if(s.acorns)parts.push(`${s.acorns} Acorns`);advice.textContent=s.count?`Rook found ${s.count} actual comparable${s.count===1?'':'s'}. Median observed terms: ${parts.length?parts.join(' · '):'no numeric prices were recorded'}.`:'No live comparables loaded. Rook will not invent a price.'}
function openComposer(mode='offer',draft=null){ensureDialogs();const dialog=document.querySelector('#ffv2Composer'),form=document.querySelector('#ffv2ComposerForm');form.reset();form.elements.mode.value=['need','offer'].includes(mode)?mode:'offer';if(mode==='need')form.elements.kind.value='request';if(draft){form.elements.draftId.value=draft.id||'';form.elements.kind.value=KINDS.includes(draft.kind)?draft.kind:'resource';form.elements.mode.value=draft.kind==='request'?'need':'offer';form.elements.title.value=draft.title||'';form.elements.description.value=draft.description||'';const pricing=draft.pricing||{};const usdMinor=Number(pricing.usdMinor??pricing.amountMinor??0);form.elements.usd.value=usdMinor?String(usdMinor/100):'';form.elements.buttons.value=Number(pricing.buttons||0)||'';form.elements.acorns.value=Number(pricing.acorns||0)||'';form.dataset.sourceSystem=draft.sourceSystem||'';form.dataset.sourceId=draft.sourceId||'';form.dataset.endeavorId=draft.endeavorId||''}else{delete form.dataset.sourceSystem;delete form.dataset.sourceId;delete form.dataset.endeavorId}updateComposerAdvice(form);dialog.showModal()}
function viewListing(id){const listing=allListings().find(row=>row.id===id);if(!listing)return;ensureDialogs();const body=document.querySelector('#ffv2DetailBody');body.innerHTML=`<header><div><p class="ffv2-eyebrow">${esc(KIND_LABELS[listing.kind]||'LISTING')} · ${esc(sourceLabel(listing))}</p><h2>${esc(listing.title)}</h2></div><button type="button" class="ffv2-icon" data-close-detail aria-label="Close">×</button></header><div class="ffv2-dialog-body"><p>${esc(listing.description||'No description supplied.')}</p><div class="ffv2-price big">${esc(formatPrice(listing))}</div><dl class="ffv2-detail-list"><div><dt>Area</dt><dd>${esc(listing.fulfillment?.area||'Not specified')}</dd></div><div><dt>Timing</dt><dd>${esc(listing.fulfillment?.timing||'Not specified')}</dd></div><div><dt>Quantity / scope</dt><dd>${esc(listing.fulfillment?.quantity||'Not specified')}</dd></div><div><dt>Source</dt><dd>${esc(sourceLabel(listing))}</dd></div></dl>${listing.commerce?`<div class="ffv2-advice">${listing.kind==='service'?'Service policy: current default 10% origin/template royalty when eligible, with the rest assigned to delivery contributors.':'Product policy: listed sale proceeds follow vested source-contribution weights when an endeavor is linked.'} Current USD split fee: 1% added on top.</div>`:''}</div>`;document.querySelector('#ffv2Detail').showModal()}
function openArrangement(id){const listing=allListings().find(row=>row.id===id);if(!listing)return;ensureDialogs();const dialog=document.querySelector('#ffv2Arrange'),form=document.querySelector('#ffv2ArrangeForm');form.reset();form.elements.listingId.value=id;document.querySelector('#ffv2ArrangeTitle').textContent=`Arrange: ${listing.title}`;dialog.showModal()}

function exportData(){const payload={schema:SCHEMA,exportedAt:now(),state,legacyExchange:legacyState(),commerceReceipts:commerceReceipts(),rewardProjection:rewardProjection()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`fellowfare-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function importData(file){const text=await file.text(),payload=parse(text,null);if(!payload||payload.schema!==SCHEMA||!payload.state||payload.state.schema!==SCHEMA)throw new Error('This is not a FellowFare marketplace v2 export.');const incoming=payload.state;state={...blankState(),...incoming,profile:{...blankState().profile,...(incoming.profile||{})},listings:Array.isArray(incoming.listings)?incoming.listings.map(normalizeListing):[],orders:Array.isArray(incoming.orders)?incoming.orders:[],migration:{...(incoming.migration||{})},updatedAt:now()};saveState('import');render(routeName())}

function onClick(event){
 const route=event.target.closest?.('[data-route]')?.dataset.route;if(route){event.preventDefault();routeTo(route);return}
 const jump=event.target.closest?.('[data-route-jump]')?.dataset.routeJump;if(jump){routeTo(jump);return}
 const open=event.target.closest?.('[data-open-composer]');if(open){openComposer(open.dataset.openComposer||'offer');return}
 const draftId=event.target.closest?.('[data-use-draft]')?.dataset.useDraft;if(draftId){const draft=crossRealmCandidates().find(row=>row.id===draftId);if(draft)openComposer('offer',draft);return}
 const closeId=event.target.closest?.('[data-close-listing]')?.dataset.closeListing;if(closeId){closeListing(closeId);notify('Listing closed.');return}
 const arrangeId=event.target.closest?.('[data-arrange-listing]')?.dataset.arrangeListing;if(arrangeId){openArrangement(arrangeId);return}
 const viewId=event.target.closest?.('[data-view-listing]')?.dataset.viewListing;if(viewId){viewListing(viewId);return}
 if(event.target.closest?.('[data-close-detail]')){document.querySelector('#ffv2Detail')?.close();return}
 if(event.target.closest?.('[data-refresh-money]')){refreshMoneyStatus();return}
 if(event.target.closest?.('[data-export-market]')){exportData();return}
 if(event.target.closest?.('[data-open-node-ai]')){try{window.top.location.href='/finder'}catch{location.href='/finder'}return}
}
function onSubmit(event){
 if(event.target.id==='ffv2ComposerForm'){
   event.preventDefault();const form=event.target,fd=new FormData(form),kind=clean(fd.get('kind'),40),usd=Math.round(Math.max(0,Number(fd.get('usd'))||0)*100);publishListing({kind,mode:fd.get('mode'),title:fd.get('title'),description:fd.get('description'),pricing:{usdMinor:usd,buttons:Number(fd.get('buttons'))||0,acorns:Number(fd.get('acorns'))||0,gift:fd.get('gift')==='on',barter:fd.get('barter')==='on'},fulfillment:{area:fd.get('area'),timing:fd.get('timing'),quantity:fd.get('quantity'),partial:fd.get('partial')==='on'},source:{system:form.dataset.sourceSystem||'fellowfare',sourceId:form.dataset.sourceId||null,endeavorId:form.dataset.endeavorId||null},ownerId:'me'});form.closest('dialog').close();notify('Listing published from real user/source data.');return;
 }
 if(event.target.id==='ffv2ArrangeForm'){event.preventDefault();const fd=new FormData(event.target);startArrangement(clean(fd.get('listingId'),220),fd.get('note'));event.target.closest('dialog').close();notify('Pending arrangement created. Nothing was accepted or paid automatically.');routeTo('assemblies');return}
 if(event.target.id==='ffv2ProfileForm'){event.preventDefault();const fd=new FormData(event.target);state.profile={id:'me',name:clean(fd.get('name'),120),area:clean(fd.get('area'),160),bio:clean(fd.get('bio'),400),userEdited:true,updatedAt:now()};saveState('profile-saved');notify('Marketplace profile saved.');renderProfile();return}
}
function onChange(event){if(event.target?.closest('#ffv2ComposerForm')&&event.target.name==='kind')updateComposerAdvice(event.target.form);if(event.target?.matches('[data-import-market]')&&event.target.files?.[0])importData(event.target.files[0]).then(()=>notify('FellowFare v2 data imported.')).catch(error=>notify(error.message))}

function consumeMessage(event){if(event.origin!==location.origin||!event.data||typeof event.data!=='object')return;if(event.data.type==='civweave:fellowfare-listing-draft'){enqueueDraft(event.data.draft||event.data.payload||{});if(routeName()==='loom')renderSell()}}
function start(){ensureDialogs();document.addEventListener('click',onClick);document.addEventListener('submit',onSubmit);document.addEventListener('change',onChange);addEventListener('hashchange',()=>render(routeName()));addEventListener('storage',event=>{if([STORE_KEY,LEGACY_KEY,DRAFT_KEY,COMMERCE_RECEIPTS_KEY,'civweave.reward-ledger.v2'].includes(event.key)){state=readState();render(routeName())}});addEventListener('message',consumeMessage);addEventListener('civweave:canonical-rewards-changed',()=>{if(routeName()==='market'||routeName()==='inbox')render(routeName())});render(routeName())}

const api=Object.freeze({version:VERSION,schema:SCHEMA,storeKey:STORE_KEY,draftKey:DRAFT_KEY,read:()=>copy(state),listings:()=>copy(allListings()),publishListing,enqueueDraft,closeListing,startArrangement,openComposer,render,routeTo,scrubLegacyDemoState});
globalThis.CivweaveFellowFareMarketplaceV2=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
