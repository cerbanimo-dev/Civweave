(()=>{
'use strict';
const VERSION='1.0.0-minilm-message-classifier-v348';
const MODEL='Xenova/all-MiniLM-L6-v2';
const ADAPTER='/app/models/all-minilm-l6-v2/adapter.js';
const PENDING_PREFIX='civweave.minilm-clarification.v348.';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const MODE={civweave:'Reflect','living-school':'Learn',cerbanimo:'Build',fellowfare:'Acquire',anarchadia:'Govern'};
const LABEL={civweave:'Civweave','living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',anarchadia:'Anarchadia'};
const ROUTES=Object.freeze([
  {id:'living-school',text:'The user primarily wants to understand, learn, study, practice, research, be taught, get an explanation, make an idea easier to understand, build intuition, test knowledge, or develop a skill. Examples: make quantum physics easier for me to understand; explain this code; teach me woodworking; help me practice Japanese.'},
  {id:'cerbanimo',text:'The user primarily wants an artifact, service, repair, implementation, production result, project deliverable, piece of software, design, physical object, quest, or skilled work to exist. Examples: make a table; build the feature; repair the page; implement the API; create a poster.'},
  {id:'fellowfare',text:'The user primarily wants to acquire, find, borrow, buy, sell, trade, exchange, offer, source, deliver, match, or coordinate goods, services, materials, tools, space, transport, or other resources.'},
  {id:'anarchadia',text:'The user primarily wants a collective decision, rule, agreement, policy, proposal, vote, consent process, tribunal, civic process, automation rule, jurisdiction choice, appeal, or governance change.'},
  {id:'civweave',text:'The user has a wish or project spanning several realms, wants to coordinate learning plus work plus resources plus governance, is deciding what kind of path is needed, or needs whole-system orchestration rather than one specialist realm.'}
]);
const SPEECH=Object.freeze([
  {id:'greeting',text:'A greeting or social opening: hello, hi, hey, good morning, good evening, greetings.'},
  {id:'acknowledgement',text:'A brief acknowledgement or confirmation with no new request: thanks, thank you, okay, ok, got it, understood, sounds good.'},
  {id:'test',text:'A test or connectivity check: test, testing, ping, mic check, check if this works.'},
  {id:'identity',text:'A question about who or what the assistant is, whether it is alive, real, sentient, human, or a person.'},
  {id:'capabilities',text:'A question asking what the assistant, guide, model, or platform can do or help with.'},
  {id:'explain',text:'The user wants explanation, discussion, understanding, comparison, advice, diagnosis, review, or information. They are not asking the platform to carry out the described action.'},
  {id:'plan',text:'The user wants a draft, plan, design, outline, roadmap, proposed structure, or reviewable version, but not irreversible execution yet.'},
  {id:'execute',text:'The user is directing the platform to carry out, change, publish, send, delete, buy, deploy, submit, vote, transfer, activate, install, or otherwise execute an action.'},
  {id:'correction',text:'The user is correcting, revising, negating, replacing, or narrowing something said earlier: I mean, no, instead, not that, rather, correction, change that.'},
  {id:'followup',text:'A context-dependent follow-up or short answer whose meaning depends on the previous exchange: yes, no, that one, the second, the local one, the territory one, do that, why, how so.'},
  {id:'ordinary',text:'An ordinary conversational request that does not strongly fit the other speech-act categories.'}
]);
const POSTURE=Object.freeze([
  {id:'ask-first',text:'The user wants to choose and prefers questions before assumptions: ask me, do not assume, check with me, let me decide, confirm first.'},
  {id:'best-judgment',text:'The user delegates ordinary choices: use your judgment, pick what makes sense, choose the best option, decide for me, whatever works best.'},
  {id:'defaults-ok',text:'The user accepts standard defaults and does not want unnecessary questions: defaults are fine, standard settings, normal option, just use the default.'},
  {id:'exact',text:'The user gave precise instructions and wants them followed narrowly: exactly this, only this, do not change anything else, use these exact settings.'},
  {id:'neutral',text:'No special preference about assumptions, defaults, or decision delegation is expressed.'}
]);
const NON_ROUTING=new Set(['greeting','acknowledgement','test','identity','capabilities']);
let adapterPromise=null,readyPromise=null,reflexOriginal=null,stabilizationTimer=0,lastDecision=null;
const clean=(value,max=10000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const system=value=>SYSTEMS.includes(String(value||''))?String(value):'civweave';
const mode=value=>MODE[system(value)];
function adapter(){if(!adapterPromise)adapterPromise=import(ADAPTER).catch(error=>{adapterPromise=null;throw error});return adapterPromise}
async function ensureReady(){
  if(readyPromise)return readyPromise;
  readyPromise=(async()=>{const api=await adapter(),status=await api.status();if(!status.available){const error=new Error('MiniLM semantic package is not available on this device.');error.code='MINILM_NOT_AVAILABLE';throw error}if(!status.ready)await api.prewarm({explicit:true,installIfMissing:false,timeoutMs:45000});return api})().catch(error=>{readyPromise=null;throw error});
  return readyPromise;
}
function recentText(history=[]){return(Array.isArray(history)?history:[]).slice(-5).map(row=>`${row?.role||'unknown'}: ${clean(row?.text||row?.content,420)}`).join(' | ')}
function queryFor(text,currentSystem,history=[]){return clean(`Current realm context: ${LABEL[system(currentSystem)]}. Recent conversation: ${recentText(history)||'none'}. New message: ${clean(text,5000)}. Classify the meaning of the new message in context, not isolated keywords.`,7000)}
async function rank(api,query,candidates,key,limit){const result=await api.rank(query,candidates,{limit:limit||candidates.length,cacheKey:key,timeoutMs:5000});return Array.isArray(result?.matches)?result.matches.map(row=>({id:String(row.id),score:Number(row.score||0)})):[]}
function topDecision(rows,ids){const allowed=new Set(ids),ranked=(rows||[]).filter(row=>allowed.has(row.id)).sort((a,b)=>b.score-a.score),top=ranked[0]||{id:ids[0],score:0},second=ranked[1]||{id:'',score:0};return{...top,second:second.id,secondScore:second.score,margin:Number(top.score||0)-Number(second.score||0),rows:ranked}}
function speechKind(speech){return NON_ROUTING.has(speech.id)?speech.id:''}
function postureMargin(posture){return posture.id==='ask-first'?.05:posture.id==='best-judgment'||posture.id==='defaults-ok'?.012:posture.id==='exact'?.032:.025}
function fallbackDecision(text,currentSystem,error){return{schema:'civweave.message-classification.v1',version:VERSION,model:MODEL,text:clean(text,5000),source:'fallback-after-minilm-attempt',attemptedMiniLM:true,error:clean(error?.message||error,500),route:{system:system(currentSystem),mode:mode(currentSystem),confidence:.2,score:0,margin:0,source:'current-context-fallback'},speechAct:'ordinary',messageKind:'',actionMode:'ordinary',continuity:'ordinary',decisionPosture:'neutral',clarification:{required:false},semanticAvailable:false,classifiedAt:Date.now()}}
function pendingKey(currentSystem){return`${PENDING_PREFIX}${system(currentSystem)}`}
function readPending(currentSystem){try{const value=JSON.parse(sessionStorage.getItem(pendingKey(currentSystem))||'null');if(!value||Date.now()-Number(value.createdAt||0)>20*60_000){sessionStorage.removeItem(pendingKey(currentSystem));return null}return value}catch{return null}}
function writePending(currentSystem,value){try{sessionStorage.setItem(pendingKey(currentSystem),JSON.stringify(value))}catch{}}
function clearPending(currentSystem){try{sessionStorage.removeItem(pendingKey(currentSystem))}catch{}}
function realmCandidate(id){return{id,label:LABEL[id],text:`I mean ${LABEL[id]}. ${ROUTES.find(row=>row.id===id)?.text||''}`}}
async function resolvePending(api,text,currentSystem,pending){
  const candidates=[...(pending.candidates||[]),{id:'none',label:'Neither / something else',text:'Neither option, something else, cancel this clarification, none of those choices.'}],query=clean(`A clarification question was asked about ${pending.dimension}. Original message: ${pending.originalText}. The user replied: ${text}. Resolve the reply only against the listed clarification choices.`,6000),rows=await rank(api,query,candidates.map(row=>({id:row.id,text:row.text||row.label})),'civweave-clarification-resume-v348',candidates.length),resolved=topDecision(rows,candidates.map(row=>row.id));
  if(resolved.id==='none'&&resolved.score>=.24&&resolved.margin>=.018){clearPending(currentSystem);return{status:'cancelled',score:resolved.score,margin:resolved.margin}}
  if(resolved.score>=.24&&resolved.margin>=.018){const selected=candidates.find(row=>row.id===resolved.id);clearPending(currentSystem);return{status:'resolved',selected,originalText:pending.originalText,score:resolved.score,margin:resolved.margin}}
  return{status:'unresolved',score:resolved.score,margin:resolved.margin,candidates:pending.candidates||[]};
}
async function classify(text,{currentSystem='civweave',history=[]}={}){
  const current=system(currentSystem),pending=readPending(current);
  try{
    const api=await ensureReady(),query=queryFor(text,current,history),[routeRows,speechRows,postureRows,pendingResolution]=await Promise.all([
      rank(api,query,ROUTES,'civweave-message-route-v348',ROUTES.length),
      rank(api,query,SPEECH,'civweave-message-speech-v348',SPEECH.length),
      rank(api,query,POSTURE,'civweave-message-posture-v348',POSTURE.length),
      pending?resolvePending(api,text,current,pending):Promise.resolve(null)
    ]),route=topDecision(routeRows,SYSTEMS),speech=topDecision(speechRows,SPEECH.map(row=>row.id)),posture=topDecision(postureRows,POSTURE.map(row=>row.id)),speechId=speech.score>=.24&&speech.margin>=.015?speech.id:'ordinary',postureId=posture.score>=.22&&posture.margin>=.012?posture.id:'neutral',kind=speechKind({id:speechId}),routeSystem=kind?current:system(route.id),routeMarginNeeded=postureMargin({id:postureId}),routeWeak=!kind&&(route.score<.24||route.margin<routeMarginNeeded),clarification=routeWeak?{required:true,dimension:'realm-route',reason:'semantic-route-ambiguous',candidates:[realmCandidate(route.id),realmCandidate(route.second||current)].filter((row,index,array)=>row.id&&array.findIndex(item=>item.id===row.id)===index),score:route.score,margin:route.margin}:{required:false};
    const decision={schema:'civweave.message-classification.v1',version:VERSION,model:MODEL,text:clean(text,5000),source:'minilm',attemptedMiniLM:true,semanticAvailable:true,route:{system:routeSystem,mode:mode(routeSystem),confidence:Math.max(.35,Math.min(.97,.55+Math.max(0,route.margin)*3)),score:route.score,margin:route.margin,second:route.second,source:'minilm'},speechAct:speechId,speechConfidence:{score:speech.score,margin:speech.margin},messageKind:kind,actionMode:speechId==='execute'?'execute':speechId==='plan'?'draft':speechId==='explain'?'discuss':'ordinary',continuity:['correction','followup'].includes(speechId)?speechId:'ordinary',decisionPosture:postureId,decisionPostureConfidence:{score:posture.score,margin:posture.margin},clarification,pendingResolution,classifiedAt:Date.now()};
    lastDecision=decision;try{dispatchEvent(new CustomEvent('civweave:message-classified',{detail:{version:VERSION,route:decision.route,speechAct:decision.speechAct,decisionPosture:decision.decisionPosture,clarification:decision.clarification,pendingResolution:decision.pendingResolution}}))}catch{}return decision;
  }catch(error){const decision=fallbackDecision(text,current,error);lastDecision=decision;try{dispatchEvent(new CustomEvent('civweave:message-classifier-fallback',{detail:{version:VERSION,error:decision.error}}))}catch{}return decision}
}
function routeHint(text,currentSystem='civweave'){const value=lastDecision;if(!value||clean(value.text,5000)!==clean(text,5000))return null;return{...value.route,evidence:[`semantic:${value.route.system}`,`speech:${value.speechAct}`],provider:value.source,classificationVersion:VERSION}}
async function rankCandidates(text,candidates,{currentSystem='civweave',history=[],dimension='referent'}={}){
  const api=await ensureReady(),rows=(Array.isArray(candidates)?candidates:[]).slice(0,64).map((row,index)=>({id:String(row?.id||`candidate-${index+1}`),text:clean(row?.text||row?.label||row?.description||row?.name,1500),raw:row})).filter(row=>row.text),query=clean(`Current realm: ${LABEL[system(currentSystem)]}. Recent conversation: ${recentText(history)||'none'}. Resolve ${dimension}. User message: ${text}.`,7000),ranked=await rank(api,query,rows,`civweave-message-candidates-v348-${dimension}`,rows.length),decision=topDecision(ranked,rows.map(row=>row.id)),selected=rows.find(row=>row.id===decision.id)||null;
  return{dimension,selected:selected?.raw||null,score:decision.score,margin:decision.margin,ambiguous:decision.score<.24||decision.margin<.018,ranked:decision.rows};
}
async function chooseClarificationDimension(text,dimensions,{currentSystem='civweave',history=[]}={}){
  const rows=(Array.isArray(dimensions)?dimensions:[]).slice(0,32).map((row,index)=>({id:String(row?.id||`dimension-${index+1}`),text:clean(row?.semanticText||row?.text||row?.description||row?.question||row?.label,1800),raw:row})).filter(row=>row.text);if(!rows.length)return null;
  const ranked=await rankCandidates(text,rows.map(row=>({id:row.id,text:row.text})),{currentSystem,history,dimension:'clarification-priority'}),selected=rows.find(row=>row.id===ranked.selected?.id)||rows.find(row=>row.id===ranked.ranked?.[0]?.id)||null;
  return selected?{dimension:selected.raw,score:ranked.score,margin:ranked.margin,ambiguous:ranked.ambiguous,ranked:ranked.ranked}:null;
}
function clarificationQuestion(decision){const candidates=decision?.clarification?.candidates||[];if(decision?.pendingResolution?.status==='unresolved'&&decision.pendingResolution.candidates?.length)return`Which did you mean: ${decision.pendingResolution.candidates.map(row=>row.label).join(' or ')}?`;if(decision?.clarification?.dimension==='realm-route'&&candidates.length>=2)return`I can read that in two plausible ways. Is the main thing you want ${candidates[0].label} to handle, or ${candidates[1].label}?`;return'Which meaning should I use before I continue?'}
function clarificationPacket(decision,currentSystem){const current=system(currentSystem);return{response:{answer:clarificationQuestion(decision),choice:{mode:MODE[current],system:current,room:'',nextAction:''},assumptions:[],requiresConsent:false,confidence:Math.max(.25,Number(decision?.route?.confidence||.35)),clarification:{...decision.clarification,pendingResolution:decision.pendingResolution}},requestedProvider:'semantic-local',provider:'semantic-local',model:MODEL,context:{messageClassification:decision},fallbackFrom:null}}
function saveClarification(decision,currentSystem){if(!decision?.clarification?.required)return;const candidates=(decision.clarification.candidates||[]).filter(row=>row?.id&&row?.label);if(candidates.length<2)return;writePending(currentSystem,{schema:'civweave.pending-clarification.v1',version:VERSION,dimension:decision.clarification.dimension,originalText:decision.text,currentSystem:system(currentSystem),candidates,createdAt:Date.now()})}
async function prepareRequest(args={}){
  if(args.__civweaveMessageClassifiedV348)return{request:args,decision:args.__civweaveMessageClassificationV348||null};
  const current=system(args.systemId),decision=await classify(args.text,{currentSystem:current,history:args.history||[]});
  if(decision.pendingResolution?.status==='resolved'){const selected=decision.pendingResolution.selected,routeSystem=SYSTEMS.includes(selected?.id)?selected.id:decision.route.system,merged=`${decision.pendingResolution.originalText}\n\nClarification from the user: ${clean(args.text,1200)}. Selected meaning: ${selected?.label||selected?.id}.`;return{request:{...args,text:merged,systemId:routeSystem,__civweaveMessageClassifiedV348:true,__civweaveMessageClassificationV348:decision},decision,resumed:true}}
  if(decision.pendingResolution?.status==='unresolved')return{request:{...args,__civweaveMessageClassifiedV348:true,__civweaveMessageClassificationV348:decision},decision,shortCircuit:clarificationPacket(decision,current)};
  if(decision.pendingResolution?.status==='cancelled')return{request:{...args,__civweaveMessageClassifiedV348:true,__civweaveMessageClassificationV348:decision},decision};
  if(decision.clarification?.required){saveClarification(decision,current);return{request:{...args,__civweaveMessageClassifiedV348:true,__civweaveMessageClassificationV348:decision},decision,shortCircuit:clarificationPacket(decision,current)}}
  return{request:{...args,systemId:decision.route.system,__civweaveMessageClassifiedV348:true,__civweaveMessageClassificationV348:decision},decision};
}
function installReflexBridge(){const runtime=globalThis.CivweaveReflexRuntime;if(!runtime?.route)return false;if(runtime.route.__civweaveClassifierBridgeV348)return true;reflexOriginal=runtime.route.bind(runtime);const route=(text,current)=>routeHint(text,current)||reflexOriginal(text,current);route.__civweaveClassifierBridgeV348=true;runtime.route=route;runtime.__civweaveClassifierBridgeV348=true;return true}
function patchAssistant(){const api=globalThis.CivweaveAssistantV141;if(!api?.respond)return false;if(api.respond.__civweaveMessageClassifierV348){installReflexBridge();return true}const previous=api.respond.bind(api),wrapped=async args=>{const prepared=await prepareRequest(args||{});if(prepared.shortCircuit)return prepared.shortCircuit;return previous(prepared.request)};wrapped.__civweaveMessageClassifierV348=true;api.respond=wrapped;api.__civweaveMessageClassifierV348=VERSION;installReflexBridge();return true}
function stabilize(){if(stabilizationTimer)return;let ticks=0;stabilizationTimer=setInterval(()=>{patchAssistant();installReflexBridge();if(++ticks>=400){clearInterval(stabilizationTimer);stabilizationTimer=0}},25)}
function install(){const ready=patchAssistant();installReflexBridge();stabilize();return ready}
const FIXTURES=Object.freeze([
  {text:'make it easier for me to understand quantum physics',expectedSystem:'living-school',reason:'purpose beats the verb make'},
  {text:'make me a wooden table',expectedSystem:'cerbanimo',reason:'artifact creation'},
  {text:'explain how deployment works',expectedSpeechAct:'explain',reason:'discussion is not execution'},
  {text:'deploy it',expectedSpeechAct:'execute',reason:'execution intent'},
  {text:'the territory one',expectedSpeechAct:'followup',reason:'contextual clarification answer'},
  {text:'hi',expectedSpeechAct:'greeting',reason:'even greetings are classified first'}
]);
const api={version:VERSION,model:MODEL,classify,rankCandidates,chooseClarificationDimension,routeHint,prepareRequest,patchAssistant,install,installReflexBridge,status:async()=>{try{return await(await adapter()).status()}catch(error){return{available:false,ready:false,error:error.message}}},fixtures:FIXTURES,get lastDecision(){return lastDecision},semanticFirst:true,everyMessage:true,deterministicRulesAfterClassification:true,prewarmPolicy:'first-message-only'};
globalThis.CivweaveMessageClassifierV348=api;install();
addEventListener('civweave:assistant-runtime-ready',install);addEventListener('civweave:guide-loader-reset',()=>queueMicrotask(install));addEventListener('civweave:deterministic-mode-ready',()=>queueMicrotask(install));addEventListener('pageshow',()=>queueMicrotask(install));
try{dispatchEvent(new CustomEvent('civweave:message-classifier-ready',{detail:{version:VERSION,model:MODEL,semanticFirst:true,everyMessage:true,prewarmPolicy:'first-message-only'}}))}catch{}
})();
