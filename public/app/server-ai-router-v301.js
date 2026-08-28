(()=>{
'use strict';
const VERSION='1.0.123-server-ai-router-v301-route-deadlines';
const MIDDLEWARE_ID='server-auto-v301';
const MARKET_SESSION_KEY='civweave.node-ai-marketplace.sessions.v1';
const CAPACITY_SESSION_KEY='civweave.host-capacity.sessions.v1';
const MARKET_PREF_KEY='civweave.node-ai-marketplace.preferences.v1';
const MOBILE_GUILD_STATE_KEY='civweave.mobile-guild.v1';
const GUILD_TELEMETRY_KEY='civweave.guild-ai-telemetry.v1';
const ROUTE='server-auto';
const WORKERS_AI_ROUTES=new Set(['cloudflare-workers-ai','workers-ai','cloudflare']);
const MAX_GENERATION_TOKENS=16384;
const DEFAULT_WORKERS_AI_MODEL='@cf/zai-org/glm-4.7-flash';
const DEFAULT_NEURONS_PER_CHAT=12;
const CLOUDFLARE_REQUEST_TIMEOUT_MS=90_000;
if(globalThis.CivweaveServerAIRouterV301?.version===VERSION)return;
let registered=false;
let mobileGuildRefreshPromise=null;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>value==null?value:structuredClone(value);
const now=()=>new Date().toISOString();
const finite=value=>Number.isFinite(Number(value))&&Number(value)>=0?Math.floor(Number(value)):null;
const runtime=()=>globalThis.CivweaveModelRuntime||null;
const spine=()=>globalThis.CivweaveFastInteractiveV192||null;
const mesh=()=>globalThis.CivweaveNodeAIMeshV1||null;
const hostAccess=()=>globalThis.CivweaveHostNodeSessionV1||null;
function requestTimeoutMs(request={},fallback=CLOUDFLARE_REQUEST_TIMEOUT_MS){
  const raw=Number(request?.config?.timeoutMs??request?.timeoutMs);
  return Number.isFinite(raw)&&raw>0?Math.max(15_000,Math.min(180_000,Math.floor(raw))):fallback;
}
async function fetchJsonWithTimeout(url,options={},timeoutMs=CLOUDFLARE_REQUEST_TIMEOUT_MS,{code='SERVER_AI_REQUEST_TIMEOUT',label='Server AI request'}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{...options,signal:controller.signal});
    const body=await response.json().catch(()=>({}));
    return{response,body};
  }catch(error){
    if(error?.name==='AbortError'){
      const timeout=new Error(`${label} did not respond within ${Math.ceil(timeoutMs/1000)} seconds.`);
      timeout.code=code;timeout.timeoutMs=timeoutMs;throw timeout;
    }
    throw error;
  }finally{clearTimeout(timer)}
}
function storageObject(storage,key){try{const value=parse(storage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}}
function guildTelemetryRows(){return storageObject(sessionStorage,GUILD_TELEMETRY_KEY)}
function saveGuildTelemetryRows(value){try{sessionStorage.setItem(GUILD_TELEMETRY_KEY,JSON.stringify(value));return true}catch{return false}}
function guildTelemetry(selector=''){
  const rows=guildTelemetryRows(),wanted=clean(selector,180),state=mobileGuildState(),keys=[wanted,clean(state?.guildId,180),...(Array.isArray(state?.cloudFabric?.starterNodes)?state.cloudFabric.starterNodes.map(item=>clean(item?.nodeId,180)):[])].filter(Boolean);
  for(const key of keys)if(rows[key])return clone(rows[key]);
  return clone(Object.values(rows)[0]||null);
}
function recordGuildUsage(session,body={}){
  if(!session?.nodeId)return null;
  const rows=guildTelemetryRows(),guildId=clean(session.guildId,180),nodeId=clean(session.nodeId,180),key=guildId||nodeId,prior=rows[key]||rows[nodeId]||{};
  const charged=finite(body?.usage?.chargedNeurons)??0,remaining=finite(body?.quota?.includedRemainingNeurons)??finite(body?.usage?.remainingNeurons)??finite(prior.remainingNeurons),priorAverage=Number(prior.averageNeuronsPerTurn)||DEFAULT_NEURONS_PER_CHAT,turns=Math.max(0,Number(prior.measuredTurns)||0),average=charged>0?(turns?priorAverage*.65+charged*.35:charged):priorAverage;
  let approximateTurnsLeft=finite(body?.usage?.approximateTurnsLeft);if(approximateTurnsLeft===null&&remaining!==null)approximateTurnsLeft=Math.max(0,Math.floor(remaining/Math.max(1,average)));
  const telemetry={schema:'civweave.guild-ai-telemetry.v1',guildId:guildId||null,nodeId,source:clean(session.source,100)||'guild-owned-cloudflare',chargedNeurons:charged,remainingNeurons:remaining,averageNeuronsPerTurn:Number(average.toFixed(2)),measuredTurns:turns+(charged>0?1:0),approximateTurnsLeft,updatedAt:now()};
  rows[key]=telemetry;rows[nodeId]=telemetry;saveGuildTelemetryRows(rows);
  const detail=clone(telemetry);try{dispatchEvent(new CustomEvent('civweave:ai-neuron-usage',{detail}))}catch{}try{dispatchEvent(new CustomEvent('civweave:guild-ai-telemetry',{detail}))}catch{}return detail;
}
function selectedRoute(request={}){
  const explicit=clean(request?.config?.provider||request?.config?.route,80).toLowerCase();
  if(explicit)return explicit;
  try{
    const profile=runtime()?.readSharedConfig?.(request.executionProfile||'interactive')||runtime()?.readSharedConfig?.('interactive')||{};
    return clean(profile.provider||profile.route,80).toLowerCase();
  }catch{return''}
}
function routeMode(request={}){const route=selectedRoute(request);if(route===ROUTE)return ROUTE;if(WORKERS_AI_ROUTES.has(route))return'cloudflare-workers-ai';return''}
function isServerAuto(request={}){return routeMode(request)===ROUTE}
function isDirectWorkersAI(request={}){return routeMode(request)==='cloudflare-workers-ai'}
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
    maxTokens:Math.max(32,Math.min(MAX_GENERATION_TOKENS,Number(request?.config?.maxTokens||request.maxTokens||1024)||1024)),
    temperature:Math.max(0,Math.min(2,Number(request?.config?.temperature??request.temperature??0.2))),
    purpose:clean(request.purpose,160)||'interactive',
    executionProfile:clean(request.executionProfile,40)||'interactive'
  };
}
function workersAiModel(request={}){
  const candidates=[request?.config?.workersAiModel,request?.config?.cloudflareModel,request?.config?.model,request?.workersAiModel,request?.cloudflareModel,request?.model];
  for(const candidate of candidates){const value=clean(candidate,220);if(/^@(cf|hf)\//i.test(value))return value}
  return DEFAULT_WORKERS_AI_MODEL;
}
function workersAiPayload(request={}){
  const payload=requestPayload(request),messages=[...(payload.messages||[])];
  if(payload.system&&!messages.some(item=>item.role==='system'))messages.unshift({role:'system',content:payload.system});
  return{...payload,messages,model:workersAiModel(request)};
}
function textFromOutput(value){
  if(typeof value==='string')return value;
  if(value==null)return'';
  if(typeof value?.text==='string')return value.text;
  if(typeof value?.outputText==='string')return value.outputText;
  if(typeof value?.response==='string')return value.response;
  if(typeof value?.result?.response==='string')return value.result.response;
  try{return JSON.stringify(value)}catch{return String(value)}
}
function eventProvider(request={},fallback=''){
  const mode=routeMode(request);
  return clean(fallback,120)||(mode==='cloudflare-workers-ai'?'cloudflare-workers-ai':mode||selectedRoute(request)||ROUTE);
}
function modelEvent(request,phase,detail={}){
  const event={
    schema:'civweave-model-event-1.0',
    requestId:clean(request?.requestId,180),
    phase:clean(phase,80),
    provider:eventProvider(request,detail.provider),
    model:clean(detail.model,220)||(isDirectWorkersAI(request)?workersAiModel(request):clean(request?.config?.model,220)),
    purpose:clean(request?.purpose,220)||'interactive',
    executionProfile:clean(request?.executionProfile,40)||'interactive',
    at:now(),
    ...detail
  };
  try{request?.onEvent?.(event)}catch{}
  try{dispatchEvent(new CustomEvent('civweave:model-event',{detail:event}))}catch{}
  return event;
}
function resultFor(request,{provider,model,text,outputJson=null,usage={},diagnostics=[],routeTrace=[]}={}){
  const started=request.__serverAutoStartedAt||Date.now(),guildOnly=request.guildOnly===true,directWorkers=isDirectWorkersAI(request),requestedProvider=guildOnly?'guild-server-local':directWorkers?'cloudflare-workers-ai':ROUTE,requestedModel=guildOnly?'civweave-guild-auto':directWorkers?workersAiModel(request):'civweave-server-auto';
  return{
    schema:'civweave-model-result-1.0',
    requestId:clean(request.requestId,180)||`server-auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
    purpose:clean(request.purpose,160)||'interactive',
    status:'success',
    requested:{provider:requestedProvider,model:requestedModel,endpoint:'',executionProfile:clean(request.executionProfile,40)||'interactive'},
    actual:{provider,model:model||provider},
    outputText:text||'',
    outputJson,
    usage:{inputTokens:Number(usage.inputTokens??usage.prompt_tokens??usage.input_tokens??0)||0,outputTokens:Number(usage.outputTokens??usage.completion_tokens??usage.output_tokens??0)||0,totalTokens:Number(usage.totalTokens??usage.total_tokens??0)||0,costCents:Number(usage.costCents||0)||0,remainingCents:Number(usage.remainingCents||0)||0,chargedNeurons:Number(usage.chargedNeurons||0)||0,remainingNeurons:usage.remainingNeurons!=null&&Number.isFinite(Number(usage.remainingNeurons))?Math.max(0,Math.floor(Number(usage.remainingNeurons))):null,approximateTurnsLeft:usage.approximateTurnsLeft!=null&&Number.isFinite(Number(usage.approximateTurnsLeft))?Math.max(0,Math.floor(Number(usage.approximateTurnsLeft))):null},
    timing:{startedAt:new Date(started).toISOString(),completedAt:now(),elapsedMs:Math.max(0,Date.now()-started)},
    events:[],
    diagnostics:[{code:guildOnly?'GUILD_AI_ORDER':directWorkers?'DIRECT_WORKERS_AI_ROUTE':'SERVER_AUTO_ORDER',message:guildOnly?'Explicit Guild processing uses the paired server-local model only.':directWorkers?'The selected Cloudflare Workers AI route goes directly to Guild-owned or host-capacity Workers AI.':'Server-side AI preference is device local → paired server-local → Guild-owned Cloudflare → other Cloudflare capacity.'},...diagnostics,{code:'SERVER_AUTO_TRACE',message:routeTrace.map(item=>`${item.route}:${item.status}`).join(' → '),routeTrace}],
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
    }catch(error){lastError=error;trace.push({route:'server-local',status:'failed',nodeId:selection.nodeId,serviceId:selection.serviceId,code:clean(error?.code,160)||null,reason:clean(error?.message||error,500)})}
  }
  if(lastError)dispatchEvent(new CustomEvent('civweave:server-ai-route-failed',{detail:{route:'server-local',message:clean(lastError.message,800),code:clean(lastError?.code,160)||null,at:now()}}));
  return null;
}
function mobileGuildState(){
  let state=null;try{state=parse(localStorage.getItem(MOBILE_GUILD_STATE_KEY),null)}catch{}
  return state&&typeof state==='object'&&!Array.isArray(state)?state:null;
}
function readyGuildNode(fabric){
  if(!fabric||typeof fabric!=='object'||fabric.status!=='ready'||fabric.aiEnabled===false||!Array.isArray(fabric.starterNodes)||!fabric.starterNodes.length)return null;
  return fabric.starterNodes.find(item=>item?.nodeId&&item?.publicOrigin&&clean(item.runtime,80).toLowerCase()==='cloudflare-workers-ai')||fabric.starterNodes.find(item=>item?.nodeId&&item?.publicOrigin)||null;
}
function refreshMobileGuildFabric(state){
  if(mobileGuildRefreshPromise||!state?.primaryOrigin)return mobileGuildRefreshPromise;
  let origin='';try{origin=new URL(clean(state.primaryOrigin,4000),location.href).origin}catch{return null}
  mobileGuildRefreshPromise=fetch(`${origin}/api/guild/status`,{method:'GET',headers:{accept:'application/json'},cache:'no-store'})
    .then(async response=>{if(!response.ok)throw new Error(`Guild status returned HTTP ${response.status}.`);return response.json()})
    .then(status=>{
      const current=mobileGuildState();
      if(!current||status?.claimed!==true||!status?.infrastructure||clean(status.guildId,180)!==clean(current.guildId,180))return null;
      const next={...current,cloudAttached:true,primaryOrigin:origin,primaryGateway:origin,cloudStage:'online',cloudFabric:status.infrastructure};
      localStorage.setItem(MOBILE_GUILD_STATE_KEY,JSON.stringify(next));
      try{dispatchEvent(new CustomEvent('civweave:mobile-guild-fabric-refreshed',{detail:{guildId:clean(next.guildId,180),origin,at:now()}}))}catch{}
      return next;
    })
    .catch(()=>null)
    .finally(()=>{mobileGuildRefreshPromise=null});
  return mobileGuildRefreshPromise;
}
function mobileGuildCapacitySession(){
  const state=mobileGuildState();
  if(!state?.cloudAttached||!state?.primaryOrigin||!state?.membershipKey)return null;
  const membershipKey=clean(state.membershipKey,500),guildId=clean(state.guildId,180);
  if(!membershipKey||!guildId)return null;
  let origin='';try{origin=new URL(clean(state.primaryOrigin,4000),location.href).origin}catch{return null}
  const fabric=state.cloudFabric&&typeof state.cloudFabric==='object'?state.cloudFabric:null;
  let node=readyGuildNode(fabric),source='mobile-guild-owned-cloud';
  if(!node){
    refreshMobileGuildFabric(state);
    const explicitUnavailable=fabric&&(fabric.status==='pending'||fabric.status==='unavailable'||fabric.aiEnabled===false);
    if(explicitUnavailable)return null;
    const nodeId=`${guildId}-a`;
    node={nodeId,publicOrigin:`${origin}/nodes/${encodeURIComponent(nodeId)}`,runtime:'cloudflare-workers-ai'};
    source='mobile-guild-owned-cloud-derived';
  }
  try{
    const nodeBase=`${clean(node.publicOrigin,4000).replace(/\/+$/,'')}/`;
    const generateUrl=new URL('api/ai/node/generate',nodeBase).href;
    return{nodeId:clean(node.nodeId,180),token:membershipKey,origin,generateUrl,source,guildId};
  }catch{return null}
}
function isMobileGuildSession(session){return clean(session?.source,100).startsWith('mobile-guild-owned-cloud')}
function usableCapacitySession(){
  const owned=hostAccess()?.sessionFor?.();if(owned)return owned;
  const mobile=mobileGuildCapacitySession();if(mobile)return mobile;
  const all=capacitySessions(),preferred=clean(marketPrefs().preferredNodeId,180),rows=Object.values(all).filter(item=>item?.nodeId&&item?.token&&item?.origin&&(!item.expiresAt||Date.parse(item.expiresAt)>Date.now()));
  return rows.find(item=>item.nodeId===preferred)||rows[0]||null;
}
async function cloudflare(request,trace){
  const session=usableCapacitySession();
  if(!session){trace.push({route:'cloudflare-workers-ai',status:'skipped',reason:'no active Guild-owned or host-capacity session'});return null}
  const endpointUrl=session.generateUrl?new URL(session.generateUrl):new URL('/api/ai/node/generate',session.origin);
  if(!session.generateUrl)endpointUrl.searchParams.set('nodeId',session.nodeId);
  const payload=workersAiPayload(request);
  const headers={'content-type':'application/json','authorization':`Bearer ${session.token}`};
  if(!session.generateUrl)headers['x-civweave-node-id']=session.nodeId;
  let response,body;
  try{
    ({response,body}=await fetchJsonWithTimeout(endpointUrl,{method:'POST',headers,body:JSON.stringify({...payload,allowLifetimeCredits:request.allowLifetimeCredits===true||request?.config?.allowLifetimeCredits===true})},requestTimeoutMs(request),{code:'SERVER_AI_CLOUDFLARE_TIMEOUT',label:'Cloudflare Workers AI'}));
  }catch(error){
    trace.push({route:'cloudflare-workers-ai',status:'failed',nodeId:session.nodeId,source:session.source||'capacity-session',model:payload.model,code:clean(error?.code,160)||null,reason:clean(error?.message||error,1000)});
    throw error;
  }
  if(!response.ok){
    const message=clean(body?.error||`Cloudflare Workers AI returned HTTP ${response.status}.`,1000);
    trace.push({route:'cloudflare-workers-ai',status:'failed',nodeId:session.nodeId,source:session.source||'capacity-session',model:payload.model,httpStatus:response.status,reason:message});
    const error=new Error(response.status===402?`${message} Open AI settings to add compute or choose a membership.`:message);error.status=response.status;throw error;
  }
  const nested=body?.result;
  const text=clean(body.text||textFromOutput(nested),5_000_000),outputJson=body.outputJson&&typeof body.outputJson==='object'?body.outputJson:null;
  if(!text&&!outputJson)throw new Error('Cloudflare Workers AI returned no output.');
  const guildOwned=isMobileGuildSession(session);
  const telemetry=guildOwned?recordGuildUsage(session,body):(hostAccess()?.recordUsage?.({nodeId:session.nodeId,chargedNeurons:Number(body?.usage?.chargedNeurons||0),quota:body.quota||null})||{});
  trace.push({route:'cloudflare-workers-ai',status:'success',nodeId:session.nodeId,source:session.source||'capacity-session',model:body.model||payload.model});
  return resultFor(request,{provider:'cloudflare-workers-ai',model:body.model||nested?.model||payload.model,text:text||JSON.stringify(outputJson),outputJson,usage:{...(body.usage||{}),chargedNeurons:Number(body?.usage?.chargedNeurons||0),remainingNeurons:telemetry.remainingNeurons,approximateTurnsLeft:telemetry.approximateTurnsLeft},diagnostics:[{code:guildOwned?'GUILD_OWNED_CLOUDFLARE':'CLOUDFLARE_CAPACITY',message:guildOwned?`Used this device's paired mobile Guild Cloudflare node ${session.nodeId}.`:`Used capacity-backed Workers AI through ${session.nodeId}; lifetime credits are never spent unless explicitly allowed.`}],routeTrace:trace});
}
async function handle(request={}){
  const mode=routeMode(request);if(!mode)return null;
  const guildOnly=request.guildOnly===true,directWorkers=mode==='cloudflare-workers-ai'&&!guildOnly,requestId=clean(request.requestId,180)||`server-auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,next={...request,requestId,__serverAutoStartedAt:Date.now()},trace=guildOnly?[]:directWorkers?[]:[{route:'device-local',status:'skipped-or-failed-over',reason:'downloaded-local middleware gets first priority when available'}];
  modelEvent(next,'generating',{provider:directWorkers?'cloudflare-workers-ai':ROUTE,model:directWorkers?workersAiModel(next):clean(next?.config?.model,220)||'civweave-server-auto'});
  try{
    if(!directWorkers){
      let node=null;
      try{node=await serverLocal(next,trace)}catch(error){
        trace.push({route:'server-local',status:'failed',code:clean(error?.code,160)||null,reason:clean(error?.message||error,500)});
        try{dispatchEvent(new CustomEvent('civweave:server-ai-route-failed',{detail:{route:'server-local',message:clean(error?.message||error,800),code:clean(error?.code,160)||null,at:now()}}))}catch{}
      }
      if(node){modelEvent(next,'completed',{provider:node.actual?.provider,model:node.actual?.model,status:node.status,usage:node.usage});return{handled:true,result:node}}
      if(guildOnly){
        const error=new Error('No paired Guild server-local AI service is available for this request. Connect to a Guild AI service and try again.');
        error.code='GUILD_AI_UNAVAILABLE';error.routeTrace=trace;throw error;
      }
    }
    try{
      const edge=await cloudflare(next,trace);
      if(edge){modelEvent(next,'completed',{provider:edge.actual?.provider,model:edge.actual?.model,status:edge.status,usage:edge.usage});return{handled:true,result:edge}}
    }catch(error){
      dispatchEvent(new CustomEvent('civweave:server-ai-route-failed',{detail:{route:'cloudflare-workers-ai',message:clean(error?.message||error,800),status:error?.status||null,code:clean(error?.code,160)||null,at:now()}}));
      throw Object.assign(error,{code:error.code||'SERVER_AI_CLOUDFLARE_FAILED',routeTrace:trace});
    }
    const error=new Error(directWorkers?'Cloudflare Workers AI is selected, but this device has no usable Guild-owned or host-capacity Cloudflare session. Pair or join a Cloudflare-backed Guild and try again.':'Server-side AI could not find a usable paired self-hosted model, paired mobile Guild Cloudflare node, or other Cloudflare capacity session. Pair a Guild host or join a Cloudflare-backed Guild, then try again.');
    error.code=directWorkers?'WORKERS_AI_CAPACITY_UNAVAILABLE':'SERVER_AI_EXHAUSTED';error.routeTrace=trace;throw error;
  }catch(error){
    modelEvent(next,'failed',{provider:directWorkers?'cloudflare-workers-ai':eventProvider(next),model:directWorkers?workersAiModel(next):clean(next?.config?.model,220),status:'provider-error',error:{code:clean(error?.code,160)||'SERVER_AI_ERROR',message:clean(error?.message||error,1200)}});
    throw error;
  }
}
function register(){
  const s=spine();if(!s?.register)return false;
  s.register(MIDDLEWARE_ID,{handle},60);registered=true;
  try{dispatchEvent(new CustomEvent('civweave:server-ai-router-ready',{detail:{version:VERSION,middleware:MIDDLEWARE_ID,priority:60,acceptedRoutes:[ROUTE,...WORKERS_AI_ROUTES],order:['device-local','server-local','guild-owned-cloudflare','cloudflare-workers-ai'],directWorkersAi:true,guildOnly:true,defaultWorkersAiModel:DEFAULT_WORKERS_AI_MODEL,cloudflareRequestTimeoutMs:CLOUDFLARE_REQUEST_TIMEOUT_MS,at:now()}}))}catch{}
  return true;
}
function status(){const mobile=mobileGuildCapacitySession(),telemetry=guildTelemetry(mobile?.guildId||mobile?.nodeId||'');return{version:VERSION,registered,selectedRoute:selectedRoute({}),routeMode:routeMode({}),acceptedRoutes:[ROUTE,...WORKERS_AI_ROUTES],directWorkersAi:true,marketSessions:Object.keys(marketSessions()).length,capacitySessions:Object.keys(capacitySessions()).length,mobileGuildCapacity:Boolean(mobile),mobileGuildCapacitySource:mobile?.source||null,guildTelemetry:telemetry,defaultWorkersAiModel:DEFAULT_WORKERS_AI_MODEL,cloudflareRequestTimeoutMs:CLOUDFLARE_REQUEST_TIMEOUT_MS,order:['device-local','server-local','guild-owned-cloudflare','cloudflare-workers-ai'],guildOnly:true}}
addEventListener('civweave:runtime-spine-ready',register);addEventListener('civweave:model-runtime-ready',register);addEventListener('civweave:local-model-bridge-installed',register);addEventListener('civweave:mobile-guild-attached',register);addEventListener('civweave:mobile-guild-fabric-refreshed',register);addEventListener('pageshow',register);register();
globalThis.CivweaveServerAIRouterV301=Object.freeze({version:VERSION,route:ROUTE,workersAiRoutes:Object.freeze([...WORKERS_AI_ROUTES]),register,status,selectedRoute,routeMode,isServerAuto,isDirectWorkersAI,handle,mobileGuildCapacitySession,guildTelemetry,workersAiModel,modelEvent,defaultWorkersAiModel:DEFAULT_WORKERS_AI_MODEL,cloudflareRequestTimeoutMs:CLOUDFLARE_REQUEST_TIMEOUT_MS,order:Object.freeze(['device-local','server-local','guild-owned-cloudflare','cloudflare-workers-ai']),directWorkersAi:true,guildOnly:true});
})();