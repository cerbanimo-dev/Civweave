(()=>{'use strict';

const VERSION='1.2.0-unified-chat-system-v1-local-ai-learning-plan';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const ROOT_ID='cw-persistent-guide-chat-v215';
const PENDING_PREFIX='civweave.chat.capability.pending';
const LEARNING_PLAN_KEY=`${PENDING_PREFIX}.living-school.plan.v1`;
const WEAVELING_ORCHESTRATOR_PATH='/extensions/civweave-weaveling-plan-json-v190.js';
const MEMORY_FOLDERS=Object.freeze(Object.fromEntries(SYSTEMS.map(system=>[system,`civweave.guide-thread.${system}.v237`])));
const THEMES=Object.freeze({
  civweave:{name:'Weaveling',label:'Civweave'},
  'living-school':{name:'Moss',label:'Living School'},
  cerbanimo:{name:'Kamiya',label:'Cerbanimo'},
  fellowfare:{name:'Rook',label:'FellowFare'},
  anarchadia:{name:'Merlin',label:'Anarchadia'}
});

if(globalThis.CivweaveUnifiedChatSystemV1?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const capabilityHandlers=new Map();
let assistantPatched=false;
let loaderPatched=false;
let lifecycleBound=false;
let pendingRun=null;
let orchestratorPromise=null;

function activeTheme(){
  const candidate=globalThis.CivweavePersistentGuideChatV215?.activeWindow?.()
    ||globalThis.CivweaveGuideWorkspaceV242?.state?.().activeWindow
    ||document.documentElement?.dataset?.civweaveSystemRoute
    ||'civweave';
  return SYSTEMS.includes(candidate)?candidate:'civweave';
}

function memoryFolder(system=activeTheme()){
  return MEMORY_FOLDERS[SYSTEMS.includes(system)?system:'civweave'];
}

function normalizeSurface(){
  const root=document.getElementById(ROOT_ID);
  if(!root)return false;
  root.dataset.chatArchitecture='one-core-five-themes';
  root.dataset.memoryIsolation='five-folders';
  const nav=root.querySelector('.cw242-window-switcher');
  if(nav)nav.setAttribute('aria-label','Chat themes');
  root.querySelectorAll('[data-cw242-window]').forEach(button=>{
    const system=clean(button.dataset.cw242Window,80);
    const theme=THEMES[system];
    if(theme)button.setAttribute('aria-label',`Switch to ${theme.name} · ${theme.label}`);
  });
  const label=root.querySelector('[data-window-label]');
  if(label&&/WINDOW/i.test(label.textContent||''))label.textContent=(label.textContent||'').replace(/WINDOW/gi,'THEME');
  return true;
}

function stateForLivingSchool(){
  try{return globalThis.LivingSchoolCleanroomV218?.getState?.()||parse(localStorage.getItem('civweave.living-school.cabinet.v151'),{})}catch{return{}}
}

const STRUCTURE=/\b(learning journey|curriculum|course|syllabus|learning path|learning pathway|learning program|learning plan|study plan|lesson plan|skill tree)\b/i;
const BUILD=/\b(build|create|make|generate|draft|design|develop|structure|regenerate|rebuild|revise|update|convert|start)\b/i;
const REVISE=/\b(revise|update|regenerate|rebuild|edit|change|modify|continue|add|remove|expand|deepen|shorten|simplify)\b/i;
const PLAN_REVISION=/\b(make it|make this|focus (?:it|this)|more about|less about|instead|swap|replace|reorder|add|remove|shorter|longer|fewer|more modules?|change|revise|edit|adjust)\b/i;
const PRONOUN_BUILD=/^\s*(?:yes[,! ]*)?(?:let['’]?s\s+)?(?:go\s+ahead\s+and\s+)?(?:draft|build|make|generate|create|rebuild|revise|do)\s+(?:it|that|this)\s*[.!]?\s*$/i;
const CONTINUE=/^\s*(?:[.…·•-]{1,8}|continue|continue please|keep going|go on|carry on|resume|resume please|finish|finish it|finish this|pick up where (?:you|we) left off|continue where (?:you|we) left off|and continue)\s*[.!?]*\s*$/i;
const TEST=/^\s*(?:test|testing|ping|check|mic check)\s*[.!?]*\s*$/i;
const LEARNING_GOAL=/\b(?:i\s+(?:want|need|would\s+like|['’]?d\s+like|hope|plan|intend|aim)\s+to\s+(?:learn|study|master|practice|understand)|my\s+(?:goal|objective)\s+is\s+to\s+(?:learn|study|master|practice|understand)|help\s+me\s+(?:learn|study|master|practice|understand)|teach\s+me\s+(?:how\s+to\s+)?|(?:learn|study|master|practice)\s+(?:how\s+to\s+)?[a-z0-9])\b/i;
const LEARNING_PLAN_CONTROL=Object.freeze({
  approve:/^\s*(?:please\s+)?(?:approve|approve it|approve plan|approve the plan|approve learning journey|approve the learning journey|materialize|materialize it|generate it|build it|start it|create the learning journey|generate the learning journey)(?:\s+now)?[.!]?\s*$/i,
  review:/^\s*(?:please\s+)?(?:review|review it|review plan|review the plan|show plan|show the plan|show learning journey|show the learning journey)[.!]?\s*$/i,
  revise:/^\s*(?:please\s+)?(?:revise|revise it|revise plan|revise the plan|change plan|change the plan|edit plan|edit the plan)[.!]?\s*$/i
});
const LOCAL_PLAN_PROVIDERS=new Set(['downloaded-local','generative-local','local-ai','smollm2','smollm3','qwen','browser']);
const LEARNING_PLAN_SCHEMA=Object.freeze({
  type:'object',
  required:['title','capability','level','proof','modules','assumptions'],
  properties:{
    title:{type:'string'},
    capability:{type:'string'},
    level:{type:'string',enum:['beginner','intermediate','advanced']},
    mode:{type:'string',enum:['guided','just-in-time','browse']},
    proof:{type:'string'},
    modules:{type:'array',minItems:3,maxItems:8,items:{type:'object',required:['title','focus','outcome'],properties:{
      title:{type:'string'},focus:{type:'string'},outcome:{type:'string'}
    }}},
    assumptions:{type:'array',maxItems:6,items:{type:'string'}}
  }
});
const MUTATION_CLAIM=/(?:\b(?:i|we)(?:['’]ve|\s+have)\s+(?:drafted|created|built|generated|structured|saved|updated|revised|made)\b|\b(?:has\s+been|was)\s+(?:created|generated|built|saved|drafted|structured|revised)\b)/i;

function rowsFor(options={}){
  const rows=Array.isArray(options.history)?options.history.slice(-18):[];
  const current=clean(options.text,12000);
  if(current&&!rows.some((row,index)=>index>=rows.length-2&&clean(row?.text||row?.content,12000)===current))rows.push({role:'user',text:current});
  return rows.map(row=>({role:clean(row?.role,40)||'unknown',text:clean(row?.text||row?.content,5000)})).filter(row=>row.text);
}
function recentStructure(rows){return rows.slice(-10).some(row=>STRUCTURE.test(row.text))}
function curriculumIntent(text,history=[]){
  const value=clean(text,4000),rows=[...history.map(row=>({role:clean(row?.role,40)||'unknown',text:clean(row?.text||row?.content,4000)})),{role:'user',text:value}];
  if(!value)return false;
  if(STRUCTURE.test(value)&&(BUILD.test(value)||/\b(?:want|need|please|let['’]?s|ready|help)\b/i.test(value)))return true;
  if(PRONOUN_BUILD.test(value)&&recentStructure(rows))return true;
  if(CONTINUE.test(value)&&recentStructure(rows))return true;
  return BUILD.test(value)&&/\b(?:learning|lessons?|modules?)\b/i.test(value)&&recentStructure(rows);
}
function learningJourneyIntent(text,history=[]){
  const value=clean(text,4000);
  if(!value||TEST.test(value))return false;
  if(curriculumIntent(value,history))return true;
  return LEARNING_GOAL.test(value);
}
function sentenceTail(value){return clean(value,1200).replace(/^[\s:,-]+/,'').split(/(?<=[.!?])\s+/)[0].replace(/[.!?]+$/,'').trim()}
function normalizeSubject(value){return clean(sentenceTail(value).replace(/^how\s+(?:do|can|could|should|would)\s+(?:i|we)\s+/i,'').replace(/^how\s+to\s+/i,'').replace(/^learn(?:ing)?\s+(?:how\s+to\s+|to\s+)/i,'').replace(/^to\s+/i,'').replace(/^(?:about|on)\s+/i,''),1200)}
function explicitSubject(text){
  const value=clean(text,5000),structure='(?:learning journey|curriculum|course|syllabus|learning path|learning pathway|learning program|learning plan|study plan|lesson plan|skill tree)',patterns=[
    new RegExp(`\\b(?:(?:can|could|would)\\s+you\\s+help\\s+(?:me|us)\\s+)?(?:build|create|make|generate|draft|design|develop|start|regenerate|rebuild)\\s+(?:(?:me|us)\\s+)?(?:(?:a|an|the|this|that|new)\\s+)?${structure}\\s*(?:(?:about|on|for|to learn|covering|that teaches?|to teach)\\s+|[:,-]\\s*)(.+)$`,'i'),
    new RegExp(`\\b${structure}\\s+(?:about|on|for|to learn|covering|that teaches?|to teach)\\s+(.+)$`,'i')
  ];
  for(const pattern of patterns){const match=value.match(pattern);if(match){const subject=normalizeSubject(match[1]);if(subject.length>2)return subject}}
  return'';
}
function recentSubject(rows){
  for(const row of [...rows].reverse())if(row.role==='user'){const subject=explicitSubject(row.text);if(subject)return subject}
  return'';
}
function userCapability(rows){
  for(const row of [...rows].reverse().filter(row=>row.role==='user')){
    const match=row.text.match(/\b(?:i\s+want\s+to|i\s+need\s+to|i\s+would\s+like\s+to|i['’]?d\s+like\s+to|goal\s+is\s+to|objective\s+is\s+to|be\s+able\s+to|capable\s+of|help\s+me\s+learn(?:\s+to)?|teach\s+me(?:\s+how\s+to)?|learn|master|practice|study)\s+(?:how\s+to\s+)?(.+)/i);
    if(match){const value=normalizeSubject(match[1]);if(value.length>3)return value}
  }
  return'';
}
function titleCase(value){return clean(value,100).split(/\s+/).slice(0,8).map(word=>word?word[0].toUpperCase()+word.slice(1):word).join(' ')}
function moduleCount(rows,current){
  if(Number(current)>0)return Math.max(1,Math.min(8,Number(current)));
  for(const row of [...rows].reverse()){const match=row.text.match(/\b([1-8])\s*[- ]?(?:week|module|lesson|level)s?\b/i);if(match)return Number(match[1])}
  return 4;
}
function curriculumRequest(options={}){
  const rows=rowsFor(options),state=stateForLivingSchool(),school=state?.school||{},path=state?.pathContext||{},text=clean(options.text,5000),continuing=CONTINUE.test(text),directCapability=learningJourneyIntent(text,options.history||[])?userCapability([{role:'user',text}]):'',subject=explicitSubject(text)||directCapability||(continuing?recentSubject(rows):'');
  const hasActive=Boolean(school?.title||school?.capability),newPath=Boolean(subject||/\bnew\s+(?:learning journey|curriculum|course|syllabus|learning path|learning pathway|learning program|learning plan|study plan|lesson plan|skill tree)\b/i.test(text)||!hasActive||(STRUCTURE.test(text)&&BUILD.test(text)&&!REVISE.test(text)));
  const capability=clean(newPath?(subject||recentSubject(rows)||userCapability(rows)):(school.capability||path.capability||recentSubject(rows)||userCapability(rows)),2400);
  const title=clean(newPath?(titleCase(subject||capability)):(school.title||path.title||titleCase(capability)),240)||'Learning Journey';
  return{title,capability,level:newPath?'beginner':clean(school.level,80)||'beginner',count:moduleCount(rows,newPath?0:school.modules?.length),mode:clean(state?.settings?.mode,80)||'guided',proof:newPath?'A working artifact, explanation, and independent receipt.':clean(school.proof||path.proof,3000)||'A working artifact, explanation, and independent receipt.',intent:newPath?'new':'revise',newPath,replaceExisting:newPath,requestedAt:now(),sourceText:clean(options.text,4000),continuation:continuing};
}
function packet(answer,nextAction='',extra={}){return{response:{answer,choice:{mode:'Learn',system:'living-school',room:'',nextAction},assumptions:Array.isArray(extra.assumptions)?extra.assumptions:[],requiresConsent:Boolean(extra.requiresConsent),confidence:Number(extra.confidence)||.99,approvalGate:extra.approvalGate||null},provider:extra.provider||'unified-chat-capability',model:extra.model||'living-school-learning-engine',action:extra.action||null,context:{guide:{system:'living-school',name:'Moss'},capability:'curriculum',canonicalArtifact:'Learning Journey'},fallbackFrom:null}}
function readLearningPlan(){try{return parse(localStorage.getItem(LEARNING_PLAN_KEY),null)}catch{return null}}
function saveLearningPlan(plan){try{localStorage.setItem(LEARNING_PLAN_KEY,JSON.stringify(plan))}catch{}return plan}
function clearLearningPlan(){try{localStorage.removeItem(LEARNING_PLAN_KEY)}catch{}}
function learningPlanControl(text){for(const[action,pattern]of Object.entries(LEARNING_PLAN_CONTROL))if(pattern.test(clean(text,4000)))return action;return''}
function selectedPlanningConfig(){
  try{
    const config=globalThis.CivweaveAssistantV141?.selectedConfig?.();
    if(config&&(config.provider||config.route||config.model))return config;
  }catch{}
  try{
    const config=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive');
    if(config&&(config.provider||config.route||config.model))return config;
  }catch{}
  return null;
}
function modelJson(result){
  if(result?.outputJson&&typeof result.outputJson==='object'&&!Array.isArray(result.outputJson))return result.outputJson;
  const text=clean(result?.outputText||result?.text||result?.output||'',24000).replace(/<think>[\s\S]*?<\/think>/gi,'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  return parse(text,null);
}
function normalizePlanModule(item,index){
  if(!item||typeof item!=='object')return null;
  const title=clean(item.title||item.name,220),focus=clean(item.focus||item.purpose||item.goal||item.objective,900),outcome=clean(item.outcome||item.demonstrableOutcome||item.result||item.evidence,900);
  if(!title||!focus||!outcome)return null;
  return{id:`module-plan-${index+1}`,title,focus,outcome};
}
function normalizeModelPlan(value,request,existingPlan=null,route={}){
  if(!value||typeof value!=='object')throw new Error('The selected AI did not return a structured Learning Journey plan.');
  const modules=(Array.isArray(value.modules)?value.modules:Array.isArray(value.milestones)?value.milestones:Array.isArray(value.stages)?value.stages:[]).map(normalizePlanModule).filter(Boolean).slice(0,8);
  if(modules.length<3)throw new Error('The selected AI returned too little high-level structure to review.');
  const level=['beginner','intermediate','advanced'].includes(clean(value.level,80).toLowerCase())?clean(value.level,80).toLowerCase():request.level;
  const mode=['guided','just-in-time','browse'].includes(clean(value.mode,80).toLowerCase())?clean(value.mode,80).toLowerCase():request.mode;
  const title=clean(value.title,240)||request.title,capability=clean(value.capability||value.goal,2400)||request.capability,proof=clean(value.proof||value.completionEvidence||value.demonstration,3000)||request.proof;
  const assumptions=(Array.isArray(value.assumptions)?value.assumptions:[]).map(item=>clean(item,700)).filter(Boolean).slice(0,6);
  const stamp=now(),base=existingPlan&&typeof existingPlan==='object'?existingPlan:{};
  return{...base,schema:'civweave.learning-journey-plan.v2',id:base.id||`learning-plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,state:'review',createdAt:base.createdAt||stamp,updatedAt:stamp,approvedAt:null,requiresExplicitApproval:true,request:{...request,title,capability,level,mode,proof,count:modules.length,outline:modules.map(({title,focus,outcome})=>({title,focus,outcome}))},modules,assumptions,authoring:{mode:'selected-ai-high-level-plan',provider:clean(route.provider,120)||'unknown',model:clean(route.model,240),revision:VERSION}};
}
function learningPlanText(plan){
  const request=plan?.request||{},modules=Array.isArray(plan?.modules)?plan.modules:[],outline=modules.length?`\n\nOutline:\n${modules.map((module,index)=>`${index+1}. ${clean(module.title,220)}\n   Focus: ${clean(module.focus,700)}\n   Demonstrate: ${clean(module.outcome,700)}`).join('\n')}`:'';
  const assumptions=(plan?.assumptions||[]).length?`\n\nAssumptions:\n${plan.assumptions.map(item=>`- ${clean(item,500)}`).join('\n')}`:'';
  return `Learning Journey plan: “${clean(request.title||'Learning Journey',240)}”\n\nGoal: ${clean(request.capability,900)}\nLevel: ${clean(request.level||'beginner',80)}\nMode: ${clean(request.mode||'guided',80)}\nProof of capability: ${clean(request.proof,1200)}${outline}${assumptions}\n\nStatus: REVIEW. This is only the high-level plan; no lessons, exercises, quizzes, or module content have been generated yet.`;
}
function learningPlanResponse(plan){
  if(!plan?.request)return packet('There is no Learning Journey plan waiting for review.','Tell Moss what you want to learn or demonstrate.');
  return packet(learningPlanText(plan),'Review or revise this plan. When it is right, explicitly approve the Learning Journey to generate its learning content.',{assumptions:plan.assumptions||[],requiresConsent:true,provider:plan.authoring?.provider||'unified-chat-capability',model:plan.authoring?.model||'learning-plan',approvalGate:{kind:'learning-journey-plan-approval',planId:plan.id,state:plan.state||'review',required:true,actions:['review','revise','approve']},action:{kind:'living-school-learning-plan',system:'living-school',state:plan.state||'review',title:plan.request.title,capability:plan.request.capability,canonicalArtifact:'Learning Journey'}});
}
async function generateLivingSchoolPlan(options={},existingPlan=null,revisionText=''){
  const request=curriculumRequest(options);
  if(!request.capability&&!existingPlan?.request?.capability)return packet('I can generate the Learning Journey plan, but I still need the observable capability the learner should be able to demonstrate.','Tell Moss what you want to be able to do, then the selected AI will generate the high-level plan for review.');
  const seed=existingPlan?.request?{...existingPlan.request,...request,capability:request.capability||existingPlan.request.capability,title:request.title||existingPlan.request.title}:{...request};
  let config=selectedPlanningConfig();
  try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();config=selectedPlanningConfig()||config}catch(error){
    return packet(`Moss could not start the selected AI for Learning Journey planning: ${clean(error?.message||error,900)}`,'Retry the plan or check the selected AI model.',{provider:'learning-plan-model-error',model:clean(config?.model,240)});
  }
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate||!config)return packet('Moss could not reach the selected AI runtime for Learning Journey planning. No learning content was generated or queued.','Retry after the selected AI runtime is ready.',{provider:'learning-plan-model-unavailable',model:clean(config?.model,240)});
  const requestedProvider=clean(config.provider||config.route,120).toLowerCase(),planConfig={...config,maxTokens:Math.min(1800,Math.max(900,Number(config.maxTokens)||1200)),temperature:Math.min(.35,Math.max(.1,Number(config.temperature)||.25))},history=rowsFor(options).slice(-8).map(row=>({role:row.role,text:clean(row.text,1200)}));
  const context={schema:'civweave.learning-journey-plan-request.v2',request:seed,revision:clean(revisionText,3000),existingPlan:existingPlan?{title:existingPlan.request?.title,capability:existingPlan.request?.capability,level:existingPlan.request?.level,mode:existingPlan.request?.mode,proof:existingPlan.request?.proof,modules:existingPlan.modules||[],assumptions:existingPlan.assumptions||[]}:null,recentConversation:history,constraints:['Generate only a high-level Learning Journey plan for review.','Do not write lessons, explanations, exercises, quizzes, readings, source lists, or curriculum content.','Make the module sequence specific to the Hero’s stated learning goal.','Each module entry needs a short title, a focus, and an observable outcome.','Keep the plan in REVIEW. Nothing is approved, activated, or materialized by this call.']};
  try{
    const result=await runtime.generate({purpose:'living-school-learning-plan-review-v2',executionProfile:'interactive',config:planConfig,schema:LEARNING_PLAN_SCHEMA,responseFormat:'json',context,task:{schema:'civweave.ai-task.v2',kind:'curriculum-plan-draft',systemId:'living-school',complexity:'routine',requirements:{profile:'interactive',requiresTools:false,externalResearch:false,code:false,planning:true,structuredOutput:true,vision:false,complexity:false}},capabilityRequirements:{profile:'interactive',requiresTools:false,externalResearch:false,planning:true,structuredOutput:true},messages:[{role:'system',content:'You are Moss, Living School’s Learning Journey guide. Use the selected AI model to design a concise, personalized, high-level learning plan for review. Return strict JSON matching the supplied schema. Do not teach the subject yet and do not generate curriculum content. The output must remain an inert REVIEW plan until the Hero explicitly approves it.'},{role:'user',content:`Design the high-level Learning Journey plan from this request:\n${JSON.stringify(context)}`}]});
    if(!['success','fallback'].includes(result?.status))throw new Error(result?.error?.message||result?.error||`The selected AI ended with ${result?.status||'an error'}.`);
    const provider=clean(result?.actual?.provider||result?.provider||config.provider||config.route,120),model=clean(result?.actual?.model||result?.model||config.model,240),actualProvider=provider.toLowerCase();
    if(LOCAL_PLAN_PROVIDERS.has(requestedProvider)&&!LOCAL_PLAN_PROVIDERS.has(actualProvider))throw new Error(`The selected local model was bypassed by ${provider||'another provider'}, so Moss refused to save that plan.`);
    const plan=normalizeModelPlan(modelJson(result),seed,existingPlan,{provider,model});
    saveLearningPlan(plan);
    return learningPlanResponse(plan);
  }catch(error){
    return packet(`Moss could not generate the high-level Learning Journey plan with the selected AI: ${clean(error?.message||error,1200)} No learning content was generated or queued.`,'Retry the plan or choose another AI model.',{provider:requestedProvider||'learning-plan-model-error',model:clean(config.model,240)});
  }
}
async function runLivingSchoolCurriculum(options={}){
  const plan=options.reviewPlan&&typeof options.reviewPlan==='object'?options.reviewPlan:null;
  const request=plan?.request?{...plan.request}:curriculumRequest(options);
  if(!request.capability)return packet('I can build the Learning Journey, but I still need the observable capability the learner should be able to demonstrate.','Name the capability, then ask Moss to generate the Learning Journey plan.');
  if(options.requireApprovedPlan!==false&&!plan?.approvedAt)return learningPlanResponse(plan||readLearningPlan());
  const engine=globalThis.LivingSchoolCleanroomV218;
  if(typeof engine?.generateCurriculumFromChat!=='function'){
    try{localStorage.setItem(`${PENDING_PREFIX}.living-school.curriculum.v1`,JSON.stringify({...request,autoRun:true,approvedAt:plan.approvedAt,approvedPlanId:plan.id,queuedAt:now()}))}catch{}
    clearLearningPlan();
    return packet('The Learning Journey plan is approved. I queued its materialization; Living School will generate the learning content when the learning engine is available.','Open Living School when you want to review the generated Learning Journey.',{action:{kind:'living-school-curriculum-queued',system:'living-school',state:'queued',title:request.title,capability:request.capability,intent:request.intent,approvedPlanId:plan.id,canonicalArtifact:'Learning Journey'}});
  }
  try{
    const result=await engine.generateCurriculumFromChat(request),school=result?.school||result||{},modules=Array.isArray(school.modules)?school.modules:[];
    try{localStorage.removeItem(`${PENDING_PREFIX}.living-school.curriculum.v1`)}catch{}
    clearLearningPlan();
    return packet(`I materialized the approved Learning Journey “${clean(school.title||request.title,240)}” through Living School's learning engine. It has ${modules.length||request.count} module${(modules.length||request.count)===1?'':'s'} for “${clean(school.capability||request.capability,500)}”.`,modules[0]?.title?`Open Module 1: ${clean(modules[0].title,180)}.`:'Review the generated Learning Journey.',{provider:'living-school-learning-engine',model:school.generation?.model||school.generation?.provider||'canonical-learning-engine',action:{kind:'living-school-curriculum-generated',system:'living-school',state:'completed',schoolId:school.id||'',title:school.title||request.title,moduleCount:modules.length||request.count,capability:school.capability||request.capability,source:'unified-chat',intent:request.intent,approvedPlanId:plan.id,canonicalArtifact:'Learning Journey'}});
  }catch(error){return packet(`The Living School learning engine stopped before it could materialize the approved Learning Journey “${request.title}”: ${clean(error?.message||error,1000)} Nothing was marked generated.`,'Review the Learning Journey plan or model settings, then retry materialization.',{provider:'living-school-learning-engine-error',action:{kind:'living-school-curriculum-generation-failed',system:'living-school',state:'failed',error:clean(error?.message||error,800),approvedPlanId:plan?.id||'',canonicalArtifact:'Learning Journey'}})}
}
async function approveLivingSchoolPlan(plan){
  if(!plan?.request)return packet('There is no Learning Journey plan waiting for approval.','Tell Moss what you want to learn or demonstrate.');
  const approved={...plan,state:'approved',approvedAt:now(),updatedAt:now()};
  saveLearningPlan(approved);
  return runLivingSchoolCurriculum({reviewPlan:approved,requireApprovedPlan:true});
}
function guardLivingSchoolMutation(result,before){
  if(!result?.response)return result;
  const after=JSON.stringify(stateForLivingSchool()?.school||null),answer=clean(result.response.answer,10000),plan=readLearningPlan();
  if(before===after&&MUTATION_CLAIM.test(answer)){result.response.answer=plan?`${learningPlanText(plan)}\n\nI have not generated the learning content. The plan is still waiting for explicit approval.`:'I have not generated or changed Living School learning content. Moss must first generate a high-level Learning Journey plan with the selected AI, then wait for explicit approval before materialization.';result.response.choice={...(result.response.choice||{}),mode:'Learn',system:'living-school',nextAction:plan?'Review, revise, or explicitly approve the Learning Journey plan.':'Tell Moss what you want to learn or demonstrate.'};result.response.requiresConsent=Boolean(plan)}
  return result;
}
function registerCapability(system,handler){if(SYSTEMS.includes(system)&&typeof handler==='function')capabilityHandlers.set(system,handler)}
registerCapability('living-school',async(request,next)=>{
  const history=Array.isArray(request.history)?request.history:[],text=clean(request.text,12000);
  if(TEST.test(text))return packet('Test received. Moss is online. I did not create learning content or change a Learning Journey.','Tell Moss what you want to learn or demonstrate.');
  const plan=readLearningPlan(),control=learningPlanControl(text);
  if(plan&&control==='review')return learningPlanResponse(plan);
  if(plan&&control==='approve')return approveLivingSchoolPlan(plan);
  if(plan&&control==='revise'){
    saveLearningPlan({...plan,state:'revision-requested',updatedAt:now()});
    return packet(`${learningPlanText(plan)}\n\nTell me what you want changed. Moss will use the selected AI to regenerate only the high-level plan and keep it in REVIEW.`,'Describe the change you want in the high-level plan.',{requiresConsent:true,provider:plan.authoring?.provider||'unified-chat-capability',model:plan.authoring?.model||'learning-plan',approvalGate:{kind:'learning-journey-plan-approval',planId:plan.id,state:'review',required:true,actions:['review','revise','approve']}});
  }
  if(plan&&(plan.state==='revision-requested'||PLAN_REVISION.test(text)))return generateLivingSchoolPlan(request,plan,text);
  if(learningJourneyIntent(text,history))return generateLivingSchoolPlan(request);
  const before=JSON.stringify(stateForLivingSchool()?.school||null),result=await next(request);
  return guardLivingSchoolMutation(result,before);
});

function hasResponseLayer(fn,flag){
  let current=fn,depth=0;
  while(typeof current==='function'&&depth<16){if(current[flag])return true;current=current.__prior;depth++}
  return false;
}
function loadScript(path,version){
  const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}});
  if(existing)return Promise.resolve(existing);
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=`${path}?v=${encodeURIComponent(version)}`;script.async=false;
    script.onload=()=>resolve(script);script.onerror=()=>reject(new Error(`Could not load ${path}.`));document.head?.append(script);
  });
}
async function ensureWeavelingOrchestrator(){
  const assistant=globalThis.CivweaveAssistantV141;
  if(!assistant?.respond)return false;
  if(hasResponseLayer(assistant.respond,'__weavelingPlanJsonV190'))return true;
  const install=()=>{
    const api=globalThis.CivweaveWeavelingPlanJsonV190;
    if(!api?.install)throw new Error('The Weaveling structured-plan orchestrator loaded without its runtime.');
    api.install();
    return hasResponseLayer(globalThis.CivweaveAssistantV141?.respond,'__weavelingPlanJsonV190');
  };
  if(globalThis.CivweaveWeavelingPlanJsonV190?.install)return install();
  if(!orchestratorPromise)orchestratorPromise=loadScript(WEAVELING_ORCHESTRATOR_PATH,'1.0.8-contextual-review-materialization').then(install).catch(error=>{orchestratorPromise=null;throw error});
  return orchestratorPromise;
}
function patchAssistant(){
  const api=globalThis.CivweaveAssistantV141;
  if(!api?.respond||hasResponseLayer(api.respond,'__cwUnifiedChatSystemV1'))return false;
  const originalFn=api.respond,original=originalFn.bind(api);
  const respond=async options=>{
    const request={...(options||{})},system=SYSTEMS.includes(clean(request.systemId,80).toLowerCase())?clean(request.systemId,80).toLowerCase():'civweave',handler=capabilityHandlers.get(system);
    return handler?handler({...request,systemId:system},original):original({...request,systemId:system});
  };
  respond.__cwUnifiedChatSystemV1=true;
  respond.__prior=originalFn;
  for(const key of ['__weavelingPlanJsonV190','__guideIdentityIntegrityV216','__deterministicModeV175'])if(originalFn[key])respond[key]=originalFn[key];
  try{api.respond=respond;assistantPatched=api.respond===respond}catch{}
  if(!assistantPatched){try{globalThis.CivweaveAssistantV141={...api,respond};assistantPatched=true}catch{}}
  return assistantPatched;
}
function patchLoader(){
  const loader=globalThis.CivweaveFamilyAILoaderV105;
  if(!loader?.ensure||loader.ensure.__cwUnifiedChatSystemV1)return false;
  const originalFn=loader.ensure,original=originalFn.bind(loader),ensure=async(...args)=>{
    const result=await original(...args);
    try{await ensureWeavelingOrchestrator()}catch(error){console.warn('[Civweave] Weaveling planning layer did not attach:',error)}
    patchAssistant();
    return result;
  };
  ensure.__cwUnifiedChatSystemV1=true;
  ensure.__prior=originalFn;
  try{loader.ensure=ensure;loaderPatched=true}catch{}
  return loaderPatched;
}
async function consumePending(){
  if(pendingRun||typeof globalThis.LivingSchoolCleanroomV218?.generateCurriculumFromChat!=='function')return pendingRun;
  const key=`${PENDING_PREFIX}.living-school.curriculum.v1`,request=parse(localStorage.getItem(key),null);
  if(!request?.autoRun||!request?.approvedAt||!clean(request.capability))return null;
  pendingRun=globalThis.LivingSchoolCleanroomV218.generateCurriculumFromChat(request).then(result=>{localStorage.removeItem(key);try{globalThis.CivweavePersistentGuideChatV215?.notify?.('living-school',`Your approved Learning Journey “${clean(result?.school?.title||request.title,180)}” is ready.`,{open:false})}catch{};return result}).catch(error=>{try{globalThis.CivweavePersistentGuideChatV215?.notify?.('living-school',`The approved Learning Journey build stopped: ${clean(error?.message||error,800)} Nothing was marked generated.`,{open:false})}catch{};return null}).finally(()=>{pendingRun=null});
  return pendingRun;
}
function synchronize(){normalizeSurface();patchLoader();patchAssistant();consumePending();return true}
function bindLifecycle(){
  if(lifecycleBound)return;
  lifecycleBound=true;
  for(const name of ['civweave:guide-workspace-ready','civweave:guide-loader-reset','civweave:assistant-runtime-ready','civweave:response-router-installed','civweave:living-school-workbench-ready','civweave:guide-chat-opened','pageshow'])addEventListener(name,()=>queueMicrotask(synchronize));
}
function start(){bindLifecycle();synchronize();document.documentElement.dataset.civweaveChatSystem='unified-v1'}

const api=Object.freeze({version:VERSION,systems:SYSTEMS,themes:THEMES,memoryFolders:MEMORY_FOLDERS,memoryFolder,activeTheme,registerCapability,normalizeSurface,synchronize,ensureWeavelingOrchestrator,curriculumIntent,learningJourneyIntent,curriculumRequest,readLearningPlan,generateLivingSchoolPlan,learningPlanResponse,approveLivingSchoolPlan,runLivingSchoolCurriculum,architecture:'one-core-five-themes-five-memory-folders',artifactLanguage:{'living-school':'Learning Journey'},learningPlanAuthoring:'selected-ai-local-capable',learningJourneyMaterialization:'review-then-explicit-approval',inputOwners:1,polling:false});
globalThis.CivweaveUnifiedChatSystemV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();