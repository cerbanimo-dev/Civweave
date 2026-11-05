import {projectMeetingRoom} from '../shared/starling-meeting-room-v1.mjs';

// Isolated sample data. This page is a lab, not an authenticated Guild session.
const participants = [
  {id:'host',displayName:'Human host',kind:'human',connected:true},
  {id:'moss',displayName:'Moss',kind:'agent',connected:true},
  {id:'kamiya',displayName:'Kamiya',kind:'agent',connected:true},
  {id:'rook',displayName:'Rook',kind:'agent',connected:true}
];
const session={roomStatus:'live',activeSpeakerId:null,grantedSpeakerId:null,participants};
const $=id=>document.getElementById(id);
const camera={azimuth:-19,elevation:63,zoom:.85};
const colors=['#bd6c90','#478eaa','#7ba07b','#b58b5e','#8c82c0'];
const element=(tag,className,text)=>{
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=text;
  return el;
};

function renderCamera(){
  const is3d=$('three-d-toggle').checked;
  $('viewport').classList.toggle('flat',!is3d);
  $('world-camera').style.transform='translate(-50%,-50%) rotateX('+camera.elevation+'deg) rotateZ('+camera.azimuth+'deg) scale('+camera.zoom+')';
}

function render(){
  const projection=projectMeetingRoom(session);
  const avatars=document.createDocumentFragment();
  const people=document.createDocumentFragment();
  for(const [index, avatar] of projection.avatars.entries()){
    const root=element('div','avatar');
    root.dataset.kind=avatar.kind;
    root.dataset.state=avatar.state;
    root.style.setProperty('--avatar-color',colors[index%colors.length]);
    root.style.transform='translate3d('+Math.round(avatar.position.x*75-34)+'px,'+Math.round(avatar.position.z*75-55)+'px,25px)';
    root.append(element('div','avatar-body'),element('div','avatar-head'),element('div','avatar-name',avatar.displayName));
    root.setAttribute('aria-hidden','true');
    avatars.append(root);

    const li=element('li');
    li.dataset.state=avatar.state;
    const label=element('span','',avatar.displayName+' · '+(avatar.kind==='agent'?'AI':'Human'));
    const stateLabel=element('span','pill',avatar.state.replaceAll('_',' '));
    li.append(label,stateLabel);
    people.append(li);
  }
  $('avatar-layer').replaceChildren(avatars);
  $('participant-list').replaceChildren(people);
  const speaker=projection.avatars.find(a=>a.state==='speaking');
  $('room-status').textContent=speaker?
    'Visual demo: '+speaker.displayName+' is speaking under simulated authority. No audio is playing.':
    'Visual demo: all agents silent; '+projection.avatars.length+' participants present in the local preview.';
}

function refresh(){renderCamera();render()}
$('rotate-left').addEventListener('click',()=>{camera.azimuth-=15;renderCamera()});
$('rotate-right').addEventListener('click',()=>{camera.azimuth+=15;renderCamera()});
$('zoom-in').addEventListener('click',()=>{camera.zoom=Math.min(1.3,Math.round((camera.zoom+.1)*100)/100);renderCamera()});
$('zoom-out').addEventListener('click',()=>{camera.zoom=Math.max(.45,Math.round((camera.zoom-.1)*100)/100);renderCamera()});
$('reset-camera').addEventListener('click',()=>{camera.azimuth=-19;camera.elevation=63;camera.zoom=.85;renderCamera()});
$('three-d-toggle').addEventListener('change',renderCamera);
// Synthetic turn grants exist ONLY in this demonstrator and cannot reach shared session state.
$('demo-grant').addEventListener('click',()=>{session.activeSpeakerId='moss';session.grantedSpeakerId='moss';render()});
$('demo-revoke').addEventListener('click',()=>{session.activeSpeakerId=null;session.grantedSpeakerId=null;render()});
$('demo-hand').addEventListener('click',()=>{const p=participants.find(p=>p.id==='rook');p.handRaised=!p.handRaised;render()});
$('demo-disconnect').addEventListener('click',()=>{const p=participants.find(p=>p.id==='kamiya');p.connected=!p.connected;render()});
refresh();


/**
 * This is only a local host speech preview. The canonical Civweave voice
 * runtime remains the sole microphone owner; no audio leaves this page.
 */
let captureEpoch=0;
let voiceActive=false;
const startButton=$('start-mic'),stopButton=$('stop-mic');
const micStatus=$('mic-status'),captions=$('live-captions'),activity=$('speech-activity');
const voice=()=>globalThis.CivweaveGuideVoiceV1;
function setMicStatus(message){micStatus.textContent=message}
function syncMicControls(pending=false){
  startButton.disabled=pending||voiceActive;
  stopButton.disabled=!pending&&!voiceActive;
}
function stopHostMicrophone(){
  captureEpoch++;
  try{voice()?.stop?.()}catch{}
  voiceActive=false;
  activity.value=0;
  syncMicControls();
  setMicStatus('Microphone off');
}
startButton.addEventListener('click',async()=>{
  const runtime=voice();
  if(!runtime?.start||!runtime?.stop){
    setMicStatus('Civweave offline voice runtime is unavailable in this preview.');
    return;
  }
  if(voiceActive)return;
  const epoch=++captureEpoch;
  syncMicControls(true);
  setMicStatus('Requesting local microphone access…');
  try{
    const started=await runtime.start({routeToChat:false});
    if(epoch!==captureEpoch){
      if(started)runtime.stop();
      return;
    }
    voiceActive=Boolean(started);
    syncMicControls();
    setMicStatus(voiceActive?'Listening locally — no messages sent to AI agents.':'Offline speech recognition did not start.');
  }catch(error){
    if(epoch!==captureEpoch)return;
    const unavailable=String(error?.code||'').includes('OFFLINE_VOICE_RUNTIME_UNAVAILABLE') ||
      /No offline speech-recognition model or browser language pack/.test(String(error?.message||''));
    if(unavailable && typeof runtime.startMeter==='function'){
      try {
        const meter=await runtime.startMeter();
        if(epoch!==captureEpoch){if(meter)runtime.stop();return;}
        voiceActive=Boolean(meter);
        captions.textContent='Microphone active. Speech recognition unavailable — captions require an offline voice pack.';
        syncMicControls();
        setMicStatus(meter?'Microphone active · audio level only · no transcription or AI relay.':'Microphone could not start.');
        return;
      }catch(meterError){error=meterError;}
    }
    voiceActive=false;
    syncMicControls();
    setMicStatus('Microphone unavailable: '+String(error?.message||error).slice(0,250));
  }
});
stopButton.addEventListener('click',stopHostMicrophone);
addEventListener('civweave:guide-voice-transcript',event=>{
  if(!voiceActive)return;
  const data=event?.detail||{};
  if(typeof data.text==='string'){
    captions.textContent=(data.final===false?'Listening: ':'Recognized: ')+data.text.slice(0,2000);
    if(data.final!==false)activity.value=0;
  }
});
addEventListener('civweave:guide-voice-state',event=>{
  if(!voiceActive)return;
  const data=event?.detail||{};
  if(data.phase==='speech-detected')activity.value=Math.max(5,Math.min(100,Math.round(Number(data.rms||0)*2500)));
  if(data.phase==='transcript-ready')activity.value=0;
  if(data.error)setMicStatus('Speech error: '+String(data.error).slice(0,250));
  if(data.ended||data.stopped){voiceActive=false;activity.value=0;syncMicControls();setMicStatus('Microphone off');}
});
addEventListener('pagehide',stopHostMicrophone,{once:true});
