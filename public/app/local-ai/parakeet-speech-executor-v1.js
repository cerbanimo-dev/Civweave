(()=>{
'use strict';

const VERSION='1.0.1-parakeet-speech-executor-v1-mobile-startup';
if(globalThis.CivweaveParakeetSpeechExecutorV1?.version===VERSION)return;

const MODEL_ID='parakeet-tdt-0.6b-v3-int8';
const CACHE='civweave-specialized-model-packs-v1';
const ORT_PATH='/app/vendor/onnxruntime/ort.wasm.min.mjs';
const ORT_WASM_ROOT='/app/vendor/onnxruntime/';
const SAMPLE_RATE=16000;
const FRAME_LENGTH=400;
const FRAME_SHIFT=160;
const FFT_SIZE=512;
const MEL_BINS=128;
const EPSILON=1.1920928955078125e-7;
const MAX_TOKENS_PER_FRAME=5;
const REQUIRED=Object.freeze(['encoder.int8.onnx','decoder.int8.onnx','joiner.int8.onnx','tokens.txt']);

let runtimePromise=null;
let currentSession=null;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function emitRuntimePhase(phase,detail={}){try{dispatchEvent(new CustomEvent('civweave:guide-voice-state',{detail:{source:MODEL_ID,modelId:MODEL_ID,phase,...detail}}))}catch{}}
function argmax(data,start=0,end=data.length){
  let index=start,best=-Infinity;
  for(let i=start;i<end;i+=1){const value=Number(data[i]);if(value>best){best=value;index=i}}
  return index-start;
}
function tensorNumber(value){return typeof value==='bigint'?Number(value):Number(value||0)}
function tensorLength(tensor,fallback){
  if(!tensor?.data?.length)return fallback;
  const value=tensorNumber(tensor.data[0]);
  return Number.isFinite(value)&&value>0?Math.floor(value):fallback;
}
function typedInteger(type,values){
  if(type==='int64'||type==='uint64')return BigInt64Array.from(values,value=>BigInt(Math.trunc(value)));
  return Int32Array.from(values,value=>Math.trunc(value));
}
function product(values){return values.reduce((total,value)=>total*value,1)}
function concreteShape(shape=[]){return Array.from(shape,dimension=>Number.isFinite(Number(dimension))&&Number(dimension)>0?Number(dimension):1)}

async function modelRows(){
  const packs=globalThis.CivweaveLocalModelPacksV1;
  if(!packs?.specializedStatus)throw Object.assign(new Error('Civweave local model packs are unavailable.'),{code:'LOCAL_MODEL_PACK_RUNTIME_UNAVAILABLE'});
  const status=await packs.specializedStatus(MODEL_ID);
  if(!status?.available)throw Object.assign(new Error('The Parakeet TDT INT8 pack is not fully installed.'),{code:'LOCAL_MODEL_PACK_INCOMPLETE',modelId:MODEL_ID,missing:status?.missing||[]});
  const rows=new Map((status.rows||[]).filter(row=>row?.ok).map(row=>[row.path,row]));
  for(const path of REQUIRED)if(!rows.has(path))throw Object.assign(new Error(`The Parakeet speech pack is missing ${path}.`),{code:'LOCAL_MODEL_PACK_INCOMPLETE',modelId:MODEL_ID,path});
  return{rows,cacheName:packs.cache||CACHE};
}
async function cachedResponse(cache,row){
  let response=await cache.match(row.url);
  if(response?.ok)return response;
  const keys=await cache.keys();
  const key=keys.find(request=>String(request?.url||request).endsWith('/'+row.path)||String(request?.url||request).includes('/'+row.path+'?'));
  if(key)response=await cache.match(key);
  if(!response?.ok)throw Object.assign(new Error(`Cached Parakeet artifact ${row.path} is unavailable.`),{code:'LOCAL_MODEL_ARTIFACT_UNAVAILABLE',path:row.path});
  return response;
}
async function cachedBytes(cache,row){
  const response=await cachedResponse(cache,row);
  try{return new Uint8Array(await response.arrayBuffer())}
  catch(error){throw Object.assign(new Error(`Cached Parakeet artifact ${row.path} could not be read: ${clean(error?.message||error,500)}`),{code:'LOCAL_MODEL_ARTIFACT_READ_FAILED',path:row.path,cause:error})}
}

function supportsProxyWorker(){
  if(typeof Worker!=='function'||typeof Blob!=='function'||typeof URL?.createObjectURL!=='function')return false;
  let url='';
  try{
    url=URL.createObjectURL(new Blob(['self.close()'],{type:'text/javascript'}));
    const worker=new Worker(url);worker.terminate();return true;
  }catch{return false}
  finally{if(url)try{URL.revokeObjectURL(url)}catch{}}
}
async function loadOrt(){
  const ort=await import(ORT_PATH);
  if(!ort?.InferenceSession||!ort?.Tensor)throw Object.assign(new Error('Civweave ONNX Runtime did not expose the browser inference API.'),{code:'PARAKEET_ONNX_RUNTIME_UNAVAILABLE'});
  if(ort.env?.wasm){
    ort.env.wasm.wasmPaths=ORT_WASM_ROOT;
    ort.env.wasm.numThreads=1;
    ort.env.wasm.proxy=supportsProxyWorker();
  }
  return ort;
}
function sessionOptions(row){return{executionProviders:['wasm'],graphOptimizationLevel:String(row?.path||'').startsWith('encoder.')?'basic':'all',executionMode:'sequential'}}
async function createCachedSession(ort,cache,row){
  emitRuntimePhase('loading-onnx-session',{artifact:row.path});
  const bytes=await cachedBytes(cache,row);
  try{return await ort.InferenceSession.create(bytes,sessionOptions(row))}
  catch(error){throw Object.assign(new Error(`Parakeet ${row.path} session could not start: ${clean(error?.message||error,700)}`),{code:'PARAKEET_ONNX_SESSION_CREATE_FAILED',artifact:row.path,cause:error})}
}

function parseTokens(text){
  const tokens=[];
  for(const raw of String(text||'').split(/\r?\n/)){
    const line=raw.trim();if(!line)continue;
    const match=line.match(/^(.*)\s+(\d+)$/);if(!match)continue;
    tokens[Number(match[2])]=match[1];
  }
  if(!tokens.length||tokens[tokens.length-1]!=='<blk>')throw new Error('Parakeet tokens.txt is invalid or does not end with <blk>.');
  return tokens;
}
function decodeTokens(tokens,ids){
  const text=ids.map(id=>tokens[id]||'').filter(piece=>piece&&piece!=='<blk>').join('').replace(/▁/g,' ').replace(/\s+/g,' ').trim();
  return text;
}

function melScaleSlaney(freq){return freq<=1000?freq*3/200:15+14.545078505785561*Math.log(freq/1000)}
function inverseMelScaleSlaney(mel){return mel<=15?(200/3)*mel:1000*Math.exp((mel-15)*0.06875177742094911)}
function makeMelFilters(){
  const filters=[];
  const lowMel=melScaleSlaney(0),highMel=melScaleSlaney(SAMPLE_RATE/2),delta=(highMel-lowMel)/(MEL_BINS+1),binWidth=SAMPLE_RATE/FFT_SIZE;
  for(let bin=0;bin<MEL_BINS;bin+=1){
    const left=inverseMelScaleSlaney(lowMel+bin*delta),center=inverseMelScaleSlaney(lowMel+(bin+1)*delta),right=inverseMelScaleSlaney(lowMel+(bin+2)*delta),norm=2/(right-left);
    let first=-1,last=-1;const weights=[];
    for(let i=0;i<=FFT_SIZE/2;i+=1){
      const hz=binWidth*i;if(!(hz>left&&hz<right))continue;
      const weight=(hz<=center?(hz-left)/(center-left):(right-hz)/(right-center))*norm;
      if(first<0)first=i;last=i;weights[i-first]=weight;
    }
    filters.push({first,last,weights:Float32Array.from(weights)});
  }
  return filters;
}
const MEL_FILTERS=makeMelFilters();
const HANN=Float32Array.from({length:FRAME_LENGTH},(_,i)=>0.5-0.5*Math.cos(2*Math.PI*i/(FRAME_LENGTH-1)));

function fftRadix2(real,imag){
  const n=real.length;
  for(let i=1,j=0;i<n;i+=1){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let tmp=real[i];real[i]=real[j];real[j]=tmp;tmp=imag[i];imag[i]=imag[j];imag[j]=tmp}}
  for(let len=2;len<=n;len<<=1){
    const angle=-2*Math.PI/len,wr0=Math.cos(angle),wi0=Math.sin(angle);
    for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j+=1){const even=i+j,odd=even+len/2,or=real[odd]*wr-imag[odd]*wi,oi=real[odd]*wi+imag[odd]*wr,er=real[even],ei=imag[even];real[even]=er+or;imag[even]=ei+oi;real[odd]=er-or;imag[odd]=ei-oi;const nextWr=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=nextWr}}
  }
}
function computeFbank(samples){
  const frameCount=Math.max(1,1+Math.floor((Math.max(samples.length,FRAME_LENGTH)-FRAME_LENGTH)/FRAME_SHIFT));
  const features=new Float32Array(frameCount*MEL_BINS),real=new Float32Array(FFT_SIZE),imag=new Float32Array(FFT_SIZE),power=new Float32Array(FFT_SIZE/2+1);
  for(let frame=0;frame<frameCount;frame+=1){
    const start=frame*FRAME_SHIFT;real.fill(0);imag.fill(0);
    let previous=Number(samples[start]||0);
    for(let i=0;i<FRAME_LENGTH;i+=1){const raw=Number(samples[start+i]||0),value=i===0?raw-0.97*raw:raw-0.97*previous;previous=raw;real[i]=value*HANN[i]}
    fftRadix2(real,imag);
    for(let i=0;i<power.length;i+=1)power[i]=real[i]*real[i]+imag[i]*imag[i];
    for(let mel=0;mel<MEL_BINS;mel+=1){const filter=MEL_FILTERS[mel];let energy=0;if(filter.first>=0){for(let i=filter.first;i<=filter.last;i+=1)energy+=power[i]*filter.weights[i-filter.first]}features[frame*MEL_BINS+mel]=Math.log(Math.max(energy,EPSILON))}
  }
  for(let mel=0;mel<MEL_BINS;mel+=1){
    let mean=0;for(let frame=0;frame<frameCount;frame+=1)mean+=features[frame*MEL_BINS+mel];mean/=frameCount;
    let variance=0;for(let frame=0;frame<frameCount;frame+=1){const delta=features[frame*MEL_BINS+mel]-mean;variance+=delta*delta}variance/=frameCount;
    const inv=1/(Math.sqrt(Math.max(0,variance))+1e-5);for(let frame=0;frame<frameCount;frame+=1)features[frame*MEL_BINS+mel]=(features[frame*MEL_BINS+mel]-mean)*inv;
  }
  return{features,frames:frameCount};
}
async function resampleTo16k(samples,inputRate){
  if(!samples?.length)return new Float32Array(0);
  if(Math.abs(Number(inputRate)-SAMPLE_RATE)<1)return Float32Array.from(samples);
  const length=Math.max(1,Math.ceil(samples.length*SAMPLE_RATE/Number(inputRate||SAMPLE_RATE)));
  if(typeof OfflineAudioContext==='function'){
    const context=new OfflineAudioContext(1,length,SAMPLE_RATE),buffer=context.createBuffer(1,samples.length,Number(inputRate));buffer.copyToChannel(Float32Array.from(samples),0);const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.start();const rendered=await context.startRendering();return Float32Array.from(rendered.getChannelData(0));
  }
  const output=new Float32Array(length),ratio=Number(inputRate)/SAMPLE_RATE;
  for(let i=0;i<length;i+=1){const position=i*ratio,left=Math.floor(position),right=Math.min(samples.length-1,left+1),mix=position-left;output[i]=samples[left]*(1-mix)+samples[right]*mix}
  return output;
}
function appendTail(samples){const output=new Float32Array(samples.length+SAMPLE_RATE*2);output.set(samples);return output}
function transposeFeatures(features,frames){const output=new Float32Array(MEL_BINS*frames);for(let t=0;t<frames;t+=1)for(let c=0;c<MEL_BINS;c+=1)output[c*frames+t]=features[t*MEL_BINS+c];return output}

function metaByName(session,name){return Array.from(session.inputMetadata||[]).find(item=>item?.name===name)||null}
function makeZeroTensor(ort,meta){
  const type=meta?.type||'float32',dims=concreteShape(meta?.shape||[1]),size=Math.max(1,product(dims));
  if(type==='float64')return new ort.Tensor('float64',new Float64Array(size),dims);
  if(type==='int64')return new ort.Tensor('int64',new BigInt64Array(size),dims);
  if(type==='int32')return new ort.Tensor('int32',new Int32Array(size),dims);
  return new ort.Tensor('float32',new Float32Array(size),dims);
}
function makeIntegerTensor(ort,type,values,dims){const normalized=type==='int64'?'int64':'int32';return new ort.Tensor(normalized,typedInteger(normalized,values),dims)}

class ParakeetRuntime{
  constructor({ort,encoder,decoder,joiner,tokens}){this.ort=ort;this.encoder=encoder;this.decoder=decoder;this.joiner=joiner;this.tokens=tokens;this.blank=tokens.length-1}
  initialStates(){return this.decoder.inputNames.slice(2).map(name=>makeZeroTensor(this.ort,metaByName(this.decoder,name)))}
  async runDecoder(token,states){
    const feeds={},targetName=this.decoder.inputNames[0],lengthName=this.decoder.inputNames[1],targetMeta=metaByName(this.decoder,targetName),lengthMeta=metaByName(this.decoder,lengthName);
    feeds[targetName]=makeIntegerTensor(this.ort,targetMeta?.type||'int32',[token],[1,1]);feeds[lengthName]=makeIntegerTensor(this.ort,lengthMeta?.type||'int32',[1],[1]);
    for(let i=2;i<this.decoder.inputNames.length;i+=1)feeds[this.decoder.inputNames[i]]=states[i-2];
    const outputs=await this.decoder.run(feeds),decoderOutput=outputs[this.decoder.outputNames[0]],nextStates=this.decoder.outputNames.slice(2).map(name=>outputs[name]);
    if(!decoderOutput||nextStates.some(state=>!state))throw new Error('Parakeet decoder returned incomplete recurrent state.');
    return{output:decoderOutput,nextStates};
  }
  async transcribe(samples,inputRate=SAMPLE_RATE){
    const resampled=await resampleTo16k(samples,inputRate);if(resampled.length<SAMPLE_RATE/5)return'';
    const padded=appendTail(resampled),{features,frames}=computeFbank(padded),input=transposeFeatures(features,frames),lengthName=this.encoder.inputNames[1],lengthMeta=metaByName(this.encoder,lengthName);
    const encoderFeeds={};encoderFeeds[this.encoder.inputNames[0]]=new this.ort.Tensor('float32',input,[1,MEL_BINS,frames]);encoderFeeds[lengthName]=makeIntegerTensor(this.ort,lengthMeta?.type||'int64',[frames],[1]);
    const encoderOutputs=await this.encoder.run(encoderFeeds),encoded=encoderOutputs[this.encoder.outputNames[0]],encodedLength=encoderOutputs[this.encoder.outputNames[1]];
    if(!encoded||encoded.dims.length!==3||encoded.dims[0]!==1)throw new Error(`Unexpected Parakeet encoder output shape: [${encoded?.dims?.join?.(', ')||''}].`);
    const channels=encoded.dims[1],time=encoded.dims[2],limit=Math.min(time,tensorLength(encodedLength,time)),ids=[];
    let states=this.initialStates(),prediction=await this.runDecoder(this.blank,states),t=0,tokensThisFrame=0;
    while(t<limit){
      const frame=new Float32Array(channels);for(let c=0;c<channels;c+=1)frame[c]=Number(encoded.data[c*time+t]);
      const joinerFeeds={};joinerFeeds[this.joiner.inputNames[0]]=new this.ort.Tensor('float32',frame,[1,channels,1]);joinerFeeds[this.joiner.inputNames[1]]=prediction.output;
      const joinerOutputs=await this.joiner.run(joinerFeeds),logits=joinerOutputs[this.joiner.outputNames[0]];if(!logits)throw new Error('Parakeet joiner returned no logits.');
      const vocabSize=this.tokens.length,outputSize=logits.data.length;if(outputSize<=vocabSize)throw new Error(`Parakeet TDT joiner has no duration logits (${outputSize} <= ${vocabSize}).`);
      const token=argmax(logits.data,0,vocabSize),skip=argmax(logits.data,vocabSize,outputSize);
      let advance=skip;
      if(token!==this.blank){ids.push(token);states=prediction.nextStates;prediction=await this.runDecoder(token,states);tokensThisFrame+=1}
      if(advance>0)tokensThisFrame=0;
      if(tokensThisFrame>=MAX_TOKENS_PER_FRAME){tokensThisFrame=0;advance=1}
      if(token===this.blank&&advance===0){tokensThisFrame=0;advance=1}
      t+=advance;
      if(ids.length>4096)break;
      if((t&31)===0)await sleep(0);
    }
    return decodeTokens(this.tokens,ids);
  }
}

async function loadRuntime(){
  if(runtimePromise)return runtimePromise;
  runtimePromise=(async()=>{
    emitRuntimePhase('loading-model-pack');
    const {rows,cacheName}=await modelRows(),cache=await caches.open(cacheName),ort=await loadOrt();
    const tokensResponse=await cachedResponse(cache,rows.get('tokens.txt')),tokens=parseTokens(await tokensResponse.text());
    const encoder=await createCachedSession(ort,cache,rows.get('encoder.int8.onnx'));
    const decoder=await createCachedSession(ort,cache,rows.get('decoder.int8.onnx'));
    const joiner=await createCachedSession(ort,cache,rows.get('joiner.int8.onnx'));
    emitRuntimePhase('model-ready');
    return new ParakeetRuntime({ort,encoder,decoder,joiner,tokens});
  })().catch(error=>{runtimePromise=null;emitRuntimePhase('model-error',{error:clean(error?.message||error,800),code:error?.code||'PARAKEET_RUNTIME_LOAD_FAILED',artifact:error?.artifact||''});throw error});
  return runtimePromise;
}

function concatChunks(chunks,total){const output=new Float32Array(total);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length}return output}
async function startMicrophone(payload={}){
  if(currentSession?.stop)currentSession.stop();
  if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error('Microphone capture is unavailable in this browser.'),{code:'LOCAL_MICROPHONE_UNAVAILABLE'});
  const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}),AudioCtx=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!AudioCtx){stream.getTracks().forEach(track=>track.stop());throw Object.assign(new Error('Web Audio capture is unavailable in this browser.'),{code:'LOCAL_AUDIO_RUNTIME_UNAVAILABLE'})}
  let context=null;
  try{
    context=new AudioCtx();
    if(context.state==='suspended')await context.resume();
    emitRuntimePhase('microphone-ready');
    const runtime=await loadRuntime();
    if(typeof context.createScriptProcessor!=='function')throw Object.assign(new Error('This browser does not expose a compatible local PCM capture node.'),{code:'LOCAL_AUDIO_PCM_CAPTURE_UNAVAILABLE'});
    const source=context.createMediaStreamSource(stream),processor=context.createScriptProcessor(4096,1,1),sink=context.createGain();sink.gain.value=0;source.connect(processor);processor.connect(sink);sink.connect(context.destination);
    let stopped=false,speaking=false,silenceSamples=0,utterance=[],utteranceSamples=0,preRoll=[],preRollSamples=0,noiseFloor=0.003,queue=Promise.resolve();
    const inputRate=context.sampleRate,preRollLimit=Math.round(inputRate*0.25),silenceLimit=Math.round(inputRate*0.65),maxUtterance=Math.round(inputRate*20),minUtterance=Math.round(inputRate*0.2),onTranscript=typeof payload.onTranscript==='function'?payload.onTranscript:()=>{};
    const flush=()=>{
      if(utteranceSamples<minUtterance){utterance=[];utteranceSamples=0;return}
      const samples=concatChunks(utterance,utteranceSamples);utterance=[];utteranceSamples=0;
      queue=queue.then(async()=>{if(stopped)return;const text=clean(await runtime.transcribe(samples,inputRate),12000);if(text)onTranscript({text,transcript:text,final:true,source:MODEL_ID,modelId:MODEL_ID})}).catch(error=>{try{dispatchEvent(new CustomEvent('civweave:guide-voice-state',{detail:{error:clean(error?.message||error,800),code:error?.code||'PARAKEET_LOCAL_TRANSCRIPTION_FAILED',source:MODEL_ID}}))}catch{}});
    };
    processor.onaudioprocess=event=>{
      if(stopped)return;const input=event.inputBuffer.getChannelData(0),chunk=Float32Array.from(input);let sum=0;for(let i=0;i<chunk.length;i+=1)sum+=chunk[i]*chunk[i];const rms=Math.sqrt(sum/Math.max(1,chunk.length)),threshold=Math.max(0.008,noiseFloor*3.25);
      if(!speaking)noiseFloor=Math.max(0.0008,Math.min(0.02,noiseFloor*0.985+rms*0.015));
      preRoll.push(chunk);preRollSamples+=chunk.length;while(preRollSamples>preRollLimit&&preRoll.length>1)preRollSamples-=preRoll.shift().length;
      if(!speaking&&rms>=threshold){speaking=true;silenceSamples=0;utterance=preRoll.splice(0);utteranceSamples=preRollSamples;preRollSamples=0}
      if(!speaking)return;
      utterance.push(chunk);utteranceSamples+=chunk.length;
      if(rms<threshold*0.72)silenceSamples+=chunk.length;else silenceSamples=0;
      if(silenceSamples>=silenceLimit||utteranceSamples>=maxUtterance){speaking=false;silenceSamples=0;flush()}
    };
    const session={source:MODEL_ID,modelId:MODEL_ID,stop(){if(stopped)return;stopped=true;try{processor.disconnect()}catch{}try{source.disconnect()}catch{}try{sink.disconnect()}catch{}for(const track of stream.getTracks())try{track.stop()}catch{}try{context.close()}catch{}if(currentSession===session)currentSession=null},abort(){this.stop()}};
    currentSession=session;emitRuntimePhase('listening');return session;
  }catch(error){for(const track of stream.getTracks())try{track.stop()}catch{}try{context?.close?.()}catch{}throw error}
}

async function executor(payload={},context={}){
  if(clean(context?.model?.id||context?.plan?.selected||MODEL_ID,120)!==MODEL_ID&&context?.model?.id)throw Object.assign(new Error(`Unsupported Parakeet executor model: ${context.model.id}`),{code:'LOCAL_SPECIALIZED_EXECUTOR_MODEL_UNSUPPORTED'});
  const mode=clean(payload.mode||'realtime',40)||'realtime';
  if(mode==='realtime'||mode==='microphone'||mode==='dictation')return startMicrophone(payload);
  if(payload.samples){const runtime=await loadRuntime(),text=await runtime.transcribe(payload.samples,Number(payload.sampleRate)||SAMPLE_RATE);return{text,transcript:text,final:true,source:MODEL_ID,modelId:MODEL_ID}}
  throw Object.assign(new Error(`Unsupported Parakeet speech mode: ${mode}`),{code:'LOCAL_SPECIALIZED_EXECUTOR_MODE_UNSUPPORTED'});
}
function register(){
  const specialized=globalThis.CivweaveLocalSpecializedAI;if(!specialized?.registerExecutor)return false;
  specialized.registerExecutor(MODEL_ID,executor,{kind:'speech-recognition',offline:true,modelId:MODEL_ID,runtime:'onnxruntime-web',decoder:'nemo-tdt-greedy'});return true;
}

const api=Object.freeze({version:VERSION,modelId:MODEL_ID,register,loadRuntime,executor,computeFbank,decodeTokens});
globalThis.CivweaveParakeetSpeechExecutorV1=api;
const registered=register();
try{dispatchEvent(new CustomEvent('civweave:parakeet-speech-executor-ready',{detail:{version:VERSION,modelId:MODEL_ID,registered}}))}catch{}
})();