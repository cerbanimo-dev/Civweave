(()=>{
'use strict';
const VERSION='1.0.8-cerbanimo-authority-boundary-v268';
const BROKER_SRC='/app/ai-capability-broker-v268.js?v=1.0.61-v268';
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
const root=globalThis;
let brokerPromise=null;
const parse=(value,fallback={})=>{try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'?parsed:fallback}catch{return fallback}};
const clean=value=>String(value??'').trim().toLowerCase();
function fallbackProvider(value){
  const raw=clean(value||'deterministic');
  if(!raw||raw==='deterministic')return'deterministic';
  if(['bundled','packaged','reflex','minilm','local-reflex','semantic','semantic-local'].includes(raw))return'semantic-local';
  if(['downloaded-local','smollm2','smollm3','qwen','browser'].includes(raw))return'generative-local';
  if(['openai','compatible','openai-compatible','gguf'].includes(raw))return'openai-compatible';
  if(raw==='local-api')return'ollama';
  return raw;
}
function storedConfig(profile='interactive'){
  const profiles=parse(root.localStorage?.getItem?.(PROFILES_KEY),{}),settings=parse(root.localStorage?.getItem?.(SETTINGS_KEY),{});
  return profiles[profile]&&typeof profiles[profile]==='object'?profiles[profile]:profiles.interactive&&typeof profiles.interactive==='object'?profiles.interactive:settings;
}
function selectedProvider(profile='interactive'){
  const broker=root.CivweaveAICapabilityBrokerV268;
  if(broker?.selectedProvider)return broker.selectedProvider(profile);
  const config=storedConfig(profile)||{};
  return fallbackProvider(config.provider||config.route);
}
function deterministicSelected(profile='interactive'){return selectedProvider(profile)==='deterministic'}
function unwindLegacyBoundary(){
  const runtime=root.CivweaveModelRuntime;
  if(runtime?.generate?.__cerbanimoDeterministicBoundaryV203&&runtime.generate.__prior){
    try{root.CivweaveModelRuntime=Object.freeze({...runtime,generate:runtime.generate.__prior,cerbanimoDeterministicBoundaryRevision:undefined})}catch{}
  }
  const assistant=root.CivweaveAssistantV141;
  if(assistant?.respond?.__cerbanimoDeterministicBoundaryV203&&assistant.respond.__prior){
    try{assistant.respond=assistant.respond.__prior}catch{}
  }
}
function loadBroker(){
  if(root.CivweaveAICapabilityBrokerV268)return Promise.resolve(root.CivweaveAICapabilityBrokerV268);
  if(brokerPromise)return brokerPromise;
  if(typeof document==='undefined')return Promise.resolve(null);
  brokerPromise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname==='/app/ai-capability-broker-v268.js');
    if(existing){let ticks=0;const timer=setInterval(()=>{if(root.CivweaveAICapabilityBrokerV268){clearInterval(timer);resolve(root.CivweaveAICapabilityBrokerV268)}else if(++ticks>=160){clearInterval(timer);reject(new Error('The AI capability broker did not become ready.'))}},50);return}
    const script=document.createElement('script');script.src=BROKER_SRC;script.async=false;script.dataset.civweaveCapabilityBroker='v268';
    script.onload=()=>root.CivweaveAICapabilityBrokerV268?resolve(root.CivweaveAICapabilityBrokerV268):reject(new Error('The AI capability broker loaded without becoming ready.'));
    script.onerror=()=>reject(new Error('Could not load the AI capability broker.'));
    document.head.append(script);
  }).catch(error=>{brokerPromise=null;try{console.warn('[civweave capability broker]',error)}catch{}return null});
  return brokerPromise;
}
const authority=Object.freeze({
  interpretation:'model-advisory',drafts:'model-or-deterministic',consequentialActions:'deterministic-contracts',approvals:'deterministic-contracts',ledgerSettlement:'deterministic-contracts',rewards:'deterministic-contracts',
  note:'Cerbanimo no longer treats local AI as deterministic. Deterministic contracts guard consequences, approvals, and settlement.'
});
function install(){
  unwindLegacyBoundary();
  loadBroker();
  const status={version:VERSION,provider:selectedProvider(),deterministicSelected:deterministicSelected(),authority,legacyProviderWall:false,brokerReady:Boolean(root.CivweaveAICapabilityBrokerV268)};
  try{root.dispatchEvent?.(new root.CustomEvent('civweave:cerbanimo-authority-boundary-ready',{detail:status}))}catch{}
  return status;
}
const api=Object.freeze({version:VERSION,install,status:install,selectedProvider,deterministicSelected,authority,loadBroker,legacyProviderWall:false});
root.CivweaveCerbanimoDeterministicBoundaryV203=api;
root.addEventListener?.('civweave:ai-capability-broker-ready',install);
install();
})();
