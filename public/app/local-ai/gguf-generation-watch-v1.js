// Bounded on-device GGUF generation watchdog. This supervises generation
// AFTER Wllama has loaded the GGUF, without touching OPFS weights.
export const GGUF_FIRST_VISIBLE_MS=120000;
// Prompt progress can advance for many minutes on mobile; it must not reset
// the absolute deadline for the first answer indefinitely.
export const GGUF_MAX_PREFILL_MS=240000;
export const GGUF_OUTPUT_IDLE_MS=75000;
export const GGUF_MAX_GENERATE_MS=720000;

export function createGGUFGenerationWatch({
  signal,onProgress=()=>{},firstVisibleMs=GGUF_FIRST_VISIBLE_MS,
  prefillCapMs=GGUF_MAX_PREFILL_MS,idleMs=GGUF_OUTPUT_IDLE_MS,maxMs=GGUF_MAX_GENERATE_MS,
  timerSet=setTimeout,timerClear=clearTimeout,now=Date.now
}={}){
  const own=new AbortController(),started=now();
  let firstVisibleAt=null,lastVisibleAt=null,hiddenChunks=0,visibleChunks=0,reason=null,lastPrefill=null,prefillEvents=0;
  const timers=new Set();
  const error=(code,message)=>{
    const e=new Error(message);e.code=code;return e;
  };
  const clear=()=>{for(const timer of timers)timerClear(timer);timers.clear()};
  const progress=(phase,details)=>{try{onProgress(phase,details)}catch{}};
  const progressEvent=progress;
  const abort=(code,message)=>{
    if(own.signal.aborted)return;
    reason=error(code,message);clear();progress('watchdog-timeout',{code,visibleChunks,hiddenChunks,elapsedMs:now()-started});
    own.abort(reason);
  };
  const schedule=(ms,callback)=>{
    const id=timerSet(callback,ms);timers.add(id);
    return id;
  };
  // The first-visible clock is a *stall* deadline, not a prefill deadline.
  // Every advancing prompt-evaluation progress packet renews it. A slow CPU
  // evaluating 1,700 prompt tokens must not be mistaken for an idle decoder.
  let firstTimer=null;
  const armFirst=()=>{
    if(firstTimer!==null){timerClear(firstTimer);timers.delete(firstTimer)}
    firstTimer=schedule(firstVisibleMs,()=>abort('GGUF_FIRST_VISIBLE_TOKEN_TIMEOUT',
      'Wllama stopped making progress for '+Math.ceil(firstVisibleMs/1000)+
      ' seconds before a visible token. Last prompt prefill: '+
      (lastPrefill?lastPrefill.processed+'/'+lastPrefill.total:'not reported')+
      '. The current GGUF remains installed.'));
  };
  armFirst();
  const absolutePrefillTimer=schedule(prefillCapMs,()=>abort('GGUF_PREFILL_TIME_LIMIT',
    'Wllama did not produce its first visible token within '+Math.ceil(prefillCapMs/1000)+
    ' seconds, even though prompt prefill may have advanced. Last prefill: '+
    (lastPrefill?lastPrefill.processed+'/'+lastPrefill.total:'not reported')+
    '. Try a shorter prompt or a native Termux/Ollama model. The GGUF remains installed.'));
  schedule(maxMs,()=>abort('GGUF_GENERATION_TIME_LIMIT',
    'Wllama generation exceeded '+Math.ceil(maxMs/1000)+' seconds. The current GGUF remains installed.'));
  let idleTimer=null;
  const resetIdle=()=>{
    if(idleTimer!==null){timerClear(idleTimer);timers.delete(idleTimer)}
    idleTimer=schedule(idleMs,()=>abort('GGUF_OUTPUT_STALL',
      'Wllama stopped producing visible text for '+Math.ceil(idleMs/1000)+' seconds. The current GGUF remains installed.'));
  };
  const parentAbort=()=>{
    reason=error('GGUF_ABORTED','Browser GGUF generation was cancelled by the application.');
    clear();own.abort(reason);
  };
  if(signal?.aborted)parentAbort();
  else signal?.addEventListener?.('abort',parentAbort,{once:true});
  const cancelled=new Promise((resolve,reject)=>{
    if(own.signal.aborted){reject(reason);return}
    own.signal.addEventListener('abort',()=>reject(reason||own.signal.reason||error('GGUF_ABORTED','GGUF generation cancelled.')),{once:true});
  });
  // A handler prevents unhandled rejection when the parent cancels between
  // iterators; Promise.race still propagates the reason to the caller.
  cancelled.catch(()=>{});
  return {
    signal:own.signal,cancelled,
    prefill(progress={}){
      if(own.signal.aborted)throw reason;
      prefillEvents++;
      const processed=Number(progress.processed||0),total=Number(progress.total||0);
      const advanced=Number.isFinite(processed)&&processed>(lastPrefill?.processed??-1);
      lastPrefill={processed,total,cached:Number(progress.cached||0),elapsedMs:now()-started};
      if(advanced&&firstVisibleAt===null){armFirst();
        progressEvent('prefill-progress',{processed,total,percent:total?Math.round(processed/total*100):null,elapsedMs:lastPrefill.elapsedMs});}
    },
    chunk({visible=false,hidden=false}={}){
      if(own.signal.aborted)throw reason;
      if(visible){
        visibleChunks++;if(firstVisibleAt===null){firstVisibleAt=now();timerClear(firstTimer);timers.delete(firstTimer);
          timerClear(absolutePrefillTimer);timers.delete(absolutePrefillTimer);
          progress('first-token',{firstTokenMs:firstVisibleAt-started,visibleChunks});}
        lastVisibleAt=now();resetIdle();
        if(visibleChunks===1||visibleChunks%24===0)
          progress('visible-progress',{visibleChunks,hiddenChunks,elapsedMs:now()-started});
      }else if(hidden){
        hiddenChunks++;if(hiddenChunks===1||hiddenChunks%24===0)
          progress('hidden-progress',{hiddenChunks,elapsedMs:now()-started,visibleChunks});
      }
    },
    cancel(){
      if(own.signal.aborted)return false;
      reason=error('GGUF_ABORTED','Browser GGUF generation stopped by the user. Imported weights remain installed.');
      clear();progress('cancelled',{code:reason.code,elapsedMs:now()-started});own.abort(reason);
      return true;
    },
    snapshot(){return{visibleChunks,hiddenChunks,prefillEvents,prefill:lastPrefill,firstTokenMs:firstVisibleAt===null?null:firstVisibleAt-started,
      idleMs:lastVisibleAt===null?null:now()-lastVisibleAt,elapsedMs:now()-started,
      timedOut:Boolean(reason&&reason.code!=='GGUF_ABORTED'),errorCode:reason?.code||''}},
    stop(){clear();signal?.removeEventListener?.('abort',parentAbort)}
  };
}