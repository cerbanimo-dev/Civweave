(()=>{
'use strict';

const VERSION='1.0.2-gemma4-structured-quest-completion-v1-json-canonicalization';
const PURPOSE='civweave-weaveling-intention-json-v190';
const LOCAL_SELECTION_KEY='civweave.local-ai.selection.v266';
const FAST_E2='gemma4-e2b-it-litert-web';
const FAST_E4='gemma4-e4b-it-litert-web';
const BUDGETS=Object.freeze({[FAST_E2]:2400,[FAST_E4]:2800});
const SYSTEM_SUFFIX='For this downloaded-local Quest response, return one complete compact JSON object with no markdown. Use strict JSON syntax: double-quoted keys and strings, lowercase true/false/null, no trailing commas, and escaped newlines inside strings. Keep the result concise enough to finish within the selected model output budget. If governance is not needed, omit governance entirely or return {"included":false}. If governance is included, set included:true and include title, purpose, agreements, and reviewQuestion.';

if(globalThis.CivweaveGemma4StructuredQuestCompletionV1?.version===VERSION){
  globalThis.CivweaveGemma4StructuredQuestCompletionV1.schedule?.();
  return;
}

let queued=false;
let wrappedGenerate=null;
const clean=(value,max=200000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
function selectedLocal(){
  try{const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();if(live?.active&&live.id)return live}catch{}
  try{const saved=parse(localStorage.getItem(LOCAL_SELECTION_KEY),{});return saved?.active&&saved.id?saved:null}catch{return null}
}
function budgetFor(modelId=''){
  const id=clean(modelId,240);
  return BUDGETS[id]||2400;
}
function cloneValue(value){
  try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}
}
function relaxedQuestSchema(schema){
  const next=cloneValue(schema);
  const governance=next?.properties?.governance;
  if(governance&&typeof governance==='object'&&!Array.isArray(governance))delete governance.required;
  return next;
}
function hardenMessages(messages=[]){
  const rows=(Array.isArray(messages)?messages:[]).map(row=>({...row}));
  const index=rows.findIndex(row=>row?.role==='system');
  if(index>=0){
    const content=clean(rows[index]?.content,24000);
    if(!content.includes(SYSTEM_SUFFIX))rows[index]={...rows[index],content:`${content}\n\n${SYSTEM_SUFFIX}`.trim()};
  }else rows.unshift({role:'system',content:SYSTEM_SUFFIX});
  return rows;
}
function stripFence(text=''){
  return clean(text).replace(/^```(?:json|javascript|js)?\s*/i,'').replace(/\s*```$/,'').trim();
}
function extractBalancedJson(text=''){
  const source=stripFence(text).replace(/[“”]/g,'"');
  let start=-1;
  for(let i=0;i<source.length;i+=1){if(source[i]==='{'||source[i]==='['){start=i;break}}
  if(start<0)return{candidate:'',hasJson:false,complete:false,truncated:false,start:-1,end:-1};
  const stack=[];let quoted=false,escaped=false;
  for(let i=start;i<source.length;i+=1){
    const char=source[i];
    if(quoted){
      if(escaped)escaped=false;
      else if(char==='\\')escaped=true;
      else if(char==='"')quoted=false;
      continue;
    }
    if(char==='"'){quoted=true;continue}
    if(char==='{'||char==='['){stack.push(char);continue}
    if(char==='}'||char===']'){
      const expected=char==='}'?'{':'[';
      if(stack[stack.length-1]!==expected)return{candidate:source.slice(start,i+1),hasJson:true,complete:false,truncated:false,start,end:i};
      stack.pop();
      if(!stack.length)return{candidate:source.slice(start,i+1),hasJson:true,complete:true,truncated:false,start,end:i};
    }
  }
  return{candidate:source.slice(start),hasJson:true,complete:false,truncated:Boolean(stack.length||quoted),start,end:-1};
}
function jsonCompletion(text=''){
  const found=extractBalancedJson(text);
  return{hasJson:found.hasJson,complete:found.complete,truncated:found.truncated};
}
function normalizeStringControls(source=''){
  let out='',quoted=false,escaped=false;
  for(let i=0;i<source.length;i+=1){
    const char=source[i];
    if(quoted){
      if(escaped){out+=char;escaped=false;continue}
      if(char==='\\'){out+=char;escaped=true;continue}
      if(char==='"'){out+=char;quoted=false;continue}
      if(char==='\n'){out+='\\n';continue}
      if(char==='\r'){out+='\\r';continue}
      if(char==='\t'){out+='\\t';continue}
      out+=char;continue;
    }
    if(char==='"'){quoted=true;out+=char;continue}
    out+=char;
  }
  return out;
}
function normalizeOutsideTokens(source=''){
  let out='',quoted=false,escaped=false;
  for(let i=0;i<source.length;){
    const char=source[i];
    if(quoted){
      out+=char;
      if(escaped)escaped=false;
      else if(char==='\\')escaped=true;
      else if(char==='"')quoted=false;
      i+=1;continue;
    }
    if(char==='"'){quoted=true;out+=char;i+=1;continue}
    if(/[A-Za-z_$]/.test(char)){
      let end=i+1;
      while(end<source.length&&/[A-Za-z0-9_$-]/.test(source[end]))end+=1;
      const token=source.slice(i,end);
      let look=end;while(look<source.length&&/\s/.test(source[look]))look+=1;
      let prior=out.length-1;while(prior>=0&&/\s/.test(out[prior]))prior-=1;
      const keyPosition=(prior<0||out[prior]==='{'||out[prior]===',')&&source[look]===':';
      if(keyPosition){out+=`"${token}"`;i=end;continue}
      if(token==='True'){out+='true';i=end;continue}
      if(token==='False'){out+='false';i=end;continue}
      if(token==='None'){out+='null';i=end;continue}
      out+=token;i=end;continue;
    }
    out+=char;i+=1;
  }
  return out;
}
function removeTrailingCommas(source=''){
  let out='',quoted=false,escaped=false;
  for(let i=0;i<source.length;i+=1){
    const char=source[i];
    if(quoted){
      out+=char;
      if(escaped)escaped=false;
      else if(char==='\\')escaped=true;
      else if(char==='"')quoted=false;
      continue;
    }
    if(char==='"'){quoted=true;out+=char;continue}
    if(char===','){
      let look=i+1;while(look<source.length&&/\s/.test(source[look]))look+=1;
      if(source[look]==='}'||source[look]===']')continue;
    }
    out+=char;
  }
  return out;
}
function normalizeNearJson(candidate=''){
  const source=clean(candidate).replace(/[“”]/g,'"').replace(/\u00a0/g,' ');
  return removeTrailingCommas(normalizeOutsideTokens(normalizeStringControls(source))).trim();
}
function canonicalizeQuestJson(text=''){
  const found=extractBalancedJson(text),candidate=found.candidate||stripFence(text);
  if(!candidate)return{valid:false,repaired:false,balanced:false,text:'',value:null,reasons:['no-json-object']};
  try{
    const value=JSON.parse(candidate);
    return{valid:true,repaired:false,balanced:found.complete,text:JSON.stringify(value),value,reasons:[]};
  }catch(strictError){
    if(!found.complete)return{valid:false,repaired:false,balanced:false,text:candidate,value:null,reasons:[found.truncated?'truncated-json':'invalid-json-structure'],error:String(strictError?.message||strictError)};
    const normalized=normalizeNearJson(candidate);
    try{
      const value=JSON.parse(normalized);
      return{valid:true,repaired:normalized!==candidate,balanced:true,text:JSON.stringify(value),value,reasons:normalized!==candidate?['deterministic-near-json-normalization']:[]};
    }catch(normalizedError){
      return{valid:false,repaired:false,balanced:true,text:normalized||candidate,value:null,reasons:['balanced-invalid-json'],error:String(normalizedError?.message||normalizedError)};
    }
  }
}
function localResultText(result){
  if(typeof result==='string')return clean(result);
  if(result?.status&&!['success','fallback'].includes(result.status))throw new Error(result?.error?.message||`Local AI ended with ${result.status}.`);
  return clean(result?.outputText||result?.text||result?.output||result?.generatedText||result?.message);
}
function localQuestTransport(){
  return async({config,messages,signal,emit})=>{
    const runtime=globalThis.CivweaveLocalChatRuntimeV295,pick=selectedLocal();
    if(!runtime?.generate)throw new Error('The downloaded-local generation runtime is not ready for structured Quest authoring.');
    if(!pick?.active||!pick.id)throw new Error('No downloaded local AI model is selected for Quest authoring.');
    if(signal?.aborted)throw signal.reason||new DOMException('Generation cancelled','AbortError');
    const budget=budgetFor(pick.id);
    const maxNewTokens=Math.max(1200,Math.min(budget,Number(config?.maxTokens)||budget));
    const systemPrompt=(Array.isArray(messages)?messages:[]).filter(row=>row?.role==='system').map(row=>clean(row?.content,24000)).filter(Boolean).join('\n\n');
    const chatMessages=(Array.isArray(messages)?messages:[]).filter(row=>row?.role!=='system').map(row=>({role:row?.role==='assistant'?'assistant':'user',content:clean(row?.content,24000)})).filter(row=>row.content);
    let accumulated='';
    const onAbort=()=>{try{globalThis.CivweaveLocalModelRuntimeV266?.shutdown?.({reason:'structured-quest-cancelled'})}catch{}};
    signal?.addEventListener?.('abort',onAbort,{once:true});
    try{
      emit?.('generating',{structuredQuest:true,provider:'downloaded-local',model:pick.id,maxNewTokens,fullLocalBudget:true,jsonCanonicalization:true});
      const result=await runtime.generate({
        systemPrompt,
        messages:chatMessages,
        maxNewTokens,
        onToken:token=>{
          const piece=clean(typeof token==='string'?token:token?.text,12000);if(!piece)return;
          accumulated+=piece;
          try{emit?.('partial',{text:piece,accumulatedText:accumulated,structuredQuest:true,provider:'downloaded-local',model:pick.id})}catch{}
        },
        onProgress:progress=>{try{emit?.(progress?.phase||'generating',{...progress,structuredQuest:true,provider:'downloaded-local',model:pick.id})}catch{}}
      });
      const rawText=localResultText(result);
      if(!rawText)throw new Error('The selected local AI returned no structured Quest text.');
      const completion=jsonCompletion(rawText),canonical=completion.truncated?{valid:false,repaired:false,balanced:false,text:rawText,reasons:['truncated-json']}:canonicalizeQuestJson(rawText),text=canonical.valid?canonical.text:(canonical.text||rawText),payload=result&&typeof result==='object'?{...result}:{text:rawText};
      if(completion.truncated&&!payload.finishReason)payload.finishReason='MAX_OUTPUT_TOKENS';
      if(canonical.valid)payload.outputText=text;
      const diagnostic=completion.truncated
        ?'Quest JSON ended before its closing structure; compact repair requested.'
        :canonical.repaired
          ?'Quest JSON syntax was normalized deterministically before schema validation.'
          :canonical.valid
            ?'Quest JSON was generated by the selected downloaded local AI model.'
            :'Quest output closed its structure but remained invalid JSON after deterministic cleanup.';
      return{
        text,
        payload,
        provider:'downloaded-local',
        model:clean(result?.executionId||result?.model?.id||pick.id,240)||pick.id,
        streamed:Boolean(accumulated),
        diagnostics:[diagnostic,...(canonical.reasons||[])],
        jsonCanonicalization:{valid:Boolean(canonical.valid),repaired:Boolean(canonical.repaired),balanced:Boolean(canonical.balanced),reasons:[...(canonical.reasons||[])]}
      };
    }finally{signal?.removeEventListener?.('abort',onAbort)}
  };
}
function isQuestRequest(request={}){
  return clean(request?.purpose,300)===PURPOSE&&request?.__civweaveLocalStructuredPlan===true;
}
function hardenRequest(request={}){
  if(!isQuestRequest(request))return request;
  const pick=selectedLocal(),budget=budgetFor(pick?.id||request?.config?.model);
  return{
    ...request,
    config:{...(request.config||{}),provider:'downloaded-local',route:'downloaded-local',model:pick?.id||request?.config?.model||'downloaded-local',maxTokens:budget,stream:false},
    messages:hardenMessages(request.messages),
    schema:relaxedQuestSchema(request.schema),
    maxRepairAttempts:Math.max(1,Number(request.maxRepairAttempts)||0),
    transport:localQuestTransport(),
    __civweaveGemma4StructuredQuestCompletionV1:true
  };
}
function clarifyResult(result,request={}){
  if(!isQuestRequest(request)||!result||result.status==='success')return result;
  if(result.status!=='invalid-response'&&result?.error?.code!=='INVALID_STRUCTURED_OUTPUT')return result;
  const completion=jsonCompletion(result.outputText||''),canonical=canonicalizeQuestJson(result.outputText||'');
  const errors=Array.isArray(result?.structured?.errors)?result.structured.errors.filter(Boolean):[];
  const invalidJson=errors.some(error=>/did not return valid json|invalid json/i.test(String(error)))||/did not return valid json|invalid json/i.test(String(result?.error?.message||''));
  const message=completion.truncated
    ?'The local AI response ended before the Quest JSON was complete, even after a compact repair attempt.'
    :invalidJson&&!canonical.valid
      ?'The local AI closed the Quest structure, but its JSON syntax was still invalid after deterministic cleanup and the bounded repair pass.'
      :errors.length
        ?`The local AI returned valid JSON, but it did not satisfy the Quest contract: ${errors.slice(0,3).join(' ')}`
        :'The local AI returned JSON, but it did not satisfy the Quest contract.';
  const diagnostic=completion.truncated?'structured-quest-truncated':invalidJson&&!canonical.valid?'structured-quest-balanced-invalid-json':'structured-quest-schema-invalid';
  return{
    ...result,
    error:{...(result.error||{}),code:result?.error?.code||'INVALID_STRUCTURED_OUTPUT',message},
    diagnostics:[...(Array.isArray(result.diagnostics)?result.diagnostics:[]),diagnostic]
  };
}
function install(){
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)return false;
  if(runtime.generate.__civweaveGemma4StructuredQuestCompletionV1===VERSION){wrappedGenerate=runtime.generate;return true}
  const prior=runtime.generate;
  const generate=async request=>{
    const hardened=hardenRequest(request);
    const result=await prior.call(runtime,hardened);
    return clarifyResult(result,hardened);
  };
  generate.__civweaveGemma4StructuredQuestCompletionV1=VERSION;
  generate.__prior=prior;
  const next={...runtime,generate,gemma4StructuredQuestCompletion:VERSION,gemma4StructuredQuestFullBudget:true,gemma4StructuredQuestRuntimeMutable:true,gemma4StructuredQuestJsonCanonicalization:true};
  try{globalThis.CivweaveModelRuntime=next}catch{return false}
  wrappedGenerate=generate;
  try{dispatchEvent(new CustomEvent('civweave:gemma4-structured-quest-completion-ready',{detail:{version:VERSION,budgets:{...BUDGETS},governanceOptional:true,truncationRepair:true,sharedRuntimeMutable:true,jsonCanonicalization:true,balancedInvalidJsonDistinguished:true}}))}catch{}
  return true;
}
function schedule(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;install()});
}
for(const name of ['civweave:model-runtime-ready','civweave:local-provider-authority-installed','civweave:unified-chat-system-ready','civweave:guide-loader-reset','pageshow'])addEventListener(name,schedule);
for(const delay of [0,60,220,800,1800,3600])setTimeout(schedule,delay);

globalThis.CivweaveGemma4StructuredQuestCompletionV1=Object.freeze({
  version:VERSION,
  install,
  schedule,
  selectedLocal,
  budgetFor,
  relaxedQuestSchema,
  hardenMessages,
  stripFence,
  extractBalancedJson,
  jsonCompletion,
  normalizeNearJson,
  canonicalizeQuestJson,
  localQuestTransport,
  hardenRequest,
  clarifyResult,
  purpose:PURPOSE,
  fullLocalBudget:true,
  governanceOptional:true,
  truncationRepair:true,
  sharedRuntimeMutable:true,
  jsonCanonicalization:true,
  balancedInvalidJsonDistinguished:true,
  state:()=>Object.freeze({installed:Boolean(wrappedGenerate),model:selectedLocal()?.id||'',budget:budgetFor(selectedLocal()?.id||''),runtimeMutable:Boolean(globalThis.CivweaveModelRuntime&&!Object.isFrozen(globalThis.CivweaveModelRuntime)),jsonCanonicalization:true})
});
schedule();
})();
