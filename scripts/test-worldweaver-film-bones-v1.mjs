import test from 'node:test';
import assert from 'node:assert/strict';
import {FILM_BONES_SCHEMA,SHOT_BATCH_SCHEMA,makeGeminiShotTask,validateShotBatch,assembleFilmBones,makeCodexFilmTask,exportCivweaveFilmTraining} from '../public/app/shared/worldweaver-film-bones-v1.mjs';
const state={schema:'civweave.performance-studio.v1',revision:4,
 project:{id:'project-1',title:'Door proof',rights:'owned'},
 proposals:[{id:'scene-1',title:'Door',status:'approved',reviewedBy:'human:producer',
 synopsis:'A doorway opens',sourceIds:['src-1'],set:{location:'Garden',props:[]},
 dialogue:[{character:'hero',text:'Hello',direction:'approaches',seconds:5}],visualDirection:'Original uncanny garden.'}]};
const shot={id:'shot-1',durationFrames:120,storyBeat:'Door opens',action:'Hero crosses the threshold',
 camera:{size:'wide',move:'dolly',lensMm:35,start:{x:0,y:-9,z:2},end:{x:0,y:-5,z:2},focus:'hero'},
 blocking:[{character:'hero',from:{x:0,y:0,z:0},to:{x:1,y:0,z:0},gesture:'steps forward',purpose:'Answer the invitation'}],
 continuity:{incoming:'Door shut',outgoing:'Door ajar',props:['door'],light:'warm side light'},
 soundReference:{ambience:'garden wind',foley:'footstep',music:'temporary swell',dialogue:'original voice placeholder'},
 sourceIds:['src-1'],authorInsightIds:[]};
const batch={schema:SHOT_BATCH_SCHEMA,sceneId:'scene-1',productionRevision:4,
 draftProvider:'gemini',draftModel:'gemini-2.5-flash',receiptId:'receipt-1',shots:[shot]};
test('Gemini task requires consent and a human-reviewed screenplay, not source disclosure by default',()=>{
 assert.throws(()=>makeGeminiShotTask(state,'scene-1',{selectedModel:'gemini-2.5-flash'}),/consent/);
 const t=makeGeminiShotTask(state,'scene-1',{selectedModel:'gemini-2.5-flash',remoteSourceConsent:true,
 insights:[{id:'private',note:'Secret not sent',approvedForModel:false},{id:'approved-1',note:'Avoid forced tropes',approvedForModel:true}]});
 assert.equal(t.provider,'gemini');assert.match(t.messages[1].content,/Avoid forced tropes/);
 assert.doesNotMatch(t.messages[1].content,/Secret not sent/);
 assert.throws(()=>makeGeminiShotTask(state,'scene-1',{selectedModel:'qwen:4b',remoteSourceConsent:true}),/Gemini/);
});
test('Strict shot schema rejects invalid duration, actor, sources, and fake render status',()=>{
 assert.equal(validateShotBatch(state,batch).shots.length,1);
 assert.throws(()=>validateShotBatch(state,{...batch,shots:[{...shot,durationFrames:361}]}),/2–15/);
 assert.throws(()=>validateShotBatch(state,{...batch,shots:[{...shot,sourceIds:['invented']}]}),/absent/);
 assert.throws(()=>validateShotBatch(state,{...batch,shots:[{...shot,blocking:[{...shot.blocking[0],character:'unknown'}]}]}),/absent/);
 assert.throws(()=>validateShotBatch(state,{...batch,shots:[{...shot,renderStatus:'ready'}]}),/Unexpected/);
 assert.throws(()=>validateShotBatch({...state,proposals:[{...state.proposals[0],status:'review-required'}]},batch),/approval/);
});
test('Feature-length assembly preserves explicit frame timing and reports coverage instead of padding',()=>{
 const result=assembleFilmBones(state,[batch],{targetMinutes:90});
 assert.equal(result.schema,FILM_BONES_SCHEMA);assert.equal(result.shotCount,1);
 assert.equal(result.shots[0].startFrame,0);assert.equal(result.shots[0].endFrame,120);
 assert.equal(result.status,'incomplete-movie-bones');
 assert.equal(result.soundPolicy.useReferenceAudioInFinalMix,false);
 assert.equal(result.shots[0].renderStatus,'not-rendered');
 assert.throws(()=>assembleFilmBones(state,[batch,batch]),/Duplicate global shot/);
});
test('Codex is an implementation operator, not a fake authenticated producer',()=>{
 const ticket=makeCodexFilmTask({branch:'feature/film',baseCommit:'a'.repeat(40),goal:'Review a film shot plan',
  acceptance:['Run contract tests']});
 assert.equal(ticket.humanApproval,false);assert.equal(ticket.status,'unassigned');
 assert.match(ticket.role,/not-human-authority/);
 assert.throws(()=>makeCodexFilmTask({branch:'feature/film',baseCommit:'bad',goal:'Test',acceptance:['Check']}),/SHA/);
});
test('Training requires actual Gemini, applied code patch and human review receipts',()=>{
 assert.throws(()=>exportCivweaveFilmTraining([],{}),/opt-in/);
 const record={projectId:'project-1',sceneId:'scene-1',sourceDigest:'sha256:'+'a'.repeat(64),
 rights:'owned',trainingConsent:true,model:{provider:'gemini',name:'gemini-2.5-flash'},
 modelReceipt:{id:'real-inference-1',status:'success'},operatorPatch:{commitSha:'b'.repeat(40),status:'applied'},
 humanReview:{decision:'approved',reviewerRef:'producer-approval-1'},input:'Original safe direction brief',approvedOutput:'Final reviewed shot plan'};
 assert.throws(()=>exportCivweaveFilmTraining([record],{ownerTrainingAuthorization:true}),/Trusted receipt/);
 const exportResult=exportCivweaveFilmTraining([record],{ownerTrainingAuthorization:true,verifyReceipt:r=>r.modelReceipt.id==='real-inference-1'});
 assert.equal(exportResult.count,1);assert.equal(exportResult.containsRawManuscript,false);
 assert.ok(exportResult.training.length+exportResult.validation.length>0);
 assert.throws(()=>exportCivweaveFilmTraining([{...record,modelReceipt:{id:'fake',status:'failed'}}],{ownerTrainingAuthorization:true,verifyReceipt:()=>true}),/receipt/);
});

test('machine-readable curriculum is explicitly instructional, not fabricated execution data',async()=>{
 const {readFileSync}=await import('node:fs');
 const curriculum=JSON.parse(readFileSync(new URL('../examples/worldweaver-book-to-film-curriculum-v1.json',import.meta.url),'utf8'));
 assert.equal(curriculum.schema,'civweave.film-training-curriculum.v1');
 assert.equal(curriculum.provenance,'instructional-plan-not-observed-training');
 assert.equal(curriculum.executedFilmJobs,0);
 assert.equal(curriculum.trainingConsentGranted,false);
 assert.equal(curriculum.gates.length,7);
 assert.ok(curriculum.tasks.some(t=>t.id==='shot-blocking'));
 assert.ok(curriculum.tasks.some(t=>t.id==='human-sound-replacement'));
 assert.ok(curriculum.rubric.hardGates.includes('no-fabricated-render-receipts'));
});
