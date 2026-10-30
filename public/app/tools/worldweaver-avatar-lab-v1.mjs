import {starlingRoster,starlingAvatarSeed} from '../shared/worldweaver-starling-bridge-v1.mjs';
import {validateAvatarPlan,renderAvatarSvg,avatarEventSteps,rasterizeTrustedAvatar} from '../shared/worldweaver-avatar-v1.mjs';
import {createAvatarDraftStore,parseAvatarImport,serializeAvatarBundle,AVATAR_LAB_BYTES} from '../shared/worldweaver-lab-draft-v1.mjs';

const $=id=>document.getElementById(id);
const roster=starlingRoster();
let active=null,pose='idle',currentPersona='kami',invalidDraft=false,editTimer=null;
let history=[];
let store=createAvatarDraftStore(null);
try{store=createAvatarDraftStore(window.localStorage)}catch{/* storage blocked: ephemeral editing still works */}
const draftNotice=message=>$('draft-status').textContent=message;
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
function paint(){ $('avatar').innerHTML=renderAvatarSvg(active,{pose}); }
function persist(){
  const result=store.write(currentPersona,active);
  draftNotice(result.ok?'Last validated edit saved on this device.':'Storage unavailable; use Export to keep your validated work.');
}
function loadPersona(personaId){
  currentPersona=personaId;
  const seed=starlingAvatarSeed(personaId);
  $('reference').src=seed.referenceAsset;
  $('reference').alt=`Original illustrated portrait of ${seed.name}`;
  $('role').textContent=seed.name+' · '+seed.role;
  $('goal').textContent=seed.goal;
  $('image-status').textContent='Portrait is available locally; no vision request has been made.';
  const saved=store.read(personaId);
  active=saved.ok?saved.plan:validateAvatarPlan(starterPlan(seed));
  history=[];invalidDraft=false;pose='idle';
  $('plan').value=JSON.stringify(active,null,2);
  paint();$('speech').textContent='';
  draftNotice(saved.ok?'Restored the last validated local draft.':'Starter body loaded. Valid edits are saved locally when storage is available.');
  message('This is a procedural preview. No world, Guild or model was changed.');
}
function accept(input,{save=true}={}){
  const parsed=parseAvatarImport(input,{expectedPersona:currentPersona});
  const previous=JSON.stringify(active),next=JSON.stringify(parsed);
  if(previous!==next){history.push(active);if(history.length>12)history.shift();}
  active=parsed;invalidDraft=false;pose='idle';paint();
  $('plan').value=JSON.stringify(active,null,2);
  $('speech').textContent='';
  if(save)persist();
  message(`Validated ${active.parts.length} parts, ${active.poses.length} poses and ${active.behaviors.length} safe behavior rules.`);
}
function preview(){
  try{accept($('plan').value)}
  catch(error){
    invalidDraft=true;
    draftNotice('Current text is not valid; last working avatar is intact. Fix the error or undo.');
    message('Cannot apply edit: '+String(error.message||error).slice(0,250));
  }
}
function event(name){
  try{
    const steps=avatarEventSteps(active,name),texts=[];
    for(const step of steps){
      if(step.action==='pose')pose=step.value;
      if(step.action==='say')texts.push(step.value);
    }
    paint();$('speech').textContent=texts.join(' ')||'No speech scripted for this event.';
    message(`Played ${name} with ${steps.length} declared steps. No world service was called.`);
  }catch(error){message(String(error.message||error).slice(0,240));}
}
for(const seed of roster){
  const option=document.createElement('option');
  option.value=seed.personaId;option.textContent=seed.name;
  $('persona').append(option);
}
$('persona').value=currentPersona;
$('persona').addEventListener('change',()=>{
  const id=$('persona').value;
  if(editTimer){clearTimeout(editTimer);editTimer=null;preview();}
  if(invalidDraft&&!window.confirm('The current JSON is invalid. Switch personas and discard those unsaved text edits?')){
    $('persona').value=currentPersona;return;
  }
  loadPersona(id);
});
$('plan').addEventListener('input',()=>{
  invalidDraft=true;
  draftNotice('Editing… last validated avatar is preserved until this JSON validates.');
  if(editTimer)clearTimeout(editTimer);
  editTimer=setTimeout(()=>{editTimer=null;preview()},600);
});
$('preview').addEventListener('click',()=>{if(editTimer)clearTimeout(editTimer);editTimer=null;preview()});
$('reset').addEventListener('click',()=>{
  if(editTimer)clearTimeout(editTimer);editTimer=null;
  store.clear(currentPersona);
  loadPersona(currentPersona);
  message('Restored the original persona starter; previous local draft was cleared.');
});
$('revert').addEventListener('click',()=>{
  if(editTimer)clearTimeout(editTimer);editTimer=null;
  if(history.length){
    active=history.pop();pose='idle';paint();persist();
    $('plan').value=JSON.stringify(active,null,2);
    invalidDraft=false;
    message('Restored the previous validated avatar.');
  }else if(invalidDraft){
    $('plan').value=JSON.stringify(active,null,2);
    invalidDraft=false;
    draftNotice('Discarded invalid text, retaining the last validated avatar.');
    message('Working avatar preserved.');
  }else message('No earlier valid edit to restore.');
});
$('export').addEventListener('click',()=>{
  try{
    if(editTimer){clearTimeout(editTimer);editTimer=null;preview();}
    if(invalidDraft)throw new Error('Fix or revert invalid JSON before export.');
    const text=serializeAvatarBundle(currentPersona,active);
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=`worldweaver-${currentPersona}-rig.json`;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    message('Exported the validated avatar plan. No world was changed.');
  }catch(error){message('Export failed: '+String(error.message||error).slice(0,220));}
});
$('import').addEventListener('change',async()=>{
  const file=$('import').files?.[0];
  $('import').value='';
  if(!file)return;
  const target=currentPersona;
  try{
    if(file.size<=0||file.size>AVATAR_LAB_BYTES)throw new TypeError('Rig import must be 32 KB or smaller.');
    const contents=await file.text();
    if(target!==currentPersona)throw new Error('Persona changed during import; retry.');
    accept(contents);
    message('Imported and validated a local rig. Previous working plan remains undoable.');
  }catch(error){message('Import rejected: '+String(error.message||error).slice(0,240));}
});
document.querySelectorAll('[data-event]').forEach(el=>el.addEventListener('click',()=>event(el.dataset.event)));
$('prepare-image').addEventListener('click',async()=>{
  const button=$('prepare-image'),requested=currentPersona;button.disabled=true;
  $('image-status').textContent='Rasterizing a packaged reference image in this browser…';
  try{
    const data=await rasterizeTrustedAvatar(starlingAvatarSeed(requested));
    if(requested===currentPersona)
      $('image-status').textContent=`Local PNG ready (${Math.ceil(data.length*0.75/1024)} KB). Nothing was sent to a model or server.`;
  }catch(error){if(requested===currentPersona)$('image-status').textContent='Could not prepare image: '+String(error.message||error).slice(0,190)}
  finally{button.disabled=false}
});
addEventListener('beforeunload',event=>{
  if(invalidDraft){event.preventDefault();event.returnValue='';}
});
loadPersona(currentPersona);
