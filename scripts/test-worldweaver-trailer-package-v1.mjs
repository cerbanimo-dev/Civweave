import test from 'node:test';
import assert from 'node:assert/strict';
import {createPerformanceStudio} from '../public/app/shared/worldweaver-performance-studio-v1.mjs';
import {exportArtCraftTrailerPackage,exportFilmCraftInterchange} from '../public/app/shared/worldweaver-filmcraft-interchange-v1.mjs';
const human={kind:'human',principalId:'human:synthetic-producer'},model={kind:'model',principalId:'model:synthetic'};
function fixture(){
  let sequence=0;const studio=createPerformanceStudio({id:()=>`trailer-${++sequence}`,clock:()=> '2026-10-30T12:00:00Z',authorize:({actor,command})=>command.type==='propose-scenes'||actor.kind==='human'});
  studio.dispatch({type:'create-project',title:'Synthetic film test',sourceTitle:'Original synthetic test story',rights:'owned',visualBrief:'Original geometric theatrical environments.'},human);
  const source=studio.dispatch({type:'add-source',chapter:'Test section',text:'PRIVATE SYNTHETIC SOURCE NOT FOR EXPORT',sourceRef:'manuscript:synthetic'},human).source;
  const scene={slug:'scene-synthetic',title:'The light at the gate',synopsis:'A fictional traveler discovers a geometric gate.',sourceIds:[source.id],dialogue:[{character:'traveler',text:'The gate has begun to glow.',direction:'Steps toward the gate.',seconds:6}],set:{location:'A geometric courtyard',mood:'Curious and uncertain',color:'#32495c',props:[{id:'gate',name:'Courtyard gate',shape:'box',x:8,y:0,height:8,width:4,depth:1,color:'#75658a'}],light:'A soft light through the gate.',ambience:'A quiet wind.'},moments:[],runtimeSeconds:15,visualDirection:'Original abstract architecture and tactile materials.'};
  const id=studio.dispatch({type:'propose-scenes',scenes:[scene]},model).proposals[0];
  const shots=[{id:'shot:opening',sceneId:id,inFrame:0,outFrame:450,dialogue:[{lineIndex:0,inFrame:30,outFrame:210}],propIds:['gate'],blocking:[{character:'traveler',inFrame:0,outFrame:120,from:{x:115,y:122,z:0},to:{x:120,y:125,z:0},action:'walk',description:'A slow approach.'}],camera:{framing:'wide',movement:'push-in',description:'Move toward the gate.'},lighting:'Gate light begins dim and strengthens.',sound:[{id:'wind',kind:'ambience',inFrame:0,outFrame:450,description:'A quiet courtyard wind.'}]},{id:'shot:closing',sceneId:id,inFrame:450,outFrame:900,propIds:['gate'],screenCues:[{inFrame:780,outFrame:900,text:'A fictional journey begins.'}]}];
  return {studio,id,shots,approve(){studio.dispatch({type:'review-scene',sceneId:id,decision:'approved',notes:'Reviewed synthetic script.'},human)}};
}
const build=(f,options={})=>exportArtCraftTrailerPackage(f.studio.snapshot(),{shots:f.shots,...options});

test('proposal scenes export a strictly 30-second editable ArtCraft review handoff without fabricating approval',()=>{
  const f=fixture(),before=f.studio.snapshot(),packageData=build(f,{sourceProvenance:{manuscriptRef:'book:synthetic',edition:'Development test',sourceHash:'sha256:'+'a'.repeat(64)}});
  assert.equal(packageData.schema,'civweave.artcraft-trailer-package.v1');assert.equal(packageData.seconds,30);assert.equal(packageData.frameRate,30);assert.equal(packageData.totalFrames,900);
  assert.equal(packageData.nativeArtCraftImportVerified,false);assert.equal(packageData.rendered,false);assert.equal(packageData.worldExecution,false);assert.equal(packageData.producerAuthorization.status,'pending');assert.equal(packageData.reviewStatus,'review-required');
  assert.equal(packageData.shots[0].inFrame,0);assert.equal(packageData.shots.at(-1).outFrame,900);assert.equal(packageData.scenes[0].sceneId,f.id);assert.equal(packageData.scenes[0].productionRevision,before.revision);
  assert.equal(packageData.stages[0].status,'awaiting-producer-review');assert.equal(packageData.stages[0].region,null);assert.equal(packageData.filmCraftInterchange,null);
  assert.match(packageData.captions.content,/The gate has begun/);assert.equal(packageData.rigBindings[0].avatarRef,null);assert.equal(packageData.rigBindings[0].status,'awaiting-rig-binding');assert.ok(packageData.jobs.some(job=>job.kind==='camera'));assert.ok(packageData.jobs.some(job=>job.kind==='lighting'));assert.ok(packageData.jobs.every(job=>['missing-media','proposed'].includes(job.status)&&job.assetId===null));
  assert.equal(packageData.jobs.find(job=>job.kind==='sound').soundKind,'ambience');assert.equal(new Set(packageData.jobs.map(job=>job.id)).size,packageData.jobs.length);
  assert.doesNotMatch(JSON.stringify(packageData),/PRIVATE SYNTHETIC SOURCE/);assert.deepEqual(f.studio.snapshot(),before);assert.throws(()=>exportFilmCraftInterchange(before),/human-approved/);
});

test('approved scenes reuse canonical stage, score, cast bindings and the existing approved film interchange',()=>{
  const f=fixture();f.approve();f.studio.dispatch({type:'assign-cast',character:'traveler',avatarRef:'rig:traveler',pilotPrincipalId:'pilot:traveler',voiceRef:'voice:traveler'},human);
  const out=build(f);assert.equal(out.stages[0].status,'provisional-mockup');assert.ok(out.stages[0].region.objects.some(row=>row.kind==='actor-marker'));assert.equal(out.stages[0].score.events[0].character,'traveler');assert.equal(out.rigBindings[0].avatarRef,'rig:traveler');assert.equal(out.filmCraftInterchange.sceneCount,1);assert.equal(out.producerAuthorization.status,'pending');assert.equal(out.rendered,false);
});

test('approved stage revisions supply the exact prop set used by a shot without erasing the screenplay declaration',()=>{
  const f=fixture();f.approve();const original=f.studio.snapshot().proposals[0].set,updated=structuredClone(original);updated.props[0].id='revised-gate';
  const stageId=f.studio.dispatch({type:'propose-stage',sceneId:f.id,set:updated,note:'A synthetic revised gate asset.'},human).stagePlan;
  f.studio.dispatch({type:'review-stage',stagePlanId:stageId,decision:'approved',notes:'Reviewed this synthetic set.'},human);
  for(const shot of f.shots)shot.propIds=['revised-gate'];
  const out=build(f);assert.equal(out.scenes[0].set.props[0].id,'revised-gate');assert.equal(out.scenes[0].screenplaySet.props[0].id,'gate');assert.equal(out.scenes[0].approvedStagePlanId,stageId);
});

test('shots partition the exact thirty-second frame interval without gaps, overlaps or duration drift',()=>{
  for(const change of [shots=>shots[0].inFrame=1,shots=>shots[1].inFrame=449,shots=>shots[1].inFrame=451,shots=>shots[1].outFrame=899,shots=>shots[1].outFrame=901,shots=>shots[0].outFrame=0,shots=>shots[0].inFrame=.5]){
    const f=fixture();change(f.shots);assert.throws(()=>build(f),/frame|duration|contiguous|thirty|30/i);
  }
  const f=fixture();assert.throws(()=>build(f,{frameRate:29.97}),/frame rate/i);assert.throws(()=>build(f,{seconds:31}),/Unexpected|unsupported/i);
});

test('references must resolve to actual nonrejected scenes, characters, source chunks and props',()=>{
  for(const change of [f=>f.shots[0].sceneId='scene:unknown',f=>f.shots[0].propIds=['invented-prop'],f=>f.shots[0].blocking[0].character='invented-actor',f=>f.shots[0].dialogue[0].lineIndex=20]){
    const f=fixture();change(f);assert.throws(()=>build(f),/Unknown|unknown|reference|character|line/i);
  }
  const f=fixture(),bad=f.studio.snapshot();bad.proposals[0].sourceIds=['source:missing'];assert.throws(()=>exportArtCraftTrailerPackage(bad,{shots:f.shots}),/source/i);
  f.studio.dispatch({type:'review-scene',sceneId:f.id,decision:'rejected',notes:'Try again.'},human);assert.throws(()=>build(f),/rejected/i);
});

test('dialogue and movement remain inside their shot; character motion and subtitle timing cannot overlap themselves',()=>{
  for(const change of [f=>f.shots[0].dialogue[0].outFrame=451,f=>f.shots[0].dialogue[0].outFrame=209,f=>f.shots[0].blocking[0].outFrame=451,f=>f.shots[0].blocking.push({...f.shots[0].blocking[0],inFrame:60,outFrame:150}),f=>f.shots[0].dialogue.push({...f.shots[0].dialogue[0]})]){
    const f=fixture();change(f);assert.throws(()=>build(f),/shot|duration|overlap|timing/i);
  }
});

test('screen cues and planned jobs are declarative only and never accept scripts, remote media or forged execution flags',()=>{
  for(const change of [f=>f.shots[1].screenCues[0].script='run()',f=>f.shots[1].screenCues[0].text='<script>run()</script>',f=>f.shots[0].camera.code='run()',f=>f.shots[0].sound[0].url='https://example.invalid/fake.wav',f=>f.shots[0].rendered=true]){
    const f=fixture();change(f);assert.throws(()=>build(f),/Unexpected|unsupported|text|markup|script/i);
  }
  const f=fixture();assert.throws(()=>build(f,{producerApproved:true}),/Unexpected|unsupported/i);
});

test('a nondefault explicit frame rate preserves exact duration and provenance stays bounded metadata',()=>{
  const f=fixture();for(const shot of f.shots){shot.inFrame=shot.inFrame/30*24;shot.outFrame=shot.outFrame/30*24;for(const group of ['dialogue','blocking','sound','screenCues'])for(const cue of shot[group]||[]){cue.inFrame=cue.inFrame/30*24;cue.outFrame=cue.outFrame/30*24}}
  const out=build(f,{frameRate:24});assert.equal(out.totalFrames,720);assert.equal(out.seconds,30);assert.equal(out.provenance.productionRevision,f.studio.snapshot().revision);
  assert.throws(()=>build(f,{frameRate:24,sourceProvenance:{manuscriptText:'PRIVATE'}}),/Unexpected|unsupported/i);
});
