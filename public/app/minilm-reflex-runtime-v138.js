(()=>{
'use strict';
const MODEL_ID='Xenova/all-MiniLM-L6-v2';
const ADAPTER_URL='/app/models/all-minilm-l6-v2/adapter.js';
const INDEX_URL='/app/models/all-minilm-l6-v2/reflex-index.json';
const SYSTEMS=['commonweave','living-school','cerbanimo','fellowfare','anarchadia'];
const MODES={commonweave:'Reflect','living-school':'Learn',cerbanimo:'Build',fellowfare:'Acquire',anarchadia:'Govern'};
const LABELS={commonweave:'Commonweave','living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',anarchadia:'Anarchadia'};
const GUIDES={commonweave:{name:'Weaveling',role:'central mirror and orchestrator'},'living-school':{name:'Moss',role:'learning guide'},cerbanimo:{name:'Kamiya',role:'questwright and skilled-work guide'},fellowfare:{name:'Rook',role:'quartermaster and exchange guide'},anarchadia:{name:'Merlin',role:'civic and automation guide'}};
const CONSEQUENCE=/\b(send|spend|transfer|publish|submit|approve|vote|delete|invite|assign|purchase|order|deploy|federate|commit funds)\b/i;
let adapterPromise=null,indexPromise=null,semanticReady=false;

const safe=(value,max=5000)=>String(value==null?'':value).trim().slice(0,max);
const isObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const parse=value=>{if(isObject(value)||Array.isArray(value))return value;try{return JSON.parse(String(value))}catch{return null}};
const now=()=>new Date().toISOString();
const uid=()=>`reflex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
async function adapter(){if(!adapterPromise)adapterPromise=import(ADAPTER_URL).catch(error=>{adapterPromise=null;throw error});return adapterPromise}
async function index(){if(!indexPromise)indexPromise=fetch(INDEX_URL,{cache:'reload'}).then(r=>{if(!r.ok)throw new Error(`Reflex index returned ${r.status}`);return r.json()}).then(v=>Array.isArray(v.entries)?v.entries:[]);return indexPromise}
function canonicalSystem(value){const raw=safe(value,100).toLowerCase().replace(/_/g,'-');return SYSTEMS.includes(raw)?raw:''}
function wordSet(text){return new Set(safe(text,10000).toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(Boolean))}
function lexicalScore(text,entry){
  const lower=safe(text,10000).toLowerCase(),words=wordSet(text);let score=0;
  for(const keyword of entry.keywords||[]){const key=String(keyword).toLowerCase();if(lower.includes(key))score+=key.includes(' ')?5:3;else if(words.has(key))score+=2}
  const phraseWords=String(entry.embeddingText||'').toLowerCase().split(/\W+/).filter(word=>word.length>3);
  for(const word of phraseWords)if(words.has(word))score+=.28;
  return score;
}
function routeByRules(text,current='commonweave'){
  const lower=safe(text,10000).toLowerCase();
  const hits={
    anarchadia:['proposal','policy','vote','voting','rule','consent','govern','governance','assembly','approval process','organize people','mutual aid network'].filter(x=>lower.includes(x)),
    fellowfare:['borrow','trade','exchange','buy','sell','materials','resources','supplies','inventory','delivery','food sources','food access'].filter(x=>lower.includes(x)),
    cerbanimo:['build','repair','make','implement','code','design','prototype','install','construct','fix','create a game','make a game'].filter(x=>lower.includes(x)),
    'living-school':['learn','study','understand','practice','research','teach','curriculum','lesson','skill'].filter(x=>lower.includes(x))
  };
  const active=Object.entries(hits).filter(([,items])=>items.length);
  const multi=active.length>=2||(/mutual aid|network|ecosystem|whole project/.test(lower)&&/food|community|friends|neighbors/.test(lower));
  if(multi)return {system:'commonweave',mode:'Reflect',confidence:.88,evidence:active.flatMap(([,items])=>items).slice(0,8),multiRealm:true};
  for(const system of ['anarchadia','fellowfare','cerbanimo','living-school'])if(hits[system].length)return {system,mode:MODES[system],confidence:.75+Math.min(.18,hits[system].length*.05),evidence:hits[system],multiRealm:false};
  const system=canonicalSystem(current)||'commonweave';return {system,mode:MODES[system],confidence:.35,evidence:[],multiRealm:false};
}
function extractContext(request){
  if(isObject(request?.context))return request.context;
  const messages=Array.isArray(request?.messages)?request.messages:[];
  for(const item of messages.slice().reverse()){
    const content=safe(item?.content??item?.text,60000),marker='Structured context:',start=content.indexOf(marker);
    if(start>=0){const candidate=content.slice(start+marker.length).replace(/Respond[\s\S]*$/,'').trim(),parsed=parse(candidate);if(isObject(parsed))return parsed}
    const parsed=parse(content);if(isObject(parsed)&&parsed.schema==='commonweave.structured-context.v1')return parsed;
  }
  return {};
}
function userText(request,context){if(context?.userMessage)return safe(context.userMessage,4000);const messages=Array.isArray(request?.messages)?request.messages:[];const user=messages.slice().reverse().find(item=>item?.role==='user');return safe(user?.content??user?.text,4000)}
function conversationKind(text){
  const lower=safe(text,500).toLowerCase().replace(/[!?.,]+$/,'').trim();
  if(/^(test|testing|ping|check|mic check|hello test|test test)$/.test(lower))return'test';
  if(/\b(are you (real|alive|sentient|a real boy)|who are you|what are you|are you a person)\b/.test(lower))return'identity';
  if(/^(hi|hello|hey|good morning|good afternoon|good evening)$/.test(lower))return'greeting';
  if(/^(thanks|thank you|thx|got it|okay|ok)$/.test(lower))return'acknowledgement';
  if(/^(help|what can you do|how can you help)$/.test(lower))return'capabilities';
  return'';
}
function selectLexical(text,entries,route){
  const ranked=entries.map(entry=>{const lexical=lexicalScore(text,entry);return{entry,lexical,score:lexical+(lexical>0&&entry.system===route.system?1.25:0)}}).sort((a,b)=>b.score-a.score);
  return ranked[0]?.lexical>=.5?ranked[0]:null;
}
async function semanticMatch(text,entries,route,waitMs=350){
  const engine=await adapter(),task=engine.match(text,{limit:6,timeoutMs:120000}).then(result=>{semanticReady=true;return result}).catch(()=>null),timeout=new Promise(resolve=>setTimeout(()=>resolve(null),waitMs)),result=await Promise.race([task,timeout]);
  if(!result)return null;
  const byId=new Map(entries.map(entry=>[entry.id,entry]));
  const candidates=(result.matches||[]).map(match=>({entry:byId.get(match.id),score:Number(match.score||0),device:result.device})).filter(item=>item.entry).sort((a,b)=>b.score-a.score);
  if(!candidates.length)return null;
  const top=candidates[0],preferred=candidates.find(item=>item.entry.system===route.system&&item.score>=top.score-.035),chosen=route.confidence>=.65&&preferred?preferred:top;
  return {...chosen,margin:chosen.score-Number(candidates.find(item=>item!==chosen)?.score||0)};
}
function cleanIntent(text){return safe(text,500).replace(/^\s*(i\s+(wish|want|need|hope)\s+(i\s+could\s+|to\s+)?|can you\s+|please\s+)/i,'').replace(/[.?!]+$/,'').trim()}
function guidePrompt(system){return system==='living-school'?'What do you want to be able to do, explain, or decide after learning?':system==='cerbanimo'?'What observable result should exist when the work is done?':system==='fellowfare'?'What exactly is needed or offered, in what quantity, and by when?':system==='anarchadia'?'What decision, agreement, affected group, or automation needs definition?':'What would be different in the world if this intention succeeded?'}
function conversationalReply(kind,system,context){
  const guide=GUIDES[system]||GUIDES.commonweave,room=safe(context?.routingAnswer?.room||context?.currentContext?.roomId,200);let answer='',nextAction='';
  if(kind==='test'){answer=`Test received. I’m ${guide.name}, Commonweave’s ${guide.role}. I have not turned that message into a ${system==='cerbanimo'?'quest':system==='living-school'?'lesson':system==='fellowfare'?'resource request':system==='anarchadia'?'proposal':'plan'}.`;nextAction=guidePrompt(system)}
  else if(kind==='identity'){answer=`I’m ${guide.name}, Commonweave’s ${guide.role}. I’m software, not a person or a real boy. I can use the current conversation, local semantic matching, and Commonweave’s canonical state without pretending to be alive.`;nextAction=system==='living-school'?'Ask something you genuinely want to understand.':guidePrompt(system)}
  else if(kind==='greeting'){answer=`Hello. I’m ${guide.name}, the ${guide.role} here.`;nextAction=system==='commonweave'?'Tell me your wish in your own words.':`Tell me what needs attention in ${LABELS[system]}.`}
  else if(kind==='acknowledgement'){answer='Understood. Nothing new has been routed or activated.';nextAction='Continue with the next detail when you are ready.'}
  else{answer=`I’m ${guide.name}. I can help with ${system==='living-school'?'questions, curricula, practice, and evidence of learning':system==='cerbanimo'?'quests, skilled work, checkpoints, proof, and completion':system==='fellowfare'?'needs, offers, materials, borrowing, exchange, and logistics':system==='anarchadia'?'agreements, proposals, consent, automation, and collective decisions':'wishes that span learning, work, resources, and governance'}.`;nextAction=guidePrompt(system)}
  return{answer,choice:{mode:MODES[system],system,room,nextAction},assumptions:[],requiresConsent:false,confidence:.99,reflex:{entryId:null,semantic:false,device:'conversation',kind}}
}
function matchedReply(entry,text,route,context,{semantic=false,device='lexical',score=0}={}){
  const system=route.system,intent=cleanIntent(text)||safe(text,500),guide=GUIDES[system]||GUIDES.commonweave,room=safe(context?.routingAnswer?.room||context?.currentContext?.roomId,200),label=safe(entry?.label,180)||safe(entry?.id,180).replace(/-/g,' '),clarify=safe(entry?.clarify,500)||guidePrompt(system);
  let answer=`I hear “${intent}.” MiniLM matched it to ${label}, which gives ${guide.name} a direction without treating the stored pattern as your finished answer.`;
  if(route.multiRealm)answer+=` This spans more than one realm, so Commonweave should coordinate the weave while each realm owns its part.`;
  if(entry?.routeHints?.length)answer+=`\n\nLikely paths:\n${entry.routeHints.map(item=>`• ${item}`).join('\n')}`;
  return{answer,choice:{mode:route.mode||MODES[system],system,room,nextAction:clarify},assumptions:route.multiRealm?['The intention appears to span multiple realms; no path is active until reviewed.']:[],requiresConsent:Boolean(context?.consent?.consequentialActionDetected||CONSEQUENCE.test(text)),confidence:Math.max(.45,Math.min(.96,semantic?score:Number(route.confidence||.5))),reflex:{entryId:entry?.id||null,semantic,device,score}};
}
function clarifyReply(text,route,context,{semantic=false,device='lexical',score=0}={}){
  const system=route.system,guide=GUIDES[system]||GUIDES.commonweave,room=safe(context?.routingAnswer?.room||context?.currentContext?.roomId,200),intent=cleanIntent(text)||safe(text,500);
  return{answer:`I heard “${intent},” but I do not yet have enough signal to turn it into a ${system==='cerbanimo'?'quest':system==='living-school'?'learning path':system==='fellowfare'?'resource match':system==='anarchadia'?'proposal or agreement':'multi-realm weave'} without guessing. ${guide.name} will keep it conversational until the goal is clearer.`,choice:{mode:route.mode||MODES[system],system,room,nextAction:guidePrompt(system)},assumptions:['No stored response pattern was used as finished dialogue.'],requiresConsent:false,confidence:Math.max(.25,Math.min(.65,score||route.confidence||.35)),reflex:{entryId:null,semantic,device,score}}
}
async function reflexResponse(request,{mode='primary',failure=null,semanticWaitMs=350}={}){
  const started=performance.now(),context=extractContext(request),text=userText(request,context),contextRoute=canonicalSystem(context?.routingAnswer?.system),route=contextRoute?{system:contextRoute,mode:context?.routingAnswer?.mode||MODES[contextRoute],confidence:Number(context?.routingAnswer?.confidence||.35),evidence:context?.routingAnswer?.evidence||[],multiRealm:Boolean(context?.routingAnswer?.multiRealm)}:routeByRules(text,context?.currentContext?.systemId),kind=conversationKind(text);
  let output,semantic=null,selected=null;
  if(kind)output=conversationalReply(kind,route.system,context);
  else{
    const entries=await index(),lexical=selectLexical(text,entries,route),substantive=wordSet(text).size>=3;
    if(substantive)try{semantic=await semanticMatch(text,entries,route,semanticWaitMs)}catch{}
    const semanticAccepted=Boolean(semantic&&semantic.score>=.42&&(semantic.margin>=.015||lexical?.entry?.id===semantic.entry?.id));
    selected=lexical||semanticAccepted&&semantic||null;
    output=selected?matchedReply(selected.entry,text,route,context,{semantic:Boolean(semanticAccepted&&selected===semantic),device:selected.device||semantic?.device||'lexical',score:Number(selected.score||selected.lexical||0)}):clarifyReply(text,route,context,{semantic:Boolean(semantic),device:semantic?.device||'lexical',score:Number(semantic?.score||0)});
  }
  return{schema:'commonweave-model-result-1.0',requestId:request?.requestId||uid(),status:mode==='fallback'?'fallback':'success',purpose:request?.purpose||'commonweave-reflex',requested:{provider:String(request?.config?.provider||request?.config?.route||'bundled'),model:request?.config?.model||MODEL_ID},actual:{provider:'local-reflex',model:MODEL_ID},outputJson:output,outputText:JSON.stringify(output),structured:{requested:Boolean(request?.schema),valid:true,normalizedBy:'commonweave-reflex-v2'},timing:{startedAt:new Date(Date.now()-(performance.now()-started)).toISOString(),completedAt:now(),elapsedMs:Math.round(performance.now()-started)},fallback:{used:mode==='fallback',provider:'local-reflex',reason:failure?.message||failure?.error?.message||failure?.status||null},diagnostics:[kind?'Conversational message handled without semantic routing.':selected?'MiniLM supplied a retrieval label; the guide composed the response from current context.':'No trustworthy pattern match; the guide requested clarification instead of guessing.'],events:[]};
}
function shouldFallback(result,error,request){if(request?.signal?.aborted||error?.name==='AbortError'||error?.code==='CANCELLED'||result?.status==='cancelled')return false;return !['success','fallback','manual-required'].includes(result?.status)}
function bundled(config){return ['bundled','packaged','reflex','minilm','local-reflex','xenova/all-minilm-l6-v2'].includes(String(config?.provider||config?.route||'bundled').toLowerCase())}
function install(){
  const runtime=globalThis.CommonweaveModelRuntime;if(!runtime?.generate||runtime.__minilmReflexInstalled)return false;const previous=runtime.generate.bind(runtime);
  const generate=async request=>{const incoming=request||{};if(bundled(incoming.config))return reflexResponse(incoming,{mode:'primary'});let result,error;try{result=await previous(incoming)}catch(caught){error=caught}if(!shouldFallback(result,error,incoming)){if(error)throw error;return result}try{return await reflexResponse(incoming,{mode:'fallback',failure:error||result})}catch(reflexError){if(error)throw error;return {...result,diagnostics:[...(result?.diagnostics||[]),`Local reflex failed: ${reflexError.message}`]}}};
  globalThis.CommonweaveModelRuntime={...runtime,generate,__minilmReflexInstalled:true};
  globalThis.CommonweaveReflexRuntime={model:MODEL_ID,respond:(request,options)=>reflexResponse(request,options),route:routeByRules,status:async()=>{const engine=await adapter();return engine.status()},prewarm:async()=>{try{const engine=await adapter();const value=await engine.prewarm();semanticReady=true;return value}catch(error){return {ready:false,error:error.message}}},benchmark:async cases=>{const engine=await adapter();return engine.benchmark(cases)},semanticReady:()=>semanticReady};
  const prewarm=()=>globalThis.CommonweaveReflexRuntime.prewarm();if('requestIdleCallback'in globalThis)requestIdleCallback(prewarm,{timeout:2500});else setTimeout(prewarm,800);return true;
}
if(!install())addEventListener('DOMContentLoaded',install,{once:true});
})();
