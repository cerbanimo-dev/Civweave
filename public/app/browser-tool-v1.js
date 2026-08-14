(()=>{
'use strict';
const VERSION='1.0.0-browser-tool-v1';
if(globalThis.CivweaveBrowserToolV1?.version===VERSION)return;
const CAPACITY_SESSION_KEY='civweave.host-capacity.sessions.v1';
const MARKET_PREF_KEY='civweave.node-ai-marketplace.preferences.v1';
const archiveProviders=new Map();
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const storageObject=(storage,key)=>{try{const value=parse(storage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}};
const hostAccess=()=>globalThis.CivweaveHostNodeSessionV1||null;
function capacitySessions(){return storageObject(sessionStorage,CAPACITY_SESSION_KEY)}
function marketPrefs(){return storageObject(localStorage,MARKET_PREF_KEY)}
function usableCapacitySession(){
  const owned=hostAccess()?.sessionFor?.();if(owned)return owned;
  const all=capacitySessions(),preferred=clean(marketPrefs().preferredNodeId,180),rows=Object.values(all).filter(item=>item?.nodeId&&item?.token&&item?.origin&&(!item.expiresAt||Date.parse(item.expiresAt)>Date.now()));
  return rows.find(item=>item.nodeId===preferred)||rows[0]||null;
}
function emit(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}}
function registerArchiveProvider(id,search){
  const key=clean(id,120);if(!key||typeof search!=='function')throw new TypeError('Archive provider requires an id and search function.');
  archiveProviders.set(key,search);emit('civweave:browser-archive-provider',{action:'register',provider:key});
  return()=>{archiveProviders.delete(key);emit('civweave:browser-archive-provider',{action:'unregister',provider:key})};
}
async function knowledgeSchoolSearch(query,{limit=10}={}){
  const module=await import('/app/knowledge-school-runtime-v243.mjs?v=source-links-v260');
  const rows=await module.searchDownloadedKnowledge(query,{limit:Math.max(1,Math.min(30,Number(limit)||10)),maxSchools:8});
  return rows.map(row=>({
    title:clean(row.title||row.articleTitle,320),
    url:clean(row.canonicalUrl||row.url,2400),
    text:clean(row.notes,5000),
    score:Number(row.score||0),
    archive:'knowledge-schools',
    schoolSlug:clean(row.schoolSlug,160),
    schoolName:clean(row.schoolName,240),
    provenance:clean(row.linkProvenance||'downloaded-archive',120),
    liveFetched:false,
  }));
}
registerArchiveProvider('knowledge-schools',knowledgeSchoolSearch);
async function searchArchive(query,{limit=12,providers=null}={}){
  const q=clean(query,1800);if(!q)return{mode:'archive',query:q,results:[],providers:[],offline:true};
  const selected=Array.isArray(providers)&&providers.length?providers.map(value=>clean(value,120)).filter(value=>archiveProviders.has(value)):[...archiveProviders.keys()];
  const rows=[];
  for(const id of selected){
    try{const found=await archiveProviders.get(id)(q,{limit});for(const row of Array.isArray(found)?found:[])rows.push({...row,archive:row.archive||id})}
    catch(error){emit('civweave:browser-archive-error',{provider:id,message:clean(error?.message||error,800)})}
  }
  const seen=new Set(),results=rows.sort((a,b)=>Number(b.score||0)-Number(a.score||0)).filter(row=>{const key=clean(row.url||row.text,1000).toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,Math.max(1,Math.min(40,Number(limit)||12)));
  const packet={schema:'civweave.browser-archive-result.v1',mode:'archive',query:q,results,providers:selected,offline:true,liveFetched:false};
  emit('civweave:browser-archive-search',{query:q,resultCount:results.length,providers:selected});
  return packet;
}
async function live(action,input={},options={}){
  if(options.allowNetwork!==true)throw Object.assign(new Error('Live browser access requires an explicit network allowance from the calling research request.'),{code:'BROWSER_NETWORK_NOT_ALLOWED'});
  if(globalThis.navigator?.onLine===false)throw Object.assign(new Error('The device is offline. Live browser tools are unavailable; use archive_search instead.'),{code:'BROWSER_OFFLINE'});
  const session=usableCapacitySession();
  if(!session)throw Object.assign(new Error('No active host-capacity session is available for live browser tools.'),{code:'BROWSER_HOST_SESSION_REQUIRED'});
  const endpoint=new URL('/api/browser/tool',session.origin);endpoint.searchParams.set('nodeId',session.nodeId);
  const payload={action:clean(action,40),...input};
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${session.token}`,'x-civweave-node-id':session.nodeId},body:JSON.stringify(payload)});
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body?.ok){const error=new Error(clean(body?.error||`Browser tool returned HTTP ${response.status}.`,1200));error.status=response.status;error.code='BROWSER_LIVE_FAILED';throw error}
  const result={...body,mode:'live',networkDisclosure:{sentToHost:payload.action==='search'?['search query']:['target URL'],modelInference:'remained on-device'}};
  emit('civweave:browser-live-tool',{action:payload.action,nodeId:session.nodeId,browserMs:Number(body.browserMs||0)});
  return result;
}
async function search(query,{limit=12,live:useLive=false,allowNetwork=false,archiveFirst=true}={}){
  const archive=archiveFirst?await searchArchive(query,{limit}):null;
  if(!useLive||!allowNetwork||globalThis.navigator?.onLine===false)return archive||searchArchive(query,{limit});
  const liveResult=await live('search',{query:clean(query,1200)},{allowNetwork:true});
  return{schema:'civweave.browser-search-result.v1',mode:'hybrid',query:clean(query,1800),archive,live:liveResult,liveFetched:true};
}
function status(){const session=usableCapacitySession();return Object.freeze({version:VERSION,online:globalThis.navigator?.onLine!==false,archiveProviders:[...archiveProviders.keys()],archiveSearch:true,liveBrowser:Boolean(session),liveNodeId:session?.nodeId||'',modelInference:'local-compatible',networkBoundary:'only explicit tool queries/URLs leave the device'});}
const api=Object.freeze({version:VERSION,registerArchiveProvider,searchArchive,live,search,status,get archiveProviders(){return Object.freeze([...archiveProviders.keys()])}});
globalThis.CivweaveBrowserToolV1=api;
emit('civweave:browser-tool-ready',{status:status()});
})();
