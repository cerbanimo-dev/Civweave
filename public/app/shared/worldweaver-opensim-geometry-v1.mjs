/**
 * OpenSimulator-compatible geometry ingestion for Worldweaver.
 *
 * Expects a PRE-AUTHORIZED, normalized region-module export. It does not talk to
 * OpenSim's public grid, RemoteAdmin or region database directly.
 * Axes: OpenSim-style X east, Y north, Z up; meters; XY is the map plane.
 * Each part's offset and rotation are relative to the group pivot. Mesh vertices
 * are unit-scale LOCAL coordinates, multiplied by the part scale before rotation.
 */
export const OPENSIM_GEOMETRY_SCHEMA='civweave.opensim-region-geometry.v1';
const allowed=(x,keys,label)=>{
 if(!x||typeof x!=='object'||Array.isArray(x))throw new TypeError(label+' must be an object');
 const unsupported=Object.keys(x).filter(k=>!keys.includes(k));
 if(unsupported.length)throw new TypeError('Unexpected '+label+' field: '+unsupported.join(','));
};
const identifier=(x,label)=>{
 if(typeof x!=='string'||!(/^[a-zA-Z0-9][a-zA-Z0-9:._/-]{0,179}$/).test(x)||x.includes('..'))throw new TypeError('Invalid '+label);
 return x;
};
const label=(x,max=100)=>typeof x==='string'?x.trim().slice(0,max):'';
const scalar=(x,lo,hi,name)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi)throw new TypeError('Invalid '+name);return x;};
const vector=(v,name,lo=-16384,hi=16384)=>{
 allowed(v,['x','y','z'],name);
 return {x:scalar(v.x,lo,hi,name+'.x'),y:scalar(v.y,lo,hi,name+'.y'),z:scalar(v.z,lo,hi,name+'.z')};
};
const quaternion=(v)=>{
 if(v==null)return {x:0,y:0,z:0,w:1};
 allowed(v,['x','y','z','w'],'quaternion');
 const q={x:scalar(v.x,-1,1,'qx'),y:scalar(v.y,-1,1,'qy'),z:scalar(v.z,-1,1,'qz'),w:scalar(v.w,-1,1,'qw')};
 const length=Math.hypot(q.x,q.y,q.z,q.w);
 if(length<0.00001)throw new TypeError('Zero-length rotation quaternion');
 return {x:q.x/length,y:q.y/length,z:q.z/length,w:q.w/length};
};
const rotate=(v,q)=>{
 const ux=q.x,uy=q.y,uz=q.z,w=q.w;
 const tx=2*(uy*v.z-uz*v.y),ty=2*(uz*v.x-ux*v.z),tz=2*(ux*v.y-uy*v.x);
 return {x:v.x+w*tx+(uy*tz-uz*ty),y:v.y+w*ty+(uz*tx-ux*tz),z:v.z+w*tz+(ux*ty-uy*tx)};
};
const plus=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const rectVertices=[
 [-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],
 [-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]
].map(([x,y,z])=>({x,y,z}));
const boxTriangles=[
 [0,1,2],[0,2,3],[4,6,5],[4,7,6],
 [0,4,5],[0,5,1],[1,5,6],[1,6,2],
 [2,6,7],[2,7,3],[3,7,4],[3,4,0]
];
function primitive(kind){
 if(kind==='box')return {vertices:rectVertices,triangles:boxTriangles,quality:'exact-primitive'};
 if(kind==='cylinder'){
  const sides=24,vertices=[],triangles=[];
  for(let i=0;i<sides;i++){
   const a=2*Math.PI*i/sides;
   vertices.push({x:Math.cos(a)/2,y:Math.sin(a)/2,z:-.5});
   vertices.push({x:Math.cos(a)/2,y:Math.sin(a)/2,z:.5});
  }
  vertices.push({x:0,y:0,z:-.5},{x:0,y:0,z:.5});
  for(let i=0;i<sides;i++){
   const j=(i+1)%sides;
   triangles.push([2*i,2*j,2*j+1],[2*i,2*j+1,2*i+1],[sides*2,2*j,2*i],[sides*2+1,2*i+1,2*j+1]);
  }
  return {vertices,triangles,quality:'faceted-primitive'};
 }
 throw new TypeError('Unsupported prim type; mesh data or explicit fallback required');
}
const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
export function convexHull2D(points){
 if(!Array.isArray(points)||!points.length)return [];
 const sorted=[...points].map(p=>({x:scalar(p.x,-32768,32768,'polygon x'),y:scalar(p.y,-32768,32768,'polygon y')}))
  .sort((a,b)=>a.x-b.x||a.y-b.y).filter((p,i,a)=>i===0||p.x!==a[i-1].x||p.y!==a[i-1].y);
 if(sorted.length<3)return sorted;
 const lower=[],upper=[];
 for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=1e-9)lower.pop();lower.push(p);}
 for(let i=sorted.length-1;i>=0;i--){const p=sorted[i];while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=1e-9)upper.pop();upper.push(p);}
 return lower.slice(0,-1).concat(upper.slice(0,-1));
}
const polygonArea=p=>p.reduce((a,x,i)=>a+x.x*p[(i+1)%p.length].y-p[(i+1)%p.length].x*x.y,0)/2;
export function validateOpenSimRegion(raw){
 allowed(raw,['schema','regionId','size','revision','objects','source'],'region');
 if(raw.schema!==OPENSIM_GEOMETRY_SCHEMA)throw new TypeError('Unknown OpenSimulator geometry schema');
 const regionId=identifier(raw.regionId,'region');
 allowed(raw.size,['x','y'],'region size');
 const size={x:scalar(raw.size.x,16,4096,'region width'),y:scalar(raw.size.y,16,4096,'region height')};
 const revision=scalar(raw.revision,0,Number.MAX_SAFE_INTEGER,'revision');
 if(!Array.isArray(raw.objects)||raw.objects.length>256)throw new TypeError('Too many region objects');
 const objectIds=new Set(),globalPartIds=new Set(),objects=[];let totalFaces=0;
 for(const rawObject of raw.objects){
  allowed(rawObject,['id','name','position','rotation','parts','kind','instanceId'],'object');
  const id=identifier(rawObject.id,'object ID');
  if(objectIds.has(id))throw new TypeError('Duplicate OpenSim object ID');
  objectIds.add(id);
  const position=vector(rawObject.position,'position');
  const rotation=quaternion(rawObject.rotation);
  if(!Array.isArray(rawObject.parts)||rawObject.parts.length===0||rawObject.parts.length>64)
   throw new TypeError('Object has invalid prim/link count');
  const partIds=new Set(),parts=[];
  for(const rawPart of rawObject.parts){
   allowed(rawPart,['id','name','type','offset','rotation','scale','vertices','triangles','color'],'prim');
   const partId=identifier(rawPart.id,'prim ID');
   if(partIds.has(partId)||globalPartIds.has(partId))throw new TypeError('Duplicate prim ID');
   partIds.add(partId);globalPartIds.add(partId);
   const type=rawPart.type;
   if(!['box','cylinder','mesh'].includes(type))throw new TypeError('Unsupported prim type');
   const offset=vector(rawPart.offset,'part offset');
   const scale=vector(rawPart.scale,'part scale',0.001,256);
   const partRot=quaternion(rawPart.rotation);
   let mesh;
   if(type==='mesh'){
    if(!Array.isArray(rawPart.vertices)||rawPart.vertices.length<3||rawPart.vertices.length>2048||
     !Array.isArray(rawPart.triangles)||rawPart.triangles.length<1||rawPart.triangles.length>4096)
      throw new TypeError('Mesh vertices/triangle limits exceeded');
    const vertices=rawPart.vertices.map(v=>vector(v,'mesh vertex',-128,128));
    const triangles=rawPart.triangles.map(t=>{
     if(!Array.isArray(t)||t.length!==3||t.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length))
      throw new TypeError('Invalid mesh triangle');
     return [...t];
    });
    mesh={vertices,triangles,quality:'exact-supplied-mesh'};
   }else{
    if(rawPart.vertices!==undefined||rawPart.triangles!==undefined)throw new TypeError('Primitive geometry must use canonical shape');
    mesh=primitive(type);
   }
   totalFaces+=mesh.triangles.length;
   if(totalFaces>18000)throw new TypeError('Region face budget exceeded');
   const color=rawPart.color??'#658d80';
   if(typeof color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(color))throw new TypeError('Invalid prim color');
   parts.push({id:partId,name:label(rawPart.name)||partId,type,offset,rotation:partRot,scale,
    mesh,color:color.toLowerCase()});
  }
  objects.push({id,name:label(rawObject.name)||id,kind:label(rawObject.kind)||'object',
   instanceId:rawObject.instanceId?identifier(rawObject.instanceId,'instance ID'):null,
   position,rotation,parts});
 }
 return {schema:OPENSIM_GEOMETRY_SCHEMA,regionId,size,revision,objects,
  source:raw.source==='opensim-region-module'?'opensim-region-module':'provisional-or-imported'};
}
/** World-space vertices and the original 3D faces. No geometry is re-authored
 * when projecting the 2D map; both viewers consume these same triangles.
 */
export function buildOpenSimGeometry(raw){
 const source=validateOpenSimRegion(raw),objects=[],faces=[],footprints=[];
 for(const obj of source.objects){
  const partFootprints=[],partIds=[];
  for(const part of obj.parts){
   const vertices=part.mesh.vertices.map(p=>{
    const scaled={x:p.x*part.scale.x,y:p.y*part.scale.y,z:p.z*part.scale.z};
    return plus(obj.position,rotate(plus(part.offset,rotate(scaled,part.rotation)),obj.rotation));
   });
   const hull=convexHull2D(vertices);
   const footprint={id:part.id,objectId:obj.id,instanceId:obj.instanceId,
    name:part.name,points:hull,quality:part.mesh.quality==='exact-supplied-mesh'?'convex-hull-of-mesh':part.mesh.quality,
    zMin:Math.min(...vertices.map(p=>p.z)),zMax:Math.max(...vertices.map(p=>p.z))};
   partFootprints.push(footprint);footprints.push(footprint);partIds.push(part.id);
   part.mesh.triangles.forEach((triangle,index)=>{
    const v=triangle.map(i=>vertices[i]);
    const flat=v.map(({x,y})=>({x,y}));
    faces.push({id:part.id+':'+index,objectId:obj.id,partId:part.id,instanceId:obj.instanceId,
     vertices:v,xy:Math.abs(polygonArea(flat))>1e-7?flat:[],color:part.color});
   });
  }
  const points=partFootprints.flatMap(p=>p.points);
  objects.push({id:obj.id,name:obj.name,kind:obj.kind,instanceId:obj.instanceId,
   partIds,footprint:convexHull2D(points),quality:partFootprints.some(p=>p.quality==='convex-hull-of-mesh')?
    'conservative-hull':'primitive-envelope',position:obj.position});
 }
 return {schema:OPENSIM_GEOMETRY_SCHEMA,regionId:source.regionId,revision:source.revision,size:source.size,
  source:source.source,objects,footprints,faces};
}
const convert=(p,size)=>({x:Number((p.x/size.x*100).toFixed(5)),y:Number(((1-p.y/size.y)*100).toFixed(5))});
/** Traces each projected 2D face to its originating 3D face and object.
 * The 2D Y axis is flipped (north at the top).
 */
export function projectOpenSimPolygons3Dto2D(geometry){
 if(geometry?.schema!==OPENSIM_GEOMETRY_SCHEMA||!Array.isArray(geometry.faces))
  throw new TypeError('Built OpenSimulator geometry required');
 const norm=points=>points.map(p=>convert(p,geometry.size));
 return {regionId:geometry.regionId,revision:geometry.revision,source:geometry.source,
  footprints:geometry.footprints.map(p=>({...p,points:norm(p.points)})),
  buildings:geometry.objects.map(o=>({...o,points:norm(o.footprint)})),
  projectedFaces:geometry.faces.filter(f=>f.xy.length>=3).map(f=>({
   id:f.id,objectId:f.objectId,partId:f.partId,instanceId:f.instanceId,
   points:norm(f.xy),color:f.color,projection:'orthographic-xy'}))};
}
