/**
 * Small local, dependency-free perspective viewer for the exact face geometry
 * exported by an OpenSimulator region module. Not an OpenSim viewer protocol
 * client: Firestorm/compatible native viewers remain the multiplayer 3D client.
 */
import {OPENSIM_GEOMETRY_SCHEMA} from './worldweaver-opensim-geometry-v1.mjs';
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const unit=a=>{const l=Math.hypot(a.x,a.y,a.z)||1;return {x:a.x/l,y:a.y/l,z:a.z/l}};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=(x,a,b,label)=>{if(!Number.isFinite(x)||x<a||x>b)throw new TypeError('Invalid '+label);return x;};
const pixel=v=>Math.round(v*100)/100;
export function projectOpenSimFaces3D(geometry,{width=720,height=460,yaw=.9,pitch=.55,distance=300,target}={}){
 if(geometry?.schema!==OPENSIM_GEOMETRY_SCHEMA||!Array.isArray(geometry.faces))
  throw new TypeError('Built OpenSimulator scene required');
 finite(width,100,4096,'viewport width');finite(height,100,4096,'viewport height');
 finite(yaw,-1000,1000,'yaw');finite(pitch,.03,1.5,'pitch');finite(distance,8,3000,'camera distance');
 const focus=target??{x:geometry.size.x/2,y:geometry.size.y/2,z:16};
 const cam={
  x:focus.x+distance*Math.cos(pitch)*Math.cos(yaw),
  y:focus.y+distance*Math.cos(pitch)*Math.sin(yaw),
  z:focus.z+distance*Math.sin(pitch)
 };
 const f=unit(sub(focus,cam)),right=unit(cross(f,{x:0,y:0,z:1})),up=unit(cross(right,f));
 const focal=Math.min(width,height)*1.08;
 const projected=[];
 for(const face of geometry.faces){
  const pts=[];
  for(const v of face.vertices){
   const rel=sub(v,cam),depth=dot(rel,f);
   if(depth<=.1){pts.length=0;break;}
   pts.push({x:pixel(width/2+dot(rel,right)*focal/depth),
    y:pixel(height/2-dot(rel,up)*focal/depth),depth});
  }
  if(pts.length!==3)continue;
  projected.push({id:face.id,partId:face.partId,objectId:face.objectId,color:face.color,
   points:pts,depth:(pts[0].depth+pts[1].depth+pts[2].depth)/3});
 }
 projected.sort((a,b)=>b.depth-a.depth);
 return {width,height,camera:cam,target:focus,faces:projected,revision:geometry.revision};
}
function contains(triangle,x,y){
 const [a,b,c]=triangle;
 const v0x=c.x-a.x,v0y=c.y-a.y,v1x=b.x-a.x,v1y=b.y-a.y,v2x=x-a.x,v2y=y-a.y;
 const den=v0x*v1y-v1x*v0y;
 if(Math.abs(den)<1e-10)return false;
 const u=(v2x*v1y-v1x*v2y)/den,v=(v0x*v2y-v2x*v0y)/den;
 return u>=0&&v>=0&&u+v<=1;
}
export function pickOpenSimFace(view,x,y){
 if(!view?.faces)return null;
 for(let i=view.faces.length-1;i>=0;i--)if(contains(view.faces[i].points,x,y))
  return {objectId:view.faces[i].objectId,partId:view.faces[i].partId,faceId:view.faces[i].id};
 return null;
}
export function drawOpenSim3D(ctx,view,{selectedObjectId=null}={}){
 if(!ctx?.fillRect||!view?.faces)throw new TypeError('Canvas context and projected scene required');
 const w=view.width,h=view.height;
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle='#11232e';ctx.fillRect(0,0,w,h);
 for(const f of view.faces){
  ctx.beginPath();
  ctx.moveTo(f.points[0].x,f.points[0].y);
  ctx.lineTo(f.points[1].x,f.points[1].y);
  ctx.lineTo(f.points[2].x,f.points[2].y);
  ctx.closePath();
  ctx.fillStyle=f.color;ctx.fill();
  ctx.strokeStyle=f.objectId===selectedObjectId?'#fff5a4':'#0e1a2699';
  ctx.lineWidth=f.objectId===selectedObjectId?2:0.5;ctx.stroke();
 }
}
/** Local model-scene preview; single canvas with perspective and basic orbit.
 * Does not impersonate a native OpenSim viewer or execute in-world scripts.
 */
export function createOpenSim3DPreview({canvas,getGeometry,onSelect}={}){
 if(!canvas?.getContext||typeof getGeometry!=='function')throw new TypeError('Canvas and geometry provider required');
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('2D canvas not supported');
 let yaw=.8,pitch=.55,distance=210,closed=false,last=null,drag=null,selected=null;
 function update(){
  if(closed)return null;
  const geom=getGeometry();
  const width=Math.max(100,Math.min(2048,Math.round(canvas.clientWidth||720)));
  const height=Math.max(100,Math.min(2048,Math.round(canvas.clientHeight||460)));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const view=projectOpenSimFaces3D(geom,{width,height,yaw,pitch,distance});
  drawOpenSim3D(ctx,view,{selectedObjectId:selected});last=view;return view;
 }
 const down=e=>{drag={x:e.clientX,y:e.clientY,moved:false};canvas.setPointerCapture?.(e.pointerId)};
 const move=e=>{
  if(!drag)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;
  yaw+=dx*.009;pitch=clamp(pitch+dy*.007,.1,1.4);
  drag.x=e.clientX;drag.y=e.clientY;
  if(drag.moved)update();
 };
 const up=e=>{
  if(!drag)return;
  if(!drag.moved&&last){
   const rect=canvas.getBoundingClientRect();
   const hit=pickOpenSimFace(last,(e.clientX-rect.left)*last.width/rect.width,
    (e.clientY-rect.top)*last.height/rect.height);
   selected=hit?.objectId||null;
   if(hit&&typeof onSelect==='function')onSelect(hit);
   update();
  }
  drag=null;
 };
 const wheel=e=>{e.preventDefault();distance=clamp(distance*Math.exp(e.deltaY*.001),15,1800);update();};
 canvas.addEventListener('pointerdown',down);
 canvas.addEventListener('pointermove',move);
 canvas.addEventListener('pointerup',up);
 canvas.addEventListener('pointercancel',up);
 canvas.addEventListener('wheel',wheel,{passive:false});
 canvas.setAttribute('role','img');
 canvas.setAttribute('aria-label','Interactive 3D geometry preview. Drag to orbit, scroll to zoom. Use adjacent 2D map for keyboard navigation.');
 return {update,select(id){selected=id;return update()},get selected(){return selected},
  close(){closed=true;canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);
   canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel)}};
}
