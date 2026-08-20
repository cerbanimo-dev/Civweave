(()=>{
'use strict';
const VERSION='1.2.0-local-guide-control-bypass-v1-community-garden-plan';
if(globalThis.CivweaveLocalGuideControlBypassV1?.version===VERSION)return;
let patched=null,timer=0;
const clean=value=>String(value??'').trim();
function controlKind(text=''){
  const value=clean(text).toLowerCase().replace(/[!?.,]+$/,'').trim();
  if(/^(?:test|testing|ping|check|mic check)$/.test(value))return'test';
  if(/^(?:hi|hello|hey|good morning|good afternoon|good evening)$/.test(value))return'greeting';
  if(/^(?:thanks|thank you|thx|got it|okay|ok)$/.test(value))return'ack';
  if(/\b(?:are you (?:real|alive|sentient|a real boy)|who are you|what are you|are you a person)\b/.test(value))return'identity';
  return'';
}
function systemFor(args={}){const value=clean(args.systemId||args?.context?.guide?.system).toLowerCase();return value||'civweave'}
function plannerContext(args={}){return{currentContext:{systemId:'civweave',roomId:'civweave.quad'},guide:{system:'civweave',name:'Weaveling'},routingAnswer:{system:'civweave',room:'civweave.quad',mode:'Plan'},...(args.context||{})}}
function communityGardenIntent(text=''){const value=clean(text);return /\b(?:community|shared|neighbou?rhood|friends?|team|group|together)\b/i.test(value)&&/\b(?:garden|gardening|grow|growing|vegetables?|produce|plants?)\b/i.test(value)}
function gardenPath(base,index,fallbackId,type,realm,title,purpose,steps,completionCriteria,evidence){return{...(base?.paths?.[index]||{}),id:base?.paths?.[index]?.id||`${fallbackId}-${Date.now().toString(36)}`,type,realm,title,purpose,steps,completionCriteria,evidence,status:'draft'}}
function specializeCommunityGarden(base,text=''){
  if(!base||!communityGardenIntent(text))return base;
  const paths=[
    gardenPath(base,0,'learning','learning','living-school','Learn the site, season, soil, and local rules','Make the first planting cycle realistic before the group spends money or builds beds.',['Choose a likely site and record sun, water access, drainage, current use, and who controls the land.','Check permission, zoning or property rules, water access, and any local community-garden requirements.','Test or assess the soil and decide whether in-ground beds, raised beds, or containers are appropriate.','Choose crops for the local growing season, available sunlight, group goals, and realistic maintenance capacity.','Sketch a simple bed and pathway layout with accessibility, compost, tool storage, and water in mind.'],'The group has a site feasibility note, a first-season crop list, and a layout that can be explained to every participant.',['Site and sun notes','Permission/rules checklist','Soil assessment','Crop calendar','First layout sketch']),
    gardenPath(base,1,'skilled','skilled-labor','cerbanimo','Organize and build the first community-garden cycle','Turn the idea into one small, maintainable shared garden before expanding.',['Gather the friends who want to participate and agree on the purpose of the garden.','Choose the site and secure explicit permission to use it.','Assign lightweight roles for site coordination, water, tools, compost, planting, and communication.','Prepare the site and build only the beds or containers the group can maintain.','Plant the first seasonal crop set and label beds clearly.','Create a watering, weeding, maintenance, and harvest rotation that survives vacations and missed days.','Run a four-week review and adjust crops, workload, rules, or bed count before expanding.'],'A first garden area is planted, every recurring task has an owner or rotation, and the group can maintain it for four weeks without relying on one person.',['Participant/role list','Site permission','Build-day checklist','Planting map','Maintenance rotation','Four-week review']),
    gardenPath(base,2,'material','material-acquirement','fellowfare','Secure the land, water, soil, seeds, and shared tools','Acquire only what the first planting cycle actually needs and favor borrowing, reuse, donation, and local sourcing before new purchases.',['List the minimum site, bed/container, soil/compost, seed/seedling, watering, tool, storage, and accessibility needs.','Mark which items can be borrowed, donated, reclaimed, shared, traded, or purchased.','Price the remaining gaps and agree on a spending ceiling before anyone commits money.','Confirm where tools and supplies will live and who can access them.','Acquire materials in build order so the group does not accumulate unusable supplies.'],'The group has everything required for the first build and planting day, knows what each item cost or where it came from, and has a storage/access plan.',['Materials list','Source/borrow/donate map','Shared budget','Tool/storage plan','Receipts or contribution record'])
  ];
  return{
    ...base,
    title:'Create a community garden with friends',
    outcome:'Establish a small shared garden on an approved site, complete the first planting cycle, and leave the group with a fair maintenance and harvest system that can continue without depending on one person.',
    signals:{...(base.signals||{}),garden:true,collective:true,food:true,communityGarden:true},
    assumptions:[
      'The group will begin with a first-season pilot rather than trying to build the final garden all at once.',
      'No land, spending, or recurring labor commitment is treated as agreed until the people responsible explicitly consent.',
      'Crop choices and planting dates will be adjusted to the actual site and local growing season.',
      'Progress evidence is for coordination and revision, not for ranking participants.'
    ],
    paths,
    governance:{
      ...(base.governance||{}),
      title:'Agree how the shared garden will be cared for and shared',
      purpose:'Keep access, labor, spending, harvest, and decisions legible enough that friendship is not forced to carry unresolved logistics.',
      agreements:['Name who can use the garden and how new participants join.','Agree on recurring maintenance expectations and an easy way to swap or miss a shift.','Require explicit consent before shared spending or major site changes.','Decide how harvest is shared, donated, preserved, or sold before the first harvest.','Keep an objection, conflict, and exit path that does not punish someone for leaving.','Set a four-week review date for the first cycle.'],
      reviewQuestion:'Do the people maintaining the garden agree that the workload, access, spending, and harvest rules are fair enough to activate this Quest?',
      status:'draft'
    },
    communityGardenPlanV1:true
  };
}
function platformPlan(args={}){
  if(systemFor(args)!=='civweave')return null;
  const planner=globalThis.CivweaveIntentionPlanner,text=clean(args.text),history=Array.isArray(args.history)?args.history:[],context=plannerContext(args);
  if(!text||!planner?.shouldCreate||!planner?.buildPlan||!planner?.persist||!planner?.format)return null;
  let should=false;try{should=Boolean(planner.shouldCreate({text,history,context}))}catch{return null}if(!should)return null;
  let built,item,plan;try{built=specializeCommunityGarden(planner.buildPlan({text,history,context}),text);item=planner.persist(built);plan=item?.plan||built}catch{return null}if(!plan)return null;
  const approvalGate={kind:'intention-activation',planId:item?.id||plan.id||'',state:item?.state||plan.state||'review',required:true,actions:['review','revise','activate']};
  const answer=planner.format(plan);if(!answer)return null;
  return{
    item,plan,
    response:{answer,choice:{mode:'Plan',system:'civweave',room:plan?.routing?.room||'civweave.quad',nextAction:'Review, revise, or activate the saved Quest.'},assumptions:plan.assumptions||[],requiresConsent:true,confidence:.98,approvalGate},
    provider:'civweave-platform-planner',
    requestedProvider:'downloaded-local',
    model:'platform-plan',
    responseRouting:{schema:'civweave.response-route.v1',system:'civweave',taskClass:'platform-plan',artifactClass:'Quest',networkRequired:false,confidence:1,source:'local-guide-control-bypass-v1-planner-first',provider:'civweave-platform-planner',model:'platform-plan',localProviderPinned:true},
    platformPlanning:true,
    localGenerationSkipped:true,
    communityGardenPlan:Boolean(plan.communityGardenPlanV1)
  };
}
function patch(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;if(!api||typeof current!=='function')return false;
  if(current.__cwLocalGuideControlBypassV1&&current.__cwLocalGuideControlBypassVersion===VERSION){patched=current;return true}
  if(!current.__civweaveLocalProviderAuthorityV1||typeof current.__prior!=='function')return false;
  const local=current.bind(api),deterministic=current.__prior.bind(api);
  const respond=async args=>{
    const input=args||{},control=controlKind(input.text);
    if(control)return deterministic(input);
    const planned=platformPlan(input);if(planned)return planned;
    return local(input);
  };
  respond.__cwLocalGuideControlBypassV1=true;respond.__cwLocalGuideControlBypassVersion=VERSION;respond.__prior=current;respond.__cwWeavelingPlannerFirstV1=true;respond.__cwCommunityGardenPlanV1=true;
  for(const key of ['__civweaveLocalProviderAuthorityV1','__civweaveLocalProviderAuthorityVersion','__cwPlatformGuideGuardsV1','__cwUnifiedChatSystemV1','__weavelingPlanJsonV190','__guideIdentityIntegrityV216','__cwGuideCapabilityPassoverV1','__deterministicModeV175','__cwMossLearningGoalPlannerV1'])if(current[key])respond[key]=current[key];
  try{api.respond=respond}catch{}if(api.respond!==respond){try{globalThis.CivweaveAssistantV141={...api,respond}}catch{return false}}
  patched=globalThis.CivweaveAssistantV141?.respond||respond;
  try{dispatchEvent(new CustomEvent('civweave:local-guide-control-bypass-ready',{detail:{version:VERSION,controls:['test','greeting','ack','identity'],weavelingPlannerFirst:true,communityGardenPlan:true}}))}catch{}
  return true
}
for(const name of ['civweave:local-provider-authority-installed','civweave:assistant-runtime-ready','civweave:guide-loader-reset','civweave:unified-chat-system-ready','civweave:guide-capability-passover-ready','pageshow'])addEventListener(name,()=>queueMicrotask(patch));
patch();let attempts=0;timer=setInterval(()=>{attempts+=1;patch();if(attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveLocalGuideControlBypassV1=Object.freeze({version:VERSION,patch,controlKind,communityGardenIntent,specializeCommunityGarden,platformPlan,weavelingPlannerFirst:true,communityGardenPlanV1:true,state:()=>Object.freeze({installed:Boolean(patched)})});
})();