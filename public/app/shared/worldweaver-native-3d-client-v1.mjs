/**
 * Civweave native 3D scene renderer v1.
 * Provider-neutral browser Canvas projection: a view of snapshots supplied by
 * the canonical World Runtime, never a second simulation or permissions owner.
 * No DreamGrid/OpenSimulator import, network calls, executable scene scripts,
 * dynamic HTML, or external library dependency.
 */
export const NATIVE_SCENE_SCHEMA='civweave.native-scene.v1';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const vector=v=>v&&['x','y','z'].every(k=>Number.isFinite(v[k])&&Math.abs(v[k])<=100000);
const id=v=>typeof v==='string'&&v.length>0&&v.length<=180&&/^[\w:./-]+$/.test(v);
const COLORS=['#78c9ba','#bca97b','#9c9ac9','#c7928f','#91b28b'];
const vertexOffsets=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const norm=v=>{const n=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/n,y:v.y/n,z:v.z/n}};
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export function normalizeNativeScene(input){
 if(!input||input.schema!==NATIVE_SCENE_SCHEMA||!id(input.roomId)||!Array.isArray(input.objects)||input.objects.length>512)throw new TypeError('Invalid canonical scene snapshot');
 const seen=new Set();
 const objects=input.objects.map((o,i)=>{
  if(!id(o?.id)||seen.has(o.id)||!vector(o.position)||!vector(o.size)||
    ['x','y','z'].some(k=>o.size[k]<=0||o.size[k]>10000))throw new TypeError('Invalid scene object');
  seen.add(o.id);
  const color=typeof o.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(o.color)?o.color:COLORS[i%COLORS.length];
  return Object.freeze({id:o.id,label:String(o.label||o.id).slice(0,120),position:Object.freeze({...o.position}),size:Object.freeze({...o.size}),color});
 });
 return Object.freeze({schema:NATIVE_SCENE_SCHEMA,roomId:input.roomId,revision:Number.isSafeInteger(input.revision)&&input.revision>=0?input.revision:0,objects:Object.freeze(objects)});
}
export function projectNativeScene(scene,{width=720,height=460,yaw=.75,pitch=.5,distance=90,target={x:0,y:0,z:0}}={}){
 if(scene?.schema!==NATIVE_SCENE_SCHEMA||!Array.isArray(scene.objects))throw new TypeError('Normalized scene required');
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<100||height<100||width>4096||height>4096||
 !Number.isFinite(yaw)||!Number.isFinite(pitch)||!Number.isFinite(distance)||distance<2||distance>100000||!vector(target))throw new TypeError('Invalid camera');
 const camera={x:target.x+distance*Math.cos(pitch)*Math.cos(yaw),y:target.y+distance*Math.cos(pitch)*Math.sin(yaw),z:target.z+distance*Math.sin(pitch)};
 const forward=norm(sub(target,camera)),right=norm(cross(forward,{x:0,y:0,z:1})),up=norm(cross(right,forward));
 const focal=Math.min(width,height)*1.05,renderFaces=[];
 for(const object of scene.objects){
  const verts=vertexOffsets.map(([x,y,z])=>({
   x:object.position.x+x*object.size.x/2,
   y:object.position.y+y*object.size.y/2,
   z:object.position.z+z*object.size.z/2
  })).map(v=>{
   const d=sub(v,camera),depth=dot(d,forward);
   return {x:width/2+dot(d,right)*focal/Math.max(depth,.1),y:height/2-dot(d,up)*focal/Math.max(depth,.1),depth};
  });
  for(let i=0;i<faces.length;i++){
   const points=faces[i].map(n=>verts[n]);
   if(points.some(p=>p.depth<=.1))continue;
   renderFaces.push({objectId:object.id,color:object.color,points,depth:points.reduce((a,p)=>a+p.depth,0)/4,face:i});
  }
 }
 renderFaces.sort((a,b)=>b.depth-a.depth);
 return {width,height,roomId:scene.roomId,revision:scene.revision,faces:renderFaces};
}
function inside(points,x,y){
 let sign=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  const c=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);
  if(Math.abs(c)<1e-8)continue;
  const s=Math.sign(c);if(sign&&s!==sign)return false;sign=s;
 }
 return true;
}
export function pickNativeObject(view,x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 for(let i=view.faces.length-1;i>=0;i--)if(inside(view.faces[i].points,x,y))return view.faces[i].objectId;
 return null;
}
export function drawNativeScene(ctx,view,{selectedId=null}={}){
 if(!ctx?.clearRect||!view?.faces)throw new TypeError('Canvas context and view required');
 ctx.clearRect(0,0,view.width,view.height);
 ctx.fillStyle='#081722';ctx.fillRect(0,0,view.width,view.height);
 for(const face of view.faces){
  ctx.beginPath();face.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
  ctx.fillStyle=face.color;ctx.fill();
  ctx.strokeStyle=face.objectId===selectedId?'#fff1a4':'#102734';
  ctx.lineWidth=face.objectId===selectedId?2:1;ctx.stroke();
 }
}
/** Mounts a local viewer. update(snapshot) accepts ONLY committed runtime snapshots;
 * onSelect emits a proposal for the host, never applies a world mutation.
 */
export function createNativeWorld3DClient({canvas,onSelect=()=>{}}={}){
 if(!canvas?.getContext||typeof onSelect!=='function')throw new TypeError('Canvas and selection callback required');
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas 2D unavailable');
 let scene=null,view=null,selected=null,yaw=.75,pitch=.5,distance=90,drag=null,disposed=false;
 function render(){
  if(disposed||!scene)return null;
  const rect=canvas.getBoundingClientRect();
  const width=clamp(Math.round(rect.width||720),100,2048),height=clamp(Math.round(rect.height||460),100,2048);
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  view=projectNativeScene(scene,{width,height,yaw,pitch,distance});drawNativeScene(ctx,view,{selectedId:selected});return view;
 }
 const down=e=>{drag={x:e.clientX,y:e.clientY,moved:false};canvas.setPointerCapture?.(e.pointerId)};
 const move=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;
  yaw+=dx*.009;pitch=clamp(pitch+dy*.007,.08,1.42);drag.x=e.clientX;drag.y=e.clientY;if(drag.moved)render();
 };
 const up=e=>{if(drag&&!drag.moved&&view){
  const rect=canvas.getBoundingClientRect();
  if(rect.width&&rect.height){selected=pickNativeObject(view,(e.clientX-rect.left)*view.width/rect.width,(e.clientY-rect.top)*view.height/rect.height);
   if(selected)onSelect({roomId:scene.roomId,objectId:selected,revision:scene.revision});render();}
 }drag=null;};
 const wheel=e=>{e.preventDefault();distance=clamp(distance*Math.exp(e.deltaY*.001),2,100000);render()};
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);
 canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
 canvas.addEventListener('wheel',wheel,{passive:false});
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Civweave 3D world. Drag to orbit, scroll to zoom; use the room list for keyboard navigation.');
 return {update(snapshot){if(disposed)throw new Error('Client closed');const next=normalizeNativeScene(snapshot);
   if(scene&&scene.roomId===next.roomId&&next.revision<scene.revision)return view;
   scene=next;selected=null;return render();},render,get roomId(){return scene?.roomId||null},
  close(){if(disposed)return;disposed=true;['pointerdown','pointermove','pointerup','pointercancel','wheel'].forEach((name,i)=>canvas.removeEventListener(name,[down,move,up,up,wheel][i]));scene=null;view=null;}};
}
