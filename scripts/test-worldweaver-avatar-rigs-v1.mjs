import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {validateAvatarPlan, avatarEventSteps, avatarVisualRequest, renderAvatarSvg} from '../public/app/shared/worldweaver-avatar-v1.mjs';
import {proposeAvatarViaModel} from '../public/app/shared/worldweaver-avatar-pilot-v1.mjs';
import {STARLING_PERSONAS} from '../public/app/shared/starling-collective-v1.mjs';
import {starlingAvatarSeed,starlingNpcCommand,starlingRoster} from '../public/app/shared/worldweaver-starling-bridge-v1.mjs';

let n=0;
const model={kind:'model',principalId:'pilot:starling:kami',modelId:'qwen3.5:4b',personaRef:'starling:kami',verified:true};
const human={kind:'human',principalId:'human-1',verified:true};
const runtime={kind:'runtime',principalId:'trusted-renderer',verified:true};
const make=()=>createWorldweaver({id:()=>`rig-${++n}`,clock:()=> '2026-10-30T04:00:00Z',
  authorize:({actor,command})=>actor.verified===true&&(actor.kind==='human'
    ||actor.kind==='model'&&['rig-npc','propose-avatar','queue-actions'].includes(command.type)
    ||actor.kind==='runtime'&&['provisioned','apply-avatar','report-action'].includes(command.type))});
const plan={
  format:'procedural-2d',
  parts:[
    {id:'body',parent:null,shape:'ellipse',x:0,y:0,width:38,height:48,color:'#7b5bbe'},
    {id:'head',parent:'body',shape:'circle',x:0,y:-39,width:29,height:29,color:'#ffe0ab'},
    {id:'arm',parent:'body',shape:'capsule',x:29,y:-8,width:12,height:34,color:'#7b5bbe'}
  ],
  poses:[{name:'idle',rotations:{arm:0}},{name:'greet',rotations:{arm:-42}}],
  behaviors:[{on:'visitor-arrived',action:'pose',value:'greet'},{on:'visitor-arrived',action:'say',value:'Welcome to the workshop.'}]
};
const setup=()=>{
  const world=make();
  const instance=world.dispatch({type:'create',guide:'kamiya',title:'Active workshop'},human).instance;
  const npc=world.dispatch(starlingNpcCommand({personaId:'kami',instanceId:instance.id,
    modelId:model.modelId,pilotPrincipalId:model.principalId}),model).npc;
  return {world,instance,npc};
};
test('all eight Starling avatars are derived from the canonical persona registry, not a second roster',()=>{
  const roster=starlingRoster();
  assert.equal(roster.length,Object.keys(STARLING_PERSONAS).length);
  for(const row of roster){
    const p=STARLING_PERSONAS[row.personaId];
    assert.equal(row.name,p.name);
    assert.equal(row.referenceAsset,`/app/assets/starling/${p.id}.svg`);
    assert.equal(row.role,p.role);
    assert.equal(row.description.includes(p.role),true);
  }
  assert.throws(()=>starlingAvatarSeed('fake'),/Unknown Starling persona/);
  assert.equal(starlingAvatarSeed('kami').referenceAsset,'/app/assets/starling/kami.svg');
});
test('Starling NPC binds exact persona and image asset with original model identity',()=>{
  const {npc}=setup();
  assert.equal(npc.personaRef,'starling:kami');
  assert.equal(npc.appearanceRef,'/app/assets/starling/kami.svg');
  assert.equal(npc.modelId,model.modelId);
  assert.match(npc.pilotPrompt,/Catalytic Spirit/);
  assert.equal(npc.pilotPrincipalId,model.principalId);
});
test('vision requests contain actual raster image data and do not mistake an SVG URL for a model image',()=>{
  const seed=starlingAvatarSeed('kami');
  const png='data:image/png;base64,'+Buffer.from('sample small PNG bytes').toString('base64');
  const req=avatarVisualRequest(seed,{rasterImageDataUri:png,task:'Select an avatar body and propose a reversible rig.'});
  assert.equal(req.content[1].type,'image_url');
  assert.equal(req.content[1].image_url.url,png);
  assert.match(req.content[0].text,/image reference/);
  assert.equal(req.vision,true);
  const fallback=avatarVisualRequest(seed,{task:'Build an accessible avatar.'});
  assert.equal(fallback.vision,false);
  assert.equal(fallback.content.length,1);
  assert.match(fallback.content[0].text,/textual description/i);
  assert.throws(()=>avatarVisualRequest(seed,{rasterImageDataUri:'https://example.org/x.png'}),/image/i);
  assert.throws(()=>avatarVisualRequest(seed,{rasterImageDataUri:'data:image/svg+xml;base64,AAA'}),/raster/i);
});
test('model proposes own rig and bounded visual scripts; explicit review and runtime acknowledgement are required',()=>{
  const {world,npc}=setup();
  const proposed=world.dispatch({type:'propose-avatar',npcId:npc.id,plan},model).proposal;
  assert.equal(proposed.status,'pending-review');
  assert.equal(world.snapshot().npcs[0].avatarProposalId,null);
  assert.throws(()=>world.dispatch({type:'apply-avatar',proposalId:proposed.id,backendRef:'rig:abc'},runtime),/approved/i);
  assert.throws(()=>world.dispatch({type:'approve-avatar',proposalId:proposed.id},model),/Unauthorized|human/i);
  assert.equal(world.dispatch({type:'approve-avatar',proposalId:proposed.id},human).proposal.status,'approved');
  const applied=world.dispatch({type:'apply-avatar',proposalId:proposed.id,backendRef:'rig-abc'},runtime);
  assert.equal(applied.proposal.status,'applied');
  assert.equal(world.snapshot().npcs[0].avatarProposalId,proposed.id);
  assert.equal(world.snapshot().npcs[0].avatarBackendRef,'rig-abc');
  assert.equal(avatarEventSteps(proposed.plan,'visitor-arrived').length,2);
  assert.match(renderAvatarSvg(proposed.plan,{pose:'greet'}),/<svg/);
  assert.match(renderAvatarSvg(proposed.plan,{pose:'greet'}),/rotate\(-42/);
});
test('cannot rig other pilots, submit raw code, dangerous behavior, invalid hierarchy or huge geometry',()=>{
  const {world,npc}=setup();
  assert.throws(()=>world.dispatch({type:'propose-avatar',npcId:npc.id,plan},{...model,principalId:'other'}),/pilot|identity/i);
  assert.throws(()=>world.dispatch({type:'propose-avatar',npcId:npc.id,plan:{...plan,script:'osNpcCreate()'}},model),/Unsupported|field/i);
  assert.throws(()=>validateAvatarPlan({...plan,behaviors:[{on:'visitor-arrived',action:'http',value:'https://x'}]}),/behavior|action/i);
  assert.throws(()=>validateAvatarPlan({...plan,parts:[{...plan.parts[0],parent:'head'},plan.parts[1]]}),/hierarchy|parent|cycle/i);
  assert.throws(()=>validateAvatarPlan({...plan,parts:[{...plan.parts[0],width:100000}]}),/width|size|dimension/i);
  assert.throws(()=>validateAvatarPlan({...plan,poses:[{name:'idle',rotations:{arm:999}}]}),/rotation/i);
  assert.throws(()=>world.dispatch({type:'apply-avatar',proposalId:'not-found',backendRef:'forged'},runtime),/Unknown/i);
});
test('rig revision does not replace a working body before approval and world runtime response',()=>{
  const {world,npc}=setup();
  const p1=world.dispatch({type:'propose-avatar',npcId:npc.id,plan},model).proposal;
  world.dispatch({type:'approve-avatar',proposalId:p1.id},human);
  world.dispatch({type:'apply-avatar',proposalId:p1.id,backendRef:'rig-one'},runtime);
  const updated={...plan,parts:[{...plan.parts[0],color:'#ff0000'},...plan.parts.slice(1)]};
  const p2=world.dispatch({type:'propose-avatar',npcId:npc.id,plan:updated},model).proposal;
  assert.equal(world.snapshot().npcs[0].avatarProposalId,p1.id);
  assert.equal(world.snapshot().avatarProposals.find(x=>x.id===p2.id).status,'pending-review');
  world.dispatch({type:'reject-avatar',proposalId:p2.id,reason:'Needs revision'},human);
  assert.equal(world.snapshot().npcs[0].avatarProposalId,p1.id);
});
test('preview SVG escapes untrusted fields and cannot embed scripts',()=>{
  const unsafe={...plan,parts:[{...plan.parts[0],color:'red"; onload="alert(1)'},...plan.parts.slice(1)]};
  assert.throws(()=>validateAvatarPlan(unsafe),/color/i);
  const svg=renderAvatarSvg(plan);
  assert.doesNotMatch(svg,/<script|onload=|foreignObject/);
});

test('a model can self-design from actual image pixels through the selected vision-capable inference adapter',async()=>{
  const {world,npc}=setup();
  const raster='data:image/png;base64,'+Buffer.from('local raster image').toString('base64');
  let seen;
  const proposal=await proposeAvatarViaModel({
    world,npcId:npc.id,actor:model,seed:starlingAvatarSeed('kami'),
    visionCapable:true,rasterImageDataUri:raster,
    invokeModel:async request=>{
      seen=request;
      return {plan};
    }
  });
  assert.equal(seen.modelId,model.modelId);
  assert.equal(seen.messages[0].role,'user');
  assert.equal(seen.messages[0].content[1].image_url.url,raster);
  assert.equal(seen.responseFormat,'json');
  assert.equal(proposal.status,'pending-review');
  assert.equal(world.snapshot().avatarProposals.length,1);
});
test('non-vision models get honest text fallback, and failed generation preserves the last rig',async()=>{
  const {world,npc}=setup();
  let seen;
  await proposeAvatarViaModel({world,npcId:npc.id,actor:model,seed:starlingAvatarSeed('kami'),visionCapable:false,
    invokeModel:async request=>{seen=request;return JSON.stringify(plan)}});
  assert.equal(seen.messages[0].content.length,1);
  assert.equal(seen.vision,false);
  assert.equal(world.snapshot().avatarProposals.length,1);
  const before=JSON.stringify(world.snapshot());
  await assert.rejects(proposeAvatarViaModel({world,npcId:npc.id,actor:model,seed:starlingAvatarSeed('kami'),visionCapable:true,
    invokeModel:async()=>({plan})}),/raster image/i);
  assert.equal(JSON.stringify(world.snapshot()),before);
  await assert.rejects(proposeAvatarViaModel({world,npcId:npc.id,actor:model,seed:starlingAvatarSeed('kami'),visionCapable:false,
    invokeModel:async()=>({plan:{...plan,behaviors:[{on:'idle',action:'http',value:'https://example.org'}]}})}),/action/i);
  assert.equal(JSON.stringify(world.snapshot()),before);
});
test('a pilot cannot submit another persona\'s image as their own identity',async()=>{
  const {world,npc}=setup();
  await assert.rejects(proposeAvatarViaModel({world,npcId:npc.id,actor:model,seed:starlingAvatarSeed('aphra'),
    visionCapable:false,invokeModel:async()=>({plan})}),/persona/i);
  assert.equal(world.snapshot().avatarProposals.length,0);
});
