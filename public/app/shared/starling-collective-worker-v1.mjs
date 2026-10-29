import {guildQuestBeatSnapshot,discoverGuildOpportunities,STARLING_PERSONAS} from './starling-collective-v1.mjs';
import {STARLING_PROJECT_KIND,STARLING_TASK_OUTPUT_KIND,autonomousTaskPolicy,parseAutonomousProject,validateAutonomousProject,findNextAutonomousTask} from './starling-autonomous-projects-v1.mjs';

/**
 * Starling Collective cooperative worker.
 *
 * All durable state is signed objects in Civweave's existing object mesh.
 * Model calls belong to the existing single local Civweave model runtime.
 * This worker is a proposer and reviewer; it NEVER authors an authoritative
 * Cerbanimo claim, Quest completion, human vote or financial transaction.
 *
 * An active browser can schedule opt-in local turns. Browser closure pauses
 * execution; the signed policy/journal survive and resume on next open.
 * Future server hosts must reuse this policy and provide independent
 * exclusive leases before unattended, cross-device scheduling.
 */
export const STARLING_WORKER_POLICY='civweave.starling-collective-worker-policy.v1';
export const STARLING_WORK_RECEIPT='civweave.starling-collective-work-receipt.v1';
const RECEIPT_SCHEMA='civweave.starling-work-receipt.v1';
const clean=(x,max=240)=>typeof x==='string'?x.trim().slice(0,max):'';
const validGuild=x=>/^[A-Za-z0-9:_-]{1,180}$/.test(clean(x,180));
const INTENTION_PERSONAS=Object.freeze(['kami','rosa','sana','farah','kit','jae','anthony','aphra']);
const MIN_INTERVAL=15;
const MAX_DAILY=12;

export function createStarlingGuildWorker({mesh,turnService,founder,now=()=>Date.now(),randomId=()=>crypto.randomUUID(),setAlarm=(cb,ms)=>setTimeout(cb,ms),clearAlarm=handle=>clearTimeout(handle),withExclusiveLock,readTaskOpportunities,readVerifiedHumanSkills}={}){
  if(!mesh?.getObject||!mesh?.createObject||!mesh?.listObjects||!mesh?.validateObject||!mesh?.deviceId||!turnService?.runOneTurn||typeof founder!=='function')throw new TypeError('Canonical mesh, turn service, and founding-device owner are required.');
  let busy=false,timer=null,stopped=true,activeGuild=null,generation=0;

  async function founding(guild){
    if(!validGuild(guild))throw new TypeError('Guild ID required.');
    const row=await mesh.getObject('guild-genesis:'+guild);
    const good=row?.kind==='civweave.guild-genesis.v1'
      &&row.payload?.guildId===guild &&row.origin?.nodeId===row.payload?.foundingDeviceId
      &&(await mesh.validateObject(row))?.ok===true;
    if(!good)throw new Error('Valid signed Guild genesis required for Collective worker.');
    return row;
  }
  async function requireFounder(guild){
    const row=await founding(guild),own=founder();
    if(own?.guildId!==guild||own.deviceId!==row.origin.nodeId||(await mesh.deviceId())!==row.origin.nodeId)
      throw new Error('Only this Guild founding device can manage its local Collective worker.');
    return row;
  }
  async function policy(guild,signer){
    const row=await mesh.getObject('starling-worker-policy:'+guild);
    if(!row)return null;
    if(row.kind!==STARLING_WORKER_POLICY||row.consent!=='private'||row.payload?.guildId!==guild
      ||row.payload?.schema!==STARLING_WORKER_POLICY||row.origin?.nodeId!==signer
      ||(await mesh.validateObject(row))?.ok!==true)return null;
    const p=row.payload;
    if(typeof p.enabled!=='boolean'||!Number.isInteger(p.intervalMinutes)||p.intervalMinutes<MIN_INTERVAL||p.intervalMinutes>1440
      ||!Number.isInteger(p.dailyLimit)||p.dailyLimit<1||p.dailyLimit>MAX_DAILY)return null;
    if(p.goal!==undefined&&(typeof p.goal!=='string'||p.goal.length>4000))return null;
    if(p.siloMode!==undefined&&typeof p.siloMode!=='boolean')return null;
    return Object.freeze({...p,revision:row.revision});
  }
  async function status(guildId){
    const guild=clean(guildId,180),genesis=await founding(guild),p=await policy(guild,genesis.origin.nodeId);
    return Object.freeze({schema:STARLING_WORKER_POLICY,guildId:guild,enabled:p?.enabled===true,intervalMinutes:p?.intervalMinutes??60,dailyLimit:p?.dailyLimit??4,revision:p?.revision??0,goal:p?.goal||'',goalId:p?.goalId||null,siloMode:p?.siloMode===true,active:!stopped&&activeGuild===guild,busy});
  }
  async function storePolicy(guild,enabled,{confirmConsent,intervalMinutes,dailyLimit,goal,siloMode}={}){
    const genesis=await requireFounder(guild);
    if(enabled&&(!confirmConsent||confirmConsent({guildId:guild,mode:'local-only',share:'guild-members'})!==true))throw new Error('Explicit Guildkeeper consent is required to enable the local Collective worker.');
    const current=await policy(guild,genesis.origin.nodeId);
    const interval=Math.max(MIN_INTERVAL,Math.min(1440,Number.isInteger(intervalMinutes)?intervalMinutes:current?.intervalMinutes??60));
    const daily=Math.max(1,Math.min(MAX_DAILY,Number.isInteger(dailyLimit)?dailyLimit:current?.dailyLimit??4));
    const selectedGoal=goal===undefined?current?.goal||'':typeof goal==='string'?goal.trim():'';
    if(selectedGoal&&(selectedGoal.length<12||selectedGoal.length>4000))throw new Error('A Guild main goal must contain 12–4000 characters.');
    if(goal!==undefined&&!selectedGoal)throw new Error('A valid Guild goal is required to start autonomous project generation.');
    const nextSilo=siloMode===undefined?current?.siloMode===true:siloMode===true;
    const goalId=selectedGoal&&current?.goal===selectedGoal&&current?.siloMode===nextSilo&&current?.goalId?current.goalId:selectedGoal?'goal-'+clean(String(randomId()),80):null;
    const p={schema:STARLING_WORKER_POLICY,guildId:guild,enabled,intervalMinutes:interval,dailyLimit:daily,goal:selectedGoal,goalId,siloMode:nextSilo,localOnly:true,updatedAt:new Date(now()).toISOString()};
    await mesh.createObject({id:'starling-worker-policy:'+guild,revision:(current?.revision||0)+1,kind:STARLING_WORKER_POLICY,purpose:'Guildkeeper-controlled local Collective scheduler consent.',consent:'private',audience:[],publish:false,payload:p});
    return status(guild);
  }
  async function enable(guildId,options={}){return storePolicy(clean(guildId,180),true,options)}
  async function disable(guildId){
    stop();
    return storePolicy(clean(guildId,180),false);
  }
  async function receipts(guild,signer,revision){
    const rows=await mesh.listObjects(),verified=[];
    for(const row of Array.isArray(rows)?rows:[]){
      const p=row?.payload;
      if(row?.kind!==STARLING_WORK_RECEIPT||row?.consent!=='group'||row.origin?.nodeId!==signer
         ||!row.audience?.includes('guild:'+guild)||p?.schema!==RECEIPT_SCHEMA||p.guildId!==guild||p.policyRevision!==revision
         ||!['started','completed','failed'].includes(p.status)||!clean(p.runId,180)||!Number.isFinite(Date.parse(p.at)))continue;
      if((await mesh.validateObject(row))?.ok===true)verified.push(p);
    }
    return verified.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.runId.localeCompare(b.runId)||a.status.localeCompare(b.status));
  }
  async function record(guild,revision,runId,status,extra={}){
    const payload={schema:RECEIPT_SCHEMA,guildId:guild,policyRevision:revision,runId,status,at:new Date(now()).toISOString(),...extra};
    return mesh.createObject({id:'starling-work-receipt:'+guild+':'+runId+':'+status,revision:1,kind:STARLING_WORK_RECEIPT,purpose:'Auditable local Starling worker attempt; model output is a self-report until independently reviewed.',consent:'group',audience:['guild:'+guild],publish:true,priority:35,payload});
  }
  /** Signed autonomous project backlog. A project is never an activated
   * Cerbanimo Quest; AI-produced task drafts are reviewed independently. */
  async function readProjects(guildId){
    const guild=clean(guildId,180),genesis=await requireFounder(guild);
    const p=await policy(guild,genesis.origin.nodeId),rows=await mesh.listObjects();
    const projects=[],outputs=[];
    for(const row of Array.isArray(rows)?rows:[]){
      const v=row?.payload;
      if(![STARLING_PROJECT_KIND,STARLING_TASK_OUTPUT_KIND].includes(row?.kind)
         ||row.consent!=='group'||!row.audience?.includes('guild:'+guild)
         ||row.origin?.nodeId!==genesis.origin.nodeId||v?.guildId!==guild
         ||v?.goalId!==p?.goalId||(await mesh.validateObject(row))?.ok!==true)continue;
      if(row.kind===STARLING_PROJECT_KIND&&v?.schema===STARLING_PROJECT_KIND&&Array.isArray(v.tasks))
        projects.push({...v,id:row.id});
      if(row.kind===STARLING_TASK_OUTPUT_KIND&&v?.schema===STARLING_TASK_OUTPUT_KIND&&v.reviewRequired===true)
        outputs.push({...v,id:row.id});
    }
    projects.sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
    return Object.freeze({projects,outputs,goalId:p?.goalId||null});
  }
  async function autonomousTick({guild,p,signer,personaId}){
    const board=await readProjects(guild),pending=findNextAutonomousTask(board.projects,board.outputs);
    const windowStart=now()-86400000;
    const created=board.projects.filter(x=>Date.parse(x.createdAt)>windowStart);
    // A project counts as active only while it has AI drafting work pending.
    // Human tasks remain unassigned proposals, not work orders.
    const active=board.projects.filter(project=>findNextAutonomousTask([project],board.outputs)).length;
    if(!pending&&(created.length>=6||active>=3))return {status:'autonomous-project-limit',executed:0,createdInWindow:created.length,activeProjects:active};
    const runId=clean(String(randomId()),80);
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(runId))throw new TypeError('Worker run ID must be a safe opaque identifier.');
    const action=pending?'draft-task':'create-project';
    await record(guild,p.revision,runId,'started',{personaId,action,projectId:pending?.project.id||null,taskId:pending?.task.id||null});
    try{
      if(pending){
        const {project,task}=pending;
        const response=await turnService.runOneTurn({
          guildId:guild,personaId,workMode:'task-draft',
          taskPrompt:'Work on one assigned AI drafting task. Guild main goal: '+clean(p.goal,1700)+
          '. Project: '+clean(project.title,180)+'. Your task: '+clean(task.title,220)+
          '. Required TEXT deliverable: '+clean(task.deliverable,800)+
          '. Produce the actual draft output now, not a plan to produce it later. No physical action, publishing, external research claims, purchase, human assignment or false verification.'
        });
        const text=clean(response?.payload?.text,3500);
        if(!text)throw new Error('The local model returned no usable AI task draft.');
        const payload={schema:STARLING_TASK_OUTPUT_KIND,guildId:guild,goalId:p.goalId,policyRevision:p.revision,projectId:project.id,taskId:task.id,personaId,
          text,sourceTurnId:response.id,at:new Date(now()).toISOString(),reviewRequired:true,status:'draft-awaiting-human-review',
          canonicalProof:false,completed:false};
        await mesh.createObject({id:'starling-task-output:'+guild+':'+runId,revision:1,kind:STARLING_TASK_OUTPUT_KIND,
          purpose:'Unverified AI text deliverable for a self-proposed Guild project.',consent:'group',audience:['guild:'+guild],publish:true,payload});
        await record(guild,p.revision,runId,'completed',{personaId,action,projectId:project.id,taskId:task.id,turnId:response.id});
        return {status:'task-drafted',executed:1,personaId,projectId:project.id,taskId:task.id};
      }
      const policy=autonomousTaskPolicy({siloMode:p.siloMode,verifiedHumanSkills:typeof readVerifiedHumanSkills==='function'?await readVerifiedHumanSkills(guild):[]});
      const request=await turnService.runOneTurn({
        guildId:guild,personaId,workMode:'project',
        taskPrompt:'Create ONE NEW concrete, independently useful project based on the ongoing Guild main goal: '+clean(p.goal,2100)+
          '. Existing projects: '+board.projects.slice(-10).map(x=>x.title).join(' | ')+
          '. Reply ONLY valid compact JSON: {"title":"...","outcome":"tangible text deliverable","tasks":[{"assignee":"ai","kind":"writing","title":"...","deliverable":"Draft article text"}]}. '+
          'Propose 1–4 specific AI-capable creative, analysis, drafting, coding-draft, review, education or advocacy-content tasks.'+
          (policy.aiOnly?' HUMAN SKILLS UNKNOWN OR SILO ENABLED: all tasks MUST be assigned to "ai"; propose NO human, street, animal-care, construction or other physical work.':' Human tasks may appear only as UNASSIGNED proposals requiring one of these VERIFIED available skills: '+policy.humanSkills.join(', ')+'.')+
          ' This project is a reviewable internal proposal, not a completed Quest. Do not propose buying, posting or physically performing actions.'
      });
      const proposed=parseAutonomousProject(request?.payload?.text);
      const project=validateAutonomousProject(proposed,{guildId:guild,goal:p.goal,siloMode:p.siloMode,verifiedHumanSkills:policy.humanSkills});
      const projectId='starling-auto-project:'+guild+':'+runId;
      const payload={...project,goalId:p.goalId,policyRevision:p.revision,createdAt:new Date(now()).toISOString(),originTurnId:request.id};
      await mesh.createObject({id:projectId,revision:1,kind:STARLING_PROJECT_KIND,
        purpose:'Autonomously proposed Guild AI project: reviewable drafts only, no human assignments or canonical Quest completion.',
        consent:'group',audience:['guild:'+guild],publish:true,payload});
      await record(guild,p.revision,runId,'completed',{personaId,action,projectId,turnId:request.id});
      return {status:'project-created',executed:1,personaId,projectId,aiTasks:project.tasks.filter(x=>x.assignee==='ai').length};
    }catch(error){
      await record(guild,p.revision,runId,'failed',{personaId,action,error:clean(String(error?.message||error),280)});
      throw error;
    }
  }
  async function oneTick(guild){
    const genesis=await requireFounder(guild),p=await policy(guild,genesis.origin.nodeId);
    if(!p?.enabled)return {status:'disabled',executed:0};
    const events=await receipts(guild,genesis.origin.nodeId,p.revision);
    const runs=new Map();
    for(const item of events){const list=runs.get(item.runId)||[];list.push(item);runs.set(item.runId,list)}
    for(const list of runs.values()){
      if(list.some(x=>x.status==='started')&&!list.some(x=>x.status==='completed'||x.status==='failed'))
        return {status:'interrupted-review-required',executed:0};
      if(list.some(x=>x.status==='failed'))return {status:'failed-review-required',executed:0};
    }
    const startOfDay=new Date(now());startOfDay.setUTCHours(0,0,0,0);
    const attempts=events.filter(x=>x.status==='started'&&Date.parse(x.at)>=startOfDay.getTime());
    if(attempts.length>=p.dailyLimit)return {status:'daily-limit',executed:0};
    const latest=events.filter(x=>x.status==='completed').sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
    if(latest&&now()-Date.parse(latest.at)<p.intervalMinutes*60000)return {status:'cooldown',executed:0};
    const personaId=INTENTION_PERSONAS[attempts.length%INTENTION_PERSONAS.length];
    if(p.goal)return autonomousTick({guild,p,signer:genesis.origin.nodeId,personaId,runIdSeed:attempts.length});
    // Only a verified member-authenticated board adapter may return candidate
    // human projects. A model's own claims of task permission are ignored.
    let opportunity=null;
    if(typeof readTaskOpportunities==='function'){
      try{const candidates=await readTaskOpportunities(guild);
        if(Array.isArray(candidates)){const alreadyOffered=new Set(events.filter(x=>x.status==='completed'&&x.offerOnly===true&&clean(x.beatId,180)).map(x=>x.beatId));opportunity=candidates.find(candidate=>candidate?.guildId===guild&&candidate.action==='suggest-offer-only'&&candidate.requiresCanonicalClaim===true&&clean(candidate.beatId,180)&&!alreadyOffered.has(candidate.beatId)&&clean(candidate.beatTitle,500))||null;}
      }catch{} // An unavailable Guild board cannot block offline intention work.
    }
    const runId=clean(String(randomId()),80);
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(runId))throw new TypeError('Worker run ID must be an opaque safe identifier.');
    await record(guild,p.revision,runId,'started',{personaId,questId:opportunity?.questId||null,beatId:opportunity?.beatId||null});
    try{
      // The local turn service contains the model routing and signed transcript
      // owner. A run never marks a canonical Cerbanimo Quest beat complete.
      const taskPrompt=opportunity?'Review the member-posted Quest beat "'+clean(opportunity.beatTitle,240)+'" as an opportunity to offer voluntary AI assistance. Draft a concrete proposal aligned with the Guild Intention. State that this is an offer only: do not claim the task, spend resources, or mark it completed.':'Review our Guild founding Intention and recent Collective discussion. Produce one practical, reviewable contribution. Do not claim a task or mark work complete.';
      const output=await turnService.runOneTurn({guildId:guild,personaId,questId:opportunity?.questId||'',taskPrompt});
      await record(guild,p.revision,runId,'completed',{personaId,questId:opportunity?.questId||null,beatId:opportunity?.beatId||null,offerOnly:Boolean(opportunity),turnId:clean(output?.payload?.turnId||output?.id,180)});
      return {status:'completed',executed:1,personaId,offerOnly:Boolean(opportunity),turnId:clean(output?.payload?.turnId||output?.id,180)};
    }catch(error){
      await record(guild,p.revision,runId,'failed',{personaId,error:clean(String(error?.message||error),280)});
      throw error;
    }
  }
  async function tick(guildId){
    const guild=clean(guildId,180);
    if(busy)return {status:'busy',executed:0};
    busy=true;
    try{
      if(typeof withExclusiveLock==='function')return await withExclusiveLock('starling-worker:'+guild,()=>oneTick(guild));
      return await oneTick(guild);
    }finally{busy=false}
  }
  /**
   * Cooperative timer: only operates while an active browser/host keeps this
   * owner alive. A persisted Guildkeeper opt-in is not permission to start
   * inference during ordinary app startup or without a local host.
   */
  async function start(guildId,{onStatus}={}){
    const guild=clean(guildId,180),state=await status(guild);
    if(!state.enabled)throw new Error('Enable this Guild local Collective worker explicitly first.');
    stop();stopped=false;activeGuild=guild;
    const myGeneration=++generation;
    const cycle=async()=>{
      if(stopped||myGeneration!==generation)return;
      let result;
      try{result=await tick(guild)}
      catch(error){result={status:'failed',error:clean(String(error?.message||error),300)}}
      if(stopped||myGeneration!==generation)return;
      if(typeof onStatus==='function')try{onStatus(result)}catch{}
      // A failed or interrupted run needs review; never retry it silently.
      if(['failed','failed-review-required','interrupted-review-required','disabled'].includes(result.status))return;
      const current=await status(guild);
      if(!current.enabled||stopped||myGeneration!==generation)return;
      const delay=Math.max(60000,Math.min(1440,current.intervalMinutes)*60000);
      timer=setAlarm(()=>void cycle(),delay);
    };
    void cycle();
    return Object.freeze({status:'scheduled-local-only',guildId:guild});
  }
  function stop(){stopped=true;activeGuild=null;generation++;if(timer!==null){clearAlarm(timer);timer=null}}
  async function discover(guildId,{guild,questClient,capabilities=[],verifyHumanPublisher}={}){
    const selected=clean(guildId,180);
    if(!validGuild(selected)||!guild||guild.id!==selected||typeof questClient?.list!=='function'||!questClient.sessionForGuild?.(guild)
      ||typeof verifyHumanPublisher!=='function')return[];
    let cursor='',pages=0,all=[],seen=new Set();
    do{
      const packet=await questClient.list(guild,{cursor});
      if(!packet||packet.guildId!==selected||!Array.isArray(packet.quests))throw new Error('The authenticated Quest board changed Guild or returned malformed records.');
      for(const item of packet.quests)if(item?.id&&!seen.has(item.id)){all.push(item);seen.add(item.id)}
      cursor=clean(packet.nextCursor,2000);pages++;
    }while(cursor&&pages<5&&all.length<500);
    const snapshot=guildQuestBeatSnapshot({guildId:selected,publications:all});
    return discoverGuildOpportunities({snapshot,capabilities,verifyHumanPublisher});
  }
  return Object.freeze({status,enable,disable,tick,start,stop,discover,readProjects});
}
