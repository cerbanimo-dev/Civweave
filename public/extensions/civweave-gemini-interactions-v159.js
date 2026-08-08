(()=>{
'use strict';
const VERSION='159.1-gemini-interactions-generatecontent-fallback-v256';
const RUNTIME_NAME='CivweaveModelRuntime';
const API_REVISION='2026-05-20';
const DEFAULT_API_BASE='https://generativelanguage.googleapis.com/v1beta';
const ACTIVE_STATUSES=new Set(['in_progress','queued','running']);
const TERMINAL_FAILURES=new Set(['failed','cancelled','incomplete','requires_action']);
const clean=(value,max=24000)=>String(value??'').trim().slice(0,max);
const isObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let installedRuntime=null;

function hostProxyBase(){
  const connected=clean(parse(localStorage.getItem('civweave.host-node.v1'),{})?.baseUrl,2048).replace(/\/+$/,'');
  const hostedHere=Boolean(location&&/^https?:$/.test(location.protocol)&&location.pathname.startsWith('/app/'));
  return connected||(hostedHere?location.origin:'');
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
  return{schema:original.resultSchema||'civweave-model-result-1.0',runtimeVersion:`${original.version||'unknown'}+${VERSION}`,requestId:request.requestId||`gemini-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`,purpose:clean(request.purpose||'generation',120),executionProfile:profile,elapsedMs,requested:{provider:'gemini',model:config.model,endpoint:config.endpoint||DEFAULT_API_BASE},events:[],diagnostics:[`Standard Gemini used the Interactions transport (${VERSION}).`]};
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
    if(request.schema){generationConfig.responseMimeType='application/json';generationConfig.responseJsonSchema=request.schema}
    const body={contents,generationConfig,...(system?{systemInstruction:{parts:[{text:system}]}}:{})};
    const url=generateContentUrl(config),requestHeaders={'content-type':'application/json','accept':'application/json','x-goog-api-key':config.apiKey,...(isObject(config.headers)?config.headers:{})};
    let response=await fetch(url,{method:'POST',headers:requestHeaders,body:JSON.stringify(body),signal:controller.signal,cache:'no-store'}),payload=await readJson(response),schemaRetry=false;
    if(!response.ok&&response.status===400&&request.schema){
      schemaRetry=true;delete generationConfig.responseJsonSchema;
      response=await fetch(url,{method:'POST',headers:requestHeaders,body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});payload=await readJson(response);
    }
    if(!response.ok)throw Object.assign(new Error(clean(payload?.error?.message||`Gemini generateContent returned HTTP ${response.status}.`,2400)),{code:payload?.error?.code||'GEMINI_GENERATE_CONTENT_HTTP_ERROR',status:response.status,diagnostic:payload?.error||payload});
    const text=generateContentText(payload);if(!text)throw new Error('Gemini generateContent returned no text output.');
    let outputJson,valid=true,errors=[];if(request.schema){try{outputJson=JSON.parse(text)}catch(error){valid=false;errors=[`The structured Gemini response was not valid JSON: ${error.message}`]}}
    if(config.stream&&typeof request.onToken==='function')try{request.onToken(text,{provider:'gemini',model:config.model,done:true})}catch{}
    return{...base,elapsedMs:Date.now()-started,status:valid?'success':'invalid-response',outputText:text,outputJson,usage:usage(payload),stream:{requested:Boolean(config.stream),used:false},structured:{requested:Boolean(request.schema),valid,repairAttempts:schemaRetry?1:0,errors},fallback:{used:true,reason:'interactions-transport-unavailable'},actual:{provider:'gemini',model:config.model},diagnostics:[...base.diagnostics,`Interactions failed${interactionFailure?.error?.status?` with HTTP ${interactionFailure.error.status}`:''}; Gemini continued through generateContent.`,...(schemaRetry?['Gemini rejected the attached JSON schema; JSON mode retried without the schema.']:[])]};
  }catch(error){
    return{...base,elapsedMs:Date.now()-started,status:request.signal?.aborted?'cancelled':controller.signal.aborted?'timeout':'provider-error',outputText:'',usage:{},stream:{requested:Boolean(config.stream),used:false},structured:{requested:Boolean(request.schema),valid:false,repairAttempts:0},fallback:{used:true,reason:'interactions-transport-unavailable'},error:{code:clean(error?.code||'GEMINI_GENERATE_CONTENT_FAILED',120),message:clean(error?.message||'Gemini generateContent did not complete the request.',2400),status:error?.status,diagnostic:error?.diagnostic},diagnostics:[...base.diagnostics,'Interactions failed and the generateContent compatibility path also failed.']};
  }finally{clearTimeout(timeoutId);request.signal?.removeEventListener?.('abort',abort)}
}
function wrap(original){
  if(!original||original.__geminiInteractionsTransport===VERSION)return original;
  const generate=async request=>{
    const normalized=request||{};
    if(!shouldUse(original,normalized))return original.generate(normalized);
    const result=await generateWithInteractions(original,normalized);
    const blocked=['MISSING_API_KEY','REMOTE_CONSENT_REQUIRED'];
    if(result.status==='provider-error'&&!blocked.includes(result.error?.code)&&!normalized.signal?.aborted)return generateWithGenerateContent(original,normalized,result);
    return result;
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
