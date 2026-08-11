(()=>{
'use strict';
const VERSION='1.0.105-local-chat-owner-v298',SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'],GUIDE={civweave:['Weaveling','central mirror and orchestrator'],'living-school':['Moss','learning guide'],cerbanimo:['Kamiya','questwright and skilled-work guide'],fellowfare:['Rook','quartermaster and exchange guide'],anarchadia:['Merlin','civic and automation guide']};
if(globalThis.CivweaveLocalChatOwnerV295?.version===VERSION)return;
const clean=(v,n=12000)=>String(v??'').trim().slice(0,n),now=()=>new Date().toISOString(),uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,queues=new Map(),running=new Set(),api=()=>globalThis.CivweaveRealmSessionIntegrityV237,runtime=()=>globalThis.CivweaveLocalChatRuntimeV295;
function queue(system){let value=queues.get(system);if(!value){value=[];queues.set(system,value)}return value}
function history(system,exclude=''){return(api()?.readThread?.(system)?.messages||[]).filter(x=>x.id!==exclude&&!x.pending&&!x.queuePending&&['user','assistant'].includes(x.role)).slice(-6).map(x=>({role:x.role,content:clean(x.text,900)})).filter(x=>x.content)}
function update(system,id,patch){const a=api(),t=a?.readThread?.(system);if(!t)return false;const i=(t.messages||[]).findIndex(x=>x.id===id);if(i<0)return false;t.messages[i]={...t.messages[i],...patch};a.writeThread(system,t);return true}
function append(system,row){const a=api(),t=a?.readThread?.(system);if(!t)return false;t.messages=[...(t.messages||[]),row];a.writeThread(system,t);return true}
function percent(p){const raw=Number(p?.progress);if(Number.isFinite(raw)&&raw>=0)return Math.max(0,Math.min(100,raw<=1?raw*100:raw));const loaded=Number(p?.loaded??p?.bytesLoaded??p?.bytes),total=Number(p?.total??p?.bytesTotal);return Number.isFinite(loaded)&&Number.isFinite(total)&&total>0?Math.max(0,Math.min(100,loaded/total*100)):null}
function progress(system,p){
 const name=GUIDE[system]?.[0]||'Weaveling',phase=String(p?.phase||''),pct=percent(p),elapsed=Number(p?.elapsedMs),tail=[pct==null?'':`${Math.round(pct)}%`,Number.isFinite(elapsed)&&elapsed>900?`${Math.round(elapsed/1000)}s`:''].filter(Boolean).join(' · '),suffix=tail?` · ${tail}`:'';
 if(phase==='loading-runtime')return`Loading the local AI runtime${suffix}`;
 if(phase==='checking-backend')return`Checking the local inference backend${suffix}`;
 if(phase==='loading-tokenizer')return`Loading the local tokenizer${suffix}`;
 if(phase==='loading-model')return`Loading the selected model into memory${suffix}`;
 if(phase==='warming-model')return`Warming the local model${suffix}`;
 if(phase==='benchmarking-model')return`Checking local model speed${suffix}`;
 if(phase==='backend-fallback')return`Switching to the CPU/WASM compatibility lane${suffix}`;
 if(phase.includes('download'))return`Preparing the compatibility model${suffix}`;
 if(phase==='generating')return`${name} is generating locally${suffix}`;
 return`${name} is working locally${suffix}`
}
async function runOne(system,item){
 const r=runtime(),pick=r?.selected?.(),meta=GUIDE[system]||GUIDE.civweave,before=history(system,item.messageId);update(system,item.messageId,{queuePending:false,queueStartedAt:now(),provider:'downloaded-local-queue'});
 if(!pick){append(system,{id:uid('local-error'),role:'assistant',guide:system,responderSystem:system,text:'The queued local turn could not start because no downloaded local model is selected now.',pending:false,error:true,provider:'local-recovery',at:now()});return false}
 const id=uid('local-pending');if(!append(system,{id,role:'assistant',guide:system,responderSystem:system,text:`${meta[0]} is starting the selected local model…`,pending:true,at:now(),provider:'downloaded-local-direct',model:pick.id}))return false;
 let partial='',last=0;
 try{const result=await r.generate({systemPrompt:`You are ${meta[0]}, Civweave's ${meta[1]}. Answer naturally and usefully in 2 to 4 short sentences. Preserve user control. Do not output JSON or claim consequential app actions already happened.`,messages:[...before,{role:'user',content:item.text}],onProgress:p=>update(system,id,{text:progress(system,p),pending:true,provider:'downloaded-local-direct',model:pick.id,localProgress:p}),onToken:token=>{partial+=String(token?.text||'');const n=performance.now();if(n-last>=120&&partial.trim()){last=n;update(system,id,{text:partial,pending:true,provider:'downloaded-local-direct',model:pick.id})}}});const answer=clean(result?.text||partial,10000);if(!answer)throw new Error('The local model returned no decoded text.');update(system,id,{text:answer,pending:false,provider:'downloaded-local-direct',model:result?.executionId||result?.id||pick.id,localMetrics:result?.metrics||{},localFastPath:true});return true}
 catch(error){const stalled=error?.code==='LOCAL_CHAT_STAGE_STALLED',hint=stalled?'The worker was reset because that loading stage stopped making progress. ':'';update(system,id,{text:`The selected local model did not finish this chat turn, so Civweave stopped the run instead of letting the interface hang. ${hint}${clean(error?.message||error,500)}\n\nTry again, or open AI settings and choose a lighter downloaded model.`,pending:false,error:true,provider:'local-recovery',model:pick.id,localFastPath:true});return false}
}
async function drain(system){if(running.has(system))return false;running.add(system);try{const q=queue(system);while(q.length){const item=q.shift();await runOne(system,item)}}finally{running.delete(system);if(!queue(system).length)queues.delete(system)}return true}
function enqueue(system,text,form){
 const r=runtime(),pick=r?.selected?.(),value=clean(text);if(!pick||!SYSTEMS.includes(system)||!value)return false;const a=api(),thread=a?.readThread?.(system);if(!thread)return false;
 const q=queue(system),messageId=uid('queued-user');thread.messages=[...(thread.messages||[]),{id:messageId,role:'user',text:value,at:now(),queuePending:true,queuePosition:q.length+(running.has(system)?2:1),provider:'downloaded-local-queue'}];a.writeThread(system,thread);q.push({text:value,form,messageId,queuedAt:now()});
 const input=form?.querySelector?.('textarea,input[type="text"]');if(input)input.value='';queueMicrotask(()=>void drain(system));return true
}
function submit(system,text,form){return enqueue(system,text,form)}
function queued(system){return queue(system).length+(running.has(system)?1:0)}
globalThis.CivweaveLocalChatOwnerV295=Object.freeze({version:VERSION,capturePhase:false,canonicalSubmitOwner:false,fiveGuideWindows:true,truthfulLoadProgress:true,fifoQueue:true,enqueue,submit,queued,drain});
})();
