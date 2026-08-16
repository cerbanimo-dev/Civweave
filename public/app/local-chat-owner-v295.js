(()=>{
'use strict';
const VERSION='1.0.158-local-chat-owner-v303-submit-only',REVISION='live-thread-render-v351',SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'],GUIDE={civweave:['Weaveling','central mirror and orchestrator'],'living-school':['Moss','learning guide'],cerbanimo:['Kamiya','questwright and skilled-work guide'],fellowfare:['Rook','quartermaster and exchange guide'],anarchadia:['Merlin','civic and automation guide']};
if(globalThis.CivweaveLocalChatOwnerV295?.version===VERSION&&globalThis.CivweaveLocalChatOwnerV295?.revision===REVISION&&globalThis.CivweaveLocalChatOwnerV295?.generativePrewarmDisabled===true&&globalThis.CivweaveLocalChatOwnerV295?.serverAutoFailover===true)return;
const PROFILE_KEY='civweave-model-profiles-v1',UNIVERSAL_AI_KEY='civweave.universal-ai.v127',SERVER_ROUTER='/app/server-ai-router-v301.js?v=1.0.116-v301-server-auto-local-failover';
const clean=(v,n=12000)=>String(v??'').trim().slice(0,n),now=()=>new Date().toISOString(),uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,queues=new Map(),running=new Set(),api=()=>globalThis.CivweaveRealmSessionIntegrityV237,runtime=()=>globalThis.CivweaveLocalChatRuntimeV295;
let renderQueued=false,renderSystem='',serverRouterPromise=null;
function parse(v,d){try{return JSON.parse(v)??d}catch{return d}}
function savedPrimaryRoute(){try{const profiles=parse(localStorage.getItem(PROFILE_KEY),{}),legacy=parse(localStorage.getItem(UNIVERSAL_AI_KEY),{}),configured=profiles?.interactive&&typeof profiles.interactive==='object'?profiles.interactive:legacy;return clean(configured?.provider||configured?.route,80).toLowerCase()}catch{return''}}
function serverAutoSelected(){return savedPrimaryRoute()==='server-auto'}
function queue(system){let value=queues.get(system);if(!value){value=[];queues.set(system,value)}return value}
function scheduleRender(system){
 if(!SYSTEMS.includes(system))return false;renderSystem=system;if(renderQueued)return true;renderQueued=true;
 queueMicrotask(()=>{renderQueued=false;const target=renderSystem;renderSystem='';const surface=globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215;if(!surface?.state?.().open||surface?.activeWindow?.()!==target)return;try{surface.render?.()}catch{}});return true
}
function history(system,exclude=''){return(api()?.readThread?.(system)?.messages||[]).filter(x=>x.id!==exclude&&!x.pending&&!x.queuePending&&['user','assistant'].includes(x.role)).slice(-6).map(x=>({role:x.role,content:clean(x.text,900)})).filter(x=>x.content)}
function update(system,id,patch){const a=api(),t=a?.readThread?.(system);if(!t)return false;const i=(t.messages||[]).findIndex(x=>x.id===id);if(i<0)return false;t.messages[i]={...t.messages[i],...patch};a.writeThread(system,t);return true}
function append(system,row){const a=api(),t=a?.readThread?.(system);if(!t)return false;t.messages=[...(t.messages||[]),row];a.writeThread(system,t);return true}
function percent(p){const raw=Number(p?.progressOverall??p?.progress_total??p?.progress);if(Number.isFinite(raw)&&raw>=0)return Math.max(0,Math.min(100,raw<=1?raw*100:raw));const loaded=Number(p?.loaded??p?.bytesLoaded??p?.bytes),total=Number(p?.total??p?.bytesTotal);return Number.isFinite(loaded)&&Number.isFinite(total)&&total>0?Math.max(0,Math.min(100,loaded/total*100)):null}
function progress(system,p){
 const name=GUIDE[system]?.[0]||'Weaveling',phase=String(p?.phase||''),pct=percent(p),elapsed=Number(p?.elapsedMs),tail=[pct==null?'':`${Math.round(pct)}%`,Number.isFinite(elapsed)&&elapsed>900?`${Math.round(elapsed/1000)}s`:''].filter(Boolean).join(' · '),suffix=tail?` · ${tail}`:'';
 if(phase==='loading-runtime')return`Loading the local AI runtime${suffix}`;
 if(phase==='checking-backend')return`Checking the local inference backend${suffix}`;
 if(phase==='loading-tokenizer')return`Loading the local tokenizer${suffix}`;
 if(phase==='loading-model')return`Loading the selected model into memory${suffix}`;
 if(phase==='warming-model')return`Warming the local model${suffix}`;
 if(phase==='benchmarking-model')return`Checking local model speed${suffix}`;
 if(phase==='worker-released')return`Releasing the previous model session before fallback${suffix}`;
 if(phase==='backend-fallback')return`Switching to the CPU/WASM compatibility lane${suffix}`;
 if(phase.includes('download'))return`Preparing the compatibility model${suffix}`;
 if(phase==='generating')return`${name} is generating locally${suffix}`;
 return`${name} is working locally${suffix}`
}
function loadServerRouter(){
 if(globalThis.CivweaveServerAIRouterV301?.handle)return Promise.resolve(globalThis.CivweaveServerAIRouterV301);
 if(serverRouterPromise)return serverRouterPromise;
 serverRouterPromise=(async()=>{
   try{await globalThis.CivweaveNodeAIMeshV1?.ensureServerAI?.()}catch{}
   if(globalThis.CivweaveServerAIRouterV301?.handle)return globalThis.CivweaveServerAIRouterV301;
   await new Promise((resolve,reject)=>{const script=document.createElement('script'),timer=setTimeout(()=>reject(new Error('Server-side AI router did not load within 12 seconds.')),12000);script.src=SERVER_ROUTER;script.async=false;script.onload=()=>{clearTimeout(timer);globalThis.CivweaveServerAIRouterV301?.handle?resolve():reject(new Error('Server-side AI router loaded without becoming ready.'))};script.onerror=()=>{clearTimeout(timer);reject(new Error('Could not load the server-side AI router.'))};document.head?.append(script)});
   return globalThis.CivweaveServerAIRouterV301;
 })().finally(()=>{serverRouterPromise=null});
 return serverRouterPromise
}
async function serverFailover(system,item,meta,before,pick,id,localError){
 const router=await loadServerRouter();if(!router?.handle)throw new Error('Server-side AI fallback is unavailable.');
 update(system,id,{text:`${meta[0]} could not finish on this device. Trying your host, then Cloudflare…`,pending:true,provider:'server-auto-failover',model:pick.id,localError:{code:localError?.code||'LOCAL_MODEL_FAILED',phase:localError?.phase||'',message:clean(localError?.message||localError,500)}});
 const handled=await router.handle({purpose:`${system}-guide-chat-server-auto-failover`,executionProfile:'interactive',config:{provider:'server-auto',route:'server-auto',model:'civweave-server-auto-v1',externalConsent:true,serverOrder:['device-local','server-local','cloudflare-workers-ai'],maxTokens:192},messages:[{role:'system',content:`You are ${meta[0]}, Civweave's ${meta[1]}. Answer naturally and usefully in 2 to 4 short sentences. Preserve user control. Do not output JSON or claim consequential app actions already happened.`},...before,{role:'user',content:item.text}]});
 const result=handled?.result,answer=clean(result?.outputText||result?.text||result?.output||'',10000);if(!handled?.handled||!answer)throw new Error('Server-side AI fallback returned no text.');
 const provider=clean(result?.actual?.provider||result?.provider||'server-auto',120),model=clean(result?.actual?.model||result?.model||'',180);
 update(system,id,{text:answer,pending:false,provider,model,serverAutoFailover:true,localFallbackFrom:pick.id,routeTrace:result?.diagnostics?.find?.(row=>row?.code==='SERVER_AUTO_TRACE')?.routeTrace||result?.routeTrace||null,chargedNeurons:Number(result?.usage?.chargedNeurons||0),remainingNeurons:Number.isFinite(Number(result?.usage?.remainingNeurons))?Number(result.usage.remainingNeurons):null});
 try{dispatchEvent(new CustomEvent('civweave:local-chat-server-failover',{detail:{system,selectedModel:pick.id,provider,model,at:now()}}))}catch{}
 return true
}
async function runOne(system,item){
 const r=runtime(),pick=r?.selected?.(),meta=GUIDE[system]||GUIDE.civweave,before=history(system,item.messageId);update(system,item.messageId,{queuePending:false,queueStartedAt:now(),provider:'downloaded-local-queue'});
 if(!pick){append(system,{id:uid('local-error'),role:'assistant',guide:system,responderSystem:system,text:'The queued local turn could not start because no downloaded local model is selected now.',pending:false,error:true,provider:'local-recovery',at:now()});return false}
 const id=uid('local-pending');if(!append(system,{id,role:'assistant',guide:system,responderSystem:system,text:`${meta[0]} is starting the selected local model…`,pending:true,at:now(),provider:'downloaded-local-direct',model:pick.id}))return false;
 let partial='',last=0;
 try{const result=await r.generate({systemPrompt:`You are ${meta[0]}, Civweave's ${meta[1]}. Answer naturally and usefully in 2 to 4 short sentences. Preserve user control. Do not output JSON or claim consequential app actions already happened.`,messages:[...before,{role:'user',content:item.text}],onProgress:p=>update(system,id,{text:progress(system,p),pending:true,provider:'downloaded-local-direct',model:p?.model||pick.id,localProgress:p}),onToken:token=>{partial+=String(token?.text||'');const n=performance.now();if(n-last>=120&&partial.trim()){last=n;update(system,id,{text:partial,pending:true,provider:'downloaded-local-direct'})}}});const answer=clean(result?.text||partial,10000);if(!answer)throw new Error('The local model returned no decoded text.');update(system,id,{text:answer,pending:false,provider:'downloaded-local-direct',model:result?.executionId||result?.id||pick.id,localMetrics:result?.metrics||{},localFastPath:true});return true}
 catch(error){
   const cancelled=error?.code==='LOCAL_MODEL_CANCELLED';
   if(!cancelled&&serverAutoSelected())try{if(await serverFailover(system,item,meta,before,pick,id,error))return true}catch(serverError){error.serverAutoError=serverError}
   const stalled=error?.code==='LOCAL_CHAT_STAGE_STALLED',boot=/^LOCAL_RUNTIME_BOOT_/.test(String(error?.code||'')),failedId=clean(error?.model||pick.id,160),failedLabel=clean(error?.modelLabel||failedId,160),fallback=failedId&&failedId!==pick.id,raw=clean(error?.message||error,500),detail=/^\d{6,}$/.test(raw)?`The browser inference backend returned diagnostic code ${raw} while ${error?.phase||'creating the model session'}.`:raw,hint=stalled?'The worker was reset because that loading stage stopped making progress. ':boot?'The local runtime startup was stopped because it did not become ready. ':fallback?`${failedLabel}, the compatibility fallback for the selected model, also failed. `:'',released=Boolean(error?.workerReleased||error?.sessionReleased),serverDetail=error.serverAutoError?` Server-side fallback also failed: ${clean(error.serverAutoError?.message||error.serverAutoError,500)}`:'';update(system,id,{text:cancelled?'The local AI run was stopped so AI settings could open safely. Choose or change a model, then send your message again.':`The selected local model did not finish this chat turn, so Civweave stopped the run instead of letting the interface hang. ${hint}${detail}${released?' The failed inference worker was fully released.':''}${serverDetail}\n\nTry again, or open AI settings and choose a model marked Recommended on this device.`,pending:false,error:true,provider:'local-recovery',model:failedId||pick.id,localFastPath:true,serverAutoFailoverAttempted:Boolean(error.serverAutoError),localError:{code:error?.code||'LOCAL_MODEL_FAILED',phase:error?.phase||'',selectedModel:pick.id,executionModel:failedId||pick.id,backend:error?.backend||'',workerReleased:released,message:detail}});return false
 }
}
async function drain(system){if(running.has(system))return false;running.add(system);try{const q=queue(system);while(q.length){const item=q.shift();await runOne(system,item)}}finally{running.delete(system);if(!queue(system).length)queues.delete(system)}return true}
function enqueue(system,text,form){
 const r=runtime(),pick=r?.selected?.(),value=clean(text);if(!pick||!SYSTEMS.includes(system)||!value)return false;const a=api(),thread=a?.readThread?.(system);if(!thread)return false;
 const q=queue(system),messageId=uid('queued-user');thread.messages=[...(thread.messages||[]),{id:messageId,role:'user',text:value,at:now(),queuePending:true,queuePosition:q.length+(running.has(system)?2:1),provider:'downloaded-local-queue'}];a.writeThread(system,thread);q.push({text:value,form,messageId,queuedAt:now()});
 const input=form?.querySelector?.('textarea,input[type="text"]');if(input)input.value='';queueMicrotask(()=>void drain(system));return true
}
function submit(system,text,form){return enqueue(system,text,form)}
function queued(system){return queue(system).length+(running.has(system)?1:0)}
function cancelQueued(reason='settings-open'){let count=0;for(const [system,items] of queues){for(const item of items){update(system,item.messageId,{queuePending:false,queueCancelled:true,queueCancelReason:reason});count+=1}items.length=0}queues.clear();return count}
addEventListener('civweave:realm-guide-thread-changed',event=>scheduleRender(event?.detail?.system));
addEventListener('civweave:local-inference-cancel-requested',event=>cancelQueued(event?.detail?.reason||'external-request'));
globalThis.CivweaveLocalChatOwnerV295=Object.freeze({version:VERSION,revision:REVISION,capturePhase:false,canonicalSubmitOwner:false,fiveGuideWindows:true,truthfulLoadProgress:true,boundedStartupRecovery:true,freshWorkerFallback:true,truthfulExecutionModel:true,fifoQueue:true,terminalCancellation:true,settingsTeardown:true,intentPrewarm:false,chatOpenPrewarm:false,generativePrewarmDisabled:true,generativeStartsOnSubmit:true,prewarmTrigger:'none',liveThreadRender:true,serverAutoFailover:true,serverAutoOrder:Object.freeze(['device-local','server-local','cloudflare-workers-ai']),savedPrimaryRoute,serverAutoSelected,enqueue,submit,queued,drain,cancelQueued});
})();