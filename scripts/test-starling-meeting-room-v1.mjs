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

test('browser room lab stays optional and maintains semantic fallback controls', async () => {
  const {readFileSync}=await import('node:fs');
  const html=readFileSync(new URL('../public/app/tools/starling-meeting-room-lab.html', import.meta.url),'utf8');
  const js=readFileSync(new URL('../public/app/tools/starling-meeting-room-lab.mjs', import.meta.url),'utf8');
  const css=readFileSync(new URL('../public/app/tools/starling-meeting-room-lab.css', import.meta.url),'utf8');
  assert.match(html,/id="participant-list"/);
  assert.match(html,/id="room-status"/);
  assert.match(html,/id="three-d-toggle"/);
  assert.match(html,/id="rotate-left"/);
  assert.match(html,/id="zoom-in"/);
  assert.match(html,/type="module" src="\.\/starling-meeting-room-lab\.mjs"/);
  assert.match(js,/projectMeetingRoom/);
  assert.match(js,/replaceChildren/);
  assert.match(js,/addEventListener/);
  assert.doesNotMatch(js,/fetch\(|WebSocket|setInterval|requestAnimationFrame|speechSynthesis|AudioContext/);
  assert.match(css,/perspective:/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
});


test('room media presenter stops playing on grant revocation and speaker replacement', async () => {
  const {createMeetingAudioPresenter}=await import('../public/app/shared/starling-meeting-audio-v1.mjs');
  const calls=[];
  const presenter=createMeetingAudioPresenter({start:(id)=>calls.push('start:'+id),stop:(id)=>calls.push('stop:'+id)});
  const people=[{id:'moss'},{id:'rook'}];
  presenter.update({participants:people,roomStatus:'live',activeSpeakerId:'moss',grantedSpeakerId:'moss',sessionId:'a',revision:1});
  presenter.update({participants:people,roomStatus:'live',activeSpeakerId:'rook',grantedSpeakerId:'rook',sessionId:'a',revision:2});
  presenter.update({participants:people,roomStatus:'live',activeSpeakerId:null,grantedSpeakerId:null,sessionId:'a',revision:3});
  assert.deepEqual(calls,['start:moss','stop:moss','start:rook','stop:rook']);
  presenter.dispose();
});

test('room media presenter refuses stale snapshots and stale session crossovers', async () => {
  const {createMeetingAudioPresenter}=await import('../public/app/shared/starling-meeting-audio-v1.mjs');
  const calls=[];
  const presenter=createMeetingAudioPresenter({start:id=>calls.push('start:'+id),stop:id=>calls.push('stop:'+id)});
  const people=[{id:'moss'}];
  const live={participants:people,roomStatus:'live',activeSpeakerId:'moss',grantedSpeakerId:'moss'};
  presenter.update({...live,sessionId:'guild-a',revision:3});
  presenter.update({...live,sessionId:'guild-a',revision:2,activeSpeakerId:null});
  assert.deepEqual(calls,['start:moss']);
  presenter.update({participants:people,roomStatus:'idle',sessionId:'guild-b',revision:1});
  assert.deepEqual(calls,['start:moss','stop:moss']);
  presenter.update({...live,sessionId:'guild-a',revision:9});
  assert.deepEqual(calls,['start:moss','stop:moss']);
});

test('room media presenter fails silent for invalid grants, errors, and disposal', async () => {
  const {createMeetingAudioPresenter}=await import('../public/app/shared/starling-meeting-audio-v1.mjs');
  const calls=[];
  const presenter=createMeetingAudioPresenter({
    start:id=>{calls.push('start:'+id);throw Error('autoplay denied')},
    stop:id=>calls.push('stop:'+id)
  });
  const live={participants:[{id:'moss'}],roomStatus:'live',activeSpeakerId:'moss',grantedSpeakerId:'moss',sessionId:'test',revision:1};
  assert.equal(presenter.update(live),null);
  assert.deepEqual(calls,['start:moss','stop:moss']);
  presenter.dispose();
  assert.equal(presenter.update({...live,revision:2}),null);
});

test('duplicate participant IDs preserve first identity and cannot overwrite mute state', () => {
  const room=projectMeetingRoom({
    roomStatus:'live',activeSpeakerId:'moss',grantedSpeakerId:'moss',
    participants:[{id:'moss',displayName:'Original',muted:true},{id:'moss',displayName:'Spoof',muted:false}]
  });
  assert.equal(room.avatars.length,1);
  assert.equal(room.avatars[0].displayName,'Original');
  assert.equal(room.avatars[0].audioEnabled,false);
});


test('host voice preview uses existing canonical capture and never opens a second microphone', async()=>{
  const {readFileSync}=await import('node:fs');
  const html=readFileSync(new URL('../public/app/tools/starling-meeting-room-lab.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../public/app/tools/starling-meeting-room-lab.mjs',import.meta.url),'utf8');
  for(const id of ['start-mic','stop-mic','mic-status','live-captions','speech-activity'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/src="\.\.\/guide-voice-runtime-v1\.js"/);
  assert.match(js,/CivweaveGuideVoiceV1/);
  assert.match(js,/routeToChat:false/);
  assert.match(js,/civweave:guide-voice-transcript/);
  assert.match(js,/pagehide/);
  assert.doesNotMatch(js,/getUserMedia|MediaRecorder|new AudioContext|WebSocket|fetch\(/);
});
