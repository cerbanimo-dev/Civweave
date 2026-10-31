import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersonaCampaign,applyCampaignEvent} from '../public/app/shared/persona-campaign-v1.mjs';
import {runPersonaChatTurn,createPersonaChatRuntime} from '../public/app/shared/persona-chat-turn-v1.mjs';

const pack={schema:'civweave.persona-library.v1',id:'demo',version:1,
 characters:[{id:'jess',name:'Jess',role:'supporting',modelTier:'2b',improvTier:'0.8b',voice:'dry and protective'},
 {id:'magnus',name:'Magnus',role:'protagonist',modelTier:'4b',improvTier:'0.8b',voice:'wry'}],
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
