import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GUILD_DAILY_PLAN_POLICY,dailyNeuronBudget,dailyPlanKey,buildGuildDailyPlan,
  applyDailyModelReview,readDailyGuildPlanPreview,runDailyGuildPlanningCycle
} from '../cloudflare/mobile-guild-edge/src/guild-daily-planner-v1.mjs';
import {guildStarlingAction} from '../cloudflare/mobile-guild-edge/src/guild-starling-transport-v1.mjs';

const guildId='fictional-guild';
const now=Date.parse('2026-11-01T11:00:00Z');
const member={guildId,nodeId:'fictional-guild',userId:'writer-1'};
const publication={id:'guild-quest:fiction',guildId,status:'published',
  quest:{state:'active',plan:{outcome:'Publish a community guide',paths:[{
    realm:'documentation',steps:[{title:'Draft first chapter'},{title:'Finish index',status:'done'}],progress:[]}]}}};
const passport={guildId,userId:'writer-1',consent:'guild-planning',skills:[{skillId:'documentation',xp:10}]};
const contribution={guildId,userId:'writer-1',verified:true,authority:'canonical-contribution',
  accepted:true,occurredAt:'2026-10-30T10:00:00Z',skillIds:['documentation']};
const input={publications:[publication],passports:[passport],contributions:[contribution]};
class Storage {
  rows=new Map();chain=Promise.resolve();
  get(k){return Promise.resolve(structuredClone(this.rows.get(k)));}
  put(k,v){this.rows.set(k,structuredClone(v));return Promise.resolve();}
  list({prefix='',limit=100}={}){return Promise.resolve(new Map([...this.rows].filter(([k])=>k.startsWith(prefix)).slice(0,limit)));}
  transaction(cb){const result=this.chain.then(()=>cb(this));this.chain=result.then(()=>{},()=>{});return result;}
}

test('budget uses only verified, uncommitted system free neurons; never assumes the 1000 burst reserve',()=>{
  assert.equal(dailyNeuronBudget({uncommittedSystemFreeNeurons:1000}),0);
  assert.equal(dailyNeuronBudget({verified:true,uncommittedSystemFreeNeurons:10000}),1000);
  assert.equal(dailyNeuronBudget({verified:true,uncommittedSystemFreeNeurons:700},150),700);
  assert.equal(dailyNeuronBudget({verified:true,uncommittedSystemFreeNeurons:1000},600),400);
  assert.equal(dailyNeuronBudget({verified:true,uncommittedSystemFreeNeurons:1000},1001),0);
  assert.equal(dailyNeuronBudget({verified:true,uncommittedSystemFreeNeurons:-3}),0);
  assert.equal(GUILD_DAILY_PLAN_POLICY.maximumDailyNeurons,1000);
});
test('published steps yield AI drafts but humans with no actual contribution history get zero offers',()=>{
  const plan=buildGuildDailyPlan({...input,contributions:[]},{guildId,now});
  assert.equal(plan.aiTasks.length,1);
  assert.equal(plan.aiTasks[0].title,'Draft first chapter');
  assert.equal(plan.humanOffers.length,0);
  assert.equal(plan.authority.humanTasksAssigned,0);
  assert.equal(plan.authority.aiTasksClaimed,0);
});
test('only recent accepted canonical contributions + consent + relevant claimed skills produce voluntary invitations',()=>{
  const plan=buildGuildDailyPlan(input,{guildId,now});
  assert.equal(plan.humanOffers.length,1);
  assert.equal(plan.humanOffers[0].memberUserId,'writer-1');
  assert.equal(plan.humanOffers[0].requiresAcceptance,true);
  assert.equal(plan.humanOffers[0].assigned,false);
  assert.equal(buildGuildDailyPlan({...input,passports:[]},{guildId,now}).humanOffers.length,0);
  assert.equal(buildGuildDailyPlan({...input,contributions:[{...contribution,verified:false}]},{guildId,now}).humanOffers.length,0);
  assert.equal(buildGuildDailyPlan({...input,contributions:[{...contribution,occurredAt:'2025-01-01T00:00:00Z'}]},{guildId,now}).humanOffers.length,0);
  assert.equal(buildGuildDailyPlan({...input,contributions:[{...contribution,authority:'unverified-chat'}]},{guildId,now}).humanOffers.length,0);
  assert.equal(buildGuildDailyPlan({...input,contributions:[{...contribution,guildId:'elsewhere'}]},{guildId,now}).humanOffers.length,0);
  assert.equal(buildGuildDailyPlan({...input,passports:[{...passport,availableForOffers:false}]},{guildId,now}).humanOffers.length,0);
});
test('only Guild-scoped, authorized, explicitly shareable chat requests enter plan',()=>{
  const eligible={id:'request-42',guildId,verified:true,visibility:'guild',planningConsent:true,request:'Add a mural',skillIds:['art']};
  const invalid=[{...eligible,id:'private',visibility:'private'}, {...eligible,id:'other',guildId:'other-guild'},{...eligible,id:'unconsented',planningConsent:false},{...eligible,id:'unverified',verified:false}];
  const plan=buildGuildDailyPlan({chatRequests:[eligible,...invalid]},{guildId,now});
  assert.equal(plan.aiTasks.length,1);
  assert.equal(plan.counts.verifiedGuildChatRequests,1);
  assert.equal(plan.humanOffers.length,0);
});
test('model cannot introduce tasks, false completions, authorities, fabricated humans or execution',()=>{
  const base=buildGuildDailyPlan(input,{guildId,now});
  const plan=applyDailyModelReview(base,{prioritizedTaskIds:['injected:delete-all',base.aiTasks[0].id],
    humanOffers:[{memberUserId:'random',assigned:true}],aiTasks:[{title:'hack'}],authority:{humanTasksAssigned:12},summary:'Review documentation'});
  assert.equal(plan.aiTasks.length,1);
  assert.equal(plan.humanOffers.length,1);
  assert.equal(plan.authority.humanTasksAssigned,0);
  assert.equal(plan.summary,'Review documentation');
});
test('zero-cost authenticated preview only pulls published records and flags missing chat/activity feeds',async()=>{
  const storage=new Storage();
  await storage.put('guild-quest:active:'+guildId+':guild-quest:fiction',publication);
  await storage.put('guild-starling:'+guildId+':state',{passportUsers:['writer-1'],intentionUsers:[]});
  await storage.put('guild-starling:'+guildId+':passport:writer-1',passport);
  const result=await readDailyGuildPlanPreview(storage,member,{now});
  assert.equal(result.chargedNeurons,0);
  assert.equal(result.plan.aiTasks.length,1);
  assert.equal(result.plan.humanOffers.length,0);
  assert.equal(result.readiness.verifiedContributionHistory,false);
  assert.equal(guildStarlingAction(new Request('https://guild.example/api/node/starling/plan',{method:'GET'})),'plan');
});
test('one daily model cycle reserves/settles verified spare capacity and never charges twice',async()=>{
  const storage=new Storage();let runs=0,reserves=0,settles=0;
  const adapters={storage,guildId,now,
    sources:{load:async()=>({...input,guildId,verified:true})},
    ledger:{quote:async()=>({verified:true,uncommittedSystemFreeNeurons:380,planningChargedToday:0}),
      reserve:async({maximumNeurons})=>{reserves++;assert.equal(maximumNeurons,380);return{verified:true,maximumNeurons,reservationId:'fiction-reservation'};},
      settle:async({actualNeurons})=>{settles++;return{verified:true,chargedNeurons:actualNeurons};}},
    model:{review:async({plan,maxNeurons})=>{runs++;assert.equal(maxNeurons,380);return{prioritizedTaskIds:[plan.aiTasks[0].id],summary:'Do the first step',usage:{chargedNeurons:37}};}}};
  const [first,second]=await Promise.all([runDailyGuildPlanningCycle(adapters),runDailyGuildPlanningCycle(adapters)]);
  assert.equal(first.state,'completed');
  assert.equal(second.idempotent,true);
  assert.equal(runs,1);assert.equal(reserves,1);assert.equal(settles,1);
  assert.equal(first.chargedNeurons,37);assert.equal(first.plan.mode,'model-reviewed');
  assert.equal(dailyPlanKey(guildId,now),'guild-daily-plan:fictional-guild:2026-11-01');
});
test('no attested spare capacity skips inference without a charge',async()=>{
  const storage=new Storage();let calls=0;
  const result=await runDailyGuildPlanningCycle({storage,guildId,now,
    sources:{load:async()=>({...input,guildId,verified:true})},
    ledger:{quote:async()=>({verified:true,uncommittedSystemFreeNeurons:0}),reserve:async()=>{calls++;},settle:async()=>{calls++;}},
    model:{review:async()=>{calls++;}}});
  assert.equal(result.state,'skipped');
  assert.equal(result.chargedNeurons,0);assert.equal(calls,0);
});
test('failed inference releases reservation and fails closed, requiring review not automatic retries',async()=>{
  const storage=new Storage();let releases=0,calls=0;
  const args={storage,guildId,now,sources:{load:async()=>({...input,guildId,verified:true})},
    ledger:{quote:async()=>({verified:true,uncommittedSystemFreeNeurons:100}),
      reserve:async()=>({verified:true,maximumNeurons:100,reservationId:'fiction'}),
      settle:async({actualNeurons})=>{if(actualNeurons===0)releases++;return{verified:true,chargedNeurons:actualNeurons};}},
    model:{review:async()=>{calls++;throw new Error('model-unavailable');}}};
  const first=await runDailyGuildPlanningCycle(args),second=await runDailyGuildPlanningCycle(args);
  assert.equal(first.state,'failed');
  assert.equal(second.idempotent,true);
  assert.equal(releases,1);
  assert.equal(calls,1);
});
