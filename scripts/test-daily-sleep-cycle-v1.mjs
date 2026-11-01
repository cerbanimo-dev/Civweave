import assert from 'node:assert/strict';
import test from 'node:test';
import {utcDayKey,nextUtcRollover,nightlyEligibility,splitEveningBudget,createDailySleepCycle} from '../public/app/shared/daily-sleep-cycle-v1.mjs';
const eveningTime=Date.parse('2026-11-01T23:32:00Z'),rolloverTime=Date.parse('2026-11-02T00:01:00Z');
const quota={verified:true,includedRemainingNeurons:930,workersAiFreeRemainingNeurons:1050,
 dailyRemainingNeurons:1180,authorizedGuildFreeNeurons:960};
const context={verified:true,guildId:'guild:test',questSnapshots:[],intentions:[],contributionHistory:[]};
test('UTC rollover and guarded final free neuron allocation',()=>{
 assert.equal(utcDayKey(eveningTime),'2026-11-01');
 assert.equal(new Date(nextUtcRollover(eveningTime)).toISOString(),'2026-11-02T00:00:00.000Z');
 const e=nightlyEligibility({now:eveningTime,enabled:true,quota});
 assert.equal(e.neurons,905);
 assert.equal(splitEveningBudget(e.neurons).reduce((a,b)=>a+b.maxNeurons,0),905);
 assert.equal(nightlyEligibility({now:Date.parse('2026-11-01T23:59:00Z'),enabled:true,quota}).reason,'cutoff');
 assert.equal(nightlyEligibility({now:eveningTime,enabled:true,quota:{...quota,verified:false}}).reason,'unverified-quota');
 assert.equal(nightlyEligibility({now:eveningTime,enabled:true,quota:{...quota,includedRemainingNeurons:24}}).reason,'insufficient-free-allowance');
});
function harness({trainer=true}={}){
 let currentTime=eveningTime;const data=new Map(),claims=[],outputs=[],drafts=[],settlements=[];
 const storage={async get(k){return data.get(k)},async put(k,v){data.set(k,v)}};
 const lease=async(_key,fn)=>fn();
 const cycle=createDailySleepCycle({guildId:'guild:test',storage,withLease:lease,now:()=>currentTime,
  enabled:true,readQuota:async()=>quota,readContext:async()=>context,
  reserveFree:async params=>{claims.push(params);return {billingRail:'workers-ai-free',fundingSource:'included',day:params.day,
   reservedNeurons:params.maxNeurons,reservationId:'rid-'+params.stage}},
  generate:async params=>{outputs.push(params);return{verified:true,text:'Only synthesized '+params.stage,
   chargedNeurons:Math.min(40,params.maxNeurons)}},
  settle:async x=>{settlements.push(x);return {ok:true}},
  runLocalConsolidation:async()=>({status:'ok',observations:['Observed progress']}),
  ...(trainer?{trainLocalAdapter:async()=>({accepted:true,heldoutPassed:true,rollbackAvailable:true,adapterId:'local-lora-1'})}:{}),
  createQuestDrafts:async x=>{drafts.push(x);return {id:'draft-next-day',status:'draft',humanRatified:false,automaticallyPublished:false}}
 });
 return {cycle,claims,outputs,drafts,settlements,setTime:val=>{currentTime=val}};
}
test('evening spends only verified remaining free pool; sleep trains locally before morning drafts',async()=>{
 const h=harness();
 const a=await h.cycle.evening();
 assert.equal(a.status,'completed');
 assert.equal(h.claims.length,3);
 assert.ok(h.claims.every(x=>x.exclusiveFree&&x.day==='2026-11-01'));
 assert.equal(h.settlements.reduce((n,x)=>n+x.actualNeurons,0),120);
 const again=await h.cycle.evening();
 assert.equal(again.status,'already-complete');
 assert.equal(h.claims.length,3);
 assert.equal((await h.cycle.morning('2026-11-01')).status,'waiting-for-sleep');
 h.setTime(rolloverTime);
 const slept=await h.cycle.rollover('2026-11-01');
 assert.equal(slept.status,'complete');
 assert.equal(slept.record.training,'validated');
 assert.equal((await h.cycle.morning('2026-11-01')).status,'draft-ready-for-review');
 assert.equal(h.drafts[0].adapterId,'local-lora-1');
 assert.equal(h.drafts[0].proposalOnly,true);
 assert.equal((await h.cycle.morning('2026-11-01')).status,'already-complete');
});
test('without a local trainer morning continues from memory, not fabricated neural weights',async()=>{
 const h=harness({trainer:false});
 h.setTime(rolloverTime);
 const s=await h.cycle.rollover('2026-11-01');
 assert.equal(s.status,'complete');
 assert.equal(s.record.training,'skipped');
 assert.equal(s.record.adapter,null);
 assert.equal((await h.cycle.morning('2026-11-01')).status,'draft-ready-for-review');
});
test('a paid billing-rail mismatch never silently falls back to overage',async()=>{
 const d=new Map();let at=eveningTime,charged=[],called=false;
 const c=createDailySleepCycle({guildId:'guild:test',now:()=>at,enabled:true,
  storage:{get:async k=>d.get(k),put:async(k,v)=>d.set(k,v)},
  withLease:async(_k,fn)=>fn(),readQuota:async()=>quota,readContext:async()=>context,
  reserveFree:async x=>({reservationId:'unsafe',billingRail:'workers-ai-paid-overage',
    fundingSource:'lifetime',day:x.day,reservedNeurons:x.maxNeurons}),
  generate:async()=>{called=true;return{}},settle:async x=>charged.push(x)});
 const result=await c.evening();
 assert.equal(result.status,'interrupted-review-required');
 assert.equal(called,false);
 assert.deepEqual(charged,[{reservationId:'unsafe',actualNeurons:0}]);
});
