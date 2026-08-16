(()=>{
'use strict';

const VERSION='1.0.2-unified-chat-system-v1-learning-continuation';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const ROOT_ID='cw-persistent-guide-chat-v215';
const PENDING_PREFIX='civweave.chat.capability.pending';
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

const STRUCTURE=/\b(curriculum|course|syllabus|learning path|learning pathway|learning program|learning plan|study plan|lesson plan|skill tree)\b/i;
const BUILD=/\b(build|create|make|generate|draft|design|develop|structure|regenerate|rebuild|revise|update|convert|start)\b/i;
const REVISE=/\b(revise|update|regenerate|rebuild|edit|change|modify|continue|add|remove|expand|deepen|shorten|simplify)\b/i;
const PRONOUN_BUILD=/^\s*(?:yes[,! ]*)?(?:let['’]?s\s+)?(?:go\s+ahead\s+and\s+)?(?:draft|build|make|generate|create|rebuild|revise|do)\s+(?:it|that|this)\s*[.!]?\s*$/i;
const CONTINUE=/^\s*(?:[.…·•-]{1,8}|continue|continue please|keep going|go on|carry on|resume|resume please|finish|finish it|finish this|pick up where (?:you|we) left off|continue where (?:you|we) left off|and continue)\s*[.!?]*\s*$/i;
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
function sentenceTail(value){return clean(value,1200).replace(/^[\s:,-]+/,'').split(/(?<=[.!?])\s+/)[0].replace(/[.!?]+$/,'').trim()}
function normalizeSubject(value){return clean(sentenceTail(value).replace(/^how\s+(?:do|can|could|should|would)\s+(?:i|we)\s+/i,'').replace(/^how\s+to\s+/i,'').replace(/^learn(?:ing)?\s+(?:how\s+to\s+|to\s+)/i,'').replace(/^to\s+/i,'').replace(/^(?:about|on)\s+/i,''),1200)}
function explicitSubject(text){
  const value=clean(text,5000),structure='(?:curriculum|course|syllabus|learning path|learning pathway|learning program|learning plan|study plan|lesson plan|skill tree)',patterns=[
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
    const match=row.text.match(/\b(?:i\s+want\s+to|i\s+need\s+to|i['’]?d\s+like\s+to|goal\s+is\s+to|objective\s+is\s+to|be\s+able\s+to|capable\s+of|learn|master|practice)\s+(?:how\s+to\s+)?(.+)/i);
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
  const rows=rowsFor(options),state=stateForLivingSchool(),school=state?.school||{},path=state?.pathContext||{},text=clean(options.text,5000),continuing=CONTINUE.test(text),subject=explicitSubject(text)||(continuing?recentSubject(rows):'');
  const hasActive=Boolean(school?.title||school?.capability),newPath=Boolean(subject||/\bnew\s+(?:curriculum|course|syllabus|learning path|learning pathway|learning program|learning plan|study plan|lesson plan|skill tree)\b/i.test(text)||!hasActive||(STRUCTURE.test(text)&&BUILD.test(text)&&!REVISE.test(text)));
  const capability=clean(newPath?(subject||recentSubject(rows)||userCapability(rows)):(school.capability||path.capability||recentSubject(rows)||userCapability(rows)),2400);
  const title=clean(newPath?(titleCase(subject||capability)):(school.title||path.title||titleCase(capability)),240)||'Learning Path';
  return{title,capability,level:newPath?'beginner':clean(school.level,80)||'beginner',count:moduleCount(rows,newPath?0:school.modules?.length),mode:clean(state?.settings?.mode,80)||'guided',modelRoute:clean(state?.settings?.modelRoute,120)||'shared',proof:newPath?'A working artifact, explanation, and independent receipt.':clean(school.proof||path.proof,3000)||'A working artifact, explanation, and independent receipt.',intent:newPath?'new':'revise',newPath,replaceExisting:newPath,requestedAt:now(),sourceText:clean(options.text,4000),continuation:continuing};
}
function packet(answer,nextAction='',extra={}){return{response:{answer,choice:{mode:'Learn',system:'living-school',room:'',nextAction},assumptions:[],requiresConsent:false,confidence:.99},provider:extra.provider||'unified-chat-capability',model:extra.model||'living-school-learning-engine',action:extra.action||null,context:{guide:{system:'living-school',name:'Moss'},capability:'curriculum'},fallbackFrom:null}}
async function runLivingSchoolCurriculum(options={}){
  const request=curriculumRequest(options);
  if(!request.capability)return packet('I can build the learning path, but I still need the observable capability the learner should be able to demonstrate.','Name the capability, then ask Moss to generate the learning path.');
  const engine=globalThis.LivingSchoolCleanroomV218;
  if(typeof engine?.generateCurriculumFromChat!=='function'){
    try{localStorage.setItem(`${PENDING_PREFIX}.living-school.curriculum.v1`,JSON.stringify({...request,autoRun:true,queuedAt:now()}))}catch{}
    return packet('I saved the learning-path request. The shared chat stays here; Living School will materialize the learning content when its learning engine is available.','Open Living School when you want the queued learning path materialized.',{action:{kind:'living-school-curriculum-queued',system:'living-school',state:'queued',title:request.title,capability:request.capability,intent:request.intent}});
  }
  try{
    const result=await engine.generateCurriculumFromChat(request),school=result?.school||result||{},modules=Array.isArray(school.modules)?school.modules:[];
    try{localStorage.removeItem(`${PENDING_PREFIX}.living-school.curriculum.v1`)}catch{}
    return packet(`I built “${clean(school.title||request.title,240)}” through Living School's learning engine. It has ${modules.length||request.count} module${(modules.length||request.count)===1?'':'s'} for “${clean(school.capability||request.capability,500)}”.`,modules[0]?.title?`Open Module 1: ${clean(modules[0].title,180)}.`:'Review the generated learning path.',{provider:'living-school-learning-engine',model:school.generation?.model||school.generation?.provider||'canonical-learning-engine',action:{kind:'living-school-curriculum-generated',system:'living-school',state:'completed',schoolId:school.id||'',title:school.title||request.title,moduleCount:modules.length||request.count,capability:school.capability||request.capability,source:'unified-chat',intent:request.intent}});
  }catch(error){return packet(`The Living School learning engine stopped before it could materialize “${request.title}”: ${clean(error?.message||error,1000)} Nothing was marked generated.`,'Review the learning request or model settings, then retry.',{provider:'living-school-learning-engine-error',action:{kind:'living-school-curriculum-generation-failed',system:'living-school',state:'failed',error:clean(error?.message||error,800)}})}
}
function guardLivingSchoolMutation(result,before){
  if(!result?.response)return result;
  const after=JSON.stringify(stateForLivingSchool()?.school||null),answer=clean(result.response.answer,10000);
  if(before===after&&MUTATION_CLAIM.test(answer)){result.response.answer='I have not changed the Living School learning surface yet. I can discuss the structure here, but learning content must be materialized by the Living School engine before I describe it as created.';result.response.choice={...(result.response.choice||{}),mode:'Learn',system:'living-school',nextAction:'Ask Moss to generate or revise the learning path.'}}
  return result;
}
function registerCapability(system,handler){if(SYSTEMS.includes(system)&&typeof handler==='function')capabilityHandlers.set(system,handler)}
registerCapability('living-school',async(request,next)=>{
  const history=Array.isArray(request.history)?request.history:[],text=clean(request.text,12000);
  if(curriculumIntent(text,history))return runLivingSchoolCurriculum(request);
  const before=JSON.stringify(stateForLivingSchool()?.school||null),result=await next(request);
  return guardLivingSchoolMutation(result,before);
});

function patchAssistant(){
  const api=globalThis.CivweaveAssistantV141;
  if(!api?.respond||api.respond.__cwUnifiedChatSystemV1)return false;
  const originalFn=api.respond,original=originalFn.bind(api);
  const respond=async options=>{
    const request={...(options||{})},system=SYSTEMS.includes(clean(request.systemId,80).toLowerCase())?clean(request.systemId,80).toLowerCase():'civweave',handler=capabilityHandlers.get(system);
    return handler?handler({...request,systemId:system},original):original({...request,systemId:system});
  };
  respond.__cwUnifiedChatSystemV1=true;
  for(const key of ['__guideIdentityIntegrityV216','__deterministicModeV175'])if(originalFn[key])respond[key]=originalFn[key];
  try{api.respond=respond;assistantPatched=api.respond===respond}catch{}
  if(!assistantPatched){try{globalThis.CivweaveAssistantV141={...api,respond};assistantPatched=true}catch{}}
  return assistantPatched;
}
function patchLoader(){
  const loader=globalThis.CivweaveFamilyAILoaderV105;
  if(!loader?.ensure||loader.ensure.__cwUnifiedChatSystemV1)return false;
  const original=loader.ensure.bind(loader),ensure=async(...args)=>{const result=await original(...args);patchAssistant();return result};
  ensure.__cwUnifiedChatSystemV1=true;
  try{loader.ensure=ensure;loaderPatched=true}catch{}
  return loaderPatched;
}
async function consumePending(){
  if(pendingRun||typeof globalThis.LivingSchoolCleanroomV218?.generateCurriculumFromChat!=='function')return pendingRun;
  const key=`${PENDING_PREFIX}.living-school.curriculum.v1`,request=parse(localStorage.getItem(key),null);
  if(!request?.autoRun||!clean(request.capability))return null;
  pendingRun=globalThis.LivingSchoolCleanroomV218.generateCurriculumFromChat(request).then(result=>{localStorage.removeItem(key);try{globalThis.CivweavePersistentGuideChatV215?.notify?.('living-school',`Your queued learning path “${clean(result?.school?.title||request.title,180)}” is ready.`,{open:false})}catch{};return result}).catch(error=>{try{globalThis.CivweavePersistentGuideChatV215?.notify?.('living-school',`The queued learning-path build stopped: ${clean(error?.message||error,800)} Nothing was marked generated.`,{open:false})}catch{};return null}).finally(()=>{pendingRun=null});
  return pendingRun;
}
function synchronize(){normalizeSurface();patchLoader();patchAssistant();consumePending();return true}
function bindLifecycle(){
  if(lifecycleBound)return;
  lifecycleBound=true;
  for(const name of ['civweave:guide-workspace-ready','civweave:guide-loader-reset','civweave:assistant-runtime-ready','civweave:response-router-installed','civweave:living-school-workbench-ready','civweave:guide-chat-opened','pageshow'])addEventListener(name,()=>queueMicrotask(synchronize));
}
function start(){bindLifecycle();synchronize();document.documentElement.dataset.civweaveChatSystem='unified-v1'}

const api=Object.freeze({version:VERSION,systems:SYSTEMS,themes:THEMES,memoryFolders:MEMORY_FOLDERS,memoryFolder,activeTheme,registerCapability,normalizeSurface,synchronize,curriculumIntent,curriculumRequest,runLivingSchoolCurriculum,architecture:'one-core-five-themes-five-memory-folders',inputOwners:1,polling:false});
globalThis.CivweaveUnifiedChatSystemV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();