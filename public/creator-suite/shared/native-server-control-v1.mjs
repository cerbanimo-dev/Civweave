// Browser-to-Termux diagnostics and explicit user-approved recovery for Creator Suite.
// Only the already-selected native loopback model is supported. No inference or
// server mutation is initiated by a status check.
export const NATIVE_SERVER='http://127.0.0.1:8080';
const PAIR_KEY='civweave.termux-companion.session-pairing.v1';
const COMPANION='http://127.0.0.1:8766';
const short=(v,n=260)=>String(v??'').slice(0,n);
export function isCreatorNativeTermux(config={}){
  return config.provider==='openai-compatible'
    &&config.model==='qwen35-4b-native'
    &&String(config.endpoint||'').replace(/\/$/,'')===NATIVE_SERVER+'/v1';
}
export function summarizeNativeSlots(value){
  if(!Array.isArray(value))return {state:'unsupported',detail:'The server did not return a slot array.'};
  const slots=value.map(x=>({
    id:Number.isInteger(x?.id)?x.id:null,
    taskId:Number.isInteger(x?.id_task)?x.id_task:null,
    busy:x?.is_processing===true
  }));
  const busy=slots.filter(x=>x.busy);
  return{state:busy.length?'busy':'idle',slots,busyCount:busy.length,total:slots.length,
    detail:busy.length?busy.length+' of '+slots.length+' inference slots processing':'All '+slots.length+' inference slots idle'};
}
export async function inspectNativeSlots({fetcher=fetch,signal,timeoutMs=4500}={}){
  const controller=new AbortController(),stop=()=>controller.abort(signal?.reason);
  signal?.addEventListener?.('abort',stop,{once:true});
  if(signal?.aborted)stop();
  const timer=setTimeout(()=>controller.abort(new DOMException('Slot probe timed out','TimeoutError')),timeoutMs);
  try{
    const response=await fetcher(NATIVE_SERVER+'/slots',{
      method:'GET',mode:'cors',cache:'no-store',credentials:'omit',signal:controller.signal
    });
    if(!response.ok){
      return{state:'unavailable',detail:'Slot monitoring returned HTTP '+response.status,code:response.status};
    }
    return summarizeNativeSlots(await response.json());
  }catch(error){
    if(signal?.aborted)throw error;
    return{state:'unavailable',detail:'Cannot read Termux slots: '+short(error?.message||error)};
  }finally{
    clearTimeout(timer);signal?.removeEventListener?.('abort',stop);
  }
}
export async function requireNativeIdle(options={}){
  const status=await inspectNativeSlots(options);
  if(status.state==='busy'){
    const ids=status.slots.filter(x=>x.busy).map(x=>x.taskId).filter(x=>x!==null).join(', ');
    const error=new Error('Termux model is already processing '+status.busyCount+' of '+status.total+
      ' slots'+(ids?' (task '+ids+')':'')+'. A previous disconnected request may still be running. No new generation was submitted. Use Check local server and recover the stalled server only after confirming other work is not active.');
    error.code='NATIVE_SERVER_BUSY';error.slotStatus=status;throw error;
  }
  return status;
}
function pairing(storage){
  const token=String(storage?.getItem?.(PAIR_KEY)||'').trim();
  return /^[a-f0-9]{64}$/i.test(token)?token:'';
}
async function companionRequest(path,{token,fetcher=fetch,body}={}){
  const response=await fetcher(COMPANION+path,{
    method:body?'POST':'GET',credentials:'omit',mode:'cors',cache:'no-store',
    headers:{'X-Civweave-Token':token,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  let result={};try{result=await response.json()}catch{}
  if(!response.ok)throw new Error('Companion '+path+': '+short(result.error||'HTTP '+response.status));
  return result;
}
export async function inspectCreatorCompanion({storage=globalThis.sessionStorage,fetcher=fetch}={}){
  const token=pairing(storage);
  if(!token)return{state:'unpaired',detail:'No paired Companion token in this browser session. Use the Termux Companion setup, or manually stop/restart your own llama-server in Termux.'};
  try{
    const status=await companionRequest('/v1/status',{token,fetcher});
    return{state:status.managed_running?'managed':status.unmanaged_running?'unmanaged':'stopped',
      status,detail:status.managed_running?'Companion manages this model server.':status.unmanaged_running?'Port 8080 runs outside Companion; automatic restart is unsafe.':'Companion is paired but does not manage a running model server.'};
  }catch(error){return{state:'unavailable',detail:short(error.message)}}
}
export async function restartCreatorNativeServer({storage=globalThis.sessionStorage,fetcher=fetch}={}){
  const token=pairing(storage);
  if(!token)throw new Error('Pair Termux Companion first; cannot control an unmanaged server.');
  const before=await companionRequest('/v1/status',{token,fetcher});
  if(!before.managed_running||before.selected_model!=='qwen35-4b-native')
    throw new Error('Companion does not own the selected Qwen 4B server. No restart was requested; manually stop your own Termux server if necessary.');
  if(before.job?.state==='running')throw new Error('Companion has another operation in progress. No restart was requested.');
  const context=Number(before.context)||4096;
  const receipt=await companionRequest('/v1/actions/restart',{token,fetcher,body:{model:'qwen35-4b-native',context}});
  if(receipt.accepted!==true)throw new Error('Companion did not accept the restart.');
  return{accepted:true,jobId:receipt.job_id,detail:'Companion accepted the restart request. Wait for the model to load before generating.'};
}
