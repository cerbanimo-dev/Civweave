(()=>{
'use strict';
const MODEL_ID='Xenova/all-MiniLM-L6-v2';
const ADAPTER_URL='/app/models/all-minilm-l6-v2/adapter.js';
const INDEX_URL='/app/models/all-minilm-l6-v2/reflex-index.json';
const SYSTEMS=['commonweave','living-school','cerbanimo','fellowfare','anarchadia'];
const MODES={commonweave:'Reflect','living-school':'Learn',cerbanimo:'Build',fellowfare:'Acquire',anarchadia:'Govern'};
const LABELS={commonweave:'Commonweave','living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',anarchadia:'Anarchadia'};
const CONSEQUENCE=/\b(send|spend|transfer|publish|submit|approve|vote|delete|invite|assign|purchase|order|deploy|federate|commit funds)\b/i;
let adapterPromise=null,indexPromise=null,semanticReady=false;

const safe=(value,max=5000)=>String(value==null?'':value).trim().slice(0,max);
const isObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const parse=value=>{if(isObject(value)||Array.isArray(value))return value;try{return JSON.parse(String(value))}catch{return null}};
const now=()=>new Date().toISOString();
const uid=()=>`reflex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

async function adapter(){if(!adapterPromise)adapterPromise=import(ADAPTER_URL).catch(error=>{adapterPromise=null;throw error});return adapterPromise}
async function index(){if(!indexPromise)indexPromise=fetch(INDEX_URL,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error(`Reflex index returned ${r.status}`);return r.json()}).then(v=>Array.isArray(v.entries)?v.entries:[]);return indexPromise}

function canonicalSystem(value){const raw=safe(value,100).toLowerCase().replace(/_/g,'-');return SYSTEMS.includes(raw)?raw:''}
function wordSet(text){return new Set(safe(text,10000).toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(Boolean))}
function lexicalScore(text,entry){
  const lower=safe(text,10000).toLowerCase();const words=wordSet(text);let score=0;
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
    cerbanimo:['build','repair','make','implement','code','design','prototype','install','construct','fix'].filter(x=>lower.includes(x)),
    'living-school':['learn','study','understand','practice','research','teach','curriculum','lesson','skill'].filter(x=>lower.includes(x))
  };
  const active=Object.entries(hits).filter(([,items])=>items.length);
  const multi=active.length>=2||(/mutual aid|network|ecosystem|whole project/.test(lower)&&/food|community|friends|neighbors/.test(lower));
  if(multi)return {system:'commonweave',mode:'Reflect',confidence:.88,evidence:active.flatMap(([,items])=>items).slice(0,8),multiRealm:true};
  for(const system of ['anarchadia','fellowfare','cerbanimo','living-school'])if(hits[system].length)return {system,mode:MODES[system],confidence:.75+Math.min(.18,hits[system].length*.05),evidence:hits[system],multiRealm:false};
  return {system:canonicalSystem(current)||'commonweave',mode:MODES[canonicalSystem(current)||'commonweave'],confidence:.5,evidence:[],multiRealm:false};
}
function extractContext(request){
  if(isObject(request?.context))return request.context;
  const messages=Array.isArray(request?.messages)?request.messages:[];
  for(const item of messages.slice().reverse()){
    const content=safe(item?.content??item?.text,60000);
    const marker='Structured context:';const start=content.indexOf(marker);
    if(start>=0){const candidate=content.slice(start+marker.length).replace(/Respond[\s\S]*$/,'').trim();const parsed=parse(candidate);if(isObject(parsed))return parsed}
    const parsed=parse(content);if(isObject(parsed)&&parsed.schema==='commonweave.structured-context.v1')return parsed;
    if(isObject(parsed)&&Array.isArray(parsed.conversation)){
      for(const turn of parsed.conversation.slice().reverse()){const nested=extractContext({messages:[{content:turn.content??turn.text}]});if(nested)return nested}
    }
  }
  return {};
}
function userText(request,context){
  if(context?.userMessage)return safe(context.userMessage,4000);
  const messages=Array.isArray(request?.messages)?request.messages:[];
  const user=messages.slice().reverse().find(item=>item?.role==='user');return safe(user?.content??user?.text,4000);
}
function selectLexical(text,entries,route){
  const ranked=entries.map(entry=>({entry,score:lexicalScore(text,entry)+(entry.system===route.system?1.25:0)})).sort((a,b)=>b.score-a.score);
  return ranked[0]?.score>0?ranked[0]:{entry:entries.find(entry=>entry.system===route.system)||entries[0],score:0};
}
async function semanticMatch(text,entries,route,waitMs=350){
  const engine=await adapter();
  const task=engine.match(text,{limit:6,timeoutMs:120000}).then(result=>{semanticReady=true;return result});
  const timeout=new Promise(resolve=>setTimeout(()=>resolve(null),waitMs));
  const result=await Promise.race([task,timeout]);
  if(!result)return null;
  const byId=new Map(entries.map(entry=>[entry.id,entry]));
  const candidates=(result.matches||[]).map(match=>({entry:byId.get(match.id),score:Number(match.score||0),device:result.device})).filter(item=>item.entry);
  const preferred=candidates.find(item=>item.entry.system===route.system);
  return preferred||candidates[0]||null;
}
function cleanIntent(text){return safe(text,500).replace(/^\s*(i\s+(wish|want|need|hope)\s+(i\s+could\s+|to\s+)?|can you\s+|please\s+)/i,'').replace(/[.?!]+$/,'').trim()}
function compose(entry,text,route,context,{semantic=false,device='lexical'}={}){
  const system=route.system;const intent=cleanIntent(text);
  const assumptions=[];
  if(!semantic)assumptions.push('The semantic model was still warming, so Commonweave used its immediate lexical reflex.');
  if(route.multiRealm)assumptions.push('This intention spans multiple realms; Commonweave remains the coordinating route.');
  let answer=safe(entry?.answer,2200)||`You want to ${intent||'move this intention forward'}. ${LABELS[system]} can hold the next useful step without pretending the whole problem is solved.`;
  if(entry?.subplans?.length)answer+=`\n\n${entry.subplans.map(item=>`• ${item}`).join('\n')}`;
  const nextAction=safe(entry?.nextAction,600)||`Open ${LABELS[system]} and name the smallest visible result that would prove progress.`;
  return {
    answer,
    choice:{mode:route.mode||MODES[system],system,room:safe(context?.routingAnswer?.room||context?.currentContext?.roomId,200),nextAction},
    assumptions,
    requiresConsent:Boolean(context?.consent?.consequentialActionDetected||CONSEQUENCE.test(text)),
    confidence:Math.max(.45,Math.min(.98,Number(route.confidence||.5))),
    reflex:{entryId:entry?.id||null,semantic,device}
  };
}
async function reflexResponse(request,{mode='primary',failure=null,semanticWaitMs=350}={}){
  const started=performance.now();const context=extractContext(request);const text=userText(request,context);
  const contextRoute=canonicalSystem(context?.routingAnswer?.system);
  const route=contextRoute?{system:contextRoute,mode:context?.routingAnswer?.mode||MODES[contextRoute],confidence:Number(context?.routingAnswer?.confidence||.76),evidence:context?.routingAnswer?.evidence||[],multiRealm:contextRoute==='commonweave'}:routeByRules(text,context?.currentContext?.systemId);
  const entries=await index();let selected=selectLexical(text,entries,route);let semantic=null;
  try{semantic=await semanticMatch(text,entries,route,semanticWaitMs)}catch{}
  if(semantic&&semantic.score>=.18)selected=semantic;
  const output=compose(selected.entry,text,route,context,{semantic:Boolean(semantic),device:semantic?.device||'lexical'});
  return {
    schema:'commonweave-model-result-1.0',requestId:request?.requestId||uid(),status:mode==='fallback'?'fallback':'success',purpose:request?.purpose||'commonweave-reflex',
    requested:{provider:String(request?.config?.provider||request?.config?.route||'bundled'),model:request?.config?.model||MODEL_ID},
    actual:{provider:'local-reflex',model:MODEL_ID},
    outputJson:output,outputText:JSON.stringify(output),structured:{requested:Boolean(request?.schema),valid:true,normalizedBy:'commonweave-reflex-v1'},
    timing:{startedAt:new Date(Date.now()-(performance.now()-started)).toISOString(),completedAt:now(),elapsedMs:Math.round(performance.now()-started)},
    fallback:{used:mode==='fallback',provider:'local-reflex',reason:failure?.message||failure?.error?.message||failure?.status||null},
    diagnostics:[semantic?'MiniLM semantic retrieval selected the response pattern.':'Immediate lexical reflex answered while MiniLM warmed in the background.'],events:[]
  };
}
function shouldFallback(result,error,request){if(request?.signal?.aborted||error?.name==='AbortError'||error?.code==='CANCELLED'||result?.status==='cancelled')return false;return !['success','fallback','manual-required'].includes(result?.status)}
function bundled(config){return ['bundled','packaged','reflex','minilm','local-reflex','xenova/all-minilm-l6-v2'].includes(String(config?.provider||config?.route||'bundled').toLowerCase())}
function install(){
  const runtime=globalThis.CommonweaveModelRuntime;if(!runtime?.generate||runtime.__minilmReflexInstalled)return false;
  const previous=runtime.generate.bind(runtime);
  const generate=async request=>{
    const incoming=request||{};
    if(bundled(incoming.config))return reflexResponse(incoming,{mode:'primary'});
    let result,error;try{result=await previous(incoming)}catch(caught){error=caught}
    if(!shouldFallback(result,error,incoming)){if(error)throw error;return result}
    try{return await reflexResponse(incoming,{mode:'fallback',failure:error||result})}catch(reflexError){if(error)throw error;return {...result,diagnostics:[...(result?.diagnostics||[]),`Local reflex failed: ${reflexError.message}`]}}
  };
  globalThis.CommonweaveModelRuntime={...runtime,generate,__minilmReflexInstalled:true};
  globalThis.CommonweaveReflexRuntime={model:MODEL_ID,respond:(request,options)=>reflexResponse(request,options),route:routeByRules,status:async()=>{const engine=await adapter();return engine.status()},prewarm:async()=>{try{const engine=await adapter();const value=await engine.prewarm();semanticReady=true;return value}catch(error){return {ready:false,error:error.message}}},benchmark:async cases=>{const engine=await adapter();return engine.benchmark(cases)},semanticReady:()=>semanticReady};
  const prewarm=()=>globalThis.CommonweaveReflexRuntime.prewarm();
  if('requestIdleCallback'in globalThis)requestIdleCallback(prewarm,{timeout:2500});else setTimeout(prewarm,800);
  return true;
}
if(!install())addEventListener('DOMContentLoaded',install,{once:true});
})();
