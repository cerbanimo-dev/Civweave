(()=>{
'use strict';
if(globalThis.__civweaveAntigravityLiveSourceGuardV167)return;
globalThis.__civweaveAntigravityLiveSourceGuardV167=true;
const VERSION='167.0-antigravity-live-source-proof';
const KEY='civweave.living-school.cabinet.v151';
const DEFAULT_API_BASE='https://generativelanguage.googleapis.com/v1beta';
const API_REVISION='2026-05-20';
const ACTIVE=new Set(['in_progress','queued','running']);
const TERMINAL_OK=new Set(['completed','succeeded']);
const nativeFetch=globalThis.fetch?.bind(globalThis);
const tracked=new Map();
const latest={};
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed??fallback}catch{return fallback}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function requestUrl(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
function bodyJson(init){if(typeof init?.body!=='string')return null;try{return JSON.parse(init.body)}catch{return null}}
function inputText(value){if(typeof value==='string')return value;if(Array.isArray(value))return value.map(item=>clean(item?.text||item?.content||item?.result||'',4000)).join(' ');return clean(value,4000)}
function liveKind(body){
  const text=inputText(body?.input).toLowerCase();
  if(/civweave live-search verification test|verify the live-search route/.test(text))return'live-test';
  if(/living school source scout|youtube teaching video|actual youtube watch page/.test(text))return'youtube-scout';
  if(/living school research agent|research the sources needed to teach|live internet and youtube access/.test(text))return'source-research';
  return'';
}
function withLongSignal(init){
  const next={...init};
  if(globalThis.AbortSignal?.timeout){try{next.signal=AbortSignal.timeout(300000)}catch{delete next.signal}}
  else delete next.signal;
  return next;
}
function headersObject(headers){const output={};try{new Headers(headers||{}).forEach((value,key)=>output[key]=value)}catch{}return output}
function prepareBody(body,kind){
  const budget=kind==='live-test'?25000:50000;
  return{...body,background:true,store:true,tools:[{type:'google_search'},{type:'url_context'}],agent_config:{...(body.agent_config||{}),type:'antigravity',max_total_tokens:String(Math.max(Number(body.agent_config?.max_total_tokens)||0,budget))}};
}
function normalizeUrl(value){
  try{const url=new URL(value);url.hash='';if(url.hostname.toLowerCase().replace(/^www\./,'')==='youtube.com'&&url.pathname==='/watch'){const id=url.searchParams.get('v');return id?`youtube:${id}`:url.href}if(url.hostname.toLowerCase().replace(/^www\./,'')==='youtu.be'){const id=url.pathname.split('/').filter(Boolean)[0];return id?`youtube:${id}`:url.href}url.hostname=url.hostname.toLowerCase();url.pathname=url.pathname.replace(/\/+$/,'')||'/';return url.href}catch{return''}
}
function retrievedUrlsDeep(value,inheritedOk=true,output=[]){
  if(!value||output.length>100)return output;
  if(Array.isArray(value)){value.forEach(item=>retrievedUrlsDeep(item,inheritedOk,output));return output}
  if(typeof value!=='object')return output;
  const status=clean(value.status||value.state||'',80).toLowerCase();
  const ok=inheritedOk&&(!status||/success|retrieved|complete|ok|200/.test(status));
  for(const[key,child]of Object.entries(value)){
    if(ok&&['retrieved_url','retrievedUrl'].includes(key)&&typeof child==='string'&&/^https?:\/\//i.test(child))output.push(child);
    else if(ok&&key==='url'&&status&&typeof child==='string'&&/^https?:\/\//i.test(child))output.push(child);
    else retrievedUrlsDeep(child,ok,output);
  }
  return output;
}
function evidenceFromPayload(payload){
  const steps=Array.isArray(payload?.steps)?payload.steps:[];
  const queries=[];
  const retrieved=[];
  const cited=[];
  let searchUsed=false,urlContextUsed=false;
  for(const step of steps){
    const type=clean(step?.type,120).toLowerCase();
    if(type==='google_search_call'||type.includes('google_search_call')){
      searchUsed=true;
      const values=step?.arguments?.queries||step?.queries||step?.query;
      (Array.isArray(values)?values:[values]).filter(Boolean).forEach(value=>queries.push(clean(value,500)));
    }
    if(type==='google_search_result'||type.includes('google_search_result'))searchUsed=true;
    if(type==='url_context_result'||type.includes('url_context_result')){
      const status=clean(step?.result?.status||step?.status||'',80).toLowerCase();
      if(!status||/success|retrieved|complete|ok|200/.test(status)){
        const found=retrievedUrlsDeep(step?.result??step,true,[]);
        if(found.length){urlContextUsed=true;retrieved.push(...found)}
      }
    }
    if(type==='model_output')for(const item of Array.isArray(step.content)?step.content:[]){
      for(const annotation of Array.isArray(item?.annotations)?item.annotations:[])if(annotation?.type==='url_citation'&&annotation.url)cited.push(annotation.url);
    }
  }
  return{searchUsed,urlContextUsed,queries:[...new Set(queries)],retrievedUrls:[...new Set(retrieved)],citedUrls:[...new Set(cited)]};
}
function verifiedUrl(url,evidence){const target=normalizeUrl(url);return Boolean(target&&evidence.searchUsed&&evidence.urlContextUsed&&evidence.retrievedUrls.some(item=>normalizeUrl(item)===target))}
function patchJsonObject(value,evidence,kind){
  if(!value||typeof value!=='object')return value;
  if(Array.isArray(value.sources))value.sources=value.sources.map(source=>{const live=verifiedUrl(source?.url,evidence);return{...source,liveFetched:live,verification:live?'google_search + url_context confirmed':'No matching successful URL Context retrieval was found in the interaction steps.'}});
  if(Array.isArray(value.modules))value.modules=value.modules.map(module=>{const video=module?.video;if(!video||typeof video!=='object')return module;const opened=verifiedUrl(video.youtubeUrl||video.url,evidence);return{...module,video:{...video,opened,reason:opened?clean(video.reason,800):clean(video.reason||'Antigravity did not return step-level proof that this YouTube page was retrieved with URL Context.',800)}}});
  value.liveVerification={kind,searchUsed:evidence.searchUsed,urlContextUsed:evidence.urlContextUsed,queries:evidence.queries,retrievedUrls:evidence.retrievedUrls,verifiedAt:new Date().toISOString()};
  return value;
}
function patchText(text,evidence,kind){
  const source=clean(text,500000);const unwrapped=source.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const start=unwrapped.indexOf('{'),end=unwrapped.lastIndexOf('}');if(start<0||end<start)return text;
  try{const object=JSON.parse(unwrapped.slice(start,end+1));const patched=JSON.stringify(patchJsonObject(object,evidence,kind));return `${unwrapped.slice(0,start)}${patched}${unwrapped.slice(end+1)}`}catch{return text}
}
function enforcePayload(payload,kind){
  const evidence=evidenceFromPayload(payload);
  const next=typeof structuredClone==='function'?structuredClone(payload):JSON.parse(JSON.stringify(payload));
  if(typeof next.output_text==='string')next.output_text=patchText(next.output_text,evidence,kind);
  if(Array.isArray(next.steps))next.steps=next.steps.map(step=>step?.type==='model_output'?{...step,content:(Array.isArray(step.content)?step.content:[]).map(item=>typeof item?.text==='string'?{...item,text:patchText(item.text,evidence,kind)}:item)}:step);
  next.civweave_live_verification={...evidence,kind,verifiedAt:new Date().toISOString()};
  latest[kind]={payload:next,evidence,at:new Date().toISOString()};
  return next;
}
function responseWithJson(response,payload){const headers=new Headers(response.headers);headers.set('content-type','application/json; charset=utf-8');headers.delete('content-length');return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers})}
async function parseClone(response){try{return await response.clone().json()}catch{return null}}
async function pollNative(meta,id){
  let response,payload;
  do{await sleep(1800);response=await nativeFetch(`${meta.base}/${encodeURIComponent(id)}`,{method:'GET',headers:meta.headers,cache:'no-store',credentials:'omit'});payload=await response.clone().json().catch(()=>({}));if(!response.ok)throw new Error(clean(payload?.error?.message||payload?.message||`Antigravity polling returned HTTP ${response.status}.`,1600))}while(ACTIVE.has(clean(payload?.status,80).toLowerCase()));
  return{response,payload};
}
async function continueIncomplete(meta,payload){
  let current=payload;
  const accumulated=[...(Array.isArray(payload?.steps)?payload.steps:[])];
  for(let turn=0;turn<2&&clean(current?.status,80).toLowerCase()==='incomplete';turn++){
    const environment=current.environment_id||current.environment;
    if(!current.id||!environment)break;
    const body={agent:current.agent||meta.agent||'antigravity-preview-05-2026',input:'Continue. Finish the requested live-source JSON. Use Google Search and URL Context, and do not mark any URL opened or live unless the URL Context step actually retrieved it.',previous_interaction_id:current.id,environment,background:true,store:true,tools:[{type:'google_search'},{type:'url_context'}],agent_config:{type:'antigravity',max_total_tokens:'50000'}};
    const response=await nativeFetch(meta.base,{method:'POST',headers:meta.headers,body:JSON.stringify(body),cache:'no-store',credentials:'omit'});current=await response.clone().json().catch(()=>({}));if(!response.ok)throw new Error(clean(current?.error?.message||current?.message||`Antigravity continuation returned HTTP ${response.status}.`,1600));if(ACTIVE.has(clean(current.status,80).toLowerCase()))current=(await pollNative(meta,current.id)).payload;accumulated.push(...(Array.isArray(current?.steps)?current.steps:[]));
  }
  return{...current,steps:accumulated};
}
async function guardedFetch(input,init={}){
  if(!nativeFetch)return Promise.reject(new Error('Fetch is unavailable.'));
  const url=requestUrl(input),method=clean(init.method||(typeof input!=='string'&&input?.method)||'GET',20).toUpperCase();
  if(!url||!/\/interactions(?:\/[^/?#]+)?$/.test(url.pathname))return nativeFetch(input,init);
  if(method==='POST'&&/\/interactions$/.test(url.pathname)){
    const raw=bodyJson(init),kind=liveKind(raw);
    if(!kind)return nativeFetch(input,init);
    const body=prepareBody(raw,kind),next=withLongSignal({...init,body:JSON.stringify(body)}),response=await nativeFetch(input,next);let payload=await parseClone(response);
    const meta={kind,base:url.href.replace(/\/+$/,''),headers:headersObject(next.headers),agent:body.agent,startedAt:Date.now()};
    if(payload?.id)tracked.set(payload.id,meta);
    if(!payload)return response;
    if(clean(payload.status,80).toLowerCase()==='incomplete')payload=await continueIncomplete(meta,payload);
    if(TERMINAL_OK.has(clean(payload.status||'',80).toLowerCase()))return responseWithJson(response,enforcePayload(payload,kind));
    return response;
  }
  if(method==='GET'){
    const id=decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1)||''),meta=tracked.get(id);if(!meta)return nativeFetch(input,init);
    const response=await nativeFetch(input,withLongSignal(init));let payload=await parseClone(response);if(!payload)return response;
    if(clean(payload.status,80).toLowerCase()==='incomplete')payload=await continueIncomplete(meta,payload);
    if(TERMINAL_OK.has(clean(payload.status||'completed',80).toLowerCase()))payload=enforcePayload(payload,meta.kind);
    return responseWithJson(response,payload);
  }
  return nativeFetch(input,init);
}
function hostProxyBase(){const connected=clean(parse(localStorage.getItem('civweave.host-node.v1'),{})?.baseUrl,2048).replace(/\/+$/,'');const hostedHere=Boolean(location&&/^https?:$/.test(location.protocol)&&location.pathname.startsWith('/app/'));return connected||(hostedHere?location.origin:'')}
function interactionsUrl(config){const proxy=hostProxyBase();if(proxy)return`${proxy}/api/ai/gemini/interactions`;return`${clean(config.endpoint||DEFAULT_API_BASE,2048).replace(/\/+$/,'')}/interactions`}
function interactionHeaders(config){return{'content-type':'application/json','accept':'application/json','x-goog-api-key':config.apiKey,'Api-Revision':API_REVISION,...(config.headers&&typeof config.headers==='object'?config.headers:{})}}
async function runLiveSearchTest(){
  const runtime=globalThis.CivweaveModelRuntime,config=runtime?.readSharedConfig?.('agentic');const model=clean(config?.model||config?.modelId,200);
  if(!config||!/antigravity/i.test(model))throw new Error('Enable and save Antigravity first.');if(!config.apiKey)throw new Error('Load a Gemini API key for this browser session.');if(!config.externalConsent)throw new Error('Enable Gemini request consent first.');
  const url=interactionsUrl(config),headers=interactionHeaders(config),body={agent:/^antigravity-/i.test(model)?model:'antigravity-preview-05-2026',input:'Civweave live-search verification test. Use Google Search to find the official Google AI documentation page for Antigravity Agent, then use URL Context to open that exact page. Return JSON only: {"status":"READY","openedUrl":"the exact URL you retrieved"}.',environment:'remote',background:true,store:true,tools:[{type:'google_search'},{type:'url_context'}],agent_config:{type:'antigravity',max_total_tokens:'25000'}};
  let response=await globalThis.fetch(url,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store',credentials:'omit'}),payload=await response.json();if(!response.ok)throw new Error(clean(payload?.error?.message||payload?.message||`Antigravity returned HTTP ${response.status}.`,1600));if(!payload.id)throw new Error('Antigravity returned no interaction ID.');while(ACTIVE.has(clean(payload.status,80).toLowerCase())){await sleep(1800);response=await globalThis.fetch(`${url}/${encodeURIComponent(payload.id)}`,{headers,cache:'no-store',credentials:'omit'});payload=await response.json();if(!response.ok)throw new Error(clean(payload?.error?.message||payload?.message||`Antigravity polling returned HTTP ${response.status}.`,1600))}
  const evidence=payload.civweave_live_verification||evidenceFromPayload(payload);if(!evidence.searchUsed)throw new Error('Antigravity answered, but no Google Search call appeared in its execution steps.');if(!evidence.urlContextUsed||!evidence.retrievedUrls?.length)throw new Error('Antigravity searched, but no successful URL Context retrieval appeared in its execution steps.');return{model:body.agent,...evidence};
}
function patchSettings(){
  document.querySelectorAll('[data-test-antigravity]').forEach(button=>{button.textContent='Test Antigravity connection';const parent=button.parentElement;if(!parent||parent.parentElement?.querySelector('[data-live-search-test-wrap]'))return;const wrap=document.createElement('div');wrap.dataset.liveSearchTestWrap='';wrap.innerHTML='<button type="button" data-test-antigravity-live>Test live search</button><output class="cw-ai-test-status" data-test-status="antigravity-live" role="status">No live-search test has run.</output>';parent.insertAdjacentElement('afterend',wrap)});
  const state=parse(localStorage.getItem(KEY),null),badge=document.querySelector('[data-lsr-provenance]');if(badge){let reason=badge.parentElement?.querySelector('[data-live-source-reason]');if(state?.research?.mode!=='live-agentic'&&state?.research?.reason){if(!reason){reason=document.createElement('small');reason.dataset.liveSourceReason='';badge.insertAdjacentElement('afterend',reason)}reason.textContent=`Live research fallback: ${clean(state.research.reason,1000)}`}else reason?.remove()}
}
async function handleLiveTest(event){const button=event.target.closest?.('[data-test-antigravity-live]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();const status=button.parentElement.querySelector('[data-test-status="antigravity-live"]');button.disabled=true;status.textContent='Running Google Search, then opening a result with URL Context…';status.className='cw-ai-test-status';try{const result=await runLiveSearchTest();const host=(()=>{try{return new URL(result.retrievedUrls[0]).hostname}catch{return'retrieved source'}})();status.textContent=`Live search verified with ${result.model}: Google Search ran and URL Context opened ${host}.`;status.className='cw-ai-test-status is-ok'}catch(error){status.textContent=`Live-search test failed: ${error.message}`;status.className='cw-ai-test-status is-error'}finally{button.disabled=false}}
function boot(){if(nativeFetch&&globalThis.fetch!==guardedFetch)globalThis.fetch=guardedFetch;document.addEventListener('click',handleLiveTest,true);const root=document.documentElement;new MutationObserver(patchSettings).observe(root,{childList:true,subtree:true});addEventListener('storage',event=>{if(event.key===KEY)patchSettings()});patchSettings();globalThis.CivweaveAntigravityLiveSourceGuardV167={version:VERSION,evidenceFromPayload,verifiedUrl,enforcePayload,runLiveSearchTest,latest}}
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
