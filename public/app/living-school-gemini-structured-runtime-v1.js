(()=>{
'use strict';
const VERSION='1.0.0-living-school-gemini-structured-v329';
const ID='living-school-gemini-structured-v329';
const DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const POST_FALLBACK_DESIGN_PURPOSE='living-school-post-fallback-design-lite-v329';
const STRUCTURE_PURPOSE='living-school-structure-single-v221';
const SMALL_MODEL='gemini-3.1-flash-lite';
const DEFAULT_BASE='https://generativelanguage.googleapis.com/v1beta';
const DROP_SCHEMA_KEYS=new Set(['$schema','$id','$defs','definitions','examples','default','additionalProperties','patternProperties','unevaluatedProperties','dependentSchemas','propertyNames','contentEncoding','contentMediaType','minContains','maxContains','if','then','else','not','exclusiveMinimum','exclusiveMaximum','multipleOf','minProperties','maxProperties','uniqueItems','contains']);
if(globalThis.CivweaveLivingSchoolGeminiStructuredV1?.version===VERSION)return;
const clean=(value,max=24000)=>String(value??'').trim().slice(0,max);
const isObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
function sanitizeSchema(value,depth=0){
  if(depth>18)return{};
  if(Array.isArray(value))return value.slice(0,256).map(item=>sanitizeSchema(item,depth+1));
  if(!isObject(value))return value;
  const output={};
  const union=Array.isArray(value.anyOf)?value.anyOf:Array.isArray(value.oneOf)?value.oneOf:null;
  if(union?.length){const chosen=union.find(item=>isObject(item)&&item.type!=='null')||union[0];Object.assign(output,sanitizeSchema(chosen,depth+1));}
  for(const [key,child] of Object.entries(value)){
    if(DROP_SCHEMA_KEYS.has(key)||key==='anyOf'||key==='oneOf')continue;
    if(key==='const'){output.enum=[sanitizeSchema(child,depth+1)];continue;}
    if(key==='type'&&Array.isArray(child)){output.type=child.find(type=>type!=='null')||child[0];continue;}
    output[key]=sanitizeSchema(child,depth+1);
  }
  return output;
}
function prepareStructureSchema(request){
  const schema=sanitizeSchema(clone(request.schema||{}));
  const moduleSchema=schema?.properties?.module;
  if(isObject(moduleSchema)){
    if(Array.isArray(moduleSchema.required))moduleSchema.required=moduleSchema.required.filter(key=>String(key).toLowerCase()!=='xp');
    if(isObject(moduleSchema.properties))delete moduleSchema.properties.xp;
    const ids=(Array.isArray(request?.context?.sources)?request.context.sources:[]).map(source=>clean(source?.id,180)).filter(Boolean);
    const sourceIds=moduleSchema?.properties?.lessonBlocks?.items?.properties?.sourceIds;
    if(isObject(sourceIds)){
      sourceIds.items={type:'string',...(ids.length?{enum:ids}:{})};
      if(!ids.length)sourceIds.maxItems=0;
    }
  }
  return schema;
}
function firstBalancedJson(text){
  const source=clean(text,5000000).replace(/^```(?:json|javascript|js)?\s*/i,'').replace(/\s*```$/,'').trim();
  for(let start=0;start<source.length;start++){
    const opener=source[start];if(opener!=='{'&&opener!=='[')continue;const closer=opener==='{'?'}':']';let depth=0,quoted=false,escaped=false;
    for(let i=start;i<source.length;i++){
      const char=source[i];
      if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
      if(char==='"'){quoted=true;continue;}
      if(char===opener)depth++;else if(char===closer){depth--;if(depth===0)return source.slice(start,i+1);}
    }
  }
  return source;
}
function parseJsonLoose(text){return JSON.parse(firstBalancedJson(text));}
function validate(value,schema,path='$',errors=[],depth=0){
  if(!isObject(schema)||depth>24||errors.length>40)return errors;
  if(Array.isArray(schema.enum)&&!schema.enum.some(item=>JSON.stringify(item)===JSON.stringify(value))){errors.push(`${path} must match an allowed value.`);return errors;}
  const type=Array.isArray(schema.type)?schema.type.find(item=>item!=='null'):schema.type;
  if(type==='object'){
    if(!isObject(value)){errors.push(`${path} must be an object.`);return errors;}
    for(const key of Array.isArray(schema.required)?schema.required:[])if(!(key in value))errors.push(`${path}.${key} is required.`);
    for(const [key,child] of Object.entries(isObject(schema.properties)?schema.properties:{}))if(key in value)validate(value[key],child,`${path}.${key}`,errors,depth+1);
  }else if(type==='array'){
    if(!Array.isArray(value)){errors.push(`${path} must be an array.`);return errors;}
    if(Number.isFinite(Number(schema.minItems))&&value.length<Number(schema.minItems))errors.push(`${path} must contain at least ${schema.minItems} items.`);
    if(Number.isFinite(Number(schema.maxItems))&&value.length>Number(schema.maxItems))errors.push(`${path} must contain no more than ${schema.maxItems} items.`);
    if(schema.items)value.slice(0,512).forEach((item,index)=>validate(item,schema.items,`${path}[${index}]`,errors,depth+1));
  }else if(type==='string'&&typeof value!=='string')errors.push(`${path} must be a string.`);
  else if(type==='number'&&(typeof value!=='number'||!Number.isFinite(value)))errors.push(`${path} must be a number.`);
  else if(type==='integer'&&!Number.isInteger(value))errors.push(`${path} must be an integer.`);
  else if(type==='boolean'&&typeof value!=='boolean')errors.push(`${path} must be a boolean.`);
  return errors;
}
function endpoint(config){
  let base=clean(config?.endpoint||DEFAULT_BASE,2048).replace(/\/+$/,'').replace(/\/interactions(?:\/.*)?$/,'');
  if(!/^https:\/\/generativelanguage\.googleapis\.com\/v1(?:beta)?$/i.test(base))base=DEFAULT_BASE;
  return`${base}/models/${encodeURIComponent(config.model||SMALL_MODEL)}:generateContent`;
}
function messages(request){
  const rows=Array.isArray(request.messages)?request.messages:[];
  const system=rows.filter(row=>row?.role==='system').map(row=>clean(row.content,48000)).filter(Boolean).join('\n\n');
  const contents=rows.filter(row=>row?.role!=='system').map(row=>({role:row?.role==='assistant'?'model':'user',parts:[{text:clean(row?.content,48000)}]})).filter(row=>row.parts[0].text);
  if(!contents.length)contents.push({role:'user',parts:[{text:'Continue.'}]});
  return{system,contents};
}
async function post(config,request,rows,schema){
  const generationConfig={temperature:Number.isFinite(Number(config.temperature))?Number(config.temperature):0.2,maxOutputTokens:Math.max(1,Number(config.maxTokens||request?.config?.maxTokens||4096))};
  if(schema){generationConfig.responseMimeType='application/json';generationConfig.responseJsonSchema=schema;}
  const body={contents:rows.contents,generationConfig,...(rows.system?{systemInstruction:{parts:[{text:rows.system}]}}:{})};
  const response=await fetch(endpoint(config),{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':config.apiKey,...(isObject(config.headers)?config.headers:{})},body:JSON.stringify(body),signal:request.signal,cache:'no-store'});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{throw Object.assign(new Error('Gemini returned invalid transport JSON.'),{code:'INVALID_PROVIDER_JSON',status:response.status});}
  if(!response.ok)throw Object.assign(new Error(clean(payload?.error?.message||`Gemini generateContent returned HTTP ${response.status}.`,2400)),{code:payload?.error?.code||'GEMINI_GENERATE_CONTENT_HTTP_ERROR',status:response.status});
  const output=(Array.isArray(payload?.candidates)?payload.candidates:[]).flatMap(candidate=>Array.isArray(candidate?.content?.parts)?candidate.content.parts:[]).map(part=>typeof part?.text==='string'?part.text:'').filter(Boolean).join('');
  if(!output)throw new Error('Gemini generateContent returned no text output.');
  return{output,payload};
}
function usage(payload){const source=payload?.usageMetadata||payload?.usage||{};return{inputTokens:Number(source.promptTokenCount||source.input_tokens||0)||0,outputTokens:Number(source.candidatesTokenCount||source.output_tokens||0)||0,totalTokens:Number(source.totalTokenCount||source.total_tokens||0)||0,costCents:0,remainingCents:0};}
function resultBase(request,config){return{schema:'civweave-model-result-1.0',requestId:request.requestId||`living-school-${Date.now().toString(36)}`,purpose:clean(request.purpose,160),requested:{provider:'gemini',model:config.model,endpoint:config.endpoint||DEFAULT_BASE,executionProfile:request.executionProfile||'interactive'},actual:{provider:'gemini',model:config.model},diagnostics:[`Living School used ${VERSION} for the post-research Gemini construction pass.`]};}
async function generateStructured(request,config){
  const schema=prepareStructureSchema(request),base=resultBase(request,config),baseRows=messages({...request,messages:[...(request.messages||[]),{role:'system',content:'Living School construction boundary: do not output XP, Acorns, Buttons, prices, payouts, wages, bonuses, grants, labor values, currency values, or ledger metadata. Civweave attaches deterministic XP after content validation. Use only supplied SOURCE_ID values.'}]});
  let rows=baseRows,attempt=0,lastText='',outputJson=null,errors=[];const maxAttempts=Math.max(0,Math.min(2,Number(request.maxRepairAttempts??2)));
  while(true){
    const {output,payload}=await post(config,request,rows,schema);lastText=output;
    try{outputJson=parseJsonLoose(output);errors=validate(outputJson,schema);}catch(error){errors=[error?.message||'Invalid JSON.'];outputJson=null;}
    if(!errors.length){
      if(!isObject(outputJson?.module))errors=['$.module must be an object.'];
      else{
        outputJson.module.xp={domain:clean(request?.context?.capability,120)||'learning',amount:20};
        return{...base,status:'success',outputText:JSON.stringify(outputJson),outputJson,usage:usage(payload),stream:{requested:false,used:false},structured:{requested:true,valid:true,repairAttempts:attempt},fallback:{used:false}};
      }
    }
    if(attempt>=maxAttempts)return{...base,status:'invalid-response',outputText:lastText,recoverablePayload:outputJson,usage:usage(payload),stream:{requested:false,used:false},structured:{requested:true,valid:false,repairAttempts:attempt,errors:errors.slice(0,24)},fallback:{used:false},error:{code:'INVALID_STRUCTURED_OUTPUT',message:`Living School module JSON did not satisfy the required contract: ${errors.slice(0,6).join('; ')}`}};
    attempt++;
    rows=messages({messages:[...(request.messages||[]),{role:'assistant',content:lastText},{role:'user',content:`Correct the preceding module JSON. Return only one schema-matching JSON object. Fix these validation issues:\n- ${errors.slice(0,12).join('\n- ')}`}]});
  }
}
async function generateDesign(request,config){
  const rows=messages({...request,messages:[...(request.messages||[]),{role:'system',content:'Do not discuss or restate Civweave rewards, XP, Acorns, Buttons, prices, grants, payouts, wages, currency, labor valuation, or ledger policy. Produce instructional design content only.'}]});
  const {output,payload}=await post(config,request,rows,null),base=resultBase(request,config);
  return{...base,status:'success',outputText:output,usage:usage(payload),stream:{requested:false,used:false},structured:{requested:false,valid:true,repairAttempts:0},fallback:{used:false}};
}
function provider(request){return clean(request?.config?.provider||request?.config?.route,80).toLowerCase();}
function postFallbackDesign(request){return clean(request?.purpose,180)===DESIGN_PURPOSE&&clean(request?.context?.research?.mode,120).toLowerCase()==='model-derived-unverified';}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;
  spine.unregister?.(ID);
  spine.register(ID,{
    before(request){
      if(!postFallbackDesign(request))return request;
      return{...request,purpose:POST_FALLBACK_DESIGN_PURPOSE,taskTier:'small',executionProfile:'interactive',config:{...(request.config||{}),provider:'gemini',route:'gemini',model:SMALL_MODEL},context:{...(request.context||{}),livingSchoolOriginalPurpose:DESIGN_PURPOSE,postFallbackDesign:true}};
    },
    async handle(request){
      const structure=clean(request?.purpose,180)===STRUCTURE_PURPOSE,design=clean(request?.purpose,180)===POST_FALLBACK_DESIGN_PURPOSE;
      if((!structure&&!design)||provider(request)!=='gemini')return{handled:false};
      const config={...(request.config||{}),model:SMALL_MODEL};
      if(!config.apiKey||!config.externalConsent)return{handled:false};
      try{return{handled:true,result:structure?await generateStructured(request,config):await generateDesign(request,config)}}catch(error){return{handled:true,result:{...resultBase(request,config),status:'provider-error',outputText:'',usage:{},stream:{requested:false,used:false},structured:{requested:Boolean(structure),valid:false,repairAttempts:0},fallback:{used:false},error:{code:clean(error?.code||'LIVING_SCHOOL_GEMINI_GENERATION_FAILED',120),message:clean(error?.message||error,2400),status:error?.status}}}};
    }
  },90);
  try{dispatchEvent(new CustomEvent('civweave:living-school-gemini-structured-ready',{detail:{version:VERSION,middleware:ID,model:SMALL_MODEL,at:new Date().toISOString()}}))}catch{}
  return true;
}
addEventListener?.('civweave:runtime-spine-ready',()=>queueMicrotask(install));
addEventListener?.('civweave:gemini-task-router-ready',()=>queueMicrotask(install));
install();
globalThis.CivweaveLivingSchoolGeminiStructuredV1=Object.freeze({version:VERSION,install,middlewareId:ID,model:SMALL_MODEL});
})();