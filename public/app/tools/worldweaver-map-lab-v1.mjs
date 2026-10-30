import {createWorldweaver} from '../shared/worldweaver-core-v1.mjs';
import {projectWorld2D,observeWorld2D,renderWorldMap2D} from '../shared/worldweaver-map-2d-v1.mjs';
import {renderWorldScreen} from '../shared/worldweaver-screen-v1.mjs';

const $=id=>document.getElementById(id);
let counter=0,active=null;
const human={kind:'human',principalId:'demo:human',verified:true};
const model={kind:'model',principalId:'demo:starling:kami',modelId:'demo:qwen',personaRef:'starling:kami',verified:true};
const runtime={kind:'runtime',principalId:'demo:renderer',verified:true};
// Only the local test lab accepts these synthetic identities. A live world MUST
// authenticate them through the platform, never through client-provided flags.
const world=createWorldweaver({id:()=>`demo-${++counter}`,
 authorize:({actor,command})=>actor?.verified===true&&(
 actor.kind==='human'||actor.kind==='model'&&['rig-npc','queue-actions'].includes(command.type)||
 actor.kind==='runtime'&&['provisioned','report-action'].includes(command.type))});
const demos=[
 {guide:'moss',title:'Learning Hall',station:'Memory workshop'},
 {guide:'kamiya',title:'Quest Forge',station:'Tool rehearsal'},
 {guide:'rook',title:'Creator Arcade',station:'Product demonstration'},
 {guide:'merlin',title:'Convention Hall',station:'Debate agenda'}
];
const spaces=[];
for(const row of demos){
 const space=world.dispatch({type:'create',guide:row.guide,title:row.title,scope:'guild-map',guildId:'demo-commons'},human).instance;
 world.dispatch({type:'request-provision',instanceId:space.id},human);
 world.dispatch({type:'provisioned',instanceId:space.id,backend:'local-renderer',worldRef:'demo-world-'+row.guide},runtime);
 const stationType=row.guide==='rook'?'display':row.guide==='merlin'?'debate':'practice';
 world.dispatch({type:'add-station',instanceId:space.id,stationType,title:row.station,instructions:'This is a local sample, not the archived visual layout.'},human);
 const screen=world.dispatch({type:'create-screen',instanceId:space.id,title:row.title+' Weave Screen'},human).screen;
 const npc=world.dispatch({type:'rig-npc',instanceId:space.id,name:'Sample '+row.guide+' presenter',modelId:model.modelId,
  pilotPrompt:'Demonstrate this room using approved tools only.',personaRef:model.personaRef,
  capabilities:['observe','inspect','speak','cast-screen','clear-screen']},model).npc;
 spaces.push({...row,space,screen,npc});
}
active=spaces[0];
for(const row of spaces){
 const option=document.createElement('option');option.value=row.space.id;option.textContent=row.title;
 $('space').append(option);
}
function notify(text){
 $('status').textContent=text;
}
function mapAction(action){
 if(action.objectType==='space'){
  const destination=spaces.find(x=>x.space.id===action.objectId);
  if(destination){
   active=destination;$('space').value=active.space.id;update();
   notify('Navigated locally to '+active.title+' · No actual 3D teleport or server was invoked.');
   return;
  }
 }
 if(action.recursivePortal)notify('Civweave screens point back to this 2D world; infinite home screens have been courteously declined.');
 else notify('Inspected '+action.objectType+' '+action.objectId+'. Further actions require the owning world tool adapter.');
}
function update(){
 const state=world.snapshot(),focused=active.space.id;
 const projection=projectWorld2D(state,{worldRef:focused});
 $('world-map').replaceChildren(renderWorldMap2D(projection,{documentRef:document,onActivate:mapAction}));
 $('observation').textContent=JSON.stringify(observeWorld2D(state,{worldRef:focused}),null,2);
 const current=state.screens.find(x=>x.id===active.screen.id)?.current;
 $('inset').replaceChildren();
 if(!current){
  const p=document.createElement('p');p.textContent='This room screen is blank. Cast Civweave to see a 2D world portal.';
  $('inset').append(p);
 }else{
  const widget=renderWorldScreen(current,{documentRef:document,worldState:state,onActivate:mapAction});
  widget.style.height='100%';
  $('inset').append(widget);
 }
}
function appContent(){return {kind:'civweave',source:{worldRef:active.space.id},title:'Civweave · 2D World'};}
$('space').addEventListener('change',()=>{
 active=spaces.find(x=>x.space.id===$('space').value)||active;
 update();notify('Viewing '+active.title+' through the lightweight map.');
});
$('cast-app').addEventListener('click',()=>{
 try{
  world.dispatch({type:'cast-screen',screenId:active.screen.id,content:appContent()},human);
  update();notify('Civweave is now shown as a 2D world inside '+active.title+'.');
 }catch(error){notify('Cast failed: '+String(error.message||error));}
});
$('model-cast').addEventListener('click',()=>{
 try{
  const request=world.dispatch({type:'queue-actions',npcId:active.npc.id,actions:[
   {tool:'cast-screen',args:{screenId:active.screen.id,content:appContent()}}]},model).intents[0];
  // This acknowledgment is a LAB SIMULATION only. Deployed worlds need a
  // trusted world renderer that actually performed the requested screen cast.
  world.dispatch({type:'report-action',intentId:request.id,outcome:'succeeded',
   summary:'Local lab renderer simulation'},runtime);
  update();notify('Demo NPC cast acknowledged by the simulated local renderer.');
 }catch(error){notify('NPC cast failed: '+String(error.message||error));}
});
$('clear').addEventListener('click',()=>{
 try{
  world.dispatch({type:'clear-screen',screenId:active.screen.id},human);
  update();notify('Room screen cleared.');
 }catch(error){notify('Clear failed: '+String(error.message||error));}
});
$('space').value=active.space.id;
update();
