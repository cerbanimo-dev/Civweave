(()=>{
'use strict';
const VERSION='1.0.0-gemini-provider-budget';
if(globalThis.CivweaveGeminiRateGovernorV1?.version===VERSION)return;
const nativeFetch=globalThis.fetch?.bind(globalThis);
const STORAGE_KEY='civweave.gemini-rate-governor.v1';
const LOCK_PREFIX='civweave-gemini-rate-governor-';
const BUDGETS=Object.freeze({
  flash:Object.freeze({rpm:5,spacingMs:12100}),
  lite:Object.freeze({rpm:15,spacingMs:4100}),
});
const memoryState={flash:0,lite:0};
const reserveQueues={flash:Promise.resolve(),lite:Promise.resolve()};
const clean=(value,max=400)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'?parsed:fallback}catch{return fallback}};
function targetUrl(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
function methodFor(input,init){return clean(init?.method||(typeof Request!=='undefined'&&input instanceof Request?input.method:'GET'),24).toUpperCase()||'GET'}
function signalFor(input,init){return init?.signal||(typeof Request!=='undefined'&&input instanceof Request?input.signal:null)||null}
function generationTarget(url,method){
  if(method!=='POST'||!url)return false;
  const path=url.pathname;
  const google=url.hostname.toLowerCase()==='generativelanguage.googleapis.com';
  if(google&&/\/v1(?:beta)?\/(?:interactions(?:\/[^/]+)?|models\/[^/]+:(?:generateContent|streamGenerateContent))$/i.test(path))return !/\/interactions\/[^/]+$/i.test(path);
  if(/\/api\/ai\/gemini\/interactions$/i.test(path))return true;
  if(/\/gemini\/(?:interactions|models\/[^/]+:(?:generateContent|streamGenerateContent))$/i.test(path))return true;
  return false;
}
async function requestBodyText(input,init){
  if(typeof init?.body==='string')return init.body;
  if(init?.body instanceof URLSearchParams)return init.body.toString();
  if(typeof Request!=='undefined'&&input instanceof Request){try{return await input.clone().text()}catch{}}
  return'';
}
function modelFromUrl(url){
  const match=url?.pathname?.match(/\/models\/([^/:]+):(?:generateContent|streamGenerateContent)$/i);
  return match?decodeURIComponent(match[1]):'';
}
async function requestModel(input,init,url){
  const fromUrl=modelFromUrl(url);if(fromUrl)return fromUrl;
  const body=await requestBodyText(input,init);if(!body)return'';
  const parsed=parse(body,{});return clean(parsed.model||parsed.modelId||parsed.agent,200);
}
function bucketFor(model){return /flash[-_. ]?lite/i.test(clean(model,200))?'lite':'flash'}
function readState(){try{return parse(localStorage.getItem(STORAGE_KEY),{})}catch{return{}}}
function writeState(state){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true}catch{return false}}
function reserveLocal(bucket){
  const budget=BUDGETS[bucket],now=Date.now(),state=readState(),stored=Math.max(0,Number(state?.[bucket]?.nextAt||0)),slot=Math.max(now,stored,memoryState[bucket]||0),nextAt=slot+budget.spacingMs;
  memoryState[bucket]=nextAt;
  state[bucket]={nextAt,updatedAt:now,rpm:budget.rpm};writeState(state);
  return slot;
}
function reserveSlot(bucket){
  const reserve=async()=>{
    if(globalThis.navigator?.locks?.request){
      try{return await navigator.locks.request(`${LOCK_PREFIX}${bucket}`,{mode:'exclusive'},()=>reserveLocal(bucket))}catch{}
    }
    return reserveLocal(bucket);
  };
  const ticket=reserveQueues[bucket].catch(()=>{}).then(reserve);
  reserveQueues[bucket]=ticket.then(()=>undefined,()=>undefined);
  return ticket;
}
function abortedError(signal){try{return new DOMException(clean(signal?.reason||'Request aborted.',240),'AbortError')}catch{const error=new Error('Request aborted.');error.name='AbortError';return error}}
function wait(ms,signal){
  if(ms<=0)return Promise.resolve();
  if(signal?.aborted)return Promise.reject(abortedError(signal));
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(done,ms);function done(){signal?.removeEventListener?.('abort',stop);resolve()}function stop(){clearTimeout(timer);signal?.removeEventListener?.('abort',stop);reject(abortedError(signal))}signal?.addEventListener?.('abort',stop,{once:true});
  });
}
async function pace(model,options={}){
  const bucket=bucketFor(model),budget=BUDGETS[bucket],signal=options.signal||null,slot=await reserveSlot(bucket),waitMs=Math.max(0,slot-Date.now());
  try{dispatchEvent(new CustomEvent('civweave:gemini-rate-governor',{detail:{version:VERSION,bucket,model:clean(model,200)||'unknown-gemini-model',rpm:budget.rpm,spacingMs:budget.spacingMs,waitMs,reservedFor:new Date(slot).toISOString(),reason:clean(options.reason||'generation',120)}}))}catch{}
  await wait(waitMs,signal);
  return{bucket,rpm:budget.rpm,spacingMs:budget.spacingMs,waitMs,startedAt:new Date().toISOString()};
}
async function governedFetch(input,init={}){
  const url=targetUrl(input),method=methodFor(input,init);
  if(generationTarget(url,method)){
    const model=await requestModel(input,init,url);
    await pace(model,{signal:signalFor(input,init),reason:url?.pathname||'gemini-generation'});
  }
  return nativeFetch(input,init);
}
if(!nativeFetch){globalThis.CivweaveGeminiRateGovernorV1=Object.freeze({version:VERSION,installed:false,budgets:BUDGETS,pace});return}
globalThis.fetch=governedFetch;
globalThis.CivweaveGeminiRateGovernorV1=Object.freeze({version:VERSION,installed:true,budgets:BUDGETS,storageKey:STORAGE_KEY,pace,bucketFor});
try{dispatchEvent(new CustomEvent('civweave:gemini-rate-governor-ready',{detail:{version:VERSION,budgets:{flash:5,lite:15},at:new Date().toISOString()}}))}catch{}
})();