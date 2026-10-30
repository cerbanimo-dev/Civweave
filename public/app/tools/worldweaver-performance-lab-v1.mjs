import {createPerformanceStudio,performanceObservation} from '../shared/worldweaver-performance-studio-v1.mjs';
import {compileStageScene,compilePerformanceScore} from '../shared/worldweaver-stagecraft-v1.mjs';
import {proposeScreenplayViaModel} from '../shared/worldweaver-adaptation-model-v1.mjs';
import {exportFilmCraftInterchange,exportQwenLoRADataset} from '../shared/worldweaver-filmcraft-interchange-v1.mjs';
import {createWorldweaver} from '../shared/worldweaver-core-v1.mjs';
import {createOpenSim3DPreview} from '../shared/worldweaver-3d-preview-v1.mjs';
import {projectWorld2D,renderWorldMap2D} from '../shared/worldweaver-map-2d-v1.mjs';

const $=id=>document.getElementById(id);
const text=(x,max=220)=>String(x??'').slice(0,max);
const human={kind:'human',principalId:'lab:producer',verified:true};
// Synthetic lab identity is not proof of authenticated Guild authority.
const audience={kind:'audience',principalId:'local:audience:'+crypto.randomUUID(),verified:true};
const studio=createPerformanceStudio({
 id:()=>crypto.randomUUID(),clock:()=>new Date().toISOString(),
 authorize:({actor,command})=>{
  if(actor.verified!==true)return false;
  if(['create-project','add-source','review-scene','assign-cast','start-rehearsal','finish-rehearsal'].includes(command.type))return actor.kind==='human';
  if(command.type==='propose-scenes')return ['human','model'].includes(actor.kind);
  if(command.type==='perform-cue')return ['human','model','runtime'].includes(actor.kind);
  if(command.type==='submit-audience')return actor.kind==='audience';
  if(command.type==='withdraw-audience')return ['human','audience'].includes(actor.kind);
  return false;
 }});
const world=createWorldweaver({id:()=>crypto.randomUUID(),authorize:({actor,command})=>
 actor.verified===true&&actor.kind==='human'});
const room=world.dispatch({type:'create',guide:'moss',title:'Performance Studio · local stage'},human).instance;
const screen=world.dispatch({type:'create-screen',instanceId:room.id,title:'Stage Weave screen'},human).screen;
let selected=null,stage=null,viewer=null,score=null,rehearsalId=null,eventIndex=0,activeMoment=null;
let lastAudience=null,recognizer=null,voiceAllowed=false,modelBusy=false;
function status(msg){$('status').textContent=msg;}
function report(msg){$('cue-status').textContent=msg;}
function getScene(){return studio.snapshot().proposals.find(s=>s.id===selected)||null;}
function download(filename,content,type='application/json'){
 const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function updateScenes(){
 const state=studio.snapshot(),old=selected;
 $('scene-select').replaceChildren();
 for(const scene of state.proposals){
  const el=document.createElement('option');el.value=scene.id;
  el.textContent=scene.title+' · '+scene.status;
  $('scene-select').append(el);
 }
 selected=state.proposals.some(s=>s.id===old)?old:(state.proposals.at(-1)?.id||null);
 if(selected)$('scene-select').value=selected;
 $('production-state').textContent='Project: '+(state.project?.title||'not created')+' · revision '+state.revision;
 $('sources-status').textContent=state.sources.length+' manuscript excerpts in this session.';
 const item=getScene();
 $('approve-scene').disabled=!item||item.status!=='review-required';
 $('reject-scene').disabled=!item||item.status!=='review-required';
 $('rehearse').disabled=!item||item.status!=='approved'||Boolean(studio.snapshot().rehearsals.some(r=>r.status==='running'));
 $('next-cue').disabled=!rehearsalId;
 $('finish').disabled=!rehearsalId;
 $('script-lines').replaceChildren();
 if(item){
  for(let i=0;i<item.dialogue.length;i++){
   const row=document.createElement('p');
   const b=document.createElement('strong');b.textContent=item.dialogue[i].character+': ';
   row.append(b,document.createTextNode(item.dialogue[i].text));$('script-lines').append(row);
  }
 }
}
function showStage(){
 if(viewer){viewer.close();viewer=null;}
 stage=null;score=null;
 const scene=getScene(),state=studio.snapshot();
 if(!scene||scene.status!=='approved'){
  $('stage-note').textContent='Select and approve a reviewed scene before building a stage. Unreviewed AI output is never applied.';
  $('stage-map').replaceChildren();return;
 }
 try{
  stage=compileStageScene(state,scene.id,{instanceId:room.id}),score=compilePerformanceScore(state,scene.id);
  viewer=createOpenSim3DPreview({canvas:$('stage-viewer'),getGeometry:()=>stage.geometry,onSelect:hit=>{
   $('stage-note').textContent='Selected '+hit.objectId+' (stage stand-in). Native actor rigging remains pending.';
  }});
  viewer.update();
  const projected=projectWorld2D(world.snapshot(),{worldRef:room.id,layout:{sceneGeometry:stage.geometry}});
  $('stage-map').replaceChildren(renderWorldMap2D(projected,{documentRef:document,onActivate:e=>
   status('Stage map inspected '+e.objectId+'. Real world edits require the trusted renderer.')}));
  $('stage-note').textContent=stage.region.objects.length+' stage objects · '+stage.geometry.faces.length+
   ' 3D triangles · 2D map uses the same geometry. Actor bodies are provisional markers, not real rigs.';
 }catch(error){status('Unable to stage: '+text(error.message));}
}
$('create-project').addEventListener('click',()=>{
 try{
  studio.dispatch({type:'create-project',title:$('production-title').value,
   sourceTitle:$('book-title').value,rights:$('rights').value,visualBrief:$('art-brief').value},human);
  updateScenes();status('Private production created; import only material for which you have adaptation rights.');
 }catch(error){status('Project creation rejected: '+text(error.message));}
});
$('add-source').addEventListener('click',()=>{
 try{
  studio.dispatch({type:'add-source',chapter:$('chapter-title').value,text:$('source-text').value},human);
  updateScenes();status('Source chunk saved in this browser session. Reviewable model proposals can now reference it.');
 }catch(error){status('Source import rejected: '+text(error.message));}
});
function manualScene(){
 const snapshot=studio.snapshot();
 if(!snapshot.sources.length)throw new Error('Import a rights-cleared manuscript excerpt first.');
 const lines=$('dialogue').value.split('\n').map(s=>s.trim()).filter(Boolean);
 if(!lines.length||lines.length>60)throw new Error('Enter 1–60 dialogue lines in CHARACTER: text format.');
 const dialogue=lines.map(line=>{
  const colon=line.indexOf(':');if(colon<=0)throw new Error('Each line needs CHARACTER: dialogue.');
  const char=line.slice(0,colon).trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-');
  return {character:char,text:line.slice(colon+1).trim(),direction:'',seconds:Math.max(3,Math.min(90,Math.ceil((line.length-colon-1)/14)))};
 });
 const title=$('scene-title').value.trim(),slug=title.toLowerCase().replace(/[^a-z0-9-]+/g,'-')+'-'+(snapshot.proposals.length+1);
 const moment=$('audience-prompt').value.trim();
 return {slug,title,synopsis:$('scene-synopsis').value,sourceIds:[snapshot.sources.at(-1).id],dialogue,
  set:{location:$('location').value,mood:'surreal intimate wonder and playful unease',color:'#365967',
   props:[{id:'table',name:'Stage table',shape:'box',x:8,y:3,width:3,depth:2,height:1.5,color:'#9b8069'}],
   light:'soft practical lanterns with a readable edge',ambience:'quiet room tone'},
  moments:moment?[{id:'moment-1',afterLine:Math.max(0,dialogue.length-1),prompt:moment,mode:'reflection',
   use:'Pause for optional reflection, do not rewrite established manuscript continuity',maxSeconds:30}]:[],
  visualDirection:$('art-brief').value.slice(0,800)};
}
$('draft-scene').addEventListener('click',()=>{
 try{
  studio.dispatch({type:'propose-scenes',scenes:[manualScene()]},human);updateScenes();showStage();
  status('Screenplay draft created. Review it before any stage or character action.');
 }catch(error){status('Cannot draft scene: '+text(error.message));}
});
$('generate-scene').addEventListener('click',async()=>{
 if(modelBusy)return;
 modelBusy=true;$('generate-scene').disabled=true;
 try{
  const state=studio.snapshot(),runtime=globalThis.CivweaveModelRuntime;
  const cfg=runtime?.readSharedConfig?.('agentic')||runtime?.readSharedConfig?.('interactive');
  if(!cfg?.provider||['manual','deterministic'].includes(cfg.provider))
   throw new Error('Choose a local or consented cloud model in Civweave AI settings.');
  if(!state.sources.length)throw new Error('Import a manuscript excerpt first.');
  const {runCodeInference}=await import('/creator-suite/shared/code-inference-route-v1.mjs');
  const loaders=await import('/creator-suite/shared/creator-inference-loaders-v1.mjs');
  const selection=loaders.currentCreatorLocalSelection();
  const actor={kind:'model',principalId:'lab:model:'+text(cfg.model,80).replace(/[^a-z0-9:._/-]/gi,'_'),
   modelId:cfg.model||'selected-model',verified:true};
  status('Generating a bounded screenplay proposal with '+text(cfg.model||cfg.provider)+'. No automatic approval.');
  await proposeScreenplayViaModel({studio,actor,sourceIds:[state.sources.at(-1).id],
   objective:'Adapt the provided source into one filmable stage scene with dialogue, physical blocking hints, and one optional audience reflection at a fitting moment.',
   invokeModel:async({messages,purpose,maxOutputTokens,signal})=>{
    const response=await runCodeInference(cfg,messages,{
     selection,loadLocal:loaders.loadCreatorLocalRuntime,loadServer:loaders.loadCreatorServerRuntime,
     sharedRuntime:runtime,signal,purpose,mediaType:'text',taskTier:'complex',
     maxTokens:Math.min(Math.max(1800,Number(cfg.maxTokens)||4096),8192),requiresTools:true
    });
    if(response?.status!=='success'||response?.fallback?.provider==='deterministic')
     throw new Error('Selected AI did not return a successful structured response.');
    return response;
   }});
  updateScenes();showStage();status('Model screenplay proposal saved as review-required. You retain approval control.');
 }catch(error){status('Model proposal unavailable: '+text(error.message,300));}
 finally{modelBusy=false;$('generate-scene').disabled=false;}
});
$('scene-select').addEventListener('change',()=>{selected=$('scene-select').value;showStage();updateScenes()});
for(const [button,decision] of [['approve-scene','approved'],['reject-scene','rejected']]){
 $(button).addEventListener('click',()=>{
  try{
   studio.dispatch({type:'review-scene',sceneId:selected,decision,notes:$('review-notes').value},human);
   updateScenes();showStage();status('Scene '+decision+'. Review receipt recorded in the production journal.');
  }catch(error){status('Review failed: '+text(error.message));}
 });
}
$('rehearse').addEventListener('click',()=>{
 try{
  const receipt=studio.dispatch({type:'start-rehearsal',sceneId:selected},human);
  rehearsalId=receipt.rehearsal;eventIndex=0;activeMoment=null;
  updateScenes();report('Rehearsal started. Play cues one by one. Voice output is opt-in.');
 }catch(error){report('Could not start: '+text(error.message))}
});
$('next-cue').addEventListener('click',()=>{
 if(!rehearsalId||!score)return;
 const event=score.events[eventIndex++];
 if(!event){report('Cue score complete. Finish the rehearsal to close it.');return;}
 if(event.type==='dialogue'){
  const index=getScene().dialogue.findIndex((l,i)=>i===score.events.slice(0,eventIndex).filter(e=>e.type==='dialogue').length-1);
  try{studio.dispatch({type:'perform-cue',rehearsalId,lineIndex:index,outcome:'played',notes:'Browser-local table read'},human)}
  catch(error){report('Cue error: '+text(error.message));return}
  activeMoment=null;
  if($('speak-lines').checked&&globalThis.speechSynthesis){
   const utterance=new SpeechSynthesisUtterance(event.text);
   utterance.rate=1;globalThis.speechSynthesis.speak(utterance);
  }
  report('Actor '+event.character+' · '+event.text);
 }else{
  activeMoment=event.momentId;
  report('Audience invitation: '+event.prompt+' (optional, separately consented).');
 }
});
$('finish').addEventListener('click',()=>{
 try{
  if(!rehearsalId)throw new Error('No active rehearsal');
  studio.dispatch({type:'finish-rehearsal',rehearsalId},human);rehearsalId=null;
  activeMoment=null;globalThis.speechSynthesis?.cancel?.();recognizer?.stop?.();recognizer=null;
  updateScenes();report('Rehearsal completed; production receipts and consented responses retained locally.');
 }catch(error){report('Cannot finish: '+text(error.message));}
});
$('transcribe').addEventListener('click',()=>{
 if(!$('audience-consent').checked||!rehearsalId||!activeMoment){
  $('audience-status').textContent='Give participation consent and reach a live invitation moment first.';return;
 }
 const Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;
 if(!Recognition){$('audience-status').textContent='Speech recognition unsupported here. Type your response instead.';return;}
 if(recognizer){$('audience-status').textContent='Transcription is already active.';return;}
 const rec=new Recognition();recognizer=rec;rec.lang='en-US';rec.continuous=false;rec.interimResults=false;
 rec.onresult=e=>{
  const result=Array.from(e.results||[]).map(r=>r[0]?.transcript||'').join(' ');
  $('feedback-text').value=( $('feedback-text').value+' '+result).trim().slice(0,1200);
  $('audience-status').textContent='Speech converted to text; review before submitting. No audio saved by the lab.';
 };
 rec.onerror=e=>{$('audience-status').textContent='Speech recognition unavailable: '+text(e.error);};
 rec.onend=()=>{if(recognizer===rec)recognizer=null;};
 try{rec.start();$('audience-status').textContent='Microphone active for opt-in transcription. Browser speech services may contact a provider.';}
 catch(error){recognizer=null;$('audience-status').textContent='Unable to start recognition: '+text(error.message);}
});
$('stop-transcription').addEventListener('click',()=>{recognizer?.stop?.();recognizer=null;$('audience-status').textContent='Speech transcription stopped. Edit or discard the unsubmitted text.'});
$('submit-feedback').addEventListener('click',()=>{
 try{
  if(!rehearsalId||!activeMoment)throw new Error('Feedback is accepted only at an active audience moment.');
  const receipt=studio.dispatch({type:'submit-audience',rehearsalId,momentId:activeMoment,kind:'text',
   text:$('feedback-text').value,consent:{participation:$('audience-consent').checked,training:$('training-consent').checked}},audience);
  lastAudience=receipt.responseId;$('feedback-text').value='';$('audience-consent').checked=false;$('training-consent').checked=false;
  $('audience-status').textContent='Voluntary response stored locally; its training permission is separate. You may withdraw it.';
 }catch(error){$('audience-status').textContent='Response not saved: '+text(error.message);}
});
$('withdraw-feedback').addEventListener('click',()=>{
 try{
  if(!lastAudience)throw new Error('No response from this session to withdraw');
  studio.dispatch({type:'withdraw-audience',responseId:lastAudience},audience);
  lastAudience=null;$('audience-status').textContent='Your previous text and training permission were cleared from active studio state.';
 }catch(error){$('audience-status').textContent='Withdrawal failed: '+text(error.message);}
});
$('filmcraft').addEventListener('click',()=>{
 try{const item=exportFilmCraftInterchange(studio.snapshot());
  download('filmcraft-stage-edit-plan.json',JSON.stringify(item,null,2));
  $('exports').textContent=item.sceneCount+' approved scenes · '+Math.round(item.seconds/60)+' planned minutes · no rendered media clips yet. Includes VTT contents.';
 }catch(error){status('Film export blocked: '+text(error.message));}
});
$('lora').addEventListener('click',()=>{
 try{const result=exportQwenLoRADataset(studio.snapshot(),{
  trainingAuthorized:$('training-authorized').checked,includeAudience:$('include-audience').checked});
  download('qwen35-4b-screenplay-train.jsonl',result.training,'application/x-ndjson');
  download('qwen35-4b-screenplay-validation.jsonl',result.validation,'application/x-ndjson');
  $('exports').textContent=result.count+' reviewed training examples · '+result.consentedAudienceIncluded+
   ' separately consented audience examples. No actual model fine-tuning occurred. Very small datasets are demonstrations only.';
 }catch(error){status('Training export blocked: '+text(error.message));}
});
$('export-state').addEventListener('click',()=>{
 const data=studio.snapshot();if(!data.project){status('Create a project before exporting.');return;}
 download('civweave-private-performance-project.json',JSON.stringify(data,null,2));
 status('Exported the PRIVATE project; it may contain manuscript and optional participant text. Keep the file confidential.');
});
addEventListener('pagehide',()=>{viewer?.close();recognizer?.stop?.();globalThis.speechSynthesis?.cancel?.();},{once:true});
updateScenes();showStage();
