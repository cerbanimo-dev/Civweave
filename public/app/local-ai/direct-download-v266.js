(()=>{
'use strict';
const VERSION='1.0.60-local-ai-download-v266';
const CACHE='civweave-model-generative-v266';
const STATE_KEY='civweave.local-ai.downloads.v266';
const SELECTION_KEY='civweave.local-ai.selection.v266';
if(globalThis.CivweaveLocalModelDownloadV266?.version===VERSION)return;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const loadState=()=>parse(localStorage.getItem(STATE_KEY),{});
const saveState=value=>{localStorage.setItem(STATE_KEY,JSON.stringify(value));return value};
const now=()=>new Date().toISOString();
const fmt=bytes=>{const n=Number(bytes||0);if(!n)return'unknown size';if(n>=1e9)return`${(n/1e9).toFixed(n>=10e9?0:1)} GB`;return`${Math.round(n/1e6)} MB`};
function model(id){const found=registry()?.byId?.(id);if(!found)throw new Error(`Unknown local model: ${id}`);return found}
function assertInstallable(spec){if(!spec.installable)throw new Error(spec.reason||`${spec.label} is not enabled in the stable downloader.`);if(!('caches'in globalThis))throw new Error('Cache Storage is unavailable in this browser.');if(spec.device==='webgpu'&&!navigator.gpu)throw new Error(`${spec.label} requires WebGPU in the current Civweave release.`)}
async function storage(){if(!navigator.storage?.estimate)return{usage:0,quota:0,available:0,persisted:null};const estimate=await navigator.storage.estimate();let persisted=null;try{persisted=await navigator.storage.persisted?.()}catch{}return{usage:Number(estimate.usage||0),quota:Number(estimate.quota||0),available:Math.max(0,Number(estimate.quota||0)-Number(estimate.usage||0)),persisted}}
async function requestPersistence(){try{return Boolean(await navigator.storage?.persist?.())}catch{return false}}
async function cachedArtifact(spec,artifact){const cache=await caches.open(CACHE),url=registry().directUrl(spec,artifact.path),response=await cache.match(url,{ignoreSearch:false});if(!response?.ok)return{ok:false,url,path:artifact.path,bytes:0};const declared=Number(response.headers.get('content-length')||0);if(declared&&declared<artifact.minBytes)return{ok:false,url,path:artifact.path,bytes:declared};return{ok:true,url,path:artifact.path,bytes:declared}}
async function status(id){const spec=model(id),rows=[];for(const artifact of spec.artifacts)rows.push({...artifact,...await cachedArtifact(spec,artifact)});const required=rows.filter(row=>row.required),available=Boolean(required.length)&&required.every(row=>row.ok);return{id:spec.id,label:spec.label,available,installed:available,rows,missing:rows.filter(row=>row.required&&!row.ok),selected:selection().id===spec.id&&selection().active,cache:CACHE,state:loadState()[spec.id]||null}}
async function probeRemote(spec,artifact){const url=registry().directUrl(spec,artifact.path);try{const response=await fetch(url,{method:'HEAD',cache:'no-store',redirect:'follow'});if(!response.ok)return{ok:false,status:response.status,url,bytes:0};return{ok:true,status:response.status,url,bytes:Number(response.headers.get('content-length')||0)}}catch{return{ok:false,status:0,url,bytes:0}}}
async function fetchIntoCache(spec,artifact,{signal}={}){const cache=await caches.open(CACHE),url=registry().directUrl(spec,artifact.path),existing=await cache.match(url);if(existing?.ok){const declared=Number(existing.headers.get('content-length')||0);if(!declared||declared>=artifact.minBytes)return{cached:true,url,bytes:declared}}
  const response=await fetch(url,{cache:'no-store',signal,redirect:'follow'});if(!response.ok){if(!artifact.required&&response.status===404)return{optionalMissing:true,url,bytes:0};throw new Error(`${artifact.path} returned HTTP ${response.status}.`)}
  const type=String(response.headers.get('content-type')||'');if(/text\/html/i.test(type))throw new Error(`${artifact.path} returned HTML instead of model data.`);
  const declared=Number(response.headers.get('content-length')||0);if(declared&&declared<artifact.minBytes)throw new Error(`${artifact.path} was only ${fmt(declared)}; expected a model artifact.`);
  await cache.put(url,response);return{cached:false,url,bytes:declared}}
async function install(id,{signal,onProgress}={}){const spec=model(id);assertInstallable(spec);await requestPersistence();const before=await storage();if(before.available&&before.available<spec.estimatedBytes*1.12)throw new Error(`Not enough browser storage for ${spec.label}. About ${fmt(spec.estimatedBytes)} is needed, with room for cache overhead; ${fmt(before.available)} is currently available.`);
  const state=loadState();state[spec.id]={status:'downloading',startedAt:now(),revision:spec.revision,repo:spec.repo};saveState(state);let completed=0,bytes=0;
  try{for(const artifact of spec.artifacts){onProgress?.({phase:'checking',model:spec,artifact,completed,total:spec.artifacts.length,bytes});const result=await fetchIntoCache(spec,artifact,{signal});completed+=1;bytes+=Number(result.bytes||0);onProgress?.({phase:'cached',model:spec,artifact,completed,total:spec.artifacts.length,bytes,result})}
    const checked=await status(spec.id);if(!checked.available)throw new Error(`${spec.label} download ended without all required artifacts in local Cache Storage.`);state[spec.id]={status:'ready',installedAt:now(),revision:spec.revision,repo:spec.repo,bytes:bytes||spec.estimatedBytes};saveState(state);dispatchEvent(new CustomEvent('civweave:local-model-downloaded',{detail:{version:VERSION,id:spec.id,repo:spec.repo,revision:spec.revision,bytes:state[spec.id].bytes}}));return checked
  }catch(error){state[spec.id]={status:'error',failedAt:now(),revision:spec.revision,repo:spec.repo,error:String(error?.message||error)};saveState(state);throw error}}
async function remove(id){const spec=model(id),cache=await caches.open(CACHE);for(const artifact of spec.artifacts)await cache.delete(registry().directUrl(spec,artifact.path));const state=loadState();delete state[spec.id];saveState(state);const selected=selection();if(selected.id===spec.id)select(null);dispatchEvent(new CustomEvent('civweave:local-model-removed',{detail:{version:VERSION,id:spec.id}}));return status(spec.id)}
function selection(){return parse(localStorage.getItem(SELECTION_KEY),{active:false,id:null})}
function select(id){if(!id){const value={active:false,id:null,updatedAt:now()};localStorage.setItem(SELECTION_KEY,JSON.stringify(value));dispatchEvent(new CustomEvent('civweave:local-model-selection',{detail:value}));return value}const spec=model(id);assertInstallable(spec);const value={active:true,id:spec.id,repo:spec.repo,revision:spec.revision,updatedAt:now()};localStorage.setItem(SELECTION_KEY,JSON.stringify(value));dispatchEvent(new CustomEvent('civweave:local-model-selection',{detail:value}));return value}
async function catalogueStatus(){const output=[];for(const spec of registry().models)output.push(spec.installable?{spec,status:await status(spec.id)}:{spec,status:{available:false,experimental:true}});return output}
const api=Object.freeze({version:VERSION,cache:CACHE,stateKey:STATE_KEY,selectionKey:SELECTION_KEY,install,status,remove,selection,select,storage,requestPersistence,probeRemote,catalogueStatus});
globalThis.CivweaveLocalModelDownloadV266=api;
dispatchEvent(new CustomEvent('civweave:local-model-download-ready',{detail:{version:VERSION,cache:CACHE}}));
})();
