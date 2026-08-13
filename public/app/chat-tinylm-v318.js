(()=>{
'use strict';

const VERSION='1.0.0-chat-tinylm-v318';
const MODEL_ID='smollm2-135m-avatar-q8-wasm';
const WORKER='/app/local-ai/worker-v266.js?v=1.0.125-v314-smooth-fit';
const DOWNLOAD_STATE_KEY='civweave.local-ai.downloads.v266';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const ROUTE_THRESHOLD=.72;
const IDLE_MS=120000;
const ROUTE_LABEL=Object.freeze({
  civweave:'Civweave coordination',
  'living-school':'Living School learning',
  cerbanimo:'Cerbanimo skilled work',
  fellowfare:'FellowFare resources and exchange',
  anarchadia:'Anarchadia governance'
});
const EXPRESSIONS=Object.freeze(['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','sleepy','cheering','waving','pointing','determined','proud','hopeful']);
const FALLBACK_SPEC=Object.freeze({
  id:MODEL_ID,label:'TinyLM Chat Sidecar',repo:'onnx-community/SmolLM2-135M-Instruct-ONNX',revision:'b8a5c0f183b78c55955a5364f610c36668b5e681',task:'text-generation',dtype:'q8',device:'wasm',runtime:'transformers-js-v3',forceSingleThread:true,contextWindowTokens:8192,workingContextTokens:768,generation:Object.freeze({topK:8,nonThinkingTemperature:.12,thinkingTemperature:.12,thinkingSupported:false}),artifacts:Object.freeze([
    Object.freeze({path:'config.json',minBytes:500,required:true,revision:'',sizeBytes:976}),
    Object.freeze({path:'tokenizer.json',minBytes:3000000,required:true,revision:'',sizeBytes:3522656}),
    Object.freeze({path:'tokenizer_config.json',minBytes:500,required:true,revision:'',sizeBytes:3794}),
    Object.freeze({path:'generation_config.json',minBytes:50,required:true,revision:'',sizeBytes:132}),
    Object.freeze({path:'special_tokens_map.json',minBytes:100,required:true,revision:'',sizeBytes:655}),
    Object.freeze({path:'merges.txt',minBytes:400000,required:false,revision:'',sizeBytes:466391}),
    Object.freeze({path:'vocab.json',minBytes:700000,required:false,revision:'',sizeBytes:800662}),
    Object.freeze({path:'onnx/model_quantized.onnx',minBytes:130000000,required:true,revision:'',sizeBytes:135658354})
  ])
});

if(globalThis.CivweaveChatTinyLMV318?.version===VERSION)return;

const clean=(value,max=4000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const spec=()=>registry()?.byId?.(MODEL_ID)||FALLBACK_SPEC;
let worker=null,workerReady=false,sequence=0,idleTimer=0,prewarmFlight=null,lastRoute=null,lastExpression=null,lastError='',tinyRuns=0;
const pending=new Map();

function savedAvailableHint(){const state=parse(localStorage.getItem(DOWNLOAD_STATE_KEY),{});return state?.[MODEL_ID]?.status==='ready'}
function resetIdle(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>shutdown('idle'),IDLE_MS)}
function failPending(error){for(const item of pending.values()){clearTimeout(item.timer);item.reject(error)}pending.clear()}
function ensureWorker(){
  if(worker){resetIdle();return worker}
  worker=new Worker(WORKER,{name:'civweave-chat-tinylm-v318'});
  worker.addEventListener('message',event=>{
    const message=event.data||{},item=pending.get(message.id);if(!item)return;
    if(message.type==='progress'||message.type==='token')return;
    pending.delete(message.id);clearTimeout(item.timer);resetIdle();
    if(message.type==='error')item.reject(Object.assign(new Error(message.error?.message||'TinyLM failed.'),message.error||{}));else item.resolve(message.result||{});
  });
  worker.addEventListener('error',event=>{const error=new Error(clean(event?.message||'TinyLM worker failed.',1000));lastError=error.message;workerReady=false;failPending(error);shutdown('worker-error')});
  resetIdle();return worker
}
function request(type,messages=[],{maxNewTokens=8,timeoutMs=30000}={}){
  return new Promise((resolve,reject)=>{
    const instance=ensureWorker(),id=`cwtiny-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
    const timer=setTimeout(()=>{pending.delete(id);workerReady=false;reject(Object.assign(new Error('TinyLM timed out.'),{code:'TINYLM_TIMEOUT'}))},timeoutMs);
    pending.set(id,{resolve,reject,timer});
    instance.postMessage({id,type,spec:spec(),messages,maxNewTokens,promptTokenBudget:640,temperature:.12,thinking:false,stream:false,benchmark:false})
  })
}
async function ensureRuntimeSupport(){
  if(registry()?.byId?.(MODEL_ID)&&manager()?.status)return true;
  await globalThis.CivweaveExperienceOrchestratorV232?.ensureChatModules?.();
  await globalThis.CivweaveLocalChatRuntimeV295?.ready?.();
  return Boolean(registry()?.byId?.(MODEL_ID)&&manager()?.status)
}
async function modelAvailable(){
  if(!savedAvailableHint()&&!manager()?.state?.(MODEL_ID))return false;
  try{if(!await ensureRuntimeSupport())return false;return Boolean((await manager().status(MODEL_ID))?.available)}catch(error){lastError=clean(error?.message||error,1000);return false}
}
async function prewarm(reason='chat-open'){
  if(workerReady)return{ready:true,modelId:MODEL_ID,cold:false,reason};
  if(prewarmFlight)return prewarmFlight;
  prewarmFlight=(async()=>{
    if(!await modelAvailable())return{ready:false,available:false,modelId:MODEL_ID,reason};
    try{const result=await request('prewarm',[],{timeoutMs:180000});workerReady=true;lastError='';try{dispatchEvent(new CustomEvent('civweave:chat-tinylm-ready',{detail:{version:VERSION,modelId:MODEL_ID,reason,metrics:result?.metrics||null}}))}catch{}return{ready:true,available:true,modelId:MODEL_ID,cold:Boolean(result?.metrics?.coldStart),reason,metrics:result?.metrics||null}}catch(error){lastError=clean(error?.message||error,1000);workerReady=false;try{dispatchEvent(new CustomEvent('civweave:chat-tinylm-fallback',{detail:{version:VERSION,modelId:MODEL_ID,reason,message:lastError}}))}catch{}return{ready:false,available:true,modelId:MODEL_ID,reason,error:lastError}}
  })().finally(()=>{prewarmFlight=null});
  return prewarmFlight
}

function routeByRules(text,{currentSystem='civweave'}={}){
  currentSystem=SYSTEMS.includes(currentSystem)?currentSystem:'civweave';
  if(currentSystem!=='civweave')return{system:currentSystem,confidence:1,source:'explicit-window',reason:'The selected specialist window stays authoritative.'};
  const value=clean(text,4000).toLowerCase(),score={civweave:0,'living-school':0,cerbanimo:0,fellowfare:0,anarchadia:0};
  const add=(system,re,weight=1)=>{const matches=value.match(re);if(matches)score[system]+=matches.length*weight};
  add('living-school',/\b(learn|lesson|course|study|teach|practice|curriculum|school|understand|training|mentor|quiz)\w*\b/g,2);
  add('cerbanimo',/\b(build|code|debug|implement|design|prototype|project|deliverable|ship|developer|engineering|repair)\w*\b/g,2);
  add('fellowfare',/\b(borrow|lend|buy|sell|trade|exchange|resource|material|tool|equipment|trailer|ride|food|housing|offer|need)\w*\b/g,2);
  add('anarchadia',/\b(policy|govern|proposal|vote|consent|rule|appeal|rights|civic|constitution|moderation|automation)\w*\b/g,2);
  add('civweave',/\b(plan|coordinate|organize|wish|intention|across|overall|weave|multi[- ]?realm)\w*\b/g,1);
  const ranked=Object.entries(score).sort((a,b)=>b[1]-a[1]),[top,second]=ranked;
  if(!top?.[1]||top[1]===second?.[1])return{system:'civweave',confidence:.55,source:'rules',reason:'No single specialist owns the message yet.',scores:score};
  const confidence=Math.min(.97,.74+top[1]*.045+(top[1]-Number(second?.[1]||0))*.025);
  return{system:top[0],confidence,source:'rules',reason:`${ROUTE_LABEL[top[0]]} has the strongest local routing evidence.`,scores:score}
}
function parseSystem(result){
  const json=result?.json,raw=clean(json?.system||json?.route||result?.text||'',200).toLowerCase();
  return SYSTEMS.find(system=>new RegExp(`(?:^|[^a-z-])${system.replace('-','[- ]?')}(?:$|[^a-z-])`,'i').test(raw))||''
}
async function route(text,options={}){
  const currentSystem=SYSTEMS.includes(options.currentSystem)?options.currentSystem:'civweave',rules=routeByRules(text,{currentSystem});
  if(currentSystem!=='civweave'){lastRoute=rules;return rules}
  if(!workerReady){if(savedAvailableHint())void prewarm('route-intent');lastRoute=rules;publishRoute(rules,text,currentSystem);return rules}
  try{
    const prompt=`Choose the one Civweave guide that should own the next useful response. Output exactly one label and nothing else. Labels: civweave, living-school, cerbanimo, fellowfare, anarchadia. civweave coordinates mixed or unclear intentions; living-school handles learning and practice; cerbanimo handles building and skilled project work; fellowfare handles resources, needs, offers, borrowing and exchange; anarchadia handles governance, consent, policy and civic automation.`;
    const result=await request('generate',[{role:'system',content:prompt},{role:'user',content:clean(text,1600)}],{maxNewTokens:8,timeoutMs:20000}),chosen=parseSystem(result);tinyRuns++;
    let decision=rules;
    if(chosen){
      if(rules.confidence>=.9&&chosen!==rules.system)decision={...rules,source:'rules-guarded',modelCandidate:chosen,reason:`TinyLM suggested ${ROUTE_LABEL[chosen]}, but stronger deterministic evidence kept ${ROUTE_LABEL[rules.system]}.`};
      else if(chosen===rules.system)decision={...rules,confidence:Math.max(.9,rules.confidence),source:'tinylm+rules',modelId:MODEL_ID,reason:`TinyLM and deterministic evidence agree on ${ROUTE_LABEL[chosen]}.`};
      else decision={system:chosen,confidence:.8,source:'tinylm',modelId:MODEL_ID,ruleCandidate:rules.system,reason:`TinyLM selected ${ROUTE_LABEL[chosen]} for the next response.`,scores:rules.scores};
    }
    lastRoute=decision;lastError='';publishRoute(decision,text,currentSystem);return decision
  }catch(error){workerReady=false;lastError=clean(error?.message||error,1000);lastRoute={...rules,source:'rules-fallback',fallbackReason:lastError};publishRoute(lastRoute,text,currentSystem);void prewarm('route-recovery');return lastRoute}
}
function publishRoute(decision,text,currentSystem){try{dispatchEvent(new CustomEvent('civweave:chat-route-decision',{detail:{version:VERSION,currentSystem,textLength:clean(text).length,...decision}}))}catch{}}

function classifyRules(text){
  const value=clean(text,4000).toLowerCase();
  if(!value)return'neutral';
  if(/\b(sleep|rest|tired|pause)\w*\b/.test(value))return'sleepy';
  if(/\b(error|risk|unsafe|warning|concern|problem|failed|broken)\w*\b/.test(value))return'worried';
  if(/\b(confus|unclear|uncertain|ambiguous)\w*\b/.test(value))return'confused';
  if(/\b(congrat|success|excellent|we did it|celebrat)\w*\b/.test(value))return'cheering';
  if(/\b(think|consider|compare|inspect|reason|evaluate)\w*\b/.test(value))return'thinking';
  if(/\?$/.test(value)||/\b(curious|wonder|what if)\b/.test(value))return'curious';
  if(/\b(next step|build|fix|ship|make it happen|determined)\b/.test(value))return'determined';
  if(/\b(hello|welcome|greetings|hi there)\b/.test(value))return'waving';
  if(/\b(great|good news|happy|glad|hope|possible)\w*\b/.test(value))return'happy';
  return'neutral'
}
function parseExpression(result){const raw=clean(result?.json?.expression||result?.text||'',160).toLowerCase();return EXPRESSIONS.find(value=>new RegExp(`\\b${value}\\b`,'i').test(raw))||''}
async function classify(text,{system='civweave',userText='',forceRules=false}={}){
  system=SYSTEMS.includes(system)?system:'civweave';const fallback=classifyRules(text);let expression=fallback,source='rules';
  if(!forceRules&&workerReady){try{const prompt=`Classify the assistant message's dominant communicative expression. Output exactly one label and nothing else. Labels: ${EXPRESSIONS.join(', ')}.`;const result=await request('generate',[{role:'system',content:prompt},{role:'user',content:`Guide: ${system}\nPrevious user message: ${clean(userText,500)}\nAssistant message: ${clean(text,1400)}`}],{maxNewTokens:8,timeoutMs:20000});expression=parseExpression(result)||fallback;source=parseExpression(result)?'tinylm':'rules-fallback';tinyRuns++}catch(error){workerReady=false;lastError=clean(error?.message||error,1000);void prewarm('expression-recovery')}}
  lastExpression={system,expression,source,modelId:source==='tinylm'?MODEL_ID:null,updatedAt:Date.now()};
  try{dispatchEvent(new CustomEvent('civweave:avatar-expression',{detail:{version:VERSION,...lastExpression}}))}catch{}return lastExpression
}
function status(){return{version:VERSION,modelId:MODEL_ID,availableHint:savedAvailableHint(),workerReady,prewarming:Boolean(prewarmFlight),tinyRuns,lastRoute,lastExpression,lastError,routeThreshold:ROUTE_THRESHOLD,chatRouting:true,expressionClassification:true,chatModelIsolation:true}}
function shutdown(reason='manual'){clearTimeout(idleTimer);idleTimer=0;const current=worker;worker=null;workerReady=false;if(current)try{current.terminate()}catch{}if(pending.size)failPending(Object.assign(new Error(`TinyLM stopped: ${reason}`),{code:'TINYLM_STOPPED'}));return true}

addEventListener('civweave:guide-workspace-state',event=>{const detail=event?.detail||{};if(detail.open===true&&detail.minimized!==true&&savedAvailableHint())void prewarm('chat-open')});
addEventListener('civweave:local-model-downloaded',event=>{if(event?.detail?.id===MODEL_ID)void prewarm('model-downloaded')});
addEventListener('civweave:local-model-removed',event=>{if(event?.detail?.id===MODEL_ID)shutdown('model-removed')});
addEventListener('pagehide',()=>shutdown('pagehide'));

globalThis.CivweaveChatTinyLMV318=Object.freeze({version:VERSION,modelId:MODEL_ID,modelSpec:FALLBACK_SPEC,systems:Object.freeze([...SYSTEMS]),routeThreshold:ROUTE_THRESHOLD,routeByRules,route,classifyRules,classify,prewarm,modelAvailable,status,shutdown,chatRouting:true,expressionClassification:true,chatModelIsolation:true});
try{dispatchEvent(new CustomEvent('civweave:chat-tinylm-runtime-ready',{detail:{version:VERSION,modelId:MODEL_ID,chatRouting:true,expressionClassification:true,chatModelIsolation:true}}))}catch{}
})();
