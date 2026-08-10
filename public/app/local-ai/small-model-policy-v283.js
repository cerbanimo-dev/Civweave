(()=>{
'use strict';
const VERSION='1.0.85-local-ai-small-model-policy-v283';
if(globalThis.CivweaveLocalSmallModelPolicyV283?.version===VERSION)return;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const text=value=>String(value??'');
function purposeText(request={}){return [request.purpose,request.executionProfile,request.responseFormat,request.config?.service,request.config?.purpose].filter(Boolean).join(' ').toLowerCase()}
function profile(spec={},request={}){
  const purpose=purposeText(request),structured=Boolean(request.schema||request.responseFormat==='json'||request.responseFormat==='structured'),code=/code|patch|diff|program|script|implementation|refactor/.test(purpose),agentic=String(request.executionProfile||'interactive')==='agentic';
  const fallbackBudget=Number(spec.estimatedBytes||0)<=950_000_000?4096:Number(spec.estimatedBytes||0)<=1_650_000_000?4096:2048;
  const promptTokenBudget=Math.max(768,Number(spec.workingContextTokens||fallbackBudget));
  const explicit=Number(request.config?.maxTokens||request.maxTokens||0);
  const defaultSlice=structured||code||agentic?384:256;
  const initialSlice=clamp(explicit?Math.min(explicit,defaultSlice):defaultSlice,64,512);
  const continuationSlice=defaultSlice;
  const defaultTotal=structured||code||agentic?1536:1024;
  const totalMax=clamp(explicit?Math.min(explicit,defaultTotal):defaultTotal,initialSlice,4096);
  return Object.freeze({promptTokenBudget,initialSlice,continuationSlice,totalMax,maxPasses:4,structured,code,agentic});
}
function structure(textValue){
  const source=text(textValue),stack=[];let quote='',escaped=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quote){if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c===quote)quote='';continue}
    if(c==='"'||c==="'"){quote=c;continue}
    if(c==='{'||c==='['||c==='(')stack.push(c);
    else if(c==='}'||c===']'||c===')'){const want=c==='}'?'{':c===']'?'[':'(';if(stack.at(-1)===want)stack.pop()}
  }
  const fences=(source.match(/```/g)||[]).length;
  return{openBrackets:stack.length,openQuote:Boolean(quote),openFence:Boolean(fences%2),incomplete:Boolean(stack.length||quote||fences%2)};
}
function looksAbrupt(textValue){const s=text(textValue).trim();if(!s)return true;return /(?:[,;:\\([{]|\b(?:and|or|because|therefore|with|to|of|the|a|an))\s*$/i.test(s)}
function validateCompletion(run={},textValue='',options={}){
  const s=structure(textValue),completion=run.completion||{},near=Boolean(completion.nearTokenLimit||completion.completionReason==='length'),structured=Boolean(options.structured),jsonValid=options.jsonValid!==false;
  if(near)return{clipped:true,reason:'token-limit',structure:s};
  if(completion.structurallyIncomplete||s.incomplete)return{clipped:true,reason:'open-structure',structure:s};
  if(structured&&!jsonValid&&looksAbrupt(textValue))return{clipped:true,reason:'structured-abrupt',structure:s};
  return{clipped:false,reason:'complete',structure:s};
}
function continuationPrompt({structured=false}={}){return structured?'Continue exactly where the previous response stopped. Do not restart or repeat any earlier text. Finish only the incomplete structured output and close every open structure.':'Continue exactly where the previous response stopped. Do not restart, summarize, or repeat any earlier text. Finish only the incomplete answer.'}
function mergeContinuation(baseValue,nextValue){const base=text(baseValue),next=text(nextValue);if(!next)return base;if(!base)return next;if(next.startsWith(base))return next;if(base.endsWith(next))return base;const max=Math.min(600,base.length,next.length);for(let n=max;n>=4;n--)if(base.slice(-n)===next.slice(0,n))return base+next.slice(n);return base+next}
function continuationMessages(messages,partial,options={}){const rows=Array.isArray(messages)?messages.slice():[];rows.push({role:'assistant',content:text(partial)});rows.push({role:'user',content:continuationPrompt(options)});return rows}
const api=Object.freeze({version:VERSION,profile,structure,validateCompletion,continuationPrompt,mergeContinuation,continuationMessages});
globalThis.CivweaveLocalSmallModelPolicyV283=api;
try{dispatchEvent(new CustomEvent('civweave:local-small-model-policy-ready',{detail:{version:VERSION,tokenBudgeting:true,adaptiveOutput:true,continuationValidation:true}}))}catch{}
})();
