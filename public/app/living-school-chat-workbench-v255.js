(()=>{
'use strict';

const VERSION='1.0.56-living-school-chat-workbench-v264';
const STATE_KEY='civweave.living-school.cabinet.v151';
const PENDING_KEY='civweave.living-school.chat-curriculum.pending.v255';
const STRUCTURE=/\b(curriculum|course|syllabus|learning path|learning program|lesson plan|skill tree)\b/i;
const BUILD=/\b(build|create|make|generate|draft|design|develop|structure|regenerate|rebuild|revise|update|convert)\b/i;
const FOLLOWUP=/\b(beginner\s*(?:to|-|through)\s*(?:mastery|advanced)|final\s+(?:boss|challenge)|boss\b|make\s+the\s+learning|learning\s+for)\b/i;
const PRONOUN_BUILD=/^\s*(?:yes[,! ]*)?(?:let['’]?s\s+)?(?:go\s+ahead\s+and\s+)?(?:draft|build|make|generate|create|rebuild|revise|do)\s+(?:it|that|this)\s*[.!]?\s*$/i;
const MUTATION_CLAIM=/(?:\b(?:i|we)(?:['’]ve|\s+have)\s+(?:drafted|created|built|generated|structured|saved|updated|revised|made)\b|\b(?:has\s+been|was)\s+(?:created|generated|built|saved|drafted|structured|revised)\b)/i;
const REVISION_REQUEST=/\b(revise|update|regenerate|rebuild|edit|modify|extend|expand|refine)\b/i;
const CURRENT_PATH=/\b(current|existing|this|that|the)\s+(curriculum|course|syllabus|learning path|learning program|lesson plan|skill tree)\b/i;
const ADD_TO_CURRENT=/\b(add|integrate|insert|append|include)\b[\s\S]{0,120}\b(module|lesson|unit|section)\b/i;
const NEW_PATH=/\b(?:new|different|separate|another)\s+(?:curriculum|course|syllabus|learning path|learning program|lesson plan|skill tree)\b/i;
const MATERIALIZED=/\bI built\b[\s\S]{0,220}\bLiving School workbench\b|\bcurriculum came through the canonical Moss research-and-generation pipeline\b/i;
const LEVELS=['beginner','intermediate','advanced'];
const MODES=['guided','just-in-time','browse'];
const WORD_NUMBERS={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8};
const TOPIC_STOPWORDS=new Set(['a','an','and','are','as','at','be','can','course','curriculum','do','for','how','i','in','is','learn','learning','make','me','my','of','on','the','this','to','want']);

if(globalThis.CivweaveLivingSchoolChatWorkbenchV255?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const state=()=>{try{return globalThis.LivingSchoolCleanroomV218?.getState?.()||parse(localStorage.getItem(STATE_KEY),{})}catch{return{}}};
const rowsFor=options=>{
  const rows=Array.isArray(options?.history)?options.history.slice(-18):[];
  const current=clean(options?.text,12000);
  if(current&&!rows.some((row,index)=>index>=rows.length-2&&clean(row?.text||row?.content,12000)===current))rows.push({role:'user',text:current});
  return rows.map(row=>({role:clean(row?.role,40)||'unknown',text:clean(row?.text||row?.content,5000)})).filter(row=>row.text);
};
const contextText=rows=>rows.slice(-10).map(row=>row.text).join('\n');
const recentStructure=rows=>rows.slice(-8).some(row=>STRUCTURE.test(row.text));

function curriculumIntent(text,history=[]){
  const value=clean(text,4000),rows=[...history.map(row=>({text:clean(row?.text||row?.content,4000)})),{text:value}];
  if(!value)return false;
  if(STRUCTURE.test(value)&&(BUILD.test(value)||/\b(?:want|need|please|let['’]?s|ready)\b/i.test(value)))return true;
  if(PRONOUN_BUILD.test(value)&&recentStructure(rows))return true;
  if(BUILD.test(value)&&/\b(?:learning|lessons?|modules?)\b/i.test(value)&&recentStructure(rows))return true;
  if(FOLLOWUP.test(value)&&recentStructure(rows))return true;
  return false;
}

function quotedTitle(rows){
  for(const row of [...rows].reverse()){
    if(!STRUCTURE.test(row.text))continue;
    const matches=[...row.text.matchAll(/['"“”‘’]([^'"“”‘’]{3,90})['"“”‘’]/g)];
    if(matches.length)return clean(matches[0][1],120);
  }
  return'';
}

function sentenceTail(value){
  return clean(value,1000).replace(/^[\s:,-]+/,'').split(/(?<=[.!?])\s+/)[0].replace(/[.!?]+$/,'').trim();
}

function normalizeLearningGoal(value){
  let goal=sentenceTail(value)
    .replace(/^(?:about|on|for)\s+/i,'')
    .replace(/^(?:learning|learn)\s+(?:how\s+)?to\s+/i,'')
    .replace(/^how\s+(?:do|can|could|should|would)\s+i\s+/i,'')
    .replace(/^(?:how\s+to|to)\s+/i,'')
    .trim();
  if(/^learn\s+/i.test(goal))goal=goal.replace(/^learn\s+/i,'').trim();
  return clean(goal,1200);
}

function explicitBuildTopic(text){
  const value=clean(text,4000);
  const patterns=[
    /\b(?:curriculum|course|syllabus|learning path|learning program|lesson plan|skill tree)\b\s*(?::|[-–—])\s*(.+)$/i,
    /\b(?:build|create|make|generate|draft|design|develop|structure)\b[\s\S]{0,80}\b(?:curriculum|course|syllabus|learning path|learning program|lesson plan|skill tree)\b\s+(?:about|on|for)\s+(.+)$/i,
    /\b(?:new|different|separate|another)\s+(?:curriculum|course|syllabus|learning path|learning program|lesson plan|skill tree)\b\s+(?:about|on|for)?\s*(.+)$/i
  ];
  for(const pattern of patterns){
    const match=value.match(pattern);if(!match)continue;
    const goal=normalizeLearningGoal(match[1]);
    if(goal&&goal.length>2)return goal;
  }
  return'';
}

function masteryChallenge(rows){
  const texts=[...rows].reverse().map(row=>row.text);
  const patterns=[
    /\b(?:final\s+)?boss\s*(?:is|:|=)?\s*(?:to\s+)?(?:be\s+able\s+to\s+)?(.+)/i,
    /\bfinal\s+challenge\s*(?:is|:|=)?\s*(?:to\s+)?(?:be\s+able\s+to\s+)?(.+)/i,
    /\b(?:be\s+able\s+to|capable\s+of)\s+(.+)/i
  ];
  for(const text of texts){for(const pattern of patterns){const match=text.match(pattern);if(match){const value=sentenceTail(match[1]);if(value)return value}}}
  return'';
}

function userCapability(rows){
  const userRows=[...rows].reverse().filter(row=>row.role==='user');
  const patterns=[
    /\b(?:i\s+want|i\s+need|i['’]?d\s+like)\s+to\s+learn\s+(?:how\s+to\s+)?(.+)/i,
    /\b(?:i\s+want\s+to|i\s+need\s+to|i['’]?d\s+like\s+to|goal\s+is\s+to|objective\s+is\s+to|be\s+able\s+to|capable\s+of)\s+(.+)/i,
    /\b(?:learn|master|practice)\s+(?:how\s+to\s+)?(.+)/i
  ];
  for(const row of userRows){
    for(const pattern of patterns){
      const match=row.text.match(pattern);if(!match)continue;
      const value=normalizeLearningGoal(match[1]).replace(/\s+(?:and|but)\s+(?:the\s+)?(?:boss|final\s+challenge)\b.*$/i,'').trim();
      if(value&&value.length>3)return value;
    }
  }
  return'';
}

function rowsAfterMaterialization(rows){
  let index=-1;
  for(let i=rows.length-1;i>=0;i--){if(rows[i].role==='assistant'&&MATERIALIZED.test(rows[i].text)){index=i;break}}
  return index>=0?rows.slice(index+1):rows.slice(-8);
}

function topicTokens(value){
  return new Set(clean(value,2400).toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(token=>token.length>2&&!TOPIC_STOPWORDS.has(token)));
}
function materiallyDifferentTopic(goal,school){
  if(!clean(goal))return false;
  if(!school||(!clean(school.title)&&!clean(school.capability)))return true;
  const next=topicTokens(goal),prior=topicTokens(`${clean(school.title,400)} ${clean(school.capability,1600)}`);
  if(!next.size)return false;
  let overlap=0;for(const token of next)if(prior.has(token))overlap+=1;
  return overlap/next.size<0.5;
}

function revisionIntent(text){
  const value=clean(text,4000);
  if(ADD_TO_CURRENT.test(value))return true;
  if(REVISION_REQUEST.test(value)&&(CURRENT_PATH.test(value)||STRUCTURE.test(value)))return true;
  return false;
}

function newPathIntent(text,rows,school){
  const value=clean(text,4000);
  if(revisionIntent(value))return false;
  if(NEW_PATH.test(value))return true;
  const explicit=explicitBuildTopic(value);
  if(explicit)return materiallyDifferentTopic(explicit,school);
  if(!school||(!clean(school.title)&&!clean(school.capability)))return false;
  if(!(PRONOUN_BUILD.test(value)||(STRUCTURE.test(value)&&BUILD.test(value))))return false;
  const recentGoal=userCapability(rowsAfterMaterialization(rows));
  return materiallyDifferentTopic(recentGoal,school);
}

function moduleCount(rows,current){
  if(Number(current)>0)return Math.max(1,Math.min(8,Number(current)));
  for(const row of [...rows].reverse()){
    const numeric=row.text.match(/\b([1-8])\s*[- ]?(?:week|module|lesson|level)s?\b/i);if(numeric)return Number(numeric[1]);
    const word=row.text.match(/\b(one|two|three|four|five|six|seven|eight)\s*[- ]?(?:week|module|lesson|level)s?\b/i);if(word)return WORD_NUMBERS[word[1].toLowerCase()]||4;
  }
  return 4;
}

function startLevel(rows,current){
  const text=contextText(rows).toLowerCase();
  if(/\bbeginner\b/.test(text))return'beginner';
  const value=clean(current,80).toLowerCase();
  return LEVELS.includes(value)?value:'beginner';
}

function titleCase(value){return clean(value,100).split(/\s+/).slice(0,8).map(word=>word?word[0].toUpperCase()+word.slice(1):word).join(' ')}

function curriculumRequest(options={}){
  const rows=rowsFor(options),s=state(),school=s?.school||{},path=s?.pathContext||{},replaceExisting=newPathIntent(options.text,rows,school);
  const scopedRows=replaceExisting?rowsAfterMaterialization(rows):rows;
  const explicitTopic=explicitBuildTopic(options.text);
  const challenge=masteryChallenge(scopedRows);
  const freshCapability=clean(explicitTopic||userCapability(scopedRows)||challenge,2400);
  const title=replaceExisting?clean(quotedTitle(scopedRows),240):clean(school.title||path.title||quotedTitle(rows),240);
  let capability=replaceExisting
    ? clean(freshCapability||challenge,2400)
    : clean(challenge||school.capability||path.capability||freshCapability||userCapability(rows),2400);
  if(!capability&&title)capability=`Demonstrate ${title} independently through observable practice and reviewable evidence.`;
  const finalTitle=title||titleCase(capability)||'Learning Path';
  let proof=replaceExisting?'A working artifact, explanation, and independent receipt.':clean(school.proof||path.proof,3000)||'A working artifact, explanation, and independent receipt.';
  if(challenge&&!proof.toLowerCase().includes(challenge.toLowerCase()))proof=`${proof} Final mastery challenge: ${challenge}.`;
  const mode=MODES.includes(clean(s?.settings?.mode,80).toLowerCase())?clean(s.settings.mode,80).toLowerCase():'guided';
  return{
    title:finalTitle,
    capability,
    level:startLevel(scopedRows,replaceExisting?'':school.level),
    count:moduleCount(scopedRows,replaceExisting?0:school.modules?.length),
    mode,
    modelRoute:clean(s?.settings?.modelRoute,120)||'shared',
    proof,
    masteryChallenge:challenge,
    replaceExisting,
    pathMode:replaceExisting?'new':'revise',
    requestedAt:now(),
    sourceText:clean(options.text,4000)
  };
}

function schoolSignature(){
  const s=state(),school=s?.school||null;
  if(!school)return'none';
  return JSON.stringify([school.id||'',school.title||'',school.capability||'',school.modules?.length||0,school.generation?.provider||'',school.generation?.model||'']);
}

function packet(answer,nextAction='',extra={}){
  return{
    response:{answer,choice:{mode:'Learn',system:'living-school',room:'',nextAction},assumptions:[],requiresConsent:false,confidence:.99},
    provider:extra.provider||'living-school-workbench',
    model:extra.model||'canonical-learning-workbench',
    action:extra.action||null,
    context:{guide:{system:'living-school',name:'Moss'},workbench:extra.workbench||null},
    fallbackFrom:null
  };
}

function generatedPacket(result,request){
  const school=result?.school||result||{},modules=Array.isArray(school.modules)?school.modules:[],first=modules[0],generation=school.generation||{},sourceCount=Number(result?.sourceCount||generation.sourceCount||0);
  const researchText=sourceCount?` ${sourceCount} source record${sourceCount===1?'':'s'} are attached.`:'';
  const fallbackText=generation.fallback?' The canonical local fallback completed after research because the selected shared generation route did not finish.':' The curriculum came through the canonical Moss research-and-generation pipeline.';
  const replacementText=request.replaceExisting?' This is a new learning path; the previous curriculum was not used as its capability, title, proof contract, or module-progress source.':'';
  const answer=`I built “${clean(school.title||request.title,240)}” in the Living School workbench, rather than pretending the curriculum exists inside chat. It now has ${modules.length||request.count} module${(modules.length||request.count)===1?'':'s'} starting at ${clean(school.level||request.level,80)} for the capability “${clean(school.capability||request.capability,500)}”.${researchText}${fallbackText}${replacementText}`;
  const next=first?.title?`Open Module 1: ${clean(first.title,180)}.`:'Review the generated curriculum in the Living School workbench.';
  return packet(answer,next,{provider:'living-school-workbench',model:generation.model||generation.provider||'canonical-learning-workbench',action:{kind:'living-school-curriculum-generated',system:'living-school',state:'completed',schoolId:school.id||'',title:school.title||request.title,moduleCount:modules.length||request.count,capability:school.capability||request.capability,pathMode:request.pathMode||'revise',source:'moss-shared-chat'},workbench:{schoolId:school.id||'',moduleCount:modules.length||request.count,sourceCount,pathMode:request.pathMode||'revise'}});
}

function clarificationPacket(request){
  return packet('I can build the curriculum in the Living School workbench, but I still need the observable capability the learner should be able to demonstrate. I have not created or started a course yet.','Name the observable capability, then tell me to generate the curriculum.',{provider:'living-school-workbench-contract'});
}

function queuedPacket(request){
  try{localStorage.setItem(PENDING_KEY,JSON.stringify({...request,autoRun:true,queuedAt:now()}))}catch{}
  return packet('I saved this as a Living School workbench request. I have not generated the curriculum yet because the Learning Workbench is not mounted on this page. When Living School opens, Moss will run the queued request through research and the canonical curriculum generator.','Open Living School to run the queued curriculum build.',{provider:'living-school-workbench-queue',action:{kind:'living-school-curriculum-queued',system:'living-school',state:'queued',title:request.title,capability:request.capability,pathMode:request.pathMode}});
}

async function executeCurriculum(options={}){
  const request=curriculumRequest(options);
  if(!request.capability)return clarificationPacket(request);
  const workbench=globalThis.LivingSchoolCleanroomV218;
  if(typeof workbench?.generateCurriculumFromChat!=='function')return queuedPacket(request);
  try{
    const result=await workbench.generateCurriculumFromChat(request);
    try{localStorage.removeItem(PENDING_KEY)}catch{}
    try{dispatchEvent(new CustomEvent('civweave:moss-workbench-action',{detail:{kind:'curriculum-generated',title:result?.school?.title||request.title,capability:request.capability,moduleCount:result?.school?.modules?.length||request.count,pathMode:request.pathMode}}))}catch{}
    return generatedPacket(result,request);
  }catch(error){
    return packet(`I tried to build “${request.title}” in the Living School workbench, but the canonical generator stopped: ${clean(error?.message||error,1200)} I did not mark the curriculum as generated.`,'Review the capability or AI/research settings, then retry the curriculum build.',{provider:'living-school-workbench-error',action:{kind:'living-school-curriculum-generation-failed',system:'living-school',state:'failed',title:request.title,capability:request.capability,pathMode:request.pathMode,error:clean(error?.message||error,1000)}});
  }
}

function guardFalseMutationClaim(result,before){
  if(!result?.response)return result;
  const after=schoolSignature(),answer=clean(result.response.answer,10000);
  if(before===after&&MUTATION_CLAIM.test(answer)){
    result.response.answer='I have not changed the Living School workbench yet. I can discuss the structure here, but curriculum creation, research, modules, lessons, assessments, and credentials must be materialized in the Learning Workbench before I describe them as created.';
    result.response.choice={...(result.response.choice||{}),mode:'Learn',system:'living-school',nextAction:'Tell me to generate or revise the curriculum in the Living School workbench.'};
    result.response.requiresConsent=false;
    result.provider=result.provider||'living-school-workbench-guard';
  }
  return result;
}

function patchAssistant(api){
  if(!api?.respond||api.respond.__cwLivingSchoolWorkbenchV255)return api;
  const originalFn=api.respond,original=originalFn.bind(api);
  const respond=async options=>{
    const request={...(options||{})},system=clean(request.systemId,80).toLowerCase()||'civweave',text=clean(request.text,12000),history=Array.isArray(request.history)?request.history:[];
    if(system!=='living-school')return original(request);
    if(curriculumIntent(text,history))return executeCurriculum(request);
    const before=schoolSignature();
    const result=await original(request);
    return guardFalseMutationClaim(result,before);
  };
  respond.__cwLivingSchoolWorkbenchV255=true;
  for(const key of ['__guideIdentityIntegrityV216','__deterministicModeV175'])if(originalFn[key])respond[key]=originalFn[key];
  try{api.respond=respond;if(api.respond===respond)return api}catch{}
  try{globalThis.CivweaveAssistantV141={...api,respond};return globalThis.CivweaveAssistantV141}catch{return api}
}

function patchAvailable(){return patchAssistant(globalThis.CivweaveAssistantV141)}
function patchLoader(loader){
  if(!loader?.ensure||loader.ensure.__cwLivingSchoolWorkbenchV255)return loader;
  const originalEnsure=loader.ensure.bind(loader);
  const ensure=async(...args)=>{const result=await originalEnsure(...args);patchAvailable();return result};
  ensure.__cwLivingSchoolWorkbenchV255=true;
  try{loader.ensure=ensure}catch{}
  if(loader.warm&&!loader.warm.__cwLivingSchoolWorkbenchV255){
    const originalWarm=loader.warm.bind(loader),warm=async(...args)=>{const result=await originalWarm(...args);patchAvailable();return result};warm.__cwLivingSchoolWorkbenchV255=true;try{loader.warm=warm}catch{}
  }
  return loader;
}

let pendingRun=null;
async function consumePending(){
  if(pendingRun||typeof globalThis.LivingSchoolCleanroomV218?.generateCurriculumFromChat!=='function')return pendingRun;
  const request=parse(localStorage.getItem(PENDING_KEY),null);
  if(!request?.autoRun||!clean(request.capability))return null;
  pendingRun=(async()=>{
    try{
      const result=await globalThis.LivingSchoolCleanroomV218.generateCurriculumFromChat(request);
      localStorage.removeItem(PENDING_KEY);
      const completion=generatedPacket(result,request).response;
      try{globalThis.CivweavePersistentGuideChatV215?.notify?.('living-school',completion.answer,{open:false})}catch{}
      return result;
    }catch(error){
      try{globalThis.CivweavePersistentGuideChatV215?.notify?.('living-school',`The queued curriculum build stopped: ${clean(error?.message||error,1200)} Nothing was marked generated.`,{open:false})}catch{}
      return null;
    }finally{pendingRun=null}
  })();
  return pendingRun;
}

function start(){
  patchLoader(globalThis.CivweaveFamilyAILoaderV105);
  patchAvailable();
  consumePending();
  addEventListener('civweave:guide-loader-reset',()=>setTimeout(()=>{patchLoader(globalThis.CivweaveFamilyAILoaderV105);patchAvailable()},0));
  addEventListener('civweave:guide-workspace-ready',()=>setTimeout(()=>{patchLoader(globalThis.CivweaveFamilyAILoaderV105);patchAvailable()},0));
  addEventListener('civweave:living-school-workbench-ready',()=>setTimeout(()=>{patchAvailable();consumePending()},0));
  let ticks=0;const timer=setInterval(()=>{patchLoader(globalThis.CivweaveFamilyAILoaderV105);patchAvailable();consumePending();if(++ticks>=300)clearInterval(timer)},100);
}

globalThis.CivweaveLivingSchoolChatWorkbenchV255=Object.freeze({version:VERSION,curriculumIntent,curriculumRequest,newPathIntent,revisionIntent,explicitBuildTopic,executeCurriculum,guardFalseMutationClaim,patchAvailable,consumePending,pendingKey:PENDING_KEY,policy:'moss-chat-distinguishes-new-learning-paths-from-current-path-revisions-v264'});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
