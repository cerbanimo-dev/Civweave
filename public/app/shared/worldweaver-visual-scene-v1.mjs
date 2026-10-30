/**
 * Provisional mesh/prim assembly using ACTUAL district titles in the 2026
 * visual-world route (public/app/civweave-living-world.js). Distances, building
 * footprints, material choices and orientations are NEW illustrative geometry,
 * not recovered architecture. Replace with an OpenSim region-module export
 * or correctly sourced historical geometry when available.
 */
import {OPENSIM_GEOMETRY_SCHEMA} from './worldweaver-opensim-geometry-v1.mjs';
export const LEGACY_VISUAL_SOURCE='public/app/civweave-living-world.js';
const districts=[
 ['square','Town Square / Quad','#4caea4'],
 ['crossroads','Crossroads Station','#b6a56b'],
 ['home','Residential Quarter','#b1a4b6'],
 ['workshop','Workshop District','#ad854f'],
 ['gardens','Gardens & Wildlands','#568763'],
 ['harbor','Federation Harbor','#5786ac'],
 ['archive','Archive District','#bb9f72'],
 ['festival','Festival Grounds','#ad7f92'],
 ['frontier','The Frontier','#a89a6b'],
 ['undercity','The Undercity','#65747e'],
 ['dispatch','Dispatch Hall','#a5a2b3'],
 ['chronicle','Personal Chronicle','#8fa58c'],
 ['settings','World Settings & Accessibility Hall','#8b9caf']
];
const identity={x:0,y:0,z:0,w:1};
function box(id,name,scale,offset,color){return {id,name,type:'box',offset,rotation:identity,scale,color};}
function roof(id,width,depth,color){
 return {id,name:'Pitched roof',type:'mesh',offset:{x:0,y:0,z:0},
  rotation:identity,scale:{x:1,y:1,z:1},color,
  vertices:[
   {x:-width/2,y:-depth/2,z:0},{x:width/2,y:-depth/2,z:0},
   {x:width/2,y:depth/2,z:0},{x:-width/2,y:depth/2,z:0},
   {x:0,y:-depth/2,z:4},{x:0,y:depth/2,z:4}
  ],
  triangles:[[0,1,4],[3,5,2],[0,4,5],[0,5,3],[1,2,5],[1,5,4],[0,3,2],[0,2,1]]
 };
}
export function createProvisionalOpenSimScene({instanceId='demo:commune',revision=1}={}){
 if(!/^[a-zA-Z0-9][a-zA-Z0-9:._/-]{0,179}$/.test(instanceId))throw new TypeError('Invalid instance ID');
 const objects=districts.map(([id,name,color],i)=>{
  const isCentre=i===0,a=(i-1)*Math.PI*2/(districts.length-1);
  const x=isCentre?128:128+94*Math.cos(a),y=isCentre?128:128+94*Math.sin(a);
  const width=isCentre?30:18,depth=isCentre?28:16,height=isCentre?17:10;
  const rot=isCentre?0:a+.25;
  return {id:'visual:'+id,name,kind:'building',instanceId,
   position:{x,y,z:height/2},rotation:{x:0,y:0,z:Math.sin(rot/2),w:Math.cos(rot/2)},
   parts:[
    box('visual:'+id+':walls','Walls',{x:width,y:depth,z:height},{x:0,y:0,z:0},color),
    roof('visual:'+id+':roof',width,depth,'#d0b38d')
   ].map(part=>part.type==='mesh'?{...part,offset:{x:0,y:0,z:height/2}}:part)};
 });
 // Path geometry is itself a 3D object: 2D walkways are projected from prims.
 for(let i=1;i<districts.length;i++){
  const a=(i-1)*Math.PI*2/(districts.length-1);
  const len=77,mid=42;
  objects.push({id:'route:'+districts[i][0],name:'Walkway to '+districts[i][1],
   kind:'path',instanceId,position:{x:128+mid*Math.cos(a),y:128+mid*Math.sin(a),z:.05},
   rotation:{x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)},parts:[
    box('route:'+districts[i][0]+':paving','Path surface',
    {x:len,y:4,z:.1},{x:0,y:0,z:0},'#9eaa96')
   ]});
 }
 return {schema:OPENSIM_GEOMETRY_SCHEMA,regionId:'visual-civweave-provisional',
  size:{x:256,y:256},revision,source:'provisional-or-imported',objects};
}
export const LEGACY_VISUAL_DISTRICTS=Object.freeze(districts.map(([id,name])=>Object.freeze({id,name})));
