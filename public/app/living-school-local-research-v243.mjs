import * as core from './cabinets/living-school/living-school-cleanroom-core-v218.mjs';
import {searchDownloadedKnowledge} from './knowledge-school-runtime-v243.mjs?v=subject-links-v265';

const RESEARCHER='living-school-cleanroom-research-v218.1';
const RELEVANCE_REVISION='living-school-subject-coverage-v265';
const QUERY_STOPWORDS=new Set(['this','that','with','from','into','before','after','their','what','when','where','should','could','would','make','create','write','learn','each','project','projects','lead','leader','foundational','fundamentals','knowledge','strategy','strategies','equip','equipped','objective','capability','beginner','guided']);
const keyFor=value=>core.clean(value,1200).toLowerCase().replace(/\s+/g,' ').slice(0,500);
const queryWords=value=>[...new Set(keyFor(value).replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(word=>word.length>=4&&!QUERY_STOPWORDS.has(word)))].slice(0,12);
const metadataBoundary=/(?:20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z|https?:\/\/\S+|\b[0-9a-f]{40,}\b|W\/"[^"\n]+"|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{2}\s+[A-Z][a-z]{2}\s+20\d{2}\s+\d{2}:\d{2}:\d{2}\s+GMT)/gi;
const validHttp=value=>{try{return['http:','https:'].includes(new URL(value).protocol)}catch{return false}};
const normalizeUse=value=>['core','supporting','counterpoint','example'].includes(core.clean(value,80).toLowerCase())?core.clean(value,80).toLowerCase():'supporting';
const normalizeQuality=value=>['authoritative','practitioner','community','commercial','contested'].includes(core.clean(value,80).toLowerCase())?core.clean(value,80).toLowerCase():'supporting';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function tokenOccurrences(text,token){let count=0,from=0;while(count<12){const index=text.indexOf(token,from);if(index<0)break;count+=1;from=index+token.length}return count;}
function subjectRelevant(title,notes,capability){
  const tokens=queryWords(capability);if(!tokens.length)return false;
  const titleText=core.clean(title,500).toLowerCase(),body=core.clean(notes,5000).toLowerCase(),text=`${titleText} ${body}`;
  const matched=tokens.filter(token=>text.includes(token)),titleHits=matched.filter(token=>titleText.includes(token)).length;
  const occurrences=matched.reduce((sum,token)=>sum+tokenOccurrences(text,token),0),symbolNoise=(body.match(/[!+%#`{}\\]/g)||[]).length;
  if(symbolNoise>18&&titleHits===0)return false;
  if(titleHits>=2)return true;
  if(titleHits>=1&&occurrences>=2)return true;
  return matched.length>=2&&occurrences>=4;
}
function readableScore(text,tokens){
  const normalized=String(text||'').toLowerCase(),words=normalized.match(/[a-z]{2,}/g)||[];
  if(words.length<18)return -Infinity;
  const relevant=tokens.reduce((score,token)=>score+(normalized.includes(token)?80:0),0);
  const letters=(text.match(/[A-Za-z]/g)||[]).length,odd=(text.match(/[^\x20-\x7E\u00A0-\u024F]/g)||[]).length;
  return relevant+Math.min(words.length,180)+letters/40-odd*12;
}
function sanitizePassage(value,capability){
  const raw=String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\uFFFD]/g,' ');
  const tokens=queryWords(capability),segments=raw.split(metadataBoundary).map(part=>part.replace(/\s+/g,' ').trim()).filter(Boolean);
  let best=segments.sort((a,b)=>readableScore(b,tokens)-readableScore(a,tokens))[0]||raw.replace(/\s+/g,' ').trim();
  best=best.replace(/(?:English Wikipedia|CC BY-SA 4\.0|Wikipedia contributors;?\s*see canonical page history)/gi,' ').replace(/\s+/g,' ').trim();
  if(readableScore(best,tokens)===-Infinity)return'';
  if(best.length>1200){
    let cut=best.slice(0,1200),sentence=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('? '),cut.lastIndexOf('! '));
    if(sentence>520)cut=cut.slice(0,sentence+1);
    else cut=cut.replace(/\s+\S*$/,'');
    best=`${cut.trim()}…`;
  }
  return best;
}
function sanitizeRows(capability,rows){
  const seen=new Set(),cleaned=[];
  for(const row of Array.isArray(rows)?rows:[]){
    const notes=sanitizePassage(row?.notes,capability),title=core.clean(row?.articleTitle||row?.title,320);if(!notes||!subjectRelevant(title,notes,capability))continue;
    const fingerprint=notes.toLowerCase().replace(/[^a-z0-9]+/g,' ').slice(0,260);
    if(seen.has(fingerprint))continue;seen.add(fingerprint);
    cleaned.push({...row,notes});
    if(cleaned.length>=10)break;
  }
  return cleaned;
}
function localTitle(row,index){
  const title=core.clean(row?.articleTitle||row?.title,260),school=core.clean(row?.schoolName,180)||'Knowledge school';
  return !title||/downloaded reference$/i.test(title)?`${school} · local passage ${index+1}`:title;
}
function localPacket(capability,rows){
  const key=keyFor(capability),cleanRows=sanitizeRows(capability,rows),sources=cleanRows.map((row,index)=>({
    id:core.uid('source'),
    title:localTitle(row,index),
    url:validHttp(row.canonicalUrl||row.url)?core.clean(row.canonicalUrl||row.url,2000):'',
    quality:'downloaded reference',
    use:'supporting',
    notes:`Downloaded knowledge-school passage. Archive integrity was verified when downloaded; this content is not a live web check.\n\n${core.clean(row.notes,1200)}`,
    sourceType:'knowledge-school-local',
    at:core.now(),
    researchedBy:RESEARCHER,
    provenance:'knowledge-school-downloaded',
    verified:false,
    liveFetched:false,
    researchCapability:key,
    provenanceFlag:'DOWNLOADED SOURCE · ARCHIVE VERIFIED · NOT LIVE-CHECKED',
    schoolSlug:row.schoolSlug,
    schoolName:row.schoolName,
    table:row.table,
    canonicalUrl:validHttp(row.canonicalUrl||row.url)?core.clean(row.canonicalUrl||row.url,2000):'',
    linkProvenance:core.clean(row.linkProvenance,120)||''
  }));
  const linked=sources.filter(source=>source.url).length;
  return{mode:'local-downloaded',summary:`Retrieved ${sources.length} subject-relevant, clean, deduplicated passages from downloaded knowledge schools on this device${linked?`, with ${linked} canonical article link${linked===1?'':'s'}`:''}.`,sources,provider:'local-knowledge-school',model:'dependency-free cached SQLite passage search · canonical source metadata · component-aware subject filter · sanitized passage view',flag:'DOWNLOADED LOCAL SOURCES',reason:''};
}

async function runtimeReady(){
  await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('The shared model runtime is unavailable.');
  return runtime;
}
function resultError(result,label){
  const error=new Error(result?.error?.message||result?.error||`${label} ended with ${result?.status||'an error'}.`);
  error.code=result?.error?.code||'LIVING_SCHOOL_PROVIDER_FAILURE';
  error.status=Number(result?.error?.status||0)||0;
  error.result=result;
  return error;
}
function transientProviderResult(result){
  const status=Number(result?.error?.status||0),message=core.clean(result?.error?.message||'',1200);
  return [429,500,502,503,504].includes(status)||/\b(?:429|500|502|503|504)\b|high demand|temporar(?:y|ily) unavailable|try again later/i.test(message);
}
async function generateWithOneTransientRetry(runtime,request,label){
  let result=await runtime.generate(request);
  if(result?.status==='success'||!transientProviderResult(result))return result;
  await sleep(900);
  result=await runtime.generate({...request,context:{...(request.context||{}),transientRetry:1}});
  return result;
}
function liveResearchSchema(){return{type:'object',required:['summary','sources'],properties:{summary:{type:'string'},sources:{type:'array',items:{type:'object',required:['title','url','quality','use','notes','liveFetched'],properties:{title:{type:'string'},url:{type:'string'},quality:{type:'string'},use:{type:'string'},notes:{type:'string'},sourceType:{type:'string'},liveFetched:{type:'boolean'}}}}}}}
async function researchLive(capability){
  const runtime=await runtimeReady(),config=runtime.readSharedConfig?.('agentic')||null,model=core.clean(config?.model||config?.modelId);
  if(!config||!/antigravity/i.test(model))throw new Error('The agentic profile is not configured for Antigravity live research.');
  const result=await runtime.generate({purpose:'living-school-live-source-research-v260',executionProfile:'agentic',config,schema:liveResearchSchema(),context:{capability,requirements:['Use Antigravity web and YouTube tools when available.','Return only resources actually opened during this run.','Set liveFetched true only after inspection.','Every returned source must preserve its exact opened URL so curriculum citations can link back to it.','Prefer primary and authoritative sources, plus a counterpoint when contested.','Do not invent URLs, titles, quotations, dates, or access claims.']},messages:[{role:'system',content:'You are the Living School research agent working for Moss. Gather a compact source packet before curriculum generation. Return JSON only. A source that was not actually opened must not appear, and every source must retain the exact URL that was opened.'},{role:'user',content:`Research the sources needed to teach this capability safely and practically: ${capability}`}]});
  if(result?.status!=='success')throw resultError(result,'Live research');
  const output=result.outputJson&&typeof result.outputJson==='object'?result.outputJson:{},sources=(Array.isArray(output.sources)?output.sources:[]).filter(source=>source?.liveFetched===true&&validHttp(source.url)&&core.clean(source.title)).slice(0,12).map(source=>({id:core.uid('source'),title:core.clean(source.title,240),url:core.clean(source.url,2000),quality:normalizeQuality(source.quality),use:normalizeUse(source.use),notes:core.clean(source.notes,3000),sourceType:core.clean(source.sourceType||'web',80),at:core.now(),researchedBy:RESEARCHER,provenance:'antigravity-live',verified:true,liveFetched:true,researchCapability:keyFor(capability),provenanceFlag:'LIVE SOURCE FETCHED'}));
  if(!sources.length)throw new Error('Antigravity returned no sources it could confirm were opened.');
  return{mode:'live-agentic',summary:core.clean(output.summary,3000),sources,provider:result.actual?.provider||result.provider||config.provider,model:result.actual?.model||result.model||model,flag:'LIVE SOURCES FETCHED',reason:''};
}

function localSynthesisSchema(){return{type:'object',required:['summary','sourceBriefs','gaps'],properties:{summary:{type:'string'},sourceBriefs:{type:'array',items:{type:'object',required:['sourceId','use','teachingPoints','cautions'],properties:{sourceId:{type:'string'},use:{type:'string'},teachingPoints:{type:'array',items:{type:'string'}},cautions:{type:'array',items:{type:'string'}}}}},gaps:{type:'array',items:{type:'string'}}}}}
async function synthesizeLocalPacket(capability,packet,liveError){
  const runtime=await runtimeReady(),config=runtime.readSharedConfig?.('interactive')||null;
  if(!config)throw new Error('The interactive shared model is unavailable for local-source synthesis.');
  const localSources=packet.sources.map(source=>({id:source.id,title:source.title,url:source.url,schoolName:source.schoolName||'',notes:source.notes}));
  const result=await generateWithOneTransientRetry(runtime,{purpose:'living-school-local-source-synthesis-v260',taskTier:'small',executionProfile:'interactive',config:{...config,maxTokens:Math.max(Number(config.maxTokens)||0,8192),temperature:Math.min(Number(config.temperature)||0.2,0.3)},schema:localSynthesisSchema(),context:{capability,liveResearchFailure:core.clean(liveError?.message||liveError,1200),localSources,requirements:['Use only the supplied local source IDs, canonical URLs, and passage text.','Preserve supplied source IDs and URLs exactly; do not invent, rewrite, or substitute links.','Do not invent quotations, authors, dates, studies, laws, or claims not supported by the supplied passages.','Build a teaching-oriented synthesis that distinguishes source-backed material from inference.','Identify gaps that would benefit from future live verification.','Do not rewrite or alter the source passages.']},messages:[{role:'system',content:'You are Moss synthesizing downloaded Living School references after live research was unavailable. The downloaded passages and their supplied canonical links are the evidence. Return strict JSON. Your synthesis may organize and explain them, but may not invent external facts or pretend the archive was checked live.'},{role:'user',content:`Using only the supplied downloaded school passages, build a compact educational synthesis for this capability: ${capability}. Preserve the supplied source IDs so the later curriculum can cite and link to the actual local references.`}]},'Local-source synthesis');
  if(result?.status!=='success')throw resultError(result,'Local-source synthesis');
  const output=result.outputJson&&typeof result.outputJson==='object'?result.outputJson:{},known=new Set(packet.sources.map(source=>source.id));
  const sourceBriefs=(Array.isArray(output.sourceBriefs)?output.sourceBriefs:[]).filter(row=>known.has(core.clean(row?.sourceId,180))).slice(0,20).map(row=>({sourceId:core.clean(row.sourceId,180),use:normalizeUse(row.use),teachingPoints:(Array.isArray(row.teachingPoints)?row.teachingPoints:[]).map(value=>core.clean(value,900)).filter(Boolean).slice(0,8),cautions:(Array.isArray(row.cautions)?row.cautions:[]).map(value=>core.clean(value,900)).filter(Boolean).slice(0,6)}));
  const gaps=(Array.isArray(output.gaps)?output.gaps:[]).map(value=>core.clean(value,900)).filter(Boolean).slice(0,10);
  const useById=new Map(sourceBriefs.map(row=>[row.sourceId,row.use]));
  const sources=packet.sources.map(source=>({...source,use:useById.get(source.id)||source.use}));
  return{...packet,mode:'local-synthesized',summary:core.clean(output.summary,4000)||packet.summary,sources,provider:'local-knowledge-school+shared-synthesis',model:result.actual?.model||result.model||config.model||'',flag:'LOCAL SOURCES · AI SYNTHESIS · NOT LIVE-CHECKED',reason:core.clean(liveError?.message||liveError,1200),synthesis:{sourceBriefs,gaps,generatedAt:core.now(),provider:result.actual?.provider||result.provider||config.provider||'shared',model:result.actual?.model||result.model||config.model||''}};
}

function fallbackResearchSchema(){return{type:'object',required:['summary','notes'],properties:{summary:{type:'string'},notes:{type:'array',items:{type:'object',required:['title','use','content'],properties:{title:{type:'string'},use:{type:'string'},content:{type:'string'},uncertainty:{type:'string'}}}}}}}
async function researchTrainingFallback(capability,priorError){
  const runtime=await runtimeReady(),config=runtime.readSharedConfig?.('interactive')||null,provider=core.clean(config?.provider||config?.route).toLowerCase();
  if(!config||provider!=='gemini')throw new Error('A Gemini interactive profile is not configured for the training-data fallback.');
  const result=await generateWithOneTransientRetry(runtime,{purpose:'living-school-training-data-research-fallback-v260',taskTier:'small',executionProfile:'interactive',config:{...config,maxTokens:Math.max(Number(config.maxTokens)||0,6144),temperature:Math.min(Number(config.temperature)||0.2,0.3)},schema:fallbackResearchSchema(),context:{capability,priorResearchFailure:core.clean(priorError?.message||priorError,1200),requirements:['Use model training knowledge only.','Do not claim internet, YouTube, browsing, retrieval, or current verification.','Do not invent URLs, citations, quotations, publication dates, laws, prices, or current availability.','Separate stable background knowledge from items requiring live verification.']},messages:[{role:'system',content:'You are Moss creating the final AI research fallback from Gemini training knowledge because neither live research nor downloaded local schools produced usable references. Return JSON only. Every block must be visibly model-derived and unverified.'},{role:'user',content:`Create a compact teaching brief for: ${capability}. Include concepts, practical cautions, and what must later be checked against live authoritative sources.`}]},'Research fallback');
  if(result?.status!=='success')throw resultError(result,'Research fallback');
  const output=result.outputJson&&typeof result.outputJson==='object'?result.outputJson:{},sources=(Array.isArray(output.notes)?output.notes:[]).filter(note=>core.clean(note?.title)&&core.clean(note?.content)).slice(0,10).map(note=>({id:core.uid('source'),title:`⚑ MODEL-DERIVED: ${core.clean(note.title,200)}`,url:'',quality:'model-derived · unverified',use:normalizeUse(note.use),notes:`${core.clean(note.content,2600)}${note.uncertainty?`\nNeeds live verification: ${core.clean(note.uncertainty,800)}`:''}`,sourceType:'gemini-training-knowledge',at:core.now(),researchedBy:RESEARCHER,provenance:'gemini-training-data',verified:false,liveFetched:false,researchCapability:keyFor(capability),provenanceFlag:'NO LIVE OR LOCAL SOURCE · MODEL TRAINING DATA'}));
  if(!sources.length)throw new Error('Gemini returned no usable training-data notes.');
  return{mode:'model-derived-unverified',summary:core.clean(output.summary,3000),sources,provider:result.actual?.provider||result.provider||provider,model:result.actual?.model||result.model||config.model,flag:'NO LIVE OR LOCAL SOURCE · MODEL-DERIVED AND UNVERIFIED',reason:core.clean(priorError?.message||priorError,1200)};
}
function unavailablePacket(capability,error){return{mode:'research-unavailable',summary:'No usable research source is available right now. Living School will not start curriculum generation from an empty or status-only packet. Retry research when the provider is available, download a relevant knowledge school, or add a relevant source manually.',sources:[],provider:'none',model:'none',flag:'NO RESEARCH SOURCE AVAILABLE',reason:core.clean(error?.message||error,1400),retryable:true};}
function manualPacket(s,capability){
  const sources=(s.sources||[]).filter(source=>source?.researchedBy!==RESEARCHER&&(core.clean(source?.title,240)||core.clean(source?.notes,1200)));
  if(!sources.length)return null;
  return{mode:'manual-sources',summary:`Using ${sources.length} manually supplied source${sources.length===1?'':'s'} as the current research packet.`,sources,provider:'manual',model:'user-supplied source packet',flag:'MANUALLY SUPPLIED SOURCES',reason:''};
}
function applyPacket(s,capability,packet){
  const key=keyFor(capability),manual=(s.sources||[]).filter(source=>source?.researchedBy!==RESEARCHER),researchSources=packet.sources||[];
  const generatedResearchSources=packet.mode==='manual-sources'?[]:researchSources;
  s.sources=[...manual,...generatedResearchSources].slice(0,40);
  s.research={capability:key,mode:packet.mode,summary:packet.summary,flag:packet.flag,provider:packet.provider,model:packet.model,reason:packet.reason||'',sourceCount:packet.mode==='manual-sources'?manual.length:generatedResearchSources.length,relevanceRevision:RELEVANCE_REVISION,completedAt:core.now(),synthesis:packet.synthesis||null,retryable:Boolean(packet.retryable)};
  return packet.mode==='manual-sources'?{...packet,sources:manual}:packet;
}

export async function researchCapability(capability,{force=false}={}){
  const normalized=core.clean(capability,1200);
  if(!normalized)throw new Error('Name an observable capability before researching.');
  const s=core.state(),key=keyFor(normalized),cacheableModes=new Set(['live-agentic','local-synthesized','local-downloaded','manual-sources']);
  if(!force&&s.research?.capability===key&&s.research?.relevanceRevision===RELEVANCE_REVISION&&cacheableModes.has(s.research?.mode)){
    if(s.research.mode==='manual-sources'){
      const manual=manualPacket(s,normalized);if(manual)return{...s.research,...manual,reused:true};
    }else{
      const sources=(s.sources||[]).filter(source=>source?.researchedBy===RESEARCHER&&source?.researchCapability===key);
      if(sources.length&&!sources.some(source=>/[\uFFFD\u0000-\u001f]|[0-9a-f]{48,}/i.test(source.notes||'')))return{...s.research,sources,reused:true};
    }
  }

  let liveError;
  try{return applyPacket(s,normalized,await researchLive(normalized))}catch(error){liveError=error}

  let rows=[];
  try{rows=await searchDownloadedKnowledge(normalized,{limit:16,maxSchools:5})}catch(error){console.warn('[Living School downloaded research]',error)}
  if(rows.length){
    let packet=localPacket(normalized,rows);
    if(packet.sources.length){
      try{packet=await synthesizeLocalPacket(normalized,packet,liveError)}catch(error){packet={...packet,reason:`Live research unavailable: ${core.clean(liveError?.message||liveError,700)} Local synthesis unavailable: ${core.clean(error?.message||error,700)}`};}
      return applyPacket(s,normalized,packet);
    }
  }

  let modelError;
  try{return applyPacket(s,normalized,await researchTrainingFallback(normalized,liveError))}catch(error){modelError=error}
  const manual=manualPacket(s,normalized);if(manual)return applyPacket(s,normalized,manual);
  const packet=unavailablePacket(normalized,new Error(`Live research: ${liveError?.message||liveError}; local schools: no usable passages; model fallback: ${modelError?.message||modelError}`));
  applyPacket(s,normalized,packet);
  core.persist('living-school-research-unavailable',{capability:normalized,reason:packet.reason,retryable:true,policy:'stop-before-curriculum-generation'});
  const error=new Error(`Living School research is temporarily unavailable, so Moss stopped before making the research/design or module-generation calls. ${core.clean(modelError?.message||modelError,900)}`);
  error.code='LIVING_SCHOOL_RESEARCH_UNAVAILABLE';error.retryable=true;throw error;
}