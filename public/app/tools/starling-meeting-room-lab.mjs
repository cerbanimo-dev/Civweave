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
