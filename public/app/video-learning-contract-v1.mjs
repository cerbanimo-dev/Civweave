const REVISION='civweave-video-learning-contract-v1';
export const FALLBACK_VIDEO_URL='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const LOOKUP_URL='/downloads/knowledge-schools/video-atlases/lookup.json';
const VIDEO_CACHE_NAME='cw-video-learning-atlas-v1';
const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
const copy=value=>{try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}};
const STOP=new Set(['about','after','again','also','been','being','build','could','does','doing','from','have','into','just','make','more','most','other','over','same','some','such','than','that','their','then','there','these','they','this','through','under','using','very','want','what','when','where','which','while','with','would','your']);
let lookupPromise=null;

function words(value){return clean(value,12000).toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>2&&!STOP.has(word));}
function youtubeId(value){
  try{
    const url=new URL(clean(value,600));
    if(url.hostname==='youtu.be')return clean(url.pathname.split('/').filter(Boolean)[0],20);
    if(url.hostname.endsWith('youtube.com')){
      if(url.pathname==='/watch')return clean(url.searchParams.get('v'),20);
      const match=url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/);if(match)return match[1];
    }
  }catch{}
  return'';
}
export function isYoutubeUrl(value){return /^[\w-]{11}$/.test(youtubeId(value));}
export function youtubeEmbedUrl(value){const id=youtubeId(value);return id?`https://www.youtube-nocookie.com/embed/${id}`:'';}
function normalizedVideo(value={}){
  const url=clean(typeof value==='string'?value:value?.url||value?.videoUrl,600);
  if(!isYoutubeUrl(url))return null;
  return{url,title:clean(value?.title,240)||'Video companion',creator:clean(value?.creator||value?.channel,180),reason:clean(value?.reason||value?.relevance,600),source:clean(value?.source,120)||'generated'};
}
async function cachedLookupResponse(){
  if(!('caches'in globalThis))return null;
  try{
    const cache=await caches.open(VIDEO_CACHE_NAME);
    const absolute=typeof location!=='undefined'?new URL(LOOKUP_URL,location.origin).href:LOOKUP_URL;
    return await cache.match(absolute)||await cache.match(LOOKUP_URL)||null;
  }catch{return null}
}
async function networkLookupResponse(){
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timeout=controller?setTimeout(()=>controller.abort(),4000):null;
  try{return await fetch(LOOKUP_URL,{cache:'no-store',signal:controller?.signal})}finally{if(timeout)clearTimeout(timeout)}
}
async function loadLookup(){
  if(lookupPromise)return lookupPromise;
  lookupPromise=(async()=>{
    let response=await cachedLookupResponse();
    if(!response){try{response=await networkLookupResponse()}catch{return[]}}
    if(!response?.ok)return[];
    try{const data=await response.json();return Array.isArray(data?.records)?data.records:[]}catch{return[]}
  })();
  return lookupPromise;
}
function relevanceScore(record,queryWords,schoolSlug=''){
  if(!queryWords.length)return 0;
  const titleWords=new Set(words(record?.title));
  const bodyWords=new Set(words(`${record?.catalog_description||''} ${record?.creator||''}`));
  let score=0;
  for(const word of queryWords){if(titleWords.has(word))score+=6;else if(bodyWords.has(word))score+=2;}
  if(schoolSlug&&record?.school_slug===schoolSlug)score+=3;
  if(record?.source_datasets?.includes?.('youtube-commons'))score+=2;
  return score;
}
export async function resolveRelevantVideo(topic,{schoolSlug=''}={}){
  const queryWords=[...new Set(words(topic))].slice(0,24);
  const records=await loadLookup();
  let best=null,bestScore=0;
  for(const record of records){
    const score=relevanceScore(record,queryWords,schoolSlug);
    if(score>bestScore&&isYoutubeUrl(record?.url)){best=record;bestScore=score;}
  }
  if(best&&bestScore>=6)return{url:best.url,title:clean(best.title,240)||'Video companion',creator:clean(best.creator,180),reason:`Matched the local Video Learning Atlas (${bestScore} relevance points).`,source:'civweave-video-atlas',score:bestScore};
  return{url:FALLBACK_VIDEO_URL,title:'Fallback video companion',creator:'',reason:'No sufficiently relevant catalog video was available for this topic.',source:'required-fallback',score:0};
}
export async function ensureModuleVideo(module,{schoolSlug=''}={}){
  if(!module||typeof module!=='object')return module;
  const existing=(Array.isArray(module.videos)?module.videos:[]).map(normalizedVideo).filter(Boolean)[0]||normalizedVideo(module.video);
  const topic=[module.title,module.objective,module.summary,module.relevance,(module.learningObjectives||[]).join(' '),(module.concepts||[]).map(item=>typeof item==='string'?item:item?.term).join(' ')].filter(Boolean).join(' ');
  const video=existing||await resolveRelevantVideo(topic,{schoolSlug});
  module.video=video;
  module.videos=[video];
  return module;
}
export async function ensureLivingSchool(school,{schoolSlug=''}={}){
  if(!school||typeof school!=='object')return school;
  const modules=Array.isArray(school.modules)?school.modules:[];
  for(const module of modules)await ensureModuleVideo(module,{schoolSlug});
  school.videoContract={revision:REVISION,requiredPerModule:1,fallbackUrl:FALLBACK_VIDEO_URL,checkedAt:new Date().toISOString()};
  return school;
}
export async function ensureCerbanimoAction(action){
  if(!action||action.system!=='cerbanimo')return action;
  const checkpoints=Array.isArray(action.checkpoints)?action.checkpoints:[];
  const existing=Array.isArray(action.checkpointVideos)?action.checkpointVideos:[];
  const videos=[];
  for(let index=0;index<checkpoints.length;index++){
    const current=normalizedVideo(existing[index]);
    videos.push(current||await resolveRelevantVideo(`${action.title||''} ${action.fields?.objective||''} ${checkpoints[index]||''}`,{schoolSlug:'technology'}));
  }
  action.checkpointVideos=videos;
  action.videoContract={revision:REVISION,requiredPerTask:1,fallbackUrl:FALLBACK_VIDEO_URL,checkedAt:new Date().toISOString()};
  action.fields={...(action.fields||{}),videoRequirement:`One embedded relevant video per task/checkpoint. Fallback: ${FALLBACK_VIDEO_URL}`};
  return action;
}
function makeCard(video,label='Video companion'){
  const normalized=normalizedVideo(video);if(!normalized)return null;
  const embed=youtubeEmbedUrl(normalized.url);if(!embed)return null;
  const section=document.createElement('section');section.className='cw-video-contract-card';section.dataset.videoContract=REVISION;
  section.style.cssText='margin:14px 0;padding:12px;border:1px solid currentColor;border-radius:14px;display:grid;gap:9px;';
  const heading=document.createElement('b');heading.textContent=label;
  const frame=document.createElement('iframe');frame.src=embed;frame.title=normalized.title||label;frame.loading='lazy';frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';frame.style.cssText='width:100%;aspect-ratio:16/9;border:0;border-radius:10px;background:#000;';
  const note=document.createElement('small');note.textContent=`${normalized.title}${normalized.reason?` · ${normalized.reason}`:''}`;
  section.append(heading,frame,note);return section;
}
export function renderLivingSchoolEmbed(root,school,activeModuleId){
  if(!root||!school)return false;
  const module=(school.modules||[]).find(item=>item.id===activeModuleId)||school.modules?.[0];if(!module?.video)return false;
  const lesson=root.querySelector('.lsc218-lesson');if(!lesson||lesson.querySelector('[data-video-contract]'))return false;
  const card=makeCard(module.video,'Required module video');if(!card)return false;
  const header=lesson.querySelector(':scope > header');header?.insertAdjacentElement('afterend',card);return true;
}
function findActionByDialog(dialog){
  const id=dialog.querySelector('[data-approve-action]')?.dataset?.approveAction;
  if(id)return globalThis.CivweaveGuideContractsV141?.get?.(id)||null;
  const title=clean(dialog.querySelector('h2')?.textContent,180).toLowerCase();
  return globalThis.CivweaveGuideContractsV141?.items?.().find?.(item=>item?.system==='cerbanimo'&&clean(item.title,180).toLowerCase()===title)||null;
}
async function enhanceActionDialog(dialog){
  if(!dialog?.open||dialog.dataset.videoContractEnhanced==='1')return;
  const action=findActionByDialog(dialog);if(!action)return;
  await ensureCerbanimoAction(action);globalThis.CivweaveGuideContractsV141?.restore?.(copy(action));
  const checkpoints=dialog.querySelectorAll('ol li');
  checkpoints.forEach((li,index)=>{if(li.querySelector('[data-video-contract]'))return;const card=makeCard(action.checkpointVideos?.[index],`Required task video ${index+1}`);if(card)li.append(card);});
  dialog.dataset.videoContractEnhanced='1';
}
export function installCerbanimoHarness(){
  const install=()=>{
    const assistant=globalThis.CivweaveAssistantV141;
    if(assistant?.respond&&!assistant.videoLearningContract){
      const original=assistant.respond.bind(assistant);
      const respond=async args=>{const out=await original(args);if((args?.systemId==='cerbanimo'||out?.action?.system==='cerbanimo')&&out?.action){await ensureCerbanimoAction(out.action);globalThis.CivweaveGuideContractsV141?.restore?.(copy(out.action));}return out;};
      globalThis.CivweaveAssistantV141=Object.freeze({...assistant,respond,videoLearningContract:REVISION});
    }
    document.querySelectorAll('#cw141-action-review').forEach(dialog=>enhanceActionDialog(dialog));
  };
  install();
  const observer=new MutationObserver(install);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  const timer=setInterval(()=>{install();if(globalThis.CivweaveAssistantV141?.videoLearningContract)clearInterval(timer)},250);
  setTimeout(()=>clearInterval(timer),12000);
  return{revision:REVISION,fallbackUrl:FALLBACK_VIDEO_URL};
}
const api=Object.freeze({revision:REVISION,FALLBACK_VIDEO_URL,LOOKUP_URL,VIDEO_CACHE_NAME,isYoutubeUrl,youtubeEmbedUrl,resolveRelevantVideo,ensureModuleVideo,ensureLivingSchool,ensureCerbanimoAction,renderLivingSchoolEmbed,installCerbanimoHarness});
globalThis.CivweaveVideoLearningContractV1=api;
try{dispatchEvent(new CustomEvent('civweave:video-learning-contract-ready',{detail:{revision:REVISION,fallbackUrl:FALLBACK_VIDEO_URL}}))}catch{}
export default api;
