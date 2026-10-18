// Isolated diagnostic only. Never used for normal generation or model selection.
const VERSION='1.0.1-e4b-classic-worker-wasm-loader';
const MODULE_URL='/app/vendor/litert-lm/dist/index.js?v=0.17.1-civweave-qwen35';
const WASM_ROOT='/app/vendor/litert-lm/wasm/';
const CACHE='civweave-model-generative-v266';
let started=false;
const send=(status,detail={})=>self.postMessage({status,version:VERSION,elapsedMs:Math.round(performance.now()-origin),...detail});
let origin=performance.now();
const safeError=error=>({code:String(error?.code||'WORKER_GPU_TEST_FAILED'),message:String(error?.message||error).slice(0,700),stack:String(error?.stack||'').slice(0,900)});
self.onmessage=async event=>{
  if(started)return;started=true;origin=performance.now();
  const modelId=String(event.data?.modelId||'');
  const modelUrl=String(event.data?.modelUrl||'');
  if(!['gemma4-e4b-it-litert-web','gemma4-e2b-it-litert-web'].includes(modelId)||!modelUrl.startsWith('https://huggingface.co/litert-community/')){
    send('error',{phase:'input',code:'INVALID_GPU_TEST_MODEL',message:'An approved Gemma 4 LiteRT cached model is required.'});return;
  }
  let engine=null,conversation=null,phase='capabilities',chunks=0,visible=0;
  try{
    const classicWorker=typeof self.importScripts==='function';
    send('phase',{phase,workerType:classicWorker?'classic':'module',importScriptsAvailable:classicWorker,workerGpu:Boolean(navigator.gpu),jspi:typeof WebAssembly.Suspending==='function'&&typeof WebAssembly.promising==='function'});
    // LiteRT-LM's current WASM bootstrap calls WorkerGlobalScope.importScripts().
    // That API is prohibited in module workers, including after dynamic import().
    if(!classicWorker)throw Object.assign(new Error('The LiteRT WASM bootstrap needs a classic worker with importScripts().'),{code:'LITERT_CLASSIC_WORKER_REQUIRED'});
    if(!navigator.gpu)throw Object.assign(new Error('WebGPU is unavailable in this dedicated worker.'),{code:'WORKER_WEBGPU_UNAVAILABLE'});
    if(typeof WebAssembly.Suspending!=='function'||typeof WebAssembly.promising!=='function')throw Object.assign(new Error('WebAssembly JSPI is unavailable in this worker.'),{code:'WORKER_JSPI_UNAVAILABLE'});
    phase='cache';send('phase',{phase});
    const cache=await caches.open(CACHE);
    const response=await cache.match(modelUrl);
    if(!response?.ok||!response.body)throw Object.assign(new Error('The selected model artifact is not present in the existing local model cache. This diagnostic does not download replacement weights.'),{code:'WORKER_MODEL_CACHE_MISS'});
    phase='import';send('phase',{phase});
    const mod=await import(MODULE_URL);
    phase='wasm';send('phase',{phase});
    if(typeof mod.getOrLoadGlobalLiteRtLm==='function')await mod.getOrLoadGlobalLiteRtLm(WASM_ROOT);
    else if(typeof mod.loadLiteRtLm==='function')await mod.loadLiteRtLm(WASM_ROOT);
    else throw Object.assign(new Error('LiteRT-LM WASM loader is missing.'),{code:'WORKER_WASM_LOADER_MISSING'});
    phase='engine';send('phase',{phase});
    engine=await mod.Engine.create({model:response.body,mainExecutorSettings:{maxNumTokens:2048},benchmarkEnabled:false});
    phase='conversation';send('phase',{phase});
    conversation=await engine.createConversation();
    phase='awaiting-first-token';send('phase',{phase,inputCharacters:5});
    for await(const chunk of conversation.sendMessageStreaming('READY')){
      chunks++;
      for(const part of chunk?.content||[]){
        if(part?.type==='text'&&typeof part.text==='string'&&part.text){
          visible++;send('token',{phase,text:part.text,chunk:chunks});
        }
      }
    }
    send('complete',{phase:'complete',chunks,visibleTextDeltas:visible});
  }catch(error){send('error',{phase,...safeError(error),chunks,visibleTextDeltas:visible})}
  finally{
    // A poisoned WebGPU queue can also hang native delete(). The parent must
    // terminate this diagnostic worker after receiving its result or deadline.
    if(conversation)try{await conversation.delete?.()}catch{}
    if(engine)try{await engine.delete?.()}catch{}
  }
};
