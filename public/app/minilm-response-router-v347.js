(()=>{
'use strict';
const VERSION='1.3.1-minilm-primary-response-router-v347-living-school-bypass';
const ADAPTER='/app/models/all-minilm-l6-v2/adapter.js';
const ROUTER='/app/minilm-context-router-v344.js?v=1.0.0';
const SERVER_ROUTER='/app/server-ai-router-v301.js?v=1.0.116-server-ai-router-v301';
const MODEL_IDS=Object.freeze({
  short:Object.freeze(['gemma3-1b-it-q4f16','qwen3-0.6b-q4f16','smollm2-360m-instruct-q4f16','smollm2-135m-instruct-q8-wasm']),
  medium:Object.freeze(['qwen3-1.7b-q4f16','smollm3-3b-q4f16']),
  fast:Object.freeze(['gemma4-e2b-it-q2f16-mobile','gemma4-e4b-it-q2f16-mobile']),
  smart:Object.freeze(['gemma4-e4b-it-q2f16-mobile','gemma4-e2b-it-q2f16-mobile'])
});
const TIERS=Object.freeze({
  short:Object.freeze({id:'short',minWords:0,maxWords:50,targetWords:45,maxTokens:96,modelClass:'<=1B',preferredModelIds:MODEL_IDS.short}),
  medium:Object.freeze({id:'medium',minWords:100,maxWords:200,targetWords:160,maxTokens:320,modelClass:'2B-3B',preferredModelIds:MODEL_IDS.medium}),
  fast:Object.freeze({id:'fast',minWords:250,maxWords:800,targetWords:520,maxTokens:1400,modelClass:'Gemma4-26B-fast',preferredModelIds:MODEL_IDS.fast}),
  smart:Object.freeze({id:'smart',minWords:900,maxWords:null,targetWords:1200,maxTokens:3072,modelClass:'Gemma4-26B-smart',preferredModelIds:MODEL_IDS.smart})
});
const TINY_LOCAL_MODELS=Object.freeze(['smollm2-135m-instruct-q8-wasm','smollm2-360m-instruct-q4f16']);
const TINY_LOCAL_SET=new Set(TINY_LOCAL_MODELS);
const LANGUAGE_PACK=Object.freeze({
  full:'Civweave language pack: refer to a person using Civweave as a Hero (Heroes plural). A goal or intention plan is a Quest; Heroes collaborating on a Quest are a Party. A host community is a Guild and its human operator is the Guildkeeper. The territory-level chartering and continuity role is Charterkeeper. The map is the Guild Map. Citizen and Patron are membership/slot labels. Rook is the Quartermaster guide; Quartermaster is not the Guild operator. Use these terms naturally. Do not revive Hub, Hub Node, Node Steward, Territory Steward, or Guild Steward in user-facing language.',
  tiny:'Civweave words: user=Hero; plan/intention=Quest; Quest group=Party; host community=Guild; operator=Guildkeeper; regional charter role=Charterkeeper; map=Guild Map; Rook=Quartermaster. Never call the Guildkeeper Quartermaster.'
});
const TINY_GUIDE=Object.freeze({
  civweave:'You are Weaveling. Reflect the Hero’s intent and connect the four realms.',
  'living-school':'You are Moss. Teach clearly, build understanding, give suitable practice, and check learning.',
  cerbanimo:'You are Kamiya, the Questwright. Turn work into concrete, inspectable Quests; never pretend work was executed.',
  fellowfare:'You are Rook, the Quartermaster. Match needs, offers, materials, services, and logistics; never invent price or availability.',
  anarchadia:'You are Merlin. Help shape proposals, rules, coordination, and automations; keep draft, vote, approval, and execution distinct.'
});
const LENGTH_PROTOTYPES=Object.freeze([
  {id:'short',text:'brief direct answer one sentence tiny reply quick confirmation simple fact concise under fifty words'},
  {id:'medium',text:'moderate explanation useful context a few paragraphs answer in one hundred to two hundred words'},
  {id:'fast',text:'detailed explanation analysis comparison plan several sections substantial answer two hundred fifty to eight hundred words'},
  {id:'smart',text:'deep comprehensive exhaustive architecture research synthesis long form complex reasoning nine hundred words or more'}
]);
const TASK_PROTOTYPES=Object.freeze([
  {id:'programming',text:'write code debug bug fix programming refactor implementation repository pull request commit merge tests CI API database script deploy'},
  {id:'agentic',text:'perform multiple steps use tools investigate execute implement ship monitor deploy browse repository create pull request merge orchestrate workflow'},
  {id:'ordinary',text:'conversation explanation question recommendation summary simple writing general information'}
]);
const ARTIFACT_PROTOTYPES=Object.freeze([
  {id:'curriculum',text:'create build draft generate design learning path learning pathway learning program curriculum course syllabus lesson plan skill tree study plan teaching program'},
  {id:'quest',text:'create build draft design plan quest project work plan implementation plan deliverable checkpoints acceptance criteria evidence skilled work'},
  {id:'resource',text:'create build draft resource manifest skill manifest procurement request offer sourcing plan materials inventory needs exchange listing'},
  {id:'governance',text:'create build draft proposal policy rule charter governance plan vote motion agreement decision process civic change'},
  {id:'weave',text:'create build draft cross realm plan roadmap intention weave multi realm strategy coordinated quest'},
  {id:'dialogue',text:'chat answer explain discuss question brainstorm clarify reflect converse without creating a structured artifact'}
]);
const clean=(value,max=12000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
function livingSchoolGenerationActive(){
  if(typeof document==='undefined')return false;
  const root=document.documentElement,button=document.querySelector?.('[data-ls-action="generate-curriculum"]');
  return root?.dataset?.livingSchoolGenerationActive==='true'||root?.dataset?.livingSchoolRunRailActive==='true'||button?.getAttribute?.('aria-busy')==='true';
}
function internalLivingSchoolRequest(request={}){
  const purpose=clean(request?.purpose,240).toLowerCase(),context=request?.context&&typeof request.context==='object'?request.context:{};
  if(/^living-school-/.test(purpose))return true;
  if(context.responseReviewOwner==='living-school'||context.livingSchoolGenerationSession===true||context.livingSchoolInternalGeneration===true)return true;
  if(livingSchoolGenerationActive()&&purpose==='civweave-safe-admission-review-v1')return true;
  return false;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let adapterPromise=null,semanticPromise=null,serverRouterPromise=null,wrappedRuntime=null,installTimer=0,installedCache={at:0,ids:new Set()},localSwitchQueue=Promise.resolve(),registeredSpine=null;
function adapter(){if(!adapterPromise)adapterPromise=import(ADAPTER).catch(error=>{adapterPromise=null;throw error});return adapterPromise}
function loadScript(src,ready){
  if(ready?.())return Promise.resolve(ready());
  const path=new URL(src,location.href).pathname,existing=[...(document.scripts||[])].find(node=>{try{return new URL(node.src,location.href).pathname===path}catch{return false}});
  if(existing)return new Promise(resolve=>{if(ready?.())return resolve(ready());existing.addEventListener?.('load',()=>resolve(ready?.()||null),{once:true});existing.addEventListener?.('error',()=>resolve(null),{once:true});setTimeout(()=>resolve(ready?.()||null),2500)});
  return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value)},script=document.createElement('script'),timer=setTimeout(()=>finish(ready?.()||null),500);script.src=src;script.async=false;script.onload=()=>finish(ready?.()||null);script.onerror=()=>finish(null);document.head?.append(script)});
}
function semanticRouter(){
  if(globalThis.CivweaveContextRouterV344)return Promise.resolve(globalThis.CivweaveContextRouterV344);
  if(semanticPromise)return semanticPromise;
  semanticPromise=loadScript(ROUTER,()=>globalThis.CivweaveContextRouterV344).catch(()=>null);
  return semanticPromise;
}
async function serverRouter(){
  if(globalThis.CivweaveServerAIRouterV301?.handle)return globalThis.CivweaveServerAIRouterV301;
  if(!serverRouterPromise)serverRouterPromise=loadScript(SERVER_ROUTER,()=>globalThis.CivweaveServerAIRouterV301).catch(()=>null);
  return serverRouterPromise;
}
function explicitWordRequest(text){
  const t=clean(text,4000).toLowerCase();
  let match=t.match(/\b(\d{1,4})\s*(?:-|–|—|to)\s*(\d{1,4})\s*words?\b/);
  if(match)return{min:Number(match[1]),max:Number(match[2]),explicit:true};
  match=t.match(/\b(?:under|fewer than|no more than|max(?:imum)?|up to|≤)\s*(\d{1,4})\s*words?\b/);if(match)return{min:0,max:Number(match[1]),explicit:true};
  match=t.match(/\b(?:at least|minimum|min(?:imum)?|over|more than|≥)\s*(\d{1,4})\s*words?\b/);if(match)return{min:Number(match[1]),max:null,explicit:true};
  match=t.match(/\b(?:about|around|roughly|approximately)?\s*(\d{1,4})\s*words?\b/);if(match)return{min:Number(match[1]),max:Number(match[1]),explicit:true};
  if(/\b(one sentence|single sentence|briefly|very brief|super brief|short answer|keep it short|concise)\b/.test(t))return{min:0,max:50,explicit:true};
  if(/\b(medium length|medium-length)\b/.test(t))return{min:100,max:200,explicit:true};
  if(/\b(deep dive|comprehensive|exhaustive|long form|long-form|very detailed)\b/.test(t))return{min:900,max:null,explicit:true};
  return null;
}
function complexity(text){
  const raw=String(text||''),t=raw.toLowerCase();let score=0;
  score+=Math.min(3,Math.floor(raw.length/500));score+=Math.min(2,(raw.match(/\?/g)||[]).length);score+=Math.min(2,(raw.match(/\n\s*[-*\d]/g)||[]).length);
  if(/\b(analy[sz]e|compare|architecture|design|reason|tradeoff|debug|diagnose|investigate|research|plan|strategy|evaluate|synthesize)\b/.test(t))score+=2;
  if(/\b(step[- ]by[- ]step|multiple|all of|every|thorough|detailed)\b/.test(t))score+=1;
  return Math.min(10,score);
}
function hardTaskClass(text,request={}){
  const t=`${clean(text,6000)} ${clean(request.purpose,300)} ${clean(request.executionProfile,100)}`.toLowerCase();
  const programming=/\b(code|coding|program(?:ming)?|debug|bug|refactor|typescript|javascript|python|rust|sql|html|css|api|function|class|stack trace|exception|unit test|integration test|pull request|\bpr\b|commit|merge|repository|repo|github|ci\b|deploy(?:ment)?)\b/.test(t);
  const agentic=String(request.executionProfile||'').toLowerCase()==='agentic'||/\b(implement|build and merge|fix and merge|commit and merge|create (?:a )?pr|open (?:a )?pr|ship it|deploy it|monitor|use tools|browse and|investigate and|go ahead and build|execute this|agentic|orchestrate)\b/.test(t);
  return programming?'programming':agentic?'agentic':'ordinary';
}
function declaredTaskClass(request={}){
  const profile=clean(request.executionProfile,100).toLowerCase(),kind=clean(request?.task?.kind||'',120).toLowerCase();
  if(profile==='agentic'||kind==='agentic')return'agentic';
  if(['programming','code','coding','implementation'].includes(kind))return'programming';
  return'';
}
function fallbackLength(text){
  const explicit=explicitWordRequest(text),c=complexity(text);
  if(explicit){const ceiling=explicit.max,minimum=explicit.min||0;if(ceiling!=null&&ceiling<=50)return'short';if(ceiling!=null&&ceiling<100)return c>=4?'medium':'short';if(ceiling!=null&&ceiling<=200)return'medium';if(ceiling!=null&&ceiling<250)return c>=4?'fast':'medium';if(ceiling!=null&&ceiling<=800)return'fast';if(minimum>=900||(ceiling!=null&&ceiling>=900))return'smart'}
  const t=clean(text,8000).toLowerCase();if(/\b(deep dive|comprehensive|exhaustive|long form|long-form|very detailed)\b/.test(t))return'smart';if(c>=7)return'fast';if(c>=4)return'medium';if(String(text||'').length<=180)return'short';return'medium';
}
async function semanticRank(text,prototypes,cacheKey,timeoutMs=650){
  try{const context=await semanticRouter();if(context?.status?.().available&&!context.status().ready)await Promise.race([context.warm?.(),sleep(900)]);const api=await adapter(),status=await api.status();if(!status.available)return null;if(!status.ready)await Promise.race([api.prewarm({explicit:true,installIfMissing:false,timeoutMs:45000}),sleep(900)]);const ranked=await Promise.race([api.rank(clean(text,8000),prototypes,{limit:6,cacheKey,timeoutMs:1800}),sleep(timeoutMs).then(()=>null)]);return ranked?.matches?.length?ranked.matches:null}catch{return null}
}
function semanticEvidence(rows,scoreFloor,marginFloor){
  if(!rows?.[0])return{available:false,confident:false,id:'',score:0,margin:0};
  const top=rows[0],second=rows[1],score=Number(top.score||0),margin=score-Number(second?.score||0);
  return{available:true,confident:score>=scoreFloor&&margin>=marginFloor,id:clean(top.id,80),score,margin};
}
function requestSystem(request={}){const id=clean(request?.context?.guide?.system||request?.task?.systemId||request?.context?.currentContext?.systemId||'',80).toLowerCase();return['civweave','living-school','cerbanimo','fellowfare','anarchadia'].includes(id)?id:'civweave'}
function artifactForSystem(system){return system==='living-school'?'curriculum':system==='cerbanimo'?'quest':system==='fellowfare'?'resource':system==='anarchadia'?'governance':'weave'}
function declaredArtifact(request={}){
  const kind=clean(request?.task?.kind||request?.artifactKind||'',100).toLowerCase();
  const map={'curriculum-draft':'curriculum','learning-path':'curriculum','quest-draft':'quest','resource-draft':'resource','resource-manifest':'resource','governance-draft':'governance','campus-weave':'weave'};
  if(map[kind])return{id:map[kind],source:'declared-task',confidence:1};
  if(request?.capabilityRequirements?.planning===true||request?.task?.requirements?.planning===true)return{id:artifactForSystem(requestSystem(request)),source:'declared-planning',confidence:.98};
  return null;
}
function structureArtifact(text,system){
  const t=clean(text,8000).toLowerCase();
  if(system==='living-school'&&/\b(curriculum|course|syllabus|learning path|learning pathway|learning program|learning plan|study plan|lesson plan|skill tree|teaching plan)\b/.test(t))return'curriculum';
  if(system==='cerbanimo'&&/\b(quest|project plan|work plan|implementation plan|roadmap|milestones?|checkpoints?|deliverable)\b/.test(t))return'quest';
  if(system==='fellowfare'&&/\b(resource manifest|skill manifest|resource plan|procurement|sourcing plan|request|offer|inventory plan|materials? list)\b/.test(t))return'resource';
  if(system==='anarchadia'&&/\b(proposal|policy|rule change|charter|governance plan|motion|vote plan|agreement)\b/.test(t))return'governance';
  if(system==='civweave'&&/\b(weave|cross[- ]realm|multi[- ]realm|roadmap|intention plan|quest plan)\b/.test(t))return'weave';
  return'';
}
function ruleArtifact(text,request={}){
  const t=clean(text,8000).toLowerCase(),system=requestSystem(request),build=/\b(build|create|make|generate|draft|design|develop|structure|prepare|start|regenerate|rebuild|revise|update|plan|need|want|please|let['’]?s|help(?: me| us)?(?: make| create| build| design)?)\b/.test(t);
  if(!build)return null;const id=structureArtifact(t,system);return id?{id,source:'realm-rules',confidence:id==='curriculum'?.97:.94}:null;
}
function continuationCue(text){const t=clean(text,1000).toLowerCase();return /^(?:[.…·•-]{1,8}|continue|continue please|keep going|go on|carry on|resume|resume please|finish|finish it|finish this|keep building|keep writing|pick up where (?:you|we) left off|continue where (?:you|we) left off|and continue)[.!?]*$/.test(t)}
function historyRows(request={}){
  const rows=[];for(const row of request?.context?.recentConversation||[])rows.push({role:row?.role,text:clean(row?.text||row?.content,5000)});for(const row of request?.messages||[])rows.push({role:row?.role,text:clean(row?.content||row?.text,5000)});return rows.filter(row=>row.text).slice(-24);
}
function previousUserPrompt(text,request={}){
  const rows=historyRows(request),current=clean(text,1000);let skippedCurrent=false;
  for(let i=rows.length-1;i>=0;i--){const row=rows[i];if(row.role!=='user')continue;if(!skippedCurrent&&clean(row.text,1000)===current){skippedCurrent=true;continue}return clean(row.text,5000)}
  return'';
}
function semanticArtifactPrompt(text,request={}){
  const system=requestSystem(request),current=clean(text,8000),prior=continuationCue(current)?previousUserPrompt(current,request):'';
  return prior?`realm ${system}. current user request ${current}. Continue the previous user request: ${prior}`:`realm ${system}. user request ${current}`;
}
function continuationArtifact(text,request={}){
  if(!continuationCue(text))return null;const system=requestSystem(request),rows=historyRows(request);let skippedCurrent=false;
  for(let i=rows.length-1;i>=0;i--){const row=rows[i];if(row.role==='user'&&!skippedCurrent&&clean(row.text,1000)===clean(text,1000)){skippedCurrent=true;continue}if(row.role!=='user')continue;const id=structureArtifact(row.text,system);if(id)return{id,source:'thread-continuation',confidence:.99}}
  return null;
}
async function artifactIntent(text,request={}){
  const declared=declaredArtifact(request);if(declared)return declared;
  const rows=await semanticRank(semanticArtifactPrompt(text,request),ARTIFACT_PROTOTYPES,'civweave-artifact-intent-v349-minilm-primary',700),evidence=semanticEvidence(rows,.29,.025);
  if(evidence.confident){
    if(evidence.id!=='dialogue')return{id:evidence.id,source:'minilm-artifact',confidence:Math.max(.62,Math.min(.96,.64+evidence.margin*2.6)),semantic:{score:evidence.score,margin:evidence.margin}};
    return{id:'dialogue',source:'minilm-artifact',confidence:Math.max(.62,Math.min(.92,.64+evidence.margin*2)),semantic:{top:evidence.id,score:evidence.score,margin:evidence.margin}};
  }
  const continuation=continuationArtifact(text,request);if(continuation)return{...continuation,source:'deterministic-thread-fallback',semanticFallback:evidence.available?'ambiguous':'unavailable'};
  const ruled=ruleArtifact(text,request);if(ruled)return{...ruled,source:'deterministic-realm-fallback',semanticFallback:evidence.available?'ambiguous':'unavailable'};
  return{id:'dialogue',source:evidence.available?'minilm-ambiguous-fallback':'deterministic-dialogue-fallback',confidence:.5,semantic:evidence.available?{top:evidence.id,score:evidence.score,margin:evidence.margin}:null};
}
function tierFor(id){return TIERS[id]||TIERS.medium}
async function classify(text,request={}){
  const declaredTask=declaredTaskClass(request),c=complexity(text);if(declaredTask)return Object.freeze({schema:'civweave.response-route.v1',version:VERSION,lengthClass:'smart',taskClass:declaredTask,artifactClass:null,networkRequired:false,complexity:c,confidence:1,source:'declared-task-class',tier:tierFor('smart'),reviewRequired:true,reviewTier:'high'});
  const fallback=fallbackLength(text),explicit=explicitWordRequest(text),[lengthRows,taskRows,artifact]=await Promise.all([explicit?Promise.resolve(null):semanticRank(text,LENGTH_PROTOTYPES,'civweave-response-length-v347'),semanticRank(text,TASK_PROTOTYPES,'civweave-response-task-v348-minilm-primary'),artifactIntent(text,request)]),taskEvidence=semanticEvidence(taskRows,.28,.025);
  if(taskEvidence.confident&&['programming','agentic'].includes(taskEvidence.id))return Object.freeze({schema:'civweave.response-route.v1',version:VERSION,lengthClass:'smart',taskClass:taskEvidence.id,artifactClass:null,networkRequired:false,complexity:c,confidence:.82,source:'minilm-task-gate',semantic:{score:taskEvidence.score,margin:taskEvidence.margin},tier:tierFor('smart'),reviewRequired:true,reviewTier:'high'});
  if(!taskEvidence.confident){const taskFallback=hardTaskClass(text,request);if(taskFallback!=='ordinary')return Object.freeze({schema:'civweave.response-route.v1',version:VERSION,lengthClass:'smart',taskClass:taskFallback,artifactClass:null,networkRequired:false,complexity:c,confidence:.74,source:'deterministic-task-fallback',semanticFallback:taskEvidence.available?'ambiguous':'unavailable',tier:tierFor('smart'),reviewRequired:true,reviewTier:'high'})}
  if(artifact?.id&&artifact.id!=='dialogue'){const lengthClass=c>=7?'smart':'fast';return Object.freeze({schema:'civweave.response-route.v1',version:VERSION,lengthClass,taskClass:'structured-artifact',artifactClass:artifact.id,networkRequired:true,complexity:c,confidence:artifact.confidence,source:artifact.source,semantic:artifact.semantic||null,semanticFallback:artifact.semanticFallback||null,tier:tierFor(lengthClass),reviewRequired:false,reviewTier:null})}
  let lengthClass=fallback,confidence=explicit?1:.56,source=explicit?'explicit-user-length':'deterministic-length-fallback';if(lengthRows?.[0]){const lengthEvidence=semanticEvidence(lengthRows,.24,.018);if(lengthEvidence.confident){lengthClass=lengthEvidence.id;confidence=Math.max(.58,Math.min(.96,.62+lengthEvidence.margin*2.8));source='minilm'}}
  return Object.freeze({schema:'civweave.response-route.v1',version:VERSION,lengthClass,taskClass:'ordinary',artifactClass:null,networkRequired:false,complexity:c,confidence,source,tier:tierFor(lengthClass),reviewRequired:false,reviewTier:null});
}
function userText(request={}){const messages=Array.isArray(request.messages)?request.messages:[];for(let i=messages.length-1;i>=0;i--){if(messages[i]?.role==='user')return clean(messages[i].content,12000)}return clean(request.prompt||request.input||'',12000)}
function provider(request={}){return clean(request?.config?.provider||request?.config?.route||request.provider||'',80).toLowerCase()}
function modelId(request={}){return clean(request?.config?.model||request?.config?.modelId||request.model||'',240)}
function isGuideRequest(request={}){return /^civweave-guide-response(?:-v141)?/.test(clean(request.purpose,200))}
function tinyGuidePrompt(request={}){const system=requestSystem(request),role=TINY_GUIDE[system]||TINY_GUIDE.civweave;return `${role} ${LANGUAGE_PACK.tiny} Speak directly and briefly. Continue the current thread when the Hero gives a continuation cue. Do not invent saved state, prices, votes, tool use, or execution. Consequential actions require explicit Hero approval. Return valid JSON with keys answer, choice, assumptions, requiresConsent, confidence, questDraft.`}
function applyGuideLanguage(request={}){
  if(!isGuideRequest(request)||request.__civweaveGuideLanguageApplied)return request;const messages=Array.isArray(request.messages)?request.messages.map(row=>({...row})):[],tiny=provider(request)==='downloaded-local'&&TINY_LOCAL_SET.has(modelId(request));
  if(tiny){const recent=messages.filter(row=>row?.role!=='system').slice(-3);return{...request,messages:[{role:'system',content:tinyGuidePrompt(request)},...recent],__civweaveGuideLanguageApplied:'tiny',guidePromptProfile:'tiny-condensed'}}
  const marker='Civweave language pack:';let index=messages.findIndex(row=>row?.role==='system');if(index<0){messages.unshift({role:'system',content:LANGUAGE_PACK.full});index=0}else if(!String(messages[index].content||'').includes(marker))messages[index]={...messages[index],content:`${LANGUAGE_PACK.full}\n\n${messages[index].content||''}`};return{...request,messages,__civweaveGuideLanguageApplied:'full',guidePromptProfile:'full'};
}
function providerNeedsNetwork(providerId){return providerId&&!['downloaded-local','bundled','deterministic','browser','manual'].includes(providerId)}
function forceNetworkForArtifact(request,route){
  if(!route?.networkRequired)return request;
  const currentProvider=provider(request),useSelectedProvider=providerNeedsNetwork(currentProvider),config=useSelectedProvider?{...(request.config||{}),preferredLocalModelIds:[]}:{...(request.config||{}),provider:'server-auto',route:'server-auto',model:'civweave-server-auto',preferredLocalModelIds:[]};
  return{...request,config,__civweaveNetworkRequired:true,networkRoute:{schema:'civweave.guide-network-route.v1',reason:'structured-artifact',artifactClass:route.artifactClass,qualifier:route.source,provider:useSelectedProvider?currentProvider:'server-auto'}};
}
async function installedIds(){if(Date.now()-installedCache.at<30000)return installedCache.ids;const manager=globalThis.CivweaveLocalModelDownloadV266;if(!manager?.catalogueStatus)return installedCache.ids;try{const rows=await manager.catalogueStatus(),ids=new Set(rows.filter(row=>row?.status?.available).map(row=>row.spec?.id).filter(Boolean));installedCache={at:Date.now(),ids};return ids}catch{return installedCache.ids}}
async function chooseInstalled(preferred=[]){const ids=await installedIds();return preferred.find(id=>ids.has(id))||null}
async function waitActive(id,timeoutMs=12000){const start=Date.now();while(Date.now()-start<timeoutMs){if(globalThis.CivweaveLocalModelRuntimeV266?.activeSpec?.()?.id===id)return true;await sleep(80)}return false}
async function withLocalTier(route,request,run){if(provider(request)!=='downloaded-local')return run(request);const manager=globalThis.CivweaveLocalModelDownloadV266;if(!manager?.selection||!manager?.select)return run(request);const chosen=await chooseInstalled(route.tier.preferredModelIds);if(!chosen)return run(request);const previous=manager.selection();if(previous?.id===chosen)return run(request);const task=async()=>{manager.select(chosen);await waitActive(chosen).catch(()=>false);try{return await run(request)}finally{if(previous?.active&&previous.id)manager.select(previous.id);else manager.select(null)}};const queued=localSwitchQueue.then(task,task);localSwitchQueue=queued.catch(()=>{});return queued}
function reviewConfig(runtime){try{const agentic=runtime?.readSharedConfig?.('agentic')||null,interactive=runtime?.readSharedConfig?.('interactive')||null,candidate=agentic||interactive;if(!candidate)return null;const p=clean(candidate.provider||candidate.route,80).toLowerCase();if(!p||['downloaded-local','bundled','deterministic','browser','manual'].includes(p))return null;return candidate}catch{return null}}
function reviewMessages(request,primary){const original=Array.isArray(request.messages)?request.messages.slice(-20):[],primaryText=clean(primary?.outputText||primary?.outputJson&&JSON.stringify(primary.outputJson)||'',48000);return[{role:'system',content:'You are the high-tier reviewer for Civweave. Review the lower-tier model result against the original request. Correct factual, reasoning, coding, safety, completeness, or instruction-following errors. Return the improved final answer only. Do not discuss the review process unless the Hero asked for it.'},...original,{role:'assistant',content:primaryText},{role:'user',content:'Review the candidate answer above and return the corrected final answer.'}]}
async function reviewedResult(previous,request,primary,route,runtime){
  if(primary?.status!=='success')return primary;
  if(!route?.reviewRequired||request.__civweaveSkipResponseRouter||internalLivingSchoolRequest(request))return primary;
  const config=reviewConfig(runtime);
  if(!config){dispatchEvent(new CustomEvent('civweave:high-tier-review-needed',{detail:{version:VERSION,route,reason:'No eligible high-tier agentic provider is configured.'}}));return{...primary,responseRouting:route,review:{required:true,completed:false,reason:'high-tier-provider-unavailable'}}}
  try{
    const reviewRequest={...request,__civweaveSkipResponseRouter:true,purpose:'civweave-high-tier-review',executionProfile:'agentic',config:{...config,maxTokens:Math.max(Number(config.maxTokens||0),route.tier.maxTokens)},messages:reviewMessages(request,primary)};
    const reviewed=await previous(reviewRequest);
    if(!['success','fallback'].includes(reviewed?.status))throw new Error(reviewed?.error?.message||'High-tier reviewer did not complete.');
    return{...reviewed,responseRouting:route,review:{required:true,completed:true,primary:{provider:primary?.actual?.provider||primary?.requested?.provider||'',model:primary?.actual?.model||primary?.requested?.model||'',outputText:primary?.outputText||''},reviewer:{provider:reviewed?.actual?.provider||config.provider||config.route||'',model:reviewed?.actual?.model||config.model||''}}};
  }catch(error){dispatchEvent(new CustomEvent('civweave:high-tier-review-failed',{detail:{version:VERSION,message:String(error?.message||error),route}}));return{...primary,responseRouting:route,review:{required:true,completed:false,reason:String(error?.message||error)}}}
}
async function enhance(request={}){
  if(request.__civweaveSkipResponseRouter||internalLivingSchoolRequest(request))return{request:{...request,__civweaveSkipResponseRouter:true},route:null};if(request.__civweaveResponseRoute)return{request,route:request.__civweaveResponseRoute};const text=userText(request),route=await classify(text,request),baseConfig={...(request.config||{})};if(!Number(baseConfig.maxTokens)||Number(baseConfig.maxTokens)>route.tier.maxTokens)baseConfig.maxTokens=route.tier.maxTokens;baseConfig.responseLengthClass=route.lengthClass;baseConfig.responseTargetWords=route.tier.targetWords;baseConfig.preferredLocalModelIds=[...route.tier.preferredModelIds];let next={...request,config:baseConfig,responseRouting:route,__civweaveResponseRoute:route};next=forceNetworkForArtifact(next,route);next=applyGuideLanguage(next);dispatchEvent(new CustomEvent('civweave:response-route',{detail:{...route,provider:provider(next),promptProfile:next.guidePromptProfile||null}}));if(route.networkRequired)dispatchEvent(new CustomEvent('civweave:structured-artifact-network-route',{detail:{version:VERSION,artifactClass:route.artifactClass,system:requestSystem(request),source:route.source,provider:provider(next)}}));return{request:next,route};
}
async function directNetworkHandle(request={}){
  if(!request.__civweaveNetworkRequired||provider(request)!=='server-auto')return null;const server=await serverRouter();if(!server?.handle){const error=new Error('Structured artifact generation requires a server-side model, but the server AI router is unavailable. Local generation was intentionally skipped.');error.code='STRUCTURED_ARTIFACT_NETWORK_UNAVAILABLE';throw error}
  const next={...request,config:{...(request.config||{}),provider:'server-auto',route:'server-auto',model:'civweave-server-auto',preferredLocalModelIds:[]}};const handled=await server.handle(next);if(handled?.handled)return handled;const error=new Error('Structured artifact generation could not obtain a server-side model. Local generation was intentionally skipped.');error.code='STRUCTURED_ARTIFACT_NETWORK_EXHAUSTED';throw error;
}
function registerSpineInterceptor(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;if(registeredSpine===spine)return true;
  spine.register('minilm-response-router-v347',{before:async request=>{const out=await enhance(request||{});return{request:out.request,state:{route:out.route}}},handle:directNetworkHandle,after:(result,request,ctx)=>{const route=request?.__civweaveResponseRoute||ctx?.states?.['minilm-response-router-v347']?.route;if(!route||!result||typeof result!=='object')return result;return{...result,responseRouting:result.responseRouting||route}}},120);registeredSpine=spine;dispatchEvent(new CustomEvent('civweave:response-router-spine-registered',{detail:{version:VERSION,priority:120,networkGate:true,threadContinuation:true,minilmPrimary:true,livingSchoolInternalBypass:true}}));return true;
}
function installRuntimeInterceptor(){
  registerSpineInterceptor();const runtime=globalThis.CivweaveModelRuntime;if(!runtime?.generate)return false;if(runtime.generate.__minilmResponseRouterV347===VERSION){wrappedRuntime=runtime;return true}const previous=runtime.generate.bind(runtime),generate=async request=>{if(request?.__civweaveSkipResponseRouter||internalLivingSchoolRequest(request)){const next=request?.__civweaveSkipResponseRouter?request:{...request,__civweaveSkipResponseRouter:true};return previous(next)}const {request:next,route}=await enhance(request||{});const primary=await withLocalTier(route,next,previous);return reviewedResult(previous,next,primary,route,runtime)};Object.defineProperty(generate,'__minilmResponseRouterV347',{value:VERSION});globalThis.CivweaveModelRuntime={...runtime,generate,__minilmResponseRouterV347:true};wrappedRuntime=globalThis.CivweaveModelRuntime;dispatchEvent(new CustomEvent('civweave:response-router-installed',{detail:{version:VERSION,guideLanguage:true,artifactNetworkRouting:true,tinyPrompt:true,threadContinuation:true,minilmPrimary:true,deterministicFallbackOnly:true,spineGate:Boolean(registeredSpine),livingSchoolInternalBypass:true}}));return true;
}
const api=Object.freeze({version:VERSION,tiers:TIERS,models:MODEL_IDS,tinyModels:TINY_LOCAL_MODELS,languagePack:LANGUAGE_PACK,classify,artifactIntent,declaredArtifact,ruleArtifact,continuationArtifact,continuationCue,semanticArtifactPrompt,semanticEvidence,fallbackLength,hardTaskClass,declaredTaskClass,explicitWordRequest,complexity,requestSystem,applyGuideLanguage,providerNeedsNetwork,forceNetworkForArtifact,directNetworkHandle,registerSpineInterceptor,installRuntimeInterceptor,internalLivingSchoolRequest,invisibleInfrastructure:true,settingsAutostart:false,minilmPrimary:true,deterministicFallbackOnly:true});
globalThis.CivweaveResponseRouterV347=api;
installRuntimeInterceptor();let attempts=0;installTimer=setInterval(()=>{attempts+=1;installRuntimeInterceptor();if(attempts>160)clearInterval(installTimer)},250);
for(const name of ['civweave:model-runtime-ready','civweave:runtime-spine-ready','civweave:local-model-runtime-ready','civweave:local-model-bridge-installed'])addEventListener(name,()=>queueMicrotask(installRuntimeInterceptor));addEventListener('civweave:local-model-downloaded',()=>{installedCache.at=0});addEventListener('civweave:local-model-removed',()=>{installedCache.at=0});addEventListener('pagehide',()=>clearInterval(installTimer),{once:true});
dispatchEvent(new CustomEvent('civweave:minilm-response-router-ready',{detail:{version:VERSION,tiers:Object.keys(TIERS),reviewGate:'successful-programming-or-agentic-only',guideLanguage:true,artifactNetworkRouting:true,tinyPrompt:true,threadContinuation:true,minilmPrimary:true,deterministicFallbackOnly:true,networkGate:'runtime-spine',livingSchoolInternalBypass:true}}));
})();