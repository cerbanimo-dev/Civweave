import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeetingSessionGateway} from '../public/app/shared/starling-meeting-session-gateway-v1.mjs';

const create=()=>{
  let clock=1000;
  const identities=new Map([
    ['host',{actorId:'host',role:'host',sessionId:'s1',connectionId:'h1'}],
    ...['a','b','c','d'].map(x=>[x,{actorId:x,role:'agent',sessionId:'s1',connectionId:x+'1'}]),
    ['outsider',{actorId:'outsider',role:'agent',sessionId:'other',connectionId:'o1'}]
  ]);
  const gateway=createMeetingSessionGateway({authenticate:async({token})=>identities.get(token),now:()=>clock,leaseMs:1000});
  const send=(token,action,payload={})=>gateway.dispatch({token,sessionId:'s1',action,payload});
  return {gateway,send,identities,advance:n=>clock+=n};
};
test('identity is server verified; unjoined and cross-session clients denied',async()=>{
  const {send}=create();
  assert.equal((await send('a','join')).code,'not_found');
  assert.equal((await send('host','join')).ok,true);
  assert.equal((await send('outsider','join')).code,'unauthorized');
  assert.equal((await send('missing','host.pause')).code,'unauthorized');
  assert.equal((await send('a','floor.request')).code,'not_joined');
  assert.equal((await send('a','join',{actorId:'host',role:'host'})).ok,true);
  assert.equal((await send('a','host.pause')).ok,false);
});
test('4 agents are mute-by-default; speech needs floor and host grants',async()=>{
  const {send}=create();
  await send('host','join');
  for(const actor of ['a','b','c','d'])assert.equal((await send(actor,'join')).ok,true);
  for(const actor of ['a','b','c','d']){
    assert.equal((await send(actor,'speech.chunk',{text:'hello'})).ok,false);
    const draft=await send(actor,'model.ready',{text:'unspoken draft'});
    assert.equal(draft.result.visibility,'private');
    assert.equal(draft.result.requiresFloor,true);
  }
  assert.equal((await send('a','floor.grant',{targetId:'a'})).ok,false);
  assert.equal((await send('host','floor.grant',{targetId:'a'})).ok,false);
  assert.equal((await send('host','host.unmute',{targetId:'a'})).ok,true);
  assert.equal((await send('host','floor.grant',{targetId:'a'})).ok,true);
  assert.equal((await send('a','speech.chunk',{text:'allowed'})).ok,true);
  assert.equal((await send('b','speech.chunk',{text:'not allowed'})).ok,false);
  assert.equal((await send('a','speech.end')).ok,true);
  assert.equal((await send('a','speech.chunk',{text:'late packet'})).ok,false);
});
test('host interruption, expired grant and reconnect block stale speech',async()=>{
  const {send,identities,advance}=create();
  await send('host','join');await send('a','join');
  await send('host','host.unmute',{targetId:'a'});
  await send('host','floor.grant',{targetId:'a'});
  await send('host','host.pause');
  assert.equal((await send('a','speech.chunk',{text:'late'})).ok,false);
  await send('host','host.resume');
  await send('host','floor.grant',{targetId:'a'});
  advance(1001);
  assert.equal((await send('a','speech.chunk',{text:'expired'})).ok,false);
  await send('a','leave');
  identities.set('a',{actorId:'a',role:'agent',sessionId:'s1',connectionId:'a2'});
  assert.equal((await send('a','join')).state.participants.find(p=>p.actorId==='a').muted,true);
  assert.equal((await send('a','speech.chunk',{text:'after reconnect'})).ok,false);
  identities.set('a',{actorId:'a',role:'agent',sessionId:'s1',connectionId:'a1'});
  assert.equal((await send('a','snapshot')).code,'stale_connection');
});
test('event sequence replay is ordered and no global broadcast of drafts',async()=>{
  const {send}=create();await send('host','join');await send('a','join');
  await send('a','model.ready',{text:'secret draft'});
  const events=await send('host','events',{afterSeq:0});
  assert.equal(events.ok,true);
  assert.equal(events.result.length,1);
  assert.equal(events.result[0].type,'session.joined');
  assert.ok(!JSON.stringify(events).includes('secret draft'));
});
