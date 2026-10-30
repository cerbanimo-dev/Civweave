import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldweaver, SPACE_GUIDES, WORLDWEAVER_SCHEMA} from '../public/app/shared/worldweaver-core-v1.mjs';

let seq=0;
const authorizer = ({actor,command}) => actor?.verified === true
  && (actor.kind === 'human' || (actor.kind === 'model' && !['provisioned','report-action'].includes(command.type))
      || (actor.kind === 'runtime' && ['provisioned','report-action'].includes(command.type)));
const kit=()=>createWorldweaver({authorize:authorizer,id:()=>`id-${++seq}`,clock:()=> '2026-10-30T00:00:00Z'});
const human={kind:'human',principalId:'person-1',verified:true};
const npcActor={kind:'model',principalId:'model-1',modelId:'qwen3.5:4b',verified:true};
const runtime={kind:'runtime',principalId:'world-adapter',verified:true};
const create=(w,guide,scope='standalone',guildId)=>w.dispatch({type:'create',guide,title:'A practical experiment',scope,guildId},human);

test('each guide creates the correct independent microspace kind',()=>{
  const w=kit();
  for(const [guide,kind] of Object.entries(SPACE_GUIDES)) {
    const r=create(w,guide);
    assert.equal(r.instance.kind,kind);
    assert.equal(r.instance.status,'draft');
    assert.equal(r.instance.scope,'standalone');
  }
  assert.equal(w.snapshot().schema,WORLDWEAVER_SCHEMA);
  assert.equal(w.snapshot().instances.length,4);
});

test('map linking requires a guild, and instance creation never claims to allocate a server',()=>{
  const w=kit();
  assert.throws(()=>create(w,'moss','guild-map'),/guild/i);
  const r=create(w,'rook','guild-map','guild-123');
  assert.equal(r.instance.guildId,'guild-123');
  assert.equal(r.instance.status,'draft');
  assert.throws(()=>w.dispatch({type:'provisioned',instanceId:r.instance.id,backend:'opensim',worldRef:'grid-123'},human),/runtime/i);
  w.dispatch({type:'request-provision',instanceId:r.instance.id},human);
  assert.equal(w.snapshot().instances[0].status,'provision-requested');
  assert.equal(w.dispatch({type:'provisioned',instanceId:r.instance.id,backend:'opensim',worldRef:'grid-123'},runtime).instance.status,'live');
});

test('learning, tasks, listings and ballots are references to their owning capabilities',()=>{
  const w=kit();
  for(const [guide,type] of [['moss','learning-path'],['kamiya','quest-task'],['rook','fellowfare-listing'],['merlin','governance-ballot']]){
    const s=create(w,guide).instance;
    const r=w.dispatch({type:'link',instanceId:s.id,refType:type,refId:'canonical-123'},human);
    assert.equal(r.link.refType,type);
    assert.equal(r.link.refId,'canonical-123');
    assert.equal(r.link.authoritative,false);
    assert.throws(()=>w.dispatch({type:'link',instanceId:s.id,refType:'payment',refId:'money'},human),/not supported/i);
  }
});

test('models can rig and pilot NPCs, but their custom prompts cannot expand tool permissions',()=>{
  const w=kit();
  const inst=create(w,'kamiya').instance;
  assert.throws(()=>w.dispatch({type:'rig-npc',instanceId:inst.id,modelId:'other-model',name:'Pilot',pilotPrompt:'Build carefully'},npcActor),/own model/i);
  const r=w.dispatch({type:'rig-npc',instanceId:inst.id,modelId:'qwen3.5:4b',name:'Pilot',pilotPrompt:'Teach through hands-on examples',capabilities:['observe','speak','move','demonstrate']},npcActor);
  assert.equal(r.npc.status,'ready');
  assert.equal(r.npc.pilotPrompt,'Teach through hands-on examples');
  assert.throws(()=>w.dispatch({type:'rig-npc',instanceId:inst.id,modelId:'qwen3.5:4b',name:'Pilot',pilotPrompt:'Pay for items',capabilities:['purchase']},npcActor),/capabilit/i);
  assert.throws(()=>w.dispatch({type:'queue-actions',npcId:r.npc.id,actions:[{tool:'vote'}]},npcActor),/not allowed/i);
  const turns=w.dispatch({type:'queue-actions',npcId:r.npc.id,actions:[{tool:'observe',args:{target:'desk'}},{tool:'speak',args:{text:'Welcome'}}]},npcActor);
  assert.equal(turns.intents.length,2);
  assert.ok(turns.intents.every(x=>x.status==='queued'));
  assert.throws(()=>w.dispatch({type:'report-action',intentId:turns.intents[0].id,outcome:'succeeded'},npcActor),/runtime/i);
  assert.equal(w.dispatch({type:'report-action',intentId:turns.intents[0].id,outcome:'succeeded'},runtime).intent.status,'succeeded');
  assert.throws(()=>w.dispatch({type:'queue-actions',npcId:r.npc.id,actions:Array.from({length:4},()=>({tool:'observe'}))},npcActor),/three/i);
});

test('conventions keep debate turns and governance votes separate',()=>{
  const w=kit();
  const s=create(w,'merlin').instance;
  w.dispatch({type:'debate-turn',instanceId:s.id,topic:'Commons charter',statement:'We should debate the question before voting.'},human);
  assert.equal(w.snapshot().debateTurns.length,1);
  assert.equal(w.snapshot().links.length,0);
  w.dispatch({type:'link',instanceId:s.id,refType:'governance-ballot',refId:'ballot-hash-44'},human);
  assert.equal(w.snapshot().links.length,1);
  assert.equal(w.snapshot().debateTurns[0].speakerKind,'human');
  assert.throws(()=>w.dispatch({type:'cast-vote',instanceId:s.id,choice:'yes'},human),/Unsupported command/);
});

test('workshop stations are bounded declarative content, not arbitrary executable JS',()=>{
  const w=kit();
  const s=create(w,'moss').instance;
  const r=w.dispatch({type:'add-station',instanceId:s.id,stationType:'assessment',title:'Recall the sequence',instructions:'List the stages in order'},human);
  assert.equal(r.station.stationType,'assessment');
  assert.throws(()=>w.dispatch({type:'add-station',instanceId:s.id,stationType:'javascript',title:'Code',instructions:'eval(1)'},human),/station/i);
  assert.throws(()=>w.dispatch({type:'add-station',instanceId:s.id,stationType:'assessment',title:'Bad',instructions:'ok',script:'eval(1)'},human),/Unsupported field/i);
});

test('unauthenticated calls fail; snapshots cannot mutate internal state',()=>{
  const w=kit();
  assert.throws(()=>w.dispatch({type:'create',guide:'moss',title:'Bad'}, {...human,verified:false}),/Unauthorized/);
  create(w,'moss');
  const snap=w.snapshot();
  snap.instances[0].title='tampered';
  assert.notEqual(w.snapshot().instances[0].title,'tampered');
  assert.throws(()=>w.dispatch({type:'create',guide:'wrong',title:'Bad'},human),/guide/i);
});
