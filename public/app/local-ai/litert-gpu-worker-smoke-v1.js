// Isolated diagnostic only. Never used for normal generation or model selection.
const VERSION='1.0.14-e4b-both-artifacts-gpu-limit-gate';
const MODULE_URL='/app/vendor/litert-lm/dist/index.js?v=0.17.1-civweave-qwen35';
const WASM_ROOT='/app/vendor/litert-lm/wasm/';
const CACHE='civweave-model-generative-v266';
let started=false;
const send=(status,detail={})=>self.postMessage({...detail,status,version:VERSION,elapsedMs:Math.round(performance.now()-origin)});
let origin=performance.now();
const WASM_MANIFEST='/app/vendor/litert-lm/stage-manifest.json';
// The cached E4B -web artifact generated a 160 MiB storage bind group on a
// 128 MiB-limit Android GPU. This is a per-bind-group resource limit, *not*
// GPU RAM or maxBufferSize; smaller prompts cannot split an AOT GPU binding.
const E4B_OBSERVED_BINDING_BYTES=167772160;
// LiteRT 0.17.x WASM AdvancedSettings requires a complete native value_object.
// Sending only experimental overrides fails at Engine.create() with
// "Missing field: prefill_batch_sizes" before GPU inference begins.
// These 14 JS-exposed fields mirror upstream wasm_binding_types.ts and the
// corresponding C++ AdvancedSettings defaults. Diagnostic worker only.
function completeWasmAdvancedSettings(overrides={}){
  return {
    prefill_batch_sizes:[],
    num_output_candidates:1,
    configure_magic_numbers:true,
    verify_magic_numbers:false,
    clear_kv_cache_before_prefill:true,
    num_logits_to_print_after_decode:0,
    gpu_madvise_original_shared_tensors:true,
    is_benchmark:false,
    preferred_device_substr:'',
    num_threads_to_upload:-1,
    num_threads_to_compile:-1,
    convert_weights_on_gpu:true,
    optimize_shader_compilation:true,
    share_constant_tensors:true,
    ...overrides
  };
}
const E4B_WEB_MODEL='gemma4-e4b-it-litert-web';
const OFFICIAL_GPU_FILE='gemma-4-E4B-it-gpu.litertlm';
const OFFICIAL_GPU_FILE_BYTES=2969059328;
let activeContextTokens=2048;
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
    const canonical=liteRtBinary?new URL(WASM_ROOT+basename,self.location.href).href:'';
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
function visibleChunkText(chunk){
  if(!chunk)return'';
  if(typeof chunk==='string')return chunk;
  if(typeof chunk.content==='string')return chunk.content;
  if(Array.isArray(chunk.content))return chunk.content.map(part=>{
    if(typeof part==='string')return part;
    if(!part||typeof part!=='object'||(part.type&&part.type!=='text'))return'';
    return typeof part.text==='string'?part.text:typeof part.content==='string'?part.content:'';
  }).join('');
  if(chunk.message)return visibleChunkText(chunk.message);
  if(typeof chunk.text==='string')return chunk.text;
  if(typeof chunk.delta==='string')return chunk.delta;
  return'';
}
function chunkShape(chunk){
  if(typeof chunk==='string')return{kind:'string',length:chunk.length};
  if(!chunk||typeof chunk!=='object')return{kind:typeof chunk};
  return {
    kind:'object',
    keys:Object.keys(chunk).slice(0,15),
    contentKind:Array.isArray(chunk.content)?'array':typeof chunk.content,
    contentLength:typeof chunk.content==='string'?chunk.content.length:Array.isArray(chunk.content)?chunk.content.length:undefined,
    partKinds:Array.isArray(chunk.content)?chunk.content.slice(0,8).map(part=>typeof part==='object'?String(part?.type||'unspecified'):typeof part):undefined,
    channelKeys:chunk.channels&&typeof chunk.channels==='object'?Object.keys(chunk.channels).slice(0,10):[],
    toolCalls:Array.isArray(chunk.tool_calls)?chunk.tool_calls.length:0
  };
}
async function verifyGpuBindingLimit(modelId,contextTokens,artifactKind='cached-web',backendMode='standard-gpu'){
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter)throw wasmError('WORKER_GPU_ADAPTER_UNAVAILABLE','The browser did not provide a WebGPU adapter.');
  const maximum=Number(adapter.limits?.maxStorageBufferBindingSize)||0;
  const deviceMaximumBuffer=Number(adapter.limits?.maxBufferSize)||null;
  // The user reproduced precisely the same 160 MiB bind with both the E4B -web
  // and -gpu artifacts at 512 tokens. Neither works with standard WebGPU here.
  const required=modelId===E4B_WEB_MODEL?E4B_OBSERVED_BINDING_BYTES:null;
  // The observed 160 MiB request occurred with a 2048-token engine. We have
  // not yet established whether a smaller context reduces that bind group.
  const unsupported=Boolean(required&&maximum>0&&maximum<required&&backendMode==='standard-gpu');
  send('gpu-limits',{phase:'gpu-limits',modelId,artifactKind,backendMode,engineContextTokens:contextTokens,maxStorageBufferBindingSize:maximum,maxBufferSize:deviceMaximumBuffer,observedRequiredBindingBytes:required,compatible:unsupported?false:required&&maximum>=required?true:null,backendExperiment:Boolean(required&&maximum<required&&backendMode!=='standard-gpu')});
  if(unsupported)throw wasmError('LITERT_E4B_GPU_STORAGE_BINDING_UNSUPPORTED',
    'Both tested E4B -web and -gpu artifacts request a 160 MiB shader storage binding using standard WebGPU, but this device permits only '+Math.round(maximum/1048576)+' MiB per binding. Lowering context or changing the file did not solve this. Try a different LiteRT weight-preparation path in the isolated comparison; do not repeat the invalid standard-GPU run.',
    {requiredBindingBytes:required,maximumBindingBytes:maximum,restartRequired:false});
}
function observeGpuDevice(mod){
  try{
    const gpu=mod.getGlobalLiteRtLm?.()?.liteRtLmWasm?.preinitializedWebGPUDevice;
    send('gpu-device',{available:Boolean(gpu),features:gpu?.features?[...gpu.features].slice(0,24):[],maxBufferSize:Number(gpu?.limits?.maxBufferSize)||null,maxStorageBufferBindingSize:Number(gpu?.limits?.maxStorageBufferBindingSize)||null});
    if(!gpu)return;
    gpu.lost?.then(info=>send('gpu-lost',{reason:short(info?.reason,100),message:short(info?.message,350)}))
      .catch(error=>send('gpu-warning',{message:short(error?.message||error,300)}));
    let gpuFatalSeen=false,warningsSeen=0;
    gpu.addEventListener?.('uncapturederror',event=>{
      const message=String(event?.error?.message||'Uncaptured WebGPU error');
      const failure=message.match(/Binding size \((\d+)\)[\s\S]*?maximum storage buffer binding size \((\d+)\)/i);
      if(failure){
        if(!gpuFatalSeen){
          gpuFatalSeen=true;
          send('gpu-fatal',{phase:'awaiting-first-token',code:'LITERT_GPU_BIND_GROUP_EXCEEDS_DEVICE_LIMIT',
            message:'GPU kernel requested a '+Math.round(Number(failure[1])/1048576)+' MiB storage binding; device limit is '+Math.round(Number(failure[2])/1048576)+' MiB. Its GPU command is invalid. Terminate this worker instead of waiting for inference.',
            requiredBindingBytes:Number(failure[1]),maximumBindingBytes:Number(failure[2]),contextTokens:activeContextTokens});
        }
        return;
      }
      if(++warningsSeen<=3)send('gpu-warning',{message:short(message,450),suppressedAfter:3});
    });
  }catch(error){send('gpu-warning',{message:'GPU instrumentation unavailable: '+short(error?.message||error,200)})}
}
const safeError=error=>({code:String(error?.code||'WORKER_GPU_TEST_FAILED'),message:String(error?.message||error).slice(0,700),assetUrl:short(error?.assetUrl||'',320),httpStatus:Number(error?.status)||null,mime:short(error?.mime||'',100),requiredBindingBytes:Number(error?.requiredBindingBytes)||null,maximumBindingBytes:Number(error?.maximumBindingBytes)||null,restartRequired:Boolean(error?.restartRequired),stack:String(error?.stack||'').slice(0,900)});
self.onmessage=async event=>{
  if(started)return;started=true;origin=performance.now();
  const modelId=String(event.data?.modelId||'');
  const modelUrl=String(event.data?.modelUrl||'');
  const mode=String(event.data?.mode||'bounded-stream');
  const contextTokens=Number(event.data?.contextTokens??2048);
  const artifactKind=String(event.data?.artifactKind||'cached-web');
  const backendMode=String(event.data?.backendMode||'standard-gpu');
  const modelFile=event.data?.modelFile||null;
  activeContextTokens=contextTokens;
  if(!['standard-gpu','legacy-gpu-artisan','no-gpu-weight-conversion','no-shared-gpu-constants'].includes(backendMode)){send('error',{phase:'input',code:'INVALID_GPU_TEST_BACKEND_MODE',message:'Unknown GPU backend comparison mode.'});return}
  if(!['cached-web','official-gpu-file'].includes(artifactKind)){send('error',{phase:'input',code:'INVALID_GPU_TEST_ARTIFACT_KIND',message:'Unknown artifact selection.'});return}
  if(artifactKind==='official-gpu-file'&&(modelId!==E4B_WEB_MODEL||modelFile?.name!==OFFICIAL_GPU_FILE||Number(modelFile?.size)!==OFFICIAL_GPU_FILE_BYTES||typeof modelFile?.stream!=='function')){
    send('error',{phase:'input',code:'INVALID_GPU_TEST_OFFICIAL_FILE',message:'Select the official '+OFFICIAL_GPU_FILE+' ('+OFFICIAL_GPU_FILE_BYTES+' bytes) using the local file picker. The worker does not download model weights or upload the file.'});return;
  }
  if(![256,512,1024,2048].includes(contextTokens)){send('error',{phase:'input',code:'INVALID_GPU_CONTEXT_TOKENS',message:'GPU test context must be 256, 512, 1024 or 2048 tokens.'});return}
  if(!['bounded-stream','baseline-stream','bounded-blocking'].includes(mode)){send('error',{phase:'input',code:'INVALID_GPU_TEST_MODE',message:'Unknown diagnostic mode.'});return}
  if(!['gemma4-e4b-it-litert-web','gemma4-e2b-it-litert-web'].includes(modelId)||!modelUrl.startsWith('https://huggingface.co/litert-community/')){
    send('error',{phase:'input',code:'INVALID_GPU_TEST_MODEL',message:'An approved Gemma 4 LiteRT cached model is required.'});return;
  }
  let engine=null,conversation=null,phase='capabilities',chunks=0,visible=0,rawShapes=[],nontextChunks=0,heartbeat=null;
  try{
    const classicWorker=typeof self.importScripts==='function';
    send('phase',{phase,workerType:classicWorker?'classic':'module',importScriptsAvailable:classicWorker,workerGpu:Boolean(navigator.gpu),jspi:typeof WebAssembly.Suspending==='function'&&typeof WebAssembly.promising==='function'});
    // LiteRT-LM's current WASM bootstrap calls WorkerGlobalScope.importScripts().
    // That API is prohibited in module workers, including after dynamic import().
    if(!classicWorker)throw Object.assign(new Error('The LiteRT WASM bootstrap needs a classic worker with importScripts().'),{code:'LITERT_CLASSIC_WORKER_REQUIRED'});
    if(!navigator.gpu)throw Object.assign(new Error('WebGPU is unavailable in this dedicated worker.'),{code:'WORKER_WEBGPU_UNAVAILABLE'});
    if(typeof WebAssembly.Suspending!=='function'||typeof WebAssembly.promising!=='function')throw Object.assign(new Error('WebAssembly JSPI is unavailable in this worker.'),{code:'WORKER_JSPI_UNAVAILABLE'});
    phase='gpu-limits';send('phase',{phase});
    await verifyGpuBindingLimit(modelId,contextTokens,artifactKind,backendMode);
    let modelInput;
    if(artifactKind==='official-gpu-file'){
      phase='local-file';send('phase',{phase,artifactKind,filename:modelFile.name,bytes:modelFile.size});
      // File is structured-cloned, not uploaded or cached. The browser streams
      // the user-selected local file into the same LiteRT Engine.create API.
      modelInput=modelFile.stream();
    }else{
      phase='cache';send('phase',{phase});
      const cache=await caches.open(CACHE);
      const response=await cache.match(modelUrl);
      if(!response?.ok||!response.body)throw Object.assign(new Error('The selected model artifact is not present in the existing local model cache. This diagnostic does not download replacement weights.'),{code:'WORKER_MODEL_CACHE_MISS'});
      modelInput=response.body;
    }
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
    const settings={model:modelInput,mainExecutorSettings:{maxNumTokens:contextTokens},benchmarkEnabled:false};
    if(backendMode==='no-gpu-weight-conversion'||backendMode==='no-shared-gpu-constants'){
      // Upstream LiteRT-LM #3866 identified the shared embedding/weights
      // preparation path as a potential oversized storage binding source.
      // These documented AdvancedSettings switches are *experimental*.
      settings.mainExecutorSettings.advancedSettings=completeWasmAdvancedSettings({
        convert_weights_on_gpu:false,
        ...(backendMode==='no-shared-gpu-constants'?{share_constant_tensors:false}:{})
      });
      send('phase',{phase:'backend-comparison',backendMode,engineContextTokens:contextTokens,advancedSettings:settings.mainExecutorSettings.advancedSettings});
    }
    if(backendMode==='legacy-gpu-artisan'){
      if(mod.Backend?.GPU_ARTISAN==null)throw wasmError('LITERT_GPU_ARTISAN_BACKEND_UNAVAILABLE','This LiteRT-LM build does not export Backend.GPU_ARTISAN.');
      // LiteRT 0.17.x exposes a separate legacy GPU_ARTISAN executor.
      // It may use a different compiled path; this is ONLY a comparison.
      // No CPU or model swap occurs. Disable submodel and autosized buffers.
      settings.backend=mod.Backend.GPU_ARTISAN;
      // Satisfy the same strict native struct for this comparison executor.
      settings.mainExecutorSettings.advancedSettings=completeWasmAdvancedSettings();
      settings.mainExecutorSettings.backendConfig={
        num_output_candidates:1,wait_for_weight_uploads:true,
        num_decode_steps_per_sync:1,sequence_batch_size:0,
        supported_lora_ranks:[],max_top_k:64,
        enable_decode_logits:false,enable_external_embeddings:false,
        use_submodel:false,use_autosized_ringbuffers:false
      };
      send('phase',{phase:'backend-comparison',backendMode,engineContextTokens:contextTokens,advancedSettings:settings.mainExecutorSettings.advancedSettings});
    }
    engine=await mod.Engine.create(settings);
    observeGpuDevice(mod);
    phase='conversation';send('phase',{phase,mode,contextTokens,artifactKind,backendMode});
    const bounded=mode!=='baseline-stream';
    const config=bounded?{
      sessionConfig:{maxOutputTokens:32},
      preface:{extra_context:{enable_thinking:false}},
      prefillPrefaceOnInit:false
    }:undefined;
    conversation=await engine.createConversation(config);
    phase='awaiting-first-token';send('phase',{phase,inputCharacters:5,mode,maxOutputTokens:bounded?32:null});
    // Heartbeats only run while the JS event loop is free. If they disappear
    // during generation, the underlying synchronous WASM call may be blocking.
    const submission=performance.now();
    let heartbeatIndex=0;
    heartbeat=setInterval(()=>send('heartbeat',{phase,mode,beat:++heartbeatIndex,
      sinceSubmissionMs:Math.round(performance.now()-submission),chunks,visibleTextDeltas:visible}),10000);
    if(mode==='bounded-blocking'){
      const chunk=await conversation.sendMessage('READY');
      chunks++;
      rawShapes.push(chunkShape(chunk));
      const piece=visibleChunkText(chunk);
      if(piece){visible++;send('token',{phase,text:piece,chunk:chunks})}
      else nontextChunks++;
    }else{
      for await(const chunk of conversation.sendMessageStreaming('READY')){
        chunks++;
        if(rawShapes.length<5)rawShapes.push(chunkShape(chunk));
        const piece=visibleChunkText(chunk);
        if(piece){visible++;send('token',{phase,text:piece,chunk:chunks})}
        else nontextChunks++;
      }
    }
    clearInterval(heartbeat);heartbeat=null;
    if(!visible)throw wasmError('LITERT_EMPTY_VISIBLE_OUTPUT',
      'LiteRT finished streaming without visible text. Stream shape and chunk counts are recorded; this is NOT a passing GPU inference test.',
      {rawDiagnostics:{chunksObserved:chunks,nontextChunks,rawShapes}});
    send('complete',{phase:'complete',mode,backendMode,chunks,visibleTextDeltas:visible,nontextChunks});
  }catch(error){send('error',{phase,mode,...safeError(error),chunks,visibleTextDeltas:visible,nontextChunks,rawShapes:error?.rawDiagnostics?.rawShapes||rawShapes})}
  finally{
    if(heartbeat)clearInterval(heartbeat);
    // A poisoned WebGPU queue can also hang native delete(). The parent must
    // terminate this diagnostic worker after receiving its result or deadline.
    if(conversation)try{await conversation.delete?.()}catch{}
    if(engine)try{await engine.delete?.()}catch{}
  }
};
