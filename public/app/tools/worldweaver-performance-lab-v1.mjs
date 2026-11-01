import {createPerformanceStudio,performanceObservation} from '../shared/worldweaver-performance-studio-v1.mjs';
import {compileStageScene,compilePerformanceScore,previewSceneGeometry} from '../shared/worldweaver-stagecraft-v1.mjs?v=threshold-device-review-v2';
import {proposeScreenplayViaModel,proposeStageViaModel} from '../shared/worldweaver-adaptation-model-v1.mjs';
import {exportFilmCraftInterchange,exportQwenLoRADataset,exportArtCraftTrailerPackage} from '../shared/worldweaver-filmcraft-interchange-v1.mjs?v=threshold-device-review-v1';
import {importTrailerAuthoring,MAX_TRAILER_AUTHORING_BYTES,saveTrailerReviewArtifact,createTrailerDeviceReview} from '../shared/worldweaver-trailer-authoring-v1.mjs?v=threshold-device-review-v3';
import {mountProductionReview} from '../shared/worldweaver-production-review-v1.mjs?v=threshold-device-review-v3';
import {createWorldweaver} from '../shared/worldweaver-core-v1.mjs';
import {createOpenSim3DPreview} from '../shared/worldweaver-3d-preview-v1.mjs';
import {projectWorld2D,renderWorldMap2D} from '../shared/worldweaver-map-2d-v1.mjs';

const $=id=>document.getElementById(id);
const text=(x,max=220)=>String(x??'').slice(0,max);
const human={kind:'human',principalId:'lab:producer',verified:true};
// Synthetic lab identity is not proof of authenticated Guild authority.
const audience={kind:'audience',principalId:'local:audience:'+crypto.randomUUID(),verified:true};
function makeLabStudio(initialState){return createPerformanceStudio({
 id:()=>crypto.randomUUID(),clock:()=>new Date().toISOString(),
 initialState,
 authorize:({actor,command})=>{
  if(actor.verified!==true)return false;
  if(['create-project','add-source','review-scene','assign-cast','start-rehearsal','finish-rehearsal'].includes(command.type))return actor.kind==='human';
  if(['propose-scenes','propose-stage'].includes(command.type))return ['human','model'].includes(actor.kind);
  if(command.type==='review-stage')return actor.kind==='human';
  if(command.type==='perform-cue')return ['human','model','runtime'].includes(actor.kind);
  if(['open-audience-moment','close-audience-moment'].includes(command.type))return actor.kind==='human';
  if(command.type==='submit-audience')return actor.kind==='audience';
  if(command.type==='withdraw-audience')return ['human','audience'].includes(actor.kind);
  return false;
 }});}
let studio=makeLabStudio();
const world=createWorldweaver({id:()=>crypto.randomUUID(),authorize:({actor,command})=>
 actor.verified===true&&actor.kind==='human'});
const room=world.dispatch({type:'create',guide:'moss',title:'Performance Studio · local stage'},human).instance;
const screen=world.dispatch({type:'create-screen',instanceId:room.id,title:'Stage Weave screen'},human).screen;
let selected=null,stage=null,viewer=null,score=null,rehearsalId=null,eventIndex=0,activeMoment=null;
let lastAudience=null,recognizer=null,voiceAllowed=false,modelBusy=false;
let trailerImportReceipt=null,trailerFileRead=0,deviceReview=null,productionReview=null;
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
 const choices=[...new Set(item?.dialogue.map(x=>x.character)||[])];
 const selectedRole=$('cast-character').value;
 $('cast-character').replaceChildren();
 for(const name of choices){
  const opt=document.createElement('option');opt.value=name;opt.textContent=name;
  $('cast-character').append(opt);
 }
 if(choices.includes(selectedRole))$('cast-character').value=selectedRole;
 const stagePlans=state.stagePlans?.filter(x=>x.sceneId===item?.id)||[];
 const pendingStage=stagePlans.find(x=>x.status==='review-required');
 $('stage-review').textContent=pendingStage?
  'Stage revision awaiting director review: '+pendingStage.note:
  'Stage revisions: '+stagePlans.length+'. Only approved geometry changes are shown.';
 $('approve-set').disabled=!pendingStage;
 $('reject-set').disabled=!pendingStage;
 $('propose-set').disabled=!item||item.status!=='approved'||Boolean(pendingStage);
 $('assign-avatar').disabled=!item||item.status!=='approved';
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
 if(trailerImportReceipt)for(const id of ['add-source','draft-scene','generate-scene','approve-scene','reject-scene','propose-set','approve-set','reject-set','assign-avatar','rehearse','next-cue','finish'])$(id).disabled=true;
}
function showStage({actorPositions,actorHeights,visibleCharacters,frame,retainView=false}={}){
 if(viewer&&!retainView){viewer.close();viewer=null;}
 stage=null;score=null;
 const scene=getScene(),state=studio.snapshot();
 if(!scene||scene.status==='rejected'){
  $('stage-note').textContent='Select a scene to inspect its proposed set. Real staging and execution still require approval.';
  $('stage-map').replaceChildren();return;
 }
 try{
  stage=scene.status==='approved'&&frame==null?compileStageScene(state,scene.id,{instanceId:room.id}):previewSceneGeometry(state,scene.id,{instanceId:room.id,actorPositions:actorPositions||{},actorHeights:actorHeights||{},visibleCharacters});
  score=scene.status==='approved'?compilePerformanceScore(state,scene.id):null;
  if(!viewer)viewer=createOpenSim3DPreview({canvas:$('stage-viewer'),getGeometry:()=>stage.geometry,onSelect:hit=>{
   $('stage-note').textContent='Selected '+hit.objectId+' (stage stand-in). Native actor rigging remains pending.';
  }});
  viewer.update();
  const projected=projectWorld2D(world.snapshot(),{worldRef:room.id,layout:{sceneGeometry:stage.geometry}});
  $('stage-map').replaceChildren(renderWorldMap2D(projected,{documentRef:document,onActivate:e=>
   status('Stage map inspected '+e.objectId+'. Real world edits require the trusted renderer.')}));
  $('stage-note').textContent=(stage.previewOnly?'DRAFT REVIEW DIAGRAM · ':'APPROVED SCRIPT MOCKUP · ')+(frame==null?'':'frame '+frame+' · ')+stage.region.objects.length+' proposed objects · '+stage.geometry.faces.length+
   ' 3D triangles · 2D map uses the same geometry. Actor bodies are markers, not validated rigs. No world action executed.';
 }catch(error){status('Unable to stage: '+text(error.message));}
}
document.addEventListener('civweave:trailer-preview-frame',event=>{
 try{
  const plan=JSON.parse($('trailer-shot-plan').value);exportArtCraftTrailerPackage(studio.snapshot(),plan);
  const shot=plan.shots.find(row=>row.id===event.detail?.shotId),frame=event.detail?.frame;
  if(!shot||!Number.isSafeInteger(frame)||frame<shot.inFrame||frame>shot.outFrame)throw new Error('Select a valid shot and review frame.');
  const positions={};for(const character of new Set((shot.blocking||[]).map(row=>row.character))){
   const cues=shot.blocking.filter(row=>row.character===character).sort((a,b)=>a.inFrame-b.inFrame);let position=cues[0].from;
   for(const cue of cues){if(frame<cue.inFrame)break;const t=Math.max(0,Math.min(1,(frame-cue.inFrame)/(cue.outFrame-cue.inFrame)));position=Object.fromEntries(['x','y','z'].map(axis=>[axis,cue.from[axis]+(cue.to[axis]-cue.from[axis])*t]));if(frame<cue.outFrame)break;}
   positions[character]=position;
  }
  const known=new Set(studio.snapshot().proposals.find(row=>row.id===shot.sceneId).dialogue.map(row=>row.character));
  const heights=Object.fromEntries((plan.rigRequirements||[]).filter(row=>known.has(row.character)&&row.proportions?.heightMeters!==undefined).map(row=>[row.character,row.proportions.heightMeters]));
  const same=selected===shot.sceneId;selected=shot.sceneId;$('scene-select').value=selected;showStage({actorPositions:positions,actorHeights:heights,visibleCharacters:[...new Set((shot.blocking||[]).map(row=>row.character))],frame,retainView:same});
 }catch(error){status('Review preview needs repair: '+text(error.message,500));}
});
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
  if(runtime?.endpointLeavesDevice?.(cfg)&&!$('cloud-consent').checked)
   throw new Error('Explicit permission required to send source material to a remote model');
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
 finally{modelBusy=false;$('cloud-consent').checked=false;$('generate-scene').disabled=false;}
});
$('propose-set').addEventListener('click',async()=>{
 if(modelBusy)return;
 modelBusy=true;$('propose-set').disabled=true;
 try{
  const state=studio.snapshot(),scene=getScene(),runtime=globalThis.CivweaveModelRuntime;
  const cfg=runtime?.readSharedConfig?.('agentic')||runtime?.readSharedConfig?.('interactive');
  if(!scene||scene.status!=='approved')throw new Error('Approve a screenplay scene first');
  if(runtime?.endpointLeavesDevice?.(cfg)&&!$('cloud-consent').checked)
   throw new Error('Explicit permission required to send source material to a remote model');
  if(!cfg?.provider||['manual','deterministic'].includes(cfg.provider))
   throw new Error('Select a real local or consented cloud model in Civweave settings');
  const {runCodeInference}=await import('/creator-suite/shared/code-inference-route-v1.mjs');
  const loaders=await import('/creator-suite/shared/creator-inference-loaders-v1.mjs');
  const actor={kind:'model',principalId:'lab:model:'+text(cfg.model,80).replace(/[^a-z0-9:._/-]/gi,'_'),modelId:cfg.model||'selected-model',verified:true};
  status('Model is proposing an alternative stage set; no geometry changes before review.');
  await proposeStageViaModel({studio,actor,sceneId:scene.id,
   invokeModel:async({messages,purpose,signal})=>{
    const response=await runCodeInference(cfg,messages,{selection:loaders.currentCreatorLocalSelection(),
     loadLocal:loaders.loadCreatorLocalRuntime,loadServer:loaders.loadCreatorServerRuntime,
     sharedRuntime:runtime,signal,purpose,mediaType:'text',taskTier:'complex',
     requiresTools:true,maxTokens:Math.min(Math.max(1400,Number(cfg.maxTokens)||2700),8192)});
    if(response?.status!=='success'||response?.fallback?.provider==='deterministic')throw new Error('Stage model did not complete');
    return response;
   }});
  updateScenes();status('Model set redesign is pending human approval. Existing stage remains unchanged.');
 }catch(error){status('Stage redesign not applied: '+text(error.message,300));}
 finally{modelBusy=false;$('cloud-consent').checked=false;updateScenes();}
});
for(const [button,decision] of [['approve-set','approved'],['reject-set','rejected']]){
 $(button).addEventListener('click',()=>{
  try{
   const proposal=studio.snapshot().stagePlans.find(p=>p.sceneId===selected&&p.status==='review-required');
   if(!proposal)throw new Error('No pending set revision');
   studio.dispatch({type:'review-stage',stagePlanId:proposal.id,decision,
    notes:$('review-notes').value},human);
   updateScenes();showStage();status('Set revision '+decision+'. 3D and 2D views updated only if approved.');
  }catch(error){status('Set review failed: '+text(error.message));}
 });
}
$('assign-avatar').addEventListener('click',()=>{
 try{
  const scene=getScene();
  if(!scene||scene.status!=='approved')throw new Error('Approve a scene before casting');
  studio.dispatch({type:'assign-cast',character:$('cast-character').value,
   avatarRef:$('cast-avatar').value,pilotPrincipalId:$('cast-pilot').value},human);
  updateScenes();showStage();
  status('Cast/rig reference approved. Stage marker is assigned; actual native avatar rig deployment remains a separate trusted tool.');
 }catch(error){status('Role binding rejected: '+text(error.message));}
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
 const existing=studio.snapshot().rehearsals.find(x=>x.id===rehearsalId)?.activeMomentId;
 if(existing)studio.dispatch({type:'close-audience-moment',rehearsalId},human);
 if(!event){activeMoment=null;report('Cue score complete. Finish the rehearsal to close it.');return;}
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
  try{studio.dispatch({type:'open-audience-moment',rehearsalId,momentId:event.momentId},human)}
  catch(error){report('Audience invitation could not open: '+text(error.message));return;}
  activeMoment=event.momentId;
  report('Audience invitation OPEN: '+event.prompt+' (optional, separately consented).');
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
 if(!$('speech-provider-consent').checked){$('audience-status').textContent='Confirm browser speech-provider consent, or type instead.';return;}
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
$('trailer-authoring-file').addEventListener('change',async()=>{
 const read=++trailerFileRead,previousText=$('trailer-authoring-json').value;
 try{
  const file=$('trailer-authoring-file').files?.[0];if(!file)return;
  if(file.size>MAX_TRAILER_AUTHORING_BYTES)throw new Error('Use a private authoring JSON file no larger than 2 MiB.');
  const content=await file.text();if(new TextEncoder().encode(content).byteLength>MAX_TRAILER_AUTHORING_BYTES)throw new Error('The authoring file exceeds its byte limit.');
  if(read!==trailerFileRead)return;
  if($('trailer-authoring-json').value!==previousText){$('trailer-import-status').textContent='The form text changed while the file was loading. Your edits were preserved; select the file again to replace them.';return;}
  $('trailer-authoring-json').value=content;$('trailer-import-consent').checked=false;
  $('trailer-import-status').textContent='Private file loaded into the form only: '+text(file.name,180)+'. Review and explicitly import it; no model or network request was started.';
 }catch(error){if(read===trailerFileRead)status('Private file not loaded: '+text(error.message,500));}
});
function showTrailerPackage(refreshReview=true){
 if(!trailerImportReceipt)throw new Error('Import a prepared authoring file first.');
 const plan=JSON.parse($('trailer-shot-plan').value);
 if(deviceReview&&JSON.stringify(deviceReview.snapshot().plan)!==JSON.stringify(plan))deviceReview.applyPatch({type:'replace-plan',expectedRevision:deviceReview.snapshot().revision,trailer:plan});
 const result=exportArtCraftTrailerPackage(studio.snapshot(),plan);
 result.localImportReceipt=structuredClone(trailerImportReceipt);
 $('trailer-package-preview').textContent=JSON.stringify(result,null,2);
 $('trailer-script-preview').textContent=result.shots.map(shot=>[
  `SHOT ${shot.id} · frames ${shot.inFrame}–${shot.outFrame} · ${shot.seconds}s · ${shot.sceneId}`,
  ...shot.dialogue.map(cue=>`  [${cue.inFrame}–${cue.outFrame}] ${cue.character}: ${cue.text}${cue.direction?' ('+cue.direction+')':''}`),
  ...shot.screenCues.map(cue=>`  [${cue.inFrame}–${cue.outFrame}] TITLE: ${cue.text}`)
 ].join('\n')).join('\n\n');
 $('trailer-import-status').textContent=`Validated ${result.seconds}s / ${result.totalFrames} frames at ${result.frameRate} fps · ${result.shots.length} shots · ${result.missingMedia.length} missing media jobs. Producer authorization pending; native import and render unverified. In memory only.`;
 if(deviceReview){const review=deviceReview.snapshot();$('trailer-revision-status').textContent=`Local proposed revision ${review.revision} · ${review.history.length} retained revisions. Save review export for an immutable Creator receipt; download revised private authoring to resume all edits.`;}
 if(refreshReview)productionReview?.refresh(result);
 return result;
}
$('import-trailer').addEventListener('click',()=>{
 try{
  if(modelBusy)throw new Error('Wait for the current model proposal to finish before replacing the local session.');
  if(!$('trailer-import-consent').checked)throw new Error('Confirm private, rights-cleared local import and replacement of the unsaved lab session.');
  const imported=importTrailerAuthoring($('trailer-authoring-json').value);
  // Validation finished before replacing the live lab state. No approval command,
  // inference request, persistence write or producer-authentication claim occurs.
  viewer?.close();viewer=null;recognizer?.stop?.();recognizer=null;globalThis.speechSynthesis?.cancel?.();
  studio=makeLabStudio(imported.state);selected=imported.state.proposals[0]?.id||null;rehearsalId=null;eventIndex=0;activeMoment=null;lastAudience=null;
  trailerImportReceipt=imported.receipt;
  deviceReview=createTrailerDeviceReview({state:imported.state,trailer:imported.trailer,receipt:imported.receipt});
  $('trailer-shot-plan').value=JSON.stringify(imported.trailer,null,2);$('trailer-import-receipt').textContent=JSON.stringify(imported.receipt,null,2);
  for(const id of ['preview-trailer','export-trailer','export-trailer-captions','export-trailer-authoring'])$(id).disabled=false;
  $('trailer-import-consent').checked=false;updateScenes();showStage();
  showTrailerPackage();status('Authored trailer imported with zero inference. All scripts remain review-required; the local lab actor is not an authenticated producer. Download the private review package before closing.');
 }catch(error){status('Trailer import not applied: '+text(error.message,700));}
});
$('preview-trailer').addEventListener('click',()=>{try{showTrailerPackage();status('Exact 30-second shot plan validated. Producer authorization and media execution remain pending.')}catch(error){status('Trailer plan needs repair: '+text(error.message,700));}});
$('save-trailer-artifact').addEventListener('click',async()=>{
 const button=$('save-trailer-artifact');button.disabled=true;
 try{if(!globalThis.CivweaveCreatorStoreV1)await import('/creator-suite/shared/session-store-v1.js');const packageData=showTrailerPackage();const receipt=await saveTrailerReviewArtifact({store:globalThis.CivweaveCreatorStoreV1,runRef:$('trailer-creation-run').value.trim(),packageData,...(deviceReview?{reviewData:deviceReview.snapshot()}:{})});$('trailer-artifact-receipt').textContent=JSON.stringify(receipt,null,2);status('Exact trailer review export and retained proposed revisions saved in the canonical Creator artifact store. Producer authorization and native ArtCraft import remain pending.');}
 catch(error){status('Review export not saved: '+text(error.message,700));}finally{button.disabled=false;}
});
$('export-trailer').addEventListener('click',()=>{
 try{const result=showTrailerPackage();download('artcraft-trailer-review-package.json',JSON.stringify(result,null,2));status('Portable ArtCraft review package downloaded. This is not a native-import receipt or a rendered trailer.');}
 catch(error){status('Trailer package export blocked: '+text(error.message,700));}
});
$('export-trailer-captions').addEventListener('click',()=>{
 try{const result=showTrailerPackage();download(result.captions.filename,result.captions.content,'text/vtt');status('Timed trailer captions downloaded. No video, voice track or world action was executed.');}
 catch(error){status('Trailer captions export blocked: '+text(error.message,700));}
});
function currentAuthoring(){
 if(!deviceReview)throw new Error('Import a resumable authoring file first.');
 const input=JSON.parse($('trailer-authoring-json').value),plan=JSON.parse($('trailer-shot-plan').value),state=studio.snapshot();
 const {sourceProvenance,...portablePlan}=plan;if(sourceProvenance)input.sourceProvenance=structuredClone(sourceProvenance);
 input.trailer={...structuredClone(portablePlan),shots:portablePlan.shots.map(row=>{const scene=state.proposals.find(scene=>scene.id===row.sceneId);if(!scene)throw new Error('The current shot refers to an unavailable scene.');const {sceneId,...shot}=row;return {...structuredClone(shot),sceneKey:scene.slug}})};
 return input;
}
function acceptPlan(next){
 if(!deviceReview)throw new Error('Import a review plan first.');
 const review=deviceReview.applyPatch({type:'replace-plan',expectedRevision:deviceReview.snapshot().revision,trailer:next});$('trailer-shot-plan').value=JSON.stringify(review.plan,null,2);
}
function reviseScene(patch){
 const input=currentAuthoring(),scene=studio.snapshot().proposals.find(row=>row.id===patch.sceneId),definition=input.scenes.find(row=>row.key===scene?.slug);if(!definition)throw new Error('The scene no longer matches the imported authoring document.');
 for(const key of ['title','synopsis','visualDirection'])if(Object.hasOwn(patch,key)){if(key==='visualDirection'&&!patch[key].trim())delete definition[key];else definition[key]=patch[key];}
 if(patch.line){definition.dialogue[patch.lineIndex]=structuredClone(patch.line);for(const shot of input.trailer.shots.filter(row=>row.sceneKey===definition.key))for(const cue of shot.dialogue||[])if(cue.lineIndex===patch.lineIndex)cue.outFrame=cue.inFrame+patch.line.seconds*(input.trailer.frameRate||30);}
 if(patch.set){definition.set=structuredClone(patch.set);for(const key of ['light','ambience'])if(definition.set[key]==='')delete definition.set[key];}
 const review=deviceReview.applyPatch({type:'reimport-authoring',expectedRevision:deviceReview.snapshot().revision,authoring:input});
 studio=makeLabStudio(deviceReview.productionSnapshot());trailerImportReceipt=deviceReview.importReceipt();selected=studio.snapshot().proposals.find(row=>row.slug===definition.key)?.id||null;
 $('trailer-authoring-json').value=JSON.stringify(input,null,2);$('trailer-shot-plan').value=JSON.stringify(review.plan,null,2);$('trailer-import-receipt').textContent=JSON.stringify(trailerImportReceipt,null,2);updateScenes();
}
$('export-trailer-authoring').addEventListener('click',()=>{try{const input=currentAuthoring();importTrailerAuthoring(input);download('private-trailer-authoring-revised.json',JSON.stringify(input,null,2));status('Resumable private authoring downloaded with current script, set, rig and blocking edits. It contains private source excerpts; no publication or rendering occurred.');}catch(error){status('Revised authoring download blocked: '+text(error.message,700));}});
productionReview=mountProductionReview({root:$('production-device-review'),document,getState:()=>studio.snapshot(),getPlan:()=>JSON.parse($('trailer-shot-plan').value||'{"shots":[]}'),getPackage:()=>{const result=exportArtCraftTrailerPackage(studio.snapshot(),JSON.parse($('trailer-shot-plan').value));result.localImportReceipt=structuredClone(trailerImportReceipt);return result},getImportReceipt:()=>trailerImportReceipt,getReviewState:()=>deviceReview?.snapshot(),getFiles:()=>deviceReview?.files()||[],downloadFile:id=>{const file=deviceReview?.files().find(row=>row.id===id);if(!file)throw new Error('Review file was not found.');download(file.filename,file.content,file.mimeType)},applyPlan:acceptPlan,applyScenePatch:reviseScene,getRigRequirements:()=>JSON.parse($('trailer-shot-plan').value||'{}').rigRequirements||[],setRigRequirements:rows=>{if(!deviceReview)throw new Error('Import a review first.');const review=deviceReview.applyPatch({type:'set-rig-requirements',expectedRevision:deviceReview.snapshot().revision,rigRequirements:rows});$('trailer-shot-plan').value=JSON.stringify(review.plan,null,2)},onChange:()=>showTrailerPackage(false),onError:error=>status('Production edit not applied: '+text(error.message,700)),onPreviewHost:host=>{const target=host||$('stage-preview-home');if(!target)return;for(const id of ['stage-viewer','stage-map','stage-note']){const node=$(id);if(node&&node.parentElement!==target)target.append(node)}}});
productionReview.refresh();
addEventListener('pagehide',()=>{viewer?.close();recognizer?.stop?.();globalThis.speechSynthesis?.cancel?.();},{once:true});
updateScenes();showStage();
