(()=>{
'use strict';

const VERSION='1.2.0-guide-forward-failure-hardening-v1-router-stable';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const SERVER_ROUTER='/app/server-ai-router-v301.js?v=1.0.117-guild-only-handoff';
const REPAIRABLE_PROVIDERS=new Set(['deterministic','deterministic-local','local-contract','guild-handoff-ready']);
let serverRouterPromise=null,patchedAssistant=null,clickBound=false,threadBound=false,submitBound=false,installTimer=0;
const repairing=new Set();

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const realmApi=()=>globalThis.CivweaveRealmSessionIntegrityV237||null;
const surface=()=>globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215||null;
function guideName(system){return system==='living-school'?'Moss':system==='cerbanimo'?'Kamiya':system==='fellowfare'?'Rook':system==='anarchadia'?'Merlin':'Weaveling'}
function guideMode(system){return system==='living-school'?'Learn':system==='cerbanimo'?'Build':system==='fellowfare'?'Acquire':system==='anarchadia'?'Govern':'Reflect'}
function validSystem(value){return SYSTEMS.includes(value)?value:'civweave'}
function emit(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:now(),...detail}}))}catch{}}
function repairableRow(row){return REPAIRABLE_PROVIDERS.has(clean(row?.provider,120).toLowerCase())}
function deterministicRow(row){return repairableRow(row)}
function precedingUser(messages,index){for(let i=index-1;i>=0;i--){const row=messages[i];if(row?.role==='user'&&clean(row.text))return clean(row.text,12000)}return''}
function safeHistoryRows(messages,index){return messages.slice(Math.max(0,index-16),index).filter(row=>['user','assistant'].includes(row?.role)&&clean(row.text)&&!repairableRow(row)&&row?.provider!=='server-auto-unavailable').map(row=>({role:row.role,content:clean(row.text,6000)}))}
function safeArgsHistory(args={}){return (Array.isArray(args.history)?args.history:[]).slice(-16).map(row=>({role:row?.role==='assistant'?'assistant':'user',content:clean(row?.content||row?.text,6000)})).filter(row=>row.content)}
function setDecisionStrip(text,state='pending'){const node=document.querySelector('#cw-persistent-guide-chat-v215 [data-minilm-decision-strip]');if(!node)return;node.dataset.state=state;const label=node.querySelector('span')||node;label.textContent=text}
function writeRow(system,index,patch){const api=realmApi(),thread=api?.readThread?.(system);if(!thread?.messages?.[index])return false;thread.messages[index]={...thread.messages[index],...patch};thread.updatedAt=now();api.writeThread(system,thread);surface()?.render?.();return true}

function currentInteractiveProvider(){
  try{const shared=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive');if(shared){const raw=clean(shared.provider||shared.route,80).toLowerCase();if(raw)return raw}}
  catch{}
  try{const profiles=parse(localStorage.getItem('civweave-model-profiles-v1'),{}),legacy=parse(localStorage.getItem('civweave.universal-ai.v127'),{}),active=profiles?.interactive||legacy;return clean(active?.provider||active?.route||'server-auto',80).toLowerCase()||'server-auto'}catch{return'server-auto'}
}
function installDeterministicCompatibility(){
  if(globalThis.CivweaveDeterministicModeV175){emit('civweave:legacy-deterministic-mode-present',{provider:currentInteractiveProvider()});return false}
  const route=(text,system='civweave')=>({system:validSystem(system),mode:guideMode(validSystem(system)),confidence:0,source:'deterministic-retired-cloud-fallback',evidence:[]});
  const respond=async({text='',systemId='civweave'}={})=>({response:{answer:`${guideName(validSystem(systemId))} could not reach a generative AI service for this request.`,choice:{mode:guideMode(validSystem(systemId)),system:validSystem(systemId),room:'',nextAction:'Retry when Guild or cloud AI capacity is available.'},assumptions:[],requiresConsent:false,confidence:1},provider:'deterministic-retired',requestedProvider:'server-auto',model:'',context:{userMessage:clean(text),routingAnswer:route(text,systemId)}});
  const compatibility=Object.freeze({model:'civweave-deterministic-router-retired',dormant:true,route,status:async()=>({available:false,ready:false,provider:'deterministic-retired',model:'civweave-deterministic-router-retired',transformerActive:false}),prewarm:async()=>({ready:false,provider:'deterministic-retired'}),benchmark:async()=>({provider:'deterministic-retired',elapsedMs:0,results:[]})});
  globalThis.CivweaveDeterministicModeV175=Object.freeze({version:'175.4-cloud-services-terminal',migrate:()=>false,currentProvider:currentInteractiveProvider,route,respond,installAssistantPatch:()=>true,ensurePlanningStack:async()=>false,compatibility,transformerActive:false,semanticPlanning:'retired-as-terminal-fallback',automaticAssistantPatch:false});
  emit('civweave:deterministic-terminal-retired',{replacement:'server-auto'});return true
}

function loadServerRouter(){
  if(globalThis.CivweaveServerAIRouterV301?.handle)return Promise.resolve(globalThis.CivweaveServerAIRouterV301);
  if(serverRouterPromise)return serverRouterPromise;
  serverRouterPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script'),timer=setTimeout(()=>reject(new Error('Cloud AI routing did not load.')),12000);
    script.src=SERVER_ROUTER;script.async=false;
    script.onload=()=>{clearTimeout(timer);globalThis.CivweaveServerAIRouterV301?.handle?resolve(globalThis.CivweaveServerAIRouterV301):reject(new Error('Cloud AI routing loaded without becoming ready.'))};
    script.onerror=()=>{clearTimeout(timer);reject(new Error('Could not load cloud AI routing.'))};
    document.head?.append(script);
  }).finally(()=>{serverRouterPromise=null});
  return serverRouterPromise;
}
function publishCloudRoute(prior,reason){
  const detail={...(prior||{}),taskClass:prior?.taskClass||'cloud-fallback',lengthClass:prior?.lengthClass||'medium',networkRequired:true,confidence:Number.isFinite(Number(prior?.confidence))?Number(prior.confidence):1,source:'cloud-services-fallback',semanticFallback:prior?.semanticFallback||reason};
  emit('civweave:cloud-fallback-route',{reason,route:detail});
  try{dispatchEvent(new CustomEvent('civweave:response-route',{detail}))}catch{}
  setDecisionStrip('Fallback route · Guild / cloud services','pending');
  return detail
}
function unavailableResult(args,reason,error,prior=null){
  const system=validSystem(args?.systemId),message=clean(error?.message||error||'No cloud model route completed the request.',900);
  return{...(prior&&typeof prior==='object'?prior:{}),response:{answer:`${guideName(system)} could not reach an available Guild or Cloudflare AI service for this request. Civweave did not substitute a deterministic answer.`,choice:{mode:guideMode(system),system,room:'',nextAction:'Retry when a cloud route is available, or check Guild and AI capacity in Settings.'},assumptions:[],requiresConsent:false,confidence:1},requestedProvider:'server-auto',provider:'server-auto-unavailable',model:'',usage:null,responseRouting:prior?.responseRouting||null,fallbackFrom:{provider:clean(prior?.provider||prior?.requestedProvider,120)||'primary-route',reason},providerRouteFailure:{code:error?.code||'CLOUD_FALLBACK_UNAVAILABLE',message}}
}
async function cloudResult(args={},reason='primary-route-unavailable',prior=null){
  const system=validSystem(args.systemId),text=clean(args.text,12000);if(!text)return unavailableResult(args,reason,new Error('The request text was empty.'),prior);
  publishCloudRoute(prior?.responseRouting||null,reason);
  try{
    const router=await loadServerRouter(),messages=[{role:'system',content:`You are ${guideName(system)}, a Civweave guide. Answer the Hero directly and usefully. Do not claim app actions happened unless the request provides evidence.`},...safeArgsHistory(args),{role:'user',content:text}];
    const handled=await router.handle({purpose:`${system}-guide-cloud-fallback`,executionProfile:'interactive',config:{provider:'server-auto',route:'server-auto',model:'civweave-server-auto-v1',externalConsent:true,maxTokens:Math.max(256,Number(prior?.responseRouting?.tier?.maxTokens||900)||900)},messages});
    const result=handled?.result,answer=clean(result?.outputText||result?.text||result?.output,120000);if(!handled?.handled||!answer)throw new Error('Cloud AI routing returned no response.');
    setDecisionStrip(`Cloud route · ${clean(result?.actual?.provider||'cloud services',80)} · ${clean(result?.actual?.model||'',100)}`,'minilm');
    emit('civweave:cloud-fallback-complete',{reason,provider:result?.actual?.provider||'',model:result?.actual?.model||''});
    return{response:{answer,choice:{mode:guideMode(system),system,room:'',nextAction:''},assumptions:[],requiresConsent:false,confidence:1},requestedProvider:'server-auto',provider:clean(result?.actual?.provider||result?.provider||'server-auto',120),model:clean(result?.actual?.model||result?.model,180),usage:result?.usage||null,responseRouting:prior?.responseRouting||result?.responseRouting||null,fallbackFrom:{provider:clean(prior?.provider||prior?.requestedProvider,120)||'primary-route',reason},context:{...(prior?.context||{}),routingAnswer:{...(prior?.context?.routingAnswer||{}),networkRequired:true,source:'cloud-services-fallback'}},cloudFallback:{completedAt:now(),reason,routeTrace:result?.diagnostics?.find?.(item=>item?.code==='SERVER_AUTO_TRACE')?.routeTrace||null}}
  }catch(error){setDecisionStrip('Cloud route · unavailable','error');emit('civweave:cloud-fallback-failed',{reason,message:clean(error?.message||error,900)});return unavailableResult(args,reason,error,prior)}
}
function resultNeedsCloud(result){const provider=clean(result?.provider||result?.requestedProvider,120).toLowerCase(),answer=clean(result?.response?.answer,2000);return REPAIRABLE_PROVIDERS.has(provider)||provider.startsWith('deterministic')||/deterministic(?:-| )local|kept this locally\.|send (?:it|request) to your guild/i.test(answer)}
function patchAssistant(){
  const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)return false;
  if(assistant.respond.__civweaveCloudFallbackV2){patchedAssistant=assistant;return true}
  const previousFn=assistant.respond,legacyDeterministicWrapper=Boolean(previousFn.__deterministicModeV175&&!previousFn.__civweaveCloudFallbackV1),previous=previousFn.bind(assistant);
  const respond=async args=>{
    const request=args||{};
    if(legacyDeterministicWrapper&&['server-auto','hosted'].includes(currentInteractiveProvider()))return cloudResult(request,'legacy-deterministic-wrapper-bypassed',null);
    try{const result=await previous(request);return resultNeedsCloud(result)?cloudResult(request,'non-generative-result-blocked',result):result}catch(error){return cloudResult(request,`primary-route-error:${clean(error?.message||error,300)}`,null)}
  };
  for(const marker of ['__civweaveCloudFallbackV1','__civweaveCloudFallbackV2','__deterministicModeV175'])try{Object.defineProperty(respond,marker,{value:true,configurable:false})}catch{}
  globalThis.CivweaveAssistantV141={...assistant,respond,__civweaveCloudFallbackV1:true,__civweaveCloudFallbackV2:true,__deterministicModeV175:true,cloudFallbackVersion:VERSION,deterministicAnswerFallback:false,automaticCloudFallback:true};
  patchedAssistant=globalThis.CivweaveAssistantV141;emit('civweave:guide-cloud-fallback-installed',{legacyDeterministicWrapper});return true
}

async function repairDeterministic(system,index){
  system=validSystem(system);const key=`${system}:${index}`;if(repairing.has(key))return false;
  const api=realmApi(),thread=api?.readThread?.(system),row=thread?.messages?.[index];if(!repairableRow(row))return false;
  const requestText=precedingUser(thread.messages,index);if(!requestText)return false;repairing.add(key);
  try{
    writeRow(system,index,{pending:true,text:`${guideName(system)} is forwarding this request to Guild / cloud services…`,provider:'server-auto-forwarding',model:'',approvalGate:null,forwardFailureBoundary:VERSION});
    const result=await cloudResult({text:requestText,systemId:system,history:safeHistoryRows(thread.messages,index)},'thread-deterministic-repair',null);
    writeRow(system,index,{pending:false,text:clean(result?.response?.answer,120000),provider:clean(result?.provider,120)||'server-auto-unavailable',model:clean(result?.model,180),approvalGate:null,responseRouting:result?.responseRouting||null,semanticRoute:result?.context?.routingAnswer||null,forwardFailureBoundary:VERSION});return result?.provider!=='server-auto-unavailable'
  }finally{repairing.delete(key)}
}
function repairThread(system){system=validSystem(system);const thread=realmApi()?.readThread?.(system);if(!Array.isArray(thread?.messages))return false;thread.messages.forEach((row,index)=>{if(repairableRow(row))void repairDeterministic(system,index)});return true}
function rowForButton(button){const root=document.getElementById('cw-persistent-guide-chat-v215'),article=button?.closest?.('article[data-message-role="assistant"]');if(!root||!article)return null;const system=validSystem(surface()?.activeWindow?.()),thread=realmApi()?.readThread?.(system);if(!Array.isArray(thread?.messages))return null;const articles=[...root.querySelectorAll('article[data-message-role="assistant"]')],position=articles.indexOf(article);if(position<0)return null;const indices=thread.messages.map((row,index)=>row?.role==='assistant'?index:-1).filter(index=>index>=0),index=indices[position];return Number.isInteger(index)?{system,thread,index,row:thread.messages[index]}:null}
async function sendGuildOnce(button){const located=rowForButton(button),gate=located?.row?.approvalGate;if(!located||gate?.kind!=='guild-ai-request')return false;button.disabled=true;try{return await repairDeterministic(located.system,located.index)}finally{button.disabled=false}}
function bindClickGuard(){if(clickBound)return;clickBound=true;document.addEventListener('click',event=>{const button=event.target?.closest?.('.cw-guild-ai-send');if(!button)return;event.preventDefault();event.stopImmediatePropagation();void sendGuildOnce(button)},true)}
function bindThreadGuard(){if(threadBound)return;threadBound=true;addEventListener('civweave:realm-guide-thread-changed',event=>{const system=event?.detail?.system;if(SYSTEMS.includes(system))queueMicrotask(()=>repairThread(system))})}
function bindSubmitGuard(){if(submitBound)return;submitBound=true;document.addEventListener('submit',event=>{const form=event.target instanceof HTMLFormElement?event.target:null;if(form?.matches?.('#cw-persistent-guide-chat-v215 [data-persistent-form]'))patchAssistant()},true)}
function install(){installDeterministicCompatibility();patchAssistant();bindClickGuard();bindThreadGuard();bindSubmitGuard();SYSTEMS.forEach(system=>queueMicrotask(()=>repairThread(system)));return true}
installDeterministicCompatibility();
for(const name of ['civweave:assistant-runtime-ready','civweave:model-runtime-ready','civweave:runtime-spine-ready','civweave:response-router-installed','civweave:family-ai-ready'])addEventListener(name,()=>queueMicrotask(install));
addEventListener('pageshow',()=>queueMicrotask(install));
install();let attempts=0;installTimer=setInterval(()=>{attempts+=1;install();if(attempts>160)clearInterval(installTimer)},250);addEventListener('pagehide',()=>clearInterval(installTimer),{once:true});
globalThis.CivweaveGuideForwardFailureHardeningV1=Object.freeze({version:VERSION,install,deterministicRow,repairThread,repairDeterministic,sendGuildOnce,cloudResult,currentInteractiveProvider,installDeterministicCompatibility,automaticCloudFallback:true,deterministicTerminalVisible:false,deterministicAssistantPatchRetired:true,guildRequestDeduplicated:true,serverAutoRaceRepair:true});
})();
