// Explicit and narrowly scoped browser-to-Termux fast lane.
// Does not start Wllama, LiteRT, ONNX, Cloudflare or the general assistant loader.
export const NATIVE_MODEL='qwen35-4b-native';
export const NATIVE_ENDPOINT='http://127.0.0.1:8080/v1';
const MODEL_RUNTIME='/app/shared/civweave-model-runtime.js?v=1.0.9-native-server-no-helper-stream';
const MOSS_PLANNER='/app/unified-chat-system-v1.js?v=1.2.3-moss-native-direct-planning';
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
    ()=>globalThis.CivweaveUnifiedChatSystemV1?.version==='1.2.3-unified-chat-system-v1-native-direct-planning','Moss planner')
    .catch(error=>{plannerPromise=null;throw error});
  await plannerPromise;
  return globalThis.CivweaveUnifiedChatSystemV1;
}
function explicitLearningGoal(text){
  return /\b(?:teach me|help me (?:learn|study|memorize|understand)|i (?:want|need|would like) to (?:learn|study)|learning journey|curriculum|study plan)\b/i.test(text);
}
export async function respondNative({system='civweave',text='',history=[],fetcher=fetch}={}){
  if(!nativeSelection())throw new Error('The selected native llama-server route changed. No inference was started.');
  const user=clean(text,5000);if(!user)throw new Error('There was no text to send to the selected server.');
  markNativeStage('native-fast-lane',system);
  if(system==='living-school'&&explicitLearningGoal(user)){
    markNativeStage('moss-planner-loading');
    const planner=await ensurePlanner();
    markNativeStage('moss-planner-ready');
    const result=await planner.generateLivingSchoolPlan({text:user,history,nativeFastLane:true});
    markNativeStage('moss-plan-finished',result?.provider||'unknown');
    return result;
  }
  const [name,role]=GUIDE[system]||GUIDE.civweave;
  const prior=(Array.isArray(history)?history:[]).slice(-4)
    .filter(row=>['user','assistant'].includes(row?.role))
    .filter(row=>clean(row.text||row.content)!==user)
    .map(row=>({role:row.role,content:clean(row.text||row.content,500)}));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),75000);
  try{
    const messages=[
      {role:'system',content:`You are ${name}, a ${role} in Civweave. Answer the latest user request directly and concisely. Do not invent completed actions. For structured plans, wait for the appropriate approval process.`},
      ...prior,{role:'user',content:user}
    ];
    markNativeStage('native-post-start',`messages:${messages.length}`);
    const response=await fetcher(NATIVE_ENDPOINT+'/chat/completions',{
      method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
      headers:{'content-type':'application/json'},
      signal:controller.signal,
      body:JSON.stringify({model:NATIVE_MODEL,messages,stream:false,max_tokens:192,temperature:0.3})
    });
    markNativeStage('native-http-response','HTTP '+response.status);
    if(!response.ok)throw new Error('Termux llama-server returned HTTP '+response.status+': '+(await response.text()).slice(0,240));
    const payload=await response.json();
    const answer=clean(payload?.choices?.[0]?.message?.content,8000);
    if(!answer)throw new Error('Termux returned no visible response text.');
    markNativeStage('native-text-complete',`tokens:${Number(payload?.usage?.completion_tokens)||0}`);
    return{response:{answer,choice:{mode:system==='living-school'?'Learn':'Reflect',system,room:'',nextAction:''},assumptions:[],requiresConsent:false,confidence:.75},
      provider:'openai-compatible',model:NATIVE_MODEL,usage:payload.usage||null,action:null};
  }catch(error){
    markNativeStage('native-error',controller.signal.aborted?'75-second inference timeout':clean(error?.message||error,150));
    if(controller.signal.aborted)throw new Error('The Termux model did not complete the request within 75 seconds. No other model was started.');
    throw error;
  }finally{clearTimeout(timer)}
}
