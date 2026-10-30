import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPerformanceStudio,performanceObservation,PERFORMANCE_SCHEMA} from '../public/app/shared/worldweaver-performance-studio-v1.mjs';
import {compileStageScene,compilePerformanceScore} from '../public/app/shared/worldweaver-stagecraft-v1.mjs';
import {productionPrompt,proposeScreenplayViaModel,proposeStageViaModel} from '../public/app/shared/worldweaver-adaptation-model-v1.mjs';
import {screenplayToVTT,exportFilmCraftInterchange,exportQwenLoRADataset} from '../public/app/shared/worldweaver-filmcraft-interchange-v1.mjs';
import {projectOpenSimPolygons3Dto2D} from '../public/app/shared/worldweaver-opensim-geometry-v1.mjs';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {projectWorld2D} from '../public/app/shared/worldweaver-map-2d-v1.mjs';

const human={kind:'human',principalId:'human:producer'};
const model={kind:'model',principalId:'model:qwen35-4b'};
const participant={kind:'audience',principalId:'visitor:session-one'};
const otherAudience={kind:'audience',principalId:'visitor:elsewhere'};
let n=0;
const make=()=>createPerformanceStudio({id:()=>`perf-${++n}`,clock:()=> '2026-10-30T12:00:00Z',
 authorize:({actor,command})=>{
  if(command.type==='create-project'||command.type==='add-source'||command.type==='review-scene'||
    command.type==='assign-cast'||command.type==='start-rehearsal'||command.type==='finish-rehearsal')
   return actor.kind==='human';
  if(command.type==='propose-scenes'||command.type==='propose-stage')return actor.kind==='human'||actor.kind==='model';
  if(command.type==='review-stage')return actor.kind==='human';
  if(command.type==='perform-cue')return actor.kind==='human';
  if(['open-audience-moment','close-audience-moment'].includes(command.type))return actor.kind==='human'||actor.kind==='runtime';
  if(command.type==='submit-audience')return actor.kind==='audience';
  if(command.type==='withdraw-audience')return actor.kind==='audience'||actor.kind==='human';
  return false;
 }});
const sceneTemplate=id=>({
 slug:'scene-'+id,title:'The unusual doorway',synopsis:'Two friends question a breathing doorway.',
 sourceIds:[id],dialogue:[
  {character:'hero',text:'Do you think the door is listening?',direction:'leans closer',seconds:6},
  {character:'friend',text:'Ask it gently.',direction:'hesitates',seconds:4}
 ],set:{location:'Impossible garden',mood:'Tender, uncanny, and whimsical',color:'#345678',
  props:[{id:'door',name:'Surreal doorway',shape:'box',x:8,y:3,width:3,depth:1,height:6,color:'#bb8877'}],
  light:'Woven glow',ambience:'Wind through giant leaves'},
 moments:[{id:'ask',afterLine:1,prompt:'What would you ask the door?',mode:'reflection',
  use:'Pause to reflect, not overwrite core story.',maxSeconds:15}],
 visualDirection:'An original landscape of luminous paper leaves and round arches.'
});
const setup=()=>{
 const studio=make();
 studio.dispatch({type:'create-project',title:'Private animated stage',sourceTitle:'Owned novel',
  rights:'owned',visualBrief:'Original gently uncanny landscapes and emotional silhouettes.'},human);
 const source=studio.dispatch({type:'add-source',chapter:'Chapter 1',
  text:'The door breathed slowly. The two friends held their lanterns steady.'},human).source;
 return {studio,source,scene:sceneTemplate(source.id)};
};
const propose=(setup,who=human)=>{
 const receipt=setup.studio.dispatch({type:'propose-scenes',scenes:[setup.scene]},who);
 return receipt.proposals[0];
};
const approve=(setup,id)=>{
 setup.studio.dispatch({type:'review-scene',sceneId:id,decision:'approved',
  notes:'Check source tone, cast intent and continuity.'},human);
};
test('project requires explicit rights and private manuscript import requires human actor',()=>{
 const studio=make();
 assert.throws(()=>studio.dispatch({type:'create-project',title:'Film',sourceTitle:'Book',
  rights:'unspecified',visualBrief:'Dreamlike landscape'},human),/rights/);
 assert.equal(studio.snapshot().project,null);
 const {studio:ready}=setup();
 assert.throws(()=>ready.dispatch({type:'add-source',chapter:'2',text:'Secret book text'},model),/not authorized/);
 assert.deepEqual(performanceObservation(ready.snapshot()).sources.map(s=>Object.keys(s).sort()),
  [['chapter','characters','id']]);
 assert.doesNotMatch(JSON.stringify(performanceObservation(ready.snapshot())),/door breathed/);
});
test('small-model proposals limited to 3 and never auto-approved',()=>{
 const s=setup();const sceneId=propose(s,model);
 const snapshot=s.studio.snapshot();
 assert.equal(snapshot.proposals[0].status,'review-required');
 assert.equal(snapshot.proposals[0].actorKind,'model');
 assert.throws(()=>compileStageScene(snapshot,sceneId),/approved/);
 assert.throws(()=>s.studio.dispatch({type:'review-scene',sceneId,decision:'approved',notes:'yes'},model),/not authorized/);
 assert.throws(()=>s.studio.dispatch({type:'propose-scenes',scenes:[1,2,3,4].map((i)=>({...s.scene,slug:'extra-'+i}))},model),/count/);
});
test('rejected scenes cannot be staged or placed in media and training exports',()=>{
 const s=setup();const id=propose(s);
 s.studio.dispatch({type:'review-scene',sceneId:id,decision:'rejected',notes:'Adaptation contradicted source'},human);
 assert.throws(()=>compileStageScene(s.studio.snapshot(),id),/approved/);
 assert.throws(()=>exportFilmCraftInterchange(s.studio.snapshot()),/No human-approved scenes/);
 assert.throws(()=>exportQwenLoRADataset(s.studio.snapshot(),{trainingAuthorized:true}),/No reviewed training/);
});
test('approved scenes create deterministic stage prims, geometry and 2D polygon positions',()=>{
 const s=setup(),id=propose(s);approve(s,id);
 s.studio.dispatch({type:'assign-cast',character:'hero',avatarRef:'starling:kami',
  pilotPrincipalId:'pilot:kami'},human);
 const stage=compileStageScene(s.studio.snapshot(),id,{instanceId:'theater:1'});
 assert.equal(stage.cast.find(c=>c.character==='hero').avatarRef,'starling:kami');
 assert.equal(stage.cast.find(c=>c.character==='friend').stageType,'unassigned');
 assert.ok(stage.region.objects.some(x=>x.id==='prop:'+id+':door'));
 assert.ok(stage.region.objects.some(x=>x.id==='actor:'+id+':hero'));
 assert.equal(stage.region.objects[0].instanceId,'theater:1');
 assert.ok(stage.geometry.faces.length>10);
 const polygons=projectOpenSimPolygons3Dto2D(stage.geometry);
 assert.ok(polygons.projectedFaces.length>0);
 let j=0;
 const w=createWorldweaver({id:()=>`theater-${++j}`,authorize:({actor})=>actor.kind==='human'});
 const room=w.dispatch({type:'create',guide:'moss',title:'Local studio'},human).instance;
 const view=projectWorld2D(w.snapshot(),{worldRef:room.id,layout:{sceneGeometry:
  compileStageScene(s.studio.snapshot(),id,{instanceId:room.id}).geometry}});
 assert.ok(view.polygons.length>0);
 assert.ok(view.buildingPolygons.some(x=>x.id==='actor:'+id+':hero'));
 assert.equal(view.geometryStatus,'opensim-world-geometry');
});
test('cue score has timed dialogue and audience invitation without running audio/network',()=>{
 const s=setup(),id=propose(s);approve(s,id);
 const score=compilePerformanceScore(s.studio.snapshot(),id);
 assert.equal(score.events.filter(x=>x.type==='dialogue').length,2);
 assert.equal(score.events.at(-1).type,'audience-invite');
 assert.equal(score.seconds,25);
 assert.equal(score.events[1].at,6);
 const vtt=screenplayToVTT(s.studio.snapshot(),id);
 assert.match(vtt,/WEBVTT/);
 assert.match(vtt,/00:00:06.000/);
 assert.match(vtt,/hero: Do you think/);
});
test('rehearsal events are revisioned, cues bounded, and human finalization required',()=>{
 const s=setup(),id=propose(s);approve(s,id);
 const rid=s.studio.dispatch({type:'start-rehearsal',sceneId:id},human).rehearsal;
 assert.throws(()=>s.studio.dispatch({type:'start-rehearsal',sceneId:id},human),/rehearsal is active/);
 assert.throws(()=>s.studio.dispatch({type:'perform-cue',rehearsalId:rid,lineIndex:3,outcome:'played'},human),/line index/);
 s.studio.dispatch({type:'perform-cue',rehearsalId:rid,lineIndex:0,outcome:'played'},human);
 assert.equal(s.studio.snapshot().rehearsals[0].events[0].outcome,'played');
 assert.throws(()=>s.studio.dispatch({type:'finish-rehearsal',rehearsalId:rid},model),/authorized/);
 s.studio.dispatch({type:'finish-rehearsal',rehearsalId:rid},human);
 assert.throws(()=>s.studio.dispatch({type:'perform-cue',rehearsalId:rid,lineIndex:1,outcome:'played'},human),/not running/);
});
test('audience transcript submission is opt-in and restricted to valid open moments',()=>{
 const s=setup(),id=propose(s);approve(s,id);
 const rid=s.studio.dispatch({type:'start-rehearsal',sceneId:id},human).rehearsal;
 assert.throws(()=>s.studio.dispatch({type:'submit-audience',rehearsalId:rid,momentId:'ask',kind:'text',text:'Too early',consent:{participation:true,training:false}},participant),/not currently open/);
 s.studio.dispatch({type:'open-audience-moment',rehearsalId:rid,momentId:'ask'},human);
 const command={type:'submit-audience',rehearsalId:rid,momentId:'ask',kind:'transcript',
  text:'The doorway felt inviting.',consent:{participation:true,training:false}};
 assert.throws(()=>s.studio.dispatch({...command,consent:{participation:false,training:false}},participant),/consent/);
 assert.throws(()=>s.studio.dispatch({...command,momentId:'not-in-script'},participant),/Unknown/);
 assert.throws(()=>s.studio.dispatch(command,human),/authorized/);
 const responseId=s.studio.dispatch(command,participant).responseId;
 assert.ok(responseId);
 assert.equal(s.studio.snapshot().audience[0].consent.training,false);
 assert.throws(()=>s.studio.dispatch({type:'withdraw-audience',responseId},otherAudience),/participant/);
 const before=s.studio.snapshot();
 assert.equal(before.audience[0].text,'The doorway felt inviting.');
 s.studio.dispatch({type:'withdraw-audience',responseId},participant);
 const after=s.studio.snapshot();
 assert.equal(after.audience[0].status,'withdrawn');
 assert.equal(after.audience[0].text,'');
 assert.equal(after.audience[0].principalId,'');
 assert.deepEqual(after.audience[0].consent,{participation:false,training:false});
});
test('FilmCraft interchange is honest: no fake rendered clips or media URLs',()=>{
 const s=setup(),id=propose(s);approve(s,id);
 const film=exportFilmCraftInterchange(s.studio.snapshot());
 assert.equal(film.sceneCount,1);
 assert.equal(film.edit[0].status,'awaiting-visual-media');
 assert.equal(film.edit[0].assetId,null);
 assert.equal(film.edit.filter(e=>e.track==='dialogue').length,2);
 assert.equal(film.edit.filter(e=>e.track==='audience-interaction-marker').length,1);
 assert.equal(film.subtitles.length,1);
 assert.match(film.subtitles[0].content,/WEBVTT/);
 assert.doesNotMatch(JSON.stringify(film),/The door breathed/);
});
test('LoRA exports require explicit owner consent; nonconsenting audience never included',()=>{
 const s=setup(),id=propose(s);approve(s,id);
 const rid=s.studio.dispatch({type:'start-rehearsal',sceneId:id},human).rehearsal;
 s.studio.dispatch({type:'open-audience-moment',rehearsalId:rid,momentId:'ask'},human);
 s.studio.dispatch({type:'submit-audience',rehearsalId:rid,momentId:'ask',kind:'text',
  text:'I worry about the door.',consent:{participation:true,training:false}},participant);
 assert.throws(()=>exportQwenLoRADataset(s.studio.snapshot()),/training authorization/);
 const out=exportQwenLoRADataset(s.studio.snapshot(),{trainingAuthorized:true,includeAudience:true});
 assert.equal(out.count,1);
 assert.equal(out.consentedAudienceIncluded,0);
 assert.doesNotMatch(out.training+out.validation,/I worry/);
 assert.doesNotMatch(out.training+out.validation,/visitor:session-one/);
 s.studio.dispatch({type:'submit-audience',rehearsalId:rid,momentId:'ask',kind:'text',
  text:'What if we asked the door for help?',consent:{participation:true,training:true}},participant);
 const allowed=exportQwenLoRADataset(s.studio.snapshot(),{trainingAuthorized:true,includeAudience:true});
 assert.equal(allowed.count,2);
 assert.equal(allowed.consentedAudienceIncluded,1);
 assert.match(allowed.training+allowed.validation,/What if we asked/);
 assert.doesNotMatch(allowed.training+allowed.validation,/visitor:session-one/);
});
test('selected model proposals only get selected excerpts and cannot race an edited project',async()=>{
 const s=setup();
 let seen;
 const result=await proposeScreenplayViaModel({studio:s.studio,actor:model,
  sourceIds:[s.source.id],invokeModel:async request=>{
   seen=request;
   return {outputJson:{scenes:[s.scene]}};
  }});
 assert.equal(result.proposals.length,1);
 assert.equal(seen.messages[0].role,'system');
 assert.match(seen.messages[1].content,/The door breathed/);
 assert.equal(s.studio.snapshot().proposals[0].status,'review-required');
 const before=s.studio.snapshot().revision;
 await assert.rejects(proposeScreenplayViaModel({studio:s.studio,actor:model,
  sourceIds:[s.source.id],invokeModel:async()=>{
   s.studio.dispatch({type:'add-source',chapter:'chapter extra',text:'A private second passage'},human);
   return {outputJson:{scenes:[{...s.scene,slug:'new-scene'}]}};
  }}),/Project changed/);
 assert.equal(s.studio.snapshot().revision,before+1);
 assert.equal(s.studio.snapshot().proposals.length,1);
 assert.throws(()=>productionPrompt(s.studio.snapshot(),['missing']),/Choose/);
});
test('production lab explicitly labels stage as provisional and voices/audience input as opt-in',()=>{
 const html=readFileSync(new URL('../public/app/tools/worldweaver-performance-lab.html',import.meta.url),'utf8');
 const source=readFileSync(new URL('../public/app/tools/worldweaver-performance-lab-v1.mjs',import.meta.url),'utf8');
 for(const name of ['source-text','scene-select','stage-viewer','stage-map','audience-consent','training-consent','training-authorized','generate-scene','transcribe'])
  assert.ok(html.includes('id="'+name+'"'));
 assert.match(html,/local workflow prototype/);
 assert.match(html,/Speech transcription may use an online service|voice transcription may use an online service/i);
 assert.match(source,/proposeScreenplayViaModel/);
 assert.match(source,/createOpenSim3DPreview/);
 assert.match(source,/SpeechRecognition/);
 assert.match(source,/runCodeInference/);
 assert.doesNotMatch(source,/getUserMedia\(/);
});

test('model-proposed set rebuilds are inert until human approval; rejected changes preserve existing geometry',async()=>{
 const s=setup(),id=propose(s);approve(s,id);
 const original=compileStageScene(s.studio.snapshot(),id);
 const newSet=structuredClone(s.scene.set);
 newSet.props[0].x=30;newSet.location='Floating laboratory';
 const proposal=await proposeStageViaModel({studio:s.studio,actor:model,sceneId:id,
  invokeModel:async()=>({outputJson:{set:newSet,note:'Give the actors more distance from the doorway'}})});
 assert.equal(s.studio.snapshot().stagePlans[0].status,'review-required');
 assert.equal(s.studio.snapshot().stagePlans[0].id,proposal.stagePlan);
 assert.deepEqual(compileStageScene(s.studio.snapshot(),id).geometry,original.geometry);
 assert.throws(()=>s.studio.dispatch({type:'review-stage',stagePlanId:proposal.stagePlan,
  decision:'approved',notes:'yes'},model),/authorized/);
 s.studio.dispatch({type:'review-stage',stagePlanId:proposal.stagePlan,decision:'approved',
  notes:'Block actors farther from prop'},human);
 const updated=compileStageScene(s.studio.snapshot(),id);
 assert.equal(updated.approvedStagePlanId,proposal.stagePlan);
 assert.notDeepEqual(updated.geometry.objects.find(x=>x.kind==='prop').position,
  original.geometry.objects.find(x=>x.kind==='prop').position);
 const other={...newSet,location:'A changed location'};
 const second=s.studio.dispatch({type:'propose-stage',sceneId:id,set:other,note:'Another option'},model).stagePlan;
 s.studio.dispatch({type:'review-stage',stagePlanId:second,decision:'rejected',notes:'Keep current'},human);
 assert.equal(compileStageScene(s.studio.snapshot(),id).approvedStagePlanId,proposal.stagePlan);
});
test('stale set inference never overwrites approved stage and pending stage blocks duplicate proposals',async()=>{
 const s=setup(),id=propose(s);approve(s,id);
 const first=s.studio.dispatch({type:'propose-stage',sceneId:id,set:s.scene.set,note:'Original proposal'},model).stagePlan;
 assert.throws(()=>s.studio.dispatch({type:'propose-stage',sceneId:id,set:s.scene.set,note:'repeat'},model),/pending stage/);
 const before=s.studio.snapshot().revision;
 await assert.rejects(proposeStageViaModel({studio:s.studio,actor:model,sceneId:id,invokeModel:async()=>{
  s.studio.dispatch({type:'review-stage',stagePlanId:first,decision:'rejected',notes:'No'},human);
  return {outputJson:{set:s.scene.set,note:'too late'}};
 }}),/Project changed/);
 assert.equal(s.studio.snapshot().revision,before+1);
 assert.equal(s.studio.snapshot().stagePlans.length,1);
});

test('closed audience invitation rejects late submission even during a running rehearsal',()=>{
 const s=setup(),id=propose(s);approve(s,id);
 const rid=s.studio.dispatch({type:'start-rehearsal',sceneId:id},human).rehearsal;
 s.studio.dispatch({type:'open-audience-moment',rehearsalId:rid,momentId:'ask'},human);
 assert.throws(()=>s.studio.dispatch({type:'open-audience-moment',rehearsalId:rid,momentId:'ask'},human),/already active/);
 s.studio.dispatch({type:'close-audience-moment',rehearsalId:rid},human);
 assert.throws(()=>s.studio.dispatch({type:'submit-audience',rehearsalId:rid,momentId:'ask',kind:'text',
  text:'This response is after the invitation',consent:{participation:true,training:false}},participant),/not currently open/);
 assert.equal(s.studio.snapshot().audience.length,0);
});
