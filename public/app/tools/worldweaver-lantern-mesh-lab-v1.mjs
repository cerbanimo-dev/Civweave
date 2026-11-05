import {createWorldweaver} from '../shared/worldweaver-core-v1.mjs';
import {projectWorld2D,observeWorld2D,renderWorldMap2D} from '../shared/worldweaver-map-2d-v1.mjs';
import {LANTERN_MESH,installLanternMesh} from '../shared/worldweaver-lantern-mesh-v1.mjs';

const $=id=>document.getElementById(id);
let n=0;
const human={kind:'human',principalId:'demo:human',verified:true};
const runtime={kind:'runtime',principalId:'demo:renderer',verified:true};
// This synthetic authorizer exists only in this local demonstrator.
const world=createWorldweaver({
  id:()=>`lantern-demo-${++n}`,
  authorize:({actor})=>actor?.verified===true
});
const installed=installLanternMesh(world,{human,runtime,guildId:'demo:lantern-guild',provision:true});
let active=LANTERN_MESH.districts[0].id;

for(const d of LANTERN_MESH.districts){
  const option=document.createElement('option');
  option.value=d.id; option.textContent=d.title; $('district').append(option);
}
function draw(){
  const state=world.snapshot();
  const instanceId=installed.districtIds[active];
  const projection=projectWorld2D(state,{worldRef:instanceId});
  $('map').replaceChildren(renderWorldMap2D(projection,{
    documentRef:document,
    onActivate:action=>$('status').textContent=`Requested ${action.objectType}: ${action.objectId}. This demo does not perform privileged external actions.`
  }));
  $('observation').textContent=JSON.stringify(observeWorld2D(state,{worldRef:instanceId}),null,2);
  const d=LANTERN_MESH.districts.find(x=>x.id===active);
  $('description').textContent=d.description;
  $('pressure').textContent=LANTERN_MESH.storyPressure[Math.floor(Math.random()*LANTERN_MESH.storyPressure.length)];
}
$('district').addEventListener('change',e=>{active=e.target.value;draw();});
$('pressure-button').addEventListener('click',draw);
$('district').value=active;
$('title').textContent=LANTERN_MESH.title;
$('tagline').textContent=LANTERN_MESH.tagline;
$('principles').textContent=LANTERN_MESH.principles.join(' · ');
draw();
