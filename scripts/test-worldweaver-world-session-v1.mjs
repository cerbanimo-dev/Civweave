import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldSession} from '../public/app/shared/worldweaver-world-session-v1.mjs';
const setup=(initialEvents=[])=>{
 const events=[],actors={alice:{principalId:'human:alice'},bob:{principalId:'human:bob'}};
 const options={guildId:'guild:one',authorize:async({actor})=>Object.values(actors).includes(actor),append:async e=>{events.push(e)},clock:()=>42,initialEvents};
 return {session:createWorldSession(options),events,actors,options};
};
test('joins Threshold and crosses only connected portals',async()=>{
 const {session,actors}=setup();
 await session.dispatch({type:'join'},actors.alice);
 assert.equal(session.snapshot().participants[0].roomId,'starling-commons');
 await assert.rejects(session.dispatch({type:'move',roomId:'anarchadia-forum'},actors.alice),/Portal/);
 await session.dispatch({type:'move',roomId:'living-school'},actors.alice);
 await session.dispatch({type:'move',roomId:'anarchadia-forum'},actors.alice);
 assert.equal(session.snapshot().revision,3);
 assert.deepEqual(session.delta(1).events.map(e=>e.type),['move','move']);
});
test('authorizes identity, rejects cross-Guild replay and impersonation fields',async()=>{
 const {session,actors}=setup();
 await assert.rejects(session.dispatch({type:'join'},{principalId:'evil'}),/denied/);
 await assert.rejects(session.dispatch({type:'join',principalId:'human:bob'},actors.alice),/Unsupported/);
 await session.dispatch({type:'join'},actors.alice);
 const events=session.delta(0).events;
 assert.throws(()=>setup([{...events[0],guildId:'guild:other'}]),/cross-Guild/);
});
test('failed persistence does not advance revision',async()=>{
 const session=createWorldSession({guildId:'guild:one',authorize:()=>true,append:async()=>{throw Error('disk offline')},clock:()=>42});
 await assert.rejects(session.dispatch({type:'join'},{principalId:'human:alice'}),/disk offline/);
 assert.equal(session.snapshot().revision,0);
});
test('serialization prevents concurrent writes from duplicating revisions',async()=>{
 const {session,actors,events}=setup();
 await Promise.all([session.dispatch({type:'join'},actors.alice),session.dispatch({type:'join'},actors.bob)]);
 assert.deepEqual(events.map(e=>e.revision),[1,2]);
 const restored=setup(events).session;
 assert.deepEqual(restored.snapshot(),session.snapshot());
});
test('expired reconnect cursor resyncs; replay is contiguous',async()=>{
 const {actors}=setup();
 const s=createWorldSession({guildId:'guild:one',authorize:()=>true,append:async()=>{},clock:()=>42,historyLimit:1});
 await s.dispatch({type:'join'},actors.alice);
 await s.dispatch({type:'move',roomId:'living-school'},actors.alice);
 assert.equal(s.delta(0).resync,true);
 assert.equal(s.delta(1).resync,false);
 assert.equal(s.delta(1).events[0].revision,2);
});
