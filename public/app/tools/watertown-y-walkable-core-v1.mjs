/**
 * Digital Y walkable microspace geometry.
 * Pure, network-free ray intersection, movement and accessible route finding.
 * Consumes one fictionalized schematic; no OpenSimulator fidelity is implied.
 */
export const SCENE_SCHEMA='civweave.digital-y.walkable-scene.v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>Array.isArray(p)&&p.length===2&&p.every(finite);
export function validateYScene(scene){
 if(scene?.schema!==SCENE_SCHEMA)throw new TypeError('Unrecognized Digital Y scene schema');
 const {world,walls,zones,objects}=scene;
 if(!finite(world?.width)||!finite(world?.height)||world.width<5||world.height<5||world.width>200||world.height>200)
  throw new TypeError('Invalid scene dimensions');
 if(!Array.isArray(walls)||walls.length<4||walls.length>300||
    !Array.isArray(zones)||zones.length>100||!Array.isArray(objects)||objects.length>100)
  throw new TypeError('Invalid scene collections');
 const ids=new Set();
 for(const row of [...walls,...zones,...objects]){
  if(typeof row.id!=='string'||!/^[a-z0-9-]{1,64}$/.test(row.id)||ids.has(row.id))
   throw new TypeError('Invalid or duplicate scene object ID');
  ids.add(row.id);
 }
 const inside=(x,y)=>x>=0&&x<=world.width&&y>=0&&y<=world.height;
 for(const wall of walls){
  if(!point(wall.a)||!point(wall.b)||!inside(...wall.a)||!inside(...wall.b))
   throw new TypeError('Invalid wall coordinates');
  if(wall.a[0]===wall.b[0]&&wall.a[1]===wall.b[1])throw new TypeError('Zero-length wall');
 }
 for(const obj of objects)if(!finite(obj.x)||!finite(obj.y)||!inside(obj.x,obj.y)||
  !['guide','schedule','quest','audit','exit'].includes(obj.kind))
   throw new TypeError('Invalid interactive object');
 if(!point([world.spawn?.x,world.spawn?.y])||!inside(world.spawn.x,world.spawn.y)||
  !finite(world.spawn.heading))throw new TypeError('Invalid spawn');
 if(collides(scene,world.spawn.x,world.spawn.y,.27))throw new TypeError('Spawn collides with a wall');
 return scene;
}
export function distanceToWall(x,y,a,b){
 const vx=b[0]-a[0],vy=b[1]-a[1];
 const t=Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/(vx*vx+vy*vy||1)));
 return Math.hypot(x-(a[0]+t*vx),y-(a[1]+t*vy));
}
export function collides(scene,x,y,radius=.27){
 if(x-radius<0||y-radius<0||x+radius>scene.world.width||y+radius>scene.world.height)return true;
 return scene.walls.some(w=>distanceToWall(x,y,w.a,w.b)<radius);
}
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
export function raycast(scene,x,y,angle,maxDistance=100){
 const dx=Math.cos(angle),dy=Math.sin(angle);let best=null;
 for(const wall of scene.walls){
  const sx=wall.b[0]-wall.a[0],sy=wall.b[1]-wall.a[1],den=cross(dx,dy,sx,sy);
  if(Math.abs(den)<1e-9)continue;
  const qx=wall.a[0]-x,qy=wall.a[1]-y;
  const t=cross(qx,qy,sx,sy)/den,u=cross(qx,qy,dx,dy)/den;
  if(t>.0001&&t<maxDistance&&u>=0&&u<=1&&(!best||t<best.distance))
   best={distance:t,wallId:wall.id,color:wall.color||'#668899',x:x+dx*t,y:y+dy*t};
 }
 return best;
}
export function lineOfSight(scene,a,b){
 const angle=Math.atan2(b.y-a.y,b.x-a.x),dist=Math.hypot(b.x-a.x,b.y-a.y);
 const hit=raycast(scene,a.x,a.y,angle,dist+.001);
 return !hit||hit.distance>=dist-.1;
}
export function movePlayer(scene,player,forward,strafe,turn,step){
 const next={...player,angle:player.angle+turn*step};
 const fx=Math.cos(next.angle),fy=Math.sin(next.angle);
 const vx=fx*forward-fy*strafe,vy=fy*forward+fx*strafe;
 const scale=Math.hypot(vx,vy)>1?1/Math.hypot(vx,vy):1;
 // Small substeps prevent tunnelling through zero-width wall segments.
 const dx=vx*scale*step,dy=vy*scale*step;
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.12));
 for(let i=0;i<steps;i++){
  if(!collides(scene,next.x+dx/steps,next.y))next.x+=dx/steps;
  if(!collides(scene,next.x,next.y+dy/steps))next.y+=dy/steps;
 }
 return next;
}
export function nearestInteraction(scene,pos,maxRange=2.1){
 let nearest=null;
 for(const obj of scene.objects){
  const distance=Math.hypot(obj.x-pos.x,obj.y-pos.y);
  if(distance>(obj.radius||maxRange)||!lineOfSight(scene,pos,obj))continue;
  if(!nearest||distance<nearest.distance)nearest={...obj,distance};
 }
 return nearest;
}
export function zoneAt(scene,point){
 return scene.zones.find(z=>point.x>=z.rect[0]&&point.y>=z.rect[1]&&point.x<z.rect[2]&&point.y<z.rect[3])||null;
}
/** Conservative collision-tested grid route for accessible fast travel.
 * Never crosses walls even when a door is drawn as a wall gap.
 */
export function findAccessiblePath(scene,from,to,cell=.5){
 if(!finite(cell)||cell<.3||cell>2)throw new TypeError('Bad navigation cell');
 const w=Math.floor(scene.world.width/cell),h=Math.floor(scene.world.height/cell);
 const passable=(ix,iy)=>ix>=0&&iy>=0&&ix<w&&iy<h&&!collides(scene,(ix+.5)*cell,(iy+.5)*cell,.27);
 const start={x:Math.floor(from.x/cell),y:Math.floor(from.y/cell)};
 const goal={x:Math.floor(to.x/cell),y:Math.floor(to.y/cell)};
 const key=(x,y)=>y*w+x;
 const neighbors=[[1,0],[-1,0],[0,1],[0,-1]];
 if(!passable(start.x,start.y))return null;
 let goalCandidates=[];
 for(let radius=0;radius<=4&&!goalCandidates.length;radius++){
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(Math.abs(dx)+Math.abs(dy)!==radius)continue;
   const x=goal.x+dx,y=goal.y+dy;
   if(passable(x,y))goalCandidates.push(key(x,y));
  }
 }
 if(!goalCandidates.length)return null;
 const targets=new Set(goalCandidates);
 const queue=[start],visited=new Set([key(start.x,start.y)]),parents=new Map();
 let found=null;
 for(let i=0;i<queue.length&&i<w*h;i++){
  const p=queue[i],id=key(p.x,p.y);
  if(targets.has(id)){found=id;break;}
  for(const [dx,dy] of neighbors){
   const x=p.x+dx,y=p.y+dy,toId=key(x,y);
   if(!passable(x,y)||visited.has(toId))continue;
   // Check line midpoint, rather than only grid-centre endpoints.
   if(collides(scene,(p.x+x+1)*cell/2,(p.y+y+1)*cell/2,.27))continue;
   visited.add(toId);parents.set(toId,id);queue.push({x,y});
  }
 }
 if(found==null)return null;
 const path=[];
 for(let cur=found;cur!=null;cur=parents.get(cur)){
  const y=Math.floor(cur/w),x=cur%w;
  path.push({x:(x+.5)*cell,y:(y+.5)*cell});
 }
 return path.reverse();
}
