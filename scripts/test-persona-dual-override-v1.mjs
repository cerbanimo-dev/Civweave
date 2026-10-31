import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersonaCampaign,applyCampaignEvent,exportCampaignSnapshot,importCampaignSnapshot} from '../public/app/shared/persona-campaign-v1.mjs';
import {runSplitMindTurn} from '../public/app/shared/persona-scene-bridge-v1.mjs';
import {runPersonaChatTurn} from '../public/app/shared/persona-chat-turn-v1.mjs';

const pack={schema:'civweave.persona-library.v1',id:'dual-voices',version:1,
 characters:[{id:'landry',name:'Landry',role:'protagonist',modelTier:'2b',improvTier:'0.8b',voice:'wry'},
 {id:'delia',name:'Delia',role:'protagonist',modelTier:'2b',improvTier:'0.8b',voice:'precise'}],events:[]};
const owner={kind:'human',principalId:'author:one'};
const authorize=({actor})=>actor.kind==='human'&&actor.principalId===owner.principalId;
const campaign=()=>createPersonaCampaign({pack,id:'shared:dual',ownerId:owner.principalId,
 branchId:'what-if:two',stage:2,scenario:'A shared body hears a knock at the door.',cast:['landry','delia']});
const calls=[];
const invokeModel=async request=>{
 calls.push(request);
 if(request.modelTier==='4b')return {status:'success',outputJson:{characters:{[request.characterId]:{
  instructions:'React to the sound, do not invent the source.',knownEventIds:[],characterGoal:'Stay aware'}}}};
 if(request.modelTier==='2b')return {status:'success',outputJson:{
  speech:request.characterId==='landry'?'I heard that.':'And I do not trust it.',
  emote:request.characterId==='landry'?'looks toward the door':'folds her arms',
  actions:[{tool:'speak',args:{text:request.characterId==='landry'?'I heard that.':'And I do not trust it.'}}]}};
 return {status:'success',outputJson:{speech:'We heard you.',emote:'still',actions:[]}};
};
test('both voices override together, both speak without a moderator, each spends one point',async()=>{
 calls.length=0;
 const outcome=await runPersonaChatTurn({pack,campaign:campaign(),characterId:'landry-delia',
  actor:owner,authorize,input:'Who is there?',directControl:'both',invokeModel});
 assert.deepEqual(calls.map(r=>r.modelTier),['4b','4b','2b','2b']);
 assert.equal(outcome.campaign.willpower.points,0);
 assert.deepEqual(outcome.campaign.events.map(e=>e.type),['willpower-spend','willpower-spend','rehearsal-preview']);
 assert.deepEqual(outcome.campaign.events.slice(0,2).map(e=>e.characterId),['landry','delia']);
 assert.deepEqual(outcome.campaign.events.slice(0,2).map(e=>e.remainingPoints),[1,0]);
 assert.match(outcome.packet.response.answer,/Landry: I heard that\./);
 assert.match(outcome.packet.response.answer,/Delia: And I do not trust it\./);
 assert.deepEqual(outcome.campaign.events[2].spokenTurns.map(x=>x.characterId),['landry','delia']);
 assert.equal(outcome.campaign.turn,1);
 assert.equal(outcome.campaign.events[2].worldChanged,false);
 assert.equal(outcome.campaign.events[2].status,'unexecuted');
 const saved=exportCampaignSnapshot(outcome.campaign);
 const opened=importCampaignSnapshot(saved,{pack});
 assert.deepEqual(opened.events[2].spokenTurns.map(x=>x.characterId),['landry','delia']);
});
test('one override remains a single direct voice and one willpower spend',async()=>{
 calls.length=0;
 const result=await runPersonaChatTurn({pack,campaign:campaign(),characterId:'landry-delia',
 actor:owner,authorize,input:'Are we safe?',directControl:'landry',invokeModel});
 assert.equal(result.campaign.willpower.points,1);
 assert.deepEqual(result.campaign.events.map(e=>e.type),['willpower-spend','rehearsal-preview']);
 assert.match(result.packet.response.answer,/Landry: I heard that/);
 assert.doesNotMatch(result.packet.response.answer,/Delia: And I do not trust it/);
 assert.deepEqual(calls.map(r=>r.modelTier),['4b','4b','2b','2b']);
});
test('without overrides, moderator is the only outward voice',async()=>{
 calls.length=0;
 const result=await runPersonaChatTurn({pack,campaign:campaign(),characterId:'landry-delia',
 actor:owner,authorize,input:'Hello?',invokeModel});
 assert.equal(result.campaign.willpower.points,2);
 assert.deepEqual(result.campaign.events.map(e=>e.type),['rehearsal-preview']);
 assert.deepEqual(calls.map(r=>r.modelTier),['4b','4b','2b','2b','0.8b']);
 assert.match(result.packet.response.answer,/We heard you/);
});
test('insufficient shared willpower rejects BOTH atomically before generating or recording a partial turn',async()=>{
 let s=campaign();
 s=applyCampaignEvent(s,{type:'willpower-spend',characterId:'landry',cost:1},
  {actor:owner,authorize,expectedRevision:s.revision});
 calls.length=0;
 await assert.rejects(()=>runPersonaChatTurn({pack,campaign:s,characterId:'landry-delia',
   actor:owner,authorize,input:'Both answer?',directControl:'both',invokeModel}),/insufficient|willpower/i);
 assert.equal(s.willpower.points,1);
 assert.equal(s.events.length,1);
 assert.equal(calls.filter(x=>x.modelTier==='2b').length,0);
});
test('duplicate voice requests and invalid costs cannot steal an extra spend',async()=>{
 const scene={stage:2,revision:1,turn:0,expireAfterTurn:4,scenario:'Hello',participants:['landry','delia'],
  directives:{characters:{landry:{instructions:'Speak',knownEventIds:[]},delia:{instructions:'Speak',knownEventIds:[]}}}};
 calls.length=0;
 await assert.rejects(()=>runSplitMindTurn({pack,scene,invokeModel,willpower:{points:2,max:2,renewEvery:4,lastRenewedTurn:0},
  directControl:[{characterId:'landry',cost:1},{characterId:'landry',cost:1}],authorizeDirectControl:()=>true}),/duplicate|distinct/i);
 assert.equal(calls.length,0);
 await assert.rejects(()=>runSplitMindTurn({pack,scene,invokeModel,willpower:{points:2,max:2,renewEvery:4,lastRenewedTurn:0},
  directControl:[{characterId:'landry',cost:0},{characterId:'delia',cost:1}],authorizeDirectControl:()=>true}),/cost|integer/i);
 assert.equal(calls.length,0);
});
