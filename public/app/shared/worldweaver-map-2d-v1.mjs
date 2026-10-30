/**
 * Worldweaver low-cost 2D projection.
 * Projects the SAME authorized Worldweaver snapshot that a 3D adapter consumes.
 * Never creates its own authority, polls a cloud server or runs agent inference.
 */
import {projectOpenSimPolygons3Dto2D} from './worldweaver-opensim-geometry-v1.mjs';

export const WORLD_MAP_2D_SCHEMA='civweave.worldweaver-map-2d.v1';
const copy=x=>JSON.parse(JSON.stringify(x));
const safeLabel=(x,n=100)=>typeof x==='string'?x.slice(0,n):'';
const point=(v,label)=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['x','y'].includes(k))||
  !Number.isFinite(v.x)||!Number.isFinite(v.y)||v.x<0||v.x>100||v.y<0||v.y>100)
   throw new TypeError('Invalid trusted map coordinate for '+label);
 return {x:v.x,y:v.y};
};
const cards=(row,index,total)=>({
 x:Math.min(92,13+(index%4)*25),
 y:Math.min(84,18+Math.floor(index/4)*29)
});
const kinds=new Set(['space','screen','npc','station','building']);
const bounded=(value,limit)=>Array.isArray(value)?value.slice(0,limit):[];
export function projectWorld2D(snapshot,{worldRef,layout={},includeDrafts=false}={}){
 if(!snapshot||!Array.isArray(snapshot.instances)||!Array.isArray(snapshot.screens)||!Array.isArray(snapshot.npcs)||
   !Array.isArray(snapshot.stations)||!Array.isArray(snapshot.intents))
   throw new TypeError('An authorized Worldweaver snapshot is required.');
 const focus=snapshot.instances.find(x=>x.id===worldRef);
 if(!focus)throw new RangeError('Unknown world reference.');
 if(!layout||typeof layout!=='object'||Array.isArray(layout))throw new TypeError('Trusted layout must be an object.');
 const scope=focus.guildId
  ?snapshot.instances.filter(x=>x.id===focus.id||(x.guildId===focus.guildId&&x.scope==='guild-map'&&x.status==='live'))
  :[focus];
 const visible=includeDrafts?scope:scope.filter(x=>x.id===focus.id||x.status==='live');
 const selected=bounded(visible,32);
 const geometry=layout.positions&&typeof layout.positions==='object'?layout.positions:{};
 const worldGeometry=layout.sceneGeometry?projectOpenSimPolygons3Dto2D(layout.sceneGeometry):null;
 const nodes=[],edges=[];
 const emit=(node,fallback)=>{
  const pos=Object.hasOwn(geometry,node.id)?point(geometry[node.id],node.id):fallback;
  nodes.push({...node,x:pos.x,y:pos.y,locationSource:Object.hasOwn(geometry,node.id)?'provider':'schematic'});
 };
 selected.forEach((space,i)=>{
  emit({id:space.id,type:'space',instanceId:space.id,label:safeLabel(space.title),
    kind:safeLabel(space.kind),status:safeLabel(space.status),focused:space.id===focus.id},cards(space,i,selected.length));
 });
 const parent=selected.find(x=>x.id===focus.id);
 if(parent){
  const base=nodes.find(n=>n.id===parent.id);
  const objects=[
   ...bounded(snapshot.screens.filter(x=>x.instanceId===focus.id),12).map(x=>({
    id:x.id,type:'screen',label:safeLabel(x.title),instanceId:focus.id,
    status:x.status,contentKind:x.current?.kind||null,
    recursivePortal:x.current?.kind==='civweave'})),
   ...bounded(snapshot.npcs.filter(x=>x.instanceId===focus.id),24).map(x=>({
    id:x.id,type:'npc',label:safeLabel(x.name),instanceId:focus.id,
    personaRef:safeLabel(x.personaRef||'',100),status:x.status})),
   ...bounded(snapshot.stations.filter(x=>x.instanceId===focus.id),32).map(x=>({
    id:x.id,type:'station',label:safeLabel(x.title),instanceId:focus.id,
    kind:safeLabel(x.stationType),status:'available'}))
  ];
  objects.slice(0,64).forEach((obj,i)=>{
   const ring=Math.floor(i/8)+1,angle=(i%8)*Math.PI/4;
   const fallback={x:Math.max(4,Math.min(96,base.x+Math.cos(angle)*ring*7)),
    y:Math.max(4,Math.min(96,base.y+Math.sin(angle)*ring*10))};
   emit(obj,fallback);
   edges.push({from:focus.id,to:obj.id,kind:'contains'});
  });
 }
 // Schematic connections are not navigable roads. Only provider-supplied paths
 // may later authorize actual travel/movement.
 const visibleIds=new Set(selected.map(x=>x.id));
 const canSee=p=>p.instanceId!=null&&visibleIds.has(p.instanceId);
 const polygons=worldGeometry?worldGeometry.footprints.filter(canSee).map(p=>({
  id:p.id,objectId:p.objectId,instanceId:p.instanceId,label:safeLabel(p.name),
  type:'prim-footprint',quality:p.quality,points:p.points})): [];
 const facePolygons=worldGeometry?worldGeometry.projectedFaces.filter(canSee):[];
 const buildingPolygons=worldGeometry?worldGeometry.buildings.filter(canSee).map(p=>({
  id:p.id,objectId:p.id,label:safeLabel(p.name),instanceId:p.instanceId,
  kind:p.kind,quality:p.quality,points:p.points})): [];
 for(const polygon of buildingPolygons){
  if(polygon.kind==='path'||polygon.points.length<3)continue;
  const centre={x:polygon.points.reduce((a,b)=>a+b.x,0)/polygon.points.length,
   y:polygon.points.reduce((a,b)=>a+b.y,0)/polygon.points.length};
  emit({id:polygon.id,type:'building',instanceId:polygon.instanceId,label:polygon.label,
   kind:'building',status:'built',geometryObjectId:polygon.objectId},centre);
 }
 return copy({schema:WORLD_MAP_2D_SCHEMA,revision:snapshot.revision??0,worldRef:focus.id,
  focusedTitle:safeLabel(focus.title),coordinateSpace:'normalized-percent',
  geometryStatus:worldGeometry?'opensim-world-geometry':Object.keys(geometry).length?'mixed-provider-and-schematic':'schematic-only',
  geometryRevision:worldGeometry?.revision??null,geometryRegionId:worldGeometry?.regionId??null,
  nodes,edges,polygons,buildingPolygons,facePolygons,
  pendingIntents:snapshot.intents.filter(x=>x.instanceId===focus.id&&['queued','review-required'].includes(x.status)).length});
}
/** Model-friendly accessibility channel. Tool actions are *suggestions* and must
 * be dispatched through Worldweaver's authenticated tool authorizer.
 * No prompts, payment keys, ballot state, hidden drafts or model internals.
 */
export function observeWorld2D(snapshot,options={}){
 const map=projectWorld2D(snapshot,options);
 return {schema:WORLD_MAP_2D_SCHEMA,worldRef:map.worldRef,revision:map.revision,
  geometryStatus:map.geometryStatus,
  geometryRevision:map.geometryRevision,
  polygons:(map.polygons||[]).map(p=>({id:p.id,objectId:p.objectId,quality:p.quality,points:p.points})),
  entities:map.nodes.map(n=>({id:n.id,type:n.type,label:n.label,x:n.x,y:n.y,
   ...(n.type==='screen'?{media:n.contentKind||'blank',recursivePortal:n.recursivePortal}:{}),
   ...(n.type==='npc'?{persona:n.personaRef}:{}),
   actions:n.type==='screen'?['inspect','cast-screen']:n.type==='space'?['inspect','navigate-request']:['inspect']})),
  pendingIntents:map.pendingIntents};
}
/** A browser DOM projection, no canvas/WebGL/GPU required.
 * Recursive in-world Civweave screens become a labeled single-depth portal.
 */
export function renderWorldMap2D(projected,{documentRef=globalThis.document,onActivate,embedded=false,selectedObjectId=null}={}){
 if(!projected||projected.schema!==WORLD_MAP_2D_SCHEMA)throw new TypeError('Invalid map projection.');
 if(!documentRef?.createElement)return {schema:projected.schema,nodeCount:projected.nodes.length,
  nodes:copy(projected.nodes),recursivePortalCount:projected.nodes.filter(x=>x.recursivePortal).length};
 const root=documentRef.createElement('div');
 root.className='cw-world-map-2d'+(embedded?' cw-world-map-embedded':'');
 root.setAttribute('role','region');root.setAttribute('aria-label','Worldweaver 2D live world map');
 root.style.cssText='display:flex;flex-direction:column;gap:8px;width:100%;height:100%;min-height:180px;color:#f5f2ff;background:#101827;';
 const header=documentRef.createElement('p');
 header.style.cssText='margin:0;padding:8px;font:600 13px system-ui;background:#24364b';
 header.textContent='Civweave · 2D World · '+projected.focusedTitle+' · revision '+projected.revision+
  (projected.geometryStatus==='schematic-only'?' · schematic layout':'');
 root.append(header);
 const area=documentRef.createElement('div');
 area.setAttribute('role','group');area.setAttribute('aria-label','World locations and active objects');
 area.style.cssText='position:relative;flex:1;min-height:150px;overflow:hidden;border:1px solid #40516c;border-radius:8px;background:#172c31';
 if(projected.polygons?.length){
  const svg=documentRef.createElementNS?.('http://www.w3.org/2000/svg','svg');
  if(svg){
   svg.setAttribute('viewBox','0 0 100 100');
   svg.setAttribute('preserveAspectRatio','none');
   svg.setAttribute('aria-label','Projected OpenSimulator polygons');
   svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
   const draw=(poly,fill,stroke,opacity)=>{
    if(poly.points.length<3)return;
    const el=documentRef.createElementNS('http://www.w3.org/2000/svg','polygon');
    el.setAttribute('points',poly.points.map(p=>p.x+','+p.y).join(' '));
    el.setAttribute('fill',fill);el.setAttribute('stroke',stroke);
    el.setAttribute('stroke-width','.2');el.setAttribute('opacity',opacity);
    el.setAttribute('data-geometry-id',poly.id);svg.append(el);
   };
   for(const face of projected.facePolygons||[])draw(face,face.color||'#508c7c','none','.12');
   for(const prim of projected.polygons)draw(prim,'#8acaba','#ddffe7','.38');
   for(const object of projected.buildingPolygons||[]){
    draw(object,'none',object.id===selectedObjectId?'#ffef9e':'#e4ffb0','.9');
   }
   area.append(svg);
  }
 }
 for(const n of projected.nodes){
  if(!kinds.has(n.type))continue;
  const button=documentRef.createElement('button');
  button.type='button';button.style.cssText='position:absolute;left:'+n.x+'%;top:'+n.y+
   '%;transform:translate(-50%,-50%);font:12px system-ui;max-width:130px;min-height:30px;'+
   'padding:4px 7px;border:1px solid #879fa9;border-radius:7px;color:#fff;background:#244e63;cursor:pointer';
  button.textContent=(n.type==='screen'?'▣ ':n.type==='npc'?'◉ ':n.type==='station'?'✦ ':'⌂ ')+
   (n.recursivePortal?'Civweave ↳ 2D (no infinite mirrors)':n.label);
  button.title=n.type+' · '+n.label;
  if(n.id===selectedObjectId)button.style.outline='2px solid #fff0a8';
  button.setAttribute('aria-label',n.type+' '+n.label+
   (n.recursivePortal?' · returns to this two-dimensional world, recursion intentionally capped':''));
  button.addEventListener('click',()=>{
   if(typeof onActivate==='function')onActivate({type:'inspect',objectType:n.type,
    objectId:n.id,instanceId:n.instanceId,recursivePortal:Boolean(n.recursivePortal)});
  });
  area.append(button);
 }
 root.append(area);
 const legend=documentRef.createElement('p');
 legend.style.cssText='margin:0;padding:4px 8px;font:11px system-ui;color:#c8d2e5';
 legend.textContent=projected.nodes.length+' mapped entities · '+projected.pendingIntents+
  ' pending actions · accessible without 3D rendering';
 root.append(legend);
 return root;
}
/** Refresh from the host's authenticated snapshot subscription. The lab can
 * call update manually after local actions; remote realtime requires a trusted
 * persistent sync stream, not a BroadcastChannel identity shortcut.
 */
export function createWorldMap2DView({getSnapshot,getLayout,worldRef,container,subscribe,onActivate,includeDrafts=false}={}){
 if(typeof getSnapshot!=='function'||!container?.replaceChildren)throw new TypeError('Map requires a snapshot provider and DOM container.');
 let closed=false;
 const update=()=>{
  if(closed)return null;
  const projection=projectWorld2D(getSnapshot(),{worldRef,includeDrafts,layout:typeof getLayout==='function'?getLayout():{}});
  const node=renderWorldMap2D(projection,{documentRef:container.ownerDocument||globalThis.document,onActivate});
  container.replaceChildren(node);
  return projection;
 };
 const unsubscribe=typeof subscribe==='function'?subscribe(update):null;
 update();
 return {update,close(){closed=true;if(typeof unsubscribe==='function')unsubscribe()}};
}
