(()=>{
'use strict';
// Listen to canonical inference events. Never starts a model, downloads files,
// reads weights, changes selection, or saves user prompt/output text.
const VERSION='1.0.0-model-performance-observer-v1';
const KEY='civweave.local-ai.performance.v1',MAX_SAMPLES=10;
if(globalThis.CivweaveLocalModelPerformanceV1?.version===VERSION)return;
const numeric=x=>Number.isFinite(Number(x))&&Number(x)>=0?Number(x):null;
const safeText=x=>String(x||'').slice(0,150);
const permittedModel=x=>/^[a-z0-9][a-z0-9.-]{1,90}$/i.test(String(x||''));
const load=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return{}}};
const save=data=>{try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}};
function updated(model,data){
  if(!permittedModel(model))return;
  const all=load(),prior=all[model]||{samples:[]};
  const next={...prior,...data,model,updatedAt:Date.now()};
  if(data.sample){next.samples=[...(Array.isArray(prior.samples)?prior.samples:[]),data.sample].slice(-MAX_SAMPLES);delete next.sample}
  all[model]=next;save(all);
  try{dispatchEvent(new CustomEvent('civweave:local-model-performance-updated',{detail:{model,at:next.updatedAt}}))}catch{}
}
function sample(model,backend,m={},{approximate=false,fallbackUsed=false}={}){
  // A fallback to a different engine may be measured, but not credited to
  // the requested model; record the actual engine and the fallback fact.
  if(!permittedModel(model))return;
  const ttftMs=numeric(m.ttftMs),tokensPerSecond=numeric(m.tokensPerSecond??m.approxTokensPerSecond),totalMs=numeric(m.totalMs??m.generationMs);
  const generatedTokens=numeric(m.generatedTokens??m.approxGeneratedTokens);
  if(totalMs==null&&ttftMs==null&&tokensPerSecond==null)return;
  updated(model,{sample:{at:Date.now(),backend:safeText(backend),ttftMs,tokensPerSecond,totalMs,generatedTokens,approximate:Boolean(approximate),fallbackUsed:Boolean(fallbackUsed)}});
}
addEventListener('civweave:litert-gemma4-complete',event=>{
  const d=event?.detail||{};
  sample(d.model,'litert-lm-web',d,{approximate:d.lastDecodeTokensPerSecond==null&&d.lastDecodeTokensPerSec==null});
});
addEventListener('civweave:local-onnx-generate-complete',event=>{
  const d=event?.detail||{};
  sample(d.model,d.backend||'onnx',d.metrics||{},{fallbackUsed:d.fallbackUsed});
});
addEventListener('civweave:weave-pipeline',event=>{
  const d=event?.detail||{};
  if(d.phase==='pipeline'&&['complete','failed'].includes(d.state)&&permittedModel(d.model)){
    // This is the deterministic Civweave JSON/structure gate, NOT proof of
    // token-masked decoding nor a judgement of curriculum quality.
    updated(d.model,{lastPlan:{at:Date.now(),kind:safeText(d.kind),validated:d.state==='complete',code:safeText(d.code)}});
  }
});
globalThis.CivweaveLocalModelPerformanceV1=Object.freeze({version:VERSION,key:KEY,read:load,observational:true,autostart:false,noModelLoads:true,noPromptsStored:true,maxSamples:MAX_SAMPLES});
})();