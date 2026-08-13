(()=>{
'use strict';
if(globalThis.CivweaveFulfillmentEconomyV1)return;

const VERSION='1.0.0';
const SCHEMA='civweave.fulfillment-economy.v1';
const STATE_KEY='civweave.fulfillment-economy.v1';
const MARKET_KEY='fellowfare.marketplace.v2';
const REWARD_PER_QUEST=5;
const MILESTONE_SIZE=100;
const MILESTONE_BONUS=10;
const GOODS_KINDS=new Set(['product','resource']);
const TOKEN_KINDS=new Set(['service','learning','tutoring']);
const ASSETS={acorns:{ledger:'acorn',symbol:'🌰',label:'Acorns'},buttons:{ledger:'button',symbol:'🔘',label:'Buttons'}};
const now=()=>new Date().toISOString();
const clean=(value,max=4000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const copy=value=>JSON.parse(JSON.stringify(value));
const integer=(value,label='amount')=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw new RangeError(`${label} must be a whole number.`);return n};
const localDay=()=>{
  const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const hash=value=>{
  let h=2166136261;
  for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
};

const QUEST_POOL=Object.freeze([
  {id:'finish-learning-module',bucket:'progress',event:'learning_complete',target:1,title:'Finish a learning module',rewardAsset:'acorns',noBalance:true},
  {id:'finish-cerbanimo-quest',bucket:'progress',event:'cerbanimo_quest_complete',target:1,title:'Finish a Cerbanimo quest',rewardAsset:'buttons',noBalance:true},
  {id:'help-someone-learn',bucket:'progress',event:'teaching_complete',target:1,title:'Help someone finish a learning activity',rewardAsset:'acorns',noBalance:true},

  {id:'fulfill-20-acorns',bucket:'fulfillment',event:'fulfill_acorns',target:20,title:'Fulfill 20 🌰 Acorns',rewardAsset:'acorns'},
  {id:'fulfill-20-buttons',bucket:'fulfillment',event:'fulfill_buttons',target:20,title:'Fulfill 20 🔘 Buttons',rewardAsset:'buttons'},
  {id:'complete-service-arrangement',bucket:'fulfillment',event:'service_complete',target:1,title:'Complete a service arrangement',rewardAsset:'buttons',noBalance:true},

  {id:'post-need',bucket:'community',event:'post_need',target:1,title:'Post a need',rewardAsset:'acorns',noBalance:true},
  {id:'post-offering',bucket:'community',event:'post_offering',target:1,title:'Post an offering',rewardAsset:'buttons',noBalance:true},
  {id:'answer-need',bucket:'community',event:'answer_need',target:1,title:'Respond to a community need',rewardAsset:'buttons',noBalance:true},
  {id:'validate-contribution',bucket:'community',event:'validate_contribution',target:1,title:'Validate a contribution',rewardAsset:'buttons',noBalance:true},
  {id:'contribute-project-resource',bucket:'community',event:'project_resource',target:1,title:'Contribute a useful project resource',rewardAsset:'acorns',noBalance:true}
]);

function emptyState(){
  return{
    schema:SCHEMA,
    version:1,
    lifetimeFulfilled:{acorns:0,buttons:0},
    days:{},
    activities:[],
    seenActivityKeys:[],
    seenListingIds:[],
    seenLearningSourceIds:[],
    contributions:[],
    migration:{},
    updatedAt:now()
  };
}
function readState(){
  const raw=parse(localStorage.getItem(STATE_KEY),null);
  if(raw?.schema!==SCHEMA)return emptyState();
  const state={...emptyState(),...raw};
  state.lifetimeFulfilled={...emptyState().lifetimeFulfilled,...(raw.lifetimeFulfilled||{})};
  state.days=raw.days&&typeof raw.days==='object'?raw.days:{};
  state.activities=Array.isArray(raw.activities)?raw.activities:[];
  state.seenActivityKeys=Array.isArray(raw.seenActivityKeys)?raw.seenActivityKeys:[];
  state.seenListingIds=Array.isArray(raw.seenListingIds)?raw.seenListingIds:[];
  state.seenLearningSourceIds=Array.isArray(raw.seenLearningSourceIds)?raw.seenLearningSourceIds:[];
  state.contributions=Array.isArray(raw.contributions)?raw.contributions:[];
  return state;
}
let state=readState();
function writeState(reason='update'){
  state.updatedAt=now();
  state.activities=state.activities.slice(-1000);
  state.seenActivityKeys=state.seenActivityKeys.slice(-2500);
  state.seenListingIds=state.seenListingIds.slice(-2500);
  state.seenLearningSourceIds=state.seenLearningSourceIds.slice(-2500);
  state.contributions=state.contributions.slice(-1000);
  localStorage.setItem(STATE_KEY,JSON.stringify(state));
  try{dispatchEvent(new CustomEvent('civweave:fulfillment-economy-changed',{detail:{reason,state:copy(state)}}))}catch{}
  return state;
}
function ledger(){
  const api=globalThis.CivweaveCanonicalRewardsV2;
  if(!api?.appendEntry||!api?.project)throw new Error('Canonical Acorn/Button ledger is unavailable.');
  return api;
}
function balances(){
  const p=ledger().project();
  return{acorns:Number(p.acorns||0),buttons:Number(p.buttons||0)};
}
function questForDay(day=localDay()){
  const buckets=['progress','fulfillment','community'];
  return buckets.map((bucket,index)=>{
    const rows=QUEST_POOL.filter(q=>q.bucket===bucket);
    return rows[hash(`${day}:${bucket}:${index}`)%rows.length];
  });
}
function ensureDay(day=localDay()){
  const selected=questForDay(day);
  const prior=state.days[day]&&typeof state.days[day]==='object'?state.days[day]:{};
  const progress=prior.progress&&typeof prior.progress==='object'?prior.progress:{};
  for(const quest of selected){
    progress[quest.id]={count:Number(progress[quest.id]?.count||0),completed:Boolean(progress[quest.id]?.completed),rewardedAt:progress[quest.id]?.rewardedAt||null};
  }
  state.days[day]={date:day,questIds:selected.map(q=>q.id),progress,createdAt:prior.createdAt||now(),updatedAt:now()};
  return state.days[day];
}
async function awardQuest(day,quest){
  const record=ensureDay(day).progress[quest.id];
  if(record.rewardedAt)return false;
  const asset=ASSETS[quest.rewardAsset];
  await ledger().appendEntry({
    accountId:'passport:local',
    assetType:asset.ledger,
    amount:REWARD_PER_QUEST,
    sourceSystem:'fellowfare',
    sourceKind:'doing',
    sourceId:`daily-quest:${day}:${quest.id}`,
    sourceKey:`fellowfare:daily-quest:${day}:${quest.id}:${asset.ledger}`,
    metadata:{operation:'daily-quest-reward',questId:quest.id,day,fixedReward:true,amount:REWARD_PER_QUEST}
  });
  record.rewardedAt=now();
  record.completed=true;
  writeState('daily-quest-reward');
  return true;
}
async function recordActivity(type,context={}){
  const event=clean(type,80);
  if(!event)return false;
  const day=clean(context.day||localDay(),20);
  const sourceId=clean(context.sourceId||context.id||context.listingId||context.orderId||context.moduleId||'',220);
  const amount=Math.max(1,Number(context.amount||1));
  const activityKey=clean(context.activityKey||`${day}:${event}:${sourceId||clean(context.note||'',120)}`,500);
  if(sourceId&&state.seenActivityKeys.includes(activityKey))return false;
  if(sourceId)state.seenActivityKeys.push(activityKey);
  state.activities.push({event,sourceId:sourceId||null,amount,day,at:now(),metadata:context.metadata&&typeof context.metadata==='object'?copy(context.metadata):{}});
  const daily=ensureDay(day);
  const selected=QUEST_POOL.filter(q=>daily.questIds.includes(q.id)&&q.event===event);
  for(const quest of selected){
    const row=daily.progress[quest.id];
    if(row.completed)continue;
    row.count=Math.min(quest.target,Number(row.count||0)+amount);
    if(row.count>=quest.target){row.completed=true;await awardQuest(day,quest)}
  }
  writeState('activity');
  return true;
}
function normalizeAsset(asset){
  const key=clean(asset,30).toLowerCase();
  if(['acorn','acorns','🌰'].includes(key))return'acorns';
  if(['button','buttons','🔘'].includes(key))return'buttons';
  throw new TypeError('Fulfillment asset must be Acorns or Buttons.');
}
async function awardMilestones(assetKey,before,after){
  const first=Math.floor(before/MILESTONE_SIZE)+1;
  const last=Math.floor(after/MILESTONE_SIZE);
  if(last<first)return[];
  const results=[];
  for(let step=first;step<=last;step++){
    const threshold=step*MILESTONE_SIZE;
    const asset=ASSETS[assetKey];
    results.push(await ledger().appendEntry({
      accountId:'passport:local',
      assetType:asset.ledger,
      amount:MILESTONE_BONUS,
      sourceSystem:'fellowfare',
      sourceKind:'doing',
      sourceId:`fulfillment-milestone:${assetKey}:${threshold}`,
      sourceKey:`fellowfare:fulfillment-milestone:${assetKey}:${threshold}`,
      metadata:{operation:'fulfillment-milestone-bonus',asset:assetKey,threshold,fixedReward:true,amount:MILESTONE_BONUS}
    }));
  }
  return results;
}
async function fulfill(assetInput,amountInput,context={}){
  const assetKey=normalizeAsset(assetInput);
  const amount=integer(amountInput,'Fulfillment amount');
  if(amount<1)throw new RangeError('Fulfillment amount must be at least 1.');
  const available=balances()[assetKey];
  if(available<amount)throw new RangeError(`Not enough ${ASSETS[assetKey].label} to fulfill ${amount}.`);
  const sourceId=clean(context.sourceId||context.orderId||context.listingId||`fulfillment:${crypto.randomUUID?.()||Date.now()}`,220);
  await ledger().appendEntry({
    accountId:'passport:local',
    assetType:ASSETS[assetKey].ledger,
    amount:-amount,
    sourceSystem:'fellowfare',
    sourceKind:'doing',
    sourceId,
    sourceKey:clean(context.sourceKey||`fellowfare:fulfillment:${sourceId}:${assetKey}`,500),
    metadata:{
      operation:'fulfillment-burn',
      nonTransferable:true,
      recipientCredited:false,
      asset:assetKey,
      listingId:clean(context.listingId,220)||null,
      orderId:clean(context.orderId,220)||null,
      kind:clean(context.kind,40)||null,
      purpose:clean(context.purpose,240)||null
    }
  });
  const before=Number(state.lifetimeFulfilled[assetKey]||0);
  const after=before+amount;
  state.lifetimeFulfilled[assetKey]=after;
  await recordActivity(`fulfill_${assetKey}`,{sourceId:`${sourceId}:${assetKey}`,amount,metadata:{listingId:context.listingId||null,orderId:context.orderId||null}});
  await awardMilestones(assetKey,before,after);
  writeState('fulfillment');
  return{asset:assetKey,amount,before,after,balance:balances()[assetKey]};
}
function milestoneStatus(assetInput){
  const assetKey=normalizeAsset(assetInput);
  const fulfilled=Number(state.lifetimeFulfilled[assetKey]||0);
  const next=(Math.floor(fulfilled/MILESTONE_SIZE)+1)*MILESTONE_SIZE;
  return{asset:assetKey,fulfilled,next,remaining:next-fulfilled,bonus:MILESTONE_BONUS};
}
function marketState(){
  const raw=parse(localStorage.getItem(MARKET_KEY),{});
  return raw&&typeof raw==='object'?raw:{};
}
let sanitizing=false;
function sellerPriceText(pricing={}){
  if(clean(pricing?.sellerPayment?.priceText,120))return clean(pricing.sellerPayment.priceText,120);
  const usd=Number(pricing?.usdMinor||0);
  if(usd>0)return`$${(usd/100).toFixed(2)}`;
  if(clean(pricing?.legacyLabel,120))return clean(pricing.legacyLabel,120);
  return'';
}
function sanitizeMarketplaceState(reason='policy-sanitize'){
  if(sanitizing)return false;
  const market=marketState(),rows=Array.isArray(market.listings)?market.listings:[];
  let changed=false;
  for(const listing of rows){
    if(!listing||typeof listing!=='object')continue;
    const kind=clean(listing.kind,40).toLowerCase();
    const pricing=listing.pricing&&typeof listing.pricing==='object'?listing.pricing:{};
    if(GOODS_KINDS.has(kind)){
      const preserved=listing.sellerPayment&&typeof listing.sellerPayment==='object'?listing.sellerPayment:{};
      const priceText=clean(preserved.priceText||sellerPriceText(pricing),120);
      listing.sellerPayment={
        mode:'seller-direct',
        priceText,
        methods:Array.isArray(preserved.methods)?preserved.methods.map(x=>clean(x,80)).filter(Boolean).slice(0,12):[],
        instructions:clean(preserved.instructions,600),
        platformCollectsPayment:false,
        platformRoutesPayment:false
      };
      if(Number(pricing.usdMinor||0)||Number(pricing.buttons||0)||Number(pricing.acorns||0)||listing.commerce){
        listing.pricing={...pricing,usdMinor:0,buttons:0,acorns:0};
        listing.commerce=null;
        listing.updatedAt=now();
        changed=true;
      }
    }else if(TOKEN_KINDS.has(kind)){
      if(Number(pricing.usdMinor||0)||listing.commerce){
        listing.pricing={...pricing,usdMinor:0};
        listing.commerce=null;
        listing.settlement={mode:'fulfillment-burn',recipientTransfer:false,platformIssuedRewards:true};
        listing.updatedAt=now();
        changed=true;
      }else if(!listing.settlement||listing.settlement.mode!=='fulfillment-burn'){
        listing.settlement={mode:'fulfillment-burn',recipientTransfer:false,platformIssuedRewards:true};
        changed=true;
      }
    }else if(listing.commerce){
      listing.commerce=null;
      changed=true;
    }
  }
  if(!changed)return false;
  sanitizing=true;
  market.updatedAt=now();
  localStorage.setItem(MARKET_KEY,JSON.stringify(market));
  try{dispatchEvent(new CustomEvent('fellowfare:marketplace-changed',{detail:{reason,updatedAt:market.updatedAt}}))}catch{}
  sanitizing=false;
  return true;
}
let pendingSellerTerms=null;
function priceLabel(form,name){return form.elements?.[name]?.closest?.('label')||null}
function ensureSellerFields(form){
  if(form.querySelector('[data-ff-seller-direct-fields]'))return;
  const anchor=form.querySelector('#ffv2ComposerAdvice')||form.querySelector('button[type="submit"]');
  const section=document.createElement('section');
  section.dataset.ffSellerDirectFields='true';
  section.className='ff-fulfillment-seller-fields';
  section.innerHTML=`<div class="ffv2-advice"><strong>Seller-direct goods payment.</strong> FellowFare lists the item but does not collect, route, split, escrow, or settle the seller's payment.</div>
    <label><span>Seller price / terms</span><input name="sellerPriceText" maxlength="120" placeholder="$25, free, make an offer…"></label>
    <label><span>Private payment methods</span><input name="sellerPaymentMethods" maxlength="300" placeholder="Cash, PayPal, Venmo, seller checkout link…"></label>
    <label><span>Payment / pickup instructions</span><textarea name="sellerPaymentInstructions" rows="3" maxlength="600"></textarea></label>`;
  anchor?.parentNode?.insertBefore(section,anchor);
}
function configureComposer(){
  const form=document.querySelector('#ffv2ComposerForm');
  if(!form)return;
  ensureSellerFields(form);
  const kind=clean(form.elements?.kind?.value,40).toLowerCase();
  const goods=GOODS_KINDS.has(kind),tokens=TOKEN_KINDS.has(kind);
  const seller=form.querySelector('[data-ff-seller-direct-fields]');
  if(seller)seller.hidden=!goods;
  const usd=priceLabel(form,'usd'),buttons=priceLabel(form,'buttons'),acorns=priceLabel(form,'acorns');
  if(usd)usd.hidden=true;
  if(buttons)buttons.hidden=!tokens;
  if(acorns)acorns.hidden=!tokens;
  if(form.elements?.usd){form.elements.usd.disabled=true;form.elements.usd.value=''}
  if(form.elements?.buttons){form.elements.buttons.disabled=!tokens;if(!tokens)form.elements.buttons.value=''}
  if(form.elements?.acorns){form.elements.acorns.disabled=!tokens;if(!tokens)form.elements.acorns.value=''}
  const advice=document.querySelector('#ffv2ComposerAdvice');
  if(advice){
    if(goods)advice.textContent='Goods use seller-direct payment only. No Acorn/Button price and no FellowFare checkout.';
    else if(tokens)advice.textContent='Services and learning are fulfilled with Acorns/Buttons. Fulfilled tokens are burned; they are never transferred to the provider.';
  }
}
function captureComposerSubmit(event){
  const form=event.target;
  if(form?.id!=='ffv2ComposerForm')return;
  const kind=clean(form.elements?.kind?.value,40).toLowerCase();
  if(form.elements?.usd){form.elements.usd.disabled=false;form.elements.usd.value=''}
  if(GOODS_KINDS.has(kind)){
    if(form.elements?.buttons){form.elements.buttons.disabled=false;form.elements.buttons.value=''}
    if(form.elements?.acorns){form.elements.acorns.disabled=false;form.elements.acorns.value=''}
    const methods=clean(form.elements?.sellerPaymentMethods?.value,300).split(',').map(x=>clean(x,80)).filter(Boolean);
    pendingSellerTerms={
      kind,
      title:clean(form.elements?.title?.value,180),
      sellerPayment:{
        mode:'seller-direct',
        priceText:clean(form.elements?.sellerPriceText?.value,120),
        methods,
        instructions:clean(form.elements?.sellerPaymentInstructions?.value,600),
        platformCollectsPayment:false,
        platformRoutesPayment:false
      },
      at:Date.now()
    };
  }else{
    pendingSellerTerms=null;
  }
}
function attachPendingSellerTerms(){
  if(!pendingSellerTerms)return false;
  const market=marketState(),rows=Array.isArray(market.listings)?market.listings:[];
  const listing=rows.find(row=>row?.ownerId==='me'&&row?.kind===pendingSellerTerms.kind&&clean(row?.title,180)===pendingSellerTerms.title&&!row?.sellerPayment);
  if(!listing)return false;
  listing.sellerPayment=pendingSellerTerms.sellerPayment;
  listing.pricing={...(listing.pricing||{}),usdMinor:0,buttons:0,acorns:0};
  listing.commerce=null;
  listing.updatedAt=now();
  market.updatedAt=now();
  localStorage.setItem(MARKET_KEY,JSON.stringify(market));
  pendingSellerTerms=null;
  try{dispatchEvent(new CustomEvent('fellowfare:marketplace-changed',{detail:{reason:'seller-direct-terms-attached',updatedAt:market.updatedAt}}))}catch{}
  return true;
}
function formatTokenFulfillment(listing){
  const p=listing?.pricing||{},parts=[];
  if(Number(p.acorns)>0)parts.push(`${Number(p.acorns)} 🌰`);
  if(Number(p.buttons)>0)parts.push(`${Number(p.buttons)} 🔘`);
  return parts.length?`Fulfill ${parts.join(' + ')}`:(p.gift?'Gift / free':'No fulfillment amount set');
}
function enhanceListingCards(){
  const listings=new Map((globalThis.CivweaveFellowFareMarketplaceV2?.listings?.()||[]).map(x=>[x.id,x]));
  for(const card of document.querySelectorAll('.ffv2-listing[data-listing-id]')){
    const listing=listings.get(card.dataset.listingId);if(!listing)continue;
    const price=card.querySelector('.ffv2-price');
    if(GOODS_KINDS.has(listing.kind)){
      const sp=listing.sellerPayment||{};
      if(price)price.textContent=[clean(sp.priceText,120)||'Seller sets payment terms','seller-direct'].join(' · ');
      if(!card.querySelector('[data-ff-payment-boundary]')){
        const note=document.createElement('small');note.dataset.ffPaymentBoundary='true';note.className='ff-fulfillment-boundary';note.textContent='Payment goes directly between buyer and seller. FellowFare does not collect it.';price?.after(note);
      }
    }else if(TOKEN_KINDS.has(listing.kind)){
      if(price)price.textContent=formatTokenFulfillment(listing);
      if(!card.querySelector('[data-ff-payment-boundary]')){
        const note=document.createElement('small');note.dataset.ffPaymentBoundary='true';note.className='ff-fulfillment-boundary';note.textContent='Tokens are fulfilled and burned, not transferred to the provider.';price?.after(note);
      }
    }
  }
}
function questView(day=localDay()){
  const daily=ensureDay(day);
  return daily.questIds.map(id=>{
    const quest=QUEST_POOL.find(q=>q.id===id),progress=daily.progress[id]||{count:0};
    return{...quest,count:Number(progress.count||0),completed:Boolean(progress.completed),rewardedAt:progress.rewardedAt||null};
  });
}
function renderQuestPanel(){
  const route=document.body.dataset.ffRoute||location.hash.slice(1);
  if(route!=='inbox')return;
  const host=document.querySelector('.ffv2-balance-grid')?.parentElement||document.querySelector('#main');
  if(!host)return;
  let panel=document.querySelector('#ffFulfillmentDaily');
  if(!panel){panel=document.createElement('section');panel.id='ffFulfillmentDaily';panel.className='ff-fulfillment-daily';host.insertBefore(panel,host.children[1]||null)}
  const quests=questView(),a=milestoneStatus('acorns'),b=milestoneStatus('buttons');
  panel.innerHTML=`<div class="ffv2-section-head"><div><p class="ffv2-eyebrow">DAILY FULFILLMENTS</p><h2>Today's 3 quests</h2></div><span>${quests.filter(q=>q.completed).length}/3</span></div>
    <div class="ff-fulfillment-quest-grid">${quests.map(q=>`<article><strong>${q.completed?'✓ ':''}${q.title}</strong><span>${Math.min(q.count,q.target)} / ${q.target}</span><small>Reward: +${REWARD_PER_QUEST} ${ASSETS[q.rewardAsset].symbol}</small></article>`).join('')}</div>
    <div class="ff-fulfillment-milestones"><article><strong>🌰 ${a.fulfilled} fulfilled</strong><span>${a.remaining} until +${a.bonus} 🌰</span></article><article><strong>🔘 ${b.fulfilled} fulfilled</strong><span>${b.remaining} until +${b.bonus} 🔘</span></article></div>`;
  const money=document.querySelector('.ffv2-money-panel');
  if(money&&!money.dataset.ffSellerDirectBoundary){
    money.dataset.ffSellerDirectBoundary='true';
    money.innerHTML='<div><p class="ffv2-eyebrow">MARKETPLACE PAYMENT BOUNDARY</p><h2>Goods are seller-direct</h2><div class="ffv2-money-status"><strong>FellowFare does not collect seller payments.</strong><span>Physical goods use the seller’s own payment method. Services and learning use Acorn/Button fulfillment instead of checkout.</span></div></div>';
  }
}
function installStyles(){
  if(document.querySelector('#ffFulfillmentEconomyStyles'))return;
  const style=document.createElement('style');style.id='ffFulfillmentEconomyStyles';style.textContent=`
    .ff-fulfillment-boundary{display:block;margin-top:.35rem;opacity:.78}
    .ff-fulfillment-daily{margin:1rem 0;padding:1rem;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:16px}
    .ff-fulfillment-quest-grid,.ff-fulfillment-milestones{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem}
    .ff-fulfillment-quest-grid article,.ff-fulfillment-milestones article{display:grid;gap:.25rem;padding:.8rem;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:12px}
    .ff-fulfillment-milestones{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:.75rem}
    .ff-fulfillment-seller-fields{display:grid;gap:.75rem;margin:.75rem 0}
    @media(max-width:640px){.ff-fulfillment-quest-grid,.ff-fulfillment-milestones{grid-template-columns:1fr}}
  `;document.head.append(style);
}
function captureNewListingActivity(detail={}){
  if(clean(detail.reason,80)!=='listing-published')return;
  const market=marketState(),rows=Array.isArray(market.listings)?market.listings:[];
  const listing=rows.find(row=>row?.ownerId==='me'&&!state.seenListingIds.includes(row.id));
  if(!listing)return;
  state.seenListingIds.push(listing.id);
  recordActivity(listing.mode==='need'?'post_need':'post_offering',{sourceId:listing.id,listingId:listing.id}).catch(()=>{});
}
function scanLearningRewards(){
  let entries=[];
  try{entries=globalThis.CivweaveCanonicalRewardsV2?.readLedger?.()?.entries||[]}catch{return}
  for(const entry of entries){
    if(entry?.assetType!=='skill-xp'||entry?.sourceKind!=='learning'||Number(entry.amount)<=0)continue;
    const id=clean(entry.sourceId,220);if(!id||state.seenLearningSourceIds.includes(id))continue;
    state.seenLearningSourceIds.push(id);
    recordActivity('learning_complete',{sourceId:id,moduleId:id}).catch(()=>{});
  }
  writeState('learning-scan');
}
function orderAndListing(orderId){
  const market=marketState(),order=(market.orders||[]).find(x=>x?.id===orderId);
  const listing=(globalThis.CivweaveFellowFareMarketplaceV2?.listings?.()||[]).find(x=>x?.id===order?.listingId);
  return{order,listing};
}
async function completeOrderWithFulfillment(orderId){
  const {order,listing}=orderAndListing(orderId);
  if(!order||!listing)throw new Error('Arrangement or listing is unavailable.');
  const kind=clean(listing.kind,40).toLowerCase(),own=listing.ownerId==='me';
  if(TOKEN_KINDS.has(kind)&&!own){
    const p=listing.pricing||{},needed={acorns:integer(Math.max(0,Number(p.acorns||0)),'Acorns'),buttons:integer(Math.max(0,Number(p.buttons||0)),'Buttons')},have=balances();
    if(have.acorns<needed.acorns||have.buttons<needed.buttons)throw new RangeError('You do not have enough Acorns/Buttons to complete this fulfillment.');
    if(needed.acorns)await fulfill('acorns',needed.acorns,{sourceId:`order:${orderId}`,sourceKey:`fellowfare:order-fulfill:${orderId}:acorns`,orderId,listingId:listing.id,kind,purpose:listing.title});
    if(needed.buttons)await fulfill('buttons',needed.buttons,{sourceId:`order:${orderId}`,sourceKey:`fellowfare:order-fulfill:${orderId}:buttons`,orderId,listingId:listing.id,kind,purpose:listing.title});
  }
  if(kind==='service'||kind==='tutoring'){
    await recordActivity(own?'teaching_complete':'service_complete',{sourceId:`order:${orderId}:complete`,orderId,listingId:listing.id});
  }else if(kind==='learning'){
    await recordActivity(own?'teaching_complete':'learning_complete',{sourceId:`order:${orderId}:complete`,orderId,listingId:listing.id});
  }
  state.contributions.push({orderId,listingId:listing.id,kind,providerId:listing.ownerId||null,localRole:own?'provider':'requester',completedAt:now(),directTokenTransfer:false});
  writeState('arrangement-complete');
  globalThis.CivweaveFellowFareMarketplaceCapabilities?.updateOrder?.(orderId,'completed');
}
function captureOrderCompletion(event){
  const button=event.target.closest?.('[data-ff-order-action="completed"]');
  if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  completeOrderWithFulfillment(button.dataset.ffOrderId).catch(error=>{
    try{globalThis.CivweaveFellowFareMarketplaceCapabilities?.notify?.(error.message)}catch{}
    let node=document.querySelector('#ffv2CapabilityToast');
    if(!node){node=document.createElement('div');node.id='ffv2CapabilityToast';node.className='ffv2-toast';document.body.append(node)}
    node.textContent=clean(error.message,300);node.hidden=false;setTimeout(()=>node.hidden=true,3200);
  });
}
function enhance(){
  installStyles();
  configureComposer();
  sanitizeMarketplaceState();
  enhanceListingCards();
  renderQuestPanel();
}
function bindExternalActivityEvents(){
  const bindings=[
    ['civweave:learning-module-completed','learning_complete'],
    ['living-school:module-completed','learning_complete'],
    ['civweave:cerbanimo-quest-completed','cerbanimo_quest_complete'],
    ['cerbanimo:quest-completed','cerbanimo_quest_complete'],
    ['civweave:contribution-validated','validate_contribution'],
    ['civweave:project-resource-contributed','project_resource'],
    ['fellowfare:need-answered','answer_need']
  ];
  for(const [eventName,eventType] of bindings)addEventListener(eventName,event=>{
    const d=event.detail||{};
    recordActivity(eventType,{sourceId:d.sourceId||d.id||d.moduleId||d.questId||d.contributionId||`${eventName}:${Date.now()}`,metadata:d}).catch(()=>{});
  });
}
const observer=new MutationObserver(()=>requestAnimationFrame(enhance));
function start(){
  ensureDay();
  sanitizeMarketplaceState('boot-policy-sanitize');
  const market=marketState();
  if(!state.migration.initialListingsSeen){
    state.seenListingIds=(market.listings||[]).map(x=>x?.id).filter(Boolean).slice(-2500);
    state.migration.initialListingsSeen=now();
    writeState('initial-listing-baseline');
  }
  document.addEventListener('submit',captureComposerSubmit,true);
  document.addEventListener('click',captureOrderCompletion,true);
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-open-composer],[data-use-draft],[data-ff-need-shortcut]'))requestAnimationFrame(configureComposer)},true);
  document.addEventListener('change',event=>{if(event.target?.closest?.('#ffv2ComposerForm')&&event.target.name==='kind')requestAnimationFrame(configureComposer)},true);
  addEventListener('fellowfare:marketplace-changed',event=>{
    attachPendingSellerTerms();
    sanitizeMarketplaceState();
    captureNewListingActivity(event.detail||{});
    requestAnimationFrame(enhance);
  });
  addEventListener('civweave:canonical-rewards-changed',()=>{scanLearningRewards();requestAnimationFrame(renderQuestPanel)});
  addEventListener('hashchange',()=>requestAnimationFrame(enhance));
  bindExternalActivityEvents();
  observer.observe(document.querySelector('#main')||document.body,{childList:true,subtree:true});
  scanLearningRewards();
  enhance();
}
const api=Object.freeze({
  version:VERSION,
  schema:SCHEMA,
  stateKey:STATE_KEY,
  rewardPerQuest:REWARD_PER_QUEST,
  milestoneSize:MILESTONE_SIZE,
  milestoneBonus:MILESTONE_BONUS,
  questPool:()=>copy(QUEST_POOL),
  today:()=>copy(questView()),
  balances,
  read:()=>copy(state),
  fulfill,
  recordActivity,
  milestoneStatus,
  sanitizeMarketplaceState,
  completeOrderWithFulfillment
});
globalThis.CivweaveFulfillmentEconomyV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
