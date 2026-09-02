(()=>{
'use strict';
const VERSION='1.3.0-server-ai-output-normalizer-v1-structured-tier-failover';
const SERVER_MIDDLEWARE_ID='server-auto-v301';
const NORMALIZER_MIDDLEWARE_ID='server-ai-output-normalizer-v1';
const AUTHORITY='/app/selected-provider-authority-v1.js';
const AUTHORITY_VERSION='1.1.0-selected-provider-authority-v1-all-routes';
const SANITIZER='/app/assistant-output-sanitizer-v1.js';
const SANITIZER_VERSION='1.0.1-assistant-output-sanitizer-v1-wrapper-resilient';
const STRUCTURED_CLOUD_ROUTE='cloudflare-workers-ai';
if(globalThis.CivweaveServerAIOutputNormalizerV1?.version===VERSION)return;
let registeredAfter=false,timer=0,dependencyPromise=null;
const clean=(value,max=5000000)=>String(value??'').trim().slice(0,max);
function completionText(value,depth=0){
  if(depth>6||value==null)return'';
  if(typeof value==='string'){
    const text=value.trim();
    if(!text)return'';
    if((text.startsWith('{')||text.startsWith('['))&&text.length<5_000_000){try{const parsed=JSON.parse(text),nested=completionText(parsed,depth+1);if(nested)return nested}catch{}}
    return text;
  }
  if(typeof value!=='object')return'';
  const message=value?.choices?.[0]?.message;
  if(message?.parsed&&typeof message.parsed==='object'){try{return JSON.stringify(message.parsed)}catch{}}
  if(typeof message?.content==='string'&&message.content.trim())return message.content.trim();
  if(Array.isArray(message?.content)){
    const text=message.content.map(part=>typeof part==='string'?part:part?.text||part?.content||'').filter(Boolean).join('');
    if(text.trim())return text.trim();
  }
  if(typeof value?.choices?.[0]?.text==='string'&&value.choices[0].text.trim())return value.choices[0].text.trim();
  for(const candidate of [value.outputJson,value.outputText,value.text,value.response,value.output,value.result,value.data]){
    if(candidate&&typeof candidate==='object'&&!Array.isArray(candidate)){
      try{const encoded=JSON.stringify(candidate);if(encoded&&encoded!=='{}')return encoded}catch{}
    }
    const nested=completionText(candidate,depth+1);if(nested)return nested;
  }
  return'';
}
function firstBalancedJson(value){
  const source=clean(value).replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/^```(?:json|javascript|js)?\s*/i,'').replace(/\s*```$/,'').trim();
  for(let start=0;start<source.length;start+=1){
    const opener=source[start];
    if(opener!=='{'&&opener!=='[')continue;
    const closer=opener==='{'?'}':']';
    let depth=0,quoted=false,escaped=false;
    for(let index=start;index<source.length;index+=1){
      const char=source[index];
      if(quoted){
        if(escaped)escaped=false;
        else if(char==='\\')escaped=true;
        else if(char==='"')quoted=false;
        continue;
      }
      if(char==='"'){quoted=true;continue}
      if(char===opener)depth+=1;
      else if(char===closer){depth-=1;if(depth===0)return source.slice(start,index+1)}
    }
  }
  return source;
}
function structuredJson(value){
  const text=firstBalancedJson(value);if(!text)return null;
  try{const parsed=JSON.parse(text);return parsed&&typeof parsed==='object'?parsed:null}catch{return null}
}
function outputJsonCandidate(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const message=value?.choices?.[0]?.message;
  if(message?.parsed&&typeof message.parsed==='object'&&!Array.isArray(message.parsed))return message.parsed;
  if(value.outputJson&&typeof value.outputJson==='object'&&!Array.isArray(value.outputJson))return value.outputJson;
  if(value.response&&typeof value.response==='object'&&!Array.isArray(value.response))return value.response;
  if(value.result?.response&&typeof value.result.response==='object'&&!Array.isArray(value.result.response))return value.result.response;
  return null;
}
function normalizeModelResult(result,forceStructured=false){
  if(!result||typeof result!=='object')return result;
  const raw=result.outputText,extracted=completionText(raw),outputText=extracted||raw;
  const structuredRequested=forceStructured||result?.structured?.requested===true;
  const successful=result?.status==='success'||result?.status==='fallback';
  let outputJson=outputJsonCandidate(result.outputJson)||result.outputJson,recovered=false,invalidStructured=false;
  if(structuredRequested&&successful&&(!outputJson||typeof outputJson!=='object'||Array.isArray(outputJson))){
    outputJson=structuredJson(outputText);
    recovered=Boolean(outputJson);
    invalidStructured=!recovered;
  }
  const textChanged=Boolean(extracted&&extracted!==raw);
  if(!textChanged&&!recovered&&!invalidStructured&&!(structuredRequested&&result?.structured?.requested!==true))return result;
  const diagnostics=[...(Array.isArray(result.diagnostics)?result.diagnostics:[])];
  if(textChanged)diagnostics.push({code:'WORKERS_AI_ENVELOPE_NORMALIZED',message:'Civweave extracted assistant content from the provider completion envelope before rendering.'});
  if(recovered)diagnostics.push({code:'WORKERS_AI_STRUCTURED_OUTPUT_RECOVERED',message:'Civweave recovered the requested structured JSON from the provider completion content.'});
  if(invalidStructured)diagnostics.push({code:'WORKERS_AI_STRUCTURED_OUTPUT_INVALID',message:'The provider completed the request but did not return parseable JSON for the requested structured output.'});
  const next={...result,outputText,diagnostics,structured:{...(result.structured||{}),requested:structuredRequested}};
  if(recovered){next.outputJson=outputJson;next.structured={...next.structured,valid:true}}
  if(invalidStructured){delete next.outputJson;next.status='invalid-response';next.structured={...next.structured,valid:false};next.error=result.error||{code:'INVALID_STRUCTURED_OUTPUT',message:'The provider completed the request but did not return valid JSON for the requested structured output.'}}
  return next;
}
function normalizePacket(packet,forceStructured=false){
  if(!packet||typeof packet!=='object')return packet;
  if(packet.result&&typeof packet.result==='object')return{...packet,result:normalizeModelResult(packet.result,forceStructured)};
  if(packet.status||Object.hasOwn(packet,'outputText'))return normalizeModelResult(packet,forceStructured);
  return packet;
}
function serverStructuredRequest(request={}){
  const provider=clean(request?.config?.provider||request?.config?.route,80).toLowerCase();
  return ['server-auto','cloudflare-workers-ai','workers-ai','cloudflare'].includes(provider)&&Boolean(request.schema||request.responseSchema||request.responseFormat==='json');
}
function repairMessages(request,result){
  const rows=Array.isArray(request.messages)?request.messages.slice(-48):[];
  return[
    ...rows,
    {role:'assistant',content:clean(result?.outputText,24000)},
    {role:'user',content:'The preceding response did not satisfy the required JSON contract. Return only one corrected JSON object matching the supplied response schema. Do not include markdown, commentary, reasoning, or code fences.'}
  ];
}
function aggregateUsage(first={},second={}){
  const sum=key=>(Number(first?.[key])||0)+(Number(second?.[key])||0);
  return{
    ...first,...second,
    inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),totalTokens:sum('totalTokens'),costCents:sum('costCents'),chargedNeurons:sum('chargedNeurons'),
    remainingCents:second?.remainingCents??first?.remainingCents,
    remainingNeurons:second?.remainingNeurons??first?.remainingNeurons,
    approximateTurnsLeft:second?.approximateTurnsLeft??first?.approximateTurnsLeft
  };
}
function repairPacketResult(packet){return packet?.result&&typeof packet.result==='object'?packet.result:packet}
function repairRoute(request={},result={}){
  const requested=clean(request?.config?.provider||request?.config?.route,80).toLowerCase();
  const actual=clean(result?.actual?.provider||result?.provider,120).toLowerCase();
  if(requested==='server-auto'&&!['cloudflare-workers-ai','workers-ai','cloudflare'].includes(actual))return STRUCTURED_CLOUD_ROUTE;
  return requested||STRUCTURED_CLOUD_ROUTE;
}
async function normalizeAfter(result,request={}){
  if(!serverStructuredRequest(request))return result;
  const normalized=normalizeModelResult(result,true);
  if(normalized?.status!=='invalid-response'||request.__cwServerAIStructuredRepair===true||Number(request.maxRepairAttempts)===0)return normalized;
  const router=globalThis.CivweaveServerAIRouterV301,rawHandle=router?.handle?.__prior||router?.handle;
  if(typeof rawHandle!=='function')return normalized;
  const provider=repairRoute(request,normalized),from=clean(normalized?.actual?.provider||normalized?.requested?.provider||request?.config?.provider,120)||'unknown';
  try{
    const repairRequest={
      ...request,
      requestId:`${clean(request.requestId,150)||'server-auto'}:structured-repair-1`,
      messages:repairMessages(request,normalized),
      responseFormat:'json',
      maxRepairAttempts:0,
      __cwServerAIStructuredRepair:true,
      config:{...(request.config||{}),provider,route:provider,stream:false}
    };
    const packet=await rawHandle(repairRequest),repairedPacket=normalizePacket(packet,true),repaired=repairPacketResult(repairedPacket);
    if(repaired&&['success','fallback'].includes(repaired.status)&&repaired.outputJson&&typeof repaired.outputJson==='object'&&!Array.isArray(repaired.outputJson)){
      return{
        ...repaired,
        usage:aggregateUsage(normalized.usage||{},repaired.usage||{}),
        structured:{...(repaired.structured||{}),requested:true,valid:true,repairAttempts:Math.max(1,Number(repaired?.structured?.repairAttempts)||0)},
        diagnostics:[...(normalized.diagnostics||[]),...(repaired.diagnostics||[]),{code:'WORKERS_AI_STRUCTURED_TIER_FAILOVER',message:`Civweave advanced structured repair from ${from} to ${provider}.`,from,to:provider},{code:'WORKERS_AI_STRUCTURED_OUTPUT_REPAIRED',message:'Civweave retried once on the next structured-capable server tier and recovered valid structured JSON.'}]
      };
    }
    return{...normalized,diagnostics:[...(normalized.diagnostics||[]),...(repaired?.diagnostics||[]),{code:'WORKERS_AI_STRUCTURED_REPAIR_INVALID',message:`The bounded structured repair on ${provider} still did not return valid JSON.`,from,to:provider}]};
  }catch(error){
    return{...normalized,diagnostics:[...(normalized.diagnostics||[]),{code:'WORKERS_AI_STRUCTURED_REPAIR_FAILED',message:clean(error?.message||error,900),from,to:provider}]};
  }
}
function registerAfter(){
  try{
    const spine=globalThis.CivweaveFastInteractiveV192;
    if(typeof spine?.register!=='function')return false;
    spine.register(NORMALIZER_MIDDLEWARE_ID,{after:normalizeAfter},61);
    registeredAfter=true;
    return true;
  }catch{return false}
}
function patch(){
  const ready=registerAfter();
  if(ready)try{dispatchEvent(new CustomEvent('civweave:server-ai-output-normalizer-ready',{detail:{version:VERSION,middleware:NORMALIZER_MIDDLEWARE_ID,serverMiddleware:SERVER_MIDDLEWARE_ID,registration:'independent-after-hook',overwriteProof:true,structuredRepairAttempts:1,structuredTierFailover:true,structuredCloudRoute:STRUCTURED_CLOUD_ROUTE,openAICompletionEnvelope:true,structuredJsonRecovery:true,reasoningVisible:false,selectedProviderAuthority:true,finalAssistantSanitizer:true}}))}catch{}
  return ready;
}
function find(path){return[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}})}
function load(path,version,ready,label){
  if(ready())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const existing=find(path),finish=()=>ready()?resolve(true):reject(new Error(`${label} loaded without becoming ready.`));
    if(existing){existing.addEventListener('load',finish,{once:true});setTimeout(finish,1800);return}
    const script=document.createElement('script');script.src=`${path}?v=${encodeURIComponent(version)}`;script.async=false;script.onload=finish;script.onerror=()=>reject(new Error(`${label} could not load.`));document.head?.append(script);
  });
}
function ensureDependencies(){
  if(globalThis.CivweaveSelectedProviderAuthorityV1?.version===AUTHORITY_VERSION&&globalThis.CivweaveAssistantOutputSanitizerV1?.version===SANITIZER_VERSION){globalThis.CivweaveSelectedProviderAuthorityV1.install?.();globalThis.CivweaveAssistantOutputSanitizerV1?.install?.();return Promise.resolve(true)}
  if(dependencyPromise)return dependencyPromise;
  dependencyPromise=load(AUTHORITY,AUTHORITY_VERSION,()=>globalThis.CivweaveSelectedProviderAuthorityV1?.version===AUTHORITY_VERSION,'selected provider authority')
    .then(()=>{globalThis.CivweaveSelectedProviderAuthorityV1?.install?.();return load(SANITIZER,SANITIZER_VERSION,()=>globalThis.CivweaveAssistantOutputSanitizerV1?.version===SANITIZER_VERSION,'assistant output sanitizer')})
    .then(()=>{globalThis.CivweaveAssistantOutputSanitizerV1?.install?.();patch();return true})
    .catch(error=>{try{console.warn('[Civweave] AI boundary guards did not attach:',error)}catch{};return false})
    .finally(()=>{dependencyPromise=null});
  return dependencyPromise;
}
function install(){patch();void ensureDependencies();return true}
for(const name of ['civweave:server-ai-router-ready','civweave:runtime-spine-ready','civweave:model-runtime-ready','civweave:assistant-runtime-ready','civweave:model-config-changed','civweave:guide-loader-reset','civweave:guide-provider-policy-runtime','civweave:guide-provider-policy-assistant','civweave:mobile-guild-attached','civweave:mobile-guild-fabric-refreshed','pageshow'])addEventListener(name,()=>queueMicrotask(install));
install();let attempts=0;timer=setInterval(()=>{attempts+=1;install();if(attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveServerAIOutputNormalizerV1=Object.freeze({version:VERSION,patch,install,ensureDependencies,completionText,firstBalancedJson,structuredJson,normalizeModelResult,normalizePacket,normalizeAfter,repairRoute,registerAfter,state:()=>({installed:registeredAfter,middleware:NORMALIZER_MIDDLEWARE_ID,serverMiddleware:SERVER_MIDDLEWARE_ID,registration:'independent-after-hook',overwriteProof:true,structuredRepairAttempts:1,structuredTierFailover:true,structuredCloudRoute:STRUCTURED_CLOUD_ROUTE,authority:Boolean(globalThis.CivweaveSelectedProviderAuthorityV1),sanitizer:Boolean(globalThis.CivweaveAssistantOutputSanitizerV1)}),reasoningVisible:false,structuredJsonRecovery:true,structuredRepairAttempts:1,structuredTierFailover:true,structuredCloudRoute:STRUCTURED_CLOUD_ROUTE,overwriteProof:true,selectedProviderAuthority:true,finalAssistantSanitizer:true});
})();
