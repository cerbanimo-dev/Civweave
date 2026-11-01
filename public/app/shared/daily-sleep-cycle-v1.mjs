/**
 * Nightly Guild lifecycle: protected, auth-scoped FREE cloud synthesis before
 * UTC reset; local/offline sleep/consolidation afterward; morning draft gate.
 *
 * This is a host-independent owner. It DOES NOT connect Cloudflare capacity,
 * a cron scheduler, local trainer, or canonical Quest publisher by itself.
 * All side-effectful adapters are injected, verified, and explicitly enabled.
 */
export const DAILY_SLEEP_SCHEMA='civweave.daily-sleep.v1';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,120}$/.test(x)?x:'';
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)?x:'';
const whole=(v,lo=0,hi=100000)=>Number.isSafeInteger(v)?Math.max(lo,Math.min(hi,v)):null;
const clone=x=>JSON.parse(JSON.stringify(x));
const clean=(s,max=3000)=>typeof s==='string'?s.trim().slice(0,max):'';
export const NIGHT_POLICY=Object.freeze({
 beforeRolloverMinutes:45,cutoffMinutes:2,safetyReserveNeurons:25,
 minFreeNeurons:30,maxSynthesisNeurons:10000,
 maxTrainingBatches:1
});
export const NIGHT_STAGES=Object.freeze(['observations','tomorrow-options','daily-draft']);
export function utcDayKey(now=Date.now()){return new Date(now).toISOString().slice(0,10);}
export function nextUtcRollover(now=Date.now()){
 const date=new Date(now);date.setUTCHours(24,0,0,0);return date.getTime();
}
export function nightlyEligibility({now=Date.now(),quota,enabled=false,policy=NIGHT_POLICY}={}){
 const at=Number(now),reset=nextUtcRollover(at);
 const toReset=reset-at;
 const start=policy.beforeRolloverMinutes*60000,cutoff=policy.cutoffMinutes*60000;
 if(!enabled)return {eligible:false,reason:'disabled',day:utcDayKey(at),neurons:0,resetAt:new Date(reset).toISOString()};
 if(toReset>start)return {eligible:false,reason:'too-early',day:utcDayKey(at),neurons:0,resetAt:new Date(reset).toISOString()};
 if(toReset<=cutoff)return {eligible:false,reason:'cutoff',day:utcDayKey(at),neurons:0,resetAt:new Date(reset).toISOString()};
 if(!quota||quota.verified!==true)return {eligible:false,reason:'unverified-quota',day:utcDayKey(at),neurons:0,resetAt:new Date(reset).toISOString()};
 const amounts=[quota.includedRemainingNeurons,quota.workersAiFreeRemainingNeurons,
  quota.dailyRemainingNeurons,quota.authorizedGuildFreeNeurons];
 if(amounts.some(x=>!Number.isSafeInteger(x)||x<0))
  return {eligible:false,reason:'unverified-free-pool',day:utcDayKey(at),neurons:0,resetAt:new Date(reset).toISOString()};
 const free=Math.min(...amounts,policy.maxSynthesisNeurons);
 const neurons=Math.max(0,free-policy.safetyReserveNeurons);
 return {eligible:neurons>=policy.minFreeNeurons,reason:neurons>=policy.minFreeNeurons?'ready':'insufficient-free-allowance',
  day:utcDayKey(at),neurons:neurons>=policy.minFreeNeurons?neurons:0,resetAt:new Date(reset).toISOString(),
  fundingSource:'included',billingRail:'workers-ai-free'};
}
export function splitEveningBudget(neurons){
 const n=whole(neurons);if(n===null||n<30) return [];
 const allocations=[Math.floor(n*.30),Math.floor(n*.30)];
 allocations.push(n-allocations[0]-allocations[1]);
 return NIGHT_STAGES.map((stage,i)=>({stage,maxNeurons:allocations[i]})).filter(x=>x.maxNeurons>0);
}
export function createDailySleepCycle({
 guildId,storage,now=()=>Date.now(),readQuota,readContext,reserveFree,generate,settle,
 withLease,runLocalConsolidation,trainLocalAdapter,createQuestDrafts,enabled=false,
 policy=NIGHT_POLICY
}={}){
 const guild=id(guildId);
 if(!guild||!storage||typeof storage.get!=='function'||typeof storage.put!=='function'||
   typeof withLease!=='function'||typeof readQuota!=='function'||typeof readContext!=='function'||
   typeof reserveFree!=='function'||typeof generate!=='function'||typeof settle!=='function')
  throw new TypeError('Guild, durable storage, verified quota, strict free reservation, inference and lease adapters are required.');
 const key=day=>DAILY_SLEEP_SCHEMA+':'+guild+':'+day;
 const empty=day=>({schema:DAILY_SLEEP_SCHEMA,guildId:guild,day,evening:'pending',
  stages:[],sleep:'pending',training:'pending',morning:'pending',adapter:null,
  updatedAt:new Date(now()).toISOString()});
 async function load(value){const k=day(value);if(!k)throw new TypeError('Valid UTC day required.');
  const row=await storage.get(key(k));return row?.schema===DAILY_SLEEP_SCHEMA&&row.guildId===guild&&row.day===k?row:empty(k);}
 async function save(row){const next={...row,updatedAt:new Date(now()).toISOString()};await storage.put(key(row.day),clone(next));return next;}
 function requireContext(value){
  if(!value||value.verified!==true||value.guildId!==guild||
    !Array.isArray(value.questSnapshots)||!Array.isArray(value.intentions)||!Array.isArray(value.contributionHistory))
   throw new Error('Verified allowlisted Guild context required.');
  // Already permission-filtered by the canonical Guild reader adapter.
  return {guildId:guild,questSnapshots:value.questSnapshots.slice(0,100),
   intentions:value.intentions.slice(0,80),contributionHistory:value.contributionHistory.slice(0,100)};
 }
 async function evening(){
  if(!enabled)return {status:'disabled'};
  return withLease('night:'+guild+':'+utcDayKey(now()),async()=>{
   const quota=await readQuota(guild);
   const admission=nightlyEligibility({now:now(),quota,enabled,policy});
   if(!admission.eligible)return {status:admission.reason,admission};
   let record=await load(admission.day);
   if(record.evening==='complete')return {status:'already-complete',record};
   if(record.evening==='started')return {status:'interrupted-review-required',record};
   record=await save({...record,evening:'started',budgetNeurons:admission.neurons,
    cutoffAt:new Date(Date.parse(admission.resetAt)-policy.cutoffMinutes*60000).toISOString()});
   const context=requireContext(await readContext(guild));
   let totalCharged=0,used=0;
   for(const allocation of splitEveningBudget(admission.neurons)){
    if(now()>=Date.parse(record.cutoffAt))break;
    const requested=allocation.maxNeurons;
    // Quote/attempt are bounded by the existing verified free included pool.
    // This is NOT permission to use lifetime credit or paid overage.
    let receipt=null;
    try{
     receipt=await reserveFree({guildId:guild,day:admission.day,stage:allocation.stage,
      maxNeurons:requested,exclusiveFree:true});
     if(receipt?.billingRail!=='workers-ai-free'||receipt?.fundingSource!=='included'||
       receipt?.day!==admission.day||!receipt.reservationId||
       !Number.isSafeInteger(receipt.reservedNeurons)||receipt.reservedNeurons<1||
       receipt.reservedNeurons>requested)throw new Error('Free-only reservation rejected: no paid fallback.');
     const output=await generate({guildId:guild,stage:allocation.stage,context,day:admission.day,
      maxNeurons:receipt.reservedNeurons,reservationId:receipt.reservationId,
      cutoffAt:record.cutoffAt});
     if(output?.verified!==true||!Number.isSafeInteger(output.chargedNeurons)||
       output.chargedNeurons<0||output.chargedNeurons>receipt.reservedNeurons)
      throw new Error('Synthesis did not return a verified bounded neuron receipt.');
     const charged=output.chargedNeurons;
     await settle({reservationId:receipt.reservationId,actualNeurons:charged});
     receipt=null;used+=charged;totalCharged+=charged;
     // Keep only bounded synthesized observations, never raw private Guild data.
     record.stages.push({stage:allocation.stage,text:clean(output.text,3000),
      chargedNeurons:charged,source:'verified-hosted-model'});
     record=await save(record);
    }catch(error){
     if(receipt?.reservationId)try{await settle({reservationId:receipt.reservationId,actualNeurons:0})}catch{}
     record=await save({...record,evening:'interrupted-review-required',
      error:clean(String(error?.message||error),300)});
     return {status:'interrupted-review-required',record};
    }
   }
   record=await save({...record,evening:'complete',spentNeurons:totalCharged,
    unspentBudgetNeurons:Math.max(0,admission.neurons-used)});
   return {status:'completed',record};
  });
 }
 async function rollover(previousDay){
  if(!enabled)return {status:'disabled'};
  const keyDay=day(previousDay);
  if(!keyDay)throw new TypeError('Previous UTC day required.');
  if(utcDayKey(now())<=keyDay)return {status:'awaiting-utc-rollover'};
  return withLease('sleep:'+guild+':'+keyDay,async()=>{
   let record=await load(keyDay);
   if(record.sleep==='complete'||record.sleep==='degraded')return {status:record.sleep,record};
   if(record.sleep==='started')return {status:'interrupted-review-required',record};
   record=await save({...record,sleep:'started',sleepStartedAt:new Date(now()).toISOString()});
   const context=requireContext(await readContext(guild));
   try{
    // Cloudflare Workers do not train LoRAs. Only an explicitly installed,
    // authorized local/Guild host may supply a training implementation.
    const consolidated=typeof runLocalConsolidation==='function'?
     await runLocalConsolidation({guildId:guild,day:keyDay,context,evening:record.stages}):
     {status:'skipped',observations:[]};
    const observations=Array.isArray(consolidated?.observations)?
     consolidated.observations.slice(0,50).map(x=>clean(x,1000)).filter(Boolean):[];
    let train={status:'skipped',reason:'local-trainer-not-installed'};
    if(typeof trainLocalAdapter==='function'){
     try{
      const report=await trainLocalAdapter({guildId:guild,day:keyDay,observations,
       maxTrainingBatches:policy.maxTrainingBatches,reviewRequired:true});
      if(report?.accepted===true&&report?.heldoutPassed===true&&report?.rollbackAvailable===true)
       train={status:'validated',adapterId:clean(report.adapterId,160),rollbackAvailable:true};
      else train={status:'rejected',reason:'heldout-or-rollback-gate-failed'};
     }catch(error){train={status:'rejected',reason:clean(String(error?.message||error),200)}}
    }
    record=await save({...record,observations,training:train.status,adapter:train.status==='validated'?train.adapterId:null,
     trainingReceipt:train,sleep:consolidated?.status==='failed'?'degraded':'complete'});
    return {status:record.sleep,record};
   }catch(error){
    record=await save({...record,sleep:'degraded',training:'skipped',
     error:clean(String(error?.message||error),200),observations:[]});
    return {status:'degraded',record};
   }
  });
 }
 async function morning(previousDay){
  if(!enabled)return {status:'disabled'};
  if(typeof createQuestDrafts!=='function')return {status:'planner-not-connected'};
  const k=day(previousDay);if(!k)throw new TypeError('UTC day required.');
  return withLease('morning:'+guild+':'+k,async()=>{
   let record=await load(k);
   if(!['complete','degraded'].includes(record.sleep))return {status:'waiting-for-sleep'};
   if(record.morning==='complete')return {status:'already-complete',record};
   if(record.morning==='started')return {status:'interrupted-review-required',record};
   record=await save({...record,morning:'started'});
   try{
    const context=requireContext(await readContext(guild));
    const draft=await createQuestDrafts({guildId:guild,forUtcDay:utcDayKey(now()),
     context,evening:record.stages,observations:record.observations||[],
     adapterId:record.adapter,proposalOnly:true,noHumanAssignmentsWithoutHistory:true});
    if(draft?.status!=='draft'||draft?.humanRatified===true||draft?.automaticallyPublished===true)
     throw new Error('Daily Quest planner must return non-authoritative review-only drafts.');
    record=await save({...record,morning:'complete',morningDraftId:clean(draft.id,160)});
    return {status:'draft-ready-for-review',record};
   }catch(error){
    record=await save({...record,morning:'interrupted-review-required',error:clean(String(error?.message||error),200)});
    return {status:'interrupted-review-required',record};
   }
  });
 }
 return Object.freeze({load,evening,rollover,morning,eligibility:async()=>nightlyEligibility({now:now(),quota:await readQuota(guild),enabled,policy})});
}
