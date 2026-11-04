import test from 'node:test';
import assert from 'node:assert/strict';
import {starlingPveDirection,STARLING_PVE_PHASES,STARLING_PVE_RULES} from '../public/app/shared/starling-story-pve-v1.mjs';
import {createCollectiveTurnService} from '../public/app/shared/starling-collective-turns-v1.mjs';
import {STARLING_PERSONAS} from '../public/app/shared/starling-collective-v1.mjs';

const founder={guildId:'garden',deviceId:'device:founder',foundingIntention:{text:'Explore the botanical labyrinth with the Starling cast.'}};
function harness(){
  const items=[],requests=[];
  const mesh={
    deviceId:async()=> 'device:founder',
    getObject:async id=>id==='guild-genesis:garden'?{
      id,kind:'civweave.guild-genesis.v1',signature:'valid',
      origin:{nodeId:'device:founder'},payload:{guildId:'garden',foundingDeviceId:'device:founder',foundingIntention:founder.foundingIntention}
    }:items.find(x=>x.id===id)||null,
    validateObject:async x=>({ok:x?.signature==='valid'}),
    listObjects:async()=>items,
    createObject:async row=>{const result={...row,signature:'valid',origin:{nodeId:'device:founder'}};items.push(result);return result}
  };
  const model={
    readSharedConfig:()=>({provider:'ollama',model:'qwen3.5:4b',endpoint:'http://localhost:11434'}),
    normalizeConfig:x=>x,endpointLeavesDevice:()=>false,
    generate:async req=>{requests.push(req);return {status:'success',outputText:'SCENE: Lantern maze\nMOVE: I scout the roots\nENVIRONMENT REACTS: Thorns rise\nCOST / DISCOVERY: A map is lost\nNEXT HOOK: Follow the light',actual:{provider:'ollama'}}}
  };
  return {requests,items,mesh,model,service:createCollectiveTurnService({mesh,model,founder:()=>founder})};
}
test('PvE director only accepts a character, a Guildkeeper-authored premise and a supported phase',()=>{
  const basic={persona:STARLING_PERSONAS.kami,foundingIntention:founder.foundingIntention.text};
  assert.equal(STARLING_PVE_PHASES.length,3);
  assert.equal(STARLING_PVE_RULES.taskClaims,false);
  assert.throws(()=>starlingPveDirection({...basic,phase:'godmode'}),/phase/);
  assert.throws(()=>starlingPveDirection({...basic,foundingIntention:''}),/Intention/);
  assert.throws(()=>starlingPveDirection({...basic,persona:null}),/character/);
});
test('PvE prompt is a bounded improv encounter, never a real Guild action',()=>{
  const d=starlingPveDirection({persona:STARLING_PERSONAS.kami,foundingIntention:founder.foundingIntention.text,
    brief:'A crooked gate',phase:'complication',
    prior:[{personaId:'rosa',text:'Opened the gate at the cost of a compass'}]});
  assert.match(d.system,/PLAY THE ENVIRONMENT/);
  assert.match(d.system,/No real-world tool commands/);
  assert.match(d.user,/A crooked gate/);
  assert.match(d.user,/Opened the gate/);
  assert.match(d.user,/Yes-and/);
});
test('one PvE turn records a signed provisional scene in the canonical Guild mesh',async()=>{
  const h=harness();
  const row=await h.service.runOneTurn({guildId:'garden',personaId:'kami',storyMode:'pve',taskPrompt:'A singing mushroom'});
  assert.equal(row.kind,'civweave.starling-collective-turn.v1');
  assert.equal(row.payload.storyMode,'pve');
  assert.equal(row.payload.pvePhase,'encounter');
  assert.match(row.payload.pveSceneId,/^scene-/);
  assert.deepEqual(row.audience,['guild:garden']);
  assert.match(h.requests[0].purpose,/pve-improv/);
  assert.match(h.requests[0].messages[0].content,/Guildkeeper-authored premise/);
  assert.equal(row.payload.completionVerified,false);
  const [read]=await h.service.readTurns({guildId:'garden',verifyReader:()=>true});
  assert.equal(read.storyMode,'pve');assert.equal(read.pvePhase,'encounter');
});
test('three-character PvE round shares a scene ID and follows encounter, complication and consequence',async()=>{
  const h=harness();
  const round=await h.service.runRound({guildId:'garden',personas:['kami','rosa','farah'],storyMode:'pve',taskPrompt:'Run through the garden gate'});
  assert.equal(round.completed,3);
  assert.equal(round.storyMode,'pve');
  assert.deepEqual(h.items.map(x=>x.payload.pvePhase),['encounter','complication','consequence']);
  assert.equal(new Set(h.items.map(x=>x.payload.pveSceneId)).size,1);
  assert.equal(h.requests.length,3);
  assert.match(h.requests[1].messages[1].content,/Lantern maze/);
});
test('planning mode stays available to nonstory workflows; invalid story mode cannot run',async()=>{
  const h=harness();
  await h.service.runOneTurn({guildId:'garden',personaId:'kami'});
  assert.equal(h.items[0].payload.storyMode,'planning');
  await assert.rejects(()=>h.service.runOneTurn({guildId:'garden',personaId:'kami',storyMode:'unauthorized'}),/mode/);
  assert.equal(h.requests.length,1);
});
