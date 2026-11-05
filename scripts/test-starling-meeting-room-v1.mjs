import test from 'node:test';
import assert from 'node:assert/strict';
import { projectMeetingRoom, projectAvatarState, positionParticipants } from '../public/app/shared/starling-meeting-room-v1.mjs';

test('only authorized speaking events produce a speaking avatar', () => {
  const people = [{ id: 'host', kind: 'human' }, { id: 'moss', kind: 'agent' }, { id: 'rook', kind: 'agent' }];
  const room = projectMeetingRoom({ participants: people, activeSpeakerId: 'moss', grantedSpeakerId: 'moss', roomStatus: 'live' });
  assert.equal(room.avatars.find(a => a.id === 'moss').state, 'speaking');
  assert.equal(room.avatars.find(a => a.id === 'rook').state, 'listening');
  assert.equal(room.avatars.filter(a => a.state === 'speaking').length, 1);
  const denied = projectMeetingRoom({ participants: people, activeSpeakerId: 'rook', grantedSpeakerId: 'moss', roomStatus: 'live' });
  assert.equal(denied.avatars.filter(a => a.state === 'speaking').length, 0);
});

test('incoming model text never grants permission to speak', () => {
  assert.equal(projectAvatarState({id:'moss',kind:'agent',hasModelOutput:true}, {activeSpeakerId:null, grantedSpeakerId:null, roomStatus:'live'}), 'listening');
});

test('mute, disconnection, closed room and revoked grants fail silent', () => {
  for (const participant of [{id:'a',muted:true}, {id:'a',connected:false}, {id:'a',canSpeak:false}]) {
    assert.notEqual(projectAvatarState(participant,{activeSpeakerId:'a',grantedSpeakerId:'a',roomStatus:'live'}), 'speaking');
  }
  assert.notEqual(projectAvatarState({id:'a'},{activeSpeakerId:'a',grantedSpeakerId:'a',roomStatus:'ended'}), 'speaking');
});

test('requesting a turn does not become speaking', () => {
  assert.equal(projectAvatarState({id:'a',handRaised:true},{activeSpeakerId:null,grantedSpeakerId:null,roomStatus:'live'}),'requesting_turn');
});

test('bounded deterministic seating, including invalid and repeated participants', () => {
  const seats=positionParticipants([{id:'a'}, {id:'b'}, {id:'a'}, {id:''}, ...Array.from({length:50},(_,i)=>({id:'p'+i}))]);
  assert.equal(seats.length, 16);
  assert.equal(new Set(seats.map(s=>s.id)).size,16);
  for (const seat of seats) assert.ok(Number.isFinite(seat.position.x) && Number.isFinite(seat.position.z));
});

test('same session events yield deterministic view and do not mutate input', () => {
  const people=[{id:'host',displayName:'Cami',kind:'human'}];
  const snapshot=JSON.stringify(people);
  const a=projectMeetingRoom({participants:people,roomStatus:'live'});
  assert.deepEqual(a,projectMeetingRoom({participants:people,roomStatus:'live'}));
  assert.equal(JSON.stringify(people),snapshot);
  assert.equal(a.avatars[0].displayName,'Cami');
});
