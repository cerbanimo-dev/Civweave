const VENDOR_MODULE='/app/vendor/transformers/transformers.min.js';
const MODEL_ID='functiongemma-270m-it';
const MODEL_ROOT='/app/models/';
let generatorPromise=null;

function packageError(message,cause){
  const error=new Error(message);
  error.code='MICRO_MODEL_PACKAGE_MISSING';
  if(cause)error.cause=cause;
  return error;
}

async function loadGenerator(){
  if(globalThis.CommonweaveFunctionGemma?.generate)return globalThis.CommonweaveFunctionGemma;
  if(generatorPromise)return generatorPromise;
  generatorPromise=(async()=>{
    let transformers;
    try{transformers=await import(VENDOR_MODULE)}catch(error){throw packageError(`FunctionGemma needs the local Transformers.js bundle at ${VENDOR_MODULE}.`,error)}
    const {pipeline,env}=transformers;
    if(typeof pipeline!=='function')throw packageError('The packaged Transformers.js module does not expose pipeline().');
    if(env){
      env.allowRemoteModels=false;
      env.allowLocalModels=true;
      env.localModelPath=MODEL_ROOT;
      if(env.backends?.onnx?.wasm)env.backends.onnx.wasm.wasmPaths='/app/vendor/transformers/wasm/';
    }
    try{
      const device=globalThis.navigator?.gpu?'webgpu':'wasm';
      const generator=await pipeline('text-generation',MODEL_ID,{device,dtype:device==='webgpu'?'q4f16':'q4',local_files_only:true});
      return {
        async generate({messages,maxNewTokens=320}){
          const output=await generator(messages,{max_new_tokens:maxNewTokens,do_sample:false,temperature:0,return_full_text:false});
          const candidate=Array.isArray(output)?output[0]:output;
          const generated=candidate?.generated_text??candidate?.text??candidate;
          if(Array.isArray(generated))return String(generated.at(-1)?.content??generated.at(-1)?.text??'');
          return String(generated??'');
        }
      };
    }catch(error){throw packageError(`FunctionGemma model files are incomplete beneath ${MODEL_ROOT}${MODEL_ID}/.`,error)}
  })();
  return generatorPromise;
}

export async function status(){
  if(globalThis.CommonweaveFunctionGemma?.generate)return {available:true,id:'google/functiongemma-270m-it',source:'custom-adapter'};
  try{
    const [vendor,config]=await Promise.all([
      fetch(VENDOR_MODULE,{cache:'no-store'}),
      fetch(`${MODEL_ROOT}${MODEL_ID}/config.json`,{cache:'no-store'})
    ]);
    return {available:vendor.ok&&config.ok,id:'google/functiongemma-270m-it',source:'transformers-js',vendor:vendor.status,config:config.status};
  }catch(error){return {available:false,id:'google/functiongemma-270m-it',source:'transformers-js',error:error.message}}
}

export async function generate({messages,maxNewTokens=320}){
  const engine=await loadGenerator();
  return engine.generate({messages,maxNewTokens});
}
