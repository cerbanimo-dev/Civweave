import test from 'node:test';
import assert from 'node:assert/strict';
import {createStarlingMeetingSpeechPlayback} from '../public/app/shared/starling-meeting-speech-playback-v1.mjs';

const state=(holder='agent',paused=false)=>({holder,paused,expiresAt:2000,participants:[{actorId:'agent',connected:true,muted:false}]});
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
test('plays only floor-authorized speech; rejects silent/expired/foreign speakers',async()=>{
  let time=1000;
  const played=[];
  const player={play:async chunk=>played.push(chunk),stop(){}};
  const playback=createStarlingMeetingSpeechPlayback({player,now:()=>time});
  assert.equal(playback.receive({type:'speech.chunk',actorId:'agent',text:'unsolicited'}),false);
  playback.receive({type:'meeting.welcome',state:state()});
  assert.equal(playback.receive({type:'speech.chunk',actorId:'other',text:'wrong speaker'}),false);
  assert.equal(playback.receive({type:'speech.chunk',actorId:'agent',text:'approved'}),true);
  await playback.whenIdle();
  assert.equal(played.length,1);
  time=2000;
  assert.equal(playback.receive({type:'speech.chunk',actorId:'agent',text:'expired'}),false);
});
test('floor revocation interrupts pending playback and rejects queued speech',async()=>{
  const played=[],signals=[],stops=[];
  const player={play:({text,signal})=>new Promise(resolve=>{
    played.push(text);signals.push(signal);
    signal.addEventListener('abort',resolve,{once:true});
  }),stop:()=>stops.push('stop')};
  const playback=createStarlingMeetingSpeechPlayback({player,now:()=>1000});
  playback.receive({type:'meeting.welcome',state:state()});
  playback.receive({type:'speech.chunk',actorId:'agent',text:'first'});
  await flush();
  playback.receive({type:'speech.chunk',actorId:'agent',text:'queued'});
  playback.receive({type:'speech.stop',reason:'floor-revoked'});
  playback.receive({type:'meeting.state',state:state(null)});
  await playback.whenIdle();
  assert.deepEqual(played,['first']);
  assert.equal(signals[0].aborted,true);
  assert.ok(stops.length>=1);
  assert.equal(playback.receive({type:'speech.chunk',actorId:'agent',text:'late'}),false);
});
test('disconnect stops speech, and never reopens without a fresh player',async()=>{
  let stopped=0;
  const playback=createStarlingMeetingSpeechPlayback({player:{play:async()=>{},stop:()=>stopped++},now:()=>1000});
  playback.receive({type:'meeting.welcome',state:state()});
  playback.disconnect();
  playback.receive({type:'meeting.state',state:state()});
  assert.equal(playback.receive({type:'speech.chunk',actorId:'agent',text:'replay'}),false);
  assert.ok(stopped>=1);
});
