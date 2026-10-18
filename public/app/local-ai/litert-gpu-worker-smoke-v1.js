// Isolated diagnostic only. Never used for normal generation or model selection.
const VERSION='1.0.5-e4b-wasm-worker-relative-resolution';
const MODULE_URL='/app/vendor/litert-lm/dist/index.js?v=0.17.1-civweave-qwen35';
const WASM_ROOT='/app/vendor/litert-lm/wasm/';
const CACHE='civweave-model-generative-v266';
let started=false;
const send=(status,detail={})=>self.postMessage({...detail,status,version:VERSION,elapsedMs:Math.round(performance.now()-origin)});
let origin=performance.now();
const WASM_MANIFEST='/app/vendor/litert-lm/stage-manifest.json';
function short(value,max=260){return String(value??'').slice(0,max)}
function wasmError(code,message,detail={}){return Object.assign(new Error(message),{code,...detail})}
function wasmMagic(bytes){return bytes?.length>=4&&bytes[0]===0&&bytes[1]===97&&bytes[2]===115&&bytes[3]===109}
async function peekBytes(response){
  const reader=response?.body?.getReader?.();
  if(!reader)throw wasmError('WASM_RESPONSE_NOT_STREAMABLE','WASM asset response body is missing.');
  const prefix=[];
  try{
    while(prefix.length<8){
      const chunk=await reader.read();
      if(chunk.done)break;
      for(const byte of chunk.value||[]){prefix.push(byte);if(prefix.length>=8)break}
    }
  }finally{try{await reader.cancel()}catch{}}
  return prefix;
}
async function verifyStagedWasmAssets(){
  const response=await fetch(WASM_MANIFEST,{cache:'no-store'});
  if(!response.ok||/text\/html/i.test(response.headers.get('content-type')||''))throw wasmError(
    'LITERT_MANIFEST_MISSING','The published LiteRT runtime manifest returned an HTML page or a failed response.',{assetUrl:response.url||WASM_MANIFEST});
  const manifest=await response.json();
  const names=[...(manifest.wasmFiles||[]).filter(name=>/\.wasm$/i.test(name)),...(manifest.omittedFiles||[]).filter(row=>Array.isArray(row.parts)&&row.parts.length).map(row=>row.path)];
  if(!names.length)throw wasmError('LITERT_WASM_MANIFEST_EMPTY','No WebAssembly binaries were listed in the LiteRT staging manifest.');
  send('phase',{phase:'wasm-inventory',coreVersion:short(manifest.coreVersion,40),wasmCount:names.length,omittedWasm:(manifest.omittedFiles||[]).map(item=>item.path).filter(Boolean)});
  for(const name of names){
    const url='/app/vendor/litert-lm/'+name;
    const asset=await fetch(url,{cache:'no-store',headers:{Range:'bytes=0-7'}});
    const mime=short(asset.headers.get('content-type')||'',100),status=asset.status;
    const prefix=asset.ok?await peekBytes(asset):[];
    const valid=asset.ok&&wasmMagic(prefix);
    send('asset',{phase:'wasm-inventory',url,httpStatus:status,mime,magic:prefix.map(b=>b.toString(16).padStart(2,'0')).join(' '),valid});
    if(!valid)throw wasmError('LITERT_STAGED_WASM_NOT_BINARY',
      'A published LiteRT WASM asset returned HTML, an error, or invalid WebAssembly bytes. This is a deployment/runtime asset problem, not a GPU inference failure: '+url,
      {assetUrl:url,status,mime});
  }
}
function observeWasmFetches(){
  const nativeFetch=self.fetch?.bind(self);
  if(typeof nativeFetch!=='function')return;
  self.fetch=async(input,init)=>{
    let url='';
    try{url=new URL(typeof input==='string'?input:input?.url||String(input),self.location.href).href}catch{}
    const basename=url.split(/[?#]/,1)[0].split('/').at(-1)||'';
    const tracked=/\.wasm(?:\?|$)/i.test(url);
    // Emscripten can resolve an unqualified .wasm URL against the worker
    // script (/app/local-ai/) even if LiteRT was initialized with WASM_ROOT.
    // Rewrite only known LiteRT filenames to the canonical self-hosted path.
    const liteRtBinary=/^litertlm_wasm_(?:compat_)?(?:asyncify_)?internal\.wasm$/.test(basename);
    const canonical=liteRtBinary?new URL(WASM_ROOT+basename,self.location.origin).href:'';
    const rewritten=liteRtBinary&&url!==canonical;
    if(tracked)send('phase',{phase:rewritten?'wasm-rewrite':'wasm-request',url:short(url,320),target:rewritten?canonical:undefined});
    let request=input;
    if(rewritten){
      request=typeof input==='string'?canonical:new Request(canonical,input);
    }
    const response=await nativeFetch(request,init);
    if(tracked){
      const mime=short(response.headers.get('content-type')||'',100);
      send('asset',{phase:'wasm-request',url:short(url,320),resolvedUrl:canonical||url,httpStatus:response.status,mime,redirected:Boolean(response.redirected)});
      if(!response.ok||/text\/html/i.test(mime))throw wasmError('LITERT_WASM_HTML_FALLBACK',
        'The LiteRT WASM loader received HTML or an HTTP failure instead of WebAssembly: '+url,
        {assetUrl:canonical||url,status:response.status,mime});
    }
    return response;
  };
}
const safeError=error=>({code:String(error?.code||'WORKER_GPU_TEST_FAILED'),message:String(error?.message||error).slice(0,700),assetUrl:short(error?.assetUrl||'',320),httpStatus:Number(error?.status)||null,mime:short(error?.mime||'',100),stack:String(error?.stack||'').slice(0,900)});
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
    phase='wasm-inventory';send('phase',{phase});
    await verifyStagedWasmAssets();
    observeWasmFetches();
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
