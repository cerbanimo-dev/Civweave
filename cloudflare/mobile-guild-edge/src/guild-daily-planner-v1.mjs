// Daily Guild planning policy. No authority to charge neurons or claim tasks lives here.
// An authenticated host must supply canonical context, free-spare accounting and AI.
export const GUILD_DAILY_PLAN_SCHEMA = 'civweave.guild-daily-plan.v1';
export const GUILD_DAILY_PLAN_POLICY = Object.freeze({
  cadence: 'one-utc-day', maximumDailyNeurons: 1000,
  maxAiTasks: 10, maxHumanOffers: 5, recentContributionDays: 60,
  maximumQuests: 100, maximumRequests: 40
});
const text = (v,n=240) => typeof v==='string' ? v.trim().slice(0,n) : '';
const array = v => Array.isArray(v) ? v : [];
const validId = v => /^[a-zA-Z0-9:_-]{1,180}$/.test(v);
const time = v => { const n=Date.parse(v||''); return Number.isFinite(n)?n:0; };
const pending = new Set(['done','completed','complete','cancelled','canceled','withdrawn','abandoned','rejected']);
const requireGuild = v => { if(!validId(v))throw new TypeError('A verified Guild identifier is required.');return v; };
const distinct = list => [...new Set(list.filter(Boolean))];

export function dailyNeuronBudget(capacity, spentToday=0) {
  // A protected burst reserve is NOT unallocated capacity. The capacity owner
  // must positively attest a system-usable, uncommitted free-neuron balance.
  const remaining=Number(capacity?.uncommittedSystemFreeNeurons);
  const charged=Number(spentToday);
  if(capacity?.verified!==true || !Number.isSafeInteger(remaining) || remaining<0
    || !Number.isSafeInteger(charged) || charged<0) return 0;
  return Math.max(0,Math.min(GUILD_DAILY_PLAN_POLICY.maximumDailyNeurons-charged,remaining));
}
export function dailyPlanKey(guildId,now=Date.now()) {
  requireGuild(guildId);
  if(!Number.isFinite(now))throw new TypeError('Invalid planner clock.');
  return 'guild-daily-plan:'+guildId+':'+new Date(now).toISOString().slice(0,10);
}
export function buildGuildDailyPlan(input={},options={}) {
  const guildId=requireGuild(options.guildId);
  const at=Number.isFinite(options.now)?options.now:Date.now(), day=new Date(at).toISOString().slice(0,10);
  const published=array(input.publications).filter(p=>p?.guildId===guildId&&p?.status==='published').slice(0,GUILD_DAILY_PLAN_POLICY.maximumQuests);
  const proposed=array(input.intentions).filter(i=>i?.guildId===guildId&&i?.state==='proposed'&&i?.adopted!==true);
  // Only explicit, Guild-visible requests attested by the canonical chat owner.
  const requests=array(input.chatRequests).filter(r=>r?.guildId===guildId&&r?.verified===true&&r?.visibility==='guild'&&r?.planningConsent===true).slice(0,GUILD_DAILY_PLAN_POLICY.maximumRequests);
  const candidates=[];
  for(const publication of published) {
    const q=publication.quest,paths=array(q?.plan?.paths).slice(0,12);
    if(pending.has(text(q?.state,30).toLowerCase()))continue;
    for(const [pi,path] of paths.entries()) {
      if(pending.has(text(path?.status,30).toLowerCase()))continue;
      const progress=new Set(array(path?.progress).filter(Number.isSafeInteger));
      for(const [si,step] of array(path?.steps).slice(0,64).entries()) {
        if(progress.has(si)||pending.has(text(step?.status,30).toLowerCase()))continue;
        const title=text(typeof step==='string'?step:step?.title,240);
        if(!title)continue;
        const id='quest:'+publication.id+':'+pi+':'+si;
        candidates.push({id,title,source:'published-quest',sourceId:publication.id,
          intention:text(q?.plan?.outcome,360),requiredSkills:distinct([text(path?.realm,80).toLowerCase()]),status:'draft',
          aiWork:'Prepare a reviewable contribution or identify the next blocker; do not claim completion.'});
        if(candidates.length>=60)break;
      }
      if(candidates.length>=60)break;
    }
  }
  for(const r of requests) {
    const title=text(r.taskTitle||r.request,240);
    if(title&&validId(r.id))candidates.push({id:'chat:'+r.id,title,source:'guild-chat-request',sourceId:r.id,
      requiredSkills:distinct(array(r.skillIds).map(s=>text(s,80).toLowerCase())),
      status:'draft',aiWork:'Prepare a reply or task proposal for review; do not execute an unapproved action.'});
  }
  for(const i of proposed.slice(0,20)) {
    const title=text(i.text,240);
    if(title&&validId(i.userId))candidates.push({id:'intention:'+i.userId+':'+i.revision,title:'Clarify proposed intention: '+title,
      source:'unratified-intention',sourceId:i.userId,requiredSkills:[],status:'draft',
      aiWork:'Review and offer a draft; this does not adopt an intention or bypass a Guild vote.'});
  }
  const aiTasks=candidates.slice(0,GUILD_DAILY_PLAN_POLICY.maxAiTasks).map(c=>({...c,actor:'ai',assigned:false}));
  const profiles=new Map(array(input.passports).filter(p=>p?.guildId===guildId&&p?.consent==='guild-planning')
    .map(p=>[p.userId,p]));
  const cutoff=at-GUILD_DAILY_PLAN_POLICY.recentContributionDays*86400000;
  // A self-claimed skill or XP alone is never proof of participation. Only the
  // task/evidence authority may supply verified accepted contribution receipts.
  const receipts=array(input.contributions).filter(r=>r?.guildId===guildId&&r?.verified===true
    &&r?.authority==='canonical-contribution'&&r?.accepted===true&&time(r?.occurredAt)>=cutoff&&time(r?.occurredAt)<=at);
  const byUser=new Map();
  for(const r of receipts) {
    if(!validId(r.userId)||!profiles.has(r.userId))continue;
    const list=byUser.get(r.userId)||[]; list.push(r);byUser.set(r.userId,list);
  }
  const humanOffers=[];
  for(const [userId,history] of byUser) {
    const passport=profiles.get(userId);
    if(passport.availableForOffers===false)continue;
    const demonstrated=new Set(history.flatMap(r=>array(r.skillIds)).map(s=>text(s,80).toLowerCase()).filter(Boolean));
    const claimed=new Set(array(passport.skills).map(s=>text(s.skillId,80).toLowerCase()).filter(Boolean));
    const tasks=candidates.filter(t=>t.requiredSkills.length&&t.requiredSkills.some(s=>demonstrated.has(s)&&claimed.has(s)));
    if(!tasks.length)continue;
    const task=tasks[0];
    humanOffers.push({id:'offer:'+day+':'+userId,memberUserId:userId,taskId:task.id,
      taskTitle:task.title,matchedSkills:task.requiredSkills.filter(s=>demonstrated.has(s)&&claimed.has(s)),
      acceptedContributionCount:history.length,action:'invite-to-volunteer',
      voluntary:true,assigned:false,requiresAcceptance:true});
    if(humanOffers.length>=GUILD_DAILY_PLAN_POLICY.maxHumanOffers)break;
  }
  return {schema:GUILD_DAILY_PLAN_SCHEMA,guildId,date:day,mode:'deterministic-preview',
    aiTasks,humanOffers,counts:{publishedQuests:published.length,intentionProposals:proposed.length,
      verifiedGuildChatRequests:requests.length,verifiedRecentContributors:byUser.size},
    authority:{humanTasksAssigned:0,aiTasksClaimed:0,questCompletions:0,governanceChanges:0},
    note:'Draft only. Human help is offered, never assigned; AI execution requires a separate authorized task claim.'};
}
export function applyDailyModelReview(plan,review={}) {
  // The model may rank known candidates and explain priorities, but cannot
  // manufacture a member task, permission, reward, quest completion or claim.
  const index=new Map(plan.aiTasks.map(t=>[t.id,t]));
  const seen=new Set(),ordered=[];
  for(const id of array(review.prioritizedTaskIds))if(index.has(id)&&!seen.has(id)){ordered.push(index.get(id));seen.add(id);}
  for(const row of plan.aiTasks)if(!seen.has(row.id))ordered.push(row);
  return {...plan,mode:'model-reviewed',aiTasks:ordered,
    summary:text(review.summary,1200),
    risks:array(review.risks).slice(0,6).map(r=>text(r,240)).filter(Boolean)};
}
export async function runDailyGuildPlanningCycle({storage,guildId,now=Date.now(),sources,ledger,model}={}) {
  const key=dailyPlanKey(guildId,now),day=new Date(now).toISOString().slice(0,10);
  if(!storage?.transaction||typeof sources?.load!=='function'||typeof ledger?.quote!=='function'
    ||typeof ledger?.reserve!=='function'||typeof ledger?.settle!=='function'
    ||typeof model?.review!=='function')throw new TypeError('Trusted context, transactional storage, metered ledger and model adapters are required.');
  const begun=await storage.transaction(async tx=>{
    const prior=await tx.get(key);
    if(prior)return {existing:true,record:prior};
    const record={schema:GUILD_DAILY_PLAN_SCHEMA,guildId,date:day,state:'started',startedAt:new Date(now).toISOString()};
    await tx.put(key,record);return {existing:false,record};
  });
  if(begun.existing)return {...begun.record,idempotent:true};
  let reservation=null,settled=false;
  try{
    const context=await sources.load({guildId,day});
    if(context?.verified!==true||context?.guildId!==guildId)throw new Error('The Guild context provider did not attest scope.');
    const base=buildGuildDailyPlan(context,{guildId,now});
    const quote=await ledger.quote({guildId,day,purpose:'guild-daily-planning'});
    const cap=dailyNeuronBudget(quote,Number(quote?.planningChargedToday||0));
    if(!cap){
      const saved={...begun.record,state:'skipped',reason:'no-verified-uncommitted-free-neurons',plan:base,chargedNeurons:0,finishedAt:new Date().toISOString()};
      await storage.put(key,saved);return saved;
    }
    reservation=await ledger.reserve({guildId,day,purpose:'guild-daily-planning',maximumNeurons:cap});
    if(!reservation?.reservationId||reservation?.verified!==true||reservation?.maximumNeurons>cap)
      throw new Error('Canonical planner neuron reservation was not verified.');
    // The model never receives credentials, private chats, or hidden Passport fields.
    const reviewed=await model.review({guildId,day,plan:base,maxNeurons:cap});
    const usage=reviewed?.usage;
    if(!Number.isSafeInteger(usage?.chargedNeurons)||usage.chargedNeurons<0||usage.chargedNeurons>cap)
      throw new Error('Model returned missing or out-of-budget metered usage.');
    const settlement=await ledger.settle({reservationId:reservation.reservationId,actualNeurons:usage.chargedNeurons});
    settled=true;
    if(settlement?.verified!==true||!Number.isSafeInteger(settlement?.chargedNeurons)
      ||settlement.chargedNeurons<0||settlement.chargedNeurons>cap)
      throw new Error('Canonical neuron settlement was not verified.');
    const saved={...begun.record,state:'completed',plan:applyDailyModelReview(base,reviewed),
      reservedCeiling:cap,chargedNeurons:settlement.chargedNeurons,finishedAt:new Date().toISOString()};
    await storage.put(key,saved);return saved;
  }catch(error){
    if(reservation&&!settled)await ledger.settle({reservationId:reservation.reservationId,actualNeurons:0}).catch(()=>{});
    const saved={...begun.record,state:'failed',error:text(String(error?.message||error),240),finishedAt:new Date().toISOString()};
    await storage.put(key,saved);return saved;
  }
}

/** Authenticated, zero-neuron preview from the canonical published Quest board.
 * Missing chat and contribution authority is explicit: never synthesize it.
 */
export async function readDailyGuildPlanPreview(storage,member,options={}) {
  const guildId=requireGuild(member?.guildId||member?.nodeId);
  if(!storage?.list||!storage?.get)throw new TypeError('Canonical Guild storage is required.');
  const publications=[...await storage.list({prefix:'guild-quest:active:'+guildId+':',limit:101})].map(([,v])=>v).slice(0,100);
  const state=await storage.get('guild-starling:'+guildId+':state');
  const users=array(state?.passportUsers).slice(0,500);
  const intentionUsers=array(state?.intentionUsers).slice(0,500);
  const [passports,intentions]=await Promise.all([
    Promise.all(users.map(id=>storage.get('guild-starling:'+guildId+':passport:'+id))),
    Promise.all(intentionUsers.map(id=>storage.get('guild-starling:'+guildId+':intention:'+id)))
  ]);
  const plan=buildGuildDailyPlan({publications,passports:passports.filter(Boolean),
    intentions:intentions.filter(Boolean),chatRequests:[],
    contributions:options.verifiedContributionFeed===true?array(options.contributions):[]},
    {guildId,now:options.now});
  return {ok:true,plan,cycleState:'preview-only',chargedNeurons:0,
    readiness:{publishedQuests:true,intentionProposals:true,consentingPassportClaims:true,
      guildChatRequests:false,verifiedContributionHistory:options.verifiedContributionFeed===true,
      scheduledInference:false,canonicalPlannerBilling:false},
    warning:'Chat requests are not yet imported; offers require independently verified accepted work and consenting Passport skills. This preview spends zero neurons.'};
}
