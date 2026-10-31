import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {createDirectorRequest,createPrivateDirectorRequest,validatePersonaPack} from '../public/app/shared/persona-library-v1.mjs';
import {prepareDirectedScene,performPersonaTurn,queuePersonaActionIntents,needsDirectorRefresh,runSplitMindTurn,advanceSceneTurn} from '../public/app/shared/persona-scene-bridge-v1.mjs';

const pack=validatePersonaPack({schema:'civweave.persona-library.v1',id:'test-cast',version:1,
 characters:[
  {id:'jess',name:'Jess',role:'supporting',modelTier:'2b',improvTier:'0.8b',voice:'dry and protective',emotes:['FUTURE SPOILER MUST NOT LEAK'],verifiedEmotes:[{stage:1,text:'arches an eyebrow',source:'test-novel-2',verified:true}]},
  {id:'magnus',name:'Magnus',role:'protagonist',modelTier:'4b',improvTier:'0.8b',voice:'genre-aware, thoughtful'}],
 events:[
  {id:'history',stage:0,knownFrom:{jess:0},summary:'Jess knew Raven long before the present scene.',actors:['jess'],witnesses:['jess'],source:'test-novel-1',status:'established'},
  {id:'shared',stage:1,summary:'Jess and Magnus have played games together.',actors:['jess','magnus'],witnesses:['jess','magnus'],source:'test-novel-2',status:'established'}
 ]});
const jsonReply=content=>({choices:[{message:{content:JSON.stringify(content)}}]});
test('public 4B prompt excludes facts known only to one participant',()=>{
 const q=createDirectorRequest({pack,stage:1,scenario:'Meet at a cafe',participants:['jess','magnus']});
 assert.doesNotMatch(q.messages[1].content,/Jess knew Raven/);
 assert.doesNotMatch(q.messages[1].content,/\"history\"/);
 assert.match(q.messages[1].content,/played games/);
});
test('personal 4B director prompt can see only the selected character private facts',()=>{
 const j=createPrivateDirectorRequest({pack,stage:1,scenario:'Meet',characterId:'jess',participants:['jess','magnus']});
 const m=createPrivateDirectorRequest({pack,stage:1,scenario:'Meet',characterId:'magnus',participants:['jess','magnus']});
 assert.match(j.messages[1].content,/Jess knew Raven/);
 assert.doesNotMatch(m.messages[1].content,/Jess knew Raven/);
 assert.match(j.messages[1].content,/arches an eyebrow/);
 assert.doesNotMatch(j.messages[1].content,/FUTURE SPOILER/);
});
test('scene preparation issues isolated 4B calls, validates directives and maintains revision',async()=>{
 const calls=[];
 const invokeModel=async q=>{
  calls.push(q);
  const target=JSON.parse(q.messages[1].content).targetCharacter;
  return jsonReply({characters:{[target]:{
   instructions:'Keep a calm demeanor.',knownEventIds:target==='jess'?['history','shared']:['shared'],
   emotion:'cautious',characterGoal:'Understand the situation',escalateWhen:['player leaves'],
   improvFreedom:'improvise small talk'
  }}});
 };
 const scene=await prepareDirectedScene({pack,stage:1,scenario:'A quiet diner',participants:['jess','magnus'],invokeModel});
 assert.equal(calls.length,2);assert.ok(calls.every(c=>c.modelTier==='4b'));
 assert.equal(scene.revision,1);assert.equal(scene.directives.characters.jess.knownEventIds.length,2);
 assert.doesNotMatch(calls[1].messages[1].content,/Jess knew Raven/);
 assert.equal(scene.turn,0);assert.equal(scene.expireAfterTurn,4);
});
test('0.8B actor generates bounded structured speech; no world intent is claimed executed',async()=>{
 const scene={revision:2,turn:1,expireAfterTurn:5,stage:1,scenario:'A quiet diner',participants:['jess'],
 directives:{characters:{jess:{knownEventIds:['history','shared'],instructions:'Be careful.',characterGoal:'Protect Magnus',emotion:'wary',escalateWhen:[],improvFreedom:'small jokes'}}}};
 const called=[];
 const res=await performPersonaTurn({pack,scene,characterId:'jess',playerInput:'Where is Raven?',invokeModel:async q=>{called.push(q);return jsonReply({speech:'You really want to know?',emote:'arches an eyebrow',actions:[{tool:'speak',args:{text:'You really want to know?'}}],requestDirection:false})}});
 assert.equal(called.length,1);assert.equal(called[0].modelTier,'0.8b');
 assert.equal(res.speech,'You really want to know?');assert.equal(res.proposedActions.length,1);
 assert.equal(res.worldChanged,false);assert.equal(res.needsDirection,false);
});
test('expired or consequential scene requires 4B refreshing, even when 0.8B sounds confident',()=>{
 const s={revision:1,turn:4,expireAfterTurn:4,stage:1,scenario:'diner',participants:['jess'],directives:{characters:{jess:{instructions:'talk',knownEventIds:[]}}}};
 assert.equal(needsDirectorRefresh(s,{turn:4}),true);
 assert.equal(needsDirectorRefresh({...s,turn:2},{worldChanged:true}),true);
 assert.equal(needsDirectorRefresh({...s,turn:2},{stage:2}),true);
 assert.equal(needsDirectorRefresh({...s,turn:2},{trigger:'player leaves'}),true);
});
test('Worldweaver receives model actions only through its trusted owner and stays queued',()=>{
 let i=0;const w=createWorldweaver({id:()=>String(++i),clock:()=> '2026-10-31T14:00:00Z',
  authorize:({actor})=>actor?.verified===true});
 const human={kind:'human',principalId:'owner',verified:true};
 const instance=w.dispatch({type:'create',guide:'moss',title:'Cafeteria'},human).instance;
 const npc=w.dispatch({type:'rig-npc',instanceId:instance.id,name:'Jess',modelId:'qwen3.5:0.8b',
  pilotPrincipalId:'model-jess',personaRef:'test-cast:jess',pilotPrompt:'You are Jess.',
  capabilities:['observe','speak','move']},human).npc;
 const actor={kind:'model',principalId:'model-jess',modelId:'qwen3.5:0.8b',personaRef:'test-cast:jess',verified:true};
 const reply={speech:'Hello',proposedActions:[{tool:'speak',args:{text:'Hello'}},{tool:'move',args:{direction:'north'}}]};
 const result=queuePersonaActionIntents({world:w,npcId:npc.id,actor,pack,characterId:'jess',turnResult:reply});
 assert.equal(result.intents.length,2);assert.equal(result.intents[0].status,'queued');
 assert.equal(w.snapshot().intents[0].status,'queued');
 assert.throws(()=>queuePersonaActionIntents({world:w,npcId:npc.id,actor:{...actor,principalId:'impostor'},pack,characterId:'jess',turnResult:reply}),/identity|mismatch|bound/i);
 assert.throws(()=>queuePersonaActionIntents({world:w,npcId:npc.id,actor,pack,characterId:'magnus',turnResult:reply}),/different persona/i);
});
test('no arbitrary action or unbounded model output may be queued',()=>{
 assert.throws(()=>queuePersonaActionIntents({turnResult:{proposedActions:[{tool:'execute-code',args:{script:'bad'}}]}}),/Worldweaver|required/i);
});

test('two 2B internal voices are moderated by 0.8B unless authorized willpower bypasses it',async()=>{
 const dualPack=validatePersonaPack({schema:'civweave.persona-library.v1',id:'mirror-test',version:1,characters:[
  {id:'landry',name:'Landry',role:'protagonist',modelTier:'2b',improvTier:'0.8b',voice:'gentle'},
  {id:'delia',name:'Delia',role:'protagonist',modelTier:'2b',improvTier:'0.8b',voice:'assertive'}],events:[]});
 const s={revision:1,turn:0,expireAfterTurn:4,stage:1,scenario:'Between the doors',participants:['landry','delia'],
 directives:{characters:{
  landry:{knownEventIds:[],instructions:'Avoid harm',characterGoal:'Understand',emotion:'afraid',escalateWhen:[],improvFreedom:'small'},
  delia:{knownEventIds:[],instructions:'Protect',characterGoal:'Survive',emotion:'defiant',escalateWhen:[],improvFreedom:'small'}
 }}};
 const calls=[];
 const invokeModel=async q=>{
  calls.push(q);
  if(q.purpose==='split-mind-moderation')return jsonReply({speech:'We should go carefully.',emote:'steps back'});
  return jsonReply({speech:q.characterId==='landry'?'I am afraid.':'I will protect us.',emote:'hesitates'});
 };
 const common={pack:dualPack,scene:s,invokeModel,willpower:{points:2,max:2,renewEvery:4,lastRenewedTurn:0}};
 const normal=await runSplitMindTurn(common);
 assert.equal(normal.route,'moderator');assert.deepEqual(calls.map(c=>c.modelTier),['2b','2b','0.8b']);
 assert.equal(normal.speech,'We should go carefully.');assert.equal(normal.willpower.points,2);
 calls.length=0;
 const direct=await runSplitMindTurn({...common,directControl:{characterId:'delia',cost:1},authorizeDirectControl:()=>true});
 assert.equal(direct.route,'direct');assert.equal(direct.speech,'I will protect us.');
 assert.deepEqual(calls.map(c=>c.modelTier),['2b','2b']);assert.equal(direct.willpower.points,1);
 assert.equal(direct.directControlReceipt.characterId,'delia');
 calls.length=0;
 await assert.rejects(runSplitMindTurn({...common,directControl:{characterId:'delia',cost:1}}),/trusted authorization/i);
 assert.equal(calls.length,0);
});

test('existing Civweave selected-model result envelopes are accepted, failed inference is rejected',async()=>{
 const single={revision:1,turn:0,expireAfterTurn:4,stage:1,scenario:'Arcade',participants:['jess'],
   directives:{characters:{jess:{knownEventIds:['history','shared'],instructions:'Make a joke',characterGoal:'Listen',
     emotion:'amused',escalateWhen:[],improvFreedom:'playful'}}}};
 const good=await performPersonaTurn({pack,scene:single,characterId:'jess',invokeModel:async()=>({status:'success',
  outputJson:{speech:'Try again.',emote:'smirks',actions:[]}})});
 assert.equal(good.speech,'Try again.');
 await assert.rejects(performPersonaTurn({pack,scene:single,characterId:'jess',invokeModel:async()=>({
  status:'model-error',outputText:'Try again.'})}),/inference|success/i);
});

test('turns advance once, reject conflicting writers and force a fresh 4B brief after deviation',()=>{
 const s={schema:'civweave.persona-scene.v1',revision:2,turn:0,expireAfterTurn:4,
   stage:3,scenario:'Campfire',participants:['jess'],directives:{characters:{jess:{instructions:'Talk',knownEventIds:[]}}}};
 const a=advanceSceneTurn(s,{expectedTurn:0});
 assert.equal(a.turn,1);assert.equal(needsDirectorRefresh(a),false);
 assert.equal(s.turn,0);
 assert.throws(()=>advanceSceneTurn(a,{expectedTurn:0}),/stale|conflict/i);
 const b=advanceSceneTurn(a,{expectedTurn:1,worldChanged:true});
 assert.equal(b.turn,2);assert.equal(needsDirectorRefresh(b),true);
});
test('world revision change during director inference prevents stale scene publication',async()=>{
 let rev=7;
 const world={snapshot:()=>({revision:rev})};
 const invokeModel=async()=>{
   rev++;
   return jsonReply({characters:{jess:{instructions:'Speak',knownEventIds:['history'],emotion:'wary',characterGoal:'help'}}});
 };
 await assert.rejects(prepareDirectedScene({pack,stage:1,scenario:'Arcade',participants:['jess'],
   world,invokeModel}),/changed during|stale/i);
});

test('actor prompt ignores unreviewed mannerism snippets and time-gates verified gestures',()=>{
 const s={revision:1,turn:0,expireAfterTurn:4,stage:0,scenario:'Before the story',participants:['jess'],
 directives:{characters:{jess:{knownEventIds:['history'],instructions:'Talk',characterGoal:'Observe',
 emotion:'thoughtful',escalateWhen:[],improvFreedom:'gentle'}}}};
 let p='';
 return performPersonaTurn({pack,scene:s,characterId:'jess',invokeModel:async req=>{
  p=req.messages[0].content;return jsonReply({speech:'Hello',emote:'looks away'});}}).then(()=>{
  assert.doesNotMatch(p,/FUTURE SPOILER/);
  assert.doesNotMatch(p,/arches an eyebrow/);
 });
});
