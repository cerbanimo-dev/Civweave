(()=>{
'use strict';
const VERSION='1.0.0-living-school-runtime-route-v330';
const DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const STRUCTURE_PURPOSE='living-school-structure-single-v221';
const LOCAL_SYNTHESIS_PURPOSE='living-school-local-source-synthesis-v260';
const RESEARCH_FALLBACK_PURPOSE='living-school-training-data-research-fallback-v260';
const SMALL_MODEL='gemini-3.1-flash-lite';
const GROUNDED_RESEARCH_MODES=new Set(['live-agentic','local-synthesized','local-downloaded','manual-sources','model-derived-unverified']);
const ECONOMY_KEYS=new Set(['xp','price','prices','pricing','reward','rewards','ledger','currency','currencies','payout','payouts','coin','coins','acorn','acorns','button','buttons','credit','credits','grant','grants','bonus','bonuses','wage','wages','laborvalue','labourvalue']);
let activeBridge=null,activeOuter=null;
const clean=(value,max=24000)=>String(value??'').trim().slice(0,max);
const isObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const lower=value=>clean(value,220).toLowerCase();
function managedPurpose(request={}){
  const purpose=lower(request.purpose);
  if([STRUCTURE_PURPOSE,LOCAL_SYNTHESIS_PURPOSE,RESEARCH_FALLBACK_PURPOSE].includes(purpose))return true;
  return purpose===DESIGN_PURPOSE&&GROUNDED_RESEARCH_MODES.has(lower(request?.context?.research?.mode));
}
function prepare(request={}){
  if(lower(request.purpose)!==DESIGN_PURPOSE||!GROUNDED_RESEARCH_MODES.has(lower(request?.context?.research?.mode)))return request;
  return{
    ...request,
    taskTier:'small',
    executionProfile:'interactive',
    config:{...(request.config||{}),provider:'gemini',route:'gemini',model:SMALL_MODEL},
    context:{...(request.context||{}),livingSchoolGroundedDesign:true,groundedDesignModel:SMALL_MODEL},
    messages:[...(Array.isArray(request.messages)?request.messages:[]),{role:'system',content:'The research/evidence pass is already complete. This is a lightweight instructional-design synthesis pass. Use only the supplied source packet and SOURCE_ID values. Do not perform new research, invent sources, or author Civweave economy/reward metadata.'}]
  };
}
function sourceAllowlist(request={}){
  return(Array.isArray(request?.context?.sources)?request.context.sources:[]).map(source=>({
    id:clean(source?.id,180),title:clean(source?.title,320),url:clean(source?.url,2000),notes:clean(source?.notes,5000)
  })).filter(source=>source.id);
}
function economyKey(key){return ECONOMY_KEYS.has(String(key||'').toLowerCase().replace(/[^a-z]/g,''));}
function stripEconomy(value){
  if(Array.isArray(value))return value.map(stripEconomy);
  if(!isObject(value))return value;
  const output={};for(const [key,child] of Object.entries(value))if(!economyKey(key))output[key]=stripEconomy(child);return output;
}
function collectStrings(value,out=[]){
  if(typeof value==='string'){out.push(value);return out}
  if(Array.isArray(value)){for(const item of value)collectStrings(item,out);return out}
  if(isObject(value))for(const child of Object.values(value))collectStrings(child,out);
  return out;
}
function normalizeUrl(value){try{const url=new URL(clean(value,2400));url.hash='';return url.href}catch{return''}}
function allowlistedName(name,allow,knownText){
  const normalized=clean(name,160).replace(/^[\s"'“”‘’]+|[\s"'“”‘’,:]+$/g,'').trim().toLowerCase();
  if(!normalized)return true;
  if(/^(?:the )?(?:source packet|provided source|supplied source|local source|downloaded source|source material)/.test(normalized))return true;
  if(knownText.includes(normalized))return true;
  return allow.some(source=>{const title=source.title.toLowerCase();return title&&((normalized.length>=4&&title.includes(normalized))||(title.length>=4&&normalized.includes(title)))});
}
function provenanceIssues(module,request){
  const allow=sourceAllowlist(request),knownIds=new Set(allow.map(source=>source.id)),knownUrls=new Set(allow.map(source=>normalizeUrl(source.url)).filter(Boolean)),knownText=allow.map(source=>`${source.title} ${source.notes}`).join(' ').toLowerCase(),issues=[];
  for(const [index,block] of (Array.isArray(module?.lessonBlocks)?module.lessonBlocks:[]).entries())for(const sourceId of Array.isArray(block?.sourceIds)?block.sourceIds:[]){const id=clean(sourceId,180);if(id&&!knownIds.has(id))issues.push(`lesson block ${index+1} cites unknown SOURCE_ID ${id}`)}
  for(const text of collectStrings(module,[])){
    const urlPattern=/https?:\/\/[^\s)\]}>"']+/gi;let urlMatch;while((urlMatch=urlPattern.exec(text))){const url=normalizeUrl(urlMatch[0].replace(/[.,;:!?]+$/,''));if(url&&!knownUrls.has(url))issues.push(`text references URL outside the source allowlist: ${url}`)}
    const attributionPattern=/(?:according to|guidance from|research from|research by|study by|report by|published by|sourced from|cited by)\s+([^.;\n]{2,120})/gi;let attribution;while((attribution=attributionPattern.exec(text)))if(!allowlistedName(attribution[1],allow,knownText))issues.push(`unsupported source attribution: ${clean(attribution[1],120)}`);
    if(/\b(?:Acorn(?:s)?|Button(?:s)?|XP)\b.{0,48}\b(?:grant|bonus|award|value|price|reward|payout|\d+)/i.test(text)||/\b(?:price|pricing|cost|fee|wage|labor value|labour value|payout|grant|bonus|reward)\b.{0,32}(?:\$\s*\d|\d+(?:\.\d+)?\s*(?:USD|dollars?|Acorns?|Buttons?))/i.test(text))issues.push('model-authored Civweave economy decision detected');
  }
  return[...new Set(issues)].slice(0,20);
}
function validateStructure(result,request){
  if(lower(request.purpose)!==STRUCTURE_PURPOSE)return result;
  if(result?.status!=='success')return{...result,outputText:'',diagnostics:[...(result?.diagnostics||[]),'Living School surfaced the structured-runtime failure instead of quarantining it as a generic parse error.']};
  const output=isObject(result?.outputJson)?clone(result.outputJson):null,module=isObject(output?.module)?output.module:null;
  if(!output||!module)return{...result,status:'invalid-response',outputText:'',outputJson:undefined,error:{code:'LIVING_SCHOOL_STRUCTURED_OUTPUT_INVALID',message:'Living School structured generation completed without one usable module object.'}};
  const cleaned=stripEconomy(module),issues=provenanceIssues(cleaned,request);
  if(issues.length)return{...result,status:'invalid-response',outputText:'',outputJson:undefined,error:{code:'LIVING_SCHOOL_MODULE_PROVENANCE_REJECTED',message:`Living School rejected the generated module before storage: ${issues.join('; ')}`},structured:{...(result.structured||{}),valid:false,errors:[...((result.structured?.errors)||[]),...issues]}};
  cleaned.xp={domain:clean(request?.context?.capability,120)||'learning',amount:20};output.module=cleaned;
  return{...result,outputJson:output,outputText:JSON.stringify(output),diagnostics:[...(result.diagnostics||[]),`Living School ${VERSION} provenance/economy boundary passed; deterministic XP attached.`]};
}
async function routedGenerate(outer,spine,request={}){
  if(!managedPurpose(request))return outer.generate(request);
  const prepared=prepare(request);
  const result=await spine.generate(prepared);
  return validateStructure(result,prepared);
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192?.proxy?.(),current=globalThis.CivweaveModelRuntime;
  if(!spine?.generate||!current?.generate)return false;
  if(current.__livingSchoolRuntimeRouteV330===VERSION)return true;
  activeOuter=current;
  const bridge=Object.freeze({...current,__livingSchoolRuntimeRouteV330:VERSION,generate:request=>routedGenerate(current,spine,request)});
  try{Object.defineProperty(globalThis,'CivweaveModelRuntime',{configurable:true,enumerable:true,writable:true,value:bridge})}catch{try{globalThis.CivweaveModelRuntime=bridge}catch{return false}}
  activeBridge=bridge;
  try{dispatchEvent(new CustomEvent('civweave:living-school-runtime-route-ready',{detail:{version:VERSION,managed:[LOCAL_SYNTHESIS_PURPOSE,RESEARCH_FALLBACK_PURPOSE,DESIGN_PURPOSE,STRUCTURE_PURPOSE],model:SMALL_MODEL,at:new Date().toISOString()}}))}catch{}
  return true;
}
function scheduleInstall(){queueMicrotask(()=>{install();setTimeout(install,0);setTimeout(install,120)})}
for(const event of ['civweave:model-runtime-ready','civweave:runtime-spine-ready','civweave:gemini-interactions-ready','civweave:assistant-runtime-ready','pageshow'])addEventListener?.(event,scheduleInstall);
scheduleInstall();
globalThis.CivweaveLivingSchoolRuntimeRouteV1=Object.freeze({version:VERSION,install,managedPurpose,prepare,get bridge(){return activeBridge},get outer(){return activeOuter},model:SMALL_MODEL});
})();