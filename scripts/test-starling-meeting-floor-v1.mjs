import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeetingFloor,MEETING_EVENT_SCHEMA} from '../public/app/shared/starling-meeting-floor-v1.mjs';

test('four agents remain silent until explicitly unmuted and granted',()=>{
  let tick=1000;
  const floor=createMeetingFloor({sessionId:'meeting1',hostId:'host',now:()=>tick});
  for(const a of ['a','b','c','d'])floor.join(a);
  for(const a of ['a','b','c','d']){assert.equal(floor.canSpeak(a),false);assert.equal(floor.acceptModelResult(a,'Hello').visibility,'private');}
  assert.equal(floor.snapshot().holder,null);
  floor.requestFloor('a');
  assert.throws(()=>floor.grantFloor('a','a'),/Host permission/);
  assert.throws(()=>floor.grantFloor('host','a'),/muted/);
  floor.setMuted('host','a',false);
  floor.grantFloor('host','a');
  assert.equal(floor.canSpeak('a'),true);
  for(const a of ['b','c','d'])assert.equal(floor.canSpeak(a),false);
  assert.throws(()=>floor.grantFloor('host','b'),/muted/);
  floor.setMuted('host','b',false);
  assert.throws(()=>floor.grantFloor('host','b'),/occupied/);
  floor.completeSpeech('a');
  assert.equal(floor.canSpeak('a'),false);
  floor.grantFloor('host','b');
  assert.equal(floor.canSpeak('b'),true);
  floor.setPaused('host',true);
  assert.equal(floor.canSpeak('b'),false);
  assert.equal(floor.snapshot().holder,null);
  assert.throws(()=>floor.grantFloor('host','b'),/paused/);
  assert.ok(floor.eventsSince(0).every(e=>e.schema===MEETING_EVENT_SCHEMA));
});
test('lease expiration, disconnect and rejoin fail closed',()=>{
  let tick=1000;
  const floor=createMeetingFloor({sessionId:'meeting2',hostId:'host',now:()=>tick,leaseMs:1000});
  floor.join('a');floor.setMuted('host','a',false);floor.grantFloor('host','a');
  tick+=1000;assert.equal(floor.canSpeak('a'),false);
  floor.grantFloor('host','a');floor.disconnect('a');assert.equal(floor.canSpeak('a'),false);
  floor.join('a');assert.equal(floor.snapshot().participants.find(p=>p.actorId==='a').muted,true);
  assert.throws(()=>floor.grantFloor('host','a'),/muted/);
});
test('host interruption revokes speaking floor and drops pending requests',()=>{
  const floor=createMeetingFloor({sessionId:'meeting3',hostId:'host'});
  floor.join('a');floor.join('b');
  floor.setMuted('host','a',false);floor.grantFloor('host','a');
  floor.requestFloor('b');floor.setMuted('host','a',true);
  assert.equal(floor.canSpeak('a'),false);
  floor.setPaused('host',true);assert.deepEqual(floor.snapshot().queue,[]);
  assert.throws(()=>floor.assertSpeech('a'),/permission/);
  assert.throws(()=>floor.setPaused('b',false),/Host permission/);
});
