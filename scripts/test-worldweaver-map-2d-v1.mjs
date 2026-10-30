import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {WORLD_MAP_2D_SCHEMA,projectWorld2D,observeWorld2D,renderWorldMap2D,createWorldMap2DView} from '../public/app/shared/worldweaver-map-2d-v1.mjs';
import {normalizeScreenContent,renderWorldScreen} from '../public/app/shared/worldweaver-screen-v1.mjs';

let count=0;
const human={kind:'human',principalId:'verified-human',verified:true};
const model={kind:'model',principalId:'verified-model',modelId:'qwen:4b',verified:true};
const runtime={kind:'runtime',principalId:'trusted-runtime',verified:true};
function setup(){
 const world=createWorldweaver({id:()=>`map-${++count}`,authorize:({actor})=>actor.verified===true});
 const create=(title,guildId='guild-1')=>{
  const x=world.dispatch({type:'create',guide:'moss',title,scope:'guild-map',guildId},human).instance;
  return x;
 };
 const one=create('School'),two=create('Shop'),other=create('Different Guild','guild-2');
 for(const room of [two,other]){
  world.dispatch({type:'request-provision',instanceId:room.id},human);
  world.dispatch({type:'provisioned',instanceId:room.id,backend:'local-renderer',worldRef:'host-'+room.id},runtime);
 }
 const screen=world.dispatch({type:'create-screen',instanceId:one.id,title:'Civweave Weave Screen'},human).screen;
 const npc=world.dispatch({type:'rig-npc',instanceId:one.id,name:'Moss instructor',modelId:model.modelId,
  pilotPrompt:'INTERNAL SECRET NOT FOR OBSERVATION',capabilities:['observe','cast-screen']},model).npc;
 const station=world.dispatch({type:'add-station',instanceId:one.id,stationType:'practice',title:'Interactive Lesson',instructions:'PRIVATE INSTRUCTIONS'},human).station;
 return {world,one,two,other,screen,npc,station};
}
const app=worldRef=>({kind:'civweave',source:{worldRef},title:'Civweave inside Civweave'});
test('native Civweave media is not arbitrary website or third-party iframe',()=>{
 const content=normalizeScreenContent(app('map-one'));
 assert.equal(content.kind,'civweave');
 assert.deepEqual(content.source,{worldRef:'map-one'});
 for(const source of [{worldRef:'../evil'},{worldRef:'yes',url:'https://example.org'}, {url:'https://example.org'}])
  assert.throws(()=>normalizeScreenContent({kind:'civweave',source,title:'Civweave'}),/world|field/i);
 assert.throws(()=>normalizeScreenContent({kind:'civweave',source:{worldRef:'other'},title:'X',html:'<script>alert(1)</script>'}),/Unsupported field/);
});
test('human and model cannot cast a different world into their own screen',()=>{
 const {world,one,other,screen,npc}=setup();
 assert.throws(()=>world.dispatch({type:'cast-screen',screenId:screen.id,content:app(other.id)},human),/own|world/i);
 assert.throws(()=>world.dispatch({type:'queue-actions',npcId:npc.id,actions:[
  {tool:'cast-screen',args:{screenId:screen.id,content:app(other.id)}}]},model),/different world/i);
 assert.equal(world.snapshot().screens.find(x=>x.id===screen.id).current,null);
 assert.equal(world.dispatch({type:'cast-screen',screenId:screen.id,content:app(one.id)},human).screen.current.kind,'civweave');
});
test('2D projection sees authorized room state, hides other Guild and private model prompts',()=>{
 const {world,one,two,other,screen,npc,station}=setup();
 world.dispatch({type:'cast-screen',screenId:screen.id,content:app(one.id)},human);
 const view=projectWorld2D(world.snapshot(),{worldRef:one.id});
 assert.equal(view.schema,WORLD_MAP_2D_SCHEMA);
 assert.equal(view.geometryStatus,'schematic-only');
 assert.ok(view.nodes.some(x=>x.id===one.id&&x.type==='space'));
 assert.ok(view.nodes.some(x=>x.id===two.id&&x.type==='space'));
 assert.equal(view.nodes.some(x=>x.id===other.id),false);
 const screenNode=view.nodes.find(x=>x.id===screen.id);
 assert.equal(screenNode.recursivePortal,true);
 assert.ok(view.nodes.some(x=>x.id===npc.id&&x.type==='npc'));
 assert.ok(view.nodes.some(x=>x.id===station.id&&x.type==='station'));
 const observed=JSON.stringify(observeWorld2D(world.snapshot(),{worldRef:one.id}));
 assert.doesNotMatch(observed,/INTERNAL SECRET|PRIVATE INSTRUCTIONS/);
 assert.match(observed,/Civweave Weave Screen/);
 assert.match(observed,/navigate-request/);
});
test('nested Civweave screen is a one-depth functional 2D projection, not infinite iframe recursion',()=>{
 const {world,one,screen}=setup();
 world.dispatch({type:'cast-screen',screenId:screen.id,content:app(one.id)},human);
 const state=world.snapshot();
 const meta=renderWorldScreen(state.screens.find(x=>x.id===screen.id).current,{worldState:state,documentRef:null});
 assert.equal(meta.kind,'civweave');
 assert.equal(meta.origin,'internal');
 assert.equal(meta.mapSchema,WORLD_MAP_2D_SCHEMA);
 assert.equal(meta.mapRevision,state.revision);
 const view=projectWorld2D(state,{worldRef:one.id});
 const flat=renderWorldMap2D(view,{documentRef:null,embedded:true});
 assert.equal(flat.recursivePortalCount,1);
 assert.ok(flat.nodes.find(x=>x.id===screen.id).recursivePortal);
 const screenSource=readFileSync(new URL('../public/app/shared/worldweaver-screen-v1.mjs',import.meta.url),'utf8');
 assert.match(screenSource,/renderWorldMap2D/);
 assert.doesNotMatch(screenSource,/iframe[^\n]*src[^\n]*Civweave/);
});
test('map updates to the same snapshot revision after screen casts and clear',()=>{
 const {world,one,screen}=setup();
 const a=projectWorld2D(world.snapshot(),{worldRef:one.id});
 assert.equal(a.nodes.find(n=>n.id===screen.id).contentKind,null);
 world.dispatch({type:'cast-screen',screenId:screen.id,content:app(one.id)},human);
 const b=projectWorld2D(world.snapshot(),{worldRef:one.id});
 assert.ok(b.revision>a.revision);
 assert.equal(b.nodes.find(n=>n.id===screen.id).contentKind,'civweave');
 world.dispatch({type:'clear-screen',screenId:screen.id},human);
 const c=projectWorld2D(world.snapshot(),{worldRef:one.id});
 assert.equal(c.nodes.find(n=>n.id===screen.id).contentKind,null);
});
test('authoritative geometry can be supplied, fallback is explicitly schematic',()=>{
 const {world,one,screen}=setup();
 const layout={positions:{[one.id]:{x:33,y:17},[screen.id]:{x:48,y:55}}};
 const p=projectWorld2D(world.snapshot(),{worldRef:one.id,layout});
 assert.equal(p.nodes.find(n=>n.id===one.id).x,33);
 assert.equal(p.nodes.find(n=>n.id===screen.id).y,55);
 assert.equal(p.nodes.find(n=>n.id===screen.id).locationSource,'provider');
 assert.throws(()=>projectWorld2D(world.snapshot(),{worldRef:one.id,layout:{positions:{[one.id]:{x:999,y:0}}}}),/coordinate/i);
 assert.throws(()=>projectWorld2D(world.snapshot(),{worldRef:'missing'}),/Unknown world/);
});
test('host subscription repaints map when authoritative snapshot changes, and unsubscribe works',()=>{
 const {world,one,screen}=setup();
 const doc={createElement(tag){
  return {tag,style:{},setAttribute(){},addEventListener(){},append(){},textContent:'',title:''}
 }};
 const container={ownerDocument:doc,replaceChildren(node){this.node=node;this.count=(this.count||0)+1}};
 let publish;
 let removed=false;
 const view=createWorldMap2DView({getSnapshot:()=>world.snapshot(),worldRef:one.id,container,
  subscribe:notify=>{publish=notify;return()=>removed=true}});
 assert.equal(container.count,1);
 world.dispatch({type:'cast-screen',screenId:screen.id,content:app(one.id)},human);
 publish();
 assert.equal(container.count,2);
 const map=view.update();
 assert.equal(map.nodes.find(n=>n.id===screen.id).recursivePortal,true);
 view.close();publish();
 assert.equal(removed,true);assert.equal(container.count,3);
});
test('a compact map demo exists without WebGPU or a parallel user identity runtime',()=>{
 const html=readFileSync(new URL('../public/app/tools/worldweaver-map-lab.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/app/tools/worldweaver-map-lab-v1.mjs',import.meta.url),'utf8');
 assert.match(html,/Worldweaver 2D/);
 assert.match(html,/aria-label="Compact machine-readable map observation"/);
 assert.match(js,/projectWorld2D/);
 assert.match(js,/observeWorld2D/);
 assert.match(js,/renderWorldScreen/);
 assert.doesNotMatch(js,/WebGPU|navigator\.gpu|new Worker\(/);
});
