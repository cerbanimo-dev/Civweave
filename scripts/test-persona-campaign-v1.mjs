import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPersonaCampaign, applyCampaignEvent, exportCampaignSnapshot,
  importCampaignSnapshot, campaignPublicTimeline
} from '../public/app/shared/persona-campaign-v1.mjs';

const pack={schema:'civweave.persona-library.v1',id:'mirror-blade',version:3,
  characters:[
    {id:'jess',name:'Jess',role:'supporting',modelTier:'2b',improvTier:'0.8b',voice:'dry'},
    {id:'magnus',name:'Magnus',role:'protagonist',modelTier:'4b',improvTier:'0.8b',voice:'wry'},
    {id:'delia',name:'Delia',role:'protagonist',modelTier:'2b',improvTier:'0.8b',voice:'curious'}
  ],events:[]};
const human={kind:'human',principalId:'player:alice'};
const model={kind:'model',principalId:'model:jess',modelId:'qwen3.5:0.8b',personaRef:'mirror-blade:jess'};
const runtime={kind:'runtime',principalId:'simulator:one'};
const allow=({actor})=>Boolean(actor?.principalId);
const kit=()=>createPersonaCampaign({pack,id:'campaign-01',title:'A different evening',ownerId:'player:alice',
  branchId:'what-if:arcade',stage:2,scenario:'Jess and Magnus are at an arcade.',cast:['jess','magnus']});
const event=(state,command,actor=human,authorize=allow)=>applyCampaignEvent(state,command,{actor,authorize,expectedRevision:state.revision});

test('campaign creation requires private what-if branch and referenced cast',()=>{
  assert.throws(()=>createPersonaCampaign({pack,id:'a',ownerId:'player:alice',branchId:'canon',scenario:'test',cast:['jess']}),/what-if|canon/i);
  assert.throws(()=>createPersonaCampaign({pack,id:'a',ownerId:'player:alice',branchId:'what-if:test',scenario:'test',cast:['unknown']}),/unknown/i);
  const s=kit();
  assert.equal(s.revision,0); assert.equal(s.turn,0);assert.equal(s.branchId,'what-if:arcade');
  assert.equal(s.events.length,0);
});
test('owner can assign player seats; other humans cannot play an unassigned role',()=>{
  let s=kit();
  s=event(s,{type:'assign-player',playerId:'player:bob',roleId:'magnus'});
  assert.equal(s.seats['player:bob'],'magnus');
  assert.throws(()=>event(s,{type:'player-cue',text:'I open the door.'},{kind:'human',principalId:'player:mallory'}),/seat|player|owner/i);
  const b=event(s,{type:'player-cue',text:'I open the door.'},{kind:'human',principalId:'player:bob'});
  assert.equal(b.turn,1);assert.equal(b.events.at(-1).actorId,'player:bob');
  assert.equal(s.turn,0);
});
test('optimistic revision and source pack binding protect multiplayer conflicts and imports',()=>{
  const s=kit();
  assert.throws(()=>applyCampaignEvent(s,{type:'player-cue',text:'Hi'},{actor:human,authorize:allow,expectedRevision:7}),/stale|revision/i);
  assert.throws(()=>applyCampaignEvent(s,{type:'player-cue',text:'Hi'},{actor:human,authorize:()=>false,expectedRevision:0}),/unauthor/i);
  const encoded=exportCampaignSnapshot(s);
  assert.equal(importCampaignSnapshot(encoded,{pack}).id,s.id);
  assert.throws(()=>importCampaignSnapshot(encoded,{pack:{...pack,id:'other-world'}}),/pack|mismatch/i);
  assert.doesNotMatch(encoded,/sourceText|pilotPrompt|directorInstructions/);
  const corrupted=JSON.parse(encoded);corrupted.events=[{type:'canon-rewrite',text:'Everything changed'}];
  assert.throws(()=>importCampaignSnapshot(JSON.stringify(corrupted),{pack}),/invalid|unsupported|event/i);
});
test('NPC proposals require a registered pilot and cannot pretend their actions executed',()=>{
  let s=kit();
  s=event(s,{type:'bind-pilot',characterId:'jess',principalId:'model:jess',modelId:'qwen3.5:0.8b'});
  assert.throws(()=>event(s,{type:'npc-proposal',characterId:'jess',speech:'Stop',proposedActions:[]},{...model,principalId:'other'}),/pilot|identity/i);
  s=event(s,{type:'npc-proposal',characterId:'jess',speech:'Stop',emote:'looks away',proposedActions:[{tool:'speak',args:{text:'Stop'}}]},model);
  const proposal=s.events.at(-1);
  assert.equal(proposal.status,'pending');assert.equal(proposal.worldChanged,false);
  assert.throws(()=>event(s,{type:'resolve-proposal',proposalId:proposal.id,outcome:'succeeded',worldReceiptId:'intent-1'},human),/runtime/i);
  const resolved=event(s,{type:'resolve-proposal',proposalId:proposal.id,outcome:'succeeded',worldReceiptId:'intent-1'},runtime);
  assert.equal(resolved.events.find(e=>e.id===proposal.id).status,'pending'); // append-only
  assert.equal(resolved.events.at(-1).type,'resolve-proposal');
  assert.equal(resolved.events.at(-1).worldChanged,true);
  assert.throws(()=>event(resolved,{type:'resolve-proposal',proposalId:proposal.id,outcome:'succeeded',worldReceiptId:'intent-1'},runtime),/resolved|duplicate/i);
});
test('author-only rehearsal cues remain local previews; explicit world changes are not implied',()=>{
  let s=kit();
  s=event(s,{type:'rehearsal-preview',characterId:'jess',playerCue:'Tell me something.',speech:'Why?',
    emote:'arches eyebrow',sceneRevision:1,proposedActions:[{tool:'speak',args:{text:'Why?'}}]});
  assert.equal(s.turn,1);assert.equal(s.events[0].status,'unexecuted');
  assert.equal(s.events[0].worldChanged,false);
  const timeline=campaignPublicTimeline(s);
  assert.equal(timeline.length,1);
  assert.doesNotMatch(JSON.stringify(timeline),/director|privateMemory|systemPrompt/i);
});
test('split-mind willpower is restored and spent deterministically, never by model text',()=>{
  let s=kit();
  assert.equal(s.willpower.points,2);
  assert.throws(()=>event(s,{type:'willpower-spend',characterId:'delia',cost:1},model),/runtime|owner/i);
  s=event(s,{type:'willpower-spend',characterId:'delia',cost:1});
  assert.equal(s.willpower.points,1);
  s=event(s,{type:'willpower-spend',characterId:'delia',cost:1});
  assert.equal(s.willpower.points,0);
  assert.throws(()=>event(s,{type:'willpower-spend',characterId:'delia',cost:1}),/insufficient/i);
  for(let i=0;i<4;i++)s=event(s,{type:'player-cue',text:'Next beat '+i});
  assert.equal(s.willpower.points,1);
});
test('import rejects overflow, secret-like custom keys, edits to existing events, and an invalid branch',()=>{
  const s=kit();
  assert.throws(()=>importCampaignSnapshot(JSON.stringify({...s,branchId:'canon'}),{pack}),/canon|branch/i);
  assert.throws(()=>importCampaignSnapshot(JSON.stringify({...s,secretPrompt:'hidden'}),{pack}),/field|unknown/i);
  assert.throws(()=>importCampaignSnapshot('x'.repeat(250000),{pack}),/size|large/i);
});
