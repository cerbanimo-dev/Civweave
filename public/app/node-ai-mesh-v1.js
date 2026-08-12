(()=>{
'use strict';
const VERSION='1.1.1-node-ai-mesh-v1-server-auto';
const SERVICE_KIND='civweave.node-ai.service-advert.v1';
const SETTLEMENT_KIND='civweave.node-ai.settlement-batch.v1';
const SETTLEMENT_BATCH_SCHEMA='civweave.node-ai-mesh-settlement-batch.v1';
const ROUTER_URL='/app/shared/civweave-node-ai-routing-v1.mjs';
const SERVER_AI_SCRIPTS=['/app/server-ai-router-v301.js?v=1.0.116-v301','/app/server-ai-settings-v301.js?v=1.0.116-v301'];
const DEFAULT_SYNC_MS=90_000;
const LEASE_KEY='civweave.node-ai-mesh.sync-lease.v1';
const INSTANCE_ID=`node-ai-mesh:${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
let routerPromise=null;
let meshPromise=null;
let serverAiPromise=null;
let syncTimer=null;
let onlineHandler=null;
let pageHideHandler=null;
let meshUnsubscribe=null;
let gatewayUrl=null;
let activeSyncMs=DEFAULT_SYNC_MS;
let advertiseLocal=true;

const now=()=>new Date().toISOString();
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const clone=value=>value==null?value:structuredClone(value);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};

function loadScript(src,ready){
  if(ready?.())return Promise.resolve(ready());
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===new URL(src,location.href).pathname);
    if(existing){let ticks=0;const timer=setInterval(()=>{const value=ready?.();if(value){clearInterval(timer);resolve(value)}else if(++ticks>160){clearInterval(timer);reject(new Error(`${src} loaded without becoming ready.`))}},50);return}
    const script=document.createElement('script');script.src=src;script.async=false;script.onload=()=>{const value=ready?.();value?resolve(value):reject(new Error(`${src} loaded without becoming ready.`))};script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script);
  });
}
async function ensureServerAI(){
  if(globalThis.CivweaveServerAIRouterV301&&globalThis.CivweaveServerAISettingsV301)return true;
  if(!serverAiPromise)serverAiPromise=(async()=>{
    await loadScript(SERVER_AI_SCRIPTS[0],()=>globalThis.CivweaveServerAIRouterV301);
    await loadScript(SERVER_AI_SCRIPTS[1],()=>globalThis.CivweaveServerAISettingsV301);
    return true;
  })().catch(error=>{serverAiPromise=null;dispatchEvent(new CustomEvent('civweave:server-ai-load-error',{detail:{message:error.message,at:now()}}));throw error});
  return serverAiPromise;
}
async function ensureMesh(){
  if(globalThis.CivweaveLocalMeshV146)return globalThis.CivweaveLocalMeshV146;
  if(!meshPromise)meshPromise=loadScript('/app/local-object-mesh-v146.js?v=node-ai-mesh-v1',()=>globalThis.CivweaveLocalMeshV146).catch(error=>{meshPromise=null;throw error});
  return meshPromise;
}
async function router(){
  if(!routerPromise)routerPromise=import(ROUTER_URL).catch(error=>{routerPromise=null;throw error});
  return routerPromise;
}
async function upsertObject({id,kind,purpose,consent='federated',audience=[],payload,hopLimit=6}){
  const mesh=await ensureMesh();
  const previous=await mesh.getObject(id).catch(()=>null);
  return mesh.createObject({id,revision:Number(previous?.revision||0)+1,kind,purpose,consent,audience,payload,hopLimit,publish:true,parentIds:previous?.revisionHash?[previous.id]:[]});
}
async function publishManifest(manifest,{consent='federated',audience=[],hopLimit=6}={}){
  if(manifest?.schema!=='civweave.node-ai-service-manifest.v1'||!manifest.nodeId)throw new TypeError('A Civweave node AI service manifest is required.');
  const id=`node-ai-service:${encodeURIComponent(manifest.nodeId)}`;
  const object=await upsertObject({id,kind:SERVICE_KIND,purpose:'Discover node-owned AI services and their declared capabilities.',consent,audience,payload:{manifest:clone(manifest)},hopLimit});
  dispatchEvent(new CustomEvent('civweave:node-ai-advertised',{detail:{nodeId:manifest.nodeId,objectId:object.id,at:now()}}));
  return object;
}
async function publishManifestFromNode(baseUrl=location.origin,options={}){
  const base=new URL(baseUrl||location.origin,location.href);
  const response=await fetch(new URL('/api/ai/node/manifest',base),{cache:'no-store'});
  if(!response.ok)throw new Error(`Node manifest endpoint returned ${response.status}.`);
  const body=await response.json();
  if(!body?.manifest)throw new Error('Node manifest endpoint did not return a manifest.');
  return publishManifest(body.manifest,options);
}
async function publishSettlementBatch({nodeId,receipts,periodStart=null,periodEnd=null,consent='federated',audience=[],hopLimit=6,metadata={}}={}){
  const idNode=clean(nodeId,180);if(!idNode)throw new TypeError('nodeId is required.');
  const items=(Array.isArray(receipts)?receipts:[]).filter(item=>item&&typeof item==='object');
  if(!items.length)throw new TypeError('receipts must contain at least one signed or unsigned settlement receipt.');
  const batch={schema:SETTLEMENT_BATCH_SCHEMA,nodeId:idNode,periodStart:periodStart||null,periodEnd:periodEnd||null,receipts:clone(items),metadata:clone(metadata),createdAt:now()};
  const bucket=clean(periodEnd||periodStart||batch.createdAt,40).slice(0,10)||'current';
  const id=`node-ai-settlement:${encodeURIComponent(idNode)}:${bucket}`;
  const object=await upsertObject({id,kind:SETTLEMENT_KIND,purpose:'Exchange periodic node AI settlement receipts through the federated object mesh.',consent,audience,payload:batch,hopLimit});
  dispatchEvent(new CustomEvent('civweave:node-ai-settlement-published',{detail:{nodeId:idNode,count:items.length,objectId:object.id,at:now()}}));
  return object;
}
async function listServiceObjects(){
  const mesh=await ensureMesh();
  return (await mesh.listObjects()).filter(object=>object?.kind===SERVICE_KIND);
}
async function listSettlementObjects(){
  const mesh=await ensureMesh();
  return (await mesh.listObjects()).filter(object=>object?.kind===SETTLEMENT_KIND);
}
async function discover(options={}){
  const routing=await router();
  const objects=await listServiceObjects();
  const candidates=routing.extractNodeAiCandidates(objects,options);
  return {candidates,objects};
}
async function route(request={}){
  const routing=await router();
  const {candidates}=await discover(request);
  let localNodeId=request.localNodeId||null;
  if(!localNodeId)try{localNodeId=await (await ensureMesh()).deviceId()}catch{}
  return routing.routeNodeAiService({...request,candidates,localNodeId});
}
function resolveBaseUrl(selection,explicitBaseUrl=null){
  const value=clean(explicitBaseUrl,4000)||clean(selection?.endpoints?.baseUrls?.[0],4000);
  if(!value)throw new Error('Selected node does not advertise a reachable HTTP endpoint.');
  const url=new URL(value,location.href);
  if(!['http:','https:'].includes(url.protocol))throw new Error('Selected node endpoint must use HTTP or HTTPS.');
  return url;
}
async function requestCapability({selection,sessionToken,deviceId,maxRetailCostCents,ttlSeconds=900,baseUrl=null}={}){
  if(!selection?.nodeId||!selection?.serviceId)throw new TypeError('A selected node AI service is required.');
  const token=clean(sessionToken,16000);if(!token)throw new TypeError('sessionToken is required.');
  const device=clean(deviceId,180);if(!device)throw new TypeError('deviceId is required.');
  if(!Number.isSafeInteger(maxRetailCostCents)||maxRetailCostCents<1)throw new TypeError('maxRetailCostCents must be a positive integer.');
  const base=resolveBaseUrl(selection,baseUrl);
  const path=clean(selection.endpoints?.capabilityPath,500)||'/api/ai/node/wallet/capability';
  const response=await fetch(new URL(path,base),{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`},body:JSON.stringify({deviceId:device,serviceIds:[selection.serviceId],maxRetailCostCents,ttlSeconds})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(clean(body?.error,1000)||`Node capability request returned ${response.status}.`);
  if(!body?.capability)throw new Error('Node capability endpoint did not return a capability.');
  return{capability:body.capability,expiresInSeconds:body.expiresInSeconds||null,nodeId:selection.nodeId,serviceId:selection.serviceId,baseUrl:base.origin};
}
async function invoke({selection,capability,deviceId,request,requestId=null,baseUrl=null}={}){
  if(!selection?.nodeId||!selection?.serviceId)throw new TypeError('A selected node AI service is required.');
  const token=clean(capability,16000);if(!token)throw new TypeError('capability is required.');
  const device=clean(deviceId,180);if(!device)throw new TypeError('deviceId is required.');
  const base=resolveBaseUrl(selection,baseUrl);
  const path=clean(selection.endpoints?.inferencePath,500)||'/api/ai/node/inference';
  const response=await fetch(new URL(path,base),{method:'POST',headers:{'content-type':'application/json','x-civweave-ai-capability':token},body:JSON.stringify({serviceId:selection.serviceId,deviceId:device,requestId:clean(requestId,180)||undefined,request:clone(request)})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(clean(body?.error,1000)||`Node inference returned ${response.status}.`);
  dispatchEvent(new CustomEvent('civweave:node-ai-inference-complete',{detail:{nodeId:selection.nodeId,serviceId:selection.serviceId,retailCostCents:body.retailCostCents,at:now()}}));
  return body;
}
async function routeAndInvoke({routing={},sessionToken,deviceId,maxRetailCostCents,request,requestId=null,baseUrl=null}={}){
  const result=await route({...routing,maxRetailCostCents,requireHttpReachability:true});
  if(!result.selected)throw new Error('No discovered node AI service satisfies this request.');
  const authorization=await requestCapability({selection:result.selected,sessionToken,deviceId,maxRetailCostCents,baseUrl});
  const response=await invoke({selection:result.selected,capability:authorization.capability,deviceId,request,requestId,baseUrl});
  return{routing:result,authorization,response};
}
function leaseTtl(){return Math.max(75_000,activeSyncMs*2.5)}
function acquireLease(){
  try{
    const current=parse(localStorage.getItem(LEASE_KEY),null),time=Date.now();
    if(current?.owner&&current.owner!==INSTANCE_ID&&Number(current.expiresAt)>time)return false;
    const next={owner:INSTANCE_ID,expiresAt:time+leaseTtl(),updatedAt:now()};
    localStorage.setItem(LEASE_KEY,JSON.stringify(next));
    return parse(localStorage.getItem(LEASE_KEY),{})?.owner===INSTANCE_ID;
  }catch{return true}
}
function releaseLease(){
  try{const current=parse(localStorage.getItem(LEASE_KEY),null);if(current?.owner===INSTANCE_ID)localStorage.removeItem(LEASE_KEY)}catch{}
}
function jitter(ms){return Math.round(ms*(0.85+Math.random()*0.3))}
async function sync(baseUrl=gatewayUrl||location.origin){
  if(navigator.onLine===false)return{sent:0,received:0,offline:true};
  const mesh=await ensureMesh();
  const result=await mesh.syncGateway(baseUrl||location.origin);
  dispatchEvent(new CustomEvent('civweave:node-ai-mesh-sync',{detail:{...result,baseUrl:String(baseUrl||location.origin),at:now()}}));
  return result;
}
async function tick(){
  if(!acquireLease())return{leader:false};
  if(advertiseLocal)try{await publishManifestFromNode(gatewayUrl||location.origin)}catch{}
  try{return{leader:true,...await sync(gatewayUrl||location.origin)}}catch(error){dispatchEvent(new CustomEvent('civweave:node-ai-mesh-error',{detail:{message:error.message,at:now()}}));return{leader:true,error:error.message}}
}
function scheduleNext(){
  if(syncTimer)clearTimeout(syncTimer);
  syncTimer=setTimeout(async()=>{await tick();scheduleNext()},jitter(activeSyncMs));
}
async function start({baseUrl=location.origin,syncIntervalMs=DEFAULT_SYNC_MS,advertiseLocalNode=true}={}){
  stop();gatewayUrl=String(baseUrl||location.origin);advertiseLocal=advertiseLocalNode!==false;
  activeSyncMs=Math.max(30_000,Math.min(15*60_000,Number(syncIntervalMs)||DEFAULT_SYNC_MS));
  const mesh=await ensureMesh();await router();ensureServerAI().catch(()=>{});
  await tick();
  scheduleNext();
  onlineHandler=()=>tick();addEventListener('online',onlineHandler);
  pageHideHandler=()=>stop();addEventListener('pagehide',pageHideHandler,{once:true});
  meshUnsubscribe=mesh.subscribe(event=>{
    if(event?.type==='object-received'||event?.type==='gateway-sync')dispatchEvent(new CustomEvent('civweave:node-ai-discovery-changed',{detail:{event,at:now()}}));
  });
  return{started:true,baseUrl:gatewayUrl,syncIntervalMs:activeSyncMs,leader:acquireLease()};
}
function stop(){
  if(syncTimer){clearTimeout(syncTimer);syncTimer=null}
  if(onlineHandler){removeEventListener('online',onlineHandler);onlineHandler=null}
  if(pageHideHandler){removeEventListener('pagehide',pageHideHandler);pageHideHandler=null}
  if(meshUnsubscribe){try{meshUnsubscribe()}catch{}meshUnsubscribe=null}
  releaseLease();
  return true
}
function status(){
  let lease=null;try{lease=parse(localStorage.getItem(LEASE_KEY),null)}catch{}
  return{version:VERSION,started:Boolean(syncTimer),baseUrl:gatewayUrl||null,serviceKind:SERVICE_KIND,settlementKind:SETTLEMENT_KIND,syncIntervalMs:activeSyncMs,leaseOwner:lease?.owner||null,leader:lease?.owner===INSTANCE_ID,serverAiLoaded:Boolean(globalThis.CivweaveServerAIRouterV301)}
}
function autoStart(){ensureServerAI().catch(()=>{});start({baseUrl:location.origin,syncIntervalMs:DEFAULT_SYNC_MS,advertiseLocalNode:true}).catch(error=>dispatchEvent(new CustomEvent('civweave:node-ai-mesh-error',{detail:{message:error.message,phase:'auto-start',at:now()}})))}

const api=Object.freeze({version:VERSION,SERVICE_KIND,SETTLEMENT_KIND,SETTLEMENT_BATCH_SCHEMA,ensureMesh,ensureServerAI,publishManifest,publishManifestFromNode,publishSettlementBatch,listServiceObjects,listSettlementObjects,discover,route,resolveBaseUrl,requestCapability,invoke,routeAndInvoke,sync,start,stop,status});
globalThis.CivweaveNodeAIMeshV1=api;
dispatchEvent(new CustomEvent('civweave:node-ai-mesh-ready',{detail:status()}));
document.readyState==='loading'?addEventListener('DOMContentLoaded',autoStart,{once:true}):queueMicrotask(autoStart);
})();