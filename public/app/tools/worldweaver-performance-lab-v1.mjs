import {validatePersonaPack,chooseModelDownloads} from '../shared/persona-library-v1.mjs';
import {createPersonaCampaign,applyCampaignEvent,exportCampaignSnapshot,importCampaignSnapshot,campaignPublicTimeline} from '../shared/persona-campaign-v1.mjs';
import {prepareDirectedScene,performPersonaTurn,advanceSceneTurn,needsDirectorRefresh,runSplitMindTurn} from '../shared/persona-scene-bridge-v1.mjs';
import {createPerformanceStudio,performanceObservation} from '../shared/worldweaver-performance-studio-v1.mjs';
import {compileStageScene,compilePerformanceScore} from '../shared/worldweaver-stagecraft-v1.mjs';
import {proposeScreenplayViaModel,proposeStageViaModel} from '../shared/worldweaver-adaptation-model-v1.mjs';
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
  if(['propose-scenes','propose-stage'].includes(command.type))return ['human','model'].includes(actor.kind);
  if(command.type==='review-stage')return actor.kind==='human';
  if(command.type==='perform-cue')return ['human','model','runtime'].includes(actor.kind);
  if(['open-audience-moment','close-audience-moment'].includes(command.type))return actor.kind==='human';
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
addEventListener('pagehide',()=>{viewer?.close();recognizer?.stop?.();globalThis.speechSynthesis?.cancel?.();},{once:true});
updateScenes();showStage();

/** One explicit rehearsal-cue surface in the existing Performance Studio.
 * It is not another chat listener or a standing generative-agent loop.
 * Imported unpublished cast data stays in memory, never localStorage or cloud
 * unless the user deliberately initiates inference with remote consent.
 */
let personaCast=null,personaScene=null,personaCampaign=null;
let personaRecent=[],personaGenerating=false;
let personaWillpower={points:2,max:2,renewEvery:4,lastRenewedTurn:0};
function showPersonaWillpower(){
 $('persona-willpower').textContent='Split-mind willpower: '+personaWillpower.points+'/'+personaWillpower.max+
  ' · restores one point every '+personaWillpower.renewEvery+' accepted rehearsal turns.';
}
const personaStatus=s=>$('persona-result').textContent=text(s,2500);
const personaRoster=()=>Array.from($('persona-cast').selectedOptions).map(o=>o.value);
const localCampaignAuthorizer=({actor})=>actor?.kind==='human'&&actor.principalId===human.principalId;
function rebuildPersonaRecent(){
 personaRecent=(personaCampaign?.events||[]).filter(e=>e.type==='rehearsal-preview')
  .flatMap(e=>['Player: '+e.playerCue,e.characterId+': '+e.speech]).slice(-6);
}
function showCampaign(){
 if(!personaCampaign){
  $('persona-campaign-status').textContent='No campaign started. Prepare a scenario to create a what-if branch.';
  $('persona-campaign-timeline').textContent='No turns recorded.';
  return;
 }
 const s=personaCampaign;
 $('persona-campaign-status').textContent='Private '+s.branchId+' · turn '+s.turn+
  ' · revision '+s.revision+' · '+s.cast.length+' cast roles. Save explicitly before leaving.';
 const visible=campaignPublicTimeline(s).slice(-10);
 $('persona-campaign-timeline').textContent=visible.length?
  visible.map(e=>e.type==='rehearsal-preview'?
   ('Turn '+e.id+' · '+e.characterId+' · '+e.speech+'\n  Player: '+e.playerCue+
    (e.proposedActions.length?'\n  Proposed actions (not executed): '+e.proposedActions.length:''))
    :e.id+' · '+e.type+' · '+(e.text||e.characterId||e.outcome||'')).join('\n'):
  'No turns recorded.';
}
function campaignEvent(command){
 if(!personaCampaign)throw new Error('Prepare a scenario to begin a campaign.');
 personaCampaign=applyCampaignEvent(personaCampaign,command,{actor:human,
  authorize:localCampaignAuthorizer,expectedRevision:personaCampaign.revision});
 showCampaign();
}
$('persona-new-campaign').addEventListener('click',()=>{
 if(personaGenerating)return;
 personaCampaign=null;personaScene=null;personaRecent=[];
 personaWillpower={points:2,max:2,renewEvery:4,lastRenewedTurn:0};
 showPersonaWillpower();showCampaign();
 personaStatus('Previous local preview cleared from this page. Saved JSON files are unchanged. Prepare a new what-if scenario.');
});
$('persona-save-campaign').addEventListener('click',()=>{
 try{
  if(!personaCampaign)throw new Error('Prepare a scenario before exporting a campaign.');
  download('persona-campaign-'+personaCampaign.id+'.json',exportCampaignSnapshot(personaCampaign));
  personaStatus('Private campaign exported. This save can contain player dialogue; keep it confidential.');
 }catch(error){personaStatus('Unable to export campaign: '+text(error.message,300));}
});
$('persona-session-file').addEventListener('change',async()=>{
 const file=$('persona-session-file').files?.[0];
 if(!file)return;
 try{
  if(!personaCast)throw new Error('Load the matching persona manifest first.');
  if(file.size>200000)throw new Error('Campaign save is too large.');
  const saved=importCampaignSnapshot(await file.text(),{pack:personaCast});
  personaCampaign=saved;personaScene=null;
  $('persona-scenario').value=saved.scenario;$('persona-stage').value=String(saved.stage);
  for(const option of $('persona-cast').options)option.selected=saved.cast.includes(option.value);
  $('persona-speaker').value=saved.cast[0];
  personaWillpower=saved.willpower;
  rebuildPersonaRecent();showPersonaWillpower();showCampaign();
  personaStatus('Private local session restored as UNTRUSTED rehearsal data. Prepare fresh 4B direction before the next cue; imported results are not authenticated multiplayer outcomes.');
 }catch(error){personaStatus('Campaign import rejected: '+text(error.message,350));}
 finally{$('persona-session-file').value='';}
});
$('persona-manifest-file').addEventListener('change',async()=>{
 personaCast=null;personaScene=null;personaCampaign=null;personaRecent=[];
 showCampaign();
 personaWillpower={points:2,max:2,renewEvery:4,lastRenewedTurn:0};showPersonaWillpower();
showCampaign();
 $('persona-cast').replaceChildren();$('persona-speaker').replaceChildren();
 const file=$('persona-manifest-file').files?.[0];
 if(!file)return;
 try{
  if(file.size>1200000)throw new Error('Manifest too large. Import only the JSON manifest, not the manuscript shards or zip archive.');
  const p=validatePersonaPack(JSON.parse(await file.text()));
  if(p.characters.length>1000)throw new Error('Cast limit exceeded.');
  personaCast=p;
  for(const c of p.characters){
   for(const id of ['persona-cast','persona-speaker']){
    const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.name;
    $(id).append(opt);
   }
  }
  for(const opt of $('persona-cast').options)opt.selected=['jess','magnus'].includes(opt.value);
  if(!personaRoster().length&&$('persona-cast').options.length)$('persona-cast').options[0].selected=true;
  $('persona-speaker').value=personaRoster()[0]||p.characters[0]?.id||'';
  const tiers=chooseModelDownloads(p,personaRoster()).tiers.join(', ');
  $('persona-import-status').textContent=p.characters.length+' persona/identity entries loaded locally. Model tiers: '+tiers+'.';
  personaStatus('Cast manifest imported. Next: prepare a scene with the configured 4B director.');
 }catch(error){
  $('persona-import-status').textContent='Import rejected: '+text(error.message,280);
  personaStatus('No persona data imported.');
 }
});
$('persona-cast').addEventListener('change',()=>{
 personaScene=null;personaRecent=[];
 const ids=personaRoster();
 if(personaCampaign&&JSON.stringify(ids)!==JSON.stringify(personaCampaign.cast)){
  personaCampaign=null;showCampaign();
  personaStatus('Cast changed. The previous local campaign has been detached; export a save before changing cast if you want to keep it.');
 }
 if(!ids.includes($('persona-speaker').value))$('persona-speaker').value=ids[0]||'';
 if(personaCast)$('persona-import-status').textContent=ids.length+' selected actors; required tiers: '+
   chooseModelDownloads(personaCast,ids).tiers.join(', ')+'. No models downloaded.';
});
async function runPersonaSelectedModel({messages,modelTier,purpose,maxOutputTokens}){
 const runtime=globalThis.CivweaveModelRuntime;
 const cfg=runtime?.readSharedConfig?.('agentic')||runtime?.readSharedConfig?.('interactive');
 if(!cfg?.provider||['manual','deterministic'].includes(cfg.provider))
  throw new Error('Select a real local model in Civweave AI settings before running.');
 if(!['ollama','openai-compatible','compatible','local-api'].includes(String(cfg.provider).toLowerCase()))
  throw new Error('Per-role switching in this lab currently requires an Ollama or OpenAI-compatible provider.');
 if(runtime?.endpointLeavesDevice?.(cfg)&&!$('cloud-consent').checked)
  throw new Error('Explicit remote-model manuscript consent required.');
 const target=$(modelTier==='4b'?'persona-director-model':modelTier==='2b'?'persona-inner-model':'persona-actor-model').value.trim();
 if(!/^[A-Za-z0-9_.:/-]{1,100}$/.test(target))throw new Error('Enter an installed provider model ID.');
 const {runCodeInference}=await import('/creator-suite/shared/code-inference-route-v1.mjs');
 const loaders=await import('/creator-suite/shared/creator-inference-loaders-v1.mjs');
 const response=await runCodeInference({...cfg,model:target},messages,{
  selection:loaders.currentCreatorLocalSelection(),loadLocal:loaders.loadCreatorLocalRuntime,
  loadServer:loaders.loadCreatorServerRuntime,sharedRuntime:runtime,
  purpose,taskTier:'complex',mediaType:'text',maxTokens:Math.min(2048,Math.max(512,maxOutputTokens||650)),
  requiresTools:false
 });
 if(response?.status!=='success'||response?.fallback?.provider==='deterministic')
  throw new Error('The selected model did not return completed, structured inference.');
 if(response?.actual?.model&&response.actual.model!==target)
  throw new Error('Selected-model runtime returned '+text(response.actual.model,100)+' instead of requested '+target+'.');
 return response;
}
async function personaRun(phase){
 if(personaGenerating||modelBusy)return;
 personaGenerating=true;modelBusy=true;
 $('persona-prepare').disabled=true;$('persona-act').disabled=true;
 try{
  if(!personaCast)throw new Error('Import a private persona-pack.json first.');
  const stage=Number($('persona-stage').value);
  const scenario=$('persona-scenario').value.trim();
  const participants=personaRoster();
  if(!Number.isInteger(stage)||stage<0||!scenario||participants.length<1||participants.length>12)
   throw new Error('Choose a numbered story stage, a scenario, and 1–12 participating characters.');
  if(phase==='prepare'){
   if(personaCampaign&&(personaCampaign.stage!==stage||personaCampaign.scenario!==scenario||
     JSON.stringify(personaCampaign.cast)!==JSON.stringify(participants)))
    throw new Error('The saved campaign is bound to its starting scenario and cast. Export it, then choose Start a new what-if campaign.');
   personaStatus('Directing '+participants.length+' character(s) separately with the selected 4B model…');
   const prior=personaScene||(personaCampaign?{revision:0,turn:personaCampaign.turn}:null);
   personaScene=await prepareDirectedScene({pack:personaCast,stage,scenario,participants,
    goals:['Respect canonical facts and personal knowledge; improvise without silently rewriting historical events.'],
    branchId:personaCampaign?.branchId||'what-if:pending',
    previousScene:prior,invokeModel:runPersonaSelectedModel});
   if(!personaCampaign){
    personaCampaign=createPersonaCampaign({pack:personaCast,
     id:'campaign:'+crypto.randomUUID(),ownerId:human.principalId,
     branchId:'what-if:'+crypto.randomUUID(),title:'Private rehearsal',
     scenario,stage,cast:participants});
   }
   personaWillpower=personaCampaign.willpower;
   rebuildPersonaRecent();showPersonaWillpower();showCampaign();
   personaStatus('Director brief revision '+personaScene.revision+' prepared for '+participants.join(', ')+
    '. The actor may now improvise one cue at a time; new events require approval.');
  }else{
   if(!personaScene)throw new Error('Prepare scene direction before improvising.');
   if(personaScene.stage!==stage||personaScene.scenario!==scenario||
    JSON.stringify(personaScene.participants)!==JSON.stringify(participants)||
    needsDirectorRefresh(personaScene))throw new Error('Scenario or cast changed, or instructions expired. Prepare fresh 4B direction.');
   const id=$('persona-speaker').value;
   const split=$('persona-split-mode').checked;
   if(!split&&!participants.includes(id))throw new Error('Select an active participant to perform.');
   personaStatus(split?'Invoking two 2B voices and an optional 0.8B moderator…':
     'Invoking 0.8B improv for '+id+'…');
   if(split&&(!participants.includes('landry')||!participants.includes('delia')))
    throw new Error('Split-mind rehearsal requires Landry and Delia in the selected cast.');
   const directChoice=$('persona-direct-control').value;
   const result=split?await runSplitMindTurn({pack:personaCast,scene:personaScene,
    playerInput:$('persona-player-cue').value,history:personaRecent,
    invokeModel:runPersonaSelectedModel,willpower:personaWillpower,
    ...(directChoice?{directControl:{characterId:directChoice,cost:1},
      authorizeDirectControl:()=>true}:{})}):
    await performPersonaTurn({pack:personaCast,scene:personaScene,characterId:id,
      playerInput:$('persona-player-cue').value,history:personaRecent,invokeModel:runPersonaSelectedModel});
   // The local ledger records preview dialogue only. No Worldweaver intent or
   // canonical event is marked executed by a model response.
   if(split&&result.directControlReceipt){
    campaignEvent({type:'willpower-spend',characterId:result.directControlReceipt.characterId,
     cost:result.directControlReceipt.cost});
   }
   campaignEvent({type:'rehearsal-preview',characterId:split?'landry-delia':id,
    playerCue:$('persona-player-cue').value,speech:result.speech,emote:result.emote,
    sceneRevision:personaScene.revision,proposedActions:result.proposedActions||[]});
   personaWillpower=personaCampaign.willpower;showPersonaWillpower();
   rebuildPersonaRecent();
   personaScene=advanceSceneTurn(personaScene,{expectedTurn:personaScene.turn});
   personaStatus(JSON.stringify({character:split?'landry-delia':id,speech:result.speech,emote:result.emote,
     route:split?result.route:'individual',remainingWillpower:split?personaWillpower.points:undefined,
     directControlReceipt:split?result.directControlReceipt:undefined,
     proposedActions:result.proposedActions,worldChanged:false,actionsExecuted:false,
     directorRevision:result.directorRevision,nextSceneTurn:personaScene.turn,
     refreshRequired:needsDirectorRefresh(personaScene)},null,2));
  }
 }catch(error){personaStatus('Persona rehearsal stopped: '+text(error.message,420));}
 finally{personaGenerating=false;modelBusy=false;$('persona-prepare').disabled=false;
  $('persona-act').disabled=false;$('cloud-consent').checked=false;}
}
$('persona-prepare').addEventListener('click',()=>personaRun('prepare'));
$('persona-act').addEventListener('click',()=>personaRun('act'));

showPersonaWillpower();
