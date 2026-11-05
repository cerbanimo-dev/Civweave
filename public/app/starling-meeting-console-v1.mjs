import {createStarlingLiveMediaBridge,createBrowserSpeechPlayback} from './shared/starling-live-media-bridge-v1.mjs';
import {createMeeting} from './shared/starling-meeting-operations-v1.mjs';
import {createMeetingRepository} from './shared/starling-meeting-records-v1.mjs';
import {createMeetingRecorder} from './shared/starling-meeting-recorder-v1.mjs';
const HOST='rehearsal_host', AGENTS=['maggie','kami','moss','rook','merlin'];
const $=id=>document.getElementById(id);
let recorder=null;
const updateReport=()=>{if(!recorder)return;const s=recorder.snapshot();$('record-status').textContent=(recorder.isEnabled()?'Recording on':'Recording off')+' · '+s.transcript.length+' turns · '+s.decisions.length+' decisions';};

const live={mic:null,context:null,source:null,analyser:null,raf:0,triggerAt:0};
const speakable=typeof speechSynthesis!=='undefined'&&typeof SpeechSynthesisUtterance==='function';
const speech=speakable?createBrowserSpeechPlayback({speechSynthesis,Utterance:SpeechSynthesisUtterance}):{
 stop(){},async speak(){return false}
};
const feed=(message)=>{const item=document.createElement('li');const stamp=document.createElement('time');stamp.textContent=new Date().toLocaleTimeString();const span=document.createElement('span');span.textContent=message;item.append(stamp,span);$('feed').prepend(item);while($('feed').children.length>70)$('feed').lastChild.remove()};
const bridge=createStarlingLiveMediaBridge({hostId:HOST,playback:speech,
  onTranscript:e=>{feed('Human: '+e.text);if(recorder?.isEnabled()){recorder.recordTurn({speakerId:HOST,text:e.text,spoken:true});updateReport();}},
  onState:e=>{if(e.type==='speech-starting')feed(e.speakerId+' has the floor.');if(e.type==='speech-stopped')feed('Playback stopped: '+e.reason);if(e.type==='speech-completed')feed(e.speakerId+' completed a turn.');render()}
});
for(const name of AGENTS)bridge.register({actorId:HOST,participantId:name});
$('speaker').replaceChildren(...AGENTS.map(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;return option}));
const draftByAgent=new Map();
try{
 const initial=createMeeting({meetingId:'local-starling-rehearsal',guildId:'local-rehearsal',createdBy:HOST,participants:[{id:HOST,kind:'human',role:'guildkeeper'},...AGENTS.map(id=>({id,kind:'agent',role:'agent'}))]});
 recorder=createMeetingRecorder({repository:createMeetingRepository(localStorage),meeting:initial});
}catch(error){feed('Local records unavailable: '+error.message);}
$('record-opt-in').addEventListener('change',event=>{if(!recorder){event.target.checked=false;return;}if(event.target.checked)recorder.enable();else recorder.disable();updateReport();});
$('export-meeting').addEventListener('click',()=>{if(!recorder)return;const blob=new Blob([recorder.markdown()],{type:'text/markdown'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='starling-meeting-rehearsal.md';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
updateReport();
function render(){
 const state=bridge.snapshot(),active=state.active?.speakerId;
 $('status').textContent=state.locked?'ALL AGENTS SILENCED':active?'Speaking: '+active:'Listening';
 $('status').className='pill'+(state.locked?' held':active?' live':'');
 $('floor').textContent=active?active+' is authorized to speak.':'Nobody has the floor. All agents are listening.';
 $('members').replaceChildren(...AGENTS.map(name=>{
  const participant=state.participants.find(p=>p.id===name),pending=state.pending.some(p=>p.speakerId===name);
  const row=document.createElement('div');row.className='member';
  const info=document.createElement('div');const title=document.createElement('strong');title.textContent=name;
  const sub=document.createElement('small');sub.textContent=active===name?'Speaking':participant?.muted?'Muted':pending?'Hand raised':'Listening silently';info.append(title,sub);
  const buttons=document.createElement('div');buttons.className='actions';
  const grant=document.createElement('button');grant.textContent='Grant turn';grant.disabled=!pending||!!active||state.locked||participant?.muted;
  grant.addEventListener('click',async()=>{try{const result=await bridge.grantAndSpeak({actorId:HOST,speakerId:name});if(!result.spoken)feed(name+': '+result.reason);else if(recorder?.isEnabled()){const draft=draftByAgent.get(name);if(draft)recorder.recordTurn({speakerId:name,text:draft,spoken:true,turnId:result.turnId});updateReport();}draftByAgent.delete(name)}catch(e){feed('Audio: '+e.message)}finally{render()}});
  const mute=document.createElement('button');mute.textContent=participant?.muted?'Unmute':'Mute';mute.className='secondary';
  mute.addEventListener('click',()=>{bridge.mute({actorId:HOST,participantId:name,muted:!participant?.muted});feed(name+(participant?.muted?' unmuted':' muted'));render()});
  buttons.append(grant,mute);row.append(info,buttons);return row;
 }));
 $('resume').disabled=!state.locked;
 $('offer').disabled=state.locked;
}
$('offer').addEventListener('click',()=>{
 const actorId=$('speaker').value,text=$('draft').value.trim();if(!text){feed('Write a draft before requesting a turn.');return}
 try{const result=bridge.offerDraft({actorId,text,requestId:'request_'+crypto.randomUUID().replaceAll('-','')});feed(actorId+': '+(result.accepted?'hand raised silently':'request denied: '+result.reason));if(result.accepted){draftByAgent.set(actorId,text);$('draft').value=''}}catch(e){feed(e.message)}render();
});
$('silence').addEventListener('click',()=>{bridge.emergencyMute({actorId:HOST});feed('Host silenced all agents.');render()});
$('resume').addEventListener('click',()=>{bridge.resume({actorId:HOST});feed('Host resumed meeting.');render()});
$('interrupt').addEventListener('click',()=>{bridge.voiceActivity({actorId:HOST});feed('Host interrupted.');render()});
$('stop').addEventListener('click',()=>{bridge.voiceActivity({actorId:HOST});feed('Host stopped agent speech.');render()});
$('submit-transcript').addEventListener('click',()=>{const text=$('transcript').value.trim();if(!text)return;bridge.transcript({actorId:HOST,text,final:true,source:'typed-rehearsal'});$('transcript').value='';render()});
async function micStop(){
 if(live.raf)cancelAnimationFrame(live.raf);live.raf=0;
 try{live.source?.disconnect()}catch{}
 try{live.analyser?.disconnect()}catch{}
 live.mic?.getTracks().forEach(track=>track.stop());live.mic=null;
 if(live.context)try{await live.context.close()}catch{}
 live.context=null;live.source=null;live.analyser=null;
 $('micstart').disabled=false;$('micstop').disabled=true;$('micstatus').textContent='Microphone off';
}
$('micstop').addEventListener('click',micStop);
$('micstart').addEventListener('click',async()=>{
 if(!navigator.mediaDevices?.getUserMedia){$('micstatus').textContent='Microphone unavailable on this browser.';return}
 $('micstart').disabled=true;
 try{
  live.mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)throw new Error('AudioContext unavailable.');
  live.context=new AudioContextClass();live.source=live.context.createMediaStreamSource(live.mic);
  live.analyser=live.context.createAnalyser();live.analyser.fftSize=2048;live.source.connect(live.analyser);
  const samples=new Float32Array(live.analyser.fftSize);
  let above=0;live.triggerAt=0;$('micstop').disabled=false;$('micstatus').textContent='Microphone active · listening for interruption';
  const tick=()=>{
   if(!live.analyser)return;
   live.analyser.getFloatTimeDomainData(samples);
   let sum=0;for(const sample of samples)sum+=sample*sample;
   const rms=Math.sqrt(sum/samples.length),now=performance.now();
   // Two adjacent frames suppress tiny clicks; throttling limits repeated events.
   above=rms>0.045?above+1:0;
   if(above>=2&&now-live.triggerAt>1200){
    live.triggerAt=now;above=0;
    if(bridge.snapshot().active){bridge.voiceActivity({actorId:HOST});feed('Microphone detected human speech: agent interrupted');render()}
   }
   live.raf=requestAnimationFrame(tick);
  };tick();
 }catch(e){$('micstatus').textContent='Microphone unavailable: '+e.message;await micStop()}
});
addEventListener('pagehide',()=>{void micStop();bridge.dispose()},{once:true});
feed('Local rehearsal initialized. All agents start silent.');render();
