(()=>{
'use strict';
const INTENTIONS_KEY='civweave.intentions.v127';
const LINK_KEY='civweave.chat-intention-link.v131';
const DIAGNOSTICS_KEY='civweave.local-diagnostics.v131';
const NETWORK_BUDGET_KEY='civweave.network-budget.v1';
const HOST_SELECTION_KEY='civweave.host-node.selection.v1';
const HOST_ENDPOINT_KEY='federation-finder.physical-node-endpoint';
const HOST_SESSION_KEY='civweave.host-capacity.sessions.v1';
const CHAT_KEYS=/^civweave\.(?:weaveling-chat\.v127|guide-chat\.[^.]+\.v128)$/;
const NETWORK_DAY_LIMIT=2400;
const NETWORK_MINUTE_LIMIT=60;
const NETWORK_MINUTE_MS=60*1000;
const nativeFetch=globalThis.fetch?.bind(globalThis);
const nativeSetItem=Storage.prototype.setItem;
const parse=(value,fallback)=>{try{const out=JSON.parse(value);return out==null?fallback:out}catch{return fallback}};
const now=()=>new Date().toISOString();
const responseCache=new Map();
const inFlightGets=new Map();
const backoffUntil=new Map();
let memoryBudget={};

function localDiagnostic(kind,detail={}){
  try{
    const rows=parse(localStorage.getItem(DIAGNOSTICS_KEY),[]),list=Array.isArray(rows)?rows:[];
    list.push({time:now(),kind:String(kind||'event').slice(0,120),detail});
    nativeSetItem.call(localStorage,DIAGNOSTICS_KEY,JSON.stringify(list.slice(-120)));
  }catch{}
}
function telemetryRequest(input){
  try{
    const raw=typeof input==='string'?input:input?.url;
    if(!raw)return false;
    const url=new URL(raw,location.href);
    return url.origin===location.origin&&(url.pathname==='/api/boot-log'||url.pathname==='/api/boot-logs');
  }catch{return false}
}
function safeOrigin(value){
  try{const url=new URL(String(value||''),location.href);return /^https?:$/.test(url.protocol)?url.origin:''}catch{return''}
}
function knownGuildOrigins(){
  const origins=new Set();
  try{
    const selected=parse(localStorage.getItem(HOST_SELECTION_KEY),{});
    const selectedOrigin=safeOrigin(selected?.origin);if(selectedOrigin)origins.add(selectedOrigin);
    const legacy=safeOrigin(localStorage.getItem(HOST_ENDPOINT_KEY)||'');if(legacy)origins.add(legacy);
    const sessions=parse(sessionStorage.getItem(HOST_SESSION_KEY),{});
    for(const session of Object.values(sessions&&typeof sessions==='object'?sessions:{})){const origin=safeOrigin(session?.origin);if(origin)origins.add(origin)}
  }catch{}
  return origins;
}
function requestMeta(input,init={}){
  try{
    const raw=typeof input==='string'||input instanceof URL?input:input?.url;
    if(!raw)return null;
    const url=new URL(raw,location.href),method=String(init?.method||input?.method||'GET').toUpperCase();
    if(!url.pathname.includes('/api/'))return null;
    if(url.origin!==location.origin&&!knownGuildOrigins().has(url.origin))return null;
    const path=url.pathname;
    let cacheMs=0;
    if(method==='GET'||method==='HEAD'){
      if(path.endsWith('/api/ai/node/session'))cacheMs=60*1000;
      else if(path.endsWith('/api/fabric/capacity')||path==='/api/host-node-status'||path==='/api/host-node-search')cacheMs=60*1000;
      else if(path.endsWith('/api/ai/node/manifest')||path==='/api/hub-map-nodes')cacheMs=5*60*1000;
      else cacheMs=1000;
    }
    return{url,method,origin:url.origin,key:`${method} ${url.href}`,cacheMs};
  }catch{return null}
}
function utcDay(){return new Date().toISOString().slice(0,10)}
function secondsUntilNextUtcDay(){
  const current=new Date(),next=new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth(),current.getUTCDate()+1));
  return Math.max(1,Math.ceil((next.getTime()-current.getTime())/1000));
}
function readBudget(){
  try{
    const value=parse(localStorage.getItem(NETWORK_BUDGET_KEY),{});
    memoryBudget=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  }catch{}
  return memoryBudget;
}
function writeBudget(value){
  memoryBudget=value;
  try{nativeSetItem.call(localStorage,NETWORK_BUDGET_KEY,JSON.stringify(value));return true}catch{return false}
}
function reserveNetworkSlot(origin){
  const time=Date.now(),day=utcDay(),minute=Math.floor(time/NETWORK_MINUTE_MS),all=readBudget();
  const dayRows=all[day]&&typeof all[day]==='object'?all[day]:{};
  const row=dayRows[origin]&&typeof dayRows[origin]==='object'?dayRows[origin]:{};
  const dayCount=Math.max(0,Number(row.dayCount)||0);
  const minuteCount=Number(row.minute)===minute?Math.max(0,Number(row.minuteCount)||0):0;
  if(dayCount>=NETWORK_DAY_LIMIT)return{ok:false,reason:'daily-device-guild-budget',retryAfter:secondsUntilNextUtcDay(),dayCount,minuteCount};
  if(minuteCount>=NETWORK_MINUTE_LIMIT)return{ok:false,reason:'minute-device-guild-budget',retryAfter:Math.max(1,60-(Math.floor(time/1000)%60)),dayCount,minuteCount};
  const next={dayCount:dayCount+1,minute,minuteCount:minuteCount+1,updatedAt:now()};
  writeBudget({[day]:{...dayRows,[origin]:next}});
  return{ok:true,...next};
}
function budgetSnapshot(){
  const day=utcDay(),rows=readBudget()[day]||{};
  return{day,dayLimit:NETWORK_DAY_LIMIT,minuteLimit:NETWORK_MINUTE_LIMIT,origins:Object.fromEntries(Object.entries(rows).map(([origin,row])=>[origin,{dayCount:Number(row?.dayCount)||0,minuteCount:Number(row?.minuteCount)||0,minute:Number(row?.minute)||0,updatedAt:row?.updatedAt||null}]))};
}
function localThrottle(meta,reason,retryAfter){
  localDiagnostic('guild-request-throttled',{origin:meta.origin,path:meta.url.pathname,method:meta.method,reason,retryAfter});
  return new Response(JSON.stringify({ok:false,error:'Civweave held this request locally to protect the Guild server request budget.',code:'CIVWEAVE_CLIENT_REQUEST_BUDGET',reason,retryAfter}),{
    status:429,
    statusText:'Too Many Requests',
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','retry-after':String(Math.max(1,retryAfter||1)),'x-civweave-local-throttle':'1'}
  });
}
function retryAfterSeconds(response){
  const value=String(response?.headers?.get?.('retry-after')||'').trim(),seconds=Number(value);
  if(Number.isFinite(seconds)&&seconds>0)return Math.min(3600,Math.max(1,Math.ceil(seconds)));
  const when=Date.parse(value);return Number.isFinite(when)?Math.min(3600,Math.max(1,Math.ceil((when-Date.now())/1000))):60;
}
function rememberResponse(meta,response){
  if(!meta.cacheMs||!response?.ok)return;
  responseCache.set(meta.key,{at:Date.now(),response:response.clone(),cacheMs:meta.cacheMs});
  if(responseCache.size>64){const oldest=[...responseCache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,responseCache.size-64);for(const[key]of oldest)responseCache.delete(key)}
}
function cachedResponse(meta){
  const cached=responseCache.get(meta.key);
  if(!cached)return null;
  if(Date.now()-cached.at>cached.cacheMs){responseCache.delete(meta.key);return null}
  return cached.response.clone();
}
async function governedFetch(input,init={}){
  if(telemetryRequest(input)){
    const payload=parse(typeof init?.body==='string'?init.body:'',{});
    localDiagnostic(payload.kind||'legacy-telemetry-blocked',payload.detail||{});
    return new Response(null,{status:204,statusText:'No Content'});
  }
  const meta=requestMeta(input,init);
  if(!meta)return nativeFetch(input,init);
  const cached=cachedResponse(meta);if(cached)return cached;
  if((meta.method==='GET'||meta.method==='HEAD')&&inFlightGets.has(meta.key))return (await inFlightGets.get(meta.key)).clone();
  const blockedUntil=Number(backoffUntil.get(meta.key)||0);
  if(blockedUntil>Date.now())return localThrottle(meta,'server-backoff',Math.ceil((blockedUntil-Date.now())/1000));
  const slot=reserveNetworkSlot(meta.origin);
  if(!slot.ok)return localThrottle(meta,slot.reason,slot.retryAfter);
  const task=nativeFetch(input,init).then(response=>{
    if(response.status===429){const retry=retryAfterSeconds(response);backoffUntil.set(meta.key,Date.now()+retry*1000)}
    else if(response.ok)backoffUntil.delete(meta.key);
    rememberResponse(meta,response);
    return response;
  });
  if(meta.method==='GET'||meta.method==='HEAD'){
    const shared=task.then(response=>response.clone()).finally(()=>inFlightGets.delete(meta.key));
    inFlightGets.set(meta.key,shared);
    return (await shared).clone();
  }
  return task;
}
if(nativeFetch)globalThis.fetch=governedFetch;

function savedIntentions(){const value=parse(localStorage.getItem(INTENTIONS_KEY),[]);return Array.isArray(value)?value:[]}
function planState(planId){
  if(!planId)return'';
  const item=savedIntentions().find(row=>row?.id===planId||row?.plan?.id===planId);
  return item?.state||item?.plan?.state||'';
}
function fallbackNext(){
  const items=savedIntentions(),active=items.find(row=>row?.state==='active'),review=items.find(row=>row?.state==='review');
  if(active)return'Next: Attach this conversation to the active intention, or continue that intention from its plan.';
  if(review)return'Next: Review or activate the saved intention, or set this conversation as a new intention.';
  return'Next: Tell me your wish or set an intention.';
}
function conversationLinkKey(chatKey){return`${LINK_KEY}.${String(chatKey).replace(/[^a-z0-9.-]+/gi,'_')}`}
function linkedPlan(rows,chatKey){
  const key=conversationLinkKey(chatKey),discovered=[...rows].reverse().map(row=>row?.planId||row?.approvalGate?.planId||'').find(Boolean);
  if(discovered){nativeSetItem.call(localStorage,key,discovered);return discovered}
  return localStorage.getItem(key)||'';
}
function sanitizeChat(chatKey,value){
  const rows=parse(value,null);if(!Array.isArray(rows))return value;
  const planId=linkedPlan(rows,chatKey),confirmed=['review','active'].includes(planState(planId));
  let changed=false;
  for(const row of rows){
    if(row?.role!=='assistant'||typeof row.text!=='string'||!row.text.includes('\n\nNext:'))continue;
    const rowPlan=row.planId||row.approvalGate?.planId||planId;
    const rowConfirmed=Boolean(rowPlan)&&['review','active'].includes(planState(rowPlan));
    if(rowConfirmed||confirmed)continue;
    const replacement=fallbackNext();
    const next=row.text.replace(/\n\nNext:[\s\S]*?(?=\n\nThis next action|\n\nLocal reflex used|$)/,`\n\n${replacement}`);
    if(next!==row.text){row.text=next;changed=true}
  }
  return changed?JSON.stringify(rows):value;
}
Storage.prototype.setItem=function(key,value){
  const chatKey=String(key),normalized=CHAT_KEYS.test(chatKey)?sanitizeChat(chatKey,String(value)):value;
  return nativeSetItem.call(this,key,normalized);
};
function sweep(){
  try{for(let i=0;i<localStorage.length;i+=1){const key=localStorage.key(i);if(key&&CHAT_KEYS.test(key)){const value=localStorage.getItem(key);nativeSetItem.call(localStorage,key,sanitizeChat(key,value))}}}catch{}
}
sweep();
globalThis.CivweaveLocalFirstPolicy={
  diagnostics:()=>parse(localStorage.getItem(DIAGNOSTICS_KEY),[]),
  clearDiagnostics:()=>localStorage.removeItem(DIAGNOSTICS_KEY),
  linkedPlan:chatKey=>localStorage.getItem(conversationLinkKey(chatKey||'civweave.weaveling-chat.v127'))||'',
  networkBudget:budgetSnapshot,
  networkLimits:Object.freeze({perGuildDeviceDay:NETWORK_DAY_LIMIT,perGuildDeviceMinute:NETWORK_MINUTE_LIMIT}),
  version:'1.0.32-guild-request-governor'
};
})();
