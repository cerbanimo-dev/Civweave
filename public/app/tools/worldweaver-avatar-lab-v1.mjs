import {starlingRoster,starlingAvatarSeed} from '../shared/worldweaver-starling-bridge-v1.mjs';
import {validateAvatarPlan,renderAvatarSvg,avatarEventSteps,rasterizeTrustedAvatar} from '../shared/worldweaver-avatar-v1.mjs';

const $=id=>document.getElementById(id);
const roster=starlingRoster();
let active=null,pose='idle';
function starterPlan(seed){
  const color=seed.color||'#8265ac';
  return {format:'procedural-2d',parts:[
    {id:'body',parent:null,shape:'ellipse',x:0,y:22,width:52,height:76,color},
    {id:'head',parent:'body',shape:'circle',x:0,y:-64,width:43,height:43,color:'#e6c9aa'},
    {id:'left-arm',parent:'body',shape:'capsule',x:-39,y:-5,width:14,height:44,color},
    {id:'right-arm',parent:'body',shape:'capsule',x:39,y:-5,width:14,height:44,color},
    {id:'left-leg',parent:'body',shape:'capsule',x:-15,y:48,width:17,height:39,color},
    {id:'right-leg',parent:'body',shape:'capsule',x:15,y:48,width:17,height:39,color}
  ],poses:[
    {name:'idle',rotations:{}},
    {name:'greet',rotations:{'right-arm':-110}},
    {name:'work',rotations:{'left-arm':-28,'right-arm':28}},
    {name:'celebrate',rotations:{'left-arm':65,'right-arm':-65}}
  ],behaviors:[
    {on:'visitor-arrived',action:'pose',value:'greet'},
    {on:'visitor-arrived',action:'say',value:'Welcome to our space!'},
    {on:'spoken-to',action:'say',value:'What would you like to work on?'},
    {on:'task-started',action:'pose',value:'work'},
    {on:'task-completed',action:'pose',value:'celebrate'},
    {on:'idle',action:'pose',value:'idle'}
  ]};
}
function message(text){$('status').textContent=text;}
function paint(){
  $('avatar').innerHTML=renderAvatarSvg(active,{pose});
}
function loadPersona(){
  const seed=starlingAvatarSeed($('persona').value);
  $('reference').src=seed.referenceAsset;
  $('reference').alt=`Original illustrated portrait of ${seed.name}`;
  $('role').textContent=seed.name+' · '+seed.role;
  $('goal').textContent=seed.goal;
  $('image-status').textContent='Portrait is available locally; no vision request has been made.';
  active=validateAvatarPlan(starterPlan(seed));
  $('plan').value=JSON.stringify(active,null,2);
  pose='idle';paint();$('speech').textContent='';
  message('Starter body is a procedural demo, not an attempt to copy the original portrait.');
}
function preview(){
  try{
    const newPlan=validateAvatarPlan(JSON.parse($('plan').value));
    active=newPlan;pose='idle';paint();
    $('speech').textContent='';
    message(`Validated ${active.parts.length} parts, ${active.poses.length} poses and ${active.behaviors.length} safe behavior rules.`);
  }catch(error){message('Unable to preview: '+String(error.message||error).slice(0,220));}
}
function event(name){
  try{
    const steps=avatarEventSteps(active,name);
    const texts=[];
    for(const step of steps){
      if(step.action==='pose')pose=step.value;
      if(step.action==='say')texts.push(step.value);
    }
    paint();
    $('speech').textContent=texts.join(' ')||'No speech scripted for this event.';
    message(`Played ${name} with ${steps.length} declared steps. No world service was called.`);
  }catch(error){message(String(error.message||error).slice(0,220));}
}
for(const seed of roster){
  const option=document.createElement('option');
  option.value=seed.personaId;option.textContent=seed.name;
  $('persona').append(option);
}
$('persona').value='kami';
$('persona').addEventListener('change',loadPersona);
$('preview').addEventListener('click',preview);
$('reset').addEventListener('click',loadPersona);
document.querySelectorAll('[data-event]').forEach(el=>el.addEventListener('click',()=>event(el.dataset.event)));
$('prepare-image').addEventListener('click',async()=>{
  const button=$('prepare-image');button.disabled=true;
  $('image-status').textContent='Rasterizing a packaged reference image in this browser…';
  try{
    const data=await rasterizeTrustedAvatar(starlingAvatarSeed($('persona').value));
    $('image-status').textContent=`Local PNG ready (${Math.ceil(data.length*0.75/1024)} KB). It has not been sent to any model or server.`;
  }catch(error){$('image-status').textContent='Could not prepare image: '+String(error.message||error).slice(0,190)}
  finally{button.disabled=false}
});
loadPersona();
