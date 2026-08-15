import {EMERGENCY_AI_HOST_POLICY} from './shared/guild-host-resilience-v1.mjs';
import {CivweaveEmergencyAiHostV1} from './emergency-ai-host-v1.mjs';

export const EMERGENCY_AI_MESH_SCHEMA='civweave.emergency-ai-mesh.v1';
export const EMERGENCY_AI_CAPABILITY_KIND='civweave.emergency-ai.capability.v1';
export const EMERGENCY_AI_REQUEST_KIND='civweave.emergency-ai.request.v1';
export const EMERGENCY_AI_RESULT_KIND='civweave.emergency-ai.result.v1';
const CAPABILITY_SCHEMA='civweave.emergency-ai-capability.v1',REQUEST_SCHEMA='civweave.emergency-ai-request.v1',RESULT_SCHEMA='civweave.emergency-ai-result.v1';
const STATE_KEY='civweave.emergency-ai-mesh.processed.v1',DEFAULT_SYNC_MS=90_000,MAX_QUEUE_DEPTH=8;
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max),now=()=>new Date().toISOString(),clone=value=>value==null?value:structuredClone(value),expiry=ms=>new Date(Date.now()+ms).toISOString();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
let guildId='',gateway='',timer=0,unsubscribe=null,processing=false,syncMs=DEFAULT_SYNC_MS;
const mesh=()=>globalThis.CivweaveLocalMeshV146||null;
const processed=()=>{try{const value=parse(globalThis.localStorage?.getItem(STATE_KEY),{});return value&&typeof value==='object'?value:{}}catch{return{}}};
const saveProcessed=value=>{try{globalThis.localStorage?.setItem(STATE_KEY,JSON.stringify(value))}catch{}};
async function requireMesh(){const value=mesh();if(!value?.createObject||!value?.deviceId||!value?.listObjects)throw new Error('Civweave local object mesh is unavailable.');return value}
async function upsertObject({id,kind,purpose,consent='direct',audience=[],payload,expiresAt,hopLimit=1,priority=99}){const value=await requireMesh(),old=await value.getObject(id).catch(()=>null);return value.createObject({id,revision:Number(old?.revision||0)+1,kind,purpose,consent,audience,payload,expiresAt,hopLimit,publish:true,priority,parentIds:old?.revisionHash?[old.id]:[]})}
async function objectsOf(kind){const value=await requireMesh();return(await value.listObjects()).filter(object=>object?.kind===kind&&(!object.expiresAt||Date.parse(object.expiresAt)>Date.now()))}
async function sync(){if(!gateway||globalThis.navigator?.onLine===false)return{offline:true};return (await requireMesh()).syncGateway(gateway)}
function sanitizeRequest(request={},tierId='fast'){
  const tier=globalThis.CivweaveResponseRouterV347?.tiers?.[tierId]||{};let left=64_000;const messages=[];
  for(const item of Array.isArray(request.messages)?request.messages:[]){if(left<=0)break;const content=clean(item?.content,left);if(!content)continue;messages.push({role:item?.role==='system'?'system':item?.role==='assistant'?'assistant':'user',content});left-=content.length}
  if(!messages.length&&request.prompt)messages.push({role:'user',content:clean(request.prompt,Math.min(left,64_000))});
  return Object.freeze({purpose:clean(request.purpose,180)||'guild-emergency-ai-share',executionProfile:clean(request.executionProfile,40)||'interactive',messages,responseFormat:clean(request.responseFormat,40)||undefined,schema:request.schema&&JSON.stringify(request.schema).length<=24_000?clone(request.schema):undefined,config:{temperature:Number(request?.config?.temperature??request.temperature??.2),maxTokens:Math.max(64,Math.min(Number(request?.config?.maxTokens||request.maxTokens||tier.maxTokens||1400)||1400,Number(tier.maxTokens||1400)))}})
}
export async function publishCapability({forceUnavailable=false}={}){
  const value=await requireMesh(),providerDeviceId=await value.deviceId(),eligibility=CivweaveEmergencyAiHostV1.status(),available=!forceUnavailable&&eligibility.eligible===true;
  const tiers=eligibility.required?.filter(row=>row.passed).map(row=>({tierId:row.tierId,modelId:row.modelId}))||[];
  const payload={schema:CAPABILITY_SCHEMA,providerDeviceId,guildId:clean(guildId,180)||null,available,scheduler:EMERGENCY_AI_HOST_POLICY.scheduler,queueDepth:Number(eligibility.queueDepth||0),maxQueueDepth:MAX_QUEUE_DEPTH,tiers,updatedAt:now()};
  return upsertObject({id:`emergency-ai-capability:${encodeURIComponent(providerDeviceId)}`,kind:EMERGENCY_AI_CAPABILITY_KIND,purpose:'Advertise an explicitly opted-in, benchmark-qualified emergency local AI host.',consent:'federated',audience:[],payload,expiresAt:expiry(available?15*60_000:60_000),hopLimit:3,priority:90})
}
export async function discoverProviders({tierId='fast',guild=clean(guildId,180)}={}){
  tierId=clean(tierId,40).toLowerCase();if(!EMERGENCY_AI_HOST_POLICY.requiredTierIds.includes(tierId))throw new RangeError('Unsupported emergency AI tier.');
  const value=await requireMesh(),self=await value.deviceId(),connected=new Set((value.status?.().sessions||[]).filter(row=>row.peerVerified&&row.state==='open').map(row=>row.peerId)),rows=[];
  for(const object of await objectsOf(EMERGENCY_AI_CAPABILITY_KIND)){const item=object.payload;if(item?.schema!==CAPABILITY_SCHEMA||item.available!==true||!item.providerDeviceId||item.providerDeviceId===self)continue;if(guild&&item.guildId&&item.guildId!==guild)continue;if(!item.tiers?.some(row=>row.tierId===tierId&&row.modelId))continue;if(Number(item.queueDepth||0)>=Number(item.maxQueueDepth||MAX_QUEUE_DEPTH))continue;rows.push({...clone(item),objectId:object.id,connectedNow:connected.has(item.providerDeviceId)})}
  rows.sort((a,b)=>Number(b.connectedNow)-Number(a.connectedNow)||Number(a.queueDepth||0)-Number(b.queueDepth||0)||Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0));return rows
}
export async function requestEmergencyInference(request={},options={}){
  const tierId=clean(options.tierId||request.emergencyTier||request.tierId||'fast',40).toLowerCase(),providers=await discoverProviders({tierId,guild:clean(options.guildId||guildId,180)}),wanted=clean(options.providerDeviceId,180),provider=wanted?providers.find(row=>row.providerDeviceId===wanted):providers[0];
  if(!provider)throw Object.assign(new Error('No benchmark-qualified emergency AI host is currently available.'),{code:'EMERGENCY_AI_NO_PROVIDER'});
  const value=await requireMesh(),requesterDeviceId=await value.deviceId(),requestId=clean(options.requestId,180)||`emergency-ai:${crypto.randomUUID?.()||Date.now()}`;
  const payload={schema:REQUEST_SCHEMA,requestId,requesterDeviceId,providerDeviceId:provider.providerDeviceId,guildId:clean(options.guildId||guildId,180)||null,tierId,requestedAt:now(),request:sanitizeRequest(request,tierId),disclosure:{emergencyFallback:true,providerOptedIn:true,benchmarkGateRequired:true,scheduler:'fifo',tools:false,externalResearch:false}};
  const object=await upsertObject({id:`emergency-ai-request:${requestId}`,kind:EMERGENCY_AI_REQUEST_KIND,purpose:'Address a bounded emergency inference request to an opted-in Guild AI host.',consent:'direct',audience:[provider.providerDeviceId],payload,expiresAt:expiry(30*60_000),hopLimit:1,priority:99});await sync().catch(()=>{});return Object.freeze({status:'queued',requestId,provider,object})
}
async function publishResult(requestObject,status,data={}){
  const source=requestObject.payload||{},target=clean(source.requesterDeviceId,180),requestId=clean(source.requestId,180);if(!target||!requestId)throw new Error('Emergency request is missing its return address.');
  const providerDeviceId=await(await requireMesh()).deviceId(),payload={schema:RESULT_SCHEMA,requestId,status,requesterDeviceId:target,providerDeviceId,guildId:clean(source.guildId,180)||null,tierId:clean(source.tierId,40),completedAt:now(),outputText:clean(data.result?.outputText,500_000),outputJson:data.result?.outputJson??null,actual:clone(data.result?.actual||null),usage:clone(data.result?.usage||null),error:data.error?{code:clean(data.error.code,120),message:clean(data.error.message,1600)}:null,provenance:{execution:'guild-emergency-local-ai',scheduler:'fifo',sourceRequestObjectId:requestObject.id}};
  const object=await upsertObject({id:`emergency-ai-result:${requestId}`,kind:EMERGENCY_AI_RESULT_KIND,purpose:'Return emergency local AI output to the requesting peer.',consent:'direct',audience:[target],payload,expiresAt:expiry(24*60*60_000),hopLimit:1,priority:100});await sync().catch(()=>{});return object
}
export async function incomingRequests(){const self=await(await requireMesh()).deviceId();return(await objectsOf(EMERGENCY_AI_REQUEST_KIND)).filter(object=>object.payload?.schema===REQUEST_SCHEMA&&object.payload?.providerDeviceId===self)}
export async function incomingResults(){const self=await(await requireMesh()).deviceId();return(await objectsOf(EMERGENCY_AI_RESULT_KIND)).filter(object=>object.payload?.schema===RESULT_SCHEMA&&object.payload?.requesterDeviceId===self)}
export async function processIncoming(){
  if(processing)return{busy:true};processing=true;try{const state=processed();let handled=0;for(const object of await incomingRequests()){const key=`request:${object.id}`;if(state[key])continue;state[key]={status:'processing',at:now()};saveProcessed(state);handled++;try{const eligibility=CivweaveEmergencyAiHostV1.status();if(!eligibility.eligible)throw Object.assign(new Error(`Emergency host is no longer eligible: ${eligibility.failures.join(', ')}`),{code:'EMERGENCY_AI_HOST_INELIGIBLE'});if(Number(eligibility.queueDepth||0)>=MAX_QUEUE_DEPTH)throw Object.assign(new Error('Emergency host FIFO is full.'),{code:'EMERGENCY_AI_QUEUE_FULL'});const result=await CivweaveEmergencyAiHostV1.submit({...object.payload.request,emergencyTier:object.payload.tierId});await publishResult(object,'success',{result});state[key]={status:'success',at:now()}}catch(error){await publishResult(object,'failed',{error}).catch(()=>{});state[key]={status:'failed',at:now(),error:clean(error?.message||error,800)}}saveProcessed(state)}return{handled}}finally{processing=false}
}
async function tick(){const eligibility=CivweaveEmergencyAiHostV1.status();await publishCapability({forceUnavailable:!eligibility.eligible}).catch(()=>{});await processIncoming().catch(()=>{});await sync().catch(()=>{});return status()}
export async function start({guildId:nextGuildId='',baseUrl=globalThis.location?.origin||'',syncIntervalMs=DEFAULT_SYNC_MS}={}){stop();guildId=clean(nextGuildId,180);gateway=baseUrl?new URL(baseUrl,globalThis.location?.href||'https://civweave.invalid').origin:'';syncMs=Math.max(30_000,Math.min(15*60_000,Number(syncIntervalMs)||DEFAULT_SYNC_MS));const value=await requireMesh();unsubscribe=value.subscribe?.(event=>{if(['object-received','gateway-sync'].includes(event?.type))void processIncoming()})||null;await tick();timer=setInterval(()=>void tick(),syncMs);return status()}
export function stop(){if(timer)clearInterval(timer);timer=0;if(unsubscribe)try{unsubscribe()}catch{}unsubscribe=null;return true}
export function status(){const host=CivweaveEmergencyAiHostV1.status();return Object.freeze({schema:EMERGENCY_AI_MESH_SCHEMA,started:Boolean(timer),guildId:guildId||null,gateway:gateway||null,syncIntervalMs:syncMs,maxQueueDepth:MAX_QUEUE_DEPTH,host})}
export const CivweaveEmergencyAiMeshV1=Object.freeze({schema:EMERGENCY_AI_MESH_SCHEMA,CAPABILITY_KIND:EMERGENCY_AI_CAPABILITY_KIND,REQUEST_KIND:EMERGENCY_AI_REQUEST_KIND,RESULT_KIND:EMERGENCY_AI_RESULT_KIND,publishCapability,discoverProviders,requestEmergencyInference,incomingRequests,incomingResults,processIncoming,start,stop,status});
globalThis.CivweaveEmergencyAiMeshV1=CivweaveEmergencyAiMeshV1;
