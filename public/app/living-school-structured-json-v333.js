(()=>{
'use strict';
const VERSION='1.0.0-living-school-structured-json-v333';
const ID='living-school-structured-json-v333';
const PURPOSE='living-school-structure-single-v221';
const MODEL='gemini-3.1-flash-lite';
const clean=(value,max=24000)=>String(value??'').trim().slice(0,max);
const isObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
function balanced(text){
  const source=clean(text,5000000).replace(/^```(?:json|javascript|js)?\s*/i,'').replace(/\s*```$/,'').trim();
  for(let start=0;start<source.length;start++){
    const open=source[start];if(open!=='{'&&open!=='[')continue;const close=open==='{'?'}':']';let depth=0,quoted=false,escaped=false;
    for(let i=start;i<source.length;i++){
      const c=source[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"'){quoted=true;continue}if(c===open)depth++;else if(c===close&&--depth===0)return source.slice(start,i+1);
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
function compactContract(request){
  const ids=(Array.isArray(request?.context?.sources)?request.context.sources:[]).map(row=>clean(row?.id,180)).filter(Boolean);
  return `Return ONLY one valid JSON object with exactly {moduleIndex,module}. moduleIndex must be the requested 1-based module number. module must include: title, summary, objective, relevance, estimatedEffort, artifact; non-empty prerequisites, completionCriteria, learningObjectives; concepts as [{term,definition}]; at least 3 lessonBlocks as [{heading,content,sourceIds,provenance}] with substantive content; visualization {title,caption,items:[{label,detail}]}; practice {prompt,steps,deliverable,rubric:[{criterion,weight}],completionCriteria}; quiz {questionsPerAttempt,bank,remediation} with at least 5 questions and all types multiple-choice, multi-select, short-answer; badge {title,description}; navigation {entry,next}; cerbanimoQuest {title,brief,proof}. Do NOT output xp, rewards, Acorns, Buttons, prices, wages, grants, payouts, currency, ledger metadata, video URLs, or media links. sourceIds may contain only: ${ids.length?ids.join(', '):'(none)'}. If material is not supported by those sources, use an empty sourceIds array and provenance generated-unverified. Do not invent citations.`;
}
function base(request){return{schema:'civweave-model-result-1.0',requestId:request.requestId||`ls-v333-${Date.now().toString(36)}`,purpose:PURPOSE,requested:{provider:'gemini',model:MODEL,executionProfile:'interactive'},actual:{provider:'gemini',model:MODEL},diagnostics:[`Living School module construction used ${VERSION}; schema validation remained application-side.`]}}
async function call(request,ctx,messages){
  const transport=globalThis.CivweaveGeminiInteractionsV159?.generateWithInteractions;
  const runtime=ctx?.baseRuntime||globalThis.CivweaveFastInteractiveV192?.base?.();
  if(typeof transport!=='function'||!runtime)throw Object.assign(new Error('Gemini Interactions transport is unavailable.'),{code:'GEMINI_INTERACTIONS_UNAVAILABLE'});
  const config={...(request.config||{}),provider:'gemini',route:'gemini',model:MODEL,stream:false};
  // Deliberately omit request.schema here. Passing the full schema through Gemini response_format caused browser-level fetch failures on the Living School module path. Civweave validates the complete schema locally below.
  const result=await transport(runtime,{...request,executionProfile:'interactive',config,messages,schema:undefined,responseFormat:undefined,maxRepairAttempts:0});
  const text=clean(result?.outputText,5000000);
  if(!text)throw Object.assign(new Error(clean(result?.error?.message||`Gemini Interactions ended with ${result?.status||'no output'}.`,2400)),{code:result?.error?.code||'GEMINI_INTERACTIONS_NO_OUTPUT',status:result?.error?.status});
  return{text,result};
}
async function generate(request,ctx){
  const schema=schemaFor(request),contract=compactContract(request);
  const original=[...(Array.isArray(request.messages)?request.messages:[]),{role:'system',content:contract}];
  let messages=original,last='',json=null,errors=[],lastResult=null;const max=Math.max(0,Math.min(2,Number(request.maxRepairAttempts??2)));
  for(let attempt=0;attempt<=max;attempt++){
    try{
      const response=await call(request,ctx,messages);last=response.text;lastResult=response.result;
      try{json=JSON.parse(balanced(last));errors=validate(json,schema)}catch(error){json=null;errors=[error?.message||'Invalid JSON.']}
      if(!errors.length&&isObject(json?.module))return{...base(request),status:'success',outputText:JSON.stringify(json),outputJson:json,usage:lastResult?.usage||{},stream:{requested:false,used:false},structured:{requested:true,valid:true,repairAttempts:attempt},fallback:{used:false},diagnostics:[...base(request).diagnostics,`Structured JSON validated after ${attempt} repair attempt${attempt===1?'':'s'}.`]};
      if(!errors.length)errors=['$.module must be an object.'];
      if(attempt<max)messages=[...original,{role:'assistant',content:last},{role:'user',content:`Correct the preceding JSON. Return only the corrected object. Fix these application-side validation errors:\n- ${errors.slice(0,12).join('\n- ')}`}];
    }catch(error){return{...base(request),status:'provider-error',outputText:'',usage:{},stream:{requested:false,used:false},structured:{requested:true,valid:false,repairAttempts:attempt},fallback:{used:false},error:{code:clean(error?.code||'LIVING_SCHOOL_INTERACTIONS_FAILED',120),message:clean(error?.message||error,2400),status:error?.status}}}
  }
  return{...base(request),status:'invalid-response',outputText:last,recoverablePayload:json,usage:lastResult?.usage||{},stream:{requested:false,used:false},structured:{requested:true,valid:false,repairAttempts:max,errors:errors.slice(0,24)},fallback:{used:false},error:{code:'INVALID_STRUCTURED_OUTPUT',message:`Living School module JSON did not satisfy the contract: ${errors.slice(0,6).join('; ')}`}};
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;
  spine.unregister?.(ID);
  spine.register(ID,{async handle(request,ctx){
    if(clean(request?.purpose,180)!==PURPOSE)return{handled:false};
    const provider=clean(request?.config?.provider||request?.config?.route,80).toLowerCase();
    if(provider!=='gemini')return{handled:false};
    return{handled:true,result:await generate(request,ctx)};
  }},150);
  try{dispatchEvent(new CustomEvent('civweave:living-school-structured-json-ready',{detail:{version:VERSION,middleware:ID,model:MODEL,providerSchema:false,at:new Date().toISOString()}}))}catch{}
  return true;
}
for(const event of ['civweave:runtime-spine-ready','civweave:gemini-interactions-ready','civweave:gemini-task-router-ready'])addEventListener?.(event,()=>queueMicrotask(install));
install();
globalThis.CivweaveLivingSchoolStructuredJsonV333=Object.freeze({version:VERSION,install,middlewareId:ID,model:MODEL,providerSchema:false});
})();