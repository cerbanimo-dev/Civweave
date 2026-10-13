// Experimental device-only caption executor. No app state, storage or safety
// policy lives here. Image bytes stay in this dedicated worker (no uploads).
import {MODEL_ID,TRANSFORMERS_JS,WASM_CHUNKS,MAX_IMAGE_BYTES,MAX_GENERATED_TOKENS} from './vision-policy.mjs';
let captioner=null;
let loading=null;
const report=(id,detail)=>self.postMessage({id,type:'progress',detail});
function errorText(error){
  const message=String(error?.message||error||'Unknown runtime failure');
  return message.slice(0,320);
}
async function configure(allowDownload){
  if(!self.navigator?.gpu?.requestAdapter)throw new Error('WebGPU is not available on this device.');
  const adapter=await self.navigator.gpu.requestAdapter();
  if(!adapter)throw new Error('No usable WebGPU adapter is available.');
  report(activeId,'Opening bundled browser vision runtime…');
  const hf=await import(TRANSFORMERS_JS);
  hf.env.useBrowserCache=true;
  hf.env.useCustomCache=false;
  hf.env.allowLocalModels=true;
  // Model metadata/weights may be fetched ONLY during the explicit prepare
  // action. The actual photo is never a remote model asset.
  hf.env.allowRemoteModels=allowDownload===true;
  const wasm=hf.env.backends?.onnx?.wasm;
  if(wasm){
    const pieces=[];
    let length=0;
    for(const path of WASM_CHUNKS){
      const response=await fetch(path,{cache:'force-cache'});
      if(!response.ok)throw new Error('The installed local ONNX runtime is incomplete.');
      const bytes=new Uint8Array(await response.arrayBuffer());
      pieces.push(bytes);length+=bytes.length;
    }
    const combined=new Uint8Array(length);
    let offset=0;
    for(const piece of pieces){combined.set(piece,offset);offset+=piece.length;}
    wasm.wasmBinary=combined;
    wasm.numThreads=1;
  }
  return hf;
}
let activeId=0;
async function prepare(id,allowDownload){
  if(captioner)return true;
  if(loading)return loading;
  loading=(async()=>{
    if(!allowDownload){
      // Offline restore may use already cached model weights. The library's
      // browser cache is checked first; missing artifacts fail visibly.
      report(id,'Restoring saved image model from browser cache (offline)…');
    }else report(id,'Preparing optional image model. Initial download may be large…');
    const hf=await configure(allowDownload);
    captioner=await hf.pipeline('image-to-text',MODEL_ID,{
      device:'webgpu',dtype:'q8',
      progress_callback:progress=>{
        if(progress?.status==='progress'&&Number.isFinite(Number(progress?.progress))){
          report(id,'Preparing model: '+Math.round(Number(progress.progress))+'%');
        }else if(progress?.status==='ready')report(id,'Device vision ready.');
      }
    });
    return true;
  })().finally(()=>{loading=null;});
  return loading;
}
async function caption(id,image,mime){
  if(!captioner)throw new Error('Prepare the local vision model before describing a photo.');
  if(!(image instanceof ArrayBuffer)||image.byteLength===0||image.byteLength>MAX_IMAGE_BYTES)throw new Error('Invalid photo size.');
  if(!/^image\/(jpeg|png|webp|gif)$/i.test(String(mime||'')))throw new Error('Unsupported image type.');
  const blob=new Blob([image],{type:mime});
  const url=URL.createObjectURL(blob);
  try{
    report(id,'Generating a provisional caption on device…');
    const output=await captioner(url,{max_new_tokens:MAX_GENERATED_TOKENS});
    const text=String(Array.isArray(output)?output[0]?.generated_text||'':output?.generated_text||'').trim().slice(0,400);
    if(!text)throw new Error('Local model returned no image description.');
    return text;
  }finally{URL.revokeObjectURL(url);}
}
self.onmessage=async({data})=>{
  const id=Number(data?.id||0),type=data?.type;
  if(!id||!['prepare','caption'].includes(type))return;
  activeId=id;
  try{
    if(type==='prepare'){
      if(!data.allowDownload&&self.navigator?.onLine===false){
        // Do not claim that cache availability is guaranteed: loading will
        // either resolve entirely from the browser cache or fail.
        report(id,'Attempting offline cached model restore…');
      }
      const ok=await prepare(id,Boolean(data.allowDownload));
      self.postMessage({id,type:'result',ok,model:MODEL_ID});
    }else{
      const text=await caption(id,data.image,data.mime);
      self.postMessage({id,type:'result',caption:text,model:MODEL_ID});
    }
  }catch(error){
    self.postMessage({id,type:'error',error:errorText(error),model:MODEL_ID});
  }
};
