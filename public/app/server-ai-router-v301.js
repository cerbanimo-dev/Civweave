(()=>{
'use strict';
const VERSION='1.0.134-server-ai-router-v303-public-capacity';
const MIDDLEWARE_ID='server-auto-v301';
const MARKET_SESSION_KEY='civweave.node-ai-marketplace.sessions.v1';
const CAPACITY_SESSION_KEY='civweave.host-capacity.sessions.v1';
const MARKET_PREF_KEY='civweave.node-ai-marketplace.preferences.v1';
const PUBLIC_FABRIC_ORIGIN='https://civweave-node-cloud.cerbanimo.workers.dev';
const PUBLIC_CAPACITY_NODE_ID='civweave-cloud';
const ROUTE='server-auto';
if(globalThis.CivweaveServerAIRouterV301?.version===VERSION)return;
let registered=false,capacityJoinPromise=null;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>value==null?value:structuredClone(value);
const now=()=>new Date().toISOString();
const runtime=()=>globalThis.CivweaveModelRuntime||null;
const spine=()=>globalThis.CivweaveFastInteractiveV192||null;
const mesh=()=>globalThis.CivweaveNodeAIMeshV1||null;
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
  const inferred=globalThis.CivweaveAICapabilityBrokerV268?.requirements?.(request)||{};
  return{
    messages,
    system:clean(request.system,48000)||undefined,
    prompt:clean(request.prompt,48000)||undefined,
    responseFormat:request.responseFormat||((request.schema||request.responseSchema)?'json':'text'),
    responseSchema:clone(request.schema||request.responseSchema||null),
    maxTokens:Math.max(32,Math.min(4096,Number(request?.config?.maxTokens||request.maxTokens||1024)||1024)),
    temperature:Math.max(0,Math.min(2,Number(request?.config?.temperature??request.temperature??0.2))),
    purpose:clean(request.purpose,160)||'interactive',
    executionProfile:clean(request.executionProfile,40)||'interactive',
    task:clone(request.task&&typeof request.task==='object'?request.task:null),
    taskText:clean(request.taskText||request.context?.userMessage,12000)||undefined,
    capabilityRequirements:clone(request.capabilityRequirements&&typeof request.capabilityRequirements==='object'?request.capabilityRequirements:inferred)
  };
}
function codeTierRequested(payload={}){
  const requirements=payload.capabilityRequirements||{},kind=clean(payload.task?.kind,80).toLowerCase(),text=clean(payload.task?.text||payload.taskText||payload.prompt,12000).toLowerCase();
  return requirements.code===true||kind==='code-project'||/\b(code|software|debug|refactor|patch|program|script|typescript|javascript|python|react|sql|api|database|compiler|repository|pull request)\b/.test(text);
}
function kimiApproval(payload={}){
  if(!codeTierRequested(payload))return Promise.resolve('not-needed');
  if(!globalThis.document?.body)return Promise.resolve('smart');
  const old=document.getElementById('cw-kimi-approval-v1');if(old)old.remove();
  return new Promise(resolve=>{
    const wrap=document.createElement('div');wrap.id='cw-kimi-approval-v1';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-labelledby','cw-kimi-title-v1');
    wrap.innerHTML=`<style>#cw-kimi-approval-v1{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:18px;background:rgba(5,7,12,.82);backdrop-filter:blur(8px);font:16px/1.45 system-ui,sans-serif;color:#f7f3ff}#cw-kimi-approval-v1>section{width:min(560px,100%);box-sizing:border-box;padding:24px;border:1px solid rgba(255,88,177,.65);border-radius:22px;background:#15101d;box-shadow:0 24px 90px #000}#cw-kimi-approval-v1 h2{margin:0 0 10px;font-size:1.35rem}#cw-kimi-approval-v1 p{margin:8px 0;color:#ddd3e8}#cw-kimi-approval-v1 strong{color:#ff9bcc}#cw-kimi-approval-v1 .cw-kimi-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:22px}#cw-kimi-approval-v1 button{min-height:46px;padding:0 16px;border:1px solid #8d789e;border-radius:13px;background:#241b2e;color:#fff;font:inherit;font-weight:750}#cw-kimi-approval-v1 [data-kimi-approve]{border-color:#ff58b1;background:#b31c69}</style><section><h2 id="cw-kimi-title-v1">Approve Code-tier AI?</h2><p>This task would call <strong>Kimi K2.7 Code</strong>, the specialist route for implementation, debugging, repo-scale edits, and long software-agent loops.</p><p>Its listed price is <strong>$0.95 per 1M input tokens and $4.00 per 1M output tokens</strong>. Approval applies to this request only. Your current Cloudflare host plan may not include this paid-only model.</p><div class="cw-kimi-actions"><button type="button" data-kimi-smart>Use Smart instead</button><button type="button" data-kimi-approve>Approve Kimi once</button></div></section>`;
    const finish=choice=>{wrap.remove();resolve(choice)};
    wrap.querySelector('[data-kimi-smart]').addEventListener('click',()=>finish('smart'),{once:true});
    wrap.querySelector('[data-kimi-approve]').addEventListener('click',()=>finish('approve'),{once:true});
    wrap.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();finish('smart')}});
    document.body.append(wrap);wrap.querySelector('[data-kimi-smart]').focus();
  });
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
  const started=request.__serverAutoStartedAt||Date.now();
  return{
    schema:'civweave-model-result-1.0',
    requestId:clean(request.requestId,180)||`server-auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
    purpose:clean(request.purpose,160)||'interactive',
    status:'success',
    requested:{provider:ROUTE,model:'civweave-server-auto',endpoint:'',executionProfile:clean(request.executionProfile,40)||'interactive'},
    actual:{provider,model:model||provider},
    outputText:text||'',
    outputJson,
    usage:{inputTokens:Number(usage.inputTokens??usage.prompt_tokens??usage.input_tokens??0)||0,outputTokens:Number(usage.outputTokens??usage.completion_tokens??usage.output_tokens??0)||0,totalTokens:Number(usage.totalTokens??usage.total_tokens??0)||0,costCents:Number(usage.costCents||0)||0,remainingCents:Number(usage.remainingCents||0)||0,chargedNeurons:Number(usage.chargedNeurons||0)||0},
    timing:{startedAt:new Date(started).toISOString(),completedAt:now(),elapsedMs:Math.max(0,Date.now()-started)},
    events:[],
    diagnostics:[{code:'SERVER_AUTO_ORDER',message:'Server-side AI preference is device local → paired server-local → Cloudflare Workers AI.'},...diagnostics,{code:'SERVER_AUTO_TRACE',message:routeTrace.map(item=>`${item.route}:${item.status}`).join(' → '),routeTrace}],
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
  const all=capacitySessions(),preferred=clean(marketPrefs().preferredNodeId,180),rows=Object.values(all).filter(item=>item?.nodeId&&item?.token&&item?.origin&&(!item.expiresAt||Date.parse(item.expiresAt)>Date.now()));
  return rows.find(item=>item.nodeId===preferred)||rows[0]||null;
}
function persistCapacitySession(session){
  const next={...capacitySessions(),[session.nodeId]:session};
  sessionStorage.setItem(CAPACITY_SESSION_KEY,JSON.stringify(next));
  try{dispatchEvent(new CustomEvent('civweave:capacity-session-ready',{detail:{nodeId:session.nodeId,origin:session.origin,expiresAt:session.expiresAt||null,at:now()}}))}catch{}
  return session;
}
async function joinPublicCapacity(){
  const response=await fetch(`${PUBLIC_FABRIC_ORIGIN}/api/fabric/capacity/members/admit`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'public-community'})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(clean(body?.error||`Cloudflare community capacity returned HTTP ${response.status}.`,1000)),{status:response.status});
  const session=body?.capacitySession;
  if(!session?.token||session.nodeId!==PUBLIC_CAPACITY_NODE_ID||!session.origin)throw new Error('Cloudflare community capacity returned an invalid session.');
  let origin;try{origin=new URL(session.origin).origin}catch{throw new Error('Cloudflare community capacity returned an invalid origin.')}
  if(origin!==PUBLIC_FABRIC_ORIGIN)throw new Error('Cloudflare community capacity returned an unexpected origin.');
  return persistCapacitySession({...session,origin});
}
async function ensureCapacitySession(){
  const active=usableCapacitySession();if(active)return active;
  if(!capacityJoinPromise)capacityJoinPromise=joinPublicCapacity().finally(()=>{capacityJoinPromise=null});
  return capacityJoinPromise;
}
async function cloudflare(request,trace){
  let session;
  try{session=await ensureCapacitySession()}catch(error){trace.push({route:'cloudflare-workers-ai',status:'failed',reason:clean(error?.message||error,500)});throw error}
  const endpointUrl=new URL('/api/ai/node/generate',session.origin);
  let payload=requestPayload(request);
  const send=body=>fetch(endpointUrl,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${session.token}`,'x-civweave-node-id':session.nodeId},body:JSON.stringify({...body,allowLifetimeCredits:request.allowLifetimeCredits===true||request?.config?.allowLifetimeCredits===true})});
  let response=await send(payload),body=await response.json().catch(()=>({}));
  if(response.status===428&&body?.code==='KIMI_APPROVAL_REQUIRED'){
    const codeChoice=await kimiApproval(payload);
    if(codeChoice==='approve')payload={...payload,modelApproval:{approved:true,scope:'single-request',model:'@cf/moonshotai/kimi-k2.7-code',warningShown:true}};
    else payload={...payload,modelTierCeiling:'smart',modelApproval:{approved:false,scope:'single-request',model:'@cf/moonshotai/kimi-k2.7-code',warningShown:true}};
    response=await send(payload);body=await response.json().catch(()=>({}));
  }
  if(!response.ok){
    const message=clean(body?.error||`Cloudflare Workers AI returned HTTP ${response.status}.`,1000);
    trace.push({route:'cloudflare-workers-ai',status:'failed',nodeId:session.nodeId,httpStatus:response.status,reason:message});
    const error=new Error(response.status===402?`${message} Open AI settings to add compute or choose a membership.`:message);error.status=response.status;throw error;
  }
  const text=clean(body.text,5_000_000),outputJson=body.outputJson&&typeof body.outputJson==='object'?body.outputJson:null;
  if(!text&&!outputJson)throw new Error('Cloudflare Workers AI returned no output.');
  trace.push({route:'cloudflare-workers-ai',status:'success',nodeId:session.nodeId});
  return resultFor(request,{provider:'cloudflare-workers-ai',model:body.model||'workers-ai',text:text||JSON.stringify(outputJson),outputJson,usage:{...(body.usage||{}),chargedNeurons:Number(body?.usage?.chargedNeurons||0)},diagnostics:[{code:'CLOUDFLARE_CAPACITY',message:`Used capacity-backed Workers AI through ${session.nodeId}; lifetime credits are never spent unless explicitly allowed.`}],routeTrace:trace});
}
async function handle(request={}){
  if(!isServerAuto(request))return null;
  const next={...request,__serverAutoStartedAt:Date.now()},trace=[{route:'device-local',status:'skipped-or-failed-over',reason:'downloaded-local middleware gets first priority when available'}];
  const node=await serverLocal(next,trace);if(node)return{handled:true,result:node};
  try{const edge=await cloudflare(next,trace);if(edge)return{handled:true,result:edge}}catch(error){
    dispatchEvent(new CustomEvent('civweave:server-ai-route-failed',{detail:{route:'cloudflare-workers-ai',message:clean(error?.message||error,800),status:error?.status||null,at:now()}}));
    throw Object.assign(error,{code:error.code||'SERVER_AI_CLOUDFLARE_FAILED',routeTrace:trace});
  }
  const error=new Error('Server-side AI could not find a usable paired self-hosted model or Cloudflare capacity session. Pair a host or join a Cloudflare host, then try again.');
  error.code='SERVER_AI_EXHAUSTED';error.routeTrace=trace;throw error;
}
function register(){
  const s=spine();if(!s?.register)return false;
  s.register(MIDDLEWARE_ID,{handle},60);registered=true;
  try{dispatchEvent(new CustomEvent('civweave:server-ai-router-ready',{detail:{version:VERSION,middleware:MIDDLEWARE_ID,priority:60,order:['device-local','server-local','cloudflare-workers-ai'],at:now()}}))}catch{}
  return true;
}
function status(){return{version:VERSION,registered,selectedRoute:selectedRoute({}),marketSessions:Object.keys(marketSessions()).length,capacitySessions:Object.keys(capacitySessions()).length,order:['device-local','server-local','cloudflare-workers-ai']}}
addEventListener('civweave:runtime-spine-ready',register);addEventListener('civweave:model-runtime-ready',register);addEventListener('civweave:local-model-bridge-installed',register);addEventListener('pageshow',register);register();
globalThis.CivweaveServerAIRouterV301=Object.freeze({version:VERSION,route:ROUTE,register,status,isServerAuto,requestPayload,ensureCapacitySession,handle,order:Object.freeze(['device-local','server-local','cloudflare-workers-ai'])});
})();
