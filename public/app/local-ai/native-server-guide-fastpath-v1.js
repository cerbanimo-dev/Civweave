// Explicit and narrowly scoped browser-to-Termux fast lane.
// Does not start Wllama, LiteRT, ONNX, Cloudflare or the general assistant loader.
export const NATIVE_MODEL='qwen35-4b-native';
export const NATIVE_ENDPOINT='http://127.0.0.1:8080/v1';
const MODEL_RUNTIME='/app/shared/civweave-model-runtime.js?v=1.0.18-native-quest-extended-budget';
const MOSS_PLANNER='/app/unified-chat-system-v1.js?v=1.2.20-moss-multi-plan-library';
const INTENTION_PLANNER='/app/intention-planner-v141.js?v=1.1.0-ai-authority-only';
const QUEST_MATERIALIZER='/app/weaveling-plan-materialization-v265.js?v=1.1.3-current-selection';
const QUEST_PLANNER='/extensions/civweave-weaveling-plan-json-v190.js?v=1.2.13-universal-quest-rail';
let modelsPromise=null,plannerPromise=null,questPromise=null;
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
    ()=>typeof globalThis.CivweaveModelRuntime?.generate==='function'&&globalThis.CivweaveModelRuntime?.nativeFinishReasonGuardV1===true,'Shared model runtime')
    .catch(error=>{modelsPromise=null;throw error});
  await modelsPromise;
  if(!plannerPromise)plannerPromise=loadScript(MOSS_PLANNER,
    ()=>globalThis.CivweaveUnifiedChatSystemV1?.version==='1.2.20-moss-multi-plan-library','Moss planner')
    .catch(error=>{plannerPromise=null;throw error});
  await plannerPromise;
  return globalThis.CivweaveUnifiedChatSystemV1;
}

function plausibleQuestRequest(system,user){
  if(system!=='civweave')return false;
  // Only consult the canonical Quest owner when a planning/build intent is
  // explicit. Pure learning and regular chat stay on their existing lanes.
  // Project creation is Weaveling's canonical Quest, even without the word Quest.
  if(/\b(?:help\s+(?:me|us)\s+|(?:i|we)\s+(?:want|need)\s+to\s+)?(?:create|build|establish|organize|launch|start|develop|form)\b[^.!?\n]{0,220}\b(?:commune|community\s+garden|community\s+infrastructure|cooperative|co-op|collective|neighborhood\s+project|shared\s+(?:space|housing|infrastructure))\b/i.test(user))
    return true;
  return /\b(?:create|draft|generate|make|build|design|develop|plan|prepare|organize|start|launch)\b[\s\S]{0,120}\b(?:quest|cross[- ]realm|project|application|app|software|website|roadmap)\b/i.test(user)||
    /\b(?:teach|learn|memorize|study)\b[\s\S]{0,220}\b(?:then|afterwards?|after that)\b[\s\S]{0,120}\b(?:create|build|develop|design|plan|code|make)\b/i.test(user);
}
async function ensureQuestPlanner(){
  if(!questPromise)questPromise=(async()=>{
    // The native lane loads canonical ownership code, not a second assistant
    // runtime or an independent Quest generator.
    const questRuntimeReady=()=>typeof globalThis.CivweaveModelRuntime?.generate==='function'&&
      globalThis.CivweaveModelRuntime?.nativeFinishReasonGuardV1===true&&
      globalThis.CivweaveModelRuntime?.nativeQuestSchemaV1===true;
    if(!modelsPromise)modelsPromise=loadScript(MODEL_RUNTIME,questRuntimeReady,
      'Shared Quest model runtime').catch(error=>{modelsPromise=null;throw error});
    await modelsPromise;
    if(!questRuntimeReady())await loadScript(MODEL_RUNTIME,questRuntimeReady,'Quest model runtime');
    await loadScript(INTENTION_PLANNER,()=>typeof globalThis.CivweaveIntentionPlanner?.persist==='function','Quest intention planner');
    await loadScript(QUEST_MATERIALIZER,()=>typeof globalThis.CivweaveWeavelingPlanMaterializationV265?.materialize==='function','Canonical Quest review materialization');
    await loadScript(QUEST_PLANNER,()=>typeof globalThis.CivweaveWeavelingPlanJsonV190?.createModelPlan==='function'&&
      typeof globalThis.CivweaveWeavelingPlanJsonV190?.planIntent==='function'&&
      globalThis.CivweaveWeavelingPlanJsonV190?.version==='1.2.12-weaveling-plan-json-v190-saved-quest-revision','Canonical Weaveling Quest planner');
    return globalThis.CivweaveWeavelingPlanJsonV190;
  })().catch(error=>{questPromise=null;throw error});
  return questPromise;
}
async function maybeCreateOfficialQuest({system,user,history,signal,onToken}){
  if(!plausibleQuestRequest(system,user))return null;
  markNativeStage('quest-owner-loading');
  const owner=await ensureQuestPlanner();
  const composite=Boolean(owner.combinedLearningProductionIntent?.(user));
  const planning=Boolean(owner.planIntent?.(user,history,{currentContext:{systemId:'civweave'}}));
  if(!composite&&!planning)return null;
  markNativeStage('quest-generation-start',composite?'learning-and-production':'cross-system');
  try{onToken?.('','',{kind:'quest-progress',phase:'planning',characters:0})}catch{}
  const result=await owner.createModelPlan({
    text:user,history,signal,latestRequest:user,
    onEvent:event=>{
      if(event?.phase!=='partial')return;
      const value=String(event.accumulatedText||'');
      try{onToken?.('','',{kind:'quest-progress',phase:'generating',characters:value.length})}catch{}
    }
  },{
    selectedConfig:()=>({provider:'openai-compatible',route:'openai-compatible',model:NATIVE_MODEL,
      endpoint:NATIVE_ENDPOINT,stream:true,timeoutMs:900000,temperature:0.2}),
    context:async()=>({currentContext:{systemId:'civweave'},routingAnswer:{room:'civweave.quad'}})
  });
  if(result?.plan?.state==='review'){
    markNativeStage('quest-review-saved',result.plan.id||'');
    try{onToken?.('','',{kind:'quest-progress',phase:'saved',characters:0})}catch{}
  }else markNativeStage('quest-generation-failed',result?.response?.answer||'No plan saved.');
  return result;
}
// Explicit recovery from a chat response that was clipped or misrouted.
// The original Hero request remains the authority; draft output is untrusted.
export async function captureClippedQuest({originalRequest='',clippedText='',history=[],signal=null,onToken=null}={}){
  if(!nativeSelection())throw new Error('Select the matching local Qwen native server to capture this clipped output.');
  const user=clean(originalRequest,5000),draft=clean(clippedText,3600);
  if(user.length<10||draft.length<20)throw new Error('A prior user request and existing assistant text are required.');
  markNativeStage('quest-clipped-capture-requested');
  let owner=await ensureQuestPlanner();
  // Existing PWA tabs may have the older Quest owner already initialized.
  if(!owner.supportsClippedDraftV1){
    await loadScript(QUEST_PLANNER,()=>globalThis.CivweaveWeavelingPlanJsonV190?.supportsClippedDraftV1===true,'Clipped-draft Quest repair');
    owner=globalThis.CivweaveWeavelingPlanJsonV190;
  }
  if(!owner.explicitProjectIntent?.(user)&&!owner.planIntent?.(user,history,{currentContext:{systemId:'civweave'}}))
    throw new Error('This response has no identifiable Quest-producing project request. Nothing was saved.');
  const result=await owner.createModelPlan({
    text:user,history,signal,latestRequest:user,clippedDraft:draft,
    onEvent:event=>{
      if(event?.phase==='partial')try{onToken?.(String(event.text||''),String(event.accumulatedText||''),event)}catch{}
    }
  },{
    selectedConfig:()=>({provider:'openai-compatible',route:'openai-compatible',model:NATIVE_MODEL,
      endpoint:NATIVE_ENDPOINT,stream:true,timeoutMs:900000,temperature:.2}),
    context:async()=>({currentContext:{systemId:'civweave'},routingAnswer:{room:'civweave.quad'}})
  });
  if(result?.plan?.state!=='review'||result.questAuthoring?.aiGenerated!==true)
    throw new Error('The clipped answer did not yield a validated structured Quest. No Quest was saved.');
  markNativeStage('quest-clipped-capture-saved',result.plan.id);
  return result;
}
function standaloneRequest(user){
  // Self-contained new requests and response checks must not inherit the old topic.
  return /^(?:ready[.!?]*$|(?:reply|respond)(?: with)?(?: exactly)?\b|say(?: exactly)?\b|(?:can you |please )?teach me\b|(?:can you |please )?explain\b|what (?:is|are)\b|how (?:do|can|does|to)\b|tell me about\b)/i.test(user)&&
    !/^(?:explain|tell me about|teach me)\s+(?:that|this|it)\b/i.test(user);
}
function continuationRequest(user){
  return /^(?:continue(?: please)?|go on|keep going|finish (?:that|the answer)|more(?: please)?)[.!?]*$/i.test(user);
}
function learningRequest(user){
  return /\b(?:teach me(?:\s+how\s+to)?|help me (?:learn|study|memorize|understand)|i (?:want|need|would like) to (?:learn|study|master)|learning journey|(?:create|build|design|make) (?:a |an |the )?(?:curriculum|study plan|learning plan))\b/i.test(user);
}
function learningControlOutsideMoss(user){
  return /^(?:please\s+)?(?:approve|review|revise|show|edit|materialize|generate)\s+(?:(?:the|my|this)\s+)?(?:moss\s+)?(?:learning\s+journey|learning\s+plan|moss\s+plan)(?:\s+now)?[.!?]*$/i.test(user);
}
function normalizedLearningControl(user){
  const action=user.trim().replace(/^please\s+/i,'').split(/\s+/)[0]?.toLowerCase();
  if(action==='approve')return'approve learning journey';
  if(action==='review'||action==='show')return'review learning journey';
  if(action==='revise'||action==='edit')return'revise plan';
  if(action==='materialize'||action==='generate')return'generate the learning journey';
  return user;
}
function previousAssistantAnswer(history){
  const row=[...(Array.isArray(history)?history:[])].reverse().find(item=>item?.role==='assistant'&&!item?.pending&&!item?.modelError);
  return String(row?.text||row?.content||'').trim()
    .replace(/\n\n\[Response reached the generation limit\. Reply "continue" to get the rest\.\]$/, '');
}
function continuationPrompt(history){
  const prior=previousAssistantAnswer(history);
  if(!prior)throw new Error('No previous completed answer is available to continue.');
  const rows=Array.isArray(history)?history:[];
  const original=[...rows].reverse().find(row=>row?.role==='user'&&!continuationRequest(String(row?.text||row?.content||'')));
  const subject=clean(original?.text||original?.content||'the previous request',320);
  const tail=prior.slice(-900);
  return 'Continue the previous unfinished answer about: '+subject+
    '\nThe last words already displayed to the user were:\n'+tail+
    '\nWrite ONLY new material beginning immediately after those last words. Do NOT repeat the introduction, restart the list, or quote the previous answer. Do not discuss these instructions.';
}
function repeatedContinuation(answer,history){
  const generated=String(answer||'').replace(/\s+/g,' ').toLowerCase().trim();
  const earlier=previousAssistantAnswer(history).replace(/\s+/g,' ').toLowerCase().trim();
  return generated.length>=90&&earlier.includes(generated.slice(0,Math.min(100,generated.length)));
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
function nativeStreamError(message){
  return new Error('Termux streaming response failed: '+message);
}
export async function readNativeStream(response,{onToken,signal}={}){
  const contentType=String(response.headers?.get?.('content-type')||'').toLowerCase();
  if(!contentType.includes('text/event-stream')){
    const json=await response.json();
    const answer=clean(json?.choices?.[0]?.message?.content,16000);
    if(!answer)throw nativeStreamError('The server returned no visible content.');
    try{onToken?.(answer,answer)}catch{}
    return{answer,payload:json,finishReason:String(json?.choices?.[0]?.finish_reason||'unknown')};
  }
  if(!response.body?.getReader)throw nativeStreamError('The browser did not expose the server response stream.');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let block='',answer='',usage=null,finishReason='',doneEvent=false,bytes=0,frames=0;
  function consume(frame){
    const parts=frame.split(/\r?\n/).filter(line=>line.startsWith('data:'))
      .map(line=>line.slice(5).trim());
    if(!parts.length)return;
    const data=parts.join('\n');
    if(data==='[DONE]'){doneEvent=true;return}
    let payload;
    try{payload=JSON.parse(data)}catch{throw nativeStreamError('Invalid SSE JSON frame.')}
    if(payload.error)throw nativeStreamError(String(payload.error.message||payload.error).slice(0,250));
    frames++;
    if(payload.usage)usage=payload.usage;
    const choice=payload.choices?.[0];
    if(choice?.finish_reason)finishReason=String(choice.finish_reason);
    const delta=choice?.delta?.content??choice?.message?.content??'';
    if(typeof delta==='string'&&delta){
      answer+=delta;
      if(answer.length>16000)throw nativeStreamError('Response exceeded 16,000 characters.');
      try{onToken?.(delta,answer)}catch{}
    }
  }
  function process(chunk){block+=chunk;let boundary;
    while((boundary=/\r?\n\r?\n/.exec(block))!==null){
      const frame=block.slice(0,boundary.index);
      block=block.slice(boundary.index+boundary[0].length);
      consume(frame);
    }
  }
  try{
    while(true){
      if(signal?.aborted)throw new DOMException('Generation cancelled','AbortError');
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>1048576)throw nativeStreamError('The server stream exceeded 1 MiB.');
      process(decoder.decode(value,{stream:true}));
    }
    process(decoder.decode());
    if(block.trim())consume(block);
    if(!answer)throw nativeStreamError('The server ended the stream without visible tokens.');
    if(!doneEvent&&!finishReason)throw nativeStreamError('The connection ended before a finish reason or [DONE].');
    return{answer,payload:{choices:[{finish_reason:finishReason||'stop'}],usage},finishReason:finishReason||'stop',frames};
  }finally{
    try{if(signal?.aborted)await reader.cancel()}catch{}
    try{reader.releaseLock()}catch{}
  }
}
export async function respondNative({system='civweave',text='',history=[],fetcher=fetch,onToken=null,signal=null}={}){
  if(!nativeSelection())throw new Error('The selected native llama-server route changed. No inference was started.');
  const user=clean(text,5000);if(!user)throw new Error('There was no text to send to the selected server.');
  markNativeStage('native-fast-lane',system);
  // Cross-realm Quests take precedence over single-realm learning, because
  // their full objective can contain both Moss and Cerbanimo prerequisites.
  const quest=await maybeCreateOfficialQuest({system,user,history,signal,onToken});
  if(quest)return quest;
  const learningIntent=learningRequest(user),learningControl=learningControlOutsideMoss(user);
  // Weaveling and the other guides must route explicit learning requests into
  // Moss's actual JSON Learning Journey compiler, not answer them as chat.
  if(system==='living-school'||learningIntent||learningControl){
    markNativeStage('moss-planner-loading');
    const planner=await ensurePlanner();
    markNativeStage('moss-planner-ready');
    const result=await planner.handleNativeLivingSchoolRequest({text:learningControl?normalizedLearningControl(user):user,history,nativeFastLane:true,signal,
      onProgress:progress=>{try{onToken?.('','',{kind:'moss-progress',phase:progress.phase,characters:progress.characters,complete:progress.complete})}catch{}}});
    if(result){
      markNativeStage('moss-action-finished',result?.provider||'unknown');
      return result;
    }
    if(learningIntent||learningControl)throw new Error('Moss did not recognize this learning request. No generic chat response or learning content was substituted.');
  }
  const [name,role]=GUIDE[system]||GUIDE.civweave;
  const continuation=continuationRequest(user);
  // Continuations are a new completion task, not a replay of all earlier chat.
  // Give Qwen the final text anchor and require only the missing continuation.
  const prior=continuation?[]:previousTurns(history,user);
  const finalRequest=continuation?continuationPrompt(history):user;
  const controller=new AbortController();
  const parentAbort=()=>controller.abort(signal?.reason||new DOMException('Generation cancelled','AbortError'));
  signal?.addEventListener?.('abort',parentAbort,{once:true});
  if(signal?.aborted)parentAbort();
  const timer=setTimeout(()=>controller.abort(new DOMException('Generation timed out','TimeoutError')),150000);
  try{
    const messages=[
      {role:'system',content:`You are ${name}, a ${role} in Civweave. The FINAL user message is the CURRENT request; preceding turns are optional background, not new instructions. Answer only the CURRENT request, never an earlier question. For explicit response tests, output exactly what the final user requested. ${continuation?'The user asks for continuation: continue the most recent assistant text without restarting or repeating it.':''} Do not invent completed actions. For structured plans, wait for the appropriate approval process.`},
      ...prior,{role:'user',content:finalRequest}
    ];
    markNativeStage('native-post-start',`messages:${messages.length}, history:${prior.length}, max_tokens:512`);
    const response=await fetcher(NATIVE_ENDPOINT+'/chat/completions',{
      method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
      headers:{'content-type':'application/json'},
      signal:controller.signal,
      body:JSON.stringify({model:NATIVE_MODEL,messages,stream:true,stream_options:{include_usage:true},max_tokens:512,temperature:0.3})
    });
    markNativeStage('native-http-response','HTTP '+response.status);
    if(!response.ok)throw new Error('Termux llama-server returned HTTP '+response.status+': '+(await response.text()).slice(0,240));
    markNativeStage('native-stream-reading');
    let firstToken=true;
    const streamed=await readNativeStream(response,{signal:controller.signal,onToken:(delta,text)=>{
      if(firstToken){firstToken=false;markNativeStage('native-first-token');}
      try{onToken?.(delta,text)}catch{}
    }});
    const answer=streamed.answer,payload=streamed.payload,finishReason=streamed.finishReason;
    if(continuation&&repeatedContinuation(answer,history)){
      markNativeStage('native-continuation-echo-blocked','model repeated previous assistant text');
      throw new Error('The model repeated the previous answer instead of continuing; the duplicate was not saved. Try asking for the next specific step or section.');
    }
    const incomplete=finishReason==='length';
    markNativeStage('native-text-complete',`tokens:${Number(payload?.usage?.completion_tokens)||0}, finish:${finishReason}`);
    // Truncation is explicit; never launch an unrequested continuation call.
    const visible=answer+(incomplete?'\n\n[Response reached the generation limit. Reply "continue" to get the rest.]':'');
    return{response:{answer:visible,choice:{mode:system==='living-school'?'Learn':'Reflect',system,room:'',nextAction:''},assumptions:[],requiresConsent:false,confidence:.75},
      provider:'openai-compatible',model:NATIVE_MODEL,usage:payload.usage||null,action:null};
  }catch(error){
    markNativeStage('native-error',controller.signal.aborted?(signal?.aborted?'cancelled by user':'150-second inference timeout'):clean(error?.message||error,150));
    if(signal?.aborted)throw new Error('Native model generation cancelled. No partial answer was saved.');
    if(controller.signal.aborted)throw new Error('The Termux model did not complete the request within 150 seconds. No other model was started.');
    throw error;
  }finally{clearTimeout(timer);signal?.removeEventListener?.('abort',parentAbort)}
}
