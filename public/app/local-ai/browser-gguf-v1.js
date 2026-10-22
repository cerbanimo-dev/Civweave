// Civweave in-browser GGUF runtime. No localhost server, LiteRT, or network inference.
const ENGINE='/app/vendor/wllama/esm/index.js';
const WASM='/app/vendor/wllama/esm/wasm/wllama.wasm';
export const GGUF_SELECTION_KEY='civweave.mobile.gguf-primary.v2';
export const GGUF_PRESETS=Object.freeze([
  Object.freeze({id:'qwen35-4b-iq2m-gguf',label:'Qwen 3.5 4B · GGUF IQ2_M',url:'https://huggingface.co/eaddario/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-IQ2_M.gguf',sizeHint:'~1.6 GB',primary:true,note:'Lower-quality quantization to fit the browser single-file size limit. Not identical to your GGUF benchmark.'}),
  Object.freeze({id:'qwen35-2b-q4km-gguf',label:'Qwen 3.5 2B · GGUF Q4_K_M',url:'https://huggingface.co/SoAIHQ/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',sizeHint:'~1.3 GB',primary:false,note:'Optional smaller GGUF; only one model is kept loaded at a time.'})
]);
let instance=null,loadedUrl='',loading=null,downloading=false;
const clean=value=>String(value??'').trim();
function err(code,message){return Object.assign(new Error(message),{code})}
function validateURL(value){
  let url;try{url=new URL(clean(value))}catch{throw err('GGUF_URL_INVALID','Enter a valid model download URL.')}
  if(url.protocol!=='https:'||url.hostname!=='huggingface.co'||!url.pathname.toLowerCase().endsWith('.gguf')||url.username||url.password||url.search||url.hash)
    throw err('GGUF_URL_NOT_ALLOWED','GGUF downloads must use a direct https://huggingface.co/.../resolve/.../*.gguf URL without credentials.');
  return url.href;
}
export function current(){try{const s=JSON.parse(localStorage.getItem(GGUF_SELECTION_KEY)||'null');return s?.enabled&&s?.engine==='wllama'&&s?.url&&s?.model? s:null}catch{return null}}
function notify(stage,detail={}){try{dispatchEvent(new CustomEvent('civweave:gguf-browser-progress',{detail:{stage,...detail}}))}catch{}}
async function engine(){
  if(instance)return instance;
  const module=await import(ENGINE);
  if(typeof module.Wllama!=='function')throw err('GGUF_ENGINE_UNAVAILABLE','The self-hosted browser GGUF runtime was not staged.');
  instance=new module.Wllama({default:WASM});
  return instance;
}
async function models(){
  const api=await engine();
  return api.modelManager.getModels();
}
export async function installed(url){
  const key=validateURL(url);
  const cached=await models();
  return cached.find(item=>item.url===key && item.validate()==='valid')||null;
}
export async function download(url,{onProgress}={}){
  if(downloading)throw err('GGUF_DOWNLOAD_BUSY','Another GGUF download is already running.');
  const key=validateURL(url);
  const cached=await installed(key);if(cached)return{url:key,bytes:cached.size,cached:true};
  downloading=true;notify('downloading',{url:key,loaded:0,total:0});
  try{
    const api=await engine();
    const saved=await api.modelManager.downloadModel(key,{progressCallback:progress=>{
      const loaded=Number(progress?.loaded||0),total=Number(progress?.total||0);
      notify('downloading',{url:key,loaded,total});
      try{onProgress?.({loaded,total})}catch{}
    }});
    if(saved.validate()!=='valid')throw err('GGUF_CACHE_INCOMPLETE','Download ended without a complete verified GGUF cache entry.');
    notify('ready',{url:key,bytes:saved.size});
    return{url:key,bytes:saved.size,cached:false};
  }catch(error){notify('failed',{url:key,error:clean(error?.message)});throw error}
  finally{downloading=false}
}
export async function activate({url,id,label}){
  const key=validateURL(url),file=await installed(key);
  if(!file)throw err('GGUF_NOT_DOWNLOADED','Download this GGUF within Civweave first. No server or alternate engine will be used.');
  const selected={schema:'civweave.mobile.gguf-browser.v2',enabled:true,engine:'wllama',model:clean(id||file.url.split('/').pop()).slice(0,120),label:clean(label||'GGUF on phone').slice(0,120),url:key,bytes:file.size,selectedAt:new Date().toISOString()};
  localStorage.setItem(GGUF_SELECTION_KEY,JSON.stringify(selected));
  notify('selected',{model:selected.model,url:key});
  return selected;
}
async function start(selected){
  const file=await installed(selected.url);
  if(!file)throw err('GGUF_CACHE_MISSING','The selected GGUF is not completely cached. Return to Settings to download it again.');
  if(instance?.isModelLoaded?.()&&loadedUrl===selected.url)return instance;
  if(loading)return loading;
  loading=(async()=>{
    const api=await engine();
    if(api.isModelLoaded?.()){await api.exit();instance=null;loadedUrl=''}
    const create=async gpuLayers=>{
      const current=await engine();
      await current.loadModel(file,{n_ctx:6144,n_threads:1,n_batch:128,n_ubatch:64,n_gpu_layers:gpuLayers,jinja:true,default_template_kwargs:{enable_thinking:false},reasoning:false});
      loadedUrl=selected.url;
      return current;
    };
    try{
      notify('loading',{model:selected.model,backend:'webgpu',gpuLayers:8});
      return await create(8);
    }catch(gpuError){
      notify('gpu-fallback',{model:selected.model,reason:clean(gpuError?.message).slice(0,300)});
      try{await instance?.exit()}catch{}
      instance=null;loadedUrl='';
      try{return await create(0)}
      catch(cpuError){throw err('GGUF_LOAD_FAILED','GGUF could not start in browser WebGPU or CPU/WASM: '+clean(cpuError?.message))}
    }
  })().finally(()=>{loading=null});
  return loading;
}
export async function generate({model,messages,temperature=.6,maxTokens=1024,structured=false,signal,onToken}={}){
  const selected=current();
  if(!selected||selected.model!==model)throw err('GGUF_SELECTION_MISMATCH','Browser GGUF is not selected, or another model replaced the selected ID.');
  const api=await start(selected);
  if(signal?.aborted)throw err('GGUF_ABORTED','GGUF generation cancelled.');
  let output='',chunks=0;
  const params={
    model:selected.model,
    messages:(Array.isArray(messages)?messages:[]).map(row=>({role:['system','assistant','user'].includes(row?.role)?row.role:'user',content:clean(row?.content)})).filter(row=>row.content),
    temperature:Number.isFinite(Number(temperature))?Math.max(0,Math.min(1.5,Number(temperature))):.6,
    max_tokens:Math.max(32,Math.min(4096,Number(maxTokens)||1024)),
    stream:true,abortSignal:signal,
    chat_template_kwargs:{enable_thinking:false},
    ...(structured?{response_format:{type:'json_object'}}:{})
  };
  notify('generating',{model:selected.model});
  try{
    const stream=await api.createChatCompletion(params);
    for await(const chunk of stream){
      if(signal?.aborted)throw err('GGUF_ABORTED','GGUF generation cancelled.');
      const text=String(chunk?.choices?.[0]?.delta?.content??'');
      if(!text)continue;
      output+=text;chunks++;
      try{onToken?.(text,output)}catch{}
    }
    if(!output.trim())throw err('GGUF_EMPTY','Embedded GGUF returned no visible answer.');
    notify('complete',{model:selected.model,chunks});
    return{text:output,model:selected.model,streamed:true,backend:'browser-wllama',chunks};
  }catch(error){notify('failed',{model:selected.model,error:clean(error?.message)});throw error}
}
export async function release(){
  if(loading)try{await loading}catch{}
  if(instance)try{await instance.exit()}catch{}
  instance=null;loadedUrl='';
}
