(()=>{
'use strict';

const VERSION='1.0.0-gemma4-structured-quest-completion-v1';
const PURPOSE='civweave-weaveling-intention-json-v190';
const LOCAL_SELECTION_KEY='civweave.local-ai.selection.v266';
const FAST_E2='gemma4-e2b-it-litert-web';
const FAST_E4='gemma4-e4b-it-litert-web';
const BUDGETS=Object.freeze({[FAST_E2]:2400,[FAST_E4]:2800});
const SYSTEM_SUFFIX='For this downloaded-local Quest response, return one complete compact JSON object with no markdown. Keep the result concise enough to finish within the selected model output budget. If governance is not needed, omit governance entirely or return {"included":false}. If governance is included, set included:true and include title, purpose, agreements, and reviewQuestion.';

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
function jsonCompletion(text=''){
  const source=stripFence(text);
  let start=-1;
  for(let i=0;i<source.length;i+=1){if(source[i]==='{'||source[i]==='['){start=i;break}}
  if(start<0)return{hasJson:false,complete:false,truncated:false};
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
      if(stack[stack.length-1]!==expected)return{hasJson:true,complete:false,truncated:false};
      stack.pop();
      if(!stack.length)return{hasJson:true,complete:true,truncated:false};
    }
  }
  return{hasJson:true,complete:false,truncated:Boolean(stack.length||quoted)};
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
      emit?.('generating',{structuredQuest:true,provider:'downloaded-local',model:pick.id,maxNewTokens,fullLocalBudget:true});
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
      const text=localResultText(result);
      if(!text)throw new Error('The selected local AI returned no structured Quest text.');
      const completion=jsonCompletion(text),payload=result&&typeof result==='object'?{...result}:{text};
      if(completion.truncated&&!payload.finishReason)payload.finishReason='MAX_OUTPUT_TOKENS';
      return{
        text,
        payload,
        provider:'downloaded-local',
        model:clean(result?.executionId||result?.model?.id||pick.id,240)||pick.id,
        streamed:Boolean(accumulated),
        diagnostics:[completion.truncated?'Quest JSON ended before its closing structure; compact repair requested.':'Quest JSON was generated by the selected downloaded local AI model.']
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
  const completion=jsonCompletion(result.outputText||'');
  const errors=Array.isArray(result?.structured?.errors)?result.structured.errors.filter(Boolean):[];
  const message=completion.truncated
    ?'The local AI response ended before the Quest JSON was complete, even after a compact repair attempt.'
    :errors.length
      ?`The local AI returned complete JSON, but it did not satisfy the Quest contract: ${errors.slice(0,3).join(' ')}`
      :'The local AI returned JSON, but it did not satisfy the Quest contract.';
  return{
    ...result,
    error:{...(result.error||{}),code:result?.error?.code||'INVALID_STRUCTURED_OUTPUT',message},
    diagnostics:[...(Array.isArray(result.diagnostics)?result.diagnostics:[]),completion.truncated?'structured-quest-truncated':'structured-quest-schema-invalid']
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
  const next=Object.freeze({...runtime,generate,gemma4StructuredQuestCompletion:VERSION,gemma4StructuredQuestFullBudget:true});
  try{globalThis.CivweaveModelRuntime=next}catch{return false}
  wrappedGenerate=generate;
  try{dispatchEvent(new CustomEvent('civweave:gemma4-structured-quest-completion-ready',{detail:{version:VERSION,budgets:{...BUDGETS},governanceOptional:true,truncationRepair:true}}))}catch{}
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
  jsonCompletion,
  localQuestTransport,
  hardenRequest,
  clarifyResult,
  purpose:PURPOSE,
  fullLocalBudget:true,
  governanceOptional:true,
  truncationRepair:true,
  state:()=>Object.freeze({installed:Boolean(wrappedGenerate),model:selectedLocal()?.id||'',budget:budgetFor(selectedLocal()?.id||'')})
});
schedule();
})();
