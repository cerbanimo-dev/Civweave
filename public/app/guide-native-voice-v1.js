(()=>{
'use strict';
const VERSION='1.0.0-guide-native-voice-v1';
const GEMINI_MODEL='gemini-3.1-flash-live-preview';
const TOKEN_URL='https://generativelanguage.googleapis.com/v1beta/auth_tokens';
const WS_BASE='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
if(globalThis.CivweaveGuideNativeVoiceV1?.version===VERSION)return;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(`civweave:native-voice-${type}`,{detail:{version:VERSION,...detail}}))}catch{}};
const selectedLocal=()=>{try{const value=JSON.parse(localStorage.getItem('civweave.local-ai.selection.v266')||'{}');return value?.active&&value?.id?value:null}catch{return null}};
const localSpec=()=>{const selected=selectedLocal();return selected?.id?globalThis.CivweaveLocalModelRegistryV266?.byId?.(selected.id)||null:null};
const modelConfig=()=>{try{return globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive')||null}catch{return null}};
const gemmaSelected=()=>/^gemma4-(?:e2b|e4b)-/i.test(clean(selectedLocal()?.id,180));
const runtimeStage=()=>{const version=clean(globalThis.CivweaveTransformersV4Stage?.version||globalThis.__CIVWEAVE_TRANSFORMERS_V4_VERSION||'',40);return version};
const hasMedia=()=>Boolean(navigator.mediaDevices?.getUserMedia&&(globalThis.AudioContext||globalThis.webkitAudioContext));
function gemmaReadiness(){
  const spec=localSpec(),runtime=globalThis.CivweaveLocalModelRuntimeV266;
  if(!gemmaSelected())return{eligible:false,available:false,reason:'selected-model-is-not-gemma4-e2b-or-e4b'};
  if(!spec)return{eligible:true,available:false,reason:'selected-gemma-model-spec-is-unavailable'};
  if(typeof runtime?.generateAudio!=='function')return{eligible:true,available:false,reason:'gemma4-native-audio-awaits-transformers-js-4.3',runtime:runtimeStage()||'4.2.0'};
  return{eligible:true,available:hasMedia(),reason:hasMedia()?'ready':'microphone-capture-unavailable',model:spec.id};
}
function geminiReadiness(){
  const config=modelConfig(),provider=clean(config?.provider||config?.route,80).toLowerCase();
  if(provider!=='gemini')return{eligible:false,available:false,reason:'interactive-provider-is-not-gemini'};
  if(!config?.apiKey)return{eligible:true,available:false,reason:'gemini-session-key-missing'};
  if(!config?.externalConsent)return{eligible:true,available:false,reason:'gemini-external-consent-required'};
  if(!hasMedia()||typeof WebSocket!=='function')return{eligible:true,available:false,reason:'browser-live-audio-unavailable'};
  return{eligible:true,available:navigator.onLine!==false,reason:navigator.onLine===false?'offline':'ready',model:GEMINI_MODEL};
}
function support(){return Object.freeze({media:hasMedia(),gemma:gemmaReadiness(),gemini:geminiReadiness()})}
function route({prefer='auto'}={}){
  const gemma=gemmaReadiness(),gemini=geminiReadiness(),choice=clean(prefer,40).toLowerCase();
  if(choice==='gemma'&&gemma.available)return'gemma-native';
  if(choice==='gemini'&&gemini.available)return'gemini-live';
  if(choice==='device')return'device';
  if(gemma.available)return'gemma-native';
  if(gemini.available)return'gemini-live';
  return'device';
}
function toBase64(bytes){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+chunk)));return btoa(binary)}
function fromBase64(value){const binary=atob(value||''),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function downsample(input,inputRate,targetRate=16000){
  if(inputRate===targetRate)return input;
  const ratio=inputRate/targetRate,length=Math.max(1,Math.round(input.length/ratio)),out=new Float32Array(length);
  for(let i=0;i<length;i++){const start=Math.floor(i*ratio),end=Math.min(input.length,Math.floor((i+1)*ratio));let sum=0,count=0;for(let j=start;j<end;j++){sum+=input[j];count++}out[i]=count?sum/count:0}
  return out;
}
function floatToPcm16(input){const out=new Uint8Array(input.length*2),view=new DataView(out.buffer);for(let i=0;i<input.length;i++){const sample=Math.max(-1,Math.min(1,input[i]));view.setInt16(i*2,sample<0?sample*0x8000:sample*0x7fff,true)}return out}
function concatFloat(chunks){let length=0;for(const item of chunks)length+=item.length;const out=new Float32Array(length);let offset=0;for(const item of chunks){out.set(item,offset);offset+=item.length}return out}
async function createCapture({onChunk,maxSeconds=30}={}){
  const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext,context=new AC({latencyHint:'interactive'}),source=context.createMediaStreamSource(stream),processor=context.createScriptProcessor(2048,1,1);let stopped=false,seconds=0;
  processor.onaudioprocess=event=>{if(stopped)return;const data=new Float32Array(event.inputBuffer.getChannelData(0)),normalized=downsample(data,context.sampleRate,16000);seconds+=normalized.length/16000;if(seconds<=maxSeconds)onChunk?.(normalized);if(seconds>=maxSeconds)stop()};
  source.connect(processor);processor.connect(context.destination);
  function stop(){if(stopped)return;stopped=true;processor.onaudioprocess=null;try{source.disconnect()}catch{}try{processor.disconnect()}catch{}for(const track of stream.getTracks())try{track.stop()}catch{};void context.close?.()}
  return{stop,get seconds(){return seconds},sampleRate:16000};
}
class PcmPlayer{
  constructor(){this.context=null;this.nextTime=0;this.sources=new Set()}
  async ensure(){if(this.context)return this.context;const AC=globalThis.AudioContext||globalThis.webkitAudioContext;this.context=new AC({sampleRate:24000,latencyHint:'interactive'});await this.context.resume?.();return this.context}
  async push(bytes){const context=await this.ensure(),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),samples=new Float32Array(Math.floor(bytes.byteLength/2));for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;const buffer=context.createBuffer(1,samples.length,24000);buffer.copyToChannel(samples,0);const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.onended=()=>this.sources.delete(source);this.sources.add(source);const when=Math.max(context.currentTime+.015,this.nextTime);source.start(when);this.nextTime=when+buffer.duration}
  stop(){for(const source of this.sources)try{source.stop()}catch{};this.sources.clear();this.nextTime=0}
  async close(){this.stop();try{await this.context?.close?.()}catch{}this.context=null}
}
async function ephemeralToken(config,systemInstruction){
  const expires=new Date(Date.now()+20*60*1000).toISOString();
  const body={uses:1,expireTime:expires,liveConnectConstraints:{model:`models/${GEMINI_MODEL}`,config:{responseModalities:['AUDIO'],sessionResumption:{},systemInstruction:{parts:[{text:systemInstruction}]}}}};
  const response=await fetch(TOKEN_URL,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':config.apiKey},body:JSON.stringify(body),cache:'no-store',credentials:'omit'}),payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload?.name)throw Object.assign(new Error(clean(payload?.error?.message||`Gemini auth token returned HTTP ${response.status}.`,1000)),{code:'GEMINI_LIVE_TOKEN_FAILED',status:response.status});
  return payload.name;
}
function guideInstruction({guideName='Civweave guide',guideRole='',system='civweave',language='en-US'}={}){return`You are ${clean(guideName,80)}, ${clean(guideRole,180)} in Civweave (${clean(system,80)}). Respond naturally for voice conversation. Preserve user control. Be concise unless detail is needed. Speak in the user's language (preferred locale ${clean(language,40)}). Do not claim actions were completed unless the Civweave application actually confirms them.`}
async function startGeminiLive(options={}){
  const ready=geminiReadiness();if(!ready.available)throw Object.assign(new Error(`Gemini Live is unavailable: ${ready.reason}.`),{code:'GEMINI_LIVE_UNAVAILABLE',reason:ready.reason});
  const config=modelConfig(),instruction=guideInstruction(options),token=await ephemeralToken(config,instruction),url=`${WS_BASE}?access_token=${encodeURIComponent(token)}`,socket=new WebSocket(url),player=new PcmPlayer();
  let capture=null,closed=false,setup=false,stopping=false,inputText='',outputText='',resolveDone,rejectDone;const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject});
  const finish=(reason='complete')=>{if(closed)return;closed=true;capture?.stop?.();capture=null;try{socket.close(1000,'done')}catch{};resolveDone({route:'gemini-live',provider:'gemini-live',model:GEMINI_MODEL,inputText:clean(inputText,12000),outputText:clean(outputText,12000),nativeAudio:true,reason})};
  const fail=error=>{if(closed)return;closed=true;capture?.stop?.();capture=null;player.stop();try{socket.close()}catch{};rejectDone(error instanceof Error?error:new Error(String(error)))};
  socket.onopen=()=>{const setupMessage={setup:{model:`models/${GEMINI_MODEL}`,responseModalities:['AUDIO'],systemInstruction:{parts:[{text:instruction}]},inputAudioTranscription:{},outputAudioTranscription:{},generationConfig:{thinkingConfig:{thinkingLevel:'MINIMAL'}},contextWindowCompression:{triggerTokens:25000,slidingWindow:{targetTokens:8000}},sessionResumption:{}}};socket.send(JSON.stringify(setupMessage));emit('gemini-connected',{model:GEMINI_MODEL})};
  socket.onerror=()=>fail(Object.assign(new Error('Gemini Live WebSocket failed.'),{code:'GEMINI_LIVE_SOCKET_ERROR'}));
  socket.onclose=event=>{if(!closed&&event.code!==1000)fail(Object.assign(new Error(`Gemini Live closed (${event.code}).`),{code:'GEMINI_LIVE_SOCKET_CLOSED'}))};
  socket.onmessage=async event=>{let message={};try{message=JSON.parse(event.data)}catch{return}
    if(message.setupComplete){setup=true;options.onStatus?.('Gemini Live is listening…');try{capture=await createCapture({maxSeconds:Math.min(30,Number(options.maxSeconds)||30),onChunk:chunk=>{if(socket.readyState!==WebSocket.OPEN||!setup||stopping)return;const pcm=floatToPcm16(chunk);socket.send(JSON.stringify({realtimeInput:{audio:{data:toBase64(pcm),mimeType:'audio/pcm;rate=16000'}}}))}});options.onListening?.(true)}catch(error){fail(error)};return}
    const content=message.serverContent;if(content){
      if(content.interrupted){player.stop();options.onInterrupted?.();emit('gemini-interrupted',{})}
      if(content.inputTranscription?.text){inputText+=content.inputTranscription.text;options.onInputTranscript?.(clean(inputText,12000))}
      if(content.outputTranscription?.text){outputText+=content.outputTranscription.text;options.onOutputTranscript?.(clean(outputText,12000))}
      for(const part of content.modelTurn?.parts||[]){const inline=part?.inlineData;if(inline?.data&&/audio\/pcm/i.test(inline.mimeType||'')){try{await player.push(fromBase64(inline.data));options.onAudio?.()}catch{}}}
      if(content.turnComplete)finish('turn-complete');
    }
  };
  const stop=async()=>{if(closed||stopping)return done;stopping=true;capture?.stop?.();capture=null;options.onListening?.(false);if(socket.readyState===WebSocket.OPEN){try{socket.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}))}catch{}};const timeout=Date.now()+15000;while(!closed&&Date.now()<timeout)await sleep(100);if(!closed)finish('stop-timeout');return done};
  const cancel=async(reason='cancelled')=>{if(closed)return;closed=true;capture?.stop?.();capture=null;player.stop();await player.close();try{socket.close(1000,reason)}catch{};resolveDone({route:'gemini-live',provider:'gemini-live',model:GEMINI_MODEL,inputText:'',outputText:'',nativeAudio:true,discarded:true,reason})};
  return{route:'gemini-live',model:GEMINI_MODEL,done,stop,cancel,stopPlayback:()=>player.stop()};
}
async function startGemmaNative(options={}){
  const ready=gemmaReadiness();if(!ready.available)throw Object.assign(new Error(`Native Gemma audio is unavailable: ${ready.reason}.`),{code:'GEMMA4_NATIVE_AUDIO_UNAVAILABLE',reason:ready.reason});
  const chunks=[];let capture=await createCapture({maxSeconds:Math.min(30,Number(options.maxSeconds)||30),onChunk:chunk=>{chunks.push(chunk);options.onLevel?.(chunk)}}),closed=false,resolveDone,rejectDone;const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject});options.onListening?.(true);
  const stop=async()=>{if(closed)return done;closed=true;capture?.stop?.();capture=null;options.onListening?.(false);try{const runtime=globalThis.CivweaveLocalModelRuntimeV266,audio=concatFloat(chunks),result=await runtime.generateAudio({audio,sampleRate:16000,maxSeconds:30,language:options.language||'en-US',mode:'transcribe'}),inputText=clean(result?.text||result?.outputText,12000);resolveDone({route:'gemma-native',provider:'downloaded-local',model:ready.model,inputText,outputText:'',nativeAudio:false})}catch(error){rejectDone(error)}return done};
  const cancel=async(reason='cancelled')=>{if(closed)return;closed=true;capture?.stop?.();capture=null;options.onListening?.(false);resolveDone({route:'gemma-native',provider:'downloaded-local',model:ready.model,inputText:'',outputText:'',discarded:true,reason})};
  return{route:'gemma-native',model:ready.model,done,stop,cancel,stopPlayback:()=>{}};
}
async function start(options={}){const selected=route({prefer:options.prefer||'auto'});if(selected==='gemini-live')return startGeminiLive(options);if(selected==='gemma-native')return startGemmaNative(options);return null}
const api=Object.freeze({version:VERSION,model:GEMINI_MODEL,support,route,start,startGeminiLive,startGemmaNative,geminiReadiness,gemmaReadiness});
globalThis.CivweaveGuideNativeVoiceV1=api;emit('ready',{support:support()});
})();