(()=>{
'use strict';

const VERSION='chat-runtime-failsafe-v266';
const LOADER_TIMEOUT_MS=6000;
const ASSISTANT_TIMEOUT_MS=10000;
const GUIDE_FALLBACK_TIMEOUT_MS=6000;
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const GUIDE={
  civweave:{name:'Weaveling',mode:'Reflect',next:'Tell Weaveling the outcome you want, then separate what must be learned, built, acquired, or agreed.'},
  'living-school':{name:'Moss',mode:'Learn',next:'Name the smallest thing you need to understand, practice, or demonstrate next.'},
  cerbanimo:{name:'Kamiya',mode:'Build',next:'Name the concrete deliverable, what counts as done, and the first verifiable dependency.'},
  fellowfare:{name:'Rook',mode:'Acquire',next:'Name the exact need or offer, timing, acceptable substitutes, and exchange boundary.'},
  anarchadia:{name:'Merlin',mode:'Govern',next:'Name the proposed change, who it affects, and the reversible test for success.'}
};

if(globalThis.CivweaveChatRuntimeFailsafeV266?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const validSystem=value=>SYSTEMS.includes(value)?value:'civweave';
const now=()=>new Date().toISOString();

function deadline(value,ms,label){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{
      if(settled)return;
      settled=true;
      const error=new Error(`${label} exceeded ${ms}ms`);
      error.code='CIVWEAVE_CHAT_TIMEOUT';
      reject(error);
    },ms);
    Promise.resolve(value).then(result=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      resolve(result);
    },error=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function fallbackResult(options,error){
  const system=validSystem(options?.systemId);
  const guide=GUIDE[system];
  const text=clean(options?.text,900);
  const timeout=error?.code==='CIVWEAVE_CHAT_TIMEOUT';
  const answer=timeout
    ?`${guide.name} hit a slow model route, so this turn stayed local instead of freezing the chat. For “${text}”, ${guide.next.charAt(0).toLowerCase()}${guide.next.slice(1)}`
    :`${guide.name} recovered this turn locally instead of dropping the message. For “${text}”, ${guide.next.charAt(0).toLowerCase()}${guide.next.slice(1)}`;
  return{
    response:{
      answer,
      choice:{mode:guide.mode,system,room:'',nextAction:guide.next},
      assumptions:[],
      requiresConsent:false,
      confidence:.55
    },
    requestedProvider:'local-failsafe',
    provider:'deterministic-local',
    model:VERSION,
    fallbackFrom:{provider:'interactive',reason:clean(error?.message||'Assistant runtime unavailable',800)},
    context:{guide:{system,name:guide.name},failsafe:{version:VERSION,at:now()}}
  };
}

function emit(kind,detail={}){
  try{dispatchEvent(new CustomEvent(`civweave:chat-failsafe-${kind}`,{detail:{version:VERSION,at:now(),...detail}}))}catch{}
}

function wrapAssistant(){
  const assistant=globalThis.CivweaveAssistantV141;
  if(!assistant||typeof assistant.respond!=='function')return false;
  if(assistant.chatRuntimeFailsafeVersion===VERSION)return true;
  const original=assistant.respond.bind(assistant);
  const respond=async options=>{
    try{return await deadline(original(options),ASSISTANT_TIMEOUT_MS,'Guide response')}
    catch(error){emit('recovered',{system:validSystem(options?.systemId),stage:'assistant',reason:clean(error?.message,800)});return fallbackResult(options,error)}
  };
  respond.__chatRuntimeFailsafeV266=true;
  const wrapped={...assistant,respond,chatRuntimeFailsafeVersion:VERSION};
  try{globalThis.CivweaveAssistantV141=wrapped}catch{return false}
  return globalThis.CivweaveAssistantV141?.chatRuntimeFailsafeVersion===VERSION;
}

let loaderCooldownUntil=0;
function wrapLoader(){
  const loader=globalThis.CivweaveFamilyAILoaderV105;
  if(!loader||typeof loader.ensure!=='function')return false;
  if(loader.chatRuntimeFailsafeVersion===VERSION)return true;
  const original=loader.ensure.bind(loader);
  const ensure=async(...args)=>{
    if(Date.now()<loaderCooldownUntil)return false;
    try{return await deadline(original(...args),LOADER_TIMEOUT_MS,'Guide runtime loader')}
    catch(error){loaderCooldownUntil=Date.now()+15000;emit('recovered',{stage:'loader',reason:clean(error?.message,800)});return false}
  };
  const wrapped={...loader,ensure,chatRuntimeFailsafeVersion:VERSION};
  try{globalThis.CivweaveFamilyAILoaderV105=wrapped}catch{return false}
  return globalThis.CivweaveFamilyAILoaderV105?.chatRuntimeFailsafeVersion===VERSION;
}

function wrapModelFallback(){
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime||typeof runtime.generate!=='function')return false;
  if(runtime.chatRuntimeFailsafeVersion===VERSION)return true;
  const original=runtime.generate.bind(runtime);
  const generate=async options=>{
    const purpose=clean(options?.purpose,200);
    if(!purpose.endsWith('-guide-workspace-v250'))return original(options);
    try{return await deadline(original(options),GUIDE_FALLBACK_TIMEOUT_MS,'Guide fallback model')}
    catch(error){emit('recovered',{stage:'model-fallback',reason:clean(error?.message,800)});return{status:'fallback',outputText:'',actual:{provider:'deterministic-local',model:VERSION},fallback:{used:true,reason:clean(error?.message,800)}}}
  };
  const wrapped={...runtime,generate,chatRuntimeFailsafeVersion:VERSION};
  try{globalThis.CivweaveModelRuntime=wrapped}catch{return false}
  return globalThis.CivweaveModelRuntime?.chatRuntimeFailsafeVersion===VERSION;
}

function install(){
  const loader=wrapLoader();
  const assistant=wrapAssistant();
  const model=wrapModelFallback();
  return{loader,assistant,model};
}

let ticks=0;
const timer=setInterval(()=>{
  const state=install();
  if((state.loader&&state.assistant&&state.model)||++ticks>=300)clearInterval(timer);
},100);
install();
addEventListener('civweave:guide-identity-boundary-installed',()=>queueMicrotask(install));
addEventListener('civweave:guide-loader-reset',()=>queueMicrotask(install));
addEventListener('civweave:guide-workspace-ready',()=>queueMicrotask(install));

globalThis.CivweaveChatRuntimeFailsafeV266=Object.freeze({
  version:VERSION,
  loaderTimeoutMs:LOADER_TIMEOUT_MS,
  assistantTimeoutMs:ASSISTANT_TIMEOUT_MS,
  fallbackTimeoutMs:GUIDE_FALLBACK_TIMEOUT_MS,
  install,
  fallbackResult
});
})();
