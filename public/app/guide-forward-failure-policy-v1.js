(()=>{
'use strict';

const VERSION='1.0.1-guide-forward-failure-policy-v1-local-provider-pin';
const SYSTEMS=new Set(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const PROFILES_KEY='civweave-model-profiles-v1';
const LEGACY_KEY='civweave.universal-ai.v127';
const SERVER_ROUTER='/app/server-ai-router-v301.js?v=1.0.117-guild-only-handoff';
const LOCAL_ROUTES=new Set(['downloaded-local','device-local']);
const TINY_RE=/\b(?:smollm2-(?:135m|360m)|qwen3-0\.6b|gemma3-1b)\b/i;
const FALLBACK_TEXT_RE=/(?:kept this locally\.|could not run the selected local model|selected local model did not finish|deterministic(?:-| )local|server-side ai could not complete)/i;
let wrappedRouter=null,wrappedAssistant=null,wrappedLocalRuntime=null,serverRouterPromise=null,threadRewrite=false;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
function objectFrom(storage,key){try{const value=parse(storage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}}
function configuredInteractive(){
  try{const shared=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive');if(shared&&typeof shared==='object')return shared}catch{}
  const profiles=objectFrom(localStorage,PROFILES_KEY);if(profiles.interactive&&typeof profiles.interactive==='object')return profiles.interactive;
  return objectFrom(localStorage,LEGACY_KEY);
}
function configuredRoute(){const raw=configuredInteractive();return clean(raw.provider||raw.route,80).toLowerCase()}
function serverAutoConfigured(){return configuredRoute()==='server-auto'}
function localConfigured(){return LOCAL_ROUTES.has(configuredRoute())}
function guideName(system){return system==='living-school'?'Moss':system==='cerbanimo'?'Kamiya':system==='fellowfare'?'Rook':system==='anarchadia'?'Merlin':'Weaveling'}
function guideMode(system){return system==='living-school'?'Learn':system==='cerbanimo'?'Build':system==='fellowfare'?'Acquire':system==='anarchadia'?'Govern':'Reflect'}

function structuredArtifact(text){
  const t=clean(text,8000).toLowerCase();
  if(!t)return'';
  if(/\b(curriculum|course|syllabus|lesson plan|learning (?:path|pathway|program|plan)|study plan|training plan|teaching plan|skill tree)\b/.test(t))return'curriculum';
  if(/\b(resource manifest|skill manifest|procurement plan|sourcing plan|materials? plan|inventory plan)\b/.test(t))return'resource';
  if(/\b(governance plan|proposal|policy|rule change|charter|motion|vote plan|decision process)\b/.test(t))return'governance';
  if(/\b(cross[- ]realm|multi[- ]realm|weave|intention plan)\b/.test(t))return'weave';
  if(/\b(project plan|work plan|implementation plan|quest plan|roadmap)\b/.test(t))return'quest';
  const asksForPlan=/\b(?:plan|roadmap|steps?|path)\b/.test(t);
  const outcomeVerb=/\b(?:build|create|make|organize|launch|develop|repair|fix|start|establish|set up|setup|learn|teach|practice|prepare|design)\b/.test(t);
  if(asksForPlan&&outcomeVerb)return /\b(?:learn|teach|practice|study|lesson|skill)\b/.test(t)?'curriculum':'quest';
  return'';
}
function promoteRoute(route,text){
  if(!route||route.networkRequired||route.artifactClass)return route;
  const artifact=structuredArtifact(text);if(!artifact)return route;
  const lengthClass=['fast','smart'].includes(route.lengthClass)?route.lengthClass:'fast';
  return Object.freeze({...route,lengthClass,taskClass:'structured-artifact',artifactClass:artifact,networkRequired:true,confidence:Math.max(.86,Number(route.confidence||0)),source:'cross-realm-structure-safety-net',semanticFallback:route.source||null,tier:globalThis.CivweaveResponseRouterV347?.tiers?.[lengthClass]||route.tier});
}
function installRouter(){
  const router=globalThis.CivweaveResponseRouterV347;if(!router?.classify)return false;
  if(router.__civweaveGuideForwardPolicyV1){wrappedRouter=router;return true}
  if(wrappedRouter===router)return true;
  const previous=router.classify.bind(router);
  const classify=async(text,request={})=>promoteRoute(await previous(text,request),text);
  globalThis.CivweaveResponseRouterV347=Object.freeze({...router,classify,__civweaveGuideForwardPolicyV1:true,forwardFailurePolicyVersion:VERSION,crossRealmStructuredIntent:true});
  wrappedRouter=globalThis.CivweaveResponseRouterV347;
  try{dispatchEvent(new CustomEvent('civweave:guide-forward-router-installed',{detail:{version:VERSION,at:now()}}))}catch{}
  return true;
}

function handoffResult(args={},reason='local-or-configured-ai-unavailable'){
  const system=SYSTEMS.has(args.systemId)?args.systemId:'civweave',text=clean(args.text,12000),name=guideName(system);
  return{
    response:{
      answer:`${name} needs a stronger generative route for this request. Civweave kept the request intact on this device instead of replacing it with a deterministic answer. You can send it to your Guild for processing when you choose.`,
      choice:{mode:guideMode(system),system,room:'',nextAction:''},
      assumptions:[],requiresConsent:true,confidence:1,
      approvalGate:{kind:'guild-ai-request',required:true,label:'Send request to Guild',requestText:text,systemId:system,reason}
    },
    requestedProvider:configuredRoute()||'device-local',provider:'guild-handoff-ready',model:'',usage:null,responseRouting:null,
    fallbackFrom:{provider:configuredRoute()||'device-local',reason},
    context:{routingAnswer:{taskClass:'structured-artifact',artifactClass:structuredArtifact(text)||null,networkRequired:true,source:'guide-forward-failure-policy-v1'}}
  };
}
function localUnavailableResult(args={},reason='selected-local-model-unavailable',prior=null,error=null){
  const system=SYSTEMS.has(args.systemId)?args.systemId:'civweave',name=guideName(system),provider=configuredRoute()||'downloaded-local',message=clean(error?.message||error||prior?.fallbackFrom?.reason||reason,900);
  return{...(prior&&typeof prior==='object'?prior:{}),response:{answer:`${name} could not finish this request with the selected local AI model. Civweave kept the request on this device and did not contact a Guild or Cloudflare AI.`,choice:{mode:guideMode(system),system,room:prior?.context?.currentContext?.roomId||'',nextAction:'Retry locally, choose another local model, or change the AI route in Settings if you want network processing.'},assumptions:[],requiresConsent:false,confidence:1},requestedProvider:provider,provider:'local-ai-unavailable',model:clean(prior?.model,180),usage:prior?.usage||null,responseRouting:prior?.responseRouting||null,fallbackFrom:{provider,reason:message},providerRouteFailure:{code:error?.code||'LOCAL_AI_UNAVAILABLE',message},localProviderPinned:true};
}
function deterministicResult(result){
  const provider=clean(result?.provider||result?.requestedProvider,120).toLowerCase(),answer=clean(result?.response?.answer,1600);
  return provider==='deterministic-local'||provider==='local-contract'||FALLBACK_TEXT_RE.test(answer);
}
async function classifyForAssistant(args={}){
  installRouter();const router=globalThis.CivweaveResponseRouterV347;if(!router?.classify)return null;
  try{return await router.classify(args.text||'',{purpose:`${SYSTEMS.has(args.systemId)?args.systemId:'civweave'}-guide-chat-v350`,executionProfile:'interactive',context:{guide:{system:SYSTEMS.has(args.systemId)?args.systemId:'civweave'},recentConversation:Array.isArray(args.history)?args.history:[]},task:{kind:'dialogue',systemId:SYSTEMS.has(args.systemId)?args.systemId:'civweave',requirements:{planning:false}}})}catch{return null}
}
function installAssistant(){
  const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)return false;
  if(assistant.__civweaveGuideForwardPolicyV1){wrappedAssistant=assistant;return true}
  if(wrappedAssistant===assistant)return true;
  const previous=assistant.respond.bind(assistant);
  const respond=async args=>{
    const route=await classifyForAssistant(args||{});
    if(route?.networkRequired&&!serverAutoConfigured()&&!localConfigured())return handoffResult(args,'structured-request-needs-network-ai');
    try{
      const result=await previous(args);
      if(deterministicResult(result))return localConfigured()?localUnavailableResult(args,'local-generative-result-unavailable',result):handoffResult(args,'deterministic-answer-blocked');
      return result;
    }catch(error){
      if(serverAutoConfigured())throw error;
      if(localConfigured())return localUnavailableResult(args,'local-generative-route-failed',null,error);
      return handoffResult(args,clean(error?.message||error||'generative-route-failed',900));
    }
  };
  globalThis.CivweaveAssistantV141=Object.freeze({...assistant,respond,__civweaveGuideForwardPolicyV1:true,forwardFailurePolicyVersion:VERSION,deterministicAnswerFallback:false,guildHandoffOnFailure:true,localProviderPinned:true});
  wrappedAssistant=globalThis.CivweaveAssistantV141;
  return true;
}

function selectedLocalId(request={}){
  const explicit=clean(request?.config?.model||request?.model,240);if(explicit)return explicit;
  try{const selected=globalThis.CivweaveLocalChatRuntimeV295?.selected?.();if(selected?.id)return clean(selected.id,240)}catch{}
  try{const saved=parse(localStorage.getItem('civweave.local-ai.selection.v266'),{});return saved?.active?clean(saved.id,240):''}catch{return''}
}
function sanitizedLocalRequest(request={}){
  const messages=Array.isArray(request.messages)?request.messages:[],model=selectedLocalId(request),tiny=TINY_RE.test(model);
  if(!messages.length)return request;
  const systems=messages.filter(row=>row?.role==='system').slice(-1).map(row=>({...row,content:`${clean(row.content,12000)} Answer the final user message only. Do not repeat or imitate an earlier assistant reply.`}));
  const dialogue=messages.filter(row=>row?.role!=='system'&&clean(row?.content,12000)&&!(row?.role==='assistant'&&FALLBACK_TEXT_RE.test(clean(row.content,4000))));
  const latestUser=[...dialogue].reverse().find(row=>row?.role==='user');if(!latestUser)return request;
  if(tiny)return{...request,messages:[...systems,{role:'user',content:clean(latestUser.content,12000)}],__civweaveTinyHistorySanitized:true};
  const latestIndex=dialogue.lastIndexOf(latestUser),prior=dialogue.slice(Math.max(0,latestIndex-4),latestIndex);
  return{...request,messages:[...systems,...prior,{role:'user',content:clean(latestUser.content,12000)}],__civweaveHistorySanitized:true};
}
function installLocalRuntime(){
  const runtime=globalThis.CivweaveLocalChatRuntimeV295;if(!runtime?.generate)return false;
  if(runtime.__civweaveGuideForwardPolicyV1){wrappedLocalRuntime=runtime;return true}
  if(wrappedLocalRuntime===runtime)return true;
  const previous=runtime.generate.bind(runtime),generate=request=>previous(sanitizedLocalRequest(request||{}));
  globalThis.CivweaveLocalChatRuntimeV295=Object.freeze({...runtime,generate,__civweaveGuideForwardPolicyV1:true,historyFallbackFiltering:true,tinyLatestPromptOnly:true});
  wrappedLocalRuntime=globalThis.CivweaveLocalChatRuntimeV295;
  return true;
}

function realmApi(){return globalThis.CivweaveRealmSessionIntegrityV237}
function precedingUser(messages,index){for(let i=index-1;i>=0;i--)if(messages[i]?.role==='user'&&clean(messages[i].text))return clean(messages[i].text,12000);return''}
function upgradeTerminalFailures(system){
  if(threadRewrite||serverAutoConfigured()||localConfigured()||!SYSTEMS.has(system))return false;
  const api=realmApi(),thread=api?.readThread?.(system);if(!thread||!Array.isArray(thread.messages))return false;
  let changed=false;const messages=thread.messages.map((row,index)=>{
    if(row?.role!=='assistant'||row?.provider!=='local-recovery'||row?.queueCancelled)return row;
    const requestText=precedingUser(thread.messages,index);if(!requestText)return row;
    changed=true;return{...row,text:`${guideName(system)} could not finish this request with the selected device model. Civweave preserved the request instead of substituting a deterministic answer. You can send it to your Guild for processing when you choose.`,provider:'guild-handoff-ready',approvalGate:{kind:'guild-ai-request',required:true,label:'Send request to Guild',requestText,systemId:system,reason:'device-model-failed'}};
  });
  if(!changed)return false;
  threadRewrite=true;try{api.writeThread(system,{...thread,messages,updatedAt:now()})}finally{threadRewrite=false}
  return true;
}

function installStyle(){
  if(document.getElementById('cw-guide-guild-handoff-v1-style'))return;
  const style=document.createElement('style');style.id='cw-guide-guild-handoff-v1-style';style.textContent=`#cw-persistent-guide-chat-v215 .cw-guild-ai-send{margin-top:8px;border:1px solid var(--guide-accent,#d8dde7);border-radius:10px;padding:8px 10px;background:color-mix(in srgb,var(--guide-accent,#d8dde7) 20%,#101722);color:#fff;font:800 12px/1.2 system-ui;cursor:pointer}#cw-persistent-guide-chat-v215 .cw-guild-ai-send:disabled{opacity:.55;cursor:wait}`;document.head?.append(style);
}
function renderHandoffActions(){
  installStyle();const root=document.getElementById('cw-persistent-guide-chat-v215');if(!root)return false;
  const system=globalThis.CivweaveGuideChatSurfaceV350?.activeWindow?.()||'civweave',thread=realmApi()?.readThread?.(system),rows=Array.isArray(thread?.messages)?thread.messages:[],assistantRows=rows.map((row,index)=>({row,index})).filter(item=>item.row?.role==='assistant'),articles=[...root.querySelectorAll('article[data-message-role="assistant"]')];
  assistantRows.forEach((item,pos)=>{
    const gate=item.row?.approvalGate,article=articles[pos];if(!article||gate?.kind!=='guild-ai-request'||gate.required!==true)return;
    let button=article.querySelector('.cw-guild-ai-send');if(!button){button=document.createElement('button');button.type='button';button.className='cw-guild-ai-send';article.querySelector('div>div')?.parentElement?.append(button);button.addEventListener('click',()=>void sendToGuild(system,item.index,button))}
    button.textContent=clean(gate.label,80)||'Send request to Guild';button.disabled=item.row?.provider==='guild-handoff-sending';
  });return true;
}
function loadServerRouter(){
  if(globalThis.CivweaveServerAIRouterV301?.handle)return Promise.resolve(globalThis.CivweaveServerAIRouterV301);
  if(serverRouterPromise)return serverRouterPromise;
  serverRouterPromise=new Promise((resolve,reject)=>{const script=document.createElement('script'),timer=setTimeout(()=>reject(new Error('Guild AI router did not load.')),12000);script.src=SERVER_ROUTER;script.async=false;script.onload=()=>{clearTimeout(timer);globalThis.CivweaveServerAIRouterV301?.handle?resolve(globalThis.CivweaveServerAIRouterV301):reject(new Error('Guild AI router loaded without becoming ready.'))};script.onerror=()=>{clearTimeout(timer);reject(new Error('Could not load Guild AI routing.'))};document.head?.append(script)}).finally(()=>{serverRouterPromise=null});
  return serverRouterPromise;
}
function updateThreadRow(system,index,patch){const api=realmApi(),thread=api?.readThread?.(system);if(!thread?.messages?.[index])return false;thread.messages[index]={...thread.messages[index],...patch};thread.updatedAt=now();api.writeThread(system,thread);globalThis.CivweaveGuideChatSurfaceV350?.render?.();queueMicrotask(renderHandoffActions);return true}
async function sendToGuild(system,index,button){
  const thread=realmApi()?.readThread?.(system),row=thread?.messages?.[index],gate=row?.approvalGate;if(gate?.kind!=='guild-ai-request')return false;
  const requestText=clean(gate.requestText,12000);if(!requestText)return false;button.disabled=true;updateThreadRow(system,index,{text:`Sending this request to your Guild…`,provider:'guild-handoff-sending'});
  try{
    const router=await loadServerRouter(),recent=(thread.messages||[]).slice(Math.max(0,index-8),index).filter(item=>['user','assistant'].includes(item?.role)&&clean(item.text)&&item.provider!=='deterministic-local').map(item=>({role:item.role,content:clean(item.text,5000)}));
    const handled=await router.handle({guildOnly:true,purpose:`${system}-guide-guild-handoff`,executionProfile:'interactive',config:{provider:'server-auto',route:'server-auto',model:'civweave-guild-auto-v1',externalConsent:true,maxTokens:900},messages:[{role:'system',content:`You are ${guideName(system)}, a Civweave guide. Process the Hero's request usefully and directly. Do not claim app actions happened unless the request itself provides evidence.`},...recent,{role:'user',content:requestText}]});
    const result=handled?.result,answer=clean(result?.outputText||result?.text||result?.output,12000);if(!handled?.handled||!answer)throw new Error('The Guild returned no AI response.');
    updateThreadRow(system,index,{text:answer,provider:clean(result?.actual?.provider||result?.provider||'server-local',120),model:clean(result?.actual?.model||result?.model,180),approvalGate:null,guildHandoff:{completedAt:now(),requestText,routeTrace:result?.routeTrace||result?.diagnostics?.find?.(item=>item?.code==='SERVER_AUTO_TRACE')?.routeTrace||null}});
  }catch(error){updateThreadRow(system,index,{text:`Your Guild could not process this request yet: ${clean(error?.message||error,700)}`,provider:'guild-handoff-ready',approvalGate:{...gate,required:true,label:'Retry with Guild'},guildHandoff:{lastError:clean(error?.message||error,900),failedAt:now(),requestText}})}
  finally{button.disabled=false;queueMicrotask(renderHandoffActions)}
  return true;
}

function install(){installRouter();installAssistant();installLocalRuntime();queueMicrotask(renderHandoffActions);return true}
for(const event of ['civweave:minilm-response-router-ready','civweave:assistant-runtime-ready','civweave:guide-provider-policy-assistant','civweave:local-model-runtime-ready','civweave:guide-chat-ready','civweave:model-config-changed','pageshow'])addEventListener(event,()=>queueMicrotask(install));
addEventListener('civweave:realm-guide-thread-changed',event=>{const system=event?.detail?.system;if(SYSTEMS.has(system))upgradeTerminalFailures(system);queueMicrotask(renderHandoffActions)});
install();

globalThis.CivweaveGuideForwardFailurePolicyV1=Object.freeze({version:VERSION,install,structuredArtifact,promoteRoute,handoffResult,localUnavailableResult,serverAutoConfigured,localConfigured,sanitizedLocalRequest,upgradeTerminalFailures,renderHandoffActions,sendToGuild,deterministicAnswerFallback:false,failureDirection:'forward',terminalFallback:'explicit-guild-handoff',tinyHistoryPolicy:'latest-user-only',localProviderPinned:true});
})();