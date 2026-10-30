import {createWorldweaver} from '../shared/worldweaver-core-v1.mjs';
import {buildOpenSimGeometry,projectOpenSimPolygons3Dto2D} from '../shared/worldweaver-opensim-geometry-v1.mjs';
import {createProvisionalOpenSimScene,LEGACY_VISUAL_SOURCE} from '../shared/worldweaver-visual-scene-v1.mjs';
import {createOpenSim3DPreview} from '../shared/worldweaver-3d-preview-v1.mjs';
import {projectWorld2D,renderWorldMap2D,observeWorld2D} from '../shared/worldweaver-map-2d-v1.mjs';
import {renderWorldScreen} from '../shared/worldweaver-screen-v1.mjs';

const $=id=>document.getElementById(id),human={kind:'human',principalId:'lab:human',verified:true};
let sequence=0;
const world=createWorldweaver({id:()=>`lab-${++sequence}`,authorize:({actor})=>actor?.kind==='human'&&actor.verified===true});
const room=world.dispatch({type:'create',guide:'moss',title:'Civweave illustrated commune · polygon test'},human).instance;
const screen=world.dispatch({type:'create-screen',instanceId:room.id,title:'Weave screen'},human).screen;
let original=createProvisionalOpenSimScene({instanceId:room.id});
let source=structuredClone(original);
let geometry=buildOpenSimGeometry(source),selected='visual:square';
let viewer;
for(const obj of source.objects.filter(o=>o.kind==='building')){
 const option=document.createElement('option');option.value=obj.id;option.textContent=obj.name;
 $('object').append(option);
}
$('object').value=selected;
function status(text){$('status').textContent=text;}
function selectObject(objectId){
 if(!source.objects.find(o=>o.id===objectId&&o.kind==='building'))return;
 selected=objectId;$('object').value=objectId;
 viewer?.select(objectId);
 drawMap();details();
 status('Selected '+source.objects.find(x=>x.id===selected).name+'. Object ID is identical in 3D and 2D.');
}
function drawMap(){
 const state=world.snapshot(),layout={sceneGeometry:geometry};
 const projection=projectWorld2D(state,{worldRef:room.id,layout});
 $('map').replaceChildren(renderWorldMap2D(projection,{documentRef:document,selectedObjectId:selected,onActivate:action=>{
  if(action.objectType==='building')selectObject(action.objectId);
  else if(action.recursivePortal)status('The in-world Civweave screen maps back to this same 2D world. Infinite recursion is capped.');
  else status('Inspect request for '+action.objectType+' '+action.objectId+' (lab only).');
 }}));
 const observation=observeWorld2D(state,{worldRef:room.id,layout});
 // Avoid sending the full face triangle soup to small-model context: only
 // object vertices, footprint IDs and bounded source metadata are included.
 $('observation').textContent=JSON.stringify({
  ...observation,geometrySource:source.source,geometryRegionId:geometry.regionId,
  geometryFaceCount:geometry.faces.length,geometryObjectCount:geometry.objects.length,
  sourceReference:LEGACY_VISUAL_SOURCE
 },null,2).slice(0,23000);
}
function renderScreen(){
 const state=world.snapshot(),content=state.screens.find(x=>x.id===screen.id).current,host=$('screen-panel');
 host.replaceChildren();
 if(!content){const p=document.createElement('p');p.textContent='No presentation. Use Cast Civweave to see the recursive 2D portal.';host.append(p);return;}
 host.append(renderWorldScreen(content,{documentRef:document,worldState:state,
  worldLayout:{sceneGeometry:geometry},onActivate:action=>{
   if(action.objectType==='building')selectObject(action.objectId);
   else status(action.recursivePortal?'Civweave screen recursion stopped at the 2D portal.':'Inspected '+action.objectId);
  }}));
}
function details(){
 const obj=geometry.objects.find(o=>o.id===selected),projected=projectOpenSimPolygons3Dto2D(geometry);
 if(!obj)return;
 const polygon=projected.buildings.find(p=>p.id===obj.id);
 $('details').textContent=JSON.stringify({
  objectId:obj.id,source:'provisional prim geometry named from '+LEGACY_VISUAL_SOURCE,
  worldPosition:obj.position,partIds:obj.partIds,polygonQuality:obj.quality,
  mapFootprintPoints:polygon.points,
  sourceTriangleCount:geometry.faces.filter(f=>f.objectId===obj.id).length,
  mapProjectedTriangleCount:projected.projectedFaces.filter(f=>f.objectId===obj.id).length,
  revision:geometry.revision
 },null,2);
}
function update(){
 geometry=buildOpenSimGeometry(source);
 viewer?.update();drawMap();renderScreen();details();
}
viewer=createOpenSim3DPreview({canvas:$('viewer'),getGeometry:()=>geometry,onSelect:hit=>selectObject(hit.objectId)});
function mutate(mode){
 const obj=source.objects.find(o=>o.id===selected);if(!obj)return;
 if(mode==='rotate'){
  const angle=Math.atan2(obj.rotation.z,obj.rotation.w)*2+Math.PI/12;
  obj.rotation={x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)};
 }else{
  if(obj.position.x+4>252){status('Move rejected: test object reached the region edge.');return;}
  obj.position.x+=4;
 }
 source.revision++;
 update();
 status('Changed source OpenSimulator-style 3D object; 2D polygons regenerated from the same vertices, revision '+geometry.revision+'.');
}
$('object').addEventListener('change',()=>selectObject($('object').value));
$('turn').addEventListener('click',()=>mutate('rotate'));
$('shift').addEventListener('click',()=>mutate('move'));
$('reset').addEventListener('click',()=>{
 source=structuredClone(original);geometry=buildOpenSimGeometry(source);selected='visual:square';$('object').value=selected;
 viewer.select(selected);update();status('Reset provisional geometry; both views restored to source revision '+geometry.revision+'.');
});
$('cast').addEventListener('click',()=>{
 world.dispatch({type:'cast-screen',screenId:screen.id,content:{
  kind:'civweave',source:{worldRef:room.id},title:'Civweave ↳ 2D commune'}},human);
 update();status('A Weave screen now presents the geometry-backed 2D map, not a nested 3D viewer.');
});
$('clear').addEventListener('click',()=>{
 world.dispatch({type:'clear-screen',screenId:screen.id},human);
 update();status('Weave screen cleared.');
});
addEventListener('pagehide',()=>viewer.close(),{once:true});
update();viewer.select(selected);
status('Prototype ready: 3D triangles and 2D polygons share one source geometry revision.');
