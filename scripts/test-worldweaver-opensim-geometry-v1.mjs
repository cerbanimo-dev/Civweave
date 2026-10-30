import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OPENSIM_GEOMETRY_SCHEMA,buildOpenSimGeometry,projectOpenSimPolygons3Dto2D,convexHull2D,validateOpenSimRegion} from '../public/app/shared/worldweaver-opensim-geometry-v1.mjs';
import {projectOpenSimFaces3D,pickOpenSimFace} from '../public/app/shared/worldweaver-3d-preview-v1.mjs';
import {createProvisionalOpenSimScene,LEGACY_VISUAL_DISTRICTS} from '../public/app/shared/worldweaver-visual-scene-v1.mjs';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {projectWorld2D,observeWorld2D} from '../public/app/shared/worldweaver-map-2d-v1.mjs';
import {normalizeScreenContent,renderWorldScreen} from '../public/app/shared/worldweaver-screen-v1.mjs';

const q={x:0,y:0,z:0,w:1};
const simple=({rotation=q,position={x:128,y:128,z:1},shape='box'}={})=>({
 schema:OPENSIM_GEOMETRY_SCHEMA,regionId:'region:1',size:{x:256,y:256},revision:11,source:'opensim-region-module',
 objects:[{id:'object:1',name:'Test building',instanceId:'room:1',position,rotation,
 parts:[{id:'prim:1',name:'Walls',type:shape,offset:{x:0,y:0,z:0},rotation:q,
 scale:{x:8,y:4,z:2},color:'#778899'}]}]});
const round=(x)=>Math.round(x*1000)/1000;
test('box top-down footprint derives exact world XY coordinates, not a separate rectangle guess',()=>{
 const geo=buildOpenSimGeometry(simple());
 const hull=geo.objects[0].footprint;
 assert.deepEqual(hull.map(p=>[round(p.x),round(p.y)]),[[124,126],[132,126],[132,130],[124,130]]);
 assert.equal(geo.faces.length,12);
 const map=projectOpenSimPolygons3Dto2D(geo);
 assert.equal(map.projectedFaces.length,4); // two horizontal faces * 2 triangles
 assert.equal(map.footprints[0].points.length,4);
 assert.deepEqual(map.footprints[0].points[0],{x:48.4375,y:50.78125});
 assert.equal(map.footprints[0].quality,'exact-primitive');
 for(const f of map.projectedFaces)assert.ok(geo.faces.some(x=>x.id===f.id&&x.objectId===f.objectId));
});
test('group quaternion rotates every prim face and changes the footprint accordingly',()=>{
 const rotation={x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2};
 const geo=buildOpenSimGeometry(simple({rotation}));
 assert.deepEqual(geo.objects[0].footprint.map(p=>[round(p.x),round(p.y)]),
 [[126,124],[130,124],[130,132],[126,132]]);
 assert.equal(geo.faces.length,12);
 const projected=projectOpenSimPolygons3Dto2D(geo);
 assert.equal(projected.footprints[0].points[0].x,round(126/256*100)); // approximate decimal resolution
});
test('mesh triangles project with their original face IDs and no invented hidden polygons',()=>{
 const scene=simple();
 scene.objects[0].parts=[{id:'prim:roof',type:'mesh',offset:{x:0,y:0,z:2},
 rotation:q,scale:{x:1,y:1,z:1},color:'#ffcc00',
 vertices:[{x:-2,y:-2,z:0},{x:2,y:-2,z:0},{x:0,y:2,z:1}],
 triangles:[[0,1,2]]}];
 const geo=buildOpenSimGeometry(scene),out=projectOpenSimPolygons3Dto2D(geo);
 assert.equal(geo.faces.length,1);
 assert.equal(out.projectedFaces.length,1);
 assert.equal(out.projectedFaces[0].id,'prim:roof:0');
 assert.equal(out.footprints[0].quality,'convex-hull-of-mesh');
 assert.equal(out.projectedFaces[0].points.length,3);
});
test('child-part offsets are transformed through group rotation before world translation',()=>{
 const scene=simple({rotation:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2}});
 scene.objects[0].parts[0].offset={x:10,y:0,z:0};
 const geo=buildOpenSimGeometry(scene);
 const xs=geo.objects[0].footprint.map(p=>p.x);
 const ys=geo.objects[0].footprint.map(p=>p.y);
 assert.ok(Math.max(...xs)<135);
 assert.ok(Math.min(...ys)>130);
});
test('validate provider payload: bounds, mesh injection and group IDs',()=>{
 const bad=simple();bad.objects[0].parts[0].color='red;url(javascript:evil)';
 assert.throws(()=>validateOpenSimRegion(bad),/color/);
 const dup=simple();dup.objects.push(structuredClone(dup.objects[0]));
 assert.throws(()=>validateOpenSimRegion(dup),/Duplicate/);
 const noShape=simple({shape:'https://example.org/glb'});
 assert.throws(()=>validateOpenSimRegion(noShape),/Unsupported prim type/);
 const huge=simple();huge.objects[0].parts[0].scale.x=300;
 assert.throws(()=>validateOpenSimRegion(huge),/scale/);
 const obj=simple();obj.objects[0].name='<img src=x onerror=alert(1)>';
 assert.match(validateOpenSimRegion(obj).objects[0].name,/<img/);
 assert.equal(convexHull2D([{x:0,y:0},{x:0,y:0},{x:1,y:0},{x:0,y:1}]).length,3);
});
test('three-dimensional preview consumes same faces with stable IDs and perspective transforms',()=>{
 const geo=buildOpenSimGeometry(simple());
 const view=projectOpenSimFaces3D(geo,{width:800,height:500});
 assert.equal(view.faces.length,geo.faces.length);
 assert.deepEqual(new Set(view.faces.map(f=>f.id)),new Set(geo.faces.map(f=>f.id)));
 assert.ok(view.faces.every(f=>f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
 assert.throws(()=>projectOpenSimFaces3D(geo,{width:0}),/viewport/);
 assert.throws(()=>projectOpenSimFaces3D(geo,{pitch:0}),/pitch/);
 assert.equal(pickOpenSimFace({faces:[]},4,4),null);
});
function makeRoom(){
 let i=0;
 const human={kind:'human',principalId:'human:1',verified:true};
 const world=createWorldweaver({id:()=>`generated-${++i}`,authorize:({actor})=>actor.verified===true});
 const room=world.dispatch({type:'create',guide:'moss',title:'3D district'},human).instance;
 const screen=world.dispatch({type:'create-screen',instanceId:room.id,title:'Portal screen'},human).screen;
 return {world,room,screen,human};
}
test('same OpenSimulator geometry enriches 2D map and model observation in the correct instance only',()=>{
 const {world,room}=makeRoom();
 const scene=simple();scene.objects[0].instanceId=room.id;
 const geom=buildOpenSimGeometry(scene);
 const proj=projectWorld2D(world.snapshot(),{worldRef:room.id,layout:{sceneGeometry:geom}});
 assert.equal(proj.geometryStatus,'opensim-world-geometry');
 assert.equal(proj.geometryRevision,11);
 assert.equal(proj.polygons.length,1);
 assert.equal(proj.buildingPolygons.length,1);
 assert.equal(proj.facePolygons.length,4);
 assert.ok(proj.nodes.some(n=>n.id==='object:1'&&n.type==='building'));
 const obs=observeWorld2D(world.snapshot(),{worldRef:room.id,layout:{sceneGeometry:geom}});
 assert.equal(obs.geometryRevision,11);
 assert.deepEqual(obs.polygons[0].points,proj.polygons[0].points);
 const foreign=structuredClone(scene);foreign.objects[0].instanceId='private:other';
 const hidden=projectWorld2D(world.snapshot(),{worldRef:room.id,layout:{sceneGeometry:buildOpenSimGeometry(foreign)}});
 assert.equal(hidden.polygons.length,0);
 assert.equal(hidden.facePolygons.length,0);
});
test('3D rotation and movement increment same geometry revision for 2D and 3D projections',()=>{
 const {world,room}=makeRoom();
 const source=simple();source.objects[0].instanceId=room.id;
 const first=buildOpenSimGeometry(source);
 const before=projectWorld2D(world.snapshot(),{worldRef:room.id,layout:{sceneGeometry:first}});
 source.revision++;
 source.objects[0].rotation={x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2};
 source.objects[0].position.x+=4;
 const second=buildOpenSimGeometry(source);
 const after=projectWorld2D(world.snapshot(),{worldRef:room.id,layout:{sceneGeometry:second}});
 assert.equal(after.geometryRevision,before.geometryRevision+1);
 assert.notDeepEqual(after.polygons[0].points,before.polygons[0].points);
 const view=projectOpenSimFaces3D(second,{width:640,height:400});
 assert.equal(view.revision,after.geometryRevision);
 assert.equal(view.faces.length,second.faces.length);
});
test('in-world Civweave screen renders geometry-backed 2D polygon view; still no nested iframe',()=>{
 const {world,room,screen,human}=makeRoom();
 const source=simple();source.objects[0].instanceId=room.id;
 const geo=buildOpenSimGeometry(source);
 world.dispatch({type:'cast-screen',screenId:screen.id,content:normalizeScreenContent({
  kind:'civweave',source:{worldRef:room.id},title:'Civweave inside 3D'})},human);
 const current=world.snapshot().screens[0].current;
 const rendered=renderWorldScreen(current,{documentRef:null,worldState:world.snapshot(),worldLayout:{sceneGeometry:geo}});
 assert.equal(rendered.mapSchema,'civweave.worldweaver-map-2d.v1');
 assert.equal(rendered.mapRevision,world.snapshot().revision);
 const s=readFileSync(new URL('../public/app/shared/worldweaver-screen-v1.mjs',import.meta.url),'utf8');
 assert.match(s,/worldLayout/);
 assert.doesNotMatch(s,/allow-same-origin/);
});
test('visual-world example uses verified district names, but labels provisional coordinates',()=>{
 const fixture=createProvisionalOpenSimScene({instanceId:'demo:commune'});
 assert.equal(fixture.source,'provisional-or-imported');
 assert.equal(fixture.size.x,256);
 assert.equal(LEGACY_VISUAL_DISTRICTS.length,13);
 assert.equal(fixture.objects.filter(x=>x.kind==='building').length,13);
 assert.ok(fixture.objects.some(x=>x.name==='Federation Harbor'));
 const built=buildOpenSimGeometry(fixture);
 assert.equal(built.objects.length,24);
 assert.equal(built.source,'provisional-or-imported');
 assert.ok(built.faces.length>100);
 const html=readFileSync(new URL('../public/app/tools/worldweaver-geometry-lab.html',import.meta.url),'utf8');
 assert.match(html,/provisional/);
 assert.match(html,/id="viewer"/);
 assert.match(html,/id="map"/);
 assert.match(html,/id="screen-panel"/);
 const js=readFileSync(new URL('../public/app/tools/worldweaver-geometry-lab-v1.mjs',import.meta.url),'utf8');
 assert.match(js,/projectWorld2D/);
 assert.match(js,/createOpenSim3DPreview/);
 assert.match(js,/worldLayout:/);
});
