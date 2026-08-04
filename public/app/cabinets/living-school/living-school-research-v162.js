(()=>{
'use strict';
const VERSION='162.0-agentic-research-provenance';
const KEY='commonweave.living-school.cabinet.v151';
const SCHEMA='living-school-cabinet-v151';
const RESEARCHER='living-school-agentic-v162';
const $=(selector,root=document)=>root.querySelector(selector);
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed??fallback}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const clean=value=>String(value??'').trim();
const keyFor=value=>clean(value).toLowerCase().replace(/\s+/g,' ').slice(0,500);
let researching=false;

function readState(){const state=parse(localStorage.getItem(KEY),null);return state?.schema===SCHEMA?state:null}
function writeState(next,type,detail={}){
  next.events=[...(next.events||[]),{id:uid('evt'),type,detail,at:now()}].slice(-200);
  localStorage.setItem(KEY,JSON.stringify(next));
  try{dispatchEvent(new StorageEvent('storage',{key:KEY,newValue:JSON.stringify(next),url:location.href,storageArea:localStorage}))}catch{dispatchEvent(new CustomEvent('living-school:state-replaced',{detail:{state:next}}))}
}
async function waitForLoader(){
  for(let attempt=0;attempt<100;attempt++){
    if(globalThis.CommonweaveFamilyAILoaderV105?.ensure)return globalThis.CommonweaveFamilyAILoaderV105;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error('The shared AI loader did not become ready.');
}
function runtimeResult(result){return result?.outputJson&&typeof result.outputJson==='object'?result.outputJson:null}
function normalizeQuality(value){
  const quality=clean(value).toLowerCase();
  return ['authoritative','practitioner','community','commercial','contested'].includes(quality)?quality:'supporting';
}
function normalizeUse(value){
  const use=clean(value).toLowerCase();
  return ['core','supporting','counterpoint','example'].includes(use)?use:'supporting';
}
function validHttp(value){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)}catch{return false}}
function liveSchema(){return{type:'object',required:['summary','sources'],properties:{summary:{type:'string'},sources:{type:'array',items:{type:'object',required:['title','url','quality','use','notes','liveFetched'],properties:{title:{type:'string'},url:{type:'string'},quality:{type:'string'},use:{type:'string'},notes:{type:'string'},sourceType:{type:'string'},liveFetched:{type:'boolean'}}}}}}}
function fallbackSchema(){return{type:'object',required:['summary','notes'],properties:{summary:{type:'string'},notes:{type:'array',items:{type:'object',required:['title','use','content'],properties:{title:{type:'string'},use:{type:'string'},content:{type:'string'},uncertainty:{type:'string'}}}}}}}
async function ensureRuntime(){
  const loader=await waitForLoader();await loader.ensure();
  const runtime=globalThis.CommonweaveModelRuntime;
  if(!runtime?.generate)throw new Error('The shared model runtime is unavailable.');
  return runtime;
}
async function researchLive(capability){
  const runtime=await ensureRuntime();
  const config=runtime.readSharedConfig?.('agentic')||null;
  const model=clean(config?.model||config?.modelId);
  if(!config||!/antigravity/i.test(model))throw new Error('The agentic profile is not configured for Antigravity.');
  const result=await runtime.generate({
    purpose:'living-school-live-source-research-v162',executionProfile:'agentic',config,schema:liveSchema(),
    context:{capability,requirements:['Use Antigravity web and YouTube tools when available.','Return only pages, papers, official guidance, videos, or practitioner materials actually opened during this run.','Set liveFetched true only after the resource was reached and inspected.','Prefer primary and authoritative sources; include a counterpoint when the topic is contested.','Do not invent URLs, titles, quotations, dates, or access claims.']},
    messages:[
      {role:'system',content:'You are the Living School research agent. Gather a compact, diverse source packet for Moss. Use live internet and YouTube access through the agentic toolchain. Return JSON only. A source that was not actually opened must not appear.'},
      {role:'user',content:`Research the sources needed to teach this capability safely and practically: ${capability}`}
    ]
  });
  if(result?.status!=='success')throw new Error(result?.error?.message||result?.error||`Antigravity ended with ${result?.status||'an error'}.`);
  const output=runtimeResult(result),items=Array.isArray(output?.sources)?output.sources:[];
  const sources=items.filter(source=>source?.liveFetched===true&&validHttp(source.url)&&clean(source.title)).slice(0,12).map(source=>({
    id:uid('source'),title:clean(source.title).slice(0,240),url:clean(source.url).slice(0,2000),quality:normalizeQuality(source.quality),use:normalizeUse(source.use),
    notes:clean(source.notes).slice(0,3000),sourceType:clean(source.sourceType||'web').slice(0,80),at:now(),researchedBy:RESEARCHER,
    provenance:'antigravity-live',verified:true,liveFetched:true,researchCapability:keyFor(capability),provenanceFlag:'LIVE SOURCE FETCHED'
  }));
  if(!sources.length)throw new Error('Antigravity returned no sources it could confirm were opened.');
  return{mode:'live-agentic',summary:clean(output.summary).slice(0,3000),sources,provider:result.actual?.provider||result.provider||config.provider,model:result.actual?.model||result.model||model,flag:'LIVE SOURCES FETCHED'};
}
async function researchFromGeminiTraining(capability,liveError){
  const runtime=await ensureRuntime();
  const config=runtime.readSharedConfig?.('interactive')||null;
  const provider=clean(config?.provider||config?.route).toLowerCase();
  if(!config||provider!=='gemini')throw new Error('A Gemini interactive profile is not configured for the training-data fallback.');
  const result=await runtime.generate({
    purpose:'living-school-training-data-research-fallback-v162',executionProfile:'interactive',config,schema:fallbackSchema(),
    context:{capability,liveResearchFailure:clean(liveError?.message||liveError).slice(0,1000),requirements:['Use model training knowledge only.','Do not claim internet, YouTube, browsing, retrieval, or current verification.','Do not invent URLs, citations, quotations, publication dates, laws, prices, or current availability.','Clearly separate stable background knowledge from items requiring live verification.']},
    messages:[
      {role:'system',content:'You are Moss creating a fallback research brief from Gemini training knowledge because live Antigravity research was unavailable. Return JSON only. This is not a source pack and must be conspicuously flagged as model-derived and unverified.'},
      {role:'user',content:`Generate a compact teaching brief for: ${capability}. Include concepts, practical cautions, and what must later be checked against live authoritative sources.`}
    ]
  });
  if(result?.status!=='success')throw new Error(result?.error?.message||result?.error||`Gemini fallback ended with ${result?.status||'an error'}.`);
  const output=runtimeResult(result),notes=Array.isArray(output?.notes)?output.notes:[];
  const sources=notes.filter(note=>clean(note?.title)&&clean(note?.content)).slice(0,10).map(note=>({
    id:uid('source'),title:`⚑ MODEL-DERIVED: ${clean(note.title).slice(0,200)}`,url:'',quality:'model-derived · unverified',use:normalizeUse(note.use),
    notes:`${clean(note.content).slice(0,2600)}${note.uncertainty?`\nNeeds live verification: ${clean(note.uncertainty).slice(0,800)}`:''}`,
    sourceType:'gemini-training-knowledge',at:now(),researchedBy:RESEARCHER,provenance:'gemini-training-data',verified:false,liveFetched:false,
    researchCapability:keyFor(capability),provenanceFlag:'NO LIVE SOURCE FETCHED · MODEL TRAINING DATA'
  }));
  if(!sources.length)throw new Error('Gemini returned no usable training-data notes.');
  return{mode:'model-derived-unverified',summary:clean(output.summary).slice(0,3000),sources,provider:result.actual?.provider||result.provider||provider,model:result.actual?.model||result.model||config.model,flag:'NO LIVE SOURCE FETCHED · MODEL-DERIVED AND UNVERIFIED',reason:clean(liveError?.message||liveError).slice(0,1000)};
}
function unavailablePacket(capability,error){return{
  mode:'research-unavailable',summary:'Neither live Antigravity research nor the Gemini training-data fallback could run. Curriculum content may still be generated locally, but it has no researched source basis.',
  sources:[{id:uid('source'),title:'⚑ RESEARCH UNAVAILABLE',url:'',quality:'unverified',use:'supporting',notes:clean(error?.message||error).slice(0,2000),sourceType:'status',at:now(),researchedBy:RESEARCHER,provenance:'unavailable',verified:false,liveFetched:false,researchCapability:keyFor(capability),provenanceFlag:'NO RESEARCH CONNECTION'}],
  provider:'none',model:'none',flag:'NO RESEARCH CONNECTION',reason:clean(error?.message||error).slice(0,1000)
}}
async function gather(capability){
  let liveError;
  try{return await researchLive(capability)}catch(error){liveError=error}
  try{return await researchFromGeminiTraining(capability,liveError)}catch(error){return unavailablePacket(capability,new Error(`${liveError?.message||liveError}; ${error.message}`))}
}
function hasCurrentResearch(state,capability){const key=keyFor(capability);return (state?.sources||[]).some(source=>source?.researchedBy===RESEARCHER&&source?.researchCapability===key)}
function storePacket(capability,packet){
  const state=readState();if(!state)return null;
  const manual=(state.sources||[]).filter(source=>source?.researchedBy!==RESEARCHER);
  const next={...state,sources:[...manual,...packet.sources].slice(0,30),research:{capability:keyFor(capability),mode:packet.mode,summary:packet.summary,flag:packet.flag,provider:packet.provider,model:packet.model,reason:packet.reason||'',completedAt:now()}};
  writeState(next,'living-school-research-completed',{capability:keyFor(capability),mode:packet.mode,sourceCount:packet.sources.length,provider:packet.provider,model:packet.model,flag:packet.flag});
  return next;
}
function instrument(){return $('#instrument-content')}
function showPanel(title,body){
  const content=instrument(),dialog=$('#instrument-dialog');if(!content||!dialog)return;
  content.innerHTML=`<h2 id="instrument-title">${esc(title)}</h2>${body}`;
  if(!dialog.open)dialog.showModal();
}
function packetMarkup(packet){return`<div class="ls-callout ${packet.mode==='live-agentic'?'':'ls-warning'}"><strong>${esc(packet.flag)}</strong><br>${esc(packet.summary||'')}</div><div class="ls-list">${packet.sources.map(source=>`<article class="ls-card"><header><strong>${esc(source.title)}</strong><span class="ls-pill ${source.verified?'good':'warn'}">${source.verified?'verified live':'unverified'}</span></header><p>${esc(source.notes||'')}</p>${source.url?`<small>${esc(source.url)}</small>`:''}<small>Provenance: ${esc(source.provenanceFlag)}</small></article>`).join('')}</div>`}
async function runResearch(capability,{show=true}={}){
  if(researching)throw new Error('Living School research is already running.');
  researching=true;
  if(show)showPanel('Researching with Antigravity','<div class="ls-callout">Living School is asking the agentic profile to inspect live web and YouTube sources. Gemini training knowledge is used only as a visibly flagged fallback.</div>');
  try{
    const packet=await gather(capability);storePacket(capability,packet);
    if(show)showPanel('Living School research packet',packetMarkup(packet));
    return packet;
  }finally{researching=false;patchLabels()}
}
function capabilityFromState(){const state=readState();return clean(state?.school?.capability||state?.school?.title)}
function patchLabels(){
  document.querySelectorAll('[data-lsw-action="research"]').forEach(button=>{if(button.textContent!=='Research sources')button.textContent='Research sources'});
  const sourceArea=$('.lsw-sources'),state=readState(),flag=state?.research?.flag;
  if(sourceArea&&flag){let badge=sourceArea.querySelector('[data-lsr-provenance]');if(!badge){badge=document.createElement('span');badge.dataset.lsrProvenance='';badge.className=`lsw-chip ${state.research.mode==='live-agentic'?'':'is-warn'}`;sourceArea.append(badge)}if(badge.textContent!==flag)badge.textContent=flag}
}
function handleResearchClick(event){
  const button=event.target.closest?.('[data-lsw-action="research"]');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  const capability=capabilityFromState();
  if(!capability){showPanel('Research needs a capability','<div class="ls-callout ls-warning">Create or describe the learning capability first. Living School will then gather the source packet itself.</div>');return}
  runResearch(capability).catch(error=>showPanel('Research failed',`<div class="ls-callout ls-error">${esc(error.message)}</div>`));
}
async function prepareForge(event){
  const form=event.target;if(!form?.matches?.('[data-form="forge"]'))return;
  if(form.dataset.lsrResearchReady==='true'){delete form.dataset.lsrResearchReady;return}
  const capability=clean(new FormData(form).get('capability'));if(!capability)return;
  const state=readState();if(hasCurrentResearch(state,capability))return;
  event.preventDefault();event.stopImmediatePropagation();
  const submitter=event.submitter||form.querySelector('button[type="submit"],button:not([type])');
  if(submitter){submitter.disabled=true;submitter.textContent='Researching sources…'}
  try{
    await runResearch(capability,{show:false});
    form.dataset.lsrResearchReady='true';
    if(submitter){submitter.disabled=false;submitter.textContent='Generate curriculum'}
    if(typeof form.requestSubmit==='function')form.requestSubmit(submitter||undefined);else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  }catch(error){
    if(submitter){submitter.disabled=false;submitter.textContent='Generate curriculum'}
    showPanel('Research failed',`<div class="ls-callout ls-error">${esc(error.message)}</div>`);
  }
}
function boot(){
  document.addEventListener('submit',prepareForge,true);
  document.addEventListener('click',handleResearchClick,true);
  const root=$('#stage')||document.body;if(root)new MutationObserver(patchLabels).observe(root,{childList:true,subtree:true});
  patchLabels();
  globalThis.LivingSchoolResearchV162={version:VERSION,gather,runResearch,hasCurrentResearch};
}
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
