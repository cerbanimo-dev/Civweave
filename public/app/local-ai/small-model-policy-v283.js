(()=>{
'use strict';
const VERSION='1.0.85-local-ai-small-model-policy-v283';
if(globalThis.CivweaveLocalSmallModelPolicyV283?.version===VERSION)return;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const text=value=>String(value??'');
function purposeText(request={}){return [request.purpose,request.executionProfile,request.responseFormat,request.config?.service,request.config?.purpose].filter(Boolean).join(' ').toLowerCase()}
function profile(spec={},request={}){
  const purpose=purposeText(request),structured=Boolean(request.schema||request.responseFormat==='json'||request.responseFormat==='structured'),code=/code|patch|diff|program|script|implementation|refactor/.test(purpose),agentic=String(request.executionProfile||'interactive')==='agentic';
  const fallbackBudget=Number(spec.estimatedBytes||0)<=1_650_000_000?4096:2048;
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
  const source=text(textValue),stack=[];let quoted=false,escaped=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quoted){if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c==='"')quoted=false;continue}
    if(c==='"'){quoted=true;continue}
    if(c==='{'||c==='['||c==='(')stack.push(c);
    else if(c==='}'||c===']'||c===')'){const want=c==='}'?'{':c===']'?'[':'(';if(stack.at(-1)===want)stack.pop()}
  }
  const fences=(source.match(/```/g)||[]).length;
  return{openBrackets:stack.length,openQuote:quoted,openFence:Boolean(fences%2),incomplete:Boolean(stack.length||quoted||fences%2)};
}
function looksAbrupt(textValue){const s=text(textValue).trim();if(!s)return true;return /(?:[,;:\\([{]|(?:[-*]\s*)|\b(?:and|or|because|therefore|with|to|of|the|a|an))\s*$/i.test(s)}
function parseStructured(textValue){
  const source=text(textValue).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{const value=JSON.parse(source);return value&&typeof value==='object'?value:null}catch{return null}
}
function structuredAnswer(textValue){
  const value=parseStructured(textValue);
  if(!value||Array.isArray(value))return'';
  for(const candidate of [value.answer,value.text,value.message]){
    if(typeof candidate==='string'&&candidate.trim())return candidate.trim();
  }
  return'';
}
function guideEnvelope(value){
  if(!value||Array.isArray(value)||typeof value!=='object'||typeof value.answer!=='string')return false;
  return ['choice','assumptions','requiresConsent','confidence','questDraft'].filter(key=>Object.prototype.hasOwnProperty.call(value,key)).length>=2;
}
function guideAnswerIncomplete(textValue){
  const value=parseStructured(textValue),answer=value&&guideEnvelope(value)?structuredAnswer(textValue):'';
  if(!answer)return false;
  if(looksAbrupt(answer))return true;
  const words=answer.split(/\s+/).filter(Boolean).length;
  if(words<16)return false;
  return !/[.!?…]["')\]}]*\s*$/.test(answer);
}
function validateCompletion(run={},textValue='',options={}){
  const s=structure(textValue),completion=run.completion||{},near=Boolean(completion.nearTokenLimit||completion.completionReason==='length'),structured=Boolean(options.structured),jsonValid=options.jsonValid!==false,abrupt=looksAbrupt(textValue),answer=structured&&jsonValid?structuredAnswer(textValue):'',guideIncomplete=structured&&jsonValid?guideAnswerIncomplete(textValue):false;
  if(near)return{clipped:true,reason:'token-limit',structure:s};
  if(s.incomplete)return{clipped:true,reason:'open-structure',structure:s};
  if(structured&&jsonValid&&answer&&looksAbrupt(answer))return{clipped:true,reason:'structured-answer-abrupt',structure:s};
  if(structured&&jsonValid&&guideIncomplete)return{clipped:true,reason:'structured-guide-answer-incomplete',structure:s};
  if(structured&&!jsonValid&&abrupt)return{clipped:true,reason:'structured-abrupt',structure:s};
  if(!structured&&abrupt)return{clipped:true,reason:'abrupt-text',structure:s};
  return{clipped:false,reason:'complete',structure:s};
}
function continuationPrompt({structured=false}={}){return structured?'Return one complete corrected JSON object replacing the previous structured response. Preserve fields that were already complete, finish any incomplete answer or value, and close every structure. The answer must be semantically complete and end on a complete sentence; if the user asked for a plan, include the full plan rather than a preamble or partial list. Return JSON only; do not explain the correction.':'Continue exactly where the previous response stopped. Do not restart, summarize, or repeat any earlier text. Finish only the incomplete answer.'}
function mergeContinuation(baseValue,nextValue){
  const base=text(baseValue),next=text(nextValue);
  if(!next)return base;if(!base)return next;
  const nextJson=parseStructured(next),baseLooksStructured=/^\s*[\[{]/.test(base);
  if(nextJson&&baseLooksStructured)return next;
  if(next.startsWith(base))return next;
  if(base.endsWith(next))return base;
  const max=Math.min(600,base.length,next.length);
  for(let n=max;n>=4;n--)if(base.slice(-n)===next.slice(0,n))return base+next.slice(n);
  return base+next;
}
function continuationMessages(messages,partial,options={}){const rows=Array.isArray(messages)?messages.slice():[];rows.push({role:'assistant',content:text(partial)});rows.push({role:'user',content:continuationPrompt(options)});return rows}
const api=Object.freeze({version:VERSION,profile,structure,looksAbrupt,parseStructured,structuredAnswer,guideEnvelope,guideAnswerIncomplete,validateCompletion,continuationPrompt,mergeContinuation,continuationMessages,structuredAnswerCompletionValidation:true,guideAnswerCompletionValidation:true});
globalThis.CivweaveLocalSmallModelPolicyV283=api;
try{dispatchEvent(new CustomEvent('civweave:local-small-model-policy-ready',{detail:{version:VERSION,tokenBudgeting:true,adaptiveOutput:true,continuationValidation:true,structuredAnswerCompletionValidation:true,guideAnswerCompletionValidation:true}}))}catch{}
})();
