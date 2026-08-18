import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../public/creator-suite/audit/quest-beat-v1.js',import.meta.url),'utf8');
let advanced=null,state={quests:[]},transitionCalls=[];
const clone=value=>structuredClone(value);
const engine={
  createQuestFromInput(input){return{id:'quest:audit-1',title:input.title,objective:input.objective,description:input.description,source:input.source,sourceActionId:input.sourceActionId,tasks:input.steps.map((title,index)=>({id:`task:${index+1}`,title,description:'',owner:'',status:'ready',proofRequired:true,review:{state:'none',note:'',at:''}}))}},
  addQuest(quest){if(state.quests.some(item=>item.sourceActionId===quest.sourceActionId))return{ok:false,error:'That quest was already imported.'};state.quests.push(clone(quest));return{ok:true,quest:clone(quest)}},
  readState(){return clone(state)},
  writeState(next){state=clone(next);return clone(state)},
  applyTaskTransition(questId,taskId,next,note=''){const quest=state.quests.find(item=>item.id===questId),task=quest?.tasks.find(item=>item.id===taskId);if(!task)return{ok:false,error:'Task not found.'};transitionCalls.push({questId,taskId,next,note});if(next==='completed'&&task.status!=='review')return{ok:false,error:'Task is not in review.'};task.status=next;task.review={state:next==='completed'?'accepted':'none',note,at:'2026-08-18T18:00:00.000Z'};return{ok:true,quest:clone(quest),task:clone(task)}},
};
const chronicle={advance(questId,event,context){advanced={questId,event,context:clone(context)};return{questId,currentBeatId:context.beatId}}};
const context=vm.createContext({console,structuredClone,setInterval,clearInterval,URL,location:{href:'https://civweave.test/creator-suite/'},document:{scripts:[],head:{append(){}}},CivweaveCerbanimoQuestV144:engine,CivweaveQuestArcChronicleV1:chronicle});context.globalThis=context;vm.runInContext(source,context,{filename:'quest-beat-v1.js'});const api=context.CivweaveCreatorAuditQuestBeatV1;assert.ok(api,'Creator audit Quest Beat API must load');

const batch={schema:'civweave.creator-audit-sample-batch.v1',batchId:'audit-batch:guild:test:2026-08-18',guildId:'guild:test',dayKey:'2026-08-18',samples:[
  {sampleId:'audit:1',priorityReason:'routine',reviewLane:'human',receipt:{sessionId:'creation:1',mediaType:'text',origin:'human-authored',receiptHash:'receipt-1',headHash:'head-1'}},
  {sampleId:'audit:2',priorityReason:'routine',reviewLane:'human',receipt:{sessionId:'creation:2',mediaType:'video',origin:'unknown',receiptHash:'receipt-2',headHash:'head-2'}},
]};
const built=api.buildQuest(batch);assert.equal(built.source,'creator-provenance-audit');assert.equal(built.sourceActionId,batch.batchId);assert.equal(built.sequential,false);assert.equal(built.steps.length,2);assert.ok(built.acceptanceCriteria.every(row=>/do not infer AI authorship from style/i.test(row)));
const materialized=await api.materialize(batch);assert.equal(materialized.questBeat,'reckoning');assert.equal(materialized.taskCount,2);assert.equal(advanced.event,'SET_BEAT');assert.equal(advanced.context.beatId,'reckoning');assert.equal(advanced.context.reason,'creator-provenance-audit');assert.equal(state.quests.length,1);assert.equal(state.quests[0].sourceActionId,batch.batchId);assert.equal(state.quests[0].tasks[0].status,'review','audit work begins directly in review state');assert.equal(state.quests[0].tasks[0].proofRequired,false,'Guild finding is the proof; reviewer must not upload duplicate private evidence into Cerbanimo');assert.match(state.quests[0].tasks[0].description,/Receipt: receipt-1/);assert.match(state.quests[0].tasks[1].owner,/human tribunal/i);
let serialized=JSON.stringify(state.quests[0]);assert.doesNotMatch(serialized,/ciphertext|rawPacket|packetContents|private draft/i,'Quest Beat must carry receipt metadata only');

let close=await api.recordFinding('audit:1',{status:'pending-human-review',finding:null});assert.equal(close.status,'still-reviewing');assert.equal(state.quests[0].tasks[0].status,'review');assert.equal(transitionCalls.length,0,'a non-decisive tribunal vote cannot close the work unit');
close=await api.recordFinding('audit:1',{status:'reviewed',finding:{outcome:'verified',rationale:'Two independent Guild reviewers agreed.'}});assert.equal(close.status,'completed');assert.equal(close.findingOutcome,'verified');assert.equal(state.quests[0].tasks[0].status,'completed');assert.equal(transitionCalls.length,1);assert.equal(transitionCalls[0].next,'completed');assert.match(transitionCalls[0].note,/verified: Two independent Guild reviewers agreed/);
const descriptionBeforeAppeal=state.quests[0].tasks[0].description;
close=await api.recordFinding('audit:1',{status:'reviewed',finding:{outcome:'verified'}});assert.equal(close.status,'already-completed');assert.equal(transitionCalls.length,1,'resolved audit work closure must be idempotent');

const appealBatch={...batch,samples:[{...batch.samples[0],priorityReason:'dispute',reviewLane:'human'}]};
const rematerialized=await api.materialize(appealBatch);assert.equal(rematerialized.questId,materialized.questId,'appeal must reuse the same daily audit Quest');assert.equal(state.quests.length,1,'appeal must not spawn a duplicate Quest');const reopened=api.taskForSample(state.quests[0],'audit:1');assert.equal(reopened.status,'review','appeal reopens the previously resolved sample');assert.equal(reopened.review.state,'none');assert.match(reopened.description,/Priority: dispute/);assert.match(reopened.description,/Receipt: receipt-1/,'appeal reopening must preserve compact receipt metadata');assert.notEqual(reopened.description,descriptionBeforeAppeal,'appeal should visibly update the priority lane without exposing new evidence');
close=await api.recordFinding('audit:1',{status:'reviewed',decision:{finding:{outcome:'unknown-origin',rationale:'Appeal tribunal could not establish a stronger claim.'}}});assert.equal(close.status,'completed');assert.equal(state.quests[0].tasks[0].status,'completed');assert.equal(transitionCalls.length,2,'appeal resolution closes the same work unit through the canonical task transition');
serialized=JSON.stringify(state.quests[0]);assert.doesNotMatch(serialized,/ciphertext|rawPacket|packetContents|private draft/i);

console.log('Creator provenance Cerbanimo Reckoning review lifecycle passed');
