(()=>{
'use strict';

const VERSION='1.0.0-guide-voice-runtime-v1';
if(globalThis.CivweaveGuideVoiceV1?.version===VERSION)return;
const SETTINGS_KEY='civweave.guide-voice.v1';
const GUIDE=Object.freeze({weaveling:'civweave',moss:'living-school',kamiya:'cerbanimo',rook:'fellowfare',merlin:'anarchadia'});
const SYSTEMS=Object.freeze(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
let listening=false,recognition=null,sessionSource='',lastInterim='',speaking=false;

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
async function startSpecialized(options={}){
  const runtime=specialized();if(!runtime?.execute)return false;
  try{
    const result=await runtime.execute('speech-transcription',{mode:'realtime',language:options.language||settings().language,onTranscript},{language:options.language||settings().language});
    if(result?.stop||result?.session){recognition=result;listening=true;sessionSource=result.source||'specialized-model';emitState();return true}
  }catch(error){if(error?.code!=='LOCAL_SPECIALIZED_EXECUTOR_UNAVAILABLE')throw error}
  return false;
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
  if(listening)return true;const language=options.language||settings().language;sessionSource='';
  if(await startSpecialized({language}).catch(error=>{emitState({error:clean(error?.message||error,600)});return false}))return true;
  if(await startWebSpeech({language}).catch(error=>{emitState({error:clean(error?.message||error,600),code:error?.code||''});return false}))return true;
  throw Object.assign(new Error('No offline speech-recognition runtime is installed. Install a Civweave voice pack or an on-device browser language pack.'),{code:'OFFLINE_VOICE_RUNTIME_UNAVAILABLE'});
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
function state(){return Object.freeze({version:VERSION,listening,speaking,source:sessionSource,language:settings().language,autoSpeak:settings().autoSpeak,lastInterim})}

addEventListener('civweave:local-ai-transcript',event=>onTranscript(event.detail||{}));
addEventListener('civweave:avatar-direct-text',event=>{const detail=event.detail||{};if(!listening||detail.phase!=='response'||!clean(detail.text))return;void speak(detail.text,{guide:detail.system})});
addEventListener('pagehide',()=>{stop();stopSpeaking()},{capture:false});

const api=Object.freeze({version:VERSION,guides:GUIDE,systems:SYSTEMS,resolveAddress,routeTranscript,start,stop,toggle,speak,stopSpeaking,state,settings,saveSettings,onTranscript});
globalThis.CivweaveGuideVoiceV1=api;
try{dispatchEvent(new CustomEvent('civweave:guide-voice-ready',{detail:state()}))}catch{}
})();