(()=>{
'use strict';
const VERSION='1.0.0-living-school-structured-runtime-v334';
const ID='living-school-structured-runtime-v334';
const PURPOSE='living-school-structure-single-v221';
const INTERNAL_PURPOSE='living-school-module-json-draft-v334';
const MODEL='gemini-3.1-flash-lite';
const clean=(value,max=24000)=>String(value??'').trim().slice(0,max);
const isObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
function balanced(text){
  const source=clean(text,5000000).replace(/^```(?:json|javascript|js)?\s*/i,'').replace(/\s*```$/,'').trim();
  for(let start=0;start<source.length;start++){
    const open=source[start];if(open!=='{'&&open!=='[')continue;const close=open==='{'?'}':']';let depth=0,quoted=false,escaped=false;
    for(let i=start;i<source.length;i++){
      const c=source[i];
      if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}
      if(c==='"'){quoted=true;continue}
      if(c===open)depth++;else if(c===close&&--depth===0)return source.slice(start,i+1);
    }
  }
  return source;
}
function validate(value,schema,path='$',errors=[],depth=0){
  if(!isObject(schema)||depth>24||errors.length>40)return errors;
  if(Array.isArray(schema.enum)&&!schema.enum.some(item=>JSON.stringify(item)===JSON.stringify(value))){errors.push(`${path} must match an allowed value.`);return errors}
  const type=Array.isArray(schema.type)?schema.type.find(v=>v!=='null'):schema.type;
  if(type==='object'){
    if(!isObject(value)){errors.push(`${path} must be an object.`);return errors}
    for(const key of Array.isArray(schema.required)?schema.required:[])if(!(key in value))errors.push(`${path}.${key} is required.`);
    for(const [key,child] of Object.entries(isObject(schema.properties)?schema.properties:{}))if(key in value)validate(value[key],child,`${path}.${key}`,errors,depth+1);
  }else if(type==='array'){
    if(!Array.isArray(value)){errors.push(`${path} must be an array.`);return errors}
    if(Number.isFinite(Number(schema.minItems))&&value.length<Number(schema.minItems))errors.push(`${path} needs at least ${schema.minItems} items.`);
    if(Number.isFinite(Number(schema.maxItems))&&value.length>Number(schema.maxItems))errors.push(`${path} allows at most ${schema.maxItems} items.`);
    if(schema.items)value.slice(0,512).forEach((item,index)=>validate(item,schema.items,`${path}[${index}]`,errors,depth+1));
  }else if(type==='string'&&typeof value!=='string')errors.push(`${path} must be a string.`);
  else if(type==='number'&&(typeof value!=='number'||!Number.isFinite(value)))errors.push(`${path} must be a number.`);
  else if(type==='integer'&&!Number.isInteger(value))errors.push(`${path} must be an integer.`);
  else if(type==='boolean'&&typeof value!=='boolean')errors.push(`${path} must be a boolean.`);
  return errors;
}
function schemaFor(request){
  const schema=clone(request.schema||{}),module=schema?.properties?.module;
  if(isObject(module)){
    if(Array.isArray(module.required))module.required=module.required.filter(key=>String(key).toLowerCase()!=='xp');
    if(isObject(module.properties))delete module.properties.xp;
    const ids=(Array.isArray(request?.context?.sources)?request.context.sources:[]).map(row=>clean(row?.id,180)).filter(Boolean);
    const sourceIds=module?.properties?.lessonBlocks?.items?.properties?.sourceIds;
    if(isObject(sourceIds)){sourceIds.items={type:'string',...(ids.length?{enum:ids}:{})};if(!ids.length)sourceIds.maxItems=0}
  }
  return schema;
}
function sourcePacket(request){
  const sources=Array.isArray(request?.context?.sources)?request.context.sources:[];
  return clean(sources.map(source=>`SOURCE_ID ${clean(source?.id,180)}\nTITLE: ${clean(source?.title,320)}\nPROVENANCE: ${clean(source?.provenance,240)||'unspecified'}\nPASSAGE: ${clean(source?.notes,4200)||'(no passage supplied)'}`).join('\n\n'),18000);
}
function requestedIndex(request){const n=Number(request?.context?.requestedModuleNumbers?.[0]);return Number.isInteger(n)&&n>0?n:1}
function contract(request){
  const ids=(Array.isArray(request?.context?.sources)?request.context.sources:[]).map(row=>clean(row?.id,180)).filter(Boolean);
  return `Return ONLY one valid JSON object with exactly {moduleIndex,module}. moduleIndex must be ${requestedIndex(request)}. module must include title, summary, objective, relevance, estimatedEffort, artifact; non-empty prerequisites, completionCriteria, learningObjectives; concepts [{term,definition}]; at least 3 substantive lessonBlocks [{heading,content,sourceIds,provenance}]; visualization {title,caption,items:[{label,detail}]}; practice {prompt,steps,deliverable,rubric:[{criterion,weight}],completionCriteria}; quiz {questionsPerAttempt,bank,remediation} with at least 5 questions spanning multiple-choice, multi-select, and short-answer; badge {title,description}; navigation {entry,next}; cerbanimoQuest {title,brief,proof}. Do not output xp or any Civweave economy metadata. sourceIds may contain only ${ids.length?ids.join(', '):'(none)'}. Unsupported material must use sourceIds:[] and provenance:"generated-unverified". Do not invent citations or URLs.`;
}
function ordinaryRuntime(){const runtime=globalThis.CivweaveModelRuntime;if(!runtime?.generate)throw Object.assign(new Error('The shared model runtime is unavailable for Living School formatting.'),{code:'LIVING_SCHOOL_RUNTIME_UNAVAILABLE'});return runtime}
function internalRequest(request,messages){
  const config={...(request.config||{}),provider:'gemini',route:'gemini',model:MODEL,stream:false,maxTokens:Math.min(10000,Math.max(6000,Number(request?.config?.maxTokens)||8192)),temperature:Math.min(0.25,Number(request?.config?.temperature)||0.2)};
  return{purpose:INTERNAL_PURPOSE,taskTier:'small',executionProfile:'interactive',config,context:{capability:request?.context?.capability,livingSchoolInternalFormatter:true},messages,maxRepairAttempts:0};
}
async function invoke(request,messages){
  const result=await ordinaryRuntime().generate(internalRequest(request,messages));
  const text=clean(result?.outputText||result?.text||result?.output,5000000);
  if(result?.status!=='success'||!text)throw Object.assign(new Error(clean(result?.error?.message||`Living School formatter ended with ${result?.status||'no output'}.`,2400)),{code:result?.error?.code||'LIVING_SCHOOL_FORMATTER_NO_OUTPUT',status:result?.error?.status});
  return{text,result};
}
function base(request){return{schema:'civweave-model-result-1.0',requestId:request.requestId||`ls-v334-${Date.now().toString(36)}`,purpose:PURPOSE,requested:{provider:'gemini',model:MODEL,executionProfile:'interactive'},actual:{provider:'gemini',model:MODEL},diagnostics:[`Living School module construction used ${VERSION} through the ordinary shared runtime path.`]}}
async function generate(request){
  const schema=schemaFor(request),design=clean(request?.context?.designPacket,32000),sources=sourcePacket(request),boundary=contract(request);
  const original=[
    {role:'system',content:'You are Moss’s lightweight Living School formatter. Do not research. Convert the supplied instructional design and source packet into one complete application module. Follow the JSON contract exactly.'},
    {role:'user',content:`${boundary}\n\nRESEARCHED DESIGN PACKET:\n${design||'(no design packet supplied)'}\n\nSOURCE PASSAGES:\n${sources||'(no source passages supplied)'}`}
  ];
  let messages=original,last='',json=null,errors=[],lastResult=null;const max=Math.max(0,Math.min(2,Number(request.maxRepairAttempts??2)));
  for(let attempt=0;attempt<=max;attempt++){
    try{
      const response=await invoke(request,messages);last=response.text;lastResult=response.result;
      try{json=JSON.parse(balanced(last));errors=validate(json,schema)}catch(error){json=null;errors=[error?.message||'Invalid JSON.']}
      if(!errors.length&&isObject(json?.module)){
        json.module.xp={domain:clean(request?.context?.capability,120)||'learning',amount:20};
        return{...base(request),status:'success',outputText:JSON.stringify(json),outputJson:json,usage:lastResult?.usage||{},stream:{requested:false,used:false},structured:{requested:true,valid:true,repairAttempts:attempt},fallback:{used:false},actual:{provider:lastResult?.actual?.provider||'gemini',model:lastResult?.actual?.model||MODEL},diagnostics:[...base(request).diagnostics,`Application-side JSON validation passed after ${attempt} repair attempt${attempt===1?'':'s'}.`]};
      }
      if(!errors.length)errors=['$.module must be an object.'];
      if(attempt<max)messages=[...original,{role:'assistant',content:last},{role:'user',content:`Correct the preceding JSON. Return only the corrected object. Fix these application-side validation errors:\n- ${errors.slice(0,12).join('\n- ')}`}];
    }catch(error){return{...base(request),status:'provider-error',outputText:'',usage:{},stream:{requested:false,used:false},structured:{requested:true,valid:false,repairAttempts:attempt},fallback:{used:false},error:{code:clean(error?.code||'LIVING_SCHOOL_FORMATTER_FAILED',120),message:clean(error?.message||error,2400),status:error?.status}}}
  }
  return{...base(request),status:'invalid-response',outputText:last,recoverablePayload:json,usage:lastResult?.usage||{},stream:{requested:false,used:false},structured:{requested:true,valid:false,repairAttempts:max,errors:errors.slice(0,24)},fallback:{used:false},error:{code:'INVALID_STRUCTURED_OUTPUT',message:`Living School module JSON did not satisfy the contract: ${errors.slice(0,6).join('; ')}`}};
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;
  spine.unregister?.(ID);
  spine.register(ID,{async handle(request){
    if(clean(request?.purpose,180)!==PURPOSE)return{handled:false};
    const provider=clean(request?.config?.provider||request?.config?.route,80).toLowerCase();
    if(provider!=='gemini')return{handled:false};
    return{handled:true,result:await generate(request)};
  }},190);
  try{dispatchEvent(new CustomEvent('civweave:living-school-structured-runtime-ready',{detail:{version:VERSION,middleware:ID,model:MODEL,ordinaryRuntime:true,contextInjected:true,providerSchema:false,at:new Date().toISOString()}}))}catch{}
  return true;
}
for(const event of ['civweave:runtime-spine-ready','civweave:gemini-interactions-ready','civweave:gemini-task-router-ready','civweave:living-school-runtime-route-ready'])addEventListener?.(event,()=>queueMicrotask(install));
install();
globalThis.CivweaveLivingSchoolStructuredRuntimeV334=Object.freeze({version:VERSION,install,middlewareId:ID,model:MODEL,ordinaryRuntime:true,contextInjected:true,providerSchema:false});
})();