(()=>{
'use strict';
if(globalThis.CivweavePeerLocalPlanBorrowV1)return;
const VERSION='1.0.0-peer-local-plan-borrow-v1';
const CAPABILITY_KIND='civweave.peer-ai.capability-advert.v1';
const REQUEST_KIND='civweave.peer-ai.plan-request.v1';
const RESULT_KIND='civweave.peer-ai.plan-result.v1';
const CAPABILITY_SCHEMA='civweave.peer-ai.capability.v1';
const REQUEST_SCHEMA='civweave.peer-ai.plan-request.v1';
const RESULT_SCHEMA='civweave.peer-ai.plan-result.v1';
const RELAY_STATE_KEY='civweave.peer-ai.direct-relay.v1';
const DEFAULT_SYNC_MS=90_000;
const GUIDES=new Set(['weaveling','kamiya','rook','merlin','moss']);
const MAX_PROMPT_CHARS=48_000;
const MAX_SCHEMA_CHARS=24_000;
const MAX_RESULT_CHARS=500_000;
const CAPABILITY_TTL_MS=15*60_000;
const REQUEST_TTL_MS=24*60*60_000;
const RESULT_TTL_MS=7*24*60*60_000;
let timer=null,meshUnsubscribe=null,gatewayUrl=null,activeSyncMs=DEFAULT_SYNC_MS,processing=false;
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const clone=value=>value==null?value:structuredClone(value);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}:${crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const expires=ms=>new Date(Date.now()+ms).toISOString();
const mesh=()=>globalThis.CivweaveLocalMeshV146||null;
const broker=()=>globalThis.CivweaveAICapabilityBrokerV268||null;
const runtime=()=>globalThis.CivweaveModelRuntime||null;
const downloads=()=>globalThis.CivweaveLocalModelDownloadV266||null;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266||null;
const hostSession=()=>globalThis.CivweaveHostNodeSessionV1||null;
function relayState(){const value=parse(localStorage.getItem(RELAY_STATE_KEY),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function saveRelayState(value){try{localStorage.setItem(RELAY_STATE_KEY,JSON.stringify(value));return true}catch{return false}}
function requirements(request={}){
  const base=broker()?.requirements?.(request)||{};
  return{profile:base.profile||clean(request.executionProfile,40)||'interactive',structuredOutput:base.structuredOutput===true||Boolean(request.schema)||['json','structured'].includes(clean(request.responseFormat,40).toLowerCase()),planning:base.planning===true||request.capabilityRequirements?.planning===true,requiresTools:base.requiresTools===true,externalResearch:base.externalResearch===true,vision:base.vision===true};
}
function activeSpec(){const selected=downloads()?.selection?.();return selected?.active&&selected?.id?registry()?.byId?.(selected.id)||null:null}
function neuronState(){
  const session=hostSession()?.sessionFor?.();
  const telemetry=hostSession()?.telemetryFor?.(session?.nodeId||'')||session?.telemetry||null;
  const remaining=telemetry?.remainingNeurons;
  return{session:session?{nodeId:session.nodeId,origin:session.origin}:null,remainingNeurons:remaining==null?null:Math.max(0,Math.floor(Number(remaining)||0)),exhausted:remaining!=null?Number(remaining)<=0:!session};
}
function localSupport(request={}){
  const spec=activeSpec(),api=broker();
  if(!spec)return{ok:false,reason:'no active downloaded model',spec:null};
  if(api?.supportsLocalRequest){const result=api.supportsLocalRequest(spec,request);return{...result,spec}}
  const need=requirements(request);return{ok:Boolean(spec?.capabilities?.structuredOutput!==false&&(!need.planning||spec?.capabilities?.agenticReasoning===true||need.profile!=='agentic')),reason:'legacy local capability estimate',spec};
}
function shouldOffer(request={}){
  const need=requirements(request),local=localSupport(request),neurons=neuronState();
  const eligibleTask=need.structuredOutput&&need.planning&&!need.requiresTools&&!need.externalResearch&&!need.vision;
  const forced=request.forcePeerBorrow===true||request.peerBorrow===true;
  return{eligible:Boolean((forced||neurons.exhausted)&&eligibleTask&&!local.ok),forced,requirements:need,local,neurons,reason:!eligibleTask?'Only local structured planning work may be borrowed.':local.ok?'This device already has a capable downloaded model.':!(forced||neurons.exhausted)?'Neuron capacity is still available.':'A capable peer model may be requested.'};
}
async function createObject(input){const m=mesh();if(!m?.createObject)throw new Error('Civweave local object mesh is unavailable.');return m.createObject(input)}
async function deviceId(){const m=mesh();if(!m?.deviceId)throw new Error('Civweave local object mesh is unavailable.');return m.deviceId()}
function capableLocalAdvert(){
  const spec=activeSpec(),cap=spec?.capabilities||{};
  return Boolean(spec&&cap.structuredOutput!==false&&(cap.agenticReasoning===true||cap.planning===true||cap.interactive!==false));
}
async function advertise({available=true}={}){
  if(!capableLocalAdvert())return null;
  const id=await deviceId(),spec=activeSpec(),cap=spec?.capabilities||{};
  const payload={schema:CAPABILITY_SCHEMA,deviceId:id,available:available!==false,lendingPolicy:'ask-every-time',model:{id:clean(spec.id,180),label:clean(spec.label||spec.id,220),device:clean(spec.device,40),contextWindowTokens:Number(spec.contextWindowTokens||0),workingContextTokens:Number(spec.workingContextTokens||0)},capabilities:{structuredOutput:cap.structuredOutput!==false,planning:true,agenticReasoning:cap.agenticReasoning===true,interactive:cap.interactive!==false,tools:false,externalResearch:false,vision:Boolean(cap.vision)},updatedAt:now()};
  const objectId=`peer-ai-capability:${encodeURIComponent(id)}`;
  const prior=await mesh().getObject(objectId).catch(()=>null);
  return createObject({id:objectId,revision:Number(prior?.revision||0)+1,kind:CAPABILITY_KIND,purpose:'Advertise consent-gated spare local planning capability without exposing prompts.',consent:'federated',audience:[],payload,expiresAt:expires(CAPABILITY_TTL_MS),hopLimit:3,publish:true,parentIds:prior?.revisionHash?[prior.id]:[]});
}
async function listKind(kind){return(await mesh().listObjects()).filter(object=>object?.kind===kind&&(!object.expiresAt||Date.parse(object.expiresAt)>Date.now()))}
function connectedIds(){return new Set((mesh()?.status?.().sessions||[]).filter(row=>row.peerVerified&&row.state==='open').map(row=>row.peerId).filter(Boolean))}
async function discoverLenders(request={}){
  const self=await deviceId(),need=requirements(request),connected=connectedIds(),objects=await listKind(CAPABILITY_KIND),rows=[];
  for(const object of objects){const row=object?.payload;if(row?.schema!==CAPABILITY_SCHEMA||row.available===false||!row.deviceId||row.deviceId===self)continue;const cap=row.capabilities||{};if(need.structuredOutput&&cap.structuredOutput===false)continue;if(need.profile==='agentic'&&need.planning&&cap.agenticReasoning!==true)continue;if(need.requiresTools||need.externalResearch||need.vision)continue;rows.push({...clone(row),objectId:object.id,connectedNow:connected.has(row.deviceId)});}
  rows.sort((a,b)=>Number(b.connectedNow)-Number(a.connectedNow)||Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0));return rows;
}
function safeMessages(request={}){
  const rows=Array.isArray(request.messages)?request.messages:[];
  let budget=MAX_PROMPT_CHARS;const output=[];
  for(const item of rows){if(budget<=0)break;const content=clean(item?.content,budget);if(!content)continue;output.push({role:item?.role==='assistant'?'assistant':item?.role==='system'?'system':'user',content});budget-=content.length;}
  if(!output.length&&request.prompt)output.push({role:'user',content:clean(request.prompt,MAX_PROMPT_CHARS)});
  return output;
}
function safeSchema(schema){if(!schema||typeof schema!=='object')return null;const text=JSON.stringify(schema);if(text.length>MAX_SCHEMA_CHARS)throw new Error('Peer planning schema is too large to relay.');return clone(schema)}
function guideId(request={}){const raw=clean(request.guide||request.guideId||request.context?.guide||request.config?.service||'weaveling',80).toLowerCase();return GUIDES.has(raw)?raw:'weaveling'}
function promptDisclosure(request,lender){const chars=safeMessages(request).reduce((n,row)=>n+row.content.length,0);return `${lender?.model?.label||'A connected peer model'} can prepare this ${guideId(request)} plan locally. This shares about ${chars.toLocaleString()} characters of prompt/context with that peer. The peer must explicitly accept, and no neuron capacity will be charged to you. Ask this peer?`}
function confirmRequester(request,lender){if(request.peerConsent===true)return true;if(request.peerConsent===false)return false;return typeof confirm==='function'?confirm(promptDisclosure(request,lender)):false}
function lenderPrompt(requestObject){const p=requestObject?.payload||{},source=clean(p.requesterDeviceId||requestObject?.origin?.nodeId,180),guide=clean(p.guide,80),chars=(p.request?.messages||[]).reduce((n,row)=>n+String(row?.content||'').length,0);return `A connected peer (${source.slice(0,34)}) is asking to borrow your downloaded local model for a ${guide} structured plan (${chars.toLocaleString()} characters). The prompt is processed on this device and the result is returned to that peer. Lend local compute for this request?`}
function confirmLender(object,{consent}={}){if(consent===true)return true;if(consent===false)return false;return typeof confirm==='function'?confirm(lenderPrompt(object)):false}
async function requestPlan(request={},options={}){
  const eligibility=shouldOffer({...request,...(options.forcePeerBorrow?{forcePeerBorrow:true}:{})});if(!eligibility.eligible)throw Object.assign(new Error(eligibility.reason),{code:'PEER_BORROW_NOT_ELIGIBLE',eligibility});
  const lenders=await discoverLenders(request),wanted=clean(options.lenderDeviceId||request.lenderDeviceId,180),lender=wanted?lenders.find(row=>row.deviceId===wanted):lenders[0];if(!lender)throw Object.assign(new Error('No connected or recently advertised peer has a capable local model.'),{code:'PEER_BORROW_NO_LENDER'});
  if(!confirmRequester(request,lender))return{status:'cancelled',reason:'requester-declined',lender};
  const requesterDeviceId=await deviceId(),requestId=clean(request.requestId,180)||uid('peer-plan'),payload={schema:REQUEST_SCHEMA,requestId,requesterDeviceId,lenderDeviceId:lender.deviceId,guide:guideId(request),requestedAt:now(),requirements:requirements(request),request:{purpose:clean(request.purpose,180)||`${guideId(request)}-structured-plan`,executionProfile:clean(request.executionProfile,40)||'agentic',messages:safeMessages(request),responseFormat:'json',schema:safeSchema(request.schema),temperature:Number(request?.config?.temperature??request.temperature??.2),maxTokens:Math.max(128,Math.min(4096,Number(request?.config?.maxTokens||request.maxTokens||1536)||1536))},disclosure:{requesterConsented:true,lenderMustConsent:true,neuronChargeAllowed:false,consequentialAuthority:false}};
  const object=await createObject({id:`peer-plan-request:${requestId}`,kind:REQUEST_KIND,purpose:'Consent-gated borrowed local structured planning request.',consent:'direct',audience:[lender.deviceId],payload,expiresAt:expires(REQUEST_TTL_MS),hopLimit:1,publish:true,priority:95});
  await syncDirectGateway().catch(()=>{});
  try{dispatchEvent(new CustomEvent('civweave:peer-ai-plan-requested',{detail:{requestId,lenderDeviceId:lender.deviceId,guide:payload.guide,at:now()}}))}catch{}
  return{status:'queued',requestId,lender,object};
}
async function localGenerate(payload){
  const spec=activeSpec();if(!spec)throw Object.assign(new Error('No downloaded local model is active on the lending peer.'),{code:'PEER_LENDER_MODEL_MISSING'});
  const request={purpose:payload.request?.purpose||'peer-structured-plan',executionProfile:payload.request?.executionProfile||'agentic',messages:payload.request?.messages||[],responseFormat:'json',schema:payload.request?.schema||undefined,capabilityRequirements:{profile:payload.request?.executionProfile||'agentic',structuredOutput:true,planning:true,requiresTools:false,externalResearch:false},config:{provider:'downloaded-local',model:spec.id,stream:false,temperature:Number(payload.request?.temperature??.2),maxTokens:Number(payload.request?.maxTokens||1536)}};
  const support=broker()?.supportsLocalRequest?.(spec,request);if(support&&!support.ok)throw Object.assign(new Error(`This peer model cannot safely satisfy the request: ${support.reason}`),{code:'PEER_LENDER_CAPABILITY_MISMATCH'});
  const result=await runtime()?.generate?.(request);if(!result)throw new Error('Local model runtime returned no result.');if(result.status!=='success'||result.structured?.requested&&result.structured?.valid===false)throw Object.assign(new Error(result.error?.message||'The lending peer did not produce valid structured output.'),{code:result.error?.code||'PEER_LENDER_INVALID_RESULT',result});
  return{result,model:{id:spec.id,label:spec.label||spec.id,device:spec.device||'',provider:'downloaded-local'}};
}
async function publishResult(requestObject,status,data={}){
  const payload=requestObject?.payload||{},requestId=clean(payload.requestId,180);if(!requestId)throw new Error('Peer request has no requestId.');const lenderDeviceId=await deviceId(),target=clean(payload.requesterDeviceId,180);if(!target)throw new Error('Peer request has no requester device.');
  const resultPayload={schema:RESULT_SCHEMA,requestId,status,lenderDeviceId,requesterDeviceId:target,guide:clean(payload.guide,80),completedAt:now(),outputJson:data.outputJson??null,outputText:clean(data.outputText,MAX_RESULT_CHARS),model:data.model||null,error:data.error?{code:clean(data.error.code,120),message:clean(data.error.message,1600)}:null,provenance:{execution:'borrowed-downloaded-local',requesterNeuronCharge:0,lenderExplicitConsent:Boolean(data.lenderExplicitConsent),consequentialAuthority:false,sourceRequestObjectId:requestObject.id}};
  const object=await createObject({id:`peer-plan-result:${requestId}`,kind:RESULT_KIND,purpose:'Return borrowed local structured planning output to its requester.',consent:'direct',audience:[target],payload:resultPayload,expiresAt:expires(RESULT_TTL_MS),hopLimit:1,publish:true,priority:98});await syncDirectGateway().catch(()=>{});return object;
}
async function declineRequest(requestObject,reason='lender-declined'){return publishResult(requestObject,'declined',{lenderExplicitConsent:false,error:{code:'PEER_LENDER_DECLINED',message:reason}})}
async function acceptRequest(requestObject,options={}){
  if(requestObject?.kind!==REQUEST_KIND||requestObject?.payload?.schema!==REQUEST_SCHEMA)throw new TypeError('A peer plan request object is required.');const self=await deviceId();if(requestObject.payload.lenderDeviceId!==self)throw new Error('This request targets another lending peer.');if(!confirmLender(requestObject,options)){await declineRequest(requestObject);return{status:'declined'}}
  try{const generated=await localGenerate(requestObject.payload),object=await publishResult(requestObject,'success',{outputJson:generated.result.outputJson??null,outputText:generated.result.outputText||'',model:generated.model,lenderExplicitConsent:true});return{status:'success',result:generated.result,object}}catch(error){const object=await publishResult(requestObject,'failed',{lenderExplicitConsent:true,error:{code:error?.code||'PEER_LENDER_FAILED',message:error?.message||String(error)}});return{status:'failed',error,object}}
}
async function incomingRequests(){const self=await deviceId();return(await listKind(REQUEST_KIND)).filter(object=>object?.payload?.lenderDeviceId===self&&object?.payload?.schema===REQUEST_SCHEMA)}
async function incomingResults(){const self=await deviceId();return(await listKind(RESULT_KIND)).filter(object=>object?.payload?.requesterDeviceId===self&&object?.payload?.schema===RESULT_SCHEMA)}
function processedKey(id){return `processed:${id}`}
async function processIncoming(){
  if(processing)return{busy:true};processing=true;try{const state=relayState();let requests=0,results=0;
    for(const object of await incomingRequests()){if(state[processedKey(object.id)])continue;state[processedKey(object.id)]={at:now(),status:'prompted'};saveRelayState(state);requests++;await acceptRequest(object).catch(error=>console.warn('[Civweave peer borrow]',error));state[processedKey(object.id)]={at:now(),status:'handled'};saveRelayState(state)}
    for(const object of await incomingResults()){if(state[processedKey(object.id)])continue;state[processedKey(object.id)]={at:now(),status:'received'};saveRelayState(state);results++;const detail=clone(object.payload);try{dispatchEvent(new CustomEvent('civweave:peer-ai-result',{detail}))}catch{}if(detail.status==='success')notifyResult(detail)}
    return{requests,results};
  }finally{processing=false}
}
function notifyResult(detail){
  if(typeof document==='undefined'||!document.body)return;const old=document.getElementById('cw-peer-plan-result-v1');old?.remove?.();const panel=document.createElement('aside');panel.id='cw-peer-plan-result-v1';panel.setAttribute('role','status');panel.style.cssText='position:fixed;right:16px;bottom:88px;z-index:2147483200;max-width:min(460px,calc(100vw - 32px));max-height:55vh;overflow:auto;padding:14px 16px;border-radius:16px;background:#111827;color:#f8fafc;border:1px solid #94a3b866;box-shadow:0 18px 50px #0009;font:14px/1.45 system-ui,sans-serif';const title=document.createElement('strong');title.textContent=`${clean(detail.guide,40)||'Peer'} plan arrived`;const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close peer plan');close.style.cssText='float:right;background:transparent;color:inherit;border:0;font-size:22px;cursor:pointer';close.onclick=()=>panel.remove();const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.45 ui-monospace,monospace;margin:10px 0 0';pre.textContent=detail.outputJson?JSON.stringify(detail.outputJson,null,2):detail.outputText||'';panel.append(close,title,pre);document.body.append(panel);
}
function directRelayObject(object,self){return Boolean(object&&[REQUEST_KIND,RESULT_KIND].includes(object.kind)&&object.consent==='direct'&&object.audience?.length===1&&(object.origin?.nodeId===self||object.audience[0]===self))}
async function syncDirectGateway(baseUrl=gatewayUrl||location.origin){
  const m=mesh();if(!m?.listObjects)return{sent:0,received:0,unavailable:true};if(navigator.onLine===false)return{sent:0,received:0,offline:true};const base=new URL(baseUrl||location.origin,location.href),self=await deviceId(),state=relayState();let sent=0,received=0;
  for(const object of await m.listObjects()){
    if(!directRelayObject(object,self)||object.origin?.nodeId!==self||object.expiresAt&&Date.parse(object.expiresAt)<=Date.now())continue;const key=`sent:${object.id}:${object.revisionHash}`;if(state[key])continue;
    try{const response=await fetch(new URL('/api/envelopes',base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'civweave.community-object-envelope.v1',from:self,to:object.audience[0],kind:'community-object-direct',subject:object.kind,payload:object,correlationId:object.id})});if(!response.ok)throw new Error(`direct relay returned ${response.status}`);state[key]={at:now()};saveRelayState(state);sent++}catch(error){state[`error:${key}`]={at:now(),message:clean(error.message,500)};saveRelayState(state)}
  }
  try{const endpoint=new URL('/api/envelopes',base);endpoint.searchParams.set('nodeId',self);endpoint.searchParams.set('limit','200');const response=await fetch(endpoint,{cache:'no-store'});if(response.ok){const body=await response.json();for(const envelope of body.envelopes||[]){if(!envelope?.id||state[`envelope:${envelope.id}`]||!['community-object-direct','community-object'].includes(envelope.kind)||!envelope.payload)continue;const object=envelope.payload;if(!directRelayObject(object,self)||object.audience?.[0]!==self)continue;try{const result=await m.ingest(object,{fromPeer:envelope.from,localNodeId:self});state[`envelope:${envelope.id}`]={at:now(),status:result.status};saveRelayState(state);if(result.status==='accepted')received++;fetch(new URL(`/api/envelopes/${encodeURIComponent(envelope.id)}/ack`,base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nodeId:self})}).catch(()=>{})}catch(error){state[`envelope:${envelope.id}`]={at:now(),status:'rejected',message:clean(error.message,500)};saveRelayState(state)}}}}}catch{}
  if(received)await processIncoming();try{dispatchEvent(new CustomEvent('civweave:peer-ai-direct-sync',{detail:{base:base.origin,sent,received,at:now()}}))}catch{}return{sent,received};
}
async function tick(){await advertise().catch(()=>{});await syncDirectGateway().catch(()=>{});await processIncoming().catch(()=>{});return status()}
function schedule(){if(timer)clearTimeout(timer);timer=setTimeout(async()=>{await tick();schedule()},Math.round(activeSyncMs*(.85+Math.random()*.3)))}
async function start({baseUrl=location.origin,syncIntervalMs=DEFAULT_SYNC_MS}={}){stop();gatewayUrl=String(baseUrl||location.origin);activeSyncMs=Math.max(30_000,Math.min(15*60_000,Number(syncIntervalMs)||DEFAULT_SYNC_MS));const m=mesh();if(!m)throw new Error('Civweave local object mesh is unavailable.');meshUnsubscribe=m.subscribe(event=>{if(['object-received','gateway-sync','peer-open','peer-verified'].includes(event?.type)){queueMicrotask(()=>processIncoming().catch(()=>{}));if(['peer-open','peer-verified'].includes(event?.type))queueMicrotask(()=>advertise().catch(()=>{}))}});await tick();schedule();return status()}
function stop(){if(timer){clearTimeout(timer);timer=null}if(meshUnsubscribe){try{meshUnsubscribe()}catch{}meshUnsubscribe=null}return true}
function status(){return{version:VERSION,started:Boolean(timer),baseUrl:gatewayUrl||null,syncIntervalMs:activeSyncMs,capabilityKind:CAPABILITY_KIND,requestKind:REQUEST_KIND,resultKind:RESULT_KIND,activeModel:activeSpec()?.id||null,canLend:capableLocalAdvert(),neurons:neuronState(),consentPolicy:'ask-every-time',authority:'advisory-output-only'}}
const api=Object.freeze({version:VERSION,CAPABILITY_KIND,REQUEST_KIND,RESULT_KIND,CAPABILITY_SCHEMA,REQUEST_SCHEMA,RESULT_SCHEMA,requirements,activeSpec,neuronState,localSupport,shouldOffer,advertise,discoverLenders,requestPlan,incomingRequests,incomingResults,acceptRequest,declineRequest,processIncoming,syncDirectGateway,start,stop,status});
globalThis.CivweavePeerLocalPlanBorrowV1=api;try{dispatchEvent(new CustomEvent('civweave:peer-local-plan-borrow-ready',{detail:status()}))}catch{}
})();