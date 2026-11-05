import {createWorldweaver} from '../shared/worldweaver-core-v1.mjs';
import {renderWorldScreen} from '../shared/worldweaver-screen-v1.mjs';
import {projectWorld2D} from '../shared/worldweaver-map-2d-v1.mjs';
import {validateYScene,raycast,collides,movePlayer,nearestInteraction,zoneAt,findAccessiblePath,lineOfSight} from './watertown-y-walkable-core-v1.mjs';

/** Standalone fictionalized Digital Y experience.
 * Only the Worldweaver screen manifests are authoritative within this local
 * demonstration; no real member / Guild / OpenSim / AI principal is implied.
 */
const $=id=>document.getElementById(id);
const ns='http://www.w3.org/2000/svg';
const say=s=>{$('narration').textContent=s;};
const endpoint='./watertown-y-walkable-scene-v1.json';
const scene=await fetch(endpoint,{cache:'no-cache'}).then(response=>{
 if(!response.ok)throw new Error('Unable to load Digital Y scene: '+response.status);
 return response.json();
}).then(validateYScene);
const human={kind:'human',principalId:'walkthrough:local-demo-human',verified:true};
let serial=0;
const world=createWorldweaver({
 id:()=> 'walk-y-'+(++serial),
 authorize:({actor})=>actor?.kind==='human'&&actor.verified===true&&actor.principalId===human.principalId
});
const room=world.dispatch({
 type:'create',guide:'moss',scope:'standalone',
 title:'Digital Y · fictionalized navigable demonstration',
 description:'Schematic multi-studio YMCA-inspired world; local prototype, no verified physical geometry'
},human).instance;
const screenIds=new Map();
for(const item of scene.objects.filter(x=>x.kind==='schedule')){
 const screen=world.dispatch({
  type:'create-screen',instanceId:room.id,title:item.label,aspectRatio:'16:9'
 },human).screen;
 screenIds.set(item.id,screen.id);
 if(location.protocol==='https:'){
  const url=new URL('./watertown-y-schedule-v2.html',location.href);
  url.searchParams.set('studio',item.studio);url.searchParams.set('mode',item.mode);
  world.dispatch({type:'cast-screen',screenId:screen.id,content:{
   kind:'website',source:{url:url.href},title:item.label,
   alt:'Accessible '+item.studio+' class schedule from an archived November 2026 YMCA source'
  }},human);
 }
}
const layout={positions:{[room.id]:{x:50,y:50}}};
for(const item of scene.objects.filter(o=>o.kind==='schedule'))
 layout.positions[screenIds.get(item.id)]={x:100*item.x/scene.world.width,y:100*item.y/scene.world.height};
const snapshot=world.snapshot();
const mapProjection=projectWorld2D(snapshot,{worldRef:room.id,layout});
let player={x:scene.world.spawn.x,y:scene.world.spawn.y,angle:scene.world.spawn.heading};
let lastZone='',lastNearby='';
const visited=new Set(),goalNames={
 fitness:'Try a welcoming exercise class',
 learning:'Learn a useful movement or wellness skill',
 community:'Meet neighbors through an inclusive Y activity'
};
let goal='fitness',openedScreen=null;
const buttonState={forward:false,back:false,left:false,right:false};
const heldKeys=new Set(),canvas=$('view'),ctx=canvas.getContext('2d');
if(!ctx)throw new Error('This browser cannot render the first-person view; use the map controls.');
const normalizeAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const shade=(hex,illum)=>{
 const c=rgb(hex);return 'rgb('+c.map(n=>Math.round(clamp(n*illum,0,255))).join(',')+')';
};
const readable=s=>s.length>27?s.slice(0,24)+'…':s;
const sceneLookup=id=>scene.objects.find(x=>x.id===id);
const qt=[
 ['welcome','Meet the fictional welcome guide'],
 ['board-cardio','Read the Cardio Studio schedule'],
 ['moss','Meet Moss, the scripted learning guide'],
 ['quest','Choose a community quest'],
 ['exit','Leave with your plan']
];
function setTab(name){
 for(const tab of ['map','quest','schedule']){
  $('tab-'+tab).setAttribute('aria-pressed',String(tab===name));
  $(tab+'Section').classList.toggle('hidden',tab!==name);
 }
}
for(const tab of ['map','quest','schedule'])$('tab-'+tab).addEventListener('click',()=>setTab(tab));
function planText(){
 const title=goalNames[goal],d=new Date().toISOString().slice(0,10);
 return [
  '# Digital Y · First Quest Draft',
  '',
  'Generated: '+d+' · Demo only (editable locally)',
  'Intention: '+title,
  '',
  '## Quest',
  'Choose one accessible Y activity that fits my interests and availability.',
  '1. Read the official, current YMCA schedule before making plans.',
  '2. Identify one interesting activity and verify registration and accessibility requirements.',
  '3. Prepare one question for a real YMCA staff member.',
  '4. Try the activity or identify an alternative; reflect on what helped.',
  '',
  '## Party',
  'Invite a trusted friend or welcoming community member only with their agreement.',
  '',
  '## Guild',
  'If useful, propose a consent-based learning or participation group; no enrollment occurs here.',
  '',
  '## Four Civweave supports',
  '- Living School: learn the skills and context.',
  '- Cerbanimo: break the goal into doable tasks.',
  '- FellowFare: share or request help voluntarily.',
  '- Anarchadia: agree on participation and decisions fairly.',
  '',
  '## Boundaries',
  'This is a draft, not a class registration, treatment recommendation, live booking or YMCA commitment.',
  'Official schedule: https://www.watertownymca.org/WatertownYMCASchedules',
  'Data currently displayed in this prototype: November 2026.'
 ].join('\n');
}
function renderQuest(){
 const list=$('questProgress');list.replaceChildren();
 for(const [id,label]of qt){
  const li=document.createElement('li');li.textContent=label;li.className=visited.has(id)?'done':'';
  list.append(li);
 }
 for(const b of document.querySelectorAll('[data-goal]'))
  b.setAttribute('aria-pressed',String(b.dataset.goal===goal));
 const done=qt.every(([id])=>visited.has(id));
 $('completion').textContent=done?'Intro quest complete. You can export or edit your draft plan.':
  qt.filter(([id])=>!visited.has(id)).length+' introductory steps remaining. You can still export a draft.';
}
for(const b of document.querySelectorAll('[data-goal]'))b.addEventListener('click',()=>{
 goal=b.dataset.goal;visited.add('quest');$('plan').value=planText();renderQuest();
 say('Quest intention chosen: '+goalNames[goal]+'. Your editable draft plan is ready.');
});
$('exportPlan').addEventListener('click',()=>{
 const text=$('plan').value||planText();
 const blob=new Blob([text],{type:'text/markdown;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download='digital-y-first-quest.md';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('resetQuest').addEventListener('click',()=>{
 visited.clear();goal='fitness';$('plan').value=planText();renderQuest();
 say('Introductory quest progress reset locally. No real YMCA data was changed.');
});
$('plan').value=planText();renderQuest();
function openSchedule(obj){
 openedScreen=obj.id;const host=$('scheduleHost');host.replaceChildren();
 $('screenHeading').textContent=obj.label;
 const screenId=screenIds.get(obj.id);
 const screen=snapshot.screens.find(x=>x.id===screenId);
 if(screen?.current){
  try{host.append(renderWorldScreen(screen.current,{documentRef:document}));}
  catch(error){say('Schedule screen cannot be presented: '+error.message);}
 }else{
  const p=document.createElement('p');p.textContent='This sandbox is not running on HTTPS, so the official Worldweaver HTTPS cast is disabled. Open the local schedule below.';
  host.append(p);
  const a=document.createElement('a');a.href='./watertown-y-schedule-v2.html?studio='+encodeURIComponent(obj.studio)+'&mode='+encodeURIComponent(obj.mode);
  a.textContent='Open standalone '+obj.studio+' schedule';host.append(a);
 }
 setTab('schedule');
}
async function runAudit(){
 say('The fruit-fly bigfixers are checking the local schedule file…');
 try{
  const response=await fetch('./watertown-y-schedule-data-v2.json');
  if(!response.ok)throw Error('Source file unavailable');
  const data=await response.json(),issues=[];let entries=0;
  for(const [studio,section]of Object.entries(data.studios)){
   for(const [day,classes]of Object.entries(section.days)){
    for(const row of classes){
     entries++;
     if(!/^\d\d:\d\d$/.test(row.start)||!/^\d\d:\d\d$/.test(row.end)||
      row.end<=row.start)issues.push(studio+' '+day+' '+row.name);
    }
   }
  }
  const local=new Intl.DateTimeFormat('en-US',{timeZone:data.timezone,year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const v=type=>local.find(x=>x.type===type)?.value;
  const old=data.sourceMonth!==v('year')+'-'+v('month');
  say('Fruit-fly bigfixers report: '+entries+' class entries, '+issues.length+
    ' malformed time ranges. '+(old?'The schedule month is archived; check the current YMCA page.':'Month matches the local calendar.')+
    ' This was a read-only check; no published schedules were changed.');
 }catch(error){say('Bigfixers cannot audit the local schedule: '+error.message);}
}
function interact(obj){
 if(!obj){say('Move closer to a highlighted station or select a destination in the accessible 2D map.');return;}
 if(obj.kind==='guide'){
  visited.add(obj.id);renderQuest();
  if(obj.id==='welcome')say('Aster (scripted fictional receptionist): Welcome to the Digital Y! Take a look at a class board, then speak with Moss in the commons. The real Y has not approved this imaginary extension.');
  else say('Moss (scripted demo guide): Explore without pressure. Read a current real-world schedule, find a manageable goal and make a small plan. No AI model is running this conversation.');
  setTab('quest');
 }else if(obj.kind==='schedule'){
  visited.add(obj.id);renderQuest();openSchedule(obj);
  say('Showing '+obj.label+'. The original November 2026 schedule is a dated snapshot; use the official current YMCA page to confirm times.');
 }else if(obj.kind==='quest'){
  visited.add('quest');renderQuest();setTab('quest');
  say('The Community Quest Board invites you to pick a goal and edit a plan. Participation is optional.');
 }else if(obj.kind==='audit'){
  setTab('map');void runAudit();
 }else if(obj.kind==='exit'){
  visited.add('exit');renderQuest();setTab('quest');
  const missing=qt.filter(([id])=>!visited.has(id));
  say(missing.length?'You can leave whenever you like. '+missing.length+' introductory steps remain optional.':
    'Intro quest complete. The plan is yours to edit and export; nothing was submitted to a live Guild.');
 }
}
$('interact').addEventListener('click',()=>interact(nearestInteraction(scene,player)));
const W=scene.world.width,H=scene.world.height;
const SVG=(tag,attrs={},textContent)=>{
 const element=document.createElementNS(ns,tag);
 for(const [name,value]of Object.entries(attrs))element.setAttribute(name,String(value));
 if(textContent!==undefined)element.textContent=textContent;
 return element;
};
const tr=({x,y})=>({x:x/W*480,y:y/H*360});
function initMap(){
 const svg=$('map');svg.replaceChildren();
 svg.append(SVG('rect',{x:0,y:0,width:480,height:360,fill:'#e5efed'}));
 for(const z of scene.zones){
  const [x1,y1,x2,y2]=z.rect;
  svg.append(SVG('rect',{x:x1/W*480,y:y1/H*360,width:(x2-x1)/W*480,height:(y2-y1)/H*360,fill:z.color,stroke:'none'}));
  const c=tr({x:(x1+x2)/2,y:(y1+y2)/2});
  svg.append(SVG('text',{x:c.x,y:c.y,'text-anchor':'middle','font-size':12,'font-weight':700,fill:'#254751'},z.name));
 }
 for(const wall of scene.walls){
  const a=tr({x:wall.a[0],y:wall.a[1]}),b=tr({x:wall.b[0],y:wall.b[1]});
  svg.append(SVG('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#284c58','stroke-width':4,'stroke-linecap':'round'}));
 }
 // Screen markers follow the canonical Worldweaver projection, not a second
 // independent copy of their coordinates.
 const seen=new Set();
 for(const node of mapProjection.nodes.filter(n=>n.type==='screen')){
  const obj=scene.objects.find(x=>screenIds.get(x.id)===node.id);
  if(!obj)continue;seen.add(obj.id);
  const g=SVG('g',{'data-id':obj.id,'aria-label':obj.label});
  g.append(SVG('circle',{cx:node.x*4.8,cy:node.y*3.6,r:9,fill:obj.color,stroke:'#003c4b','stroke-width':2}));
  g.append(SVG('title',{},obj.label));
  svg.append(g);
 }
 for(const obj of scene.objects.filter(x=>!seen.has(x.id))){
  const p=tr(obj),g=SVG('g',{'data-id':obj.id});
  g.append(SVG('circle',{cx:p.x,cy:p.y,r:8,fill:obj.color,stroke:'#244d5b','stroke-width':2}));
  g.append(SVG('title',{},obj.label));svg.append(g);
 }
 const marker=SVG('polygon',{id:'playerMarker',points:'0,-11 7,9 -7,9',fill:'#dd5700',stroke:'#fff','stroke-width':2});
 svg.append(marker);
 const list=$('destinationList');list.replaceChildren();
 for(const obj of scene.objects){
  const b=document.createElement('button');b.type='button';b.textContent='Go to '+obj.label;
  b.addEventListener('click',()=>fastTravel(obj));list.append(b);
 }
 updateMapMarker();
}
function updateMapMarker(){
 const dot=$('playerMarker');if(!dot)return;
 const p=tr(player);dot.setAttribute('transform','translate('+p.x+' '+p.y+') rotate('+(player.angle*180/Math.PI+90)+')');
}
function fastTravel(obj){
 const path=findAccessiblePath(scene,player,obj,.5);
 if(!path?.length){say('No safe accessible route found to '+obj.label+'.');return;}
 const target=path.at(-1);
 // Following the same collision-tested grid route: expose the mode clearly.
 player={...player,x:target.x,y:target.y};
 updateMapMarker();setTab('map');
 say('Accessible fast travel followed '+path.length+' collision-checked map steps to '+obj.label+
     '. Press Interact to use this station.');
}
initMap();
function orientation(){
 const zone=zoneAt(scene,player);
 const name=zone?.name||'Main Corridor';
 if(name!==lastZone){lastZone=name;$('location').textContent=name;}
 const near=nearestInteraction(scene,player);
 const label=near?'Within reach: '+near.label+' · Interact (E)':'Walk toward a guide, board, or quest station.';
 if(label!==lastNearby){lastNearby=label;$('nearby').textContent=label;}
}
function resizeCanvas(){
 const rect=canvas.getBoundingClientRect();
 const ratio=Math.min(window.devicePixelRatio||1,1.5);
 const w=Math.max(330,Math.min(1300,Math.round(rect.width*ratio)));
 const h=Math.max(250,Math.min(900,Math.round(rect.height*ratio)));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
}
function drawWorld(){
 resizeCanvas();const w=canvas.width,h=canvas.height,fov=Math.PI/2.35;
 ctx.clearRect(0,0,w,h);
 const sky=ctx.createLinearGradient(0,0,0,h/2);
 sky.addColorStop(0,'#0b3145');sky.addColorStop(1,'#87bbc0');
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h/2);
 const floor=ctx.createLinearGradient(0,h/2,0,h);
 floor.addColorStop(0,'#a4c6bc');floor.addColorStop(1,'#376570');
 ctx.fillStyle=floor;ctx.fillRect(0,h/2,w,h/2);
 const rayStep=Math.max(2,Math.round(w/330)),wallDepth=[];
 for(let x=0;x<w;x+=rayStep){
  const r=(x/w-.5),angle=player.angle+Math.atan(r*2*Math.tan(fov/2));
  const hit=raycast(scene,player.x,player.y,angle);
  const depth=Math.max(.07,(hit?.distance||100)*Math.cos(angle-player.angle));
  const wallHeight=Math.min(h*4,h*.79/depth);
  if(hit){
   const illum=clamp(1.15/(1+depth*.10),.27,1);
   ctx.fillStyle=shade(hit.color,illum);
   ctx.fillRect(x,(h-wallHeight)/2,rayStep+1,wallHeight);
   ctx.fillStyle='rgba(255,255,255,.07)';
   ctx.fillRect(x,(h-wallHeight)/2,rayStep+1,Math.min(4,wallHeight));
  }
  wallDepth[Math.floor(x/rayStep)]=hit?.distance||100;
 }
 const sprites=[];
 for(const obj of scene.objects){
  const dx=obj.x-player.x,dy=obj.y-player.y,dist=Math.hypot(dx,dy);
  const diff=normalizeAngle(Math.atan2(dy,dx)-player.angle);
  if(dist<.2||Math.abs(diff)>fov*.72||!lineOfSight(scene,player,obj))continue;
  sprites.push({obj,dist,diff});
 }
 sprites.sort((a,b)=>b.dist-a.dist);
 const hits=[];
 for(const {obj,dist,diff}of sprites){
  const cx=w*(.5+Math.tan(diff)/(2*Math.tan(fov/2)));
  const centreDepth=wallDepth[Math.floor(cx/rayStep)];
  if(Number.isFinite(centreDepth)&&centreDepth<dist-.3)continue;
  const size=clamp(h*.43/dist,35,h*.55),ww=Math.min(size*1.8,240),hh=size*.88;
  const xx=cx-ww/2,yy=h/2-hh/2+clamp(26/dist,6,25);
  ctx.fillStyle='rgba(7,29,42,.72)';ctx.fillRect(xx-4,yy-4,ww+8,hh+8);
  ctx.fillStyle=obj.color;ctx.fillRect(xx,yy,ww,hh);
  ctx.strokeStyle='#efffff';ctx.lineWidth=3;ctx.strokeRect(xx,yy,ww,hh);
  ctx.fillStyle='#082b37';ctx.textAlign='center';
  ctx.font='900 '+clamp(size*.34,19,40)+'px system-ui';
  ctx.fillText(obj.icon,cx,yy+hh*.46);
  ctx.font='700 '+clamp(ww*.10,11,18)+'px system-ui';
  ctx.fillText(readable(obj.label),cx,yy+hh*.78,ww-12);
  if(dist<=(obj.radius||2.1)){ctx.fillStyle='#fff';ctx.font='700 14px system-ui';ctx.fillText('E · Interact',cx,yy-12);}
  hits.push({obj,x:xx,y:yy,w:ww,h:hh});
 }
 canvas._hits=hits;
 // Accessible orientation aid, also works without pointer lock.
 ctx.strokeStyle='#ffffffc0';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(w/2-8,h/2);ctx.lineTo(w/2+8,h/2);
 ctx.moveTo(w/2,h/2-8);ctx.lineTo(w/2,h/2+8);ctx.stroke();
 ctx.fillStyle='#ffffffdd';ctx.fillRect(10,10,275,37);
 ctx.fillStyle='#10313e';ctx.textAlign='left';ctx.font='700 15px system-ui';
 ctx.fillText((zoneAt(scene,player)?.name||'Digital Y'),20,34);
}
canvas.addEventListener('click',e=>{
 const rect=canvas.getBoundingClientRect();
 const x=(e.clientX-rect.left)*canvas.width/rect.width,y=(e.clientY-rect.top)*canvas.height/rect.height;
 const hit=canvas._hits?.find(item=>x>=item.x&&x<=item.x+item.w&&y>=item.y&&y<=item.y+item.h);
 if(hit&&Math.hypot(player.x-hit.obj.x,player.y-hit.obj.y)<=(hit.obj.radius||2))
  interact(hit.obj);
});
const movementKeys=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e','enter']);
document.addEventListener('keydown',e=>{
 if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLButtonElement)return;
 const key=e.key.toLowerCase();
 if(!movementKeys.has(key))return;
 e.preventDefault();heldKeys.add(key);
 if((key==='e'||key==='enter')&&!e.repeat)interact(nearestInteraction(scene,player));
});
document.addEventListener('keyup',e=>heldKeys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>{heldKeys.clear();for(const key of Object.keys(buttonState))buttonState[key]=false;});
for(const button of document.querySelectorAll('button[data-move]')){
 const key=button.dataset.move;
 const release=()=>{buttonState[key]=false;};
 button.addEventListener('pointerdown',e=>{e.preventDefault();buttonState[key]=true;button.setPointerCapture?.(e.pointerId);});
 button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);
 button.addEventListener('lostpointercapture',release);
}
let previous=0,lastMapTick=0,stopped=false;
function frame(t){
 if(stopped)return;
 const dt=Math.min(.05,(t-previous)/1000||0);previous=t;
 const forward=Number(buttonState.forward||heldKeys.has('w')||heldKeys.has('arrowup'))-
               Number(buttonState.back||heldKeys.has('s')||heldKeys.has('arrowdown'));
 const strafe=Number(heldKeys.has('d'))-Number(heldKeys.has('a'));
 const turn=Number(buttonState.right||heldKeys.has('arrowright'))-
            Number(buttonState.left||heldKeys.has('arrowleft'));
 if(forward||strafe||turn)player=movePlayer(scene,player,forward*2.6,strafe*2.6,turn*2.25,dt);
 drawWorld();
 if(t-lastMapTick>125){updateMapMarker();orientation();lastMapTick=t;}
 requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{previous=0;});
addEventListener('pagehide',()=>{stopped=true;});
orientation();requestAnimationFrame(frame);
say('Welcome to the fictionalized Digital Y. Aster at reception can introduce the first quest. Use the 2D buttons for accessible fast travel.');
