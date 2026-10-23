(()=>{'use strict';

const VERSION='1.2.8-unified-chat-system-v1-generous-outputs';
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
function saveLearningPlan(plan){
  localStorage.setItem(LEARNING_PLAN_KEY,JSON.stringify(plan));
  const stored=readLearningPlan();
  if(stored?.id!==plan?.id||stored?.state!==plan?.state)
    throw new Error('Living School REVIEW plan could not be verified in local storage.');
  try{dispatchEvent(new CustomEvent('civweave:living-school-pending-plan-review',{detail:{id:stored.id,state:stored.state,capability:stored.request?.capability}}))}catch{}
  return stored;
}
function clearLearningPlan(){try{localStorage.removeItem(LEARNING_PLAN_KEY)}catch{}}
function learningPlanControl(text){for(const[action,pattern]of Object.entries(LEARNING_PLAN_CONTROL))if(pattern.test(clean(text,4000)))return action;return''}
function selectedPlanningConfig(){
  // Settings v320 is the saved user decision; assistant wrappers may carry
  // outdated routes from an earlier chat or a previously selected server-auto.
  const shared=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive')||null;
  let canonical=null;
  try{canonical=globalThis.CivweaveSettingsV320?.readState?.()||null}catch{}
  const route=clean(canonical?.provider||canonical?.route,80).toLowerCase();
  if(route&&['ollama','openai-compatible','gemini','server-auto','downloaded-local','deterministic'].includes(route))
    return{...(shared||{}),...canonical,provider:route,route};
  const selected=selectedBrowserGGUF();
  if(selected&&shared?.provider==='openai-compatible'&&shared.model===selected.model)return shared;
  try{
    const config=globalThis.CivweaveAssistantV141?.selectedConfig?.();
    if(config&&(config.provider||config.route||config.model))return config;
  }catch{}
  return shared&&(shared.provider||shared.route||shared.model)?shared:null;
}
function nativePhoneServer(config={}){
  if(clean(config.provider||config.route,80).toLowerCase()!=='openai-compatible'||config.model!=='qwen35-4b-native')return false;
  try{
    const url=new URL(config.endpoint);
    return url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&url.port==='8080'&&url.pathname.replace(/\/+$/,'')==='/v1';
  }catch{return false}
}
function localPlanRoute(config={}){
  const provider=clean(config.provider||config.route,80).toLowerCase();
  if(LOCAL_PLAN_PROVIDERS.has(provider))return true;
  if(!['ollama','openai-compatible','local-api'].includes(provider))return false;
  try{
    const url=new URL(config.endpoint),host=url.hostname.toLowerCase();
    const second=Number(host.split('.')[1]);
    return host==='localhost'||host==='[::1]'||host.startsWith('127.')||host.startsWith('10.')||
      host.startsWith('192.168.')||(host.startsWith('172.')&&Number.isInteger(second)&&second>=16&&second<=31)||host.endsWith('.local');
  }catch{return false}
}
function selectedBrowserGGUF(){
  try{
    const choice=parse(localStorage.getItem('civweave.mobile.gguf-primary.v2'),null);
    return choice?.enabled===true&&choice.engine==='wllama'&&choice.model?choice:null;
  }catch{return null}
}
function selectedPlanGGUF(config){
  const choice=selectedBrowserGGUF();
  if(!choice||config?.provider!=='openai-compatible'||config.model!==choice.model)return null;
  // Native Termux alias must never be interpreted as an imported browser GGUF.
  if(config.model==='qwen35-4b-native'&&config.endpoint==='http://127.0.0.1:8080/v1')return null;
  if(config.endpoint!=='http://127.0.0.1:8080/v1')
    throw new Error('The selected on-device GGUF has an inconsistent route; reselect it in Settings. The plan was not sent to another provider.');
  return choice;
}
const GOAL_STOPWORDS=new Set(['help','learn','learning','teach','teaching','about','with','from','into','that','this','these','those','what','when','where','which','would','could','should','want','need','have','read','make','build','create','begin','first','beginner','plan','plans','course','skill','skills','people','them','their','then','using','through','memorize','memory','master','practice','study','understand','how','the','and','for','you','your','myself','yourself']);
// Small models may use topic-specific vocabulary instead of repeating the
// top-level label (tarot => Major Arcana, suits, spreads). The header remains
// independently checked to prevent a stale subject from being accepted.
const GOAL_VOCABULARY=Object.freeze({
  tarot:['arcana','pentacles','wands','major arcana','minor arcana','card spread','spreads','high priestess']
});
function goalAnchors(request){
  return [...new Set((clean(request?.capability,2400).toLowerCase().match(/[a-z][a-z0-9'-]{3,}/g)||[])
    .filter(word=>!GOAL_STOPWORDS.has(word)))].slice(0,10);
}
function matchesTopic(text,terms){
  const normalized=' '+clean(text,10000).toLowerCase().replace(/[^a-z0-9]+/g,' ')+' ';
  return terms.some(term=>normalized.includes(' '+term.toLowerCase().replace(/[^a-z0-9]+/g,' ')+' '));
}
function goalMatchAssessment(value,request){
  const anchors=goalAnchors(request);
  const header=clean([value?.title,value?.capability||value?.goal].filter(Boolean).join(' '),4000);
  const modules=Array.isArray(value?.modules)?value.modules:Array.isArray(value?.milestones)?value.milestones:Array.isArray(value?.stages)?value.stages:[];
  const moduleText=clean(modules.map(item=>[item?.title,item?.focus,item?.outcome,item?.goal].filter(Boolean).join(' ')).join(' '),10000);
  if(!anchors.length)return{matches:true,reason:'no-reliable-anchor',anchors};
  const headerMatches=matchesTopic(header,anchors);
  const related=[...new Set(anchors.flatMap(word=>GOAL_VOCABULARY[word]||[]))];
  const moduleMatches=matchesTopic(moduleText,[...anchors,...related]);
  return{matches:headerMatches&&moduleMatches,
    reason:!headerMatches?'wrong-subject':!moduleMatches?'module-topic-not-grounded':'matched',
    anchors,modelTitle:clean(value?.title,120),
    moduleTitles:modules.slice(0,4).map(item=>clean(item?.title||item?.name,60))};
}
function planMatchesCurrentGoal(value,request){return goalMatchAssessment(value,request).matches}
function goalMismatchError(value,request){
  const assessment=goalMatchAssessment(value,request);
  const topic=assessment.anchors.slice(0,3).join(', ')||clean(request?.capability,120);
  const title=assessment.modelTitle||'(untitled)';
  const modules=assessment.moduleTitles.filter(Boolean).join(' / ')||'(unnamed)';
  if(assessment.reason==='wrong-subject')
    return new Error('The local model drafted a plan for a different subject. Expected topic: '+topic+'. Model title: "'+title+'". Module titles: '+modules+'. No plan was saved.');
  return new Error('The local model named the requested topic ('+topic+') but its module descriptions did not establish that subject. Model title: "'+title+'". Module titles: '+modules+'. No plan was saved. This is an off-topic or overly generic draft, not proof of stale chat history.');
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
  if(request?.intent==='new'&&!planMatchesCurrentGoal(value,request))throw goalMismatchError(value,request);
  const modules=(Array.isArray(value.modules)?value.modules:Array.isArray(value.milestones)?value.milestones:Array.isArray(value.stages)?value.stages:[]).map(normalizePlanModule).filter(Boolean).slice(0,8);
  if(modules.length<3)throw new Error('The selected AI returned too little high-level structure to review.');
  const level=['beginner','intermediate','advanced'].includes(clean(value.level,80).toLowerCase())?clean(value.level,80).toLowerCase():request.level;
  const mode=['guided','just-in-time','browse'].includes(clean(value.mode,80).toLowerCase())?clean(value.mode,80).toLowerCase():request.mode;
  // The model may draft modules and recommendations, but a new request's
  // title and capability are owned by the current user message, never by
  // a previous conversational subject supplied in its JSON response.
  const title=request.intent==='new'?(request.title||clean(value.title,240)):(clean(value.title,240)||request.title);
  const capability=request.intent==='new'?(request.capability||clean(value.capability||value.goal,2400)):(clean(value.capability||value.goal,2400)||request.capability);
  const proof=clean(value.proof||value.completionEvidence||value.demonstration,3000)||request.proof;
  const assumptions=(Array.isArray(value.assumptions)?value.assumptions:[]).map(item=>clean(item,700)).filter(Boolean).slice(0,6);
  const stamp=now(),base=request.intent==='new'?{}:existingPlan&&typeof existingPlan==='object'?existingPlan:{};
  return{...base,schema:'civweave.learning-journey-plan.v2',id:base.id||`learning-plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,state:'review',createdAt:base.createdAt||stamp,updatedAt:stamp,approvedAt:null,requiresExplicitApproval:true,request:{...request,title,capability,level,mode,proof,count:modules.length,outline:modules.map(({title,focus,outcome})=>({title,focus,outcome}))},modules,assumptions,authoring:{mode:'selected-ai-high-level-plan',provider:clean(route.provider,120)||'unknown',model:clean(route.model,240),revision:VERSION}};
}
function learningPlanText(plan){
  const request=plan?.request||{},modules=Array.isArray(plan?.modules)?plan.modules:[],outline=modules.length?`\n\nOutline:\n${modules.map((module,index)=>`${index+1}. ${clean(module.title,220)}\n   Focus: ${clean(module.focus,700)}\n   Demonstrate: ${clean(module.outcome,700)}`).join('\n')}`:'';
  const assumptions=(plan?.assumptions||[]).length?`\n\nAssumptions:\n${plan.assumptions.map(item=>`- ${clean(item,500)}`).join('\n')}`:'';
  return `Learning Journey plan: “${clean(request.title||'Learning Journey',240)}”\n\nGoal: ${clean(request.capability,900)}\nLevel: ${clean(request.level||'beginner',80)}\nMode: ${clean(request.mode||'guided',80)}\nProof of capability: ${clean(request.proof,1200)}${outline}${assumptions}\n\nStatus: ${plan.state==='superseded'?'SUPERSEDED — a newer learning goal was requested; this older plan cannot be approved.':'REVIEW'}. This is only the high-level plan; no lessons, exercises, quizzes, or module content have been generated yet.`;
}
function learningPlanResponse(plan){
  if(!plan?.request)return packet('There is no Learning Journey plan waiting for review.','Tell Moss what you want to learn or demonstrate.');
  if(plan.state==='superseded')return packet(learningPlanText(plan),'This prior plan cannot be approved. Retry the most recent learning goal to generate a current REVIEW plan.',{provider:plan.authoring?.provider||'unified-chat-capability',model:plan.authoring?.model||'learning-plan'});
  return packet(learningPlanText(plan),'Review or revise this plan. When it is right, explicitly approve the Learning Journey to generate its learning content.',{assumptions:plan.assumptions||[],requiresConsent:true,provider:plan.authoring?.provider||'unified-chat-capability',model:plan.authoring?.model||'learning-plan',approvalGate:{kind:'learning-journey-plan-approval',planId:plan.id,state:plan.state||'review',required:true,actions:['review','revise','approve']},action:{kind:'living-school-learning-plan',system:'living-school',state:plan.state||'review',title:plan.request.title,capability:plan.request.capability,canonicalArtifact:'Learning Journey'}});
}
// The Moss learning capability owns its real progress milestones.
function learningPlanProgress(phase,detail={}){
  try{globalThis.dispatchEvent?.(new CustomEvent('civweave:moss-learning-plan-progress',{detail:{phase,...detail}}))}catch{}
}
function emitNativePlanStage(details={}){
  try{globalThis.dispatchEvent?.(new CustomEvent('civweave:weave-pipeline',{detail:{
    origin:'native-local-api',kind:'learning',purpose:'living-school-learning-plan-review-v2',
    model:'qwen35-4b-native',at:now(),...details
  }}))}catch{}
}
function emitNativePlanIntake(details={}){
  try{globalThis.dispatchEvent?.(new CustomEvent('civweave:weaveling-intake-progress',{detail:{
    origin:'native-local-api',model:'qwen35-4b-native',route:'learning',
    at:now(),...details
  }}))}catch{}
}
function assertNativePlanModel(result,config,stage){
  if(result?.status!=='success')throw new Error(stage+' stage failed: '+clean(result?.error?.message||result?.structured?.errors?.join('; ')||result?.status||'no response',700));
  if(result?.actual?.provider!=='openai-compatible'||result?.actual?.model!==config.model)
    throw new Error(stage+' stage did not execute on the selected Termux model. Nothing was saved.');
  return clean(result.outputText,20000);
}
function normalizeNativePlanContract(result,seed,runtime){
  // Repair only type/enum presentation drift. Never synthesize modules,
  // change learning subject or accept truncated/invalid JSON as complete.
  if(!['success','invalid-response'].includes(result?.status))return null;
  let raw=modelJson(result);
  if((!raw||typeof raw!=='object'||Array.isArray(raw))&&typeof runtime?.parseJsonLoose==='function'){
    try{raw=runtime.parseJsonLoose(result?.outputText||'')}catch{}
  }
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const plan={...raw};
  if(typeof plan.level==='string')plan.level=plan.level.trim().toLowerCase();
  if(typeof plan.mode==='string')plan.mode=plan.mode.trim().toLowerCase();
  if(!['guided','just-in-time','browse'].includes(plan.mode)&&
      typeof seed?.mode==='string'&&['guided','just-in-time','browse'].includes(seed.mode.toLowerCase()))
    plan.mode=seed.mode.toLowerCase();
  if(typeof plan.assumptions==='string')
    plan.assumptions=plan.assumptions.trim()?[plan.assumptions.trim()]:[];
  // The user request owns their preferred level and mode. This does not
  // supply any learning module, lesson, evidence or approval.
  if(typeof runtime?.validateSchema!=='function')return null;
  const violations=runtime.validateSchema(plan,LEARNING_PLAN_SCHEMA);
  if(violations.length)return null;
  return plan;
}
async function nativeFormalLearningPlan({runtime,config,seed,options,existingPlan}){
  const pipelineId='native-moss-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  const meta={pipelineId,resourceCount:0,specialistCount:0,decisionGateCount:0};
  const progress=(phase,characters=0,complete=false)=>{
    try{options.onProgress?.({phase,characters,complete,pipelineId})}catch{}
  };
  const stage=(phase,state,extra={})=>emitNativePlanStage({...meta,phase,state,...extra});
  const intake={schema:'civweave.learning-journey-intake.native.v1',
    currentGoal:clean(seed.capability,350),title:clean(seed.title,120),level:seed.level,
    mode:seed.mode,route:'openai-compatible',model:config.model,
    process:'intake (deterministic) → model draft → model JSON compile → check → conditional repair → save for REVIEW'};
  let phase='intake',draft='',compiled='',repairText='';
  emitNativePlanIntake({phase:'classifying'});
  emitNativePlanIntake({phase:'complete',outputText:JSON.stringify(intake,null,2),intakeSource:'application-derived'});
  stage('pipeline','start',{label:'Native Learning Journey formal creation'});
  try{
    const goal=clean(seed.capability,350),topic=goalAnchors(seed)[0]||goal;
    const run=async({purpose,phase:runPhase,system,user,maxTokens,schema=null,structured=false,appendPrefix=''})=>{
      let lastProgress=0;
      const request={
        purpose,executionProfile:'interactive',signal:options.signal,
        config:{...config,stream:true,maxTokens,temperature:.2,timeoutMs:480000,context:4096},
        ...(structured?{responseFormat:'json',schema}:{}),
        maxRepairAttempts:0,
        messages:[{role:'system',content:system},{role:'user',content:user}],
        onEvent:event=>{
          if(event?.phase!=='partial')return;
          const size=Number(event.characters)||0;
          progress(runPhase,size,Boolean(event.complete));
          const visible=event.accumulatedText;
          if(typeof visible==='string'){
            const timestamp=Date.now();
            if(event.complete||timestamp-lastProgress>=340){
              lastProgress=timestamp;
              stage(runPhase,'streaming',{text:clean(appendPrefix+visible,16000),
                label:runPhase==='draft'?'Shareable model draft':runPhase==='compile'?'Provisional raw JSON (not yet validated)':'Provisional repair JSON'});
            }
          }
        }
      };
      return runtime.generate(request);
    };
    phase='draft';
    stage('draft','running',{label:'Qwen · shareable plan draft'});
    const draftResult=await run({
      purpose:'living-school-native-plan-draft-v1',phase:'draft',maxTokens:1500,
      system:'You are Moss. Draft a concise shareable Learning Journey outline for the CURRENT goal only. This is visible user-facing draft, not hidden reasoning or JSON. State the topic and capability, then four to six sequential modules (each title, focus, demonstrable outcome), and a practical final proof. Include 4 to 6 modules with specific and independently demonstrable outcomes. Finish each module completely. No lessons, unrelated topics or preambles.',
      user:'CURRENT GOAL: '+goal+'\nTopic anchor: '+topic+'\nBeginner · guided · REVIEW-only. Modules must mention the specific subject.'
    });
    if(draftResult?.status==='incomplete'||draftResult?.finishReason==='length'){
      draft=clean(draftResult?.outputText,12000);
      if(!draft)throw new Error('Draft reached max_tokens without producing useful text. No compiler was started.');
      stage('draft','needs-continuation',{label:'Draft reached token budget · continuing with same model',text:draft,
        finishReason:draftResult.finishReason||'length',maxTokens:1500});
      const tail=draft.slice(-1100);
      const continued=await run({
        purpose:'living-school-native-plan-draft-continuation-v1',
        phase:'draft',maxTokens:1200,appendPrefix:draft+'\n',
        system:'Continue the visible Learning Journey outline that was cut off. Give ONLY the remaining words, complete Module 3, and add the final practical proof. Do not restart, repeat earlier modules, change subject or return JSON. Keep it concise.',
        user:'CURRENT GOAL: '+goal+'\nLast portion already shown:\n'+tail+
          '\nContinue from its exact stopping point. Complete the remaining outline without repeating the text above.'
      });
      if(continued?.status==='incomplete'||continued?.finishReason==='length')
        throw new Error('The draft and its one bounded continuation both reached max_tokens. Partial draft remains visible but was not sent to the JSON compiler.');
      const rest=assertNativePlanModel(continued,config,'Draft continuation');
      const start=rest.slice(0,110).replace(/\s+/g,' ').toLowerCase();
      if(start.length>=55&&draft.replace(/\s+/g,' ').toLowerCase().includes(start))
        throw new Error('The model restarted the draft instead of continuing. Duplicate content was not accepted or compiled.');
      draft=clean(draft+'\n'+rest,16000);
      stage('draft','complete',{label:'Draft completed after one bounded continuation',text:draft});
    }else{
      draft=assertNativePlanModel(draftResult,config,'Draft');
      stage('draft','complete',{label:'Draft completed',text:draft});
    }
    progress('draft',draft.length,true);
    phase='compile';
    stage('compile','running',{label:'Qwen · JSON compiler'});
    const compileSystem='You are Moss converting a shareable learning plan to a STRICT JSON object. Use exact keys title, capability, level, mode, proof, modules, assumptions. Between 4 and 6 modules, each with title, focus and outcome. Keep CURRENT GOAL as the subject; do not introduce other subjects. Output JSON only; no thinking, commentary, markdown or lessons.';
    const compileUser='CURRENT GOAL: '+goal+'\nPlan title: '+clean(seed.title,100)+
      '\nTopic anchor: '+topic+'\nConvert THIS draft faithfully:\n'+draft.slice(0,4300)+
      '\nReturn 4 to 6 concrete subject-specific modules with observable outcomes. Include level "beginner", mode "guided" and assumptions [].';
    const compileResult=await run({
      purpose:'living-school-native-plan-compile-v1',phase:'compile',maxTokens:2300,
      system:compileSystem,user:compileUser,schema:LEARNING_PLAN_SCHEMA,structured:true
    });
    compiled=clean(compileResult?.outputText,16000);
    stage('compile',compileResult?.status==='success'?'complete':'failed',
      {label:'Raw JSON compiler output',text:compiled,code:compileResult?.error?.code||''});
    progress('compile',compiled.length,true);
    phase='validate';
    stage('validate','running',{label:'Independent contract and topic check'});
    let plan=null,validationError=null;
    try{
      const normalized=normalizeNativePlanContract(compileResult,seed,runtime);
      if(!normalized)assertNativePlanModel(compileResult,config,'Compile');
      const candidate=normalized||modelJson(compileResult);
      if(!candidate)throw new Error('JSON compiler returned no valid plan object.');
      plan=normalizeModelPlan(candidate,seed,existingPlan,{provider:'openai-compatible',model:config.model});
      if(normalized&&compileResult?.status==='invalid-response')
        stage('validate','normalized',{label:'Unambiguous JSON field normalization; topic and modules still checked',fields:['level','mode','assumptions']});
    }catch(error){validationError=error}
    if(validationError){
      stage('validate','needs-repair',{label:'Plan check needs targeted repair',errors:[clean(validationError.message,700)]});
      phase='repair';
      stage('repair','running',{label:'Qwen · targeted plan repair'});
      const repairResult=await run({
        purpose:'living-school-native-plan-repair-v1',phase:'repair',maxTokens:2400,structured:true,
        schema:LEARNING_PLAN_SCHEMA,
        system:'Repair a malformed or off-topic Learning Journey JSON object. Return a NEW valid JSON object only, with title, capability, level, mode, proof, assumptions and 4 to 6 subject-specific modules (title, focus, outcome). Keep the CURRENT GOAL and draft; correct only reported errors. No new topic or lessons.',
        user:'CURRENT GOAL: '+goal+'\nValidation error: '+clean(validationError.message,380)+
          '\nOriginal shareable draft:\n'+draft.slice(0,3500)+
          '\nPrevious JSON output:\n'+compiled.slice(0,3400)+'\nRepair as compact valid JSON.'
      });
      repairText=clean(repairResult?.outputText,16000);
      stage('repair',repairResult?.status==='success'?'complete':'failed',
        {label:'Raw targeted repair',text:repairText,code:repairResult?.error?.code||''});
      progress('repair',repairText.length,true);
      const normalizedRepair=normalizeNativePlanContract(repairResult,seed,runtime);
      if(!normalizedRepair)assertNativePlanModel(repairResult,config,'Repair');
      const repairedCandidate=normalizedRepair||modelJson(repairResult);
      if(!repairedCandidate)throw new Error('Repair stage returned no valid plan object.');
      plan=normalizeModelPlan(repairedCandidate,seed,existingPlan,{provider:'openai-compatible',model:config.model});
      if(normalizedRepair&&repairResult?.status==='invalid-response')
        stage('repair','normalized',{label:'Corrected JSON enum/assumption formatting after model repair'});
      phase='validate';
    }else stage('repair','skipped',{label:'No repair necessary'});
    stage('validate','complete',{label:'JSON, goal and module contract verified'});
    phase='saved';
    // Saving means REVIEW only; curriculum materialization remains gated.
    // The shared pending-plan record is the Living School review queue;
    // never misrepresent it as generated course content.
    saveLearningPlan({...plan,authoring:{...plan.authoring,pipelineId,formalStages:['intake','draft','compile','validate',...(repairText?['repair']:[]),'saved']}});
    stage('pipeline','complete',{label:'REVIEW plan saved; awaiting approval',artifactKey:'civweave.chat.capability.pending.living-school.plan.v1'});
    progress('saved',0,true);
    return learningPlanResponse(readLearningPlan());
  }catch(error){
    stage('pipeline',options.signal?.aborted?'stopped':'failed',
      {label:'Native formal Learning Journey failed',message:'Stage '+phase+': '+clean(error?.message||error,800)});
    throw error;
  }
}
async function generateLivingSchoolPlan(options={},existingPlan=null,revisionText=''){
  const request=curriculumRequest(options);
  if(!request.capability&&!existingPlan?.request?.capability)return packet('I can generate the Learning Journey plan, but I still need the observable capability the learner should be able to demonstrate.','Tell Moss what you want to be able to do, then the selected AI will generate the high-level plan for review.');
  const seed=existingPlan?.request?{...existingPlan.request,...request,capability:request.capability||existingPlan.request.capability,title:request.title||existingPlan.request.title}:{...request};
  // An explicit new learning goal is authoritative over any saved cabinet path,
  // chat history, previous plan, or model-returned title.
  const explicitGoal=learningJourneyIntent(options.text,options.history||[])?userCapability([{role:'user',text:clean(options.text,5000)}]):'';
  if(explicitGoal){
    seed.capability=explicitGoal;seed.title=titleCase(explicitGoal);seed.intent='new';
    const prior=readLearningPlan();
    if(prior?.state==='review'&&clean(prior.request?.capability,2400).toLowerCase()!==explicitGoal.toLowerCase())
      saveLearningPlan({...prior,state:'superseded',supersededBy:explicitGoal,updatedAt:now()});
  }
  let config;try{config=selectedPlanningConfig()}catch(error){return packet('Moss could not read the selected AI route: '+clean(error?.message||error,700),'Reselect the model in Settings.',{provider:'learning-plan-route-error'})}
  // The explicitly selected native Termux endpoint can use the shared
  // model runtime directly. The full value/economy/assistant bootstrap is
  // unnecessary for drafting an inert high-level plan and can block Android
  // before a single POST reaches llama-server.
  const nativeFastReady=Boolean(options.nativeFastLane&&nativePhoneServer(config)&&
    typeof globalThis.CivweaveModelRuntime?.generate==='function');
  if(!nativeFastReady){
    try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();config=selectedPlanningConfig()||config}catch(error){
      return packet(`Moss could not start the selected AI for Learning Journey planning: ${clean(error?.message||error,900)}`,'Retry the plan or check the selected AI model.',{provider:'learning-plan-model-error',model:clean(config?.model,240)});
    }
  }
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate||!config)return packet('Moss could not reach the selected AI runtime for Learning Journey planning. No learning content was generated or queued.','Retry after the selected AI runtime is ready.',{provider:'learning-plan-model-unavailable',model:clean(config?.model,240)});
  const requestedProvider=clean(config.provider||config.route,120).toLowerCase(),planConfig={...config,maxTokens:Math.min(1800,Math.max(900,Number(config.maxTokens)||1200)),temperature:Math.min(.35,Math.max(.1,Number(config.temperature)||.25))},history=seed.intent==='new'?[]:rowsFor(options).slice(-8).map(row=>({role:row.role,text:clean(row.text,1200)}));
  const context={schema:'civweave.learning-journey-plan-request.v2',request:seed,revision:clean(revisionText,3000),existingPlan:existingPlan?{title:existingPlan.request?.title,capability:existingPlan.request?.capability,level:existingPlan.request?.level,mode:existingPlan.request?.mode,proof:existingPlan.request?.proof,modules:existingPlan.modules||[],assumptions:existingPlan.assumptions||[]}:null,recentConversation:history,constraints:['Generate only a high-level Learning Journey plan for review.','Do not write lessons, explanations, exercises, quizzes, readings, source lists, or curriculum content.','Make the module sequence specific to the Hero’s stated learning goal.','Each module entry needs a short title, a focus, and an observable outcome.','Keep the plan in REVIEW. Nothing is approved, activated, or materialized by this call.']};
  let progressStage='intake';
  if(!(options.nativeFastLane&&nativePhoneServer(planConfig)))
    learningPlanProgress('started',{goal:seed.capability,model:config.model,provider:requestedProvider});
  try{
    const ggufChoice=selectedPlanGGUF(planConfig);
    const nativeServer=nativePhoneServer(planConfig);
    if(nativeServer){planConfig.stream=true;planConfig.timeoutMs=Math.max(Number(planConfig.timeoutMs)||0,150000)}
    if(nativeServer&&options.nativeFastLane)return await nativeFormalLearningPlan({runtime,config:planConfig,seed,options,existingPlan});
    const compactLocal=Boolean(ggufChoice||nativeServer);
    // A phone-sized GGUF should draft a small plan without a long context
    // packet or a large on-the-fly grammar. The shared runtime still parses
    // and independently validates the complete required Learning Plan schema.
    if(compactLocal){
      planConfig.maxTokens=nativeServer?640:512;
      planConfig.temperature=.2;
    }
    const topicAnchor=goalAnchors(seed)[0]||clean(seed.capability,100);
    const conciseMessages=compactLocal?[
      {role:'system',content:'You are Moss, the Living School learning guide. Return ONE short JSON object only, with keys title, capability, level, mode, proof, modules, assumptions. Each of exactly 3 modules has title, focus and observable outcome. The current learning goal is authoritative. The JSON must be specific to that goal. Name the subject explicitly in the plan heading AND in at least one module focus or outcome. Do not copy generic example modules, and do not use another conversation topic. Do not generate lessons yet.'},
      {role:'user',content:'CURRENT LEARNING GOAL: '+clean(seed.capability,350)+
        '\nSUBJECT KEYWORD TO INCLUDE IN AT LEAST ONE MODULE FOCUS: '+topicAnchor+
        '\nRequested title: '+clean(seed.title,120)+
        '\nLevel: '+clean(seed.level,50)+'; mode: '+clean(seed.mode,50)+
        '\nReturn a compact JSON object: {"title":"'+clean(seed.title,120).replace(/["\\]/g,'')+
        '","capability":"'+clean(seed.capability,300).replace(/["\\]/g,'')+
        '","level":"beginner","mode":"guided","proof":"observable practical demonstration","modules":[{"title":"topic-specific title","focus":"topic-specific focus","outcome":"observable goal"},{"title":"topic-specific title","focus":"topic-specific focus","outcome":"observable goal"},{"title":"topic-specific title","focus":"topic-specific focus","outcome":"observable goal"}],"assumptions":[]}. Replace EVERY example module string with specific terms about '+topicAnchor+'.'}
    ]:null;
    const result=await runtime.generate({purpose:'living-school-learning-plan-review-v2',executionProfile:'interactive',signal:options.signal,config:planConfig,schema:LEARNING_PLAN_SCHEMA,responseFormat:'json',context,
      ggufNoGrammar:Boolean(ggufChoice),maxRepairAttempts:compactLocal?0:1,
      onEvent:event=>{if(nativeServer&&event?.phase==='partial')try{options.onProgress?.({phase:'draft',characters:Number(event.characters)||0,complete:Boolean(event.complete)})}catch{}},task:{schema:'civweave.ai-task.v2',kind:'curriculum-plan-draft',systemId:'living-school',complexity:'routine',requirements:{profile:'interactive',requiresTools:false,externalResearch:false,code:false,planning:true,structuredOutput:true,vision:false,complexity:false}},capabilityRequirements:{profile:'interactive',requiresTools:false,externalResearch:false,planning:true,structuredOutput:true},messages:conciseMessages||[{role:'system',content:'You are Moss, Living School’s Learning Journey guide. Use the selected AI model to design a concise, personalized, high-level learning plan for review. Return strict JSON matching the supplied schema. Do not teach the subject yet and do not generate curriculum content. The output must remain an inert REVIEW plan until the Hero explicitly approves it.'},{role:'user',content:`Design the high-level Learning Journey plan from this request:\n${JSON.stringify(context)}`}]});
    learningPlanProgress('received',{text:clean(result?.outputText||(result?.outputJson&&JSON.stringify(result.outputJson))||'',24000),status:result?.status});
    progressStage='validate';
    if(!['success','fallback'].includes(result?.status))throw new Error(result?.error?.message||result?.error||`The selected AI ended with ${result?.status||'an error'}.`);
    const provider=clean(result?.actual?.provider||result?.provider||config.provider||config.route,120),model=clean(result?.actual?.model||result?.model||config.model,240),actualProvider=provider.toLowerCase();
    if(ggufChoice){
      const attested=provider==='openai-compatible'&&model===ggufChoice.model&&
        result.status==='success'&&result.diagnostics?.some(detail=>detail?.code==='BROWSER_GGUF');
      if(!attested)throw new Error('The selected imported Qwen GGUF was bypassed by '+provider+' ('+model+'). Moss refused to save the plan. No remote result can impersonate local GGUF inference.');
    }
    if(localPlanRoute(config)){
      if(result.status!=='success'||actualProvider!==requestedProvider||model!==config.model)
        throw new Error('The selected local AI model was bypassed or returned a fallback from '+(provider||'another provider')+'. Moss refused to save the plan.');
    }
    const plan=normalizeModelPlan(modelJson(result),seed,existingPlan,{provider,model});
    learningPlanProgress('validated',{draft:learningPlanText(plan)});
    saveLearningPlan(plan);
    learningPlanProgress('saved',{planId:plan.id});
    return learningPlanResponse(plan);
  }catch(error){
    learningPlanProgress('failed',{stage:progressStage,message:clean(error?.message||error,1200)});
    return packet(`Moss could not generate the high-level Learning Journey plan with the selected AI: ${clean(error?.message||error,1200)} No learning content was generated or queued.`,'Retry the plan or choose another AI model.',{provider:requestedProvider||'learning-plan-model-error',model:clean(error?.executionModel||config.model,240)});
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
  if(plan.state!=='review')return packet('This Learning Journey plan is not in REVIEW and cannot be approved. No learning content was generated.','Generate a current high-level plan for the learning goal you want.');
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
  // A fresh explicit learning goal outranks an older plan left in
  // revision-requested. Otherwise, repeated attempts can accidentally bring
  // the previous subject back into the model's plan context.
  if(learningJourneyIntent(text,history)&&!PLAN_REVISION.test(text))return generateLivingSchoolPlan(request);
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

async function handleNativeLivingSchoolRequest(options={}){
  // Reuse Moss's same review/revision/approval state machine without going
  // through the heavyweight assistant bootstrap. Ordinary non-curriculum
  // conversation returns null so the native chat lane can answer directly.
  const handler=capabilityHandlers.get('living-school');
  if(typeof handler!=='function')throw new Error('Moss learning policy is unavailable.');
  const notCurriculum=Object.freeze({__nativeLivingSchoolNotCurriculum:true});
  const result=await handler({...options,systemId:'living-school'},async()=>notCurriculum);
  return result===notCurriculum?null:result;
}
const api=Object.freeze({version:VERSION,systems:SYSTEMS,themes:THEMES,memoryFolders:MEMORY_FOLDERS,memoryFolder,activeTheme,registerCapability,normalizeSurface,synchronize,ensureWeavelingOrchestrator,curriculumIntent,learningJourneyIntent,curriculumRequest,readLearningPlan,generateLivingSchoolPlan,handleNativeLivingSchoolRequest,learningPlanResponse,approveLivingSchoolPlan,runLivingSchoolCurriculum,architecture:'one-core-five-themes-five-memory-folders',artifactLanguage:{'living-school':'Learning Journey'},learningPlanAuthoring:'selected-ai-local-capable',learningJourneyMaterialization:'review-then-explicit-approval',inputOwners:1,polling:false});
globalThis.CivweaveUnifiedChatSystemV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();