import {createWorldweaver} from '../shared/worldweaver-core-v1.mjs';
import {normalizeScreenContent,renderWorldScreen} from '../shared/worldweaver-screen-v1.mjs';

const $=id=>document.getElementById(id);
const assetRegistry=new Map(),objectUrls=[];
let counter=0,pendingId=null,currentAsset=null;
const human={kind:'human',principalId:'lab:human',verified:true};
const model={kind:'model',principalId:'lab:model',modelId:'demo:model',verified:true};
const runtime={kind:'runtime',principalId:'lab:renderer',verified:true};
// This in-browser simulation is NOT an authentication adapter for a deployed world.
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
function log(text){
  const lines=($('log').textContent||'').split('\n').filter(Boolean);
  lines.unshift(text);
  $('log').textContent=lines.slice(0,12).join('\n');
}
function say(text){
  $('status').textContent=text;
  log(text);
}
function updateInputs(){
  const kind=$('kind').value;
  $('upload').accept=kind==='video'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp';
  $('file-options').hidden=kind==='website';
  $('generate').hidden=kind!=='image';
}
function releaseAssets(){
  // Only session-created object URLs can be revoked; external media links never become object URLs.
  for(const url of objectUrls)URL.revokeObjectURL(url);
}
addEventListener('pagehide',releaseAssets,{once:true});
function keepFile(file,kind){
  if(!file||file.size>50*1024*1024)throw new TypeError('Selected media must be at most 50 MB for this local demo.');
  const permitted=kind==='video'?['video/mp4','video/webm']:['image/png','image/jpeg','image/webp'];
  if(!permitted.includes(file.type))throw new TypeError('Selected file type is not supported by this screen.');
  const assetId=`lab:asset-${++counter}`;
  const url=URL.createObjectURL(file);
  objectUrls.push(url);
  assetRegistry.set(assetId,{assetId,url,kind});
  currentAsset={assetId,kind};
  say(`Local ${kind} prepared. It has not been uploaded or published.`);
}
$('upload').addEventListener('change',()=>{
  const file=$('upload').files?.[0];
  if(!file)return;
  try{keepFile(file,$('kind').value)}catch(error){say(String(error.message||error))}
});
$('kind').addEventListener('change',()=>{currentAsset=null;$('source-url').value='';$('upload').value='';updateInputs()});
$('generate').addEventListener('click',async()=>{
  if($('kind').value!=='image')return;
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
  const ctx=canvas.getContext('2d');if(!ctx){say('Canvas image generation is unavailable.');return}
  const gradient=ctx.createLinearGradient(0,0,960,540);
  gradient.addColorStop(0,'#292d57');gradient.addColorStop(1,'#187a77');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,960,540);
  ctx.fillStyle='#ffffff';ctx.font='bold 68px system-ui';ctx.fillText('Worldweaver',84,235);
  ctx.font='35px system-ui';ctx.fillText('A shared creative screen',88,300);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob){say('Unable to generate local slide.');return}
  keepFile(blob,'image');
  $('title').value='Generated workshop slide';
});
function content(){
  const kind=$('kind').value;
  const url=$('source-url').value.trim();
  const title=$('title').value.trim()||'Untitled display';
  const src=url?{url}:currentAsset?.kind===kind?{assetId:currentAsset.assetId}:null;
  if(!src)throw new TypeError('Select a file, generate a slide, or provide an HTTPS URL first.');
  return normalizeScreenContent({kind,source:src,title,alt:title});
}
function render(){
  const state=world.snapshot(),selected=state.screens.find(s=>s.id===screen.id);
  const host=$('screen');host.replaceChildren();
  if(!selected.current){
    const p=document.createElement('p');p.textContent='Nothing is showing yet.';p.id='blank';host.append(p);return;
  }
  try{
    const visual=renderWorldScreen(selected.current,{
      documentRef:document,
      resolveAsset:(id,kind)=>{const record=assetRegistry.get(id);return record?.kind===kind?record:null}
    });
    host.append(visual);
  }catch(error){
    const p=document.createElement('p');p.textContent='Display unavailable: '+String(error.message||error);
    host.append(p);
  }
}
$('cast-human').addEventListener('click',()=>{
  try{world.dispatch({type:'cast-screen',screenId:screen.id,content:content()},human);render();say('Manual presentation recorded for the local lab screen.')}
  catch(error){say(String(error.message||error))}
});
$('queue-model').addEventListener('click',()=>{
  try{
    const item=world.dispatch({type:'queue-actions',npcId:npc.id,
      actions:[{tool:'cast-screen',args:{screenId:screen.id,content:content()}}]},model).intents[0];
    pendingId=item.id;
    $('pending').textContent=item.status==='review-required'?'Awaiting human review of external URL.':'Awaiting trusted renderer acknowledgement.';
    say('Sample model submitted a cast intent; it has not changed the screen.');
  }catch(error){say(String(error.message||error))}
});
$('approve').addEventListener('click',()=>{
  try{
    if(!pendingId)throw new Error('No model cast is pending.');
    world.dispatch({type:'approve-cast',intentId:pendingId},human);
    $('pending').textContent='Reviewed external URL. Ready for simulated renderer acknowledgement.';
    say('The external URL was approved for this lab demonstration.');
  }catch(error){say(String(error.message||error))}
});
$('reject').addEventListener('click',()=>{
  try{
    if(!pendingId)throw new Error('No model cast is pending.');
    world.dispatch({type:'reject-cast',intentId:pendingId,reason:'User rejected the demo cast.'},human);
    pendingId=null;$('pending').textContent='No model cast pending.';
    say('Cast rejected; existing screen content is unchanged.');
  }catch(error){say(String(error.message||error))}
});
$('apply').addEventListener('click',()=>{
  try{
    if(!pendingId)throw new Error('No model cast is pending.');
    world.dispatch({type:'report-action',intentId:pendingId,outcome:'succeeded',summary:'Local lab preview acknowledged'},runtime);
    pendingId=null;$('pending').textContent='No model cast pending.';
    render();say('Simulated renderer acknowledged the cast. In production this requires a real trusted world adapter.');
  }catch(error){say(String(error.message||error))}
});
$('clear').addEventListener('click',()=>{
  try{world.dispatch({type:'clear-screen',screenId:screen.id},human);render();say('Screen cleared.')}
  catch(error){say(String(error.message||error))}
});
updateInputs();render();
