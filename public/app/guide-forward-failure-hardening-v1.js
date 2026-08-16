(()=>{
'use strict';

const VERSION='1.0.0-guide-forward-failure-hardening-v1';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const SERVER_ROUTER='/app/server-ai-router-v301.js?v=1.0.117-guild-only-handoff';
const repairing=new Set();
let serverRouterPromise=null,clickBound=false,threadBound=false;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const realmApi=()=>globalThis.CivweaveRealmSessionIntegrityV237||null;
const surface=()=>globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215||null;
const serverAutoConfigured=()=>Boolean(globalThis.CivweaveGuideForwardFailurePolicyV1?.serverAutoConfigured?.()||globalThis.CivweaveGuideProviderPolicyV1?.serverAutoConfigured?.());
function guideName(system){return system==='living-school'?'Moss':system==='cerbanimo'?'Kamiya':system==='fellowfare'?'Rook':system==='anarchadia'?'Merlin':'Weaveling'}
function deterministicRow(row){const provider=clean(row?.provider,120).toLowerCase();return provider==='deterministic-local'||provider==='local-contract'}
function precedingUser(messages,index){for(let i=index-1;i>=0;i--){const row=messages[i];if(row?.role==='user'&&clean(row.text))return clean(row.text,12000)}return''}
function safeHistory(messages,index){return messages.slice(Math.max(0,index-16),index).filter(row=>['user','assistant'].includes(row?.role)&&clean(row.text)&&!deterministicRow(row)).map(row=>({role:row.role,text:clean(row.text,6000)}))}
function writeRow(system,index,patch){const api=realmApi(),thread=api?.readThread?.(system);if(!thread?.messages?.[index])return false;thread.messages[index]={...thread.messages[index],...patch};thread.updatedAt=now();api.writeThread(system,thread);surface()?.render?.();return true}
function handoffPatch(system,requestText,reason='deterministic-answer-blocked'){
  return{pending:false,text:`${guideName(system)} did not replace this request with a deterministic answer. Civweave preserved it on this device. You can send it to your Guild for processing when you choose.`,provider:'guild-handoff-ready',model:'',approvalGate:{kind:'guild-ai-request',required:true,label:'Send request to Guild',requestText,systemId:system,reason},forwardFailureBoundary:VERSION};
}
function resultPatch(system,result){const answer=clean(result?.response?.answer,10000),next=clean(result?.response?.choice?.nextAction,1200),provider=clean(result?.provider||result?.requestedProvider,120).toLowerCase();if(!answer||provider==='deterministic-local'||provider==='local-contract')return null;return{pending:false,text:[answer,next?`Next: ${next}`:''].filter(Boolean).join('\n\n'),provider:provider||'server-auto',model:clean(result?.model,180),approvalGate:result?.response?.approvalGate||null,responseRouting:result?.responseRouting||null,semanticRoute:result?.context?.routingAnswer||null,forwardFailureBoundary:VERSION};}
async function repairDeterministic(system,index){
  if(!SYSTEMS.includes(system))return false;const key=`${system}:${index}`;if(repairing.has(key))return false;
  const api=realmApi(),thread=api?.readThread?.(system),row=thread?.messages?.[index];if(!deterministicRow(row))return false;
  const requestText=precedingUser(thread.messages,index);if(!requestText)return false;
  repairing.add(key);
  try{
    if(!serverAutoConfigured()){writeRow(system,index,handoffPatch(system,requestText));return true}
    writeRow(system,index,{pending:true,text:`${guideName(system)} is forwarding this request to the configured generative AI route…`,provider:'server-auto-forwarding',model:'',approvalGate:null,forwardFailureBoundary:VERSION});
    try{
      await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
      const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)throw new Error('The configured guide AI runtime is not ready.');
      const result=await assistant.respond({text:requestText,systemId:system,history:safeHistory(thread.messages,index)}),patch=resultPatch(system,result);
      if(!patch)throw new Error('The configured generative route did not return a usable non-deterministic response.');
      writeRow(system,index,patch);return true;
    }catch(error){writeRow(system,index,{pending:false,text:`${guideName(system)} could not complete this through the configured generative AI route. Civweave did not substitute a deterministic answer. ${clean(error?.message||error,700)}`,provider:'server-auto-unavailable',model:'',approvalGate:null,forwardFailureBoundary:VERSION});return false}
  }finally{repairing.delete(key)}
}
function repairThread(system){
  if(!SYSTEMS.includes(system))return false;const thread=realmApi()?.readThread?.(system);if(!Array.isArray(thread?.messages))return false;
  thread.messages.forEach((row,index)=>{if(deterministicRow(row))void repairDeterministic(system,index)});return true
}

function loadServerRouter(){
  if(globalThis.CivweaveServerAIRouterV301?.handle)return Promise.resolve(globalThis.CivweaveServerAIRouterV301);
  if(serverRouterPromise)return serverRouterPromise;
  serverRouterPromise=new Promise((resolve,reject)=>{const script=document.createElement('script'),timer=setTimeout(()=>reject(new Error('Guild AI routing did not load.')),12000);script.src=SERVER_ROUTER;script.async=false;script.onload=()=>{clearTimeout(timer);globalThis.CivweaveServerAIRouterV301?.handle?resolve(globalThis.CivweaveServerAIRouterV301):reject(new Error('Guild AI routing loaded without becoming ready.'))};script.onerror=()=>{clearTimeout(timer);reject(new Error('Could not load Guild AI routing.'))};document.head?.append(script)}).finally(()=>{serverRouterPromise=null});return serverRouterPromise
}
function rowForButton(button){
  const root=document.getElementById('cw-persistent-guide-chat-v215'),article=button?.closest?.('article[data-message-role="assistant"]');if(!root||!article)return null;
  const active=surface()?.activeWindow?.()||'civweave',thread=realmApi()?.readThread?.(active);if(!Array.isArray(thread?.messages))return null;
  const articles=[...root.querySelectorAll('article[data-message-role="assistant"]')],position=articles.indexOf(article);if(position<0)return null;
  const indices=thread.messages.map((row,index)=>row?.role==='assistant'?index:-1).filter(index=>index>=0),index=indices[position];return Number.isInteger(index)?{system:active,thread,index,row:thread.messages[index]}:null
}
async function sendGuildOnce(button){
  const located=rowForButton(button),gate=located?.row?.approvalGate;if(!located||gate?.kind!=='guild-ai-request'||gate.required!==true)return false;
  const {system,thread,index}=located,requestText=clean(gate.requestText,12000);if(!requestText)return false;
  button.disabled=true;writeRow(system,index,{pending:true,text:'Sending this request to your Guild…',provider:'guild-handoff-sending'});
  try{
    const router=await loadServerRouter(),recent=thread.messages.slice(Math.max(0,index-10),index).filter(row=>['user','assistant'].includes(row?.role)&&clean(row.text)&&!deterministicRow(row)&&row?.provider!=='guild-handoff-ready').map(row=>({role:row.role,content:clean(row.text,5000)}));
    if(recent.at(-1)?.role==='user'&&clean(recent.at(-1).content,12000)===requestText)recent.pop();
    const handled=await router.handle({guildOnly:true,purpose:`${system}-guide-guild-handoff`,executionProfile:'interactive',config:{provider:'server-auto',route:'server-auto',model:'civweave-guild-auto-v1',externalConsent:true,maxTokens:900},messages:[{role:'system',content:`You are ${guideName(system)}, a Civweave guide. Process the Hero's request usefully and directly. Do not claim app actions happened unless the request itself provides evidence.`},...recent,{role:'user',content:requestText}]});
    const result=handled?.result,answer=clean(result?.outputText||result?.text||result?.output,12000);if(!handled?.handled||!answer)throw new Error('The Guild returned no AI response.');
    writeRow(system,index,{pending:false,text:answer,provider:clean(result?.actual?.provider||result?.provider||'server-local',120),model:clean(result?.actual?.model||result?.model,180),approvalGate:null,guildHandoff:{completedAt:now(),requestText,routeTrace:result?.routeTrace||result?.diagnostics?.find?.(item=>item?.code==='SERVER_AUTO_TRACE')?.routeTrace||null},forwardFailureBoundary:VERSION});
  }catch(error){writeRow(system,index,{pending:false,text:`Your Guild could not process this request yet: ${clean(error?.message||error,700)}`,provider:'guild-handoff-ready',approvalGate:{...gate,required:true,label:'Retry with Guild'},guildHandoff:{lastError:clean(error?.message||error,900),failedAt:now(),requestText},forwardFailureBoundary:VERSION})}
  finally{button.disabled=false;queueMicrotask(()=>globalThis.CivweaveGuideForwardFailurePolicyV1?.renderHandoffActions?.())}
  return true
}
function bindClickGuard(){
  if(clickBound)return;clickBound=true;document.addEventListener('click',event=>{const button=event.target?.closest?.('.cw-guild-ai-send');if(!button)return;event.preventDefault();event.stopImmediatePropagation();void sendGuildOnce(button)},true)
}
function bindThreadGuard(){
  if(threadBound)return;threadBound=true;addEventListener('civweave:realm-guide-thread-changed',event=>{const system=event?.detail?.system;if(SYSTEMS.includes(system))queueMicrotask(()=>repairThread(system))})
}
function install(){bindClickGuard();bindThreadGuard();SYSTEMS.forEach(system=>queueMicrotask(()=>repairThread(system)));return true}
install();
addEventListener('pageshow',install);
globalThis.CivweaveGuideForwardFailureHardeningV1=Object.freeze({version:VERSION,install,deterministicRow,repairThread,repairDeterministic,sendGuildOnce,deterministicTerminalVisible:false,guildRequestDeduplicated:true,serverAutoRaceRepair:true});
})();