// iOS / Apple Silicon WebGPU Qwen 3.5 browser runner. Separate from the
// incompatible LiteRT-LM web container and the ai.local HTTP server.
// Downloads start only from an explicit user action. No model is loaded
// on module import or opening Settings. Safari/WKWebView GPU viability is
// tested at runtime, not assumed from the iPhone model name.
const ENGINE_VERSION='1.0.0-ios-safari-qwen35-onnx-browser';
const TRANSFORMERS='/app/vendor/transformers-v4/transformers.min.js';
const MODEL_SPECS=Object.freeze([
  Object.freeze({id:'qwen35-08b-onnx-webgpu',repo:'onnx-community/Qwen3.5-0.8B-ONNX-OPT',label:'Qwen 3.5 0.8B · Safari WebGPU',hint:'Start here · lowest memory',trial:false}),
  Object.freeze({id:'qwen35-2b-onnx-webgpu',repo:'onnx-community/Qwen3.5-2B-ONNX-OPT',label:'Qwen 3.5 2B · Safari WebGPU',hint:'Bigger memory test',trial:true}),
  Object.freeze({id:'qwen35-4b-onnx-webgpu',repo:'onnx-community/Qwen3.5-4B-ONNX-OPT',label:'Qwen 3.5 4B · Safari WebGPU',hint:'Experimental · browser may close',trial:true})
]);
export const version=ENGINE_VERSION;
export const models=MODEL_SPECS;
const nameFor=id=>MODEL_SPECS.find(x=>x.id===id)||null;
let active=null,model=null,processor=null,busy=null,running=false,stopper=null,progressListener=null;
const now=()=>Date.now();
const bounded=(value,max=120)=>String(value??'').slice(0,max);
function error(code,message,detail={}){return Object.assign(new Error(message),{code,...detail})}
export function browserCapability(){
  const ua=String(navigator?.userAgent||'');
  const ios=/iPad|iPhone|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&Number(navigator?.maxTouchPoints||0)>1);
  return {ios,secureContext:globalThis.isSecureContext===true,webgpu:typeof navigator?.gpu?.requestAdapter==='function',storage:typeof globalThis.caches!=='undefined',webApp:navigator?.standalone===true||globalThis.matchMedia?.('(display-mode: standalone)')?.matches===true,version:ENGINE_VERSION};
}
export async function probeGPU(){
  const capability=browserCapability();
  if(!capability.secureContext||!capability.webgpu)throw error('IOS_WEBGPU_UNAVAILABLE','This browser has no usable WebGPU API. On iOS use Safari 26+ or a WebKit app exposing WebGPU; do not use the legacy LiteRT model.');
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter)throw error('IOS_WEBGPU_ADAPTER_MISSING','This browser exposes WebGPU but cannot acquire a GPU adapter. A browser/device limitation prevents local GPU inference.');
  return {...capability,adapter:true,maxStorageBufferBindingSize:Number(adapter.limits?.maxStorageBufferBindingSize||0),maxBufferSize:Number(adapter.limits?.maxBufferSize||0)};
}
function notify(phase,detail={}){try{progressListener?.(phase,detail)}catch{}}
function release(){
  try{stopper?.interrupt?.()}catch{}
  try{model?.dispose?.()}catch{}
  active=null;model=null;processor=null;stopper=null;
}
function sourceCheck(){
  // The bundled v4 API must expose the conditional Qwen3.5 class.
  // AutoModelForCausalLM from the older generic worker cannot load this
  // multimodal hybrid architecture correctly.
  if(!globalThis.isSecureContext)throw error('IOS_WEBGPU_NOT_SECURE','The model must run on an HTTPS web origin.');
}
function configure(hf){
  if(!hf?.env||typeof hf.AutoProcessor?.from_pretrained!=='function'||
     typeof hf.Qwen3_5ForConditionalGeneration?.from_pretrained!=='function'||
     typeof hf.TextStreamer!=='function')
    throw error('IOS_WEBGPU_TRANSFORMERS_API_MISSING','Bundled Transformers.js v4 lacks the required Qwen3.5 processor, model and streaming APIs. Do not retry the LiteRT or Transformers.js v3 executor.');
  hf.env.useBrowserCache=true;
  hf.env.useCustomCache=false;
  hf.env.allowRemoteModels=true; // Only touched after a user-initiated prepare/generate.
  return hf;
}
export async function prepare(id,{onPhase}={}){
  const spec=nameFor(id);if(!spec)throw error('IOS_WEBGPU_MODEL_UNKNOWN','Select a listed ONNX WebGPU Qwen model.');
  if(busy)return busy;
  if(active===id&&model&&processor)return{model:id,cached:true,resident:true};
  progressListener=onPhase;
  busy=(async()=>{
    sourceCheck();
    const gpu=await probeGPU();
    // An optimized ONNX browser export is required. A GGUF or .litertlm
    // download cannot be reused as these are different formats.
    notify('loading-runtime',{model:id});
    const hf=configure(await import(TRANSFORMERS));
    if(active&&active!==id)release();
    notify('loading-processor',{model:id,repo:spec.repo});
    const nextProcessor=await hf.AutoProcessor.from_pretrained(spec.repo,{progress_callback:value=>notify('download',{model:id,component:'processor',...value})});
    notify('loading-model',{model:id,repo:spec.repo});
    const nextModel=await hf.Qwen3_5ForConditionalGeneration.from_pretrained(spec.repo,{
      dtype:{embed_tokens:'q4',vision_encoder:'fp16',decoder_model_merged:'q4'},
      device:'webgpu',
      progress_callback:value=>notify('download',{model:id,component:'weights',...value})
    });
    active=id;processor=nextProcessor;model=nextModel;stopper=new hf.InterruptableStoppingCriteria();
    notify('ready',{model:id,device:'webgpu'});
    return{model:id,cached:false,resident:true,backend:'webgpu',gpu};
  })().catch(e=>{
    release();notify('error',{model:id,code:e.code||'IOS_WEBGPU_MODEL_LOAD_FAILED',message:e.message});
    throw e;
  }).finally(()=>{busy=null});
  return busy;
}
function normalizeMessages(messages){
  return (Array.isArray(messages)?messages:[]).filter(x=>x&&typeof x.content==='string')
    .map(x=>({role:['system','assistant','user'].includes(x.role)?x.role:'user',content:x.content.slice(0,20000)})).slice(-24);
}
function promptOf(messages,structured=false){
  const normalized=normalizeMessages(messages);
  if(structured)normalized.unshift({role:'system',content:'Return exactly one valid JSON object. No markdown code fence or commentary outside the object.'});
  if(!normalized.length)throw error('IOS_WEBGPU_EMPTY_PROMPT','No user prompt was supplied.');
  // Follows the model's browser reference, including explicit non-thinking
  // mode so small iPhone configurations do not exhaust context on reasoning.
  return normalized.map(x=>'<|im_start|>'+x.role+'\n'+x.content+'<|im_end|>\n').join('')+
    '<|im_start|>assistant\n<think>\n\n</think>\n\n';
}
export async function generate({modelId,messages,maxTokens=160,signal,onToken,onPhase,structured=false}={}){
  const id=modelId||active,spec=nameFor(id);
  if(!spec)throw error('IOS_WEBGPU_MODEL_UNKNOWN','No Safari Qwen model is selected.');
  if(running)throw error('IOS_WEBGPU_BUSY','The browser can only run one Qwen WebGPU generation at a time.');
  if(signal?.aborted)throw error('IOS_WEBGPU_CANCELLED','The local generation was cancelled before starting.');
  await prepare(id,{onPhase});
  if(signal?.aborted)throw error('IOS_WEBGPU_CANCELLED','The local generation was cancelled.');
  const hf=configure(await import(TRANSFORMERS));
  let resultText='',chunks=0;
  running=true;
  const abort=()=>stopper?.interrupt?.();
  signal?.addEventListener('abort',abort,{once:true});
  try{
    stopper.reset();
    const prompt=promptOf(messages,structured);
    notify('prefill',{model:id,characters:prompt.length});
    const inputs=await processor(prompt);
    const streamer=new hf.TextStreamer(processor.tokenizer,{
      skip_prompt:true,skip_special_tokens:true,
      callback_function:piece=>{
        if(typeof piece!=='string'||!piece)return;
        resultText+=piece;chunks++;
        try{onToken?.(piece,resultText)}catch{}
      }
    });
    await model.generate({...inputs,max_new_tokens:Math.max(16,Math.min(1024,Math.floor(maxTokens||160))),
      do_sample:false,streamer,stopping_criteria:stopper,return_dict_in_generate:true});
    if(signal?.aborted)throw error('IOS_WEBGPU_CANCELLED','Local generation was cancelled.');
    notify('complete',{model:id,chunks,characters:resultText.length});
    if(!resultText.trim())throw error('IOS_WEBGPU_NO_OUTPUT','The WebGPU model completed without any visible text tokens.');
    return{model:id,text:resultText,streamed:chunks>0,chunks,backend:'safari-webgpu-onnx',local:true};
  }catch(e){notify('error',{model:id,code:e.code||'IOS_WEBGPU_GENERATION_FAILED',message:e.message});throw e}
  finally{running=false;signal?.removeEventListener('abort',abort);try{stopper?.reset?.()}catch{}}
}
export function status(){return {version:ENGINE_VERSION,model:active,resident:Boolean(model&&processor),running,capability:browserCapability()}}
export async function unload(){if(running)stopper?.interrupt?.();release();return status()}
export function mount(target,{activate}={}){
  if(!target||target.dataset.iosWebgpuMounted==='1')return;
  target.dataset.iosWebgpuMounted='1';
  target.innerHTML='<p><b>Direct in-browser Apple GPU inference.</b> Uses optimized ONNX Qwen 3.5 rather than LiteRT, MLX or ai.local. Choose a model and download explicitly. No native app, localhost service or remote inference endpoint is required.</p>'+
    '<label>Model <select data-ios-webgpu-model>'+MODEL_SPECS.map(x=>'<option value="'+x.id+'">'+x.label+' · '+x.hint+'</option>').join('')+'</select></label>'+
    '<div class="cw-clean-grid"><button type="button" data-ios-webgpu-probe>Check WebGPU</button><button type="button" data-ios-webgpu-load>Download and load model</button></div>'+
    '<div class="cw-clean-grid"><button type="button" data-ios-webgpu-test disabled>Test live local tokens</button><button type="button" data-ios-webgpu-use disabled>Use tested browser model</button></div>'+
    '<output role="status" aria-live="polite" data-ios-webgpu-status>Not checked. Nothing downloads until you tap Download and load model.</output>'+
    '<p>0.8B first; 2B and 4B may exceed Safari or embedded WebView GPU memory even on a 12 GB iPhone. For offline use, download while connected, then verify that the exact same browser can reopen and run it in Airplane Mode. The cache belongs to this browser, not to Safari if using ai.local’s web view.</p>';
  const select=target.querySelector('[data-ios-webgpu-model]'),output=target.querySelector('[data-ios-webgpu-status]');
  const probe=target.querySelector('[data-ios-webgpu-probe]'),load=target.querySelector('[data-ios-webgpu-load]'),test=target.querySelector('[data-ios-webgpu-test]'),use=target.querySelector('[data-ios-webgpu-use]');
  let loaded='',tested='',busyAction=false;
  function state(message){output.textContent=bounded(message,1200)}
  function reset(){loaded='';tested='';test.disabled=true;use.disabled=true}
  select.addEventListener('change',()=>{reset();state('Model changed. Download/load and test the exact model before activation.')});
  async function action(kind){
    if(busyAction)return;
    busyAction=true;probe.disabled=load.disabled=test.disabled=use.disabled=true;
    try{
      if(kind==='probe'){
        const gpu=await probeGPU();
        state('WebGPU adapter available. Max storage binding '+Math.floor(gpu.maxStorageBufferBindingSize/1048576)+' MiB. This does not establish model memory capacity.');
      }else if(kind==='load'){
        reset();const id=select.value;
        if(id==='qwen35-4b-onnx-webgpu'&&!globalThis.confirm?.('Qwen 3.5 4B WebGPU may exhaust iPhone browser memory and close this tab. Continue?'))throw error('IOS_WEBGPU_NOT_CONFIRMED','4B download was not started.');
        const ready=await prepare(id,{onPhase:(phase,detail)=>state(phase+': '+(detail.file||detail.model||id)+' '+(Number.isFinite(Number(detail.progress))?Math.round(Number(detail.progress))+'%':''))});
        loaded=ready.model;state(ready.model+' loaded in the browser GPU. Test live output before choosing it for Civweave.');
      }else if(kind==='test'){
        if(loaded!==select.value)throw error('IOS_WEBGPU_NOT_LOADED','Load the selected model first.');
        const testedResult=await generate({modelId:loaded,messages:[{role:'user',content:'Say READY only.'}],maxTokens:32,
          onToken:(_,acc)=>state('Live local stream: '+bounded(acc,110))});
        tested=loaded;state('Local WebGPU streaming passed: '+testedResult.chunks+' text chunks · '+bounded(testedResult.text,160)+'.');
      }else if(kind==='use'){
        if(!tested||tested!==select.value)throw error('IOS_WEBGPU_NOT_TESTED','Test this exact model before selecting it.');
        if(typeof activate!=='function')throw error('IOS_WEBGPU_SETTINGS_MISSING','Civweave settings route is unavailable.');
        await activate({model:tested,localApiFlavor:'ios-webgpu',endpoint:'',stream:true});
        state('Selected '+tested+' for local-first Civweave. Browser-resident WebGPU inference; no HTTP model server.');
      }
    }catch(e){tested='';state((e.code?e.code+': ':'')+(e.message||e))}
    finally{busyAction=false;probe.disabled=load.disabled=false;test.disabled=loaded!==select.value;use.disabled=tested!==select.value}
  }
  probe.addEventListener('click',()=>void action('probe'));
  load.addEventListener('click',()=>void action('load'));
  test.addEventListener('click',()=>void action('test'));
  use.addEventListener('click',()=>void action('use'));
}
