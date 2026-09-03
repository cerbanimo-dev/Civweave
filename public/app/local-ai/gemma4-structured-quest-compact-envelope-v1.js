(()=>{
'use strict';

const VERSION='1.0.0-gemma4-structured-quest-compact-envelope-v1';
const PURPOSE='civweave-weaveling-intention-json-v190';
const BASE_KEY='CivweaveGemma4StructuredQuestCompletionV1';
const API_KEY='CivweaveGemma4StructuredQuestCompactEnvelopeV1';
const COMPACT_SYSTEM=`You are Weaveling, Civweave's Quest architect. Turn the user's stated wish and working context into a concrete reviewable Quest. Preserve the user's premise. Use Living School only for learning or practice, Cerbanimo only for skilled work or production, FellowFare only when materials, services, money, people, transport, or exchange are actually needed, and Anarchadia only for consent, roles, governance, automation, or review. Expose uncertain inferences as assumptions.

For downloaded-local generation, output ONLY one compact JSON object using exactly this envelope:
{"t":"quest title","w":"user wish","o":"observable outcome","a":["assumption"],"p":[{"y":"learning|skilled-labor|material-acquirement|civic-governance","r":"living-school|cerbanimo|fellowfare|anarchadia","t":"path title","u":"path purpose","s":["step"],"c":"completion criterion","e":["evidence"]}],"g":false,"x":0.8}
If governance is needed, g must instead be {"t":"title","u":"purpose","a":["agreement"],"q":"review question"}. Use 1-3 paths, 2-4 steps per path, 1-3 evidence items, and 1-4 assumptions. Keep each string concise, normally under 18 words. Use strict JSON: double quotes, lowercase true/false/null, no markdown, no comments, no trailing commas. Generate the entire envelope from scratch and close every object and array.`;

if(globalThis[API_KEY]?.version===VERSION){
  globalThis[API_KEY].schedule?.();
  return;
}

let queued=false;
let wrappedGenerate=null;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const strings=(value,max=8)=>Array.isArray(value)?value.map(item=>clean(item,1200)).filter(Boolean).slice(0,max):[];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
function base(){return globalThis[BASE_KEY]||null}
function isQuestRequest(request={}){
  return clean(request?.purpose,300)===PURPOSE&&request?.__civweaveLocalStructuredPlan===true;
}
function compactWorkingContext(content=''){
  const source=clean(content,24000),marker='working context:',markerIndex=source.toLowerCase().indexOf(marker);
  const jsonStart=source.indexOf('{',markerIndex>=0?markerIndex:0);
  if(jsonStart<0)return source.slice(0,6000);
  try{
    const data=JSON.parse(source.slice(jsonStart));
    const recent=Array.isArray(data?.recentConversation)?data.recentConversation.slice(-6).map(row=>({role:clean(row?.role,24),text:clean(row?.text,600)})).filter(row=>row.text):[];
    const currentPlan=object(data?.currentPlan);
    return `Generate the reviewable Quest from this compact working context:\n${JSON.stringify({
      currentRequest:clean(data?.currentRequest,2400),
      resolvedPlanningRequest:clean(data?.resolvedPlanningRequest,2400),
      currentWish:clean(data?.currentWish,1600),
      currentPlan:currentPlan?{title:clean(currentPlan.title,300),wish:clean(currentPlan.wish,900),outcome:clean(currentPlan.outcome,900),state:clean(currentPlan.state,80)}:null,
      recentConversation:recent
    })}`;
  }catch{return source.slice(0,6000)}
}
function compactMessages(messages=[]){
  const rows=Array.isArray(messages)?messages:[];
  const userRows=rows.filter(row=>row?.role==='user'&&clean(row?.content,24000));
  const contextRow=userRows.find(row=>/working context:|resolvedPlanningRequest|currentRequest/i.test(String(row?.content||'')))||userRows[0]||null;
  const repairing=rows.some(row=>row?.role==='assistant')||userRows.length>1||rows.some(row=>/repair|invalid|truncat|finish reason|max_output_tokens/i.test(String(row?.content||'')));
  const out=[];
  if(contextRow)out.push({role:'user',content:compactWorkingContext(contextRow.content)});
  if(repairing)out.push({role:'user',content:'The previous structured attempt was invalid or truncated. Regenerate the entire compact envelope from scratch. Do not continue or quote the previous output.'});
  return out.length?out:[{role:'user',content:'Generate a concise reviewable Quest from the current request.'}];
}
function normalizeType(value=''){
  const key=clean(value,80).toLowerCase().replace(/[ _]+/g,'-');
  const aliases={learning:'learning',learn:'learning','skilled-labor':'skilled-labor',labor:'skilled-labor',work:'skilled-labor',building:'skilled-labor','material-acquirement':'material-acquirement',materials:'material-acquirement',material:'material-acquirement','civic-governance':'civic-governance',governance:'civic-governance',civic:'civic-governance'};
  return aliases[key]||key;
}
function normalizeRealm(value=''){
  const key=clean(value,80).toLowerCase().replace(/[ _]+/g,'-');
  const aliases={'living-school':'living-school',livingschool:'living-school',learning:'living-school',cerbanimo:'cerbanimo',work:'cerbanimo',fellowfare:'fellowfare',materials:'fellowfare',exchange:'fellowfare',anarchadia:'anarchadia',governance:'anarchadia'};
  return aliases[key]||key;
}
function expandCompactQuest(value){
  const source=object(value);
  if(!source)return value;
  if(source.title&&source.wish&&source.outcome&&Array.isArray(source.paths))return source;
  const paths=Array.isArray(source.p)?source.p.slice(0,4).map(row=>{
    const item=object(row)||{};
    return{
      type:normalizeType(item.y??item.type),
      realm:normalizeRealm(item.r??item.realm),
      title:clean(item.t??item.title,600),
      purpose:clean(item.u??item.purpose,1600),
      steps:strings(item.s??item.steps,8),
      completionCriteria:clean(item.c??item.completionCriteria,1600),
      evidence:strings(item.e??item.evidence,8)
    };
  }):[];
  const expanded={
    title:clean(source.t??source.title,600),
    wish:clean(source.w??source.wish,4000),
    outcome:clean(source.o??source.outcome,2400),
    assumptions:strings(source.a??source.assumptions,8),
    paths
  };
  const governance=source.g??source.governance;
  if(governance===false)expanded.governance={included:false};
  else if(object(governance))expanded.governance={included:true,title:clean(governance.t??governance.title,600),purpose:clean(governance.u??governance.purpose,1600),agreements:strings(governance.a??governance.agreements,8),reviewQuestion:clean(governance.q??governance.reviewQuestion,1200)};
  const confidence=Number(source.x??source.confidence);
  if(Number.isFinite(confidence))expanded.confidence=Math.max(0,Math.min(1,confidence));
  return expanded;
}
function canonicalize(rawText=''){
  const bridge=base();
  if(bridge?.canonicalizeQuestJson)return bridge.canonicalizeQuestJson(rawText);
  const text=clean(rawText,200000).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try{const value=JSON.parse(text);return{valid:true,repaired:false,balanced:true,text:JSON.stringify(value),value,reasons:[]}}catch(error){return{valid:false,repaired:false,balanced:false,text,value:null,reasons:['invalid-json'],error:String(error?.message||error)}}
}
function completion(rawText=''){
  const bridge=base();
  if(bridge?.jsonCompletion)return bridge.jsonCompletion(rawText);
  return{hasJson:Boolean(clean(rawText)),complete:false,truncated:true};
}
function localResultText(result){
  if(typeof result==='string')return clean(result,200000);
  if(result?.status&&!['success','fallback'].includes(result.status))throw new Error(result?.error?.message||`Local AI ended with ${result.status}.`);
  return clean(result?.outputText||result?.text||result?.output||result?.generatedText||result?.message,200000);
}
function compactTransport(){
  return async({config,messages,signal,emit})=>{
    const bridge=base(),runtime=globalThis.CivweaveLocalChatRuntimeV295,pick=bridge?.selectedLocal?.();
    if(!runtime?.generate)throw new Error('The downloaded-local generation runtime is not ready for compact Quest authoring.');
    if(!pick?.active||!pick.id)throw new Error('No downloaded local AI model is selected for Quest authoring.');
    if(signal?.aborted)throw signal.reason||new DOMException('Generation cancelled','AbortError');
    const budget=Math.max(1200,Number(bridge?.budgetFor?.(pick.id)||config?.maxTokens||2400));
    const maxNewTokens=Math.max(1200,Math.min(budget,Number(config?.maxTokens)||budget));
    const chatMessages=compactMessages(messages);
    let accumulated='';
    const onAbort=()=>{try{globalThis.CivweaveLocalModelRuntimeV266?.shutdown?.({reason:'compact-structured-quest-cancelled'})}catch{}};
    signal?.addEventListener?.('abort',onAbort,{once:true});
    try{
      emit?.('generating',{structuredQuest:true,compactEnvelope:true,provider:'downloaded-local',model:pick.id,maxNewTokens});
      const result=await runtime.generate({
        systemPrompt:COMPACT_SYSTEM,
        messages:chatMessages,
        maxNewTokens,
        onToken:token=>{
          const piece=clean(typeof token==='string'?token:token?.text,12000);if(!piece)return;
          accumulated+=piece;
          try{emit?.('partial',{text:piece,accumulatedText:accumulated,structuredQuest:true,compactEnvelope:true,provider:'downloaded-local',model:pick.id})}catch{}
        },
        onProgress:progress=>{try{emit?.(progress?.phase||'generating',{...progress,structuredQuest:true,compactEnvelope:true,provider:'downloaded-local',model:pick.id})}catch{}}
      });
      const rawText=localResultText(result);
      if(!rawText)throw new Error('The selected local AI returned no compact Quest text.');
      const done=completion(rawText),parsed=done.truncated?{valid:false,text:rawText,reasons:['truncated-json']}:canonicalize(rawText),payload=result&&typeof result==='object'?{...result}:{text:rawText};
      if(done.truncated&&!payload.finishReason)payload.finishReason='MAX_OUTPUT_TOKENS';
      let text=parsed.valid?parsed.text:(parsed.text||rawText),expanded=false;
      if(parsed.valid){
        const full=expandCompactQuest(parsed.value);
        text=JSON.stringify(full);
        payload.outputText=text;
        expanded=Boolean(parsed.value&&!(parsed.value.title&&parsed.value.paths)&&parsed.value.t);
      }
      return{
        text,
        payload,
        provider:'downloaded-local',
        model:clean(result?.executionId||result?.model?.id||pick.id,240)||pick.id,
        streamed:Boolean(accumulated),
        diagnostics:[done.truncated?'Compact Quest envelope truncated; bounded regeneration requested.':expanded?'Compact Quest envelope expanded deterministically into the canonical Quest contract.':'Local Quest output already matched the canonical contract.',...(parsed.reasons||[])],
        compactQuestEnvelope:{version:VERSION,expanded,valid:Boolean(parsed.valid),repairInputCompacted:true}
      };
    }finally{signal?.removeEventListener?.('abort',onAbort)}
  };
}
function hardenRequest(request={}){
  const bridge=base();
  if(!bridge?.hardenRequest||!isQuestRequest(request))return request;
  const hardened=bridge.hardenRequest(request);
  return{
    ...hardened,
    maxRepairAttempts:Math.max(2,Number(hardened.maxRepairAttempts)||0),
    transport:compactTransport(),
    __civweaveCompactStructuredQuestEnvelopeV1:true
  };
}
function install(){
  const bridge=base(),runtime=globalThis.CivweaveModelRuntime;
  if(!bridge?.hardenRequest||!runtime?.generate)return false;
  if(runtime.generate.__civweaveGemma4StructuredQuestCompactEnvelopeV1===VERSION){wrappedGenerate=runtime.generate;return true}
  const prior=runtime.generate;
  const generate=async request=>{
    if(!isQuestRequest(request))return prior.call(runtime,request);
    const hardened=hardenRequest(request);
    const forwarded={...hardened,__civweaveLocalStructuredPlan:false};
    const result=await prior.call(runtime,forwarded);
    return bridge.clarifyResult?.(result,hardened)||result;
  };
  generate.__civweaveGemma4StructuredQuestCompactEnvelopeV1=VERSION;
  generate.__civweaveGemma4StructuredQuestCompletionV1=bridge.version;
  generate.__prior=prior;
  const next={...runtime,generate,gemma4StructuredQuestCompactEnvelope:VERSION,gemma4StructuredQuestCompactRepair:true};
  try{globalThis.CivweaveModelRuntime=next}catch{return false}
  wrappedGenerate=generate;
  try{dispatchEvent(new CustomEvent('civweave:gemma4-structured-quest-compact-envelope-ready',{detail:{version:VERSION,compactEnvelope:true,repairInputCompacted:true,maxRepairAttempts:2}}))}catch{}
  return true;
}
function schedule(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;install()});
}
for(const name of ['civweave:gemma4-structured-quest-completion-ready','civweave:model-runtime-ready','civweave:local-provider-authority-installed','civweave:unified-chat-system-ready','civweave:guide-loader-reset','pageshow'])addEventListener(name,schedule);
for(const delay of [0,80,260,900,1800,3600])setTimeout(schedule,delay);

globalThis[API_KEY]=Object.freeze({
  version:VERSION,
  purpose:PURPOSE,
  compactSystem:COMPACT_SYSTEM,
  compactWorkingContext,
  compactMessages,
  expandCompactQuest,
  compactTransport,
  hardenRequest,
  install,
  schedule,
  compactEnvelope:true,
  repairInputCompacted:true,
  maxRepairAttempts:2,
  state:()=>Object.freeze({installed:Boolean(wrappedGenerate),baseVersion:base()?.version||'',model:base()?.selectedLocal?.()?.id||''})
});
schedule();
})();
