(()=>{
'use strict';
const VERSION='1.0.0-server-ai-output-normalizer-v1';
const MIDDLEWARE_ID='server-auto-v301';
if(globalThis.CivweaveServerAIOutputNormalizerV1?.version===VERSION)return;
let patchedHandle=null,timer=0;
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
function normalizeModelResult(result){
  if(!result||typeof result!=='object')return result;
  const raw=result.outputText,extracted=completionText(raw);
  if(!extracted||extracted===raw)return result;
  return{...result,outputText:extracted,diagnostics:[...(Array.isArray(result.diagnostics)?result.diagnostics:[]),{code:'WORKERS_AI_ENVELOPE_NORMALIZED',message:'Civweave extracted assistant content from the provider completion envelope before rendering.'}]};
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
  try{dispatchEvent(new CustomEvent('civweave:server-ai-output-normalizer-ready',{detail:{version:VERSION,middleware:MIDDLEWARE_ID,openAICompletionEnvelope:true,reasoningVisible:false}}))}catch{}
  return true;
}
for(const name of ['civweave:server-ai-router-ready','civweave:runtime-spine-ready','civweave:model-runtime-ready','civweave:guide-loader-reset','pageshow'])addEventListener(name,()=>queueMicrotask(patch));
patch();let attempts=0;timer=setInterval(()=>{attempts+=1;patch();if(attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveServerAIOutputNormalizerV1=Object.freeze({version:VERSION,patch,completionText,normalizeModelResult,normalizePacket,state:()=>({installed:Boolean(patchedHandle),middleware:MIDDLEWARE_ID}),reasoningVisible:false});
})();