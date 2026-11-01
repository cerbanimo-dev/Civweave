import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSummonItem,normalizeDropPosition,normalizeSummonCommand,createWorldweaverSummons} from '../public/app/shared/worldweaver-summon-v1.mjs';
import {HAND_SURFACE_ANCHORS,recognizeHandGesture,createHandGestureInterpreter} from '../public/app/shared/worldweaver-hand-gestures-v1.mjs';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {decodeWorldCall,WORLD_CALL_SCHEMA} from '../public/app/shared/worldweaver-pm-calls-v1.mjs';

const person={kind:'person',id:'guild:hero-1',title:'A consenting Guild member'};
const actor={kind:'actor',id:'starling:kami',title:'Kami'};
const drop={u:.25,v:.75};
test('all summon entities use one bounded, canonical placement contract',()=>{
 for(const kind of ['experience','object','actor','npc','person']){
  const cmd=normalizeSummonCommand({item:{...actor,kind},worldRef:'world:commons',position:drop});
  assert.equal(cmd.type,kind==='person'?'world.invite_person':'world.summon');
  assert.deepEqual(cmd.position,drop);
 }
 assert.throws(()=>normalizeSummonCommand({item:person,worldRef:'world:commons',position:{u:5,v:0}}),/normalized/);
 assert.throws(()=>normalizeSummonItem({...person,avatarAsset:'https://evil.test/icon.svg'}),/trusted/);
 assert.throws(()=>normalizeSummonItem({...person,unknown:true}),/unsupported/);
 assert.throws(()=>normalizeSummonItem({...person,id:'../../escape'}),/canonical/);
 assert.deepEqual(normalizeDropPosition(50,75,{left:0,top:0,width:100,height:100}),{u:.5,v:.75});
});
test('a disconnected backend never implies a real placement or human call',async()=>{
 const service=createWorldweaverSummons();
 await assert.rejects(()=>service.submit({item:person,worldRef:'world:commons',position:drop}),/not connected/);
 await assert.rejects(()=>service.submit({item:actor,worldRef:'world:commons',position:drop}),/not connected/);
 assert.equal(service.listCalls().length,0);service.close();
});
test('world receipts must be real placements or queued commands',async()=>{
 const service=createWorldweaverSummons({transport:{place:async()=>({status:'placed',instanceId:'object:123'})}});
 const result=await service.submit({item:actor,worldRef:'world:commons',position:drop});
 assert.equal(result.status,'placed');assert.equal(result.instanceId,'object:123');service.close();
 const forged=createWorldweaverSummons({transport:{place:async()=>({status:'placed'})}});
 await assert.rejects(()=>forged.submit({item:actor,worldRef:'world:commons',position:drop}),/instance ID/);
 forged.close();
});
test('human invitation only changes state from authenticated transport events',async()=>{
 let acceptEvent=()=>{};
 const service=createWorldweaverSummons({transport:{
  invite:async()=>({invitationId:'call:123',status:'ringing'}),
  subscribeInvitations(fn){acceptEvent=fn;return ()=>{acceptEvent=()=>{}}}
 }});
 const first=await service.submit({item:person,worldRef:'world:commons',position:drop});
 assert.equal(first.type,'invitation');assert.equal(service.listCalls()[0].status,'ringing');
 assert.equal(typeof service.accept,'undefined');
 acceptEvent({invitationId:'wrong',status:'declined',recipientConfiguredResponse:'Oops'});assert.equal(service.listCalls()[0].status,'ringing');
 acceptEvent({invitationId:'call:123',status:'joined'});assert.equal(service.listCalls()[0].status,'ringing');
 acceptEvent({invitationId:'call:123',status:'declined',recipientConfiguredResponse:'Finishing a quest right now!'});
 assert.equal(service.listCalls()[0].status,'declined');
 assert.equal(service.listCalls()[0].response,'Finishing a quest right now!');
 acceptEvent({invitationId:'call:123',status:'accepted'});assert.equal(service.listCalls()[0].status,'declined');
 service.close();
});
test('accepted call is not joined until actual session handoff',async()=>{
 let event=()=>{};
 const service=createWorldweaverSummons({transport:{
  invite:async()=>({invitationId:'call:456',status:'requested'}),
  subscribeInvitations(fn){event=fn}
 }});
 await service.submit({item:person,worldRef:'world:commons',position:drop});
 event({invitationId:'call:456',status:'ringing'});
 event({invitationId:'call:456',status:'accepted'});
 assert.equal(service.listCalls()[0].status,'accepted');
 event({invitationId:'call:456',status:'joined'});
 assert.equal(service.listCalls()[0].status,'joined');
 service.close();
});
const tip=(x,y)=>({x,y,z:0});
const convergence=()=>({palmWidth:1,fingers:{
 thumb:{tip:tip(0,0),curl:.5},
 index:{tip:tip(.10,0),curl:.5},middle:{tip:tip(0,.08),curl:.5},
 ring:{tip:tip(-.08,0),curl:.5},pinky:{tip:tip(0,-.09),curl:.5}
}});
const phone=()=>({palmWidth:1,fingers:{
 thumb:{tip:tip(-1,0),curl:.1},
 index:{tip:tip(0,0),curl:.95},middle:{tip:tip(0,.1),curl:.95},
 ring:{tip:tip(0,.2),curl:.95},pinky:{tip:tip(1,.1),curl:.05}
}});
test('five-point convergence and telephone sign remain distinct',()=>{
 assert.equal(recognizeHandGesture(convergence()),'five_point_convergence');
 assert.equal(recognizeHandGesture(phone()),'telephone_sign');
 assert.equal(recognizeHandGesture(null),null);
 assert.equal(HAND_SURFACE_ANCHORS.left.topLeft,'index.tip');
 assert.equal(HAND_SURFACE_ANCHORS.right.topLeft,'pinky.tip');
});
test('telephone sign summons phone into opposite hand only after stable hold',()=>{
 const g=createHandGestureInterpreter({activationFrames:3,releaseFrames:2});
 assert.equal(g.update('left',phone()),null);assert.equal(g.update('left',phone()),null);
 assert.deepEqual(g.update('left',phone()),{type:'civweave.phone.summon',sourceHand:'left',destinationHand:'right',screen:'civweave.core.home'});
 assert.equal(g.update('left',phone()),null);
 g.update('left',null);g.update('left',null);
 assert.equal(g.update('right',convergence()),null);assert.equal(g.update('right',convergence()),null);
 assert.deepEqual(g.update('right',convergence()),{type:'civweave.menu.toggle',sourceHand:'right'});
 g.reset();
});

test('signed Worldweaver persists a placement request but never claims a simulator spawn',()=>{
 let n=0;
 const founder={kind:'human',principalId:'founder:test'};
 const runtime={kind:'runtime',principalId:'renderer:test'};
 const world=createWorldweaver({id:()=>`entity-${++n}`,
   authorize:({actor})=>actor===founder||actor===runtime});
 const room=world.dispatch({type:'create',guide:'moss',title:'Test Guild room',guildId:'guild:test',scope:'guild-map'},founder).instance;
 world.dispatch({type:'request-provision',instanceId:room.id},founder);
 world.dispatch({type:'provisioned',instanceId:room.id,backend:'local-renderer',worldRef:room.id},runtime);
 const receipt=world.dispatch({type:'place-entity',instanceId:room.id,entityKind:'actor',
   entityRef:'starling:kami',position:{u:.25,v:.75}},founder);
 assert.equal(receipt.placement.status,'pending-simulator');
 assert.equal(world.snapshot().placements.length,1);
 assert.equal(world.snapshot().placements[0].entityRef,'starling:kami');
 assert.throws(()=>world.dispatch({type:'place-entity',instanceId:room.id,
   entityKind:'person',entityRef:'pm:river',position:drop},founder),/Unsupported/);
 assert.throws(()=>world.dispatch({type:'place-entity',instanceId:room.id,
   entityKind:'actor',entityRef:'starling:kami',position:{u:99,v:1}},founder),/normalized/);
});
test('encrypted world call decoder distinguishes invite, response and invalid envelopes',()=>{
 const base={schema:WORLD_CALL_SCHEMA,invitationId:'call:123',from:'hero.one',to:'hero.two'};
 const invite={...base,kind:'invite',worldRef:'world:commons',
   position:{u:.5,v:.5},expiresAt:new Date(Date.now()+600000).toISOString()};
 const response={...base,kind:'response',status:'declined',response:'Busy in a Quest'};
 assert.equal(decodeWorldCall('cw-world-call1:'+JSON.stringify(invite)).worldRef,'world:commons');
 assert.equal(decodeWorldCall('cw-world-call1:'+JSON.stringify(response)).status,'declined');
 assert.equal(decodeWorldCall('cw-world-call1:'+JSON.stringify({...response,status:'joined'})),null);
 assert.equal(decodeWorldCall('not a call'),null);
});
