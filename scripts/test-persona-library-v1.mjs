import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validatePersonaPack, availableKnowledge, createDirectorRequest,
  validateDirectorResponse, compileImprovPrompt, chooseModelDownloads,
  regenerateWillpower, requestDirectControl, advanceContinuity,
  worldweaverNpcCommand
} from '../public/app/shared/persona-library-v1.mjs';

const pack={
  schema:'civweave.persona-library.v1',id:'mirror-blade',version:1,
  characters:[
    {id:'magnus',name:'Magnus',role:'protagonist',modelTier:'4b',improvTier:'0.8b',voice:'wry',knowledgeRefs:['e1']},
    {id:'jess',name:'Jess',role:'supporting',modelTier:'2b',improvTier:'0.8b',voice:'sarcastic, protective',knowledgeRefs:['e1']},
    {id:'raven',name:'Raven',role:'antagonist',modelTier:'2b',improvTier:'0.8b',voice:'guarded',knowledgeRefs:['e2']}
  ],
  events:[
    {id:'e1',stage:1,summary:'Jess and Magnus play games together.',actors:['jess','magnus'],witnesses:['jess','magnus'],source:'book-2:chapter-3',status:'established'},
    {id:'e2',stage:4,summary:'Jess and Raven were friends before Raven was Turned.',actors:['jess','raven'],witnesses:['jess','raven','magnus'],knownFrom:{jess:0,raven:0,magnus:4},source:'book-4:chapter-what-jess-kept',status:'established',spoiler:true}
  ]
};
test('reject antagonist downgraded below 2B',()=>assert.throws(()=>validatePersonaPack({...pack,characters:pack.characters.map(c=>c.id==='raven'?{...c,modelTier:'0.8b'}:c)}),/antagonist/i));
test('knowledge is bounded by event stage and individual awareness',()=>{
  const p=validatePersonaPack(pack);
  assert.deepEqual(availableKnowledge(p,'jess',1).map(e=>e.id),['e1','e2']);
  assert.deepEqual(availableKnowledge(p,'magnus',1).map(e=>e.id),['e1']);\n  assert.deepEqual(availableKnowledge(p,'magnus',9).map(e=>e.id),['e1','e2']);
  assert.deepEqual(availableKnowledge(p,'raven',9).map(e=>e.id),['e2']);
});
test('director receives only current canon and role instructions',()=>{
  const request=createDirectorRequest({pack,stage:1,scenario:'At the arcade',participants:['magnus'],goals:['Improv conversation']});
  assert.match(request.messages[1].content,/At the arcade/);
  assert.doesNotMatch(request.messages[1].content,/before Raven was Turned/);
  assert.equal(request.modelTier,'4b');
});
test('4B cannot grant actor unrevealed knowledge',()=>{
  const request={pack,stage:1,participants:['magnus'],scenario:'chat'};
  assert.throws(()=>validateDirectorResponse({...request,response:{characters:{magnus:{characterGoal:'stay calm',emotion:'uneasy',knownEventIds:['e2'],instructions:'Respond carefully'}}}}),/not available/i);
});
test('improv is character-specific and includes validated scene directives',()=>{
  const response={characters:{jess:{characterGoal:'Protect Magnus',emotion:'uneasy',knownEventIds:['e1'],instructions:'Deflect with a joke until danger is credible.',escalateWhen:['new danger']}}};
  const d=validateDirectorResponse({pack,stage:1,participants:['jess'],response});
  const p=compileImprovPrompt({pack,stage:1,characterId:'jess',scene:'At home',directives:d,history:['Magnus: Something is wrong.']});
  assert.match(p,/Protect Magnus/);assert.match(p,/Jess/);
  assert.match(p,/before Raven was Turned/);
});
test('download deduplicates model weights across cast and keeps 4B director',()=>{
  const plan=chooseModelDownloads(pack,['jess','raven'],{includeDirector:true});
  assert.deepEqual(plan.tiers,['0.8b','2b','4b']);assert.equal(plan.personas.length,2);
});
test('willpower regenerates on turns, direct control spends it once',()=>{
  const a=regenerateWillpower({points:1,max:2,renewEvery:3,lastRenewedTurn:0},3);
  assert.equal(a.points,2);
  const b=requestDirectControl(a,{characterId:'delia',turn:3,cost:2});
  assert.equal(b.allowed,true);assert.equal(b.willpower.points,0);
  assert.equal(requestDirectControl(b.willpower,{characterId:'landry',turn:4,cost:1}).allowed,false);
});
test('canonical facts are immutable and deviations require a branch',()=>{
  const state={branchId:'canon',events:[{eventId:'e1',type:'established'}],turn:1};
  assert.throws(()=>advanceContinuity(state,{eventId:'e1',text:'rewrite'},{}),/branch/i);
  const next=advanceContinuity({...state,branchId:'what-if-01'},{eventId:'new-event',text:'Player leaves early'}, {authorize:()=>true});
  assert.equal(next.events.length,2);assert.equal(state.events.length,1);
});
test('worldweaver NPC command uses the canonical model runtime assignment',()=>{
  const cmd=worldweaverNpcCommand({pack,characterId:'jess',instanceId:'world-1',modelId:'qwen3.5:0.8b',pilotPrincipalId:'model-jess',stage:1});
  assert.equal(cmd.type,'rig-npc');assert.equal(cmd.modelId,'qwen3.5:0.8b');
  assert.match(cmd.pilotPrompt,/Jess/);assert.deepEqual(cmd.capabilities,['observe','inspect','speak','move','present']);
});
