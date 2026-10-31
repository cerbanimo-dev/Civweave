import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersonaCampaign,applyCampaignEvent} from '../public/app/shared/persona-campaign-v1.mjs';
import {runPersonaChatTurn,createPersonaChatRuntime} from '../public/app/shared/persona-chat-turn-v1.mjs';

const pack={schema:'civweave.persona-library.v1',id:'demo',version:1,
 characters:[{id:'jess',name:'Jess',role:'supporting',modelTier:'2b',improvTier:'0.8b',voice:'dry and protective'},
 {id:'magnus',name:'Magnus',role:'protagonist',modelTier:'4b',improvTier:'0.8b',voice:'wry'},
 {id:'landry',name:'Landry',role:'protagonist',modelTier:'2b',improvTier:'0.8b',voice:'reflective'},
 {id:'delia',name:'Delia',role:'protagonist',modelTier:'2b',improvTier:'0.8b',voice:'analytic'}],
 events:[{id:'a',stage:1,summary:'Jess and Magnus played a game together.',actors:['jess','magnus'],witnesses:['jess','magnus'],status:'established',source:'chapter:1'}]};
const owner={kind:'human',principalId:'private:owner'};
const campaign=()=>createPersonaCampaign({pack,id:'local:1',title:'At the arcade',ownerId:owner.principalId,branchId:'what-if:one',stage:2,scenario:'At the arcade',cast:['jess','magnus']});
const invokeModel=async req=>req.purpose==='persona-private-scene-direction'?
 {status:'success',outputJson:{characters:{[req.characterId]:{characterGoal:'learn',emotion:'uneasy',instructions:'Stay wary and joke.',knownEventIds:['a'],escalateWhen:['danger'],improvFreedom:'small talk'}}}}:
 {status:'success',outputJson:{speech:'You really want to ask that?',emote:'shrugs',actions:[{tool:'speak',args:{text:'You really want to ask that?'}}],requestDirection:false}};
const authorize=({actor})=>actor.kind==='human'&&actor.principalId===owner.principalId;
test('private chat routes through a 4B director and 0.8B actor, not a new chat owner',async()=>{
 const calls=[];const result=await runPersonaChatTurn({pack,campaign:campaign(),characterId:'jess',input:'Hi Jess',
  actor:owner,authorize,invokeModel:async request=>{calls.push(request);return invokeModel(request)}});
 assert.deepEqual(calls.map(x=>x.modelTier),['4b','0.8b']);
 assert.match(result.packet.response.answer,/Jess:/);
 assert.equal(result.campaign.revision,1);
 assert.equal(result.campaign.events[0].status,'unexecuted');
 assert.equal(result.campaign.events[0].worldChanged,false);
 assert.equal(result.scene.turn,1);
});
test('malformed actor output does not mutate session and fails visibly',async()=>{
 const before=campaign();
 await assert.rejects(()=>runPersonaChatTurn({pack,campaign:before,characterId:'jess',input:'Hi',
  actor:owner,authorize,invokeModel:async req=>req.modelTier==='4b'?invokeModel(req):{status:'failed',error:'model offline'}}),/success|complete|model|failed/i);
 assert.equal(before.revision,0);
});
test('reuses director across ordinary turns, refreshes on planned player deviation',async()=>{
 const runtime=createPersonaChatRuntime({pack,campaign:campaign(),actor:owner,authorize,invokeModel});
 const a=await runtime.respond({characterId:'jess',input:'Hello'});
 assert.equal(a.campaign.turn,1);
 const b=await runtime.respond({characterId:'jess',input:'I leave unexpectedly',worldChanged:true});
 assert.equal(b.scene.expireAfterTurn,b.scene.turn);
 const c=await runtime.respond({characterId:'jess',input:'Where am I?'});
 assert.ok(c.scene.revision>1);
 assert.equal(c.campaign.turn,3);
});
test('session rejects unknown speakers, no silent fallback to ordinary guide or cross-campaign state',async()=>{
 await assert.rejects(()=>runPersonaChatTurn({pack,campaign:campaign(),characterId:'villain',input:'Hi',actor:owner,authorize,invokeModel}),/character|participant|cast/i);
 const rt=createPersonaChatRuntime({pack,campaign:campaign(),actor:owner,authorize,invokeModel});
 assert.throws(()=>rt.replaceCampaign({...campaign(),id:'different'}),/campaign|mismatch/i);
});

test('split-mind chat uses two 2B voices and 0.8B outward moderator, without mutating canon',async()=>{
 const s=createPersonaCampaign({pack,id:'local:2',title:'Quiet hospital',ownerId:owner.principalId,
   branchId:'what-if:split',stage:2,scenario:'In a quiet hallway.',cast:['landry','delia']});
 const calls=[];const invoke=async request=>{
   calls.push(request);
   if(request.modelTier==='4b')return {status:'success',outputJson:{characters:{[request.characterId]:{
      characterGoal:'listen',emotion:'curious',instructions:'Observe quietly.',
      knownEventIds:[],escalateWhen:[],improvFreedom:'small gestures'}}}};
   if(request.modelTier==='2b')return {status:'success',outputJson:{speech:'I think we should leave.',emote:'hesitates',actions:[]}};
   return {status:'success',outputJson:{speech:'We should leave.',emote:'nods',actions:[]}};
 };
 const result=await runPersonaChatTurn({pack,campaign:s,characterId:'landry-delia',input:'What do you do?',
   actor:owner,authorize,invokeModel:invoke});
 assert.deepEqual(calls.map(x=>x.modelTier),['4b','4b','2b','2b','0.8b']);
 assert.match(result.packet.response.answer,/Landry\/Delia/);
 assert.equal(result.campaign.events[0].status,'unexecuted');
 assert.equal(result.campaign.willpower.points,2);
});
test('author-controlled split-mind bypass spends willpower on a signed local ledger event',async()=>{
 const s=createPersonaCampaign({pack,id:'local:3',ownerId:owner.principalId,
   branchId:'what-if:control',scenario:'A hallway',cast:['landry','delia']});
 const invoke=async request=>request.modelTier==='4b'?
 {status:'success',outputJson:{characters:{[request.characterId]:{instructions:'Observe',knownEventIds:[]}}}}:
 {status:'success',outputJson:{speech:'I decide.',actions:[]}};
 const r=await runPersonaChatTurn({pack,campaign:s,characterId:'landry-delia',input:'Can you move?',
   actor:owner,authorize,invokeModel:invoke,directControl:'delia'});
 assert.equal(r.campaign.willpower.points,1);
 assert.equal(r.campaign.events[0].type,'willpower-spend');
 assert.equal(r.campaign.events[1].status,'unexecuted');
});
