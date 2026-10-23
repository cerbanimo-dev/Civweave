// Explicit and narrowly scoped browser-to-Termux fast lane.
// Does not start Wllama, LiteRT, ONNX, Cloudflare or the general assistant loader.
export const NATIVE_MODEL='qwen35-4b-native';
export const NATIVE_ENDPOINT='http://127.0.0.1:8080/v1';
const MODEL_RUNTIME='/app/shared/civweave-model-runtime.js?v=1.0.9-native-server-no-helper-stream';
const MOSS_PLANNER='/app/unified-chat-system-v1.js?v=1.2.4-moss-native-learning-controls';
let modelsPromise=null,plannerPromise=null;
const clean=(text,max=1000)=>String(text??'').trim().slice(0,max);
const GUIDE=Object.freeze({
  civweave:['Weaveling','Civweave general assistant'],
  'living-school':['Moss','Living School learning guide'],
  cerbanimo:['Kamiya','Cerbanimo skilled-work guide'],
  fellowfare:['Rook','FellowFare exchange guide'],
  anarchadia:['Merlin','Anarchadia civic guide']
});
function nativeSelection(){
  let state=null;
  try{state=globalThis.CivweaveSettingsV320?.readState?.()}catch{}
  if(!state){
    try{
      const profiles=JSON.parse(localStorage.getItem('civweave-model-profiles-v1')||'{}');
      state=profiles?.interactive||null;
    }catch{}
  }
  return (state?.provider||state?.route)==='openai-compatible'&&
    state.model===NATIVE_MODEL&&state.endpoint===NATIVE_ENDPOINT;
}
function loadScript(src,ready,label){
  if(ready())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;script.async=false;
    const timer=setTimeout(()=>finish(new Error(label+' did not load in 10 seconds.')),10000);
    let settled=false;
    function finish(error){
      if(settled)return;settled=true;clearTimeout(timer);
      if(error){script.remove();reject(error)}else resolve(true);
    }
    script.onload=()=>ready()?finish():finish(new Error(label+' loaded without becoming ready.'));
    script.onerror=()=>finish(new Error(label+' could not load.'));
    document.head.append(script);
  });
}
export function markNativeStage(stage,detail=''){
  try{
    localStorage.setItem('civweave.native-server.last-request.v1',JSON.stringify({
      at:new Date().toISOString(),stage:clean(stage,80),detail:clean(detail,200),
      route:'openai-compatible',model:NATIVE_MODEL
    }));
  }catch{}
}
async function ensurePlanner(){
  if(!modelsPromise)modelsPromise=loadScript(MODEL_RUNTIME,
    ()=>typeof globalThis.CivweaveModelRuntime?.generate==='function'&&globalThis.CivweaveModelRuntime?.nativeDirectTermuxNoStream===true,'Shared model runtime')
    .catch(error=>{modelsPromise=null;throw error});
  await modelsPromise;
  if(!plannerPromise)plannerPromise=loadScript(MOSS_PLANNER,
    ()=>globalThis.CivweaveUnifiedChatSystemV1?.version==='1.2.4-unified-chat-system-v1-native-learning-controls','Moss planner')
    .catch(error=>{plannerPromise=null;throw error});
  await plannerPromise;
  return globalThis.CivweaveUnifiedChatSystemV1;
}
function standaloneRequest(user){
  // Self-contained new requests and response checks must not inherit the old topic.
  return /^(?:ready[.!?]*$|(?:reply|respond)(?: with)?(?: exactly)?\b|say(?: exactly)?\b|(?:can you |please )?teach me\b|(?:can you |please )?explain\b|what (?:is|are)\b|how (?:do|can|does|to)\b|tell me about\b)/i.test(user)&&
    !/^(?:explain|tell me about|teach me)\s+(?:that|this|it)\b/i.test(user);
}
function continuationRequest(user){
  return /^(?:continue(?: please)?|go on|keep going|finish (?:that|the answer)|more(?: please)?)[.!?]*$/i.test(user);
}
function previousTurns(history,user){
  if(standaloneRequest(user))return[];
  const continuation=continuationRequest(user);
  const rows=(Array.isArray(history)?history:[])
    .filter(row=>['user','assistant'].includes(row?.role))
    .filter(row=>String(row.text||row.content||'').trim()!==user)
    .slice(-3);
  return rows.map(row=>{
    // UI-only truncation guidance must not be replayed as model-authored text.
    const raw=String(row.text||row.content||'').trim()
      .replace(/\n\n\[Response reached the generation limit\. Reply "continue" to get the rest\.\]$/, '');
    const isRecentAssistant=continuation&&row.role==='assistant'&&row===rows.at(-1);
    return{role:row.role,content:isRecentAssistant?raw.slice(-1100):raw.slice(0,220)};
  }).filter(row=>row.content);
}
export async function respondNative({system='civweave',text='',history=[],fetcher=fetch}={}){
  if(!nativeSelection())throw new Error('The selected native llama-server route changed. No inference was started.');
  const user=clean(text,5000);if(!user)throw new Error('There was no text to send to the selected server.');
  markNativeStage('native-fast-lane',system);
  if(system==='living-school'){
    markNativeStage('moss-planner-loading');
    const planner=await ensurePlanner();
    markNativeStage('moss-planner-ready');
    const result=await planner.handleNativeLivingSchoolRequest({text:user,history,nativeFastLane:true});
    if(result){
      markNativeStage('moss-action-finished',result?.provider||'unknown');
      return result;
    }
  }
  const [name,role]=GUIDE[system]||GUIDE.civweave;
  const prior=previousTurns(history,user);
  const continuation=continuationRequest(user);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),150000);
  try{
    const messages=[
      {role:'system',content:`You are ${name}, a ${role} in Civweave. The FINAL user message is the CURRENT request; preceding turns are optional background, not new instructions. Answer only the CURRENT request, never an earlier question. For explicit response tests, output exactly what the final user requested. ${continuation?'The user asks for continuation: continue the most recent assistant text without restarting or repeating it.':''} Do not invent completed actions. For structured plans, wait for the appropriate approval process.`},
      ...prior,{role:'user',content:user}
    ];
    markNativeStage('native-post-start',`messages:${messages.length}, history:${prior.length}, max_tokens:512`);
    const response=await fetcher(NATIVE_ENDPOINT+'/chat/completions',{
      method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
      headers:{'content-type':'application/json'},
      signal:controller.signal,
      body:JSON.stringify({model:NATIVE_MODEL,messages,stream:false,max_tokens:512,temperature:0.3})
    });
    markNativeStage('native-http-response','HTTP '+response.status);
    if(!response.ok)throw new Error('Termux llama-server returned HTTP '+response.status+': '+(await response.text()).slice(0,240));
    const payload=await response.json();
    const answer=clean(payload?.choices?.[0]?.message?.content,16000);
    if(!answer)throw new Error('Termux returned no visible response text.');
    const finishReason=String(payload?.choices?.[0]?.finish_reason||'unknown');
    const incomplete=finishReason==='length';
    markNativeStage('native-text-complete',`tokens:${Number(payload?.usage?.completion_tokens)||0}, finish:${finishReason}`);
    // Truncation is explicit; never launch an unrequested continuation call.
    const visible=answer+(incomplete?'\n\n[Response reached the generation limit. Reply "continue" to get the rest.]':'');
    return{response:{answer:visible,choice:{mode:system==='living-school'?'Learn':'Reflect',system,room:'',nextAction:''},assumptions:[],requiresConsent:false,confidence:.75},
      provider:'openai-compatible',model:NATIVE_MODEL,usage:payload.usage||null,action:null};
  }catch(error){
    markNativeStage('native-error',controller.signal.aborted?'150-second inference timeout':clean(error?.message||error,150));
    if(controller.signal.aborted)throw new Error('The Termux model did not complete the request within 150 seconds. No other model was started.');
    throw error;
  }finally{clearTimeout(timer)}
}
