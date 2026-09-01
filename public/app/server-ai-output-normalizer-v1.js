(()=>{
'use strict';
const VERSION='1.1.3-server-ai-output-normalizer-v1-structured-envelope-r4';
const MIDDLEWARE_ID='server-auto-v301';
const AUTHORITY='/app/selected-provider-authority-v1.js';
const AUTHORITY_VERSION='1.1.0-selected-provider-authority-v1-all-routes';
const SANITIZER='/app/assistant-output-sanitizer-v1.js';
const SANITIZER_VERSION='1.0.1-assistant-output-sanitizer-v1-wrapper-resilient';
if(globalThis.CivweaveServerAIOutputNormalizerV1?.version===VERSION)return;
let patchedHandle=null,timer=0,dependencyPromise=null;
const clean=(value,max=5000000)=>String(value??'').trim().slice(0,max);
function completionText(value,depth=0){
  if(depth>5||value==null)return'';
  if(typeof value==='string'){
    const text=value.trim();
    if(!text)return'';
    if((text.startsWith('{')||text.startsWith('['))&&text.length<5_000_000){try{const parsed=JSON.parse(text),nested=completionText(parsed,depth+1);if(nested)return nested}catch{}}
    return text;
  }
  if(typeof value!=='object')return'';
  const message=value?.choices?.[0]?.message;
  if(typeof message?.content==='string'&&message.content.trim())return message.content.trim();
  if(Array.isArray(message?.content)){
    const text=message.content.map(part=>typeof part==='string'?part:part?.text||part?.content||'').filter(Boolean).join('');
    if(text.trim())return text.trim();
  }
  if(typeof value?.choices?.[0]?.text==='string'&&value.choices[0].text.trim())return value.choices[0].text.trim();
  for(const candidate of [value.outputText,value.text,value.response,value.output,value.result,value.data]){
    const nested=completionText(candidate,depth+1);if(nested)return nested;
  }
  return'';
}
function firstBalancedJson(value){
  const source=clean(value).replace(/^```(?:json|javascript|js)?\s*/i,'').replace(/\s*```$/,'').trim();
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
function normalizeModelResult(result){
  if(!result||typeof result!=='object')return result;
  const raw=result.outputText,extracted=completionText(raw),outputText=extracted||raw;
  const structuredRequested=result?.structured?.requested===true;
  const successful=result?.status==='success'||result?.status==='fallback';
  let outputJson=result.outputJson,recovered=false,invalidStructured=false;
  if(structuredRequested&&successful&&(!outputJson||typeof outputJson!=='object')){
    outputJson=structuredJson(outputText);
    recovered=Boolean(outputJson);
    invalidStructured=!recovered;
  }
  const textChanged=Boolean(extracted&&extracted!==raw);
  if(!textChanged&&!recovered&&!invalidStructured)return result;
  const diagnostics=[...(Array.isArray(result.diagnostics)?result.diagnostics:[])];
  if(textChanged)diagnostics.push({code:'WORKERS_AI_ENVELOPE_NORMALIZED',message:'Civweave extracted assistant content from the provider completion envelope before rendering.'});
  if(recovered)diagnostics.push({code:'WORKERS_AI_STRUCTURED_OUTPUT_RECOVERED',message:'Civweave recovered the requested structured JSON from the provider completion content.'});
  if(invalidStructured)diagnostics.push({code:'WORKERS_AI_STRUCTURED_OUTPUT_INVALID',message:'The provider completed the request but did not return parseable JSON for the requested structured output.'});
  const next={...result,outputText,diagnostics};
  if(recovered){next.outputJson=outputJson;next.structured={...(result.structured||{}),requested:true,valid:true}}
  if(invalidStructured){delete next.outputJson;next.status='invalid-response';next.structured={...(result.structured||{}),requested:true,valid:false};next.error=result.error||{code:'INVALID_STRUCTURED_OUTPUT',message:'The provider completed the request but did not return valid JSON for the requested structured output.'}}
  return next;
}
function normalizePacket(packet){
  if(!packet||typeof packet!=='object')return packet;
  if(packet.result&&typeof packet.result==='object')return{...packet,result:normalizeModelResult(packet.result)};
  if(packet.status||Object.hasOwn(packet,'outputText'))return normalizeModelResult(packet);
  return packet;
}
function register(handle){
  try{const spine=globalThis.CivweaveFastInteractiveV192;if(typeof spine?.register==='function'){spine.register(MIDDLEWARE_ID,{handle},60);return true}}catch{}
  return false;
}
function patch(){
  const api=globalThis.CivweaveServerAIRouterV301,current=api?.handle;if(!api||typeof current!=='function')return false;
  if(current.__cwServerAIOutputNormalizerV1===VERSION){patchedHandle=current;register(current);return true}
  const previous=current.bind(api),handle=async request=>normalizePacket(await previous(request||{}));
  handle.__cwServerAIOutputNormalizerV1=VERSION;handle.__prior=current;
  const next=Object.freeze({...api,handle,register:()=>register(handle),outputEnvelopeNormalization:true,outputNormalizerVersion:VERSION});
  try{globalThis.CivweaveServerAIRouterV301=next}catch{return false}
  patchedHandle=handle;register(handle);
  try{dispatchEvent(new CustomEvent('civweave:server-ai-output-normalizer-ready',{detail:{version:VERSION,middleware:MIDDLEWARE_ID,openAICompletionEnvelope:true,structuredJsonRecovery:true,reasoningVisible:false,selectedProviderAuthority:true,finalAssistantSanitizer:true}}))}catch{}
  return true;
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
  if(globalThis.CivweaveSelectedProviderAuthorityV1?.version===AUTHORITY_VERSION&&globalThis.CivweaveAssistantOutputSanitizerV1?.version===SANITIZER_VERSION){globalThis.CivweaveSelectedProviderAuthorityV1.install?.();globalThis.CivweaveAssistantOutputSanitizerV1.install?.();return Promise.resolve(true)}
  if(dependencyPromise)return dependencyPromise;
  dependencyPromise=load(AUTHORITY,AUTHORITY_VERSION,()=>globalThis.CivweaveSelectedProviderAuthorityV1?.version===AUTHORITY_VERSION,'selected provider authority')
    .then(()=>{globalThis.CivweaveSelectedProviderAuthorityV1?.install?.();return load(SANITIZER,SANITIZER_VERSION,()=>globalThis.CivweaveAssistantOutputSanitizerV1?.version===SANITIZER_VERSION,'assistant output sanitizer')})
    .then(()=>{globalThis.CivweaveAssistantOutputSanitizerV1.install?.();patch();return true})
    .catch(error=>{try{console.warn('[Civweave] AI boundary guards did not attach:',error)}catch{};return false})
    .finally(()=>{dependencyPromise=null});
  return dependencyPromise;
}
function install(){patch();void ensureDependencies();return true}
for(const name of ['civweave:server-ai-router-ready','civweave:runtime-spine-ready','civweave:model-runtime-ready','civweave:assistant-runtime-ready','civweave:model-config-changed','civweave:guide-loader-reset','civweave:guide-provider-policy-runtime','civweave:guide-provider-policy-assistant','pageshow'])addEventListener(name,()=>queueMicrotask(install));
install();let attempts=0;timer=setInterval(()=>{attempts+=1;install();if(attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveServerAIOutputNormalizerV1=Object.freeze({version:VERSION,patch,install,ensureDependencies,completionText,firstBalancedJson,structuredJson,normalizeModelResult,normalizePacket,state:()=>({installed:Boolean(patchedHandle),middleware:MIDDLEWARE_ID,authority:Boolean(globalThis.CivweaveSelectedProviderAuthorityV1),sanitizer:Boolean(globalThis.CivweaveAssistantOutputSanitizerV1)}),reasoningVisible:false,structuredJsonRecovery:true,selectedProviderAuthority:true,finalAssistantSanitizer:true});
})();
