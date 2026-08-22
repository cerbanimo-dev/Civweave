(()=>{
'use strict';
const VERSION='159.6-gemini-structured-contracts-v264';
const RUNTIME_NAME='CivweaveModelRuntime';
const API_REVISION='2026-05-20';
const DEFAULT_API_BASE='https://generativelanguage.googleapis.com/v1beta';
const ACTIVE_STATUSES=new Set(['in_progress','queued','running']);
const TERMINAL_FAILURES=new Set(['failed','cancelled','incomplete','requires_action']);
const LIVING_SCHOOL_STRUCTURE_PURPOSE='living-school-structure-single-v221';
const LIVING_SCHOOL_ECONOMY_KEYS=new Set(['xp','price','prices','pricing','reward','rewards','ledger','currency','currencies','payout','payouts','coin','coins','acorn','acorns','button','buttons','credit','credits','grant','grants','bonus','bonuses','wage','wages','laborvalue','labourvalue']);
const REQUIRED_QUIZ_TYPES=['multiple-choice','multi-select','short-answer'];
const clean=(value,max=24000)=>String(value??'').trim().slice(0,max);
const isObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
let installedRuntime=null;

function hostProxyBase(){
  let saved={};
  try{saved=parse(localStorage.getItem('civweave.host-node.v1'),{})}catch{}
  const connected=clean(saved?.baseUrl,2048).replace(/\/+$/,'');
  const features=Array.isArray(saved?.features)?saved.features.map(item=>clean(item,120).toLowerCase()):[];
  const explicitlyAdvertised=saved?.geminiProxy===true||saved?.geminiAgentProxy===true||features.includes('gemini-agent-proxy');
  return connected&&explicitlyAdvertised?connected:'';
}
function interactionUrl(config){
  const proxy=hostProxyBase();
  if(proxy)return`${proxy}/api/ai/gemini/interactions`;
  const base=clean(config.endpoint||DEFAULT_API_BASE,2048).replace(/\/+$/,'');
  return`${base}/interactions`;
}
function generateContentUrl(config){
  let base=clean(config.endpoint||DEFAULT_API_BASE,2048).replace(/\/+$/,'');
  base=base.replace(/\/interactions(?:\/.*)?$/,'');
  if(!/^https:\/\/generativelanguage\.googleapis\.com\/v1(?:beta)?$/i.test(base))base=DEFAULT_API_BASE;
  return`${base}/models/${encodeURIComponent(config.model)}:generateContent`;
}
function headers(config){return{'content-type':'application/json','accept':'application/json','x-goog-api-key':config.apiKey,'Api-Revision':API_REVISION,...(isObject(config.headers)?config.headers:{})}}
function executionProfile(original,request){try{return original.resolveExecutionProfile?.(request)||request.executionProfile||'interactive'}catch{return request.executionProfile||'interactive'}}
function effectiveConfig(original,request,profile){
  let shared={};try{shared=original.readSharedConfig?.(profile)||original.readSharedConfig?.('interactive')||{}}catch{}
  const requested=isObject(request.config)?request.config:{};
  return original.normalizeConfig?.({...shared,...requested})||{...shared,...requested};
}
function shouldUse(original,request){
  const profile=executionProfile(original,request),config=effectiveConfig(original,request,profile);
  return profile!=='agentic'&&String(config.provider||config.route||'').toLowerCase()==='gemini'&&!/antigravity/i.test(String(config.model||''));
}
function systemText(messages){return messages.filter(item=>item?.role==='system').map(item=>clean(item.content,48000)).filter(Boolean).join('\n\n')}
function conversationText(messages){return messages.filter(item=>item?.role!=='system').map(item=>`${item?.role==='assistant'?'Assistant':'User'}: ${clean(item?.content,48000)}`).join('\n\n')||'User: Respond helpfully.'}
function responseFormat(request){if(!request?.schema)return undefined;return{type:'text',mime_type:'application/json',schema:request.schema}}
function outputText(payload){
  if(typeof payload?.output_text==='string')return payload.output_text;
  const steps=Array.isArray(payload?.steps)?payload.steps:[];
  const fromSteps=steps.filter(step=>step?.type==='model_output').flatMap(step=>Array.isArray(step.content)?step.content:[]).map(item=>item?.type==='text'?item.text:'').filter(Boolean).join('');
  if(fromSteps)return fromSteps;
  const outputs=Array.isArray(payload?.outputs)?payload.outputs:[];
  return outputs.map(item=>typeof item?.text==='string'?item.text:Array.isArray(item?.content)?item.content.map(part=>part?.text||'').join(''):'').filter(Boolean).join('');
}
function generateContentText(payload){return(Array.isArray(payload?.candidates)?payload.candidates:[]).flatMap(candidate=>Array.isArray(candidate?.content?.parts)?candidate.content.parts:[]).map(part=>typeof part?.text==='string'?part.text:'').filter(Boolean).join('')}
function usage(payload){
  const source=payload?.usage||payload?.usageMetadata||{};
  return{inputTokens:Number(source.total_input_tokens??source.input_tokens??source.promptTokenCount??0)||0,outputTokens:Number(source.total_output_tokens??source.output_tokens??source.candidatesTokenCount??0)||0,totalTokens:Number(source.total_tokens??source.totalTokenCount??0)||0,costCents:0,remainingCents:0};
}
function errorMessage(payload,response){return clean(payload?.error?.message||payload?.message||`Gemini Interactions request returned HTTP ${response.status}.`,2400)}
async function readJson(response){const text=await response.text();if(!text)return{};try{return JSON.parse(text)}catch{throw Object.assign(new Error('Gemini returned invalid JSON.'),{code:'INVALID_PROVIDER_JSON',status:response.status,diagnostic:text.slice(0,1200)})}}
function normalizeUrl(value){try{const url=new URL(clean(value,2400));url.hash='';return url.href}catch{return''}}
function livingSchoolStructureRequest(request){return clean(request?.purpose,160)===LIVING_SCHOOL_STRUCTURE_PURPOSE}
function sourceAllowlist(request){
  const sources=Array.isArray(request?.context?.sources)?request.context.sources:[];
  return sources.map(source=>({id:clean(source?.id,180),title:clean(source?.title,320),url:normalizeUrl(source?.url),notes:clean(source?.notes,5000)})).filter(source=>source.id);
}
function economyKey(key){return LIVING_SCHOOL_ECONOMY_KEYS.has(String(key||'').toLowerCase().replace(/[^a-z]/g,''))}
function stripEconomyKeys(value){
  if(Array.isArray(value))return value.map(stripEconomyKeys);
  if(!isObject(value))return value;
  const output={};
  for(const [key,child] of Object.entries(value))if(!economyKey(key))output[key]=stripEconomyKeys(child);
  return output;
}
function prepareLivingSchoolRequest(request){
  if(!livingSchoolStructureRequest(request)||!request?.schema)return request;
  const schema=clone(request.schema),allow=sourceAllowlist(request),ids=allow.map(source=>source.id);
  const moduleSchema=schema?.properties?.module;
  if(isObject(moduleSchema)){
    if(Array.isArray(moduleSchema.required))moduleSchema.required=moduleSchema.required.filter(key=>!economyKey(key));
    if(isObject(moduleSchema.properties))for(const key of Object.keys(moduleSchema.properties))if(economyKey(key))delete moduleSchema.properties[key];
    const sourceIds=moduleSchema?.properties?.lessonBlocks?.items?.properties?.sourceIds;
    if(isObject(sourceIds)){
      sourceIds.items={type:'string',...(ids.length?{enum:ids}:{})};
      if(!ids.length)sourceIds.maxItems=0;
    }
  }
  const messages=Array.isArray(request.messages)?request.messages.map(message=>({...message})):[];
  messages.push({role:'system',content:'Living School economy boundary: do not output XP, prices, Acorn grants, Button values, currency amounts, bonuses, payouts, wages, labor values, or ledger decisions. The Civweave application attaches deterministic rewards only after the curriculum content passes validation. Provenance boundary: use only supplied SOURCE_ID values; do not add a free-form bibliography, invented attribution, or any URL or named source that is not in the supplied source allowlist.'});
  return{...request,schema,messages,context:{...(request.context||{}),sourceAllowlist:allow.map(source=>({id:source.id,title:source.title,url:source.url}))}};
}
function collectStrings(value,out=[]){
  if(typeof value==='string'){out.push(value);return out}
  if(Array.isArray(value)){for(const item of value)collectStrings(item,out);return out}
  if(isObject(value))for(const child of Object.values(value))collectStrings(child,out);
  return out;
}
function livingSchoolContentIssues(module){
  const issues=[];
  if(!isObject(module))return['module object missing'];
  for(const key of ['title','summary','objective','relevance','estimatedEffort','artifact'])if(!clean(module[key],120))issues.push(`${key} missing`);
  for(const key of ['prerequisites','completionCriteria','learningObjectives','concepts'])if(!Array.isArray(module[key])||!module[key].length)issues.push(`${key} missing`);
  const blocks=Array.isArray(module.lessonBlocks)?module.lessonBlocks:[];
  if(blocks.length<3)issues.push(`lessonBlocks ${blocks.length}/3 minimum`);
  else for(const [index,block] of blocks.entries())if(!clean(block?.heading,80)||clean(block?.content,20000).length<240)issues.push(`lesson block ${index+1} is too thin`);
  const visual=module.visualization;if(!isObject(visual)||!clean(visual.title,80)||!Array.isArray(visual.items)||!visual.items.length)issues.push('visualization incomplete');
  const practice=module.practice;if(!isObject(practice)||!clean(practice.prompt,120)||!Array.isArray(practice.steps)||!practice.steps.length||!Array.isArray(practice.rubric)||!practice.rubric.length||!clean(practice.deliverable,120)||!clean(practice.completionCriteria,120))issues.push('practice contract incomplete');
  const quiz=isObject(module.quiz)?module.quiz:{},bank=Array.isArray(quiz.bank)?quiz.bank:[],attemptCount=Math.max(3,Math.min(5,Number(quiz.questionsPerAttempt||3)||3)),types=new Set(bank.map(question=>clean(question?.type,80).toLowerCase()));
  if(bank.length<attemptCount+2)issues.push(`quiz bank ${bank.length}/${attemptCount+2} minimum`);
  const missingTypes=REQUIRED_QUIZ_TYPES.filter(type=>!types.has(type));if(missingTypes.length)issues.push(`quiz missing ${missingTypes.join(', ')}`);
  if(!clean(quiz.remediation,120))issues.push('quiz remediation missing');
  if(!clean(module.badge?.title,80)||!clean(module.badge?.description,120))issues.push('badge incomplete');
  if(!clean(module.navigation?.entry,80))issues.push('navigation entry missing');
  if(!clean(module.cerbanimoQuest?.title,80)||!clean(module.cerbanimoQuest?.brief,120)||!clean(module.cerbanimoQuest?.proof,120))issues.push('Cerbanimo quest incomplete');
  return issues.slice(0,24);
}
function allowlistedName(name,allow,knownText){
  const normalized=clean(name,160).replace(/^[\s"'“”‘’]+|[\s"'“”‘’,:]+$/g,'').trim().toLowerCase();
  if(!normalized)return true;
  if(/^(?:the )?(?:source packet|provided source|supplied source|local source|downloaded source|source material)/.test(normalized))return true;
  if(knownText.includes(normalized))return true;
  return allow.some(source=>{const title=source.title.toLowerCase();return title&&((normalized.length>=4&&title.includes(normalized))||(title.length>=4&&normalized.includes(title)))});
}
function livingSchoolProvenanceIssues(module,request){
  const allow=sourceAllowlist(request),knownIds=new Set(allow.map(source=>source.id)),knownUrls=new Set(allow.map(source=>source.url).filter(Boolean)),knownText=allow.map(source=>`${source.title} ${source.notes}`).join(' ').toLowerCase(),issues=[];
  const blocks=Array.isArray(module?.lessonBlocks)?module.lessonBlocks:[];
  for(const [index,block] of blocks.entries())for(const sourceId of Array.isArray(block?.sourceIds)?block.sourceIds:[]){const id=clean(sourceId,180);if(id&&!knownIds.has(id))issues.push(`lesson block ${index+1} cites unknown SOURCE_ID ${id}`)}
  const strings=collectStrings(module,[]);
  for(const text of strings){
    if(/\b(?:references|bibliography|works cited)\s*:/i.test(text))issues.push('free-form bibliography is not permitted; use SOURCE_ID provenance only');
    const sourceIdPattern=/SOURCE_ID\s*[:#]?\s*([A-Za-z0-9._:-]+)/gi;let sourceMatch;
    while((sourceMatch=sourceIdPattern.exec(text))){const id=clean(sourceMatch[1],180);if(id&&!knownIds.has(id))issues.push(`text references unknown SOURCE_ID ${id}`)}
    const urlPattern=/https?:\/\/[^\s)\]}>"']+/gi;let urlMatch;
    while((urlMatch=urlPattern.exec(text))){const url=normalizeUrl(urlMatch[0].replace(/[.,;:!?]+$/,''));if(url&&!knownUrls.has(url))issues.push(`text references URL outside the source allowlist: ${url}`)}
    const attributionPattern=/(?:according to|guidance from|research from|research by|study by|report by|published by|sourced from|cited by)\s+([^.;\n]{2,120})/gi;let attribution;
    while((attribution=attributionPattern.exec(text)))if(!allowlistedName(attribution[1],allow,knownText))issues.push(`text contains unsupported source attribution: ${clean(attribution[1],120)}`);
    const namedClaimPattern=/\b([A-Z][A-Za-z&.'’\-]*(?:\s+[A-Z][A-Za-z&.'’\-]*){0,5})\s+(?:recommends?|states?|reports?|finds?|notes?|says?|advises?|guides?|publishes?|concludes?)\b/g;let namedClaim;
    while((namedClaim=namedClaimPattern.exec(text)))if(!allowlistedName(namedClaim[1],allow,knownText))issues.push(`text contains unsupported named-source claim: ${clean(namedClaim[1],120)}`);
    if(/\b(?:Acorn(?:s)?|Button(?:s)?|XP)\b.{0,48}\b(?:grant|bonus|award|value|price|reward|payout|\d+)/i.test(text)||/\b(?:price|pricing|cost|fee|wage|labor value|labour value|payout|grant|bonus|reward)\b.{0,32}(?:\$\s*\d|\d+(?:\.\d+)?\s*(?:USD|dollars?|Acorns?|Buttons?))/i.test(text))issues.push('model-authored Civweave economy decision detected');
  }
  return[...new Set(issues)].slice(0,20);
}
function enforceLivingSchoolResult(result,request){
  if(!livingSchoolStructureRequest(request)||result?.status!=='success')return result;
  const output=isObject(result?.outputJson)?clone(result.outputJson):null,module=isObject(output?.module)?output.module:null;
  if(!output||!module)return{...result,status:'invalid-response',outputText:'',outputJson:undefined,structured:{...(result.structured||{}),requested:true,valid:false,errors:[...((result.structured?.errors)||[]),'Living School structured output did not contain one module object.']},error:{code:'LIVING_SCHOOL_STRUCTURED_OUTPUT_INVALID',message:'Living School rejected the Gemini response before storage because it did not contain one parseable module object.'}};
  const cleanedModule=stripEconomyKeys(module),issues=[...livingSchoolContentIssues(cleanedModule),...livingSchoolProvenanceIssues(cleanedModule,request)];
  if(issues.length)return{...result,status:'invalid-response',outputText:'',outputJson:undefined,structured:{...(result.structured||{}),requested:true,valid:false,errors:[...((result.structured?.errors)||[]),...issues]},error:{code:'LIVING_SCHOOL_MODULE_REJECTED',message:`Living School rejected the Gemini module before storage: ${issues.join('; ')}`}};
  cleanedModule.xp={domain:clean(request?.context?.capability,120)||'learning',amount:20};
  output.module=cleanedModule;
  return{...result,outputJson:output,outputText:JSON.stringify(output),diagnostics:[...(result.diagnostics||[]),'Living School content and provenance validators passed; deterministic XP attached by Civweave after validation.']};
}
async function requestInteraction(url,config,body,signal){
  const response=await fetch(url,{method:'POST',headers:headers(config),body:JSON.stringify(body),signal,cache:'no-store'});
  const payload=await readJson(response);
  if(!response.ok)throw Object.assign(new Error(errorMessage(payload,response)),{code:payload?.error?.code||'GEMINI_INTERACTIONS_HTTP_ERROR',status:response.status,diagnostic:payload?.error||payload});
  return payload;
}
async function pollInteraction(url,id,config,signal){
  let payload={id,status:'in_progress'};
  while(ACTIVE_STATUSES.has(String(payload.status||'').toLowerCase())){
    await sleep(700);
    const response=await fetch(`${url}/${encodeURIComponent(id)}`,{headers:headers(config),signal,cache:'no-store'});
    payload=await readJson(response);
    if(!response.ok)throw Object.assign(new Error(errorMessage(payload,response)),{code:payload?.error?.code||'GEMINI_INTERACTIONS_HTTP_ERROR',status:response.status,diagnostic:payload?.error||payload});
  }
  return payload;
}
function baseResult(original,request,config,profile,elapsedMs){
  return{schema:original.resultSchema||'civweave-model-result-1.0',runtimeVersion:`${original.version||'unknown'}+${VERSION}`,requestId:request.requestId||`gemini-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`,purpose:clean(request.purpose||'generation',120),executionProfile:profile,elapsedMs,requested:{provider:'gemini',model:config.model,endpoint:config.endpoint||DEFAULT_API_BASE},events:[],diagnostics:[`Standard Gemini used explicit proxy routing (${VERSION}).`]};
}
async function generateWithInteractions(original,request){
  const started=Date.now(),profile=executionProfile(original,request),config=effectiveConfig(original,request,profile),messages=Array.isArray(request.messages)?request.messages:[];
  const base=baseResult(original,request,config,profile,0);
  if(!config.apiKey)return{...base,elapsedMs:Date.now()-started,status:'provider-error',outputText:'',usage:{},stream:{requested:Boolean(config.stream),used:false},structured:{requested:Boolean(request.schema),valid:false,repairAttempts:0},fallback:{used:false},error:{code:'MISSING_API_KEY',message:'A session-only Gemini API key is required.'}};
  if(!config.externalConsent&&request.requireExternalConsent!==false)return{...base,elapsedMs:Date.now()-started,status:'provider-error',outputText:'',usage:{},stream:{requested:Boolean(config.stream),used:false},structured:{requested:Boolean(request.schema),valid:false,repairAttempts:0},fallback:{used:false},error:{code:'REMOTE_CONSENT_REQUIRED',message:'External provider use requires explicit session consent.'}};
  const controller=new AbortController(),timeout=Math.max(5000,Number(config.timeoutMs||90000));
  const timeoutId=setTimeout(()=>controller.abort(),timeout),abort=()=>controller.abort(request.signal?.reason);
  request.signal?.addEventListener?.('abort',abort,{once:true});
  try{
    const body={model:config.model,input:conversationText(messages),store:false,background:false};
    const system=systemText(messages),format=responseFormat(request);
    if(system)body.system_instruction=system;
    if(format)body.response_format=format;
    body.generation_config={temperature:Number.isFinite(Number(config.temperature))?Number(config.temperature):0.2,max_output_tokens:Number(config.maxTokens||4096)};
    const url=interactionUrl(config);
    let payload=await requestInteraction(url,config,body,controller.signal);
    if(ACTIVE_STATUSES.has(String(payload.status||'').toLowerCase())&&payload.id)payload=await pollInteraction(url,payload.id,config,controller.signal);
    const state=String(payload.status||'completed').toLowerCase();
    if(TERMINAL_FAILURES.has(state))throw Object.assign(new Error(clean(payload?.error?.message||`Gemini interaction ended with status ${state}.`,2400)),{code:payload?.error?.code||'GEMINI_INTERACTION_FAILED',diagnostic:payload});
    const text=outputText(payload);
    if(!text)throw Object.assign(new Error('Gemini completed the interaction but returned no text output.'),{code:'EMPTY_PROVIDER_RESPONSE',diagnostic:payload});
    let outputJson,valid=true,errors=[];
    if(request.schema){try{outputJson=JSON.parse(text)}catch(error){valid=false;errors=[`The structured Gemini response was not valid JSON: ${error.message}`]}}
    if(config.stream&&typeof request.onToken==='function')try{request.onToken(text,{provider:'gemini',model:payload.model||config.model,done:true})}catch{}
    return{...base,elapsedMs:Date.now()-started,status:valid?'success':'invalid-response',outputText:text,outputJson,usage:usage(payload),stream:{requested:Boolean(config.stream),used:false},structured:{requested:Boolean(request.schema),valid,repairAttempts:0,errors},fallback:{used:false},actual:{provider:'gemini',model:payload.model||config.model},providerPayload:{id:payload.id,status:payload.status||'completed'}};
  }catch(error){
    const timedOut=controller.signal.aborted&&!request.signal?.aborted;
    return{...base,elapsedMs:Date.now()-started,status:request.signal?.aborted?'cancelled':timedOut?'timeout':'provider-error',outputText:'',usage:{},stream:{requested:Boolean(config.stream),used:false},structured:{requested:Boolean(request.schema),valid:false,repairAttempts:0},fallback:{used:false},error:{code:clean(error?.code||(timedOut?'TIMEOUT':'PROVIDER_ERROR'),120),message:clean(error?.message||'Gemini Interactions did not complete the request.',2400),status:error?.status,diagnostic:error?.diagnostic}};
  }finally{clearTimeout(timeoutId);request.signal?.removeEventListener?.('abort',abort)}
}
async function generateWithGenerateContent(original,request,interactionFailure){
  const started=Date.now(),profile=executionProfile(original,request),config=effectiveConfig(original,request,profile),messages=Array.isArray(request.messages)?request.messages:[];
  const base=baseResult(original,request,config,profile,0),controller=new AbortController(),timeout=Math.max(5000,Number(config.timeoutMs||90000));
  const timeoutId=setTimeout(()=>controller.abort(),timeout),abort=()=>controller.abort(request.signal?.reason);
  request.signal?.addEventListener?.('abort',abort,{once:true});
  try{
    const system=systemText(messages),contents=messages.filter(item=>item?.role!=='system').map(item=>({role:item?.role==='assistant'?'model':'user',parts:[{text:clean(item?.content,48000)}]})).filter(item=>item.parts[0].text);
    if(!contents.length)contents.push({role:'user',parts:[{text:'Respond helpfully.'}]});
    const generationConfig={temperature:Number.isFinite(Number(config.temperature))?Number(config.temperature):0.2,maxOutputTokens:Number(config.maxTokens||4096)};
    if(request.schema)generationConfig.responseFormat={text:{mimeType:'APPLICATION_JSON',schema:request.schema}};
    const body={contents,generationConfig,...(system?{systemInstruction:{parts:[{text:system}]}}:{})};
    const url=generateContentUrl(config),requestHeaders={'content-type':'application/json','accept':'application/json','x-goog-api-key':config.apiKey,...(isObject(config.headers)?config.headers:{})};
    const response=await fetch(url,{method:'POST',headers:requestHeaders,body:JSON.stringify(body),signal:controller.signal,cache:'no-store'}),payload=await readJson(response);
    if(!response.ok)throw Object.assign(new Error(clean(payload?.error?.message||`Gemini generateContent returned HTTP ${response.status}.`,2400)),{code:payload?.error?.code||'GEMINI_GENERATE_CONTENT_HTTP_ERROR',status:response.status,diagnostic:payload?.error||payload});
    const text=generateContentText(payload);if(!text)throw new Error('Gemini generateContent returned no text output.');
    let outputJson,valid=true,errors=[];if(request.schema){try{outputJson=JSON.parse(text)}catch(error){valid=false;errors=[`The structured Gemini response was not valid JSON: ${error.message}`]}}
    if(config.stream&&typeof request.onToken==='function')try{request.onToken(text,{provider:'gemini',model:config.model,done:true})}catch{}
    return{...base,elapsedMs:Date.now()-started,status:valid?'success':'invalid-response',outputText:text,outputJson,usage:usage(payload),stream:{requested:Boolean(config.stream),used:false},structured:{requested:Boolean(request.schema),valid,repairAttempts:0,errors},fallback:{used:true,reason:'interactions-transport-unavailable'},actual:{provider:'gemini',model:config.model},diagnostics:[...base.diagnostics,`Interactions failed${interactionFailure?.error?.status?` with HTTP ${interactionFailure.error.status}`:''}; Gemini continued through generateContent with the same required JSON schema.`]};
  }catch(error){
    return{...base,elapsedMs:Date.now()-started,status:request.signal?.aborted?'cancelled':controller.signal.aborted?'timeout':'provider-error',outputText:'',usage:{},stream:{requested:Boolean(config.stream),used:false},structured:{requested:Boolean(request.schema),valid:false,repairAttempts:0},fallback:{used:true,reason:'interactions-transport-unavailable'},error:{code:clean(error?.code||'GEMINI_GENERATE_CONTENT_FAILED',120),message:clean(error?.message||'Gemini generateContent did not complete the request.',2400),status:error?.status,diagnostic:error?.diagnostic},diagnostics:[...base.diagnostics,'Interactions failed and the generateContent compatibility path also failed closed; Civweave did not retry without the schema.']};
  }finally{clearTimeout(timeoutId);request.signal?.removeEventListener?.('abort',abort)}
}
function wrap(original){
  if(!original||original.__geminiInteractionsTransport===VERSION)return original;
  const generate=async request=>{
    const normalized=request||{};
    if(!shouldUse(original,normalized))return original.generate(normalized);
    const prepared=prepareLivingSchoolRequest(normalized);
    let result=await generateWithInteractions(original,prepared);
    const blocked=['MISSING_API_KEY','REMOTE_CONSENT_REQUIRED'];
    if(result.status==='provider-error'&&!blocked.includes(result.error?.code)&&!prepared.signal?.aborted)result=await generateWithGenerateContent(original,prepared,result);
    return enforceLivingSchoolResult(result,prepared);
  };
  const wrapped=Object.freeze({...original,__geminiInteractionsTransport:VERSION,generate});
  installedRuntime=wrapped;
  dispatchEvent(new CustomEvent('civweave:gemini-interactions-ready',{detail:{version:VERSION,at:new Date().toISOString()}}));
  return wrapped;
}
function install(){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,RUNTIME_NAME);
  if(descriptor&&!descriptor.configurable){if(globalThis[RUNTIME_NAME])globalThis[RUNTIME_NAME]=wrap(globalThis[RUNTIME_NAME]);return}
  let current=wrap(globalThis[RUNTIME_NAME]);
  Object.defineProperty(globalThis,RUNTIME_NAME,{configurable:true,enumerable:true,get(){return current},set(value){current=wrap(value)}});
  if(current)installedRuntime=current;
}
install();
globalThis.CivweaveGeminiInteractionsV159={version:VERSION,wrap,generateWithInteractions,generateWithGenerateContent,get runtime(){return installedRuntime}};
})();