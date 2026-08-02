(()=>{
'use strict';
const MODEL_ID='HuggingFaceTB/SmolLM2-360M-Instruct';
const LOCAL_ID='smollm2-360m-instruct';
const ADAPTER_URL='/app/models/smollm2-360m-instruct/adapter.js';
const RESULT_SCHEMA='commonweave-model-result-1.0';
const MAX_CONTEXT_CHARS=24000;
let adapterPromise=null;

const now=()=>new Date().toISOString();
const uid=()=>`smol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const isObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const safe=(value,max=4000)=>String(value==null?'':value).slice(0,max);
const providerOf=config=>String(config?.provider||config?.route||config?.engine||'bundled').toLowerCase();
const isBundled=config=>['bundled','packaged','smollm2','smollm2-360m-instruct','huggingfacetb/smollm2-360m-instruct'].includes(providerOf(config));

function parseJson(text){
  const source=safe(text,2_000_000).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const starts=[source.indexOf('{'),source.indexOf('[')].filter(index=>index>=0).sort((a,b)=>a-b);
  if(!starts.length)throw new Error('No JSON object was present.');
  const start=starts[0],open=source[start],close=open==='{'?'}':']';
  let depth=0,quoted=false,escaped=false;
  for(let index=start;index<source.length;index+=1){
    const char=source[index];
    if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue}
    if(char==='"'){quoted=true;continue}
    if(char===open)depth+=1;
    if(char===close&&--depth===0)return JSON.parse(source.slice(start,index+1));
  }
  return JSON.parse(source);
}

function compactMessages(messages){
  const list=Array.isArray(messages)?messages:[];
  let remaining=MAX_CONTEXT_CHARS;
  const output=[];
  for(const item of list.slice(-12).reverse()){
    if(remaining<=0)break;
    const content=safe(item?.content??item?.text,Math.min(remaining,5000));
    remaining-=content.length;
    output.unshift({role:['system','assistant','user','tool'].includes(item?.role)?item.role:'user',content});
  }
  return output;
}

function failureSummary(failure){
  if(!failure)return null;
  if(failure instanceof Error)return {code:failure.code||failure.name||'PROVIDER_ERROR',message:safe(failure.message,900),status:failure.status||null};
  return {
    code:failure?.error?.code||failure?.code||String(failure?.status||'PROVIDER_ERROR'),
    message:safe(failure?.error?.message||failure?.message||`Provider ended with ${failure?.status||'an error'}.`,900),
    status:failure?.error?.status||failure?.statusCode||null,
  };
}

function expectation(request,failure,mode){
  return {
    schema:'commonweave.fallback-expectation.v1',
    mode,
    purpose:safe(request?.purpose||'general assistance',160),
    primaryFailure:failureSummary(failure),
    expectations:[
      'Provide the smallest useful answer supported by the supplied context.',
      'State uncertainty plainly when evidence is incomplete.',
      'Never claim network access, tool execution, database writes, messages sent, purchases, votes, deployments, or other external actions.',
      'Never invent current facts that are absent from the supplied context.',
      'Preserve the user’s agency and require affirmative consent for consequential actions.',
      'When a response schema is supplied, return only valid JSON matching it, with no markdown fence.',
      'When no schema is supplied, answer concisely in plain text.',
    ],
    tone:'calm, concrete, modest, and useful under degraded conditions',
  };
}

function localMessages(request,failure,mode,repair=null){
  const packet={
    fallbackExpectation:expectation(request,failure,mode),
    requestedSchema:isObject(request?.schema)?request.schema:null,
    conversation:compactMessages(request?.messages),
  };
  const system=mode==='primary'
    ? 'You are SmolLM2, Commonweave’s onboard local guide. Use only the supplied conversation and structured context. Be genuinely helpful, but do not imply access to tools, networks, private data, or actions you did not perform. Follow the fallbackExpectation and requested schema exactly.'
    : 'You are SmolLM2, Commonweave’s degraded-mode local fallback. A larger provider failed. Do not imitate that provider or hide the failure. Salvage the smallest safe and useful response from the supplied context. Follow the fallbackExpectation and requested schema exactly.';
  const messages=[{role:'system',content:system},{role:'user',content:JSON.stringify(packet)}];
  if(repair)messages.push({role:'assistant',content:safe(repair.output,6000)},{role:'user',content:`Your previous output was not valid JSON: ${safe(repair.error,500)}. Return only one valid JSON value matching requestedSchema. No prose or markdown.`});
  return messages;
}

async function adapter(){
  if(!adapterPromise)adapterPromise=import(ADAPTER_URL).catch(error=>{adapterPromise=null;throw error});
  return adapterPromise;
}

function baseResult(request,started,mode,failure){
  const config=request?.config||{};
  return {
    schema:RESULT_SCHEMA,
    requestId:request?.requestId||uid(),
    purpose:request?.purpose||'commonweave-onboard',
    requested:{provider:providerOf(config),model:config.model||'',endpoint:config.endpoint||'',executionProfile:request?.executionProfile||'interactive'},
    actual:{provider:'bundled-smollm2',model:MODEL_ID},
    timing:{startedAt:new Date(started).toISOString(),completedAt:now(),elapsedMs:Date.now()-started},
    usage:{},
    stream:{requested:Boolean(config.stream),used:false},
    fallback:{used:mode==='fallback',provider:'bundled-smollm2',reason:failureSummary(failure)?.message||null},
    diagnostics:[mode==='fallback'?'SmolLM2 answered in degraded local fallback mode.':'SmolLM2 answered as the selected onboard model.'],
    events:[],
  };
}

async function generateLocal(request={},options={}){
  const started=Date.now();
  const mode=options.mode||'fallback';
  const failure=options.failure||null;
  const engine=await adapter();
  let repair=null,generated=null,outputJson;
  const structured=Boolean(request.schema);
  for(let attempt=0;attempt<(structured?2:1);attempt+=1){
    generated=await engine.generate({
      messages:localMessages(request,failure,mode,repair),
      maxNewTokens:Math.max(64,Math.min(640,Number(request?.config?.maxTokens||request?.maxTokens||360))),
      timeoutMs:Math.max(30000,Math.min(300000,Number(request?.config?.timeoutMs||180000))),
    });
    if(!structured)break;
    try{outputJson=parseJson(generated.text);repair=null;break}catch(error){repair={output:generated.text,error:error.message}}
  }
  const outputText=structured&&outputJson?JSON.stringify(outputJson):safe(generated?.text,2_000_000);
  const result={
    ...baseResult(request,started,mode,failure),
    status:mode==='fallback'?'fallback':'success',
    outputText,
    outputJson,
    structured:{requested:structured,valid:structured?Boolean(outputJson):true,repairAttempts:repair?1:0,errors:structured&&!outputJson?[safe(repair?.error||'SmolLM2 did not return valid JSON.',500)]:[]},
    device:generated?.device||'unknown',
  };
  if(structured&&!outputJson)result.diagnostics.push('SmolLM2 returned usable text but did not satisfy the requested JSON contract after one repair attempt.');
  return result;
}

function shouldFallback(result,error,request){
  if(request?.signal?.aborted)return false;
  if(error?.name==='AbortError'||error?.code==='CANCELLED')return false;
  if(result?.status==='cancelled')return false;
  return !['success','fallback','manual-required'].includes(result?.status);
}

function install(){
  const runtime=globalThis.CommonweaveModelRuntime;
  if(!runtime?.generate||runtime.__smollm2FallbackInstalled)return false;
  const primaryGenerate=runtime.generate.bind(runtime);
  const wrapped=async request=>{
    const incoming=request||{};
    if(isBundled(incoming.config))return generateLocal(incoming,{mode:'primary'});
    const clean={...incoming};
    delete clean.deterministic;
    delete clean.fallback;
    let result,error;
    try{result=await primaryGenerate(clean)}catch(caught){error=caught}
    if(!shouldFallback(result,error,clean)){
      if(error)throw error;
      return result;
    }
    try{return await generateLocal(clean,{mode:'fallback',failure:error||result})}
    catch(localError){
      if(error){error.smollm2Error=localError;throw error}
      if(result){
        return {...result,diagnostics:[...(Array.isArray(result.diagnostics)?result.diagnostics:[]),`SmolLM2 fallback also failed: ${safe(localError.message,900)}`],fallback:{used:false,attemptedProvider:'bundled-smollm2',error:safe(localError.message,900)}};
      }
      throw localError;
    }
  };
  globalThis.CommonweaveModelRuntime={...runtime,generate:wrapped,__smollm2FallbackInstalled:true};
  globalThis.CommonweaveOnboardAI={model:MODEL_ID,localId:LOCAL_ID,adapter,status:async()=>{const engine=await adapter();return engine.status()},generate:generateLocal,expectation};
  try{globalThis.dispatchEvent(new CustomEvent('commonweave:onboard-ai-ready',{detail:{model:MODEL_ID}}))}catch{}
  return true;
}

if(!install())addEventListener('DOMContentLoaded',install,{once:true});
})();
