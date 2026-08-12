export const VERSION='1.0.0-community-learning-market-v1';
export const STORE_KEY='civweave.fellowfare.community-learning.v1';
export const OUTBOX_KEY='civweave.fellowfare.community-learning.outbox.v1';
export const LIVING_SCHOOL_STATE_KEY='civweave.living-school.cabinet.v151';
export const PACKAGE_SCHEMA='civweave.interactive-learning-package.v1';
export const LISTING_SCHEMA='civweave.fellowfare.learning-listing.v1';
export const PURCHASE_SCHEMA='civweave.fellowfare.learning-purchase.v1';

const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
const copy=value=>{try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}};
const uid=prefix=>`${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`}`;
const now=()=>new Date().toISOString();
const number=(value,min=0,max=1_000_000)=>Math.max(min,Math.min(max,Number(value)||0));
const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const writeJson=(key,value)=>{localStorage.setItem(key,JSON.stringify(value));return value};
const validPackage=value=>value?.schema===PACKAGE_SCHEMA&&value?.school&&Array.isArray(value.school.modules)&&value.school.modules.length>0;

function emptyStore(){return{schema:'civweave.fellowfare.community-learning-store.v1',version:1,listings:[],purchases:[],tutorRequests:[],updatedAt:now()}}
export function readStore(){const value=readJson(STORE_KEY,null);return value?.schema==='civweave.fellowfare.community-learning-store.v1'?value:emptyStore()}
function writeStore(store){store.updatedAt=now();writeJson(STORE_KEY,store);try{dispatchEvent(new CustomEvent('civweave:community-learning-market-changed',{detail:{version:VERSION,store:copy(store)}}))}catch{}return store}
function queueOutbox(kind,payload){const rows=readJson(OUTBOX_KEY,[]);rows.push({id:uid('learning-market-event'),kind,payload:copy(payload),at:now(),status:'pending'});writeJson(OUTBOX_KEY,rows.slice(-500));}

function portableMedia(media){
  if(!media||typeof media!=='object')return media;
  const next=copy(media),url=clean(next.url,1800);
  if(/^blob:/i.test(url)){
    next.portableRef={recordKey:clean(next.recordKey,500),contentHash:clean(next.contentHash,160),topicSlug:clean(next.topicSlug,160),source:clean(next.source,160),license:copy(next.license||null),attribution:copy(next.attribution||null)};
    next.url='';
    next.requiresLocalResolution=true;
  }
  return next;
}
function portableModule(module){
  const next=copy(module);
  if(next.video)next.video=portableMedia(next.video);
  if(Array.isArray(next.videos))next.videos=next.videos.map(portableMedia);
  return next;
}
function portableSchool(school){
  const next=copy(school);
  next.modules=(Array.isArray(next.modules)?next.modules:[]).map(portableModule);
  return next;
}
function portableSources(sources){
  return (Array.isArray(sources)?sources:[]).map(source=>({
    id:clean(source?.id,180),title:clean(source?.title,320),url:clean(source?.url,2000),quality:clean(source?.quality,160),use:clean(source?.use,120),notes:clean(source?.notes,5000),sourceType:clean(source?.sourceType,120),provenance:clean(source?.provenance,160),verified:Boolean(source?.verified),liveFetched:Boolean(source?.liveFetched),provenanceFlag:clean(source?.provenanceFlag,300)
  })).filter(source=>source.id||source.title).slice(0,40);
}

export function trialSummary(livingState){
  const school=livingState?.school,modules=Array.isArray(school?.modules)?school.modules:[],progress=livingState?.progress&&typeof livingState.progress==='object'?livingState.progress:{};
  const rows=modules.map(module=>{const item=progress[module.id]||{};return{moduleId:clean(module.id,160),title:clean(module.title,240),lessonComplete:Boolean(item.lessonComplete),assessmentPassed:Boolean(item.assessmentPassed),attemptCount:Array.isArray(item.attempts)?item.attempts.length:0,evidenceCount:Array.isArray(item.evidence)?item.evidence.length:0}});
  const allLessonComplete=rows.length>0&&rows.every(row=>row.lessonComplete),allAssessed=rows.length>0&&rows.every(row=>row.attemptCount>0),allPassed=rows.length>0&&rows.every(row=>row.assessmentPassed);
  return{moduleCount:rows.length,allLessonComplete,allAssessed,allPassed,eligible:allLessonComplete&&allAssessed&&allPassed,rows,checkedAt:now()};
}

export async function buildInteractiveLearningPackage(livingState,{author={}}={}){
  const school=livingState?.school;if(!school?.modules?.length)throw new Error('There is no Living School curriculum to package.');
  const trial=trialSummary(livingState);if(!trial.eligible)throw new Error('Finish the lessons and pass at least one assessment attempt in every module before publishing it as tested learning.');
  const packagedSchool=portableSchool(school);
  const payload={schema:PACKAGE_SCHEMA,version:1,id:uid('learning-package'),sourceSchoolId:clean(school.id,220),title:clean(school.title,300),capability:clean(school.capability,1800),level:clean(school.level,80),proof:clean(school.proof,3000),formatContract:clean(school.generation?.formatContract,180)||'living-school-module-contract-v218.1',videoContract:copy(school.videoContract||null),school:packagedSchool,sources:portableSources(livingState?.sources),author:{id:clean(author.id||livingState?.passport?.learnerId||'local-author',240),name:clean(author.name||livingState?.passport?.displayName||'Local learner',180)},trial,createdAt:now(),updatedAt:now()};
  if(globalThis.crypto?.subtle){const bytes=new TextEncoder().encode(JSON.stringify({school:payload.school,sources:payload.sources}));const digest=await crypto.subtle.digest('SHA-256',bytes);payload.contentHash='sha256:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
  return payload;
}

function normalizedListing(input){return{schema:LISTING_SCHEMA,version:1,id:clean(input.id,240)||uid('learning-listing'),type:input.type==='tutoring-service'?'tutoring-service':'interactive-learning',status:clean(input.status,40)||'open',title:clean(input.title,300),description:clean(input.description,2400),seller:copy(input.seller||{}),packageId:clean(input.packageId,240),package:input.package&&validPackage(input.package)?copy(input.package):null,sourceSchoolId:clean(input.sourceSchoolId,220),acornPrice:number(input.acornPrice,0,100000),usdPrice:number(input.usdPrice,0,100000),buttonPrice:number(input.buttonPrice,0,100000),priceUnit:clean(input.priceUnit,80),availability:clean(input.availability,600),trial:copy(input.trial||null),createdAt:clean(input.createdAt,80)||now(),updatedAt:now(),visibility:clean(input.visibility,40)||'public'}}

export async function publishLivingSchoolToFellowFare(livingState,terms={}){
  const packageRecord=await buildInteractiveLearningPackage(livingState,{author:terms.author||{}}),store=readStore(),seller=copy(packageRecord.author),sourceSchoolId=packageRecord.sourceSchoolId;
  const learningExisting=store.listings.find(item=>item.type==='interactive-learning'&&item.sourceSchoolId===sourceSchoolId&&clean(item.seller?.id,240)===seller.id);
  const learning=normalizedListing({id:learningExisting?.id,type:'interactive-learning',title:terms.title||packageRecord.title,description:terms.description||`Interactive Living School curriculum for ${packageRecord.capability||packageRecord.title}. Includes the original lessons, practice, quizzes/tests, visualizations, provenance, and media contract.`,seller,packageId:packageRecord.id,package:packageRecord,sourceSchoolId,acornPrice:number(terms.acornPrice,0,100000),trial:packageRecord.trial,createdAt:learningExisting?.createdAt,visibility:terms.visibility||'public'});
  store.listings=store.listings.filter(item=>item.id!==learning.id);store.listings.unshift(learning);
  let tutor=null;
  if(terms.tutor?.enabled){
    const tutorExisting=store.listings.find(item=>item.type==='tutoring-service'&&item.sourceSchoolId===sourceSchoolId&&clean(item.seller?.id,240)===seller.id);
    tutor=normalizedListing({id:tutorExisting?.id,type:'tutoring-service',title:terms.tutor.title||`Tutoring · ${packageRecord.title}`,description:terms.tutor.description||`One-on-one or small-group help with ${packageRecord.capability||packageRecord.title}, linked to the tested interactive learning package.`,seller,packageId:packageRecord.id,sourceSchoolId,usdPrice:number(terms.tutor.usdPrice,0,100000),buttonPrice:number(terms.tutor.buttonPrice,0,100000),priceUnit:terms.tutor.priceUnit||'session',availability:terms.tutor.availability||'',trial:packageRecord.trial,createdAt:tutorExisting?.createdAt,visibility:terms.visibility||'public'});
    store.listings=store.listings.filter(item=>item.id!==tutor.id);store.listings.unshift(tutor);
  }
  writeStore(store);queueOutbox('listing.upsert',learning);if(tutor)queueOutbox('listing.upsert',tutor);
  try{dispatchEvent(new CustomEvent('civweave:fellowfare-learning-published',{detail:{learning:copy(learning),tutor:copy(tutor)}}))}catch{}
  return{learning,tutor,package:packageRecord};
}

export function listOpenListings(type=''){return readStore().listings.filter(item=>item?.schema===LISTING_SCHEMA&&item.status==='open'&&(!type||item.type===type)).map(copy)}
export function getListing(listingId){const item=readStore().listings.find(row=>row.id===listingId);return item?copy(item):null}

function buyerIdentity(){const state=readJson(LIVING_SCHOOL_STATE_KEY,null);return{id:clean(state?.passport?.learnerId,240)||'local-buyer',name:clean(state?.passport?.displayName,180)||'Local learner'}}
function saveInstalledPackage(listing,packageRecord,purchase){
  const current=readJson(LIVING_SCHOOL_STATE_KEY,{schema:'living-school-cabinet-v151',version:4,progress:{},sources:[],events:[],passport:{learnerId:buyerIdentity().id,displayName:buyerIdentity().name,xp:0,ledger:[]},settings:{modelRoute:'shared',mode:'guided'}})||{};
  const library=Array.isArray(current.communityLibrary)?current.communityLibrary:[];
  const libraryEntry={schema:'civweave.living-school.community-library-entry.v1',listingId:listing.id,packageId:packageRecord.id,title:packageRecord.title,capability:packageRecord.capability,seller:copy(listing.seller),contentHash:packageRecord.contentHash||'',school:copy(packageRecord.school),sources:copy(packageRecord.sources||[]),installedAt:now(),purchaseId:purchase?.id||''};
  const nextLibrary=[libraryEntry,...library.filter(item=>item.packageId!==packageRecord.id)].slice(0,100);
  const school=copy(packageRecord.school);school.id=`community-${clean(packageRecord.sourceSchoolId||packageRecord.id,160)}-${Date.now().toString(36)}`;school.marketOrigin={listingId:listing.id,packageId:packageRecord.id,seller:copy(listing.seller),contentHash:packageRecord.contentHash||'',installedAt:libraryEntry.installedAt};
  const next={...current,school,sources:copy(packageRecord.sources||[]),activeModuleId:school.modules?.[0]?.id||'',progress:{},practicum:null,visualInspection:null,projectGate:{status:'not-started',history:[],receiptIds:[]},final:null,credential:null,activePathId:'',pathContext:{id:`market:${listing.id}`,title:school.title,capability:school.capability,proof:school.proof,source:'fellowfare-community-learning'},communityLibrary:nextLibrary,events:[...(Array.isArray(current.events)?current.events:[]),{id:uid('event'),type:'community-learning-installed',detail:{listingId:listing.id,packageId:packageRecord.id,purchaseId:purchase?.id||''},at:now()}].slice(-300)};
  writeJson(LIVING_SCHOOL_STATE_KEY,next);return next;
}

export async function purchaseLearningListing(listingId,{buyer=buyerIdentity()}={}){
  const store=readStore(),index=store.listings.findIndex(item=>item.id===listingId),listing=store.listings[index];
  if(!listing||listing.type!=='interactive-learning'||!validPackage(listing.package))throw new Error('This interactive learning listing is unavailable.');
  const sellerId=clean(listing.seller?.id,240),buyerId=clean(buyer?.id,240)||buyerIdentity().id,ownCopy=Boolean(sellerId&&buyerId===sellerId),price=number(listing.acornPrice,0,100000),purchase={schema:PURCHASE_SCHEMA,version:1,id:uid('learning-purchase'),listingId:listing.id,packageId:listing.package.id,buyer:{id:buyerId,name:clean(buyer?.name,180)},seller:copy(listing.seller),asset:'acorn',amount:ownCopy?0:price,status:'installed',sellerSettlement:ownCopy?'not-applicable':'pending-network-settlement',createdAt:now()};
  if(price>0&&!ownCopy){const rewards=globalThis.CivweaveCanonicalRewardsV2;if(!rewards?.project||!rewards?.issueRewardBundle)throw new Error('The canonical Acorn ledger is not available in this FellowFare session.');const balance=Number(rewards.project()?.acorns||0);if(balance<price)throw new Error(`This module costs ${price} Acorns, but this passport currently has ${balance}.`);await rewards.issueRewardBundle({rewards:{skillXp:[],acorns:-price,buttons:0,sourceKind:'exchange'}},{sourceSystem:'fellowfare',sourceKind:'exchange',sourceId:purchase.id,accountId:`passport:${buyerId}`});}
  saveInstalledPackage(listing,listing.package,purchase);store.purchases.unshift(purchase);store.purchases=store.purchases.slice(0,1000);writeStore(store);queueOutbox('purchase.created',purchase);
  try{dispatchEvent(new CustomEvent('civweave:living-school-community-package-installed',{detail:copy(purchase)}))}catch{}
  return purchase;
}

export function createTutorRequest(listingId,details={}){
  const store=readStore(),listing=store.listings.find(item=>item.id===listingId&&item.type==='tutoring-service');if(!listing)throw new Error('This tutor listing is unavailable.');
  const request={schema:'civweave.fellowfare.tutor-request.v1',version:1,id:uid('tutor-request'),listingId:listing.id,packageId:listing.packageId,buyer:copy(details.buyer||buyerIdentity()),seller:copy(listing.seller),message:clean(details.message,2400),requestedWhen:clean(details.requestedWhen,500),usdPrice:listing.usdPrice,buttonPrice:listing.buttonPrice,priceUnit:listing.priceUnit||'session',status:'draft',createdAt:now()};
  store.tutorRequests.unshift(request);store.tutorRequests=store.tutorRequests.slice(0,1000);writeStore(store);queueOutbox('tutor-request.draft',request);return request;
}

export default Object.freeze({version:VERSION,STORE_KEY,OUTBOX_KEY,LIVING_SCHOOL_STATE_KEY,PACKAGE_SCHEMA,LISTING_SCHEMA,PURCHASE_SCHEMA,readStore,listOpenListings,getListing,trialSummary,buildInteractiveLearningPackage,publishLivingSchoolToFellowFare,purchaseLearningListing,createTutorRequest});
