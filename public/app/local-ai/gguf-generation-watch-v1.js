// Bounded on-device GGUF generation watchdog. This supervises generation
// AFTER Wllama has loaded the GGUF, without touching OPFS weights.
export const GGUF_FIRST_VISIBLE_MS=120000;
export const GGUF_OUTPUT_IDLE_MS=75000;
export const GGUF_MAX_GENERATE_MS=240000;

export function createGGUFGenerationWatch({
  signal,onProgress=()=>{},firstVisibleMs=GGUF_FIRST_VISIBLE_MS,
  idleMs=GGUF_OUTPUT_IDLE_MS,maxMs=GGUF_MAX_GENERATE_MS,
  timerSet=setTimeout,timerClear=clearTimeout,now=Date.now
}={}){
  const own=new AbortController(),started=now();
  let firstVisibleAt=null,lastVisibleAt=null,hiddenChunks=0,visibleChunks=0,reason=null;
  const timers=new Set();
  const error=(code,message)=>{
    const e=new Error(message);e.code=code;return e;
  };
  const clear=()=>{for(const timer of timers)timerClear(timer);timers.clear()};
  const progress=(phase,details)=>{try{onProgress(phase,details)}catch{}};
  const abort=(code,message)=>{
    if(own.signal.aborted)return;
    reason=error(code,message);clear();progress('watchdog-timeout',{code,visibleChunks,hiddenChunks,elapsedMs:now()-started});
    own.abort(reason);
  };
  const schedule=(ms,callback)=>{
    const id=timerSet(callback,ms);timers.add(id);
    return id;
  };
  const firstTimer=schedule(firstVisibleMs,()=>abort('GGUF_FIRST_VISIBLE_TOKEN_TIMEOUT',
    'Wllama produced no visible text within '+Math.ceil(firstVisibleMs/1000)+' seconds after generation began. The current GGUF remains installed.'));
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
    chunk({visible=false,hidden=false}={}){
      if(own.signal.aborted)throw reason;
      if(visible){
        visibleChunks++;if(firstVisibleAt===null){firstVisibleAt=now();timerClear(firstTimer);timers.delete(firstTimer);
          progress('first-token',{firstTokenMs:firstVisibleAt-started,visibleChunks});}
        lastVisibleAt=now();resetIdle();
        if(visibleChunks===1||visibleChunks%24===0)
          progress('visible-progress',{visibleChunks,hiddenChunks,elapsedMs:now()-started});
      }else if(hidden){
        hiddenChunks++;if(hiddenChunks===1||hiddenChunks%24===0)
          progress('hidden-progress',{hiddenChunks,elapsedMs:now()-started,visibleChunks});
      }
    },
    snapshot(){return{visibleChunks,hiddenChunks,firstTokenMs:firstVisibleAt===null?null:firstVisibleAt-started,
      idleMs:lastVisibleAt===null?null:now()-lastVisibleAt,elapsedMs:now()-started,
      timedOut:Boolean(reason&&reason.code!=='GGUF_ABORTED'),errorCode:reason?.code||''}},
    stop(){clear();signal?.removeEventListener?.('abort',parentAbort)}
  };
}