(()=>{
'use strict';

const VERSION='1.1.5-guide-voice-runtime-v1-parakeet-output-shapes';
if(globalThis.CivweaveGuideVoiceV1?.version===VERSION)return;
const SETTINGS_KEY='civweave.guide-voice.v1';
const GUIDE=Object.freeze({weaveling:'civweave',moss:'living-school',kamiya:'cerbanimo',rook:'fellowfare',merlin:'anarchadia'});
const SYSTEMS=Object.freeze(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const SPEECH_MODELS=Object.freeze([
  Object.freeze({id:'parakeet-tdt-0.6b-v3-int8',label:'Parakeet TDT 0.6B v3 INT8',need:Object.freeze(['encoder.int8.onnx','decoder.int8.onnx','joiner.int8.onnx','tokens.txt'])}),
  Object.freeze({id:'parakeet-tdt-0.6b-v3-fp32',label:'Parakeet TDT 0.6B v3',need:Object.freeze(['encoder.onnx','decoder.onnx','joiner.onnx','tokens.txt'])}),
  Object.freeze({id:'omnilingual-asr-300m-int8',label:'Omnilingual ASR 300M INT8',need:Object.freeze(['model.int8.onnx','tokens.txt'])}),
  Object.freeze({id:'omnilingual-asr-1b-int8',label:'Omnilingual ASR 1B INT8',need:Object.freeze(['model.int8.onnx','tokens.txt'])})
]);
const MODEL_PACKS_PATH='/app/local-ai/model-packs-v1.js?v=1.0.1';
const SPEECH_EXECUTOR_VERSION='1.0.4-parakeet-speech-executor-v1-output-shape-routing';
const SPEECH_EXECUTOR_PATH='/app/local-ai/parakeet-speech-executor-v1.js?v=1.0.4';
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
let listening=false,recognition=null,sessionSource='',lastInterim='',speaking=false,executorLoad=null,packRuntimeLoad=null,lastSpecializedError=null;

function settings(){let value={};try{value=parse(localStorage.getItem(SETTINGS_KEY),{})}catch{}return{language:clean(value.language||navigator.language||'en-US',40)||'en-US',autoSpeak:value.autoSpeak!==false,continuous:value.continuous!==false}}
function saveSettings(patch={}){const next={...settings(),...patch};try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(next))}catch{}return next}
function resolveAddress(text,{allowBare=true}={}){
  const value=clean(text);if(!value)return{system:'',guide:'',text:'',addressed:false};
  const names=Object.keys(GUIDE).join('|');
  const pattern=allowBare?new RegExp(`^\\s*(?:(?:hey|hi|hello|ok|okay)\\s+)?(${names})\\b[\\s,:;.!?-]*(.*)$`,'i'):new RegExp(`^\\s*(?:hey|hi|hello|ok|okay)\\s+(${names})\\b[\\s,:;.!?-]*(.*)$`,'i');
  const match=value.match(pattern);if(!match)return{system:'',guide:'',text:value,addressed:false};
  const guide=match[1].toLowerCase(),system=GUIDE[guide]||'',remainder=clean(match[2]);
  return{system,guide,text:remainder,addressed:Boolean(system)};
}
function chat(){return globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215||null}
async function routeTranscript(text,{final=true,allowBare=true,submit=final}={}){
  const value=clean(text);if(!value)return false;const addressed=resolveAddress(value,{allowBare}),surface=chat();if(!surface)return false;
  if(addressed.addressed){surface.switchGuide?.(addressed.system,{open:true,focus:false});if(!addressed.text)return true;if(submit)return surface.submitVoiceText?.(addressed.text,addressed.system)||surface.submitText?.(addressed.text,addressed.system);return true}
  if(submit)return surface.submitVoiceText?.(value,surface.activeWindow?.()||undefined)||surface.submitText?.(value);
  return true;
}
function emitState(extra={}){const detail={version:VERSION,listening,source:sessionSource,language:settings().language,autoSpeak:settings().autoSpeak,...extra};try{dispatchEvent(new CustomEvent('civweave:guide-voice-state',{detail}))}catch{}return detail}
function onTranscript(detail={}){const text=clean(detail.text||detail.transcript);if(!text)return;const final=detail.final!==false;lastInterim=final?'':text;try{dispatchEvent(new CustomEvent('civweave:guide-voice-transcript',{detail:{text,final,source:detail.source||sessionSource||'local-specialized'}}))}catch{}if(final)void routeTranscript(text,{final:true,allowBare:true,submit:true})}

function specialized(){return globalThis.CivweaveLocalSpecializedAI||null}
async function ensureModelPackRuntime(){
  let packs=globalThis.CivweaveLocalModelPacksV1;
  if(packs?.specializedStatus)return packs;
  if(!packRuntimeLoad)packRuntimeLoad=import(MODEL_PACKS_PATH).then(()=>globalThis.CivweaveLocalModelPacksV1).catch(error=>{packRuntimeLoad=null;throw error});
  packs=await packRuntimeLoad;
  if(!packs?.specializedStatus)throw Object.assign(new Error('Civweave local model packs could not be loaded for offline speech.'),{code:'LOCAL_MODEL_PACK_RUNTIME_UNAVAILABLE'});
  return packs;
}
async function ensureSpeechExecutor(){
  await ensureModelPackRuntime();
  if(globalThis.CivweaveParakeetSpeechExecutorV1?.version===SPEECH_EXECUTOR_VERSION&&globalThis.CivweaveParakeetSpeechExecutorV1?.register){globalThis.CivweaveParakeetSpeechExecutorV1.register();return true}
  if(!executorLoad)executorLoad=import(SPEECH_EXECUTOR_PATH).then(()=>{globalThis.CivweaveParakeetSpeechExecutorV1?.register?.();return globalThis.CivweaveParakeetSpeechExecutorV1?.version===SPEECH_EXECUTOR_VERSION}).catch(error=>{executorLoad=null;throw error});
  const loaded=await executorLoad;
  if(!loaded)throw Object.assign(new Error('The corrected Civweave Parakeet speech executor did not load.'),{code:'PARAKEET_EXECUTOR_VERSION_MISMATCH'});
  return true;
}
async function executeSpecializedSpeech(runtime,language){return runtime.execute('speech-transcription',{mode:'realtime',language,onTranscript},{language})}
async function startSpecialized(options={}){
  const runtime=specialized();
  if(!runtime?.execute){lastSpecializedError=Object.assign(new Error('The Civweave specialized local-AI registry is not available.'),{code:'LOCAL_SPECIALIZED_REGISTRY_UNAVAILABLE'});return false}
  const language=options.language||settings().language;
  try{
    await ensureModelPackRuntime();
    await ensureSpeechExecutor();
    const result=await executeSpecializedSpeech(runtime,language);
    if(result?.stop||result?.session){lastSpecializedError=null;recognition=result;listening=true;sessionSource=result.source||'specialized-model';emitState();return true}
  }catch(error){lastSpecializedError=error;if(error?.code!=='LOCAL_SPECIALIZED_EXECUTOR_UNAVAILABLE')throw error}
  return false;
}
async function installedSpeechModelStatus(){
  const packApi=globalThis.CivweaveLocalModelPacksV1;
  if(packApi?.specializedStatus){
    for(const model of SPEECH_MODELS){
      try{const status=await packApi.specializedStatus(model.id);if(status?.available)return{installed:true,id:model.id,label:model.label,source:'pack-api'}}catch{}
    }
  }
  if(!globalThis.caches?.open)return{installed:false,id:'',label:'',source:'unavailable'};
  try{
    const cache=await caches.open(packApi?.cache||'civweave-specialized-model-packs-v1');
    const keys=await cache.keys();
    const urls=keys.map(request=>String(request?.url||request));
    for(const model of SPEECH_MODELS){
      const matching=urls.filter(url=>url.includes(model.id.split('-int8')[0])||url.includes(model.id.startsWith('parakeet')?'parakeet-tdt-0.6b-v3':'omnilingual-asr'));
      if(model.need.every(path=>matching.some(url=>url.endsWith('/'+path)||url.includes('/'+path+'?'))))return{installed:true,id:model.id,label:model.label,source:'cache'};
    }
  }catch{}
  return{installed:false,id:'',label:'',source:'cache'};
}
function SpeechRecognitionCtor(){return globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition||null}
async function ensureOnDeviceLanguage(Ctor,language){
  if(typeof Ctor.available!=='function')return'unknown';
  const options={langs:[language],processLocally:true,quality:'dictation'};let state=await Ctor.available(options);
  if(state==='available')return state;
  if((state==='downloadable'||state==='downloading')&&typeof Ctor.install==='function'){
    const installed=await Ctor.install(options);if(installed)state=await Ctor.available(options)
  }
  return state;
}
async function startWebSpeech(options={}){
  const Ctor=SpeechRecognitionCtor();if(!Ctor)return false;const language=options.language||settings().language;
  const localState=await ensureOnDeviceLanguage(Ctor,language).catch(()=> 'unknown');
  const instance=new Ctor();
  if(!('processLocally'in instance))throw Object.assign(new Error('This browser speech recognizer does not expose an on-device-only mode. Civweave will not send an offline voice session to a network speech service.'),{code:'ON_DEVICE_SPEECH_UNSUPPORTED'});
  instance.processLocally=true;
  if(localState==='unavailable')throw Object.assign(new Error(`On-device speech recognition is unavailable for ${language}. Civweave will not silently switch this offline voice session to cloud speech.`),{code:'ON_DEVICE_SPEECH_UNAVAILABLE'});
  instance.lang=language;instance.interimResults=true;instance.continuous=settings().continuous;instance.maxAlternatives=1;
  instance.onresult=event=>{for(let i=event.resultIndex;i<event.results.length;i++){const result=event.results[i],text=clean(result?.[0]?.transcript);if(text)onTranscript({text,final:Boolean(result.isFinal),source:'web-speech-on-device'})}};
  instance.onerror=event=>{emitState({error:clean(event?.error||event?.message||'speech recognition failed',500)})};
  instance.onend=()=>{if(recognition!==instance)return;recognition=null;listening=false;emitState({ended:true})};
  recognition=instance;sessionSource='web-speech-on-device';instance.start();listening=true;emitState({availability:localState});return true;
}
async function start(options={}){
  if(listening)return true;const language=options.language||settings().language;sessionSource='';lastSpecializedError=null;
  if(await startSpecialized({language}).catch(error=>{lastSpecializedError=error;emitState({error:clean(error?.message||error,800),code:error?.code||'LOCAL_SPECIALIZED_SPEECH_FAILED',artifact:error?.artifact||''});return false}))return true;
  if(await startWebSpeech({language}).catch(error=>{emitState({error:clean(error?.message||error,600),code:error?.code||''});return false}))return true;
  const installed=await installedSpeechModelStatus();
  if(installed.installed){
    const executorError=clean(lastSpecializedError?.message||'',800),executorCode=clean(lastSpecializedError?.code||'',120),artifact=clean(lastSpecializedError?.artifact||'',160);
    const message=executorError?`Your Civweave ${installed.label} speech model is installed, but its local speech session could not start. ${executorError}`:`Your Civweave ${installed.label} speech model is installed, but no compatible local speech-recognition session could start.`;
    const failure=Object.assign(new Error(message),{code:'CIVWEAVE_SPEECH_EXECUTOR_START_FAILED',modelId:installed.id,executorCode,executorError,artifact});
    emitState({error:message,code:failure.code,executorCode,executorError,artifact});
    throw failure;
  }
  throw Object.assign(new Error('No offline speech-recognition model or browser language pack is installed. Install a Civweave voice pack or an on-device browser language pack.'),{code:'OFFLINE_VOICE_RUNTIME_UNAVAILABLE'});
}
function stop(){const current=recognition;recognition=null;listening=false;lastInterim='';try{current?.stop?.()}catch{}try{current?.abort?.()}catch{}sessionSource='';emitState({stopped:true});return true}
async function toggle(options={}){if(listening){stop();return false}await start(options);return true}

async function speak(text,options={}){
  const value=clean(text,20000);if(!value||settings().autoSpeak===false)return false;
  try{const runtime=specialized();if(runtime?.execute){await runtime.execute('speech-synthesis',{text:value,language:options.language||settings().language,guide:options.guide||''},{language:options.language||settings().language});return true}}catch(error){if(error?.code!=='LOCAL_SPECIALIZED_EXECUTOR_UNAVAILABLE')emitState({ttsError:clean(error?.message||error,500)})}
  if(!globalThis.speechSynthesis||typeof SpeechSynthesisUtterance!=='function')return false;
  try{speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(value);utterance.lang=options.language||settings().language;speaking=true;utterance.onend=()=>{speaking=false;emitState({speaking:false})};utterance.onerror=()=>{speaking=false;emitState({speaking:false})};speechSynthesis.speak(utterance);emitState({speaking:true,source:'device-speech-synthesis'});return true}catch{return false}
}
function stopSpeaking(){try{speechSynthesis?.cancel?.()}catch{}speaking=false;emitState({speaking:false});return true}
function state(){return Object.freeze({version:VERSION,listening,speaking,source:sessionSource,language:settings().language,autoSpeak:settings().autoSpeak,lastInterim,lastExecutorError:lastSpecializedError?{code:clean(lastSpecializedError.code||'',120),message:clean(lastSpecializedError.message||lastSpecializedError,800),artifact:clean(lastSpecializedError.artifact||'',160)}:null})}

addEventListener('civweave:local-ai-transcript',event=>onTranscript(event.detail||{}));
addEventListener('civweave:avatar-direct-text',event=>{const detail=event.detail||{};if(!listening||detail.phase!=='response'||!clean(detail.text))return;void speak(detail.text,{guide:detail.system})});
addEventListener('pagehide',()=>{stop();stopSpeaking()},{capture:false});

const api=Object.freeze({version:VERSION,guides:GUIDE,systems:SYSTEMS,resolveAddress,routeTranscript,start,stop,toggle,speak,stopSpeaking,state,settings,saveSettings,onTranscript,installedSpeechModelStatus,ensureModelPackRuntime,ensureSpeechExecutor});
globalThis.CivweaveGuideVoiceV1=api;
try{dispatchEvent(new CustomEvent('civweave:guide-voice-ready',{detail:state()}))}catch{}
})();