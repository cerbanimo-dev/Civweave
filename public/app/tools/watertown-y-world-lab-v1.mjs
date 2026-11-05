import {createWorldweaver} from '../shared/worldweaver-core-v1.mjs';
import {renderWorldScreen} from '../shared/worldweaver-screen-v1.mjs';
import {projectWorld2D,renderWorldMap2D} from '../shared/worldweaver-map-2d-v1.mjs';

/**
 * Local Worldweaver mockup: a guide-owned room with four real screen manifests.
 * No true YM(CA) affiliation, synchronized Guild record, OpenSim placement or
 * live class feed is claimed. Uses the existing screen-cast authorization path.
 */
const $=id=>document.getElementById(id);
const human={kind:'human',principalId:'lab:verified-human',verified:true};
const stations=[
 {key:'entrance',title:'Reception / Lobby',label:'All studios · Now & Next',studio:'all',mode:'tv'},
 {key:'cardio',title:'Cardio Studio door',label:'Cardio · Today',studio:'cardio',mode:'today'},
 {key:'spin',title:'Spin Studio door',label:'Spin · Today',studio:'spin',mode:'today'},
 {key:'yoga',title:'Yoga Studio door',label:'Yoga · Today',studio:'yoga',mode:'today'}
];
let serial=0;
const world=createWorldweaver({
 id:()=> 'y-lab-'+(++serial),
 authorize:({actor})=>actor?.kind==='human'&&actor.verified===true&&actor.principalId===human.principalId
});
const room=world.dispatch({
 type:'create',guide:'moss',scope:'standalone',
 title:'Watertown Y · digital schedule prototype',
 description:'Unofficial signage placement demonstration. Measured geometry and official authorization are not yet provided.'
},human).instance;
const record=new Map();
const secure=location.protocol==='https:';
for(const placement of stations){
 const screen=world.dispatch({type:'create-screen',instanceId:room.id,
  title:placement.title+' schedule',aspectRatio:'16:9'},human).screen;
 if(secure){
  const url=new URL('./watertown-y-schedule-v2.html',location.href);
  url.searchParams.set('studio',placement.studio);
  url.searchParams.set('mode',placement.mode);
  world.dispatch({type:'cast-screen',screenId:screen.id,content:{
   kind:'website',title:placement.title+' · schedules',
   source:{url:url.href},
   alt:'Accessible text schedule for '+placement.label
  }},human);
 }
 record.set(placement.key,{...placement,screenId:screen.id});
}
function display(key){
 const selected=record.get(key);
 if(!selected)return;
 for(const button of document.querySelectorAll('button[data-site]'))
  button.setAttribute('aria-pressed',String(button.dataset.site===key));
 $('screenTitle').textContent=selected.title+' schedule';
 $('selection').textContent=selected.label;
 const snapshot=world.snapshot(),screen=snapshot.screens.find(item=>item.id===selected.screenId);
 const stage=$('stage');stage.replaceChildren();
 if(screen?.current){
  try{stage.append(renderWorldScreen(screen.current,{documentRef:document}));}
  catch(e){
   const fallback=document.createElement('p');fallback.className='noscreen';
   fallback.textContent='Screen cannot display in this viewer: '+e.message;
   stage.append(fallback);
  }
 }else{
  const fallback=document.createElement('p');fallback.className='noscreen';
  fallback.textContent='Internal secure-screen casting requires HTTPS. This local file or HTTP preview is intentionally not presented as a cast Worldweaver screen.';
  stage.append(fallback);
  const link=document.createElement('a');link.href='./watertown-y-schedule-v2.html';
  link.textContent='Open the schedule directly';stage.append(link);
 }
 $('message').textContent=secure?
  'Selected '+selected.title+'. This demo authorized a local human screen cast; nothing was published to a live Guild or real YMCA.':
  'HTTPS is unavailable in this viewer. No world screen was cast. You can still open the standalone schedule.';
 const map=projectWorld2D(snapshot,{worldRef:room.id});
 $('worldMap').replaceChildren(renderWorldMap2D(map,{documentRef:document,onActivate:action=>{
  if(action.objectType==='screen'){
   const target=[...record.values()].find(item=>item.screenId===action.objectId);
   if(target)display(target.key);
  }else $('message').textContent='Selected '+action.objectType+' in the local Worldweaver schematic map.';
 }}));
 $('casted').textContent=JSON.stringify({
  schema:snapshot.schema,revision:snapshot.revision,worldId:room.id,
  screens:snapshot.screens.map(row=>({
   id:row.id,title:row.title,status:row.status,kind:row.current?.kind||'blank',
   url:row.current?.source?.url||null,revision:row.revision
  })),
  notice:'These are local demo world manifests, not authoritative connected Guild data.'
 },null,2);
}
for(const button of document.querySelectorAll('button[data-site]'))
 button.addEventListener('click',()=>display(button.dataset.site));
display('entrance');

async function auditBigfixers(){
 const target=$('auditResult');target.textContent='Checking the local copy of all studio schedules…';
 try{
  const response=await fetch('./watertown-y-schedule-data-v2.json',{cache:'no-cache'});
  if(!response.ok)throw new Error('Local data request failed: '+response.status);
  const data=await response.json();
  if(data.schema!=='civweave.ymca-schedule.v2')throw new Error('Unknown schedule schema');
  const faults=[],counts={},days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const toMinutes=text=>{if(!/^\d\d:\d\d$/.test(text))return NaN;return Number(text.slice(0,2))*60+Number(text.slice(3));};
  for(const [studio,info] of Object.entries(data.studios)){
   let count=0;
   for(const day of days){
    if(!Array.isArray(info.days?.[day])){faults.push(studio+': missing '+day);continue;}
    for(const entry of info.days[day]){
     count++;
     if(!(toMinutes(entry.end)>toMinutes(entry.start)))faults.push(studio+' '+day+': invalid time');
     if(typeof entry.name!=='string'||!entry.name.trim())faults.push(studio+' '+day+': class missing name');
    }
   }
   counts[studio]=count;
  }
  const now=new Intl.DateTimeFormat('en-US',{timeZone:data.timezone,year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const part=key=>now.find(entry=>entry.type===key)?.value;
  const archived=data.sourceMonth!==part('year')+'-'+part('month');
  const lines=[
   'FRUIT-FLY BIGFIXERS · READ-ONLY REPORT',
   'Cardio: '+counts.cardio+' classes · Spin: '+counts.spin+' · Yoga: '+counts.yoga,
   'Source month: '+data.sourceMonth+' · '+(archived?'STALE MONTH: re-check official schedule':'Current calendar month'),
   'Structural problems: '+faults.length,
   ...faults.slice(0,12).map(item=>'• '+item),
   'No source values edited, no booking attempted, no AI credits spent.'
  ];
  target.textContent=lines.join('\n');
 }catch(error){
  target.textContent='Bigfixers could not complete their check: '+error.message+'\nThe official YMCA source remains the reference.';
 }
}
$('auditButton').addEventListener('click',()=>void auditBigfixers());

