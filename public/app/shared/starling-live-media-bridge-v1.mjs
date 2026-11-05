/**
 * Thread 2: live-meeting browser/media bridge.
 * Explicitly activated by a trusted session owner; no automatic microphone
 * capture, model generation, hosted calls, or globally routed guide speech.
 *
 * Model results are drafts. A speaking lease must be checked immediately
 * before playback and after every async preparation step. A server-side
 * transport must independently validate host identity and meeting permissions.
 */
import {createStarlingLiveTurnManager, STARLING_LIVE_PROTOCOL} from './starling-live-turn-manager-v1.mjs';

const clean = (value,max=4000)=>typeof value==='string'?value.trim().slice(0,max):'';
const validId = value=>typeof value==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(value);
export const STARLING_LIVE_BRIDGE_SCHEMA='civweave.starling-live-media-bridge.v1';

export function createStarlingLiveMediaBridge({
  hostId, manager=createStarlingLiveTurnManager({hostId}),
  playback, onTranscript=()=>{}, onState=()=>{},
  makeId=()=>globalThis.crypto?.randomUUID?.()||('turn-'+Math.random().toString(36).slice(2))
}={}){
  if(!validId(hostId)||!manager||typeof manager.authorize!=='function'
     ||!playback||typeof playback.speak!=='function'||typeof playback.stop!=='function'
     ||typeof onTranscript!=='function'||typeof onState!=='function'||typeof makeId!=='function')
     throw new TypeError('Host, turn manager, cancellable playback and callbacks are required.');
  let activePlayback=null,disposed=false;
  const drafts=new Map();
  function ensure(){if(disposed)throw new Error('Meeting bridge was disposed.')}
  function signal(type,extra={}){try{onState(Object.freeze({schema:STARLING_LIVE_BRIDGE_SCHEMA,type,...extra}))}catch{}}
  function cancel(reason){
    if(!activePlayback)return false;
    const previous=activePlayback;activePlayback=null;
    try{previous.controller.abort(reason)}catch{}
    try{playback.stop()}catch{}
    signal('playback-stopped',{speakerId:previous.speakerId,reason});
    return true;
  }
  function reconcile(){
    const state=manager.snapshot();
    if(activePlayback&&!manager.authorize({speakerId:activePlayback.speakerId,turnId:activePlayback.turnId,leaseEpoch:activePlayback.leaseEpoch}))cancel('lease-revoked');
    return state;
  }
  function register({actorId,participantId,kind='agent'}={}){
    ensure();const result=manager.join({actorId,participantId,kind});signal('participant-joined',{participantId,kind});return result;
  }
  function transcript({actorId,text,final=false,source='microphone'}={}){
    ensure();const state=reconcile();
    if(!state.participants.some(p=>p.id===actorId&&p.kind==='human'))throw new Error('Only authenticated human participants can supply live speech.');
    const value=clean(text,6000);if(!value)return false;
    // Interruption on voice activity or interim transcript; never wait for ASR final.
    manager.humanSpeech({actorId});cancel('human-interruption');
    signal('human-speech',{actorId,final:final===true});
    if(final===true)onTranscript(Object.freeze({schema:STARLING_LIVE_BRIDGE_SCHEMA,actorId,text:value,source:clean(source,64)||'microphone',final:true}));
    return true;
  }
  function voiceActivity({actorId,active=true}={}){
    ensure();reconcile();const participant=manager.snapshot().participants.find(p=>p.id===actorId);
    if(!participant||participant.kind!=='human')throw new Error('Voice activity requires a trusted human participant.');
    if(active){manager.humanSpeech({actorId});cancel('human-interruption');signal('human-voice-activity',{actorId})}
    return true;
  }
  function offerDraft({actorId,text,requestId}={}){
    ensure();reconcile();
    if(!validId(requestId))throw new TypeError('Request ID required.');
    const value=clean(text,12000);if(!value)throw new TypeError('Nonempty model draft required.');
    const participant=manager.snapshot().participants.find(p=>p.id===actorId);
    if(!participant||participant.kind!=='agent')throw new Error('Only registered agents can offer model drafts.');
    const result=manager.ask({actorId,requestId,reason:'model-draft'});
    if(result.accepted)drafts.set(actorId,Object.freeze({text:value,requestId}));
    signal('draft-offered',{actorId,accepted:result.accepted});
    return result;
  }
  function askDirected({actorId,targetId,requestId}={}){
    ensure();return manager.directedQuestion({actorId,targetId,requestId});
  }
  async function grantAndSpeak({actorId,speakerId,turnId=makeId()}={}){
    ensure();reconcile();
    const draft=drafts.get(speakerId);
    if(!draft)return Object.freeze({spoken:false,reason:'no-draft'});
    const granted=manager.grant({actorId,speakerId,turnId});
    if(!granted.granted)return Object.freeze({spoken:false,reason:granted.reason});
    drafts.delete(speakerId);
    const lease=granted.lease;
    const permitted=()=>!disposed&&manager.authorize({speakerId,turnId,leaseEpoch:lease.epoch});
    const controller=new AbortController();
    const current={speakerId,turnId,leaseEpoch:lease.epoch,controller};
    activePlayback=current;
    signal('speech-starting',{speakerId,turnId});
    try{
      if(!permitted())return Object.freeze({spoken:false,reason:'lease-revoked'});
      // Playback adapter MUST check signal and permission again before
      // any delayed TTS audio is emitted, and stop when signal aborts.
      const result=await playback.speak(draft.text,{
        signal:controller.signal,canSpeak:permitted,speakerId,turnId,leaseEpoch:lease.epoch
      });
      if(!permitted())return Object.freeze({spoken:false,reason:'lease-revoked'});
      signal('speech-completed',{speakerId,turnId});
      return Object.freeze({spoken:result!==false,turnId,speakerId});
    }catch(error){
      if(controller.signal.aborted)return Object.freeze({spoken:false,reason:'interrupted'});
      signal('speech-error',{speakerId,turnId,message:clean(error?.message,200)});
      throw error;
    }finally{
      if(activePlayback===current)activePlayback=null;
      if(manager.authorize({speakerId,turnId,leaseEpoch:lease.epoch}))manager.complete({actorId:hostId,turnId});
    }
  }
  function emergencyMute({actorId}={}){ensure();const result=manager.emergencyMute({actorId});drafts.clear();cancel('emergency-mute');return result}
  function mute({actorId,participantId,muted=true}={}){
    ensure();const result=manager.mute({actorId,participantId,muted});if(muted)drafts.delete(participantId);reconcile();return result;
  }
  function reconnect({actorId,participantId}={}){
    ensure();const result=manager.reconnect({actorId,participantId});drafts.clear();cancel('reconnection');return result;
  }
  function leave({actorId,participantId}={}){
    ensure();const result=manager.leave({actorId,participantId});drafts.delete(participantId);reconcile();return result;
  }
  function dispose(){if(disposed)return;disposed=true;drafts.clear();cancel('disposed')}
  return Object.freeze({schema:STARLING_LIVE_BRIDGE_SCHEMA,protocol:STARLING_LIVE_PROTOCOL,manager,
    register,transcript,voiceActivity,offerDraft,askDirected,grantAndSpeak,emergencyMute,mute,reconnect,leave,
    resume:({actorId}={})=>{ensure();return manager.resume({actorId})},snapshot:()=>{ensure();return reconcile()},
    dispose});
}

/**
 * Browser speech synthesis adapter. This is local device playback, not an
 * OpenAI/Gemini voice bridge; calls are intentionally opt-in and cancellable.
 */
export function createBrowserSpeechPlayback({speechSynthesis,Utterance,language='en-US'}={}){
  if(!speechSynthesis||typeof speechSynthesis.speak!=='function'||typeof speechSynthesis.cancel!=='function'
     ||typeof Utterance!=='function')throw new TypeError('Browser speech synthesis support required.');
  return Object.freeze({
    stop(){speechSynthesis.cancel()},
    speak(text,{signal,canSpeak}={}){
      return new Promise((resolve,reject)=>{
        if(signal?.aborted||canSpeak?.()!==true){resolve(false);return}
        let settled=false;
        const finish=(value,error)=>{if(settled)return;settled=true;signal?.removeEventListener?.('abort',abort);if(error)reject(error);else resolve(value)};
        const abort=()=>{try{speechSynthesis.cancel()}catch{}finish(false)};
        const utterance=new Utterance(text);utterance.lang=language;
        utterance.onend=()=>finish(true);
        utterance.onerror=e=>finish(false,e?.error?new Error(String(e.error)):null);
        signal?.addEventListener?.('abort',abort,{once:true});
        if(signal?.aborted||canSpeak?.()!==true){abort();return}
        try{speechSynthesis.speak(utterance)}catch(error){finish(false,error)}
      });
    }
  });
}
