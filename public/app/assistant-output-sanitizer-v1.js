(()=>{
'use strict';
const VERSION='1.0.0-assistant-output-sanitizer-v1';
let assistantTarget=null,serverTarget=null,timer=0;
if(globalThis.CivweaveAssistantOutputSanitizerV1?.version===VERSION)return;
const clean=(value,max=5000000)=>String(value??'').trim().slice(0,max);
function parseJson(value){try{return JSON.parse(value)}catch{return null}}
function completionContent(value,depth=0){
  if(depth>6||value==null)return'';
  if(typeof value==='string'){
    const text=value.trim();if(!text)return'';
    if((text.startsWith('{')||text.startsWith('['))&&text.length<5_000_000){const parsed=parseJson(text);if(parsed){const nested=completionContent(parsed,depth+1);if(nested)return nested}}
    return text;
  }
  if(typeof value!=='object')return'';
  const message=value?.choices?.[0]?.message;
  if(typeof message?.content==='string'&&message.content.trim())return message.content.trim();
  if(Array.isArray(message?.content)){const text=message.content.map(part=>typeof part==='string'?part:part?.text||part?.content||'').filter(Boolean).join('');if(text.trim())return text.trim()}
  if(typeof value?.choices?.[0]?.text==='string'&&value.choices[0].text.trim())return value.choices[0].text.trim();
  for(const candidate of [value.outputText,value.text,value.response,value.output,value.result,value.data]){const nested=completionContent(candidate,depth+1);if(nested)return nested}
  return'';
}
function openAIEnvelope(value){return Boolean(value&&typeof value==='object'&&Array.isArray(value.choices)&&value.choices[0]&&(value.object==='chat.completion'||value.choices[0]?.message||value.choices[0]?.text))}
function sanitizeModelResult(result){
  if(!result||typeof result!=='object')return result;
  let outputText=result.outputText,outputJson=result.outputJson;
  const rawObject=typeof outputText==='string'?parseJson(outputText):null;
  if(openAIEnvelope(rawObject)){outputText=completionContent(rawObject);if(openAIEnvelope(outputJson))outputJson=undefined}
  else if(openAIEnvelope(outputJson)){outputText=completionContent(outputJson)||outputText;outputJson=undefined}
  const next={...result,outputText};
  if(outputJson===undefined)delete next.outputJson;else next.outputJson=outputJson;
  delete next.reasoning;delete next.reasoning_content;
  if(next.providerPayload&&openAIEnvelope(next.providerPayload))next.providerPayload={id:next.providerPayload.id||'',object:next.providerPayload.object||'chat.completion'};
  return next;
}
function sanitizePacket(packet){
  if(!packet||typeof packet!=='object')return packet;
  let next={...packet};
  delete next.reasoning;delete next.reasoning_content;
  if(next.result&&typeof next.result==='object')next.result=sanitizeModelResult(next.result);
  if(Object.hasOwn(next,'outputText')||next.status)next=sanitizeModelResult(next);
  if(next.response&&typeof next.response==='object'){
    const response={...next.response};
    if(typeof response.answer==='string'){
      const parsed=parseJson(response.answer.trim());
      if(openAIEnvelope(parsed)){const content=completionContent(parsed);if(content)response.answer=content}
    }else if(openAIEnvelope(response.answer))response.answer=completionContent(response.answer);
    delete response.reasoning;delete response.reasoning_content;next.response=response;
  }
  return next;
}
function patchAssistant(){
  const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)return false;
  if(assistant.__civweaveAssistantOutputSanitizerV1){assistantTarget=assistant;return true}if(assistantTarget===assistant)return true;
  const previous=assistant.respond.bind(assistant),respond=async args=>sanitizePacket(await previous(args));
  try{Object.defineProperty(respond,'__prior',{value:previous})}catch{}
  globalThis.CivweaveAssistantV141={...assistant,respond,__civweaveAssistantOutputSanitizerV1:true,assistantOutputSanitizerVersion:VERSION};assistantTarget=globalThis.CivweaveAssistantV141;return true;
}
function patchServer(){
  const api=globalThis.CivweaveServerAIRouterV301;if(!api?.handle)return false;
  if(api.__civweaveAssistantOutputSanitizerV1){serverTarget=api;return true}if(serverTarget===api)return true;
  const previous=api.handle.bind(api),handle=async request=>sanitizePacket(await previous(request||{}));
  globalThis.CivweaveServerAIRouterV301=Object.freeze({...api,handle,__civweaveAssistantOutputSanitizerV1:true,assistantOutputSanitizerVersion:VERSION});serverTarget=globalThis.CivweaveServerAIRouterV301;return true;
}
function install(){patchAssistant();patchServer();return true}
for(const name of ['civweave:assistant-runtime-ready','civweave:server-ai-router-ready','civweave:response-router-installed','civweave:guide-loader-reset','pageshow'])addEventListener(name,()=>queueMicrotask(install));
install();let attempts=0;timer=setInterval(()=>{attempts+=1;install();if(attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveAssistantOutputSanitizerV1=Object.freeze({version:VERSION,install,completionContent,openAIEnvelope,sanitizeModelResult,sanitizePacket,reasoningVisible:false,rawCompletionEnvelopeVisible:false});
})();
