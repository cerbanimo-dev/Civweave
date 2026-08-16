(()=>{
'use strict';
const VERSION='1.0.117-server-ai-router-v301-guild-handoff';
const MIDDLEWARE_ID='server-auto-v301';
const MARKET_SESSION_KEY='civweave.node-ai-marketplace.sessions.v1';
const CAPACITY_SESSION_KEY='civweave.host-capacity.sessions.v1';
const MARKET_PREF_KEY='civweave.node-ai-marketplace.preferences.v1';
const ROUTE='server-auto';
if(globalThis.CivweaveServerAIRouterV301?.version===VERSION)return;
let registered=false;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>value==null?value:structuredClone(value);
const now=()=>new Date().toISOString();
const runtime=()=>globalThis.CivweaveModelRuntime||null;
const spine=()=>globalThis.CivweaveFastInteractiveV192||null;
const mesh=()=>globalThis.CivweaveNodeAIMeshV1||null;
const hostAccess=()=>globalThis.CivweaveHostNodeSessionV1||null;
function storageObject(storage,key){try{const value=parse(storage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}}
function selectedRoute(request={}){
  const explicit=clean(request?.config?.provider||request?.config?.route,80).toLowerCase();
  if(explicit)return explicit;
  try{
    const profile=runtime()?.readSharedConfig?.(request.executionProfile||'interactive')||runtime()?.readSharedConfig?.('interactive')||{};
    return clean(profile.provider||profile.route,80).toLowerCase();
  }catch{return''}
}
function isServerAuto(request={}){return selectedRoute(request)===ROUTE}
function marketSessions(){return storageObject(sessionStorage,MARKET_SESSION_KEY)}
function capacitySessions(){return storageObject(sessionStorage,CAPACITY_SESSION_KEY)}
function marketPrefs(){return storageObject(localStorage,MARKET_PREF_KEY)}
function endpoint(candidate){
  const value=clean(candidate?.endpoints?.baseUrls?.[0],4000);
  if(!value)return null;
  try{const url=new URL(value,location.href);return ['http:','https:'].includes(url.protocol)?url.origin:null}catch{return null}
}
function localServerService(candidate){
  const mode=clean(candidate?.privacy?.processing||candidate?.disclosures?.processing,120).toLowerCase();
  const thirdParty=candidate?.disclosures?.thirdPartyInference??candidate?.privacy?.thirdPartyInference;
  if(thirdParty===false)return true;
  return /(^|[-_ ])(local|self-hosted|selfhosted|on-node|on node|server-local|server local)([-_ ]|$)/.test(mode);
}
function usefulService(candidate){
  const caps=(Array.isArray(candidate?.capabilities)?candidate.capabilities:[]).map(value=>clean(value,100).toLowerCase());
  if(!caps.length)return true;
  return caps.some(cap=>/chat|generation|text|reason|assistant|completion|instruction|language/.test(cap));
}
function serviceCeiling(candidate){
  const prefs=marketPrefs(),key=`${candidate.nodeId}\u0000${candidate.serviceId}`,saved=Number(prefs?.spendCeilings?.[key]);
  if(Number.isSafeInteger(saved)&&saved>0)return saved;
  const max=Number(candidate?.billing?.maxRequestCents);
  return Number.isSafeInteger(max)&&max>0?Math.min(max,100):25;
}
function requestPayload(request={}){
  const messages=Array.isArray(request.messages)?request.messages.map(item=>({role:item?.role==='assistant'?'assistant':item?.role==='system'?'system':'user',content:clean(item?.content,48000)})).filter(item=>item.content):[];
  return{
    messages,
    system:clean(request.system,48000)||undefined,
    prompt:clean(request.prompt,48000)||undefined,
    responseFormat:request.responseFormat||((request.schema||request.responseSchema)?'json':'text'),
    responseSchema:clone(request.schema||request.responseSchema||null),
    maxTokens:Math.max(32,Math.min(4096,Number(request?.config?.maxTokens||request.maxTokens||1024)||1024)),
    temperature:Math.max(0,Math.min(2,Number(request?.config?.temperature??request.temperature??0.2))),
    purpose:clean(request.purpose,160)||'interactive',
    executionProfile:clean(request.executionProfile,40)||'interactive'
  };
}
function textFromOutput(value){
  if(typeof value==='string')return value;
  if(value==null)return'';
  if(typeof value?.text==='string')return value.text;
  if(typeof value?.outputText==='string')return value.outputText;
  if(typeof value?.response==='string')return value.response;
  try{return JSON.stringify(value)}catch{return String(value)}
}
function resultFor(request,{provider,model,text,outputJson=null,usage={},diagnostics=[],routeTrace=[]}={}){
  const started=request.__serverAutoStartedAt||Date.now(),guildOnly=request.guildOnly===true;
  return{
    schema:'civweave-model-result-1.0',
    requestId:clean(request.requestId,180)||`server-auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
    purpose:clean(request.purpose,160)||'interactive',
    status:'success',
    requested:{provider:guildOnly?'guild-server-local':ROUTE,model:guildOnly?'civweave-guild-auto':'civweave-server-auto',endpoint:'',executionProfile:clean(request.executionProfile,40)||'interactive'},
    actual:{provider,model:model||provider},
    outputText:text||'',
    outputJson,
    usage:{inputTokens:Number(usage.inputTokens??usage.prompt_tokens??usage.input_tokens??0)||0,outputTokens:Number(usage.outputTokens??usage.completion_tokens??usage.output_tokens??0)||0,totalTokens:Number(usage.totalTokens??usage.total_tokens??0)||0,costCents:Number(usage.costCents||0)||0,remainingCents:Number(usage.remainingCents||0)||0,chargedNeurons:Number(usage.chargedNeurons||0)||0,remainingNeurons:usage.remainingNeurons!=null&&Number.isFinite(Number(usage.remainingNeurons))?Math.max(0,Math.floor(Number(usage.remainingNeurons))):null,approximateTurnsLeft:usage.approximateTurnsLeft!=null&&Number.isFinite(Number(usage.approximateTurnsLeft))?Math.max(0,Math.floor(Number(usage.approximateTurnsLeft))):null},
    timing:{startedAt:new Date(started).toISOString(),completedAt:now(),elapsedMs:Math.max(0,Date.now()-started)},
    events:[],
    diagnostics:[{code:guildOnly?'GUILD_AI_ORDER':'SERVER_AUTO_ORDER',message:guildOnly?'Explicit Guild processing uses the paired server-local model only.':'Server-side AI preference is device local → paired server-local → Cloudflare Workers AI.'},...diagnostics,{code:'SERVER_AUTO_TRACE',message:routeTrace.map(item=>`${item.route}:${item.status}`).join(' → '),routeTrace}],
    stream:{requested:Boolean(request?.config?.stream||request.stream),used:false},
    structured:{requested:Boolean(request.schema||request.responseSchema||request.responseFormat==='json'),valid:true,repairAttempts:0},
    fallback:{used:routeTrace.some(item=>item.status==='failed'||item.status==='skipped'),route:provider}
  };
}
async function discoverCandidates(){
  const market=globalThis.CivweaveNodeAIMarketplaceV1;
  const visible=market?.candidates?.();
  if(Array.isArray(visible)&&visible.length)return visible;
  const found=await mesh()?.discover?.({});
  return Array.isArray(found?.candidates)?found.candidates:[];
}
async function serverLocal(request,trace){
  const sessions=marketSessions(),prefs=marketPrefs(),preferred=clean(prefs.preferredNodeId,180);
  if(!mesh()?.requestCapability||!mesh()?.invoke){trace.push({route:'server-local',status:'skipped',reason:'node mesh unavailable'});return null}
  const candidates=(await discoverCandidates()).filter(candidate=>candidate?.nodeId&&candidate?.serviceId&&sessions[candidate.nodeId]?.token&&endpoint(candidate)&&localServerService(candidate)&&usefulService(candidate));
  candidates.sort((a,b)=>(a.nodeId===preferred?-1:0)-(b.nodeId===preferred?-1:0));
  if(!candidates.length){trace.push({route:'server-local',status:'skipped',reason:'no paired self-hosted model service'});return null}
  let lastError=null;
  for(const selection of candidates.slice(0,4)){
    const saved=sessions[selection.nodeId];
    try{
      const authorization=await mesh().requestCapability({selection,sessionToken:saved.token,deviceId:saved.deviceId,maxRetailCostCents:serviceCeiling(selection),baseUrl:saved.baseUrl||endpoint(selection)});
      const response=await mesh().invoke({selection,capability:authorization.capability,deviceId:saved.deviceId,request:requestPayload(request),requestId:clean(request.requestId,180)||`server-auto:${crypto.randomUUID?.()||Date.now()}`,baseUrl:saved.baseUrl||endpoint(selection)});
      const text=textFromOutput(response?.output),outputJson=(response?.output&&typeof response.output==='object')?response.output:null;
      if(!text&&!outputJson)throw new Error('Paired server-local model returned no output.');
      trace.push({route:'server-local',status:'success',nodeId:selection.nodeId,serviceId:selection.serviceId});
      return resultFor(request,{provider:'server-local',model:selection.model||selection.serviceLabel||selection.serviceId,text,outputJson,usage:{costCents:response?.retailCostCents||0},diagnostics:[{code:'SERVER_LOCAL_NODE',message:`Used paired self-hosted service ${selection.serviceId} on ${selection.nodeId}.`}],routeTrace:trace});
    }catch(error){lastError=error;trace.push({route:'server-local',status:'failed',nodeId:selection.nodeId,serviceId:selection.serviceId,reason:clean(error?.message||error,500)})}
  }
  if(lastError)dispatchEvent(new CustomEvent('civweave:server-ai-route-failed',{detail:{route:'server-local',message:clean(lastError.message,800),at:now()}}));
  return null;
}
function usableCapacitySession(){
  const owned=hostAccess()?.sessionFor?.();if(owned)return owned;
  const all=capacitySessions(),preferred=clean(marketPrefs().preferredNodeId,180),rows=Object.values(all).filter(item=>item?.nodeId&&item?.token&&item?.origin&&(!item.expiresAt||Date.parse(item.expiresAt)>Date.now()));
  return rows.find(item=>item.nodeId===preferred)||rows[0]||null;
}
async function cloudflare(request,trace){
  const session=usableCapacitySession();
  if(!session){trace.push({route:'cloudflare-workers-ai',status:'skipped',reason:'no active host-capacity session'});return null}
  const endpointUrl=new URL('/api/ai/node/generate',session.origin);
  endpointUrl.searchParams.set('nodeId',session.nodeId);
  const payload=requestPayload(request);
  const response=await fetch(endpointUrl,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${session.token}`,'x-civweave-node-id':session.nodeId},body:JSON.stringify({...payload,allowLifetimeCredits:request.allowLifetimeCredits===true||request?.config?.allowLifetimeCredits===true})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    const message=clean(body?.error||`Cloudflare Workers AI returned HTTP ${response.status}.`,1000);
    trace.push({route:'cloudflare-workers-ai',status:'failed',nodeId:session.nodeId,httpStatus:response.status,reason:message});
    const error=new Error(response.status===402?`${message} Open AI settings to add compute or choose a membership.`:message);error.status=response.status;throw error;
  }
  const text=clean(body.text,5_000_000),outputJson=body.outputJson&&typeof body.outputJson==='object'?body.outputJson:null;
  if(!text&&!outputJson)throw new Error('Cloudflare Workers AI returned no output.');
  const telemetry=hostAccess()?.recordUsage?.({nodeId:session.nodeId,chargedNeurons:Number(body?.usage?.chargedNeurons||0),quota:body.quota||null})||{};
  trace.push({route:'cloudflare-workers-ai',status:'success',nodeId:session.nodeId});
  return resultFor(request,{provider:'cloudflare-workers-ai',model:body.model||'workers-ai',text:text||JSON.stringify(outputJson),outputJson,usage:{...(body.usage||{}),chargedNeurons:Number(body?.usage?.chargedNeurons||0),remainingNeurons:telemetry.remainingNeurons,approximateTurnsLeft:telemetry.approximateTurnsLeft},diagnostics:[{code:'CLOUDFLARE_CAPACITY',message:`Used capacity-backed Workers AI through ${session.nodeId}; lifetime credits are never spent unless explicitly allowed.`}],routeTrace:trace});
}
async function handle(request={}){
  if(!isServerAuto(request))return null;
  const guildOnly=request.guildOnly===true,next={...request,__serverAutoStartedAt:Date.now()},trace=guildOnly?[]:[{route:'device-local',status:'skipped-or-failed-over',reason:'downloaded-local middleware gets first priority when available'}];
  const node=await serverLocal(next,trace);if(node)return{handled:true,result:node};
  if(guildOnly){
    const error=new Error('No paired Guild server-local AI service is available for this request. Connect to a Guild AI service and try again.');
    error.code='GUILD_AI_UNAVAILABLE';error.routeTrace=trace;throw error;
  }
  try{const edge=await cloudflare(next,trace);if(edge)return{handled:true,result:edge}}catch(error){
    dispatchEvent(new CustomEvent('civweave:server-ai-route-failed',{detail:{route:'cloudflare-workers-ai',message:clean(error?.message||error,800),status:error?.status||null,at:now()}}));
    throw Object.assign(error,{code:error.code||'SERVER_AI_CLOUDFLARE_FAILED',routeTrace:trace});
  }
  const error=new Error('Server-side AI could not find a usable paired self-hosted model or Cloudflare capacity session. Pair a Guild host or join a Cloudflare-backed Guild, then try again.');
  error.code='SERVER_AI_EXHAUSTED';error.routeTrace=trace;throw error;
}
function register(){
  const s=spine();if(!s?.register)return false;
  s.register(MIDDLEWARE_ID,{handle},60);registered=true;
  try{dispatchEvent(new CustomEvent('civweave:server-ai-router-ready',{detail:{version:VERSION,middleware:MIDDLEWARE_ID,priority:60,order:['device-local','server-local','cloudflare-workers-ai'],guildOnly:true,at:now()}}))}catch{}
  return true;
}
function status(){return{version:VERSION,registered,selectedRoute:selectedRoute({}),marketSessions:Object.keys(marketSessions()).length,capacitySessions:Object.keys(capacitySessions()).length,order:['device-local','server-local','cloudflare-workers-ai'],guildOnly:true}}
addEventListener('civweave:runtime-spine-ready',register);addEventListener('civweave:model-runtime-ready',register);addEventListener('civweave:local-model-bridge-installed',register);addEventListener('pageshow',register);register();
globalThis.CivweaveServerAIRouterV301=Object.freeze({version:VERSION,route:ROUTE,register,status,isServerAuto,handle,order:Object.freeze(['device-local','server-local','cloudflare-workers-ai']),guildOnly:true});
})();