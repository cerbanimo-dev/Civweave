/**
 * Deterministic, bounded 3D kinematic rehearsal for Guild Persona/Worldweaver.
 * This is genuine server-authoritative MOVEMENT OF SIMULATED 3D OBJECTS, not a
 * claim that the OpenSimulator grid or a physical robot was actuated.
 *
 * Source of truth: an authenticated Guild Durable Object transaction. The 3D
 * preview and its 2D projection derive from the same region object positions.
 * OpenSim-compatible axes: X east, Y north, Z up, distances in metres.
 */
import {OPENSIM_GEOMETRY_SCHEMA,validateOpenSimRegion} from './worldweaver-opensim-geometry-v1.mjs';

export const PERSONA_MOTION_SCHEMA='civweave.persona-motion-scene.v1';
const q={x:0,y:0,z:0,w:1};
const sizes={x:64,y:64};
const colors=['#b780aa','#66a5a0','#ddaf62','#8b9eb8','#c77d76','#9ba978'];
const finite=(x,a,b,name)=>{
 if(typeof x!=='number'||!Number.isFinite(x)||x<a||x>b)
   throw new TypeError('Invalid '+name);
 return x;
};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/.test(x);
const position=(v,label)=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||
    Object.keys(v).some(k=>!['x','y','z'].includes(k)))
   throw new TypeError('Invalid '+label);
 return {x:finite(v.x,0,sizes.x,label+'.x'),y:finite(v.y,0,sizes.y,label+'.y'),
   z:finite(v.z,0,4,label+'.z')};
};
const part=(code,kind,offset,scale,color)=>({
 id:code,name:kind,type:'cylinder',offset,rotation:q,scale,color
});
function staticSet(instanceId){
 return [
  {id:'fixture:floor',name:'Rehearsal floor',kind:'ground',instanceId,
    position:{x:32,y:32,z:-.2},rotation:q,
    parts:[{id:'prim:floor',name:'Ground',type:'box',offset:{x:0,y:0,z:0},
      rotation:q,scale:{x:62,y:62,z:.4},color:'#465b5b'}]},
  ...[{x:32,y:23},{x:32,y:41}].map((p,i)=>({
    id:'fixture:pillar:'+i,name:'Fixed stage column',kind:'obstacle',instanceId,
    position:{x:p.x,y:p.y,z:1.6},rotation:q,
    parts:[{id:'prim:pillar:'+i,name:'Pillar',type:'cylinder',
      offset:{x:0,y:0,z:0},rotation:q,scale:{x:2,y:2,z:3.2},color:'#82968a'}]
  }))
 ];
}
function avatar(instanceId,characterId,i,p){
 const color=colors[i%colors.length];
 return {id:'actor:'+characterId,name:characterId,kind:'actor-marker',instanceId,
   position:p,rotation:q,parts:[
   part('prim:body:'+characterId,'Body marker',{x:0,y:0,z:1}, {x:.7,y:.7,z:2},color),
   part('prim:head:'+characterId,'Head marker',{x:0,y:0,z:2.32},{x:.6,y:.6,z:.64},'#d5c7ba')
  ]};
}
/** Create one bounded region with character bodies, floor and obstacles. */
export function createPersonaMotionScene({roomId,instanceId,characters}={}){
 if(!id(roomId)||!id(instanceId)||!Array.isArray(characters)||!characters.length||
   characters.length>12||new Set(characters).size!==characters.length||
   characters.some(x=>!id(x)))throw new TypeError('Invalid 3D simulation roster.');
 const actors=characters.map((characterId,i)=>{
   const p={x:10+(i%4)*11,y:13+Math.floor(i/4)*6,z:0};
   return {characterId,position:p,velocity:{x:0,y:0,z:0}};
 });
 const result={schema:PERSONA_MOTION_SCHEMA,roomId,instanceId,revision:0,
   regionId:'rehearsal:'+roomId,size:{...sizes},source:'guild-authoritative-kinematic',
   actors,obstacles:[
     {id:'fixture:pillar:0',x:32,y:23,radius:1.3},
     {id:'fixture:pillar:1',x:32,y:41,radius:1.3}
   ],movements:[]};
 return validatePersonaMotionScene(result);
}
export function validatePersonaMotionScene(raw){
 if(!raw||typeof raw!=='object'||raw.schema!==PERSONA_MOTION_SCHEMA||
   !id(raw.roomId)||!id(raw.instanceId)||!id(raw.regionId)||
   !Number.isSafeInteger(raw.revision)||raw.revision<0||
   raw.size?.x!==sizes.x||raw.size?.y!==sizes.y||
   raw.source!=='guild-authoritative-kinematic'||
   !Array.isArray(raw.actors)||raw.actors.length<1||raw.actors.length>12||
   !Array.isArray(raw.obstacles)||raw.obstacles.length!==2||
   !Array.isArray(raw.movements)||raw.movements.length>64)
   throw new TypeError('Invalid authoritative Persona motion snapshot.');
 const seen=new Set();
 for(const a of raw.actors){
   if(!id(a.characterId)||seen.has(a.characterId))throw new TypeError('Duplicate avatar');
   seen.add(a.characterId);position(a.position,'avatar');
   if(a.position.z!==0)throw new TypeError('Rehearsal ground elevation is fixed at z=0.');
 }
 for(const b of raw.obstacles){
   if(!id(b.id))throw new TypeError('Invalid obstacle');
   finite(b.x,0,64,'obstacle.x');finite(b.y,0,64,'obstacle.y');
   finite(b.radius,.1,4,'obstacle.radius');
 }
 return structuredClone(raw);
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
/**
 * Resolve a maximum 2.5-metre movement using conservative swept-capsule
 * sampling (10 cm segments). No tunneling, teleporting or unsafe free Z input.
 * A new frame is committed ONLY after collision checking fully succeeds.
 */
export function movePersonaBody(source,{characterId,to,expectedRevision}={}){
 const s=validatePersonaMotionScene(source);
 if(s.revision!==expectedRevision)throw new Error('Stale 3D scene revision.');
 const actor=s.actors.find(x=>x.characterId===characterId);
 if(!actor)throw new RangeError('Unknown avatar in this simulation.');
 const target=position(to,'movement target');
 if(target.z!==0)throw new TypeError('Vertical motion requires a trusted physics/terrain provider.');
 if(target.x<1||target.x>63||target.y<1||target.y>63)
   throw new RangeError('Movement crosses the 3D stage boundary.');
 const start=actor.position,d=dist(start,target);
 if(d<.05||d>2.5)throw new RangeError('Movement must travel 0.05–2.5 metres per approved step.');
 for(let i=0;i<=Math.ceil(d/.1);i++){
   const t=i/Math.ceil(d/.1),p={x:start.x+(target.x-start.x)*t,
     y:start.y+(target.y-start.y)*t};
   if(s.obstacles.some(o=>Math.hypot(p.x-o.x,p.y-o.y)<o.radius+.45))
     throw new Error('Movement blocked by 3D collision geometry.');
   if(s.actors.some(other=>other.characterId!==characterId&&
     Math.hypot(p.x-other.position.x,p.y-other.position.y)<.9))
     throw new Error('Movement blocked by another character.');
 }
 actor.position=target;
 actor.velocity={x:target.x-start.x,y:target.y-start.y,z:0};
 s.revision++;
 const movement={id:'move:'+s.revision,characterId,from:start,to:target,
   distance:Math.round(d*1000)/1000,sceneRevision:s.revision};
 s.movements.push(movement);
 if(s.movements.length>64)s.movements.shift();
 return {scene:s,movement};
}
/** Exactly the same canonical 3D object list feeds the map and 3D viewer. */
export function personaMotionRegion(source){
 const s=validatePersonaMotionScene(source);
 const objects=[...staticSet(s.instanceId),...s.actors.map((a,i)=>
   avatar(s.instanceId,a.characterId,i,a.position))];
 return validateOpenSimRegion({schema:OPENSIM_GEOMETRY_SCHEMA,
   regionId:s.regionId,size:s.size,revision:s.revision,objects,
   source:'provisional-or-imported'});
}
