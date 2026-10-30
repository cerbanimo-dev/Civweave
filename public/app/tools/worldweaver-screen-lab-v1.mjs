import {createWorldweaver} from '../shared/worldweaver-core-v1.mjs';
import {normalizeScreenContent,renderWorldScreen} from '../shared/worldweaver-screen-v1.mjs';
import {createLabMediaLeases,validateLabMediaFile,probeBrowserImage,probeBrowserVideo,stopLabMedia} from '../shared/worldweaver-lab-media-v1.mjs';

const $=id=>document.getElementById(id);
const leases=createLabMediaLeases();
let counter=0,pendingId=null,currentAsset=null,uploadEpoch=0,disposed=false;
const human={kind:'human',principalId:'lab:human',verified:true};
const model={kind:'model',principalId:'lab:model',modelId:'demo:model',verified:true};
const runtime={kind:'runtime',principalId:'lab:renderer',verified:true};
// Simulation only: these fake principals must never be used by a hosted world.
const world=createWorldweaver({
 id:()=>`local-lab-${++counter}`,
 authorize:({actor,command})=>actor?.verified===true&&(
  actor.kind==='human'||
  actor.kind==='model'&&['rig-npc','queue-actions'].includes(command.type)||
  actor.kind==='runtime'&&command.type==='report-action')
});
const space=world.dispatch({type:'create',guide:'moss',title:'Local display workshop'},human).instance;
const screen=world.dispatch({type:'create-screen',instanceId:space.id,title:'Shared presentation screen',aspectRatio:'16:9'},human).screen;
const npc=world.dispatch({type:'rig-npc',instanceId:space.id,modelId:model.modelId,pilotPrompt:'Explain learning artifacts and visual demonstrations',name:'Sample agent',capabilities:['observe','speak','cast-screen','clear-screen']},model).npc;
const terminal=new Set(['succeeded','failed','rejected','cancelled']);
function log(value){
 const stamp=new Date().toLocaleTimeString();
 const lines=($('log').textContent||'').split('\n').filter(Boolean);
 lines.unshift(`[${stamp}] ${value}`);
 $('log').textContent=lines.slice(0,18).join('\n');
}
function say(value){$('status').textContent=value;log(value);}
function updateInputs(){
 const kind=$('kind').value;
 $('upload').accept=kind==='video'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp';
 $('file-options').hidden=kind==='website';
 $('generate').hidden=kind!=='image';
 $('upload').disabled=kind==='website';
}
function activeIntent(){
 return world.snapshot().intents.find(i=>i.id===pendingId)||null;
}
function updateQueue(){
 const items=world.snapshot().intents.filter(i=>['cast-screen','clear-screen'].includes(i.tool)).slice(-12).reverse();
 const list=$('queue');list.replaceChildren();
 for(const item of items){
  const li=document.createElement('li');
  li.textContent=`${item.tool}: ${item.status}${item.args?.content?.title?' · '+item.args.content.title:''}`;
  list.append(li);
 }
 const item=activeIntent();
 if(!item||terminal.has(item.status)){
  if(item&&terminal.has(item.status))pendingId=null;
  $('pending').textContent='No active request. Completed and rejected casts remain in the local log.';
 }else $('pending').textContent=`Request ${item.id}: ${item.status}.`;
 const pending=activeIntent();
 $('approve').disabled=!pending||pending.status!=='review-required';
 $('reject').disabled=!pending||pending.status!=='review-required';
 $('apply').disabled=!pending||pending.status!=='queued';
 $('cancel').disabled=!pending||!['queued','review-required'].includes(pending.status);
 $('queue-model').disabled=Boolean(pending);
}
function prune(){
 const keep=new Set();
 const add=id=>{if(id)keep.add(id)};
 add(currentAsset?.assetId);
 const state=world.snapshot();
 add(state.screens.find(x=>x.id===screen.id)?.current?.source?.assetId);
 for(const intent of state.intents)
  if(['queued','review-required'].includes(intent.status))add(intent.args?.content?.source?.assetId);
 leases.prune(keep);
}
function unloadScreen(){stopLabMedia($('screen'));$('screen').replaceChildren()}
function render(){
 const selected=world.snapshot().screens.find(x=>x.id===screen.id);
 const host=$('screen');
 unloadScreen();
 if(!selected?.current){
  const p=document.createElement('p');p.id='blank';p.textContent='Nothing is showing yet.';host.append(p);
 }else{
  try{host.append(renderWorldScreen(selected.current,{
   documentRef:document,
   resolveAsset:(id,kind)=>leases.resolve(id,kind)
  }))}
  catch(error){const p=document.createElement('p');p.textContent='Display unavailable: '+String(error.message||error);host.append(p);}
 }
 prune();updateQueue();
}
function teardown(){
 if(disposed)return;disposed=true;uploadEpoch++;
 stopLabMedia($('screen'));leases.dispose();
}
addEventListener('pagehide',teardown,{once:true});
async function prepareFile(file,kind){
 const epoch=++uploadEpoch;
 $('upload').disabled=true;$('generate').disabled=true;
 say('Validating local media file before keeping it…');
 try{
  const info=await validateLabMediaFile(file,kind,{probeImage:probeBrowserImage,probeVideo:probeBrowserVideo});
  if(disposed||epoch!==uploadEpoch||$('kind').value!==kind)throw new Error('The selection changed during media validation.');
  const row=leases.add(file,kind);
  currentAsset=row;
  $('source-url').value='';
  prune();
  say(`Validated local ${kind} (${Math.round(info.size/1024)} KiB). No file was uploaded.`);
 }catch(error){say('Media rejected: '+String(error.message||error).slice(0,200))}
 finally{if(epoch===uploadEpoch){$('upload').disabled=false;$('generate').disabled=false;}}
}
$('upload').addEventListener('change',()=>{
 const file=$('upload').files?.[0];
 $('upload').value='';
 if(file)void prepareFile(file,$('kind').value);
});
$('kind').addEventListener('change',()=>{
 uploadEpoch++;
 currentAsset=null;$('source-url').value='';
 updateInputs();prune();
 $('upload').disabled=$('kind').value==='website';
 $('generate').disabled=false;
});
$('generate').addEventListener('click',async()=>{
 if($('kind').value!=='image')return;
 const epoch=++uploadEpoch;
 const canvas=document.createElement('canvas');
 canvas.width=960;canvas.height=540;
 const ctx=canvas.getContext('2d');
 if(!ctx){say('Canvas image generation is unavailable.');return;}
 const gradient=ctx.createLinearGradient(0,0,960,540);
 gradient.addColorStop(0,'#292d57');gradient.addColorStop(1,'#187a77');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,960,540);
 ctx.fillStyle='#fff';ctx.font='bold 68px system-ui';ctx.fillText('Worldweaver',84,235);
 ctx.font='35px system-ui';ctx.fillText('A shared creative screen',88,300);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob){say('Could not generate local slide.');return;}
 if(epoch!==uploadEpoch||$('kind').value!=='image'||disposed)return;
 $('title').value='Generated workshop slide';
 void prepareFile(blob,'image');
});
function content(){
 const kind=$('kind').value,url=$('source-url').value.trim();
 const title=$('title').value.trim()||'Untitled display';
 const source=url?{url}:currentAsset?.kind===kind?{assetId:currentAsset.assetId}:null;
 if(!source)throw new TypeError('Choose a supported media file, generated slide, or HTTPS link.');
 return normalizeScreenContent({kind,source,title,alt:title});
}
$('cast-human').addEventListener('click',()=>{
 try{
  world.dispatch({type:'cast-screen',screenId:screen.id,content:content()},human);
  render();say('Human cast confirmed locally. Pending older model casts cannot overwrite it.');
 }catch(error){say('Cast rejected: '+String(error.message||error))}
});
$('queue-model').addEventListener('click',()=>{
 try{
  if(activeIntent()&&!terminal.has(activeIntent().status))throw new Error('Resolve or cancel the existing pending cast first.');
  const queued=world.dispatch({type:'queue-actions',npcId:npc.id,
   actions:[{tool:'cast-screen',args:{screenId:screen.id,content:content()}}]},model).intents[0];
  pendingId=queued.id;prune();updateQueue();
  say(`Simulated model submitted intent ${queued.id}: ${queued.status}. The display has not changed.`);
 }catch(error){say('Cannot queue: '+String(error.message||error))}
});
$('approve').addEventListener('click',()=>{
 try{
  const item=activeIntent();if(!item)throw new Error('No pending model cast.');
  world.dispatch({type:'approve-cast',intentId:item.id},human);
  updateQueue();say('Human approved the external URL. A renderer acknowledgement is still required.');
 }catch(error){say('Approval failed: '+String(error.message||error))}
});
$('reject').addEventListener('click',()=>{
 try{
  const item=activeIntent();if(!item)throw new Error('No pending model cast.');
  world.dispatch({type:'reject-cast',intentId:item.id,reason:'Denied during local review.'},human);
  prune();updateQueue();say('Model cast rejected; existing display is unchanged.');
 }catch(error){say('Rejection failed: '+String(error.message||error))}
});
$('cancel').addEventListener('click',()=>{
 try{
  const item=activeIntent();if(!item)throw new Error('No pending model cast.');
  world.dispatch({type:'cancel-cast',intentId:item.id},human);
  prune();updateQueue();say('Pending model cast cancelled. The current screen is preserved.');
 }catch(error){say('Cancellation failed: '+String(error.message||error))}
});
$('apply').addEventListener('click',()=>{
 try{
  const item=activeIntent();if(!item)throw new Error('No pending model cast.');
  // This deliberately uses a lab-only fake runtime. It does not assert world delivery.
  world.dispatch({type:'report-action',intentId:item.id,outcome:'succeeded',summary:'Local lab preview only'},runtime);
  render();say('Local renderer simulation acknowledged cast. Live 3D integration remains unimplemented.');
 }catch(error){say('Renderer acknowledgement refused: '+String(error.message||error))}
});
$('clear').addEventListener('click',()=>{
 try{
  world.dispatch({type:'clear-screen',screenId:screen.id},human);
  render();say('Screen cleared. Video playback and unused object URLs are released.');
 }catch(error){say('Clear failed: '+String(error.message||error))}
});
updateInputs();updateQueue();render();
