import test from 'node:test';
import assert from 'node:assert/strict';
import {createStarlingMeetingSpatialAudio} from '../public/app/shared/starling-meeting-spatial-audio-v1.mjs';

function fixture(){
  const calls=[];
  const media={play(){calls.push('play');return Promise.resolve()},pause(){calls.push('pause')},currentTime:10};
  const audioParam=()=>({setValueAtTime(v){calls.push(v)}});
  const listener=Object.fromEntries(['position','forward','up'].flatMap(p=>['X','Y','Z'].map(a=>[p+a,audioParam()])));
  const context={currentTime:0,listener,destination:{},
    createMediaElementSource(){return {connect(){},disconnect(){calls.push('source-disconnect')}}},
    createPanner(){return {positionX:audioParam(),positionY:audioParam(),positionZ:audioParam(),connect(){},disconnect(){calls.push('panner-disconnect')}}}
  };
  const player=createStarlingMeetingSpatialAudio({context,mediaForActor:id=>id==='moss'?media:null});
  const snapshot=(revision,grant='moss')=>({sessionId:'room-1',revision,roomStatus:'live',activeSpeakerId:grant,grantedSpeakerId:grant,
    participants:[{id:'moss',kind:'agent',connected:true,muted:false}]});
  return {player,calls,media,snapshot};
}

test('authorized speaker is positioned and revoked without another turn grant',()=>{
  const {player,calls,media,snapshot}=fixture();
  assert.equal(player.update(snapshot(1)),'moss');
  assert.equal(calls.filter(x=>x==='play').length,1);
  assert.equal(player.update(snapshot(1,null)),'moss'); // stale revision ignored
  assert.equal(player.update(snapshot(2,null)),null);
  assert.equal(media.currentTime,0);
  assert.equal(calls.filter(x=>x==='pause').length,1);
  player.dispose();
  assert.ok(calls.includes('source-disconnect'));
  assert.ok(calls.includes('panner-disconnect'));
});

test('session crossover fails closed and does not restart playback',()=>{
  const {player,calls,snapshot}=fixture();
  player.update(snapshot(1));
  player.update({...snapshot(2),sessionId:'other-room'});
  assert.equal(player.update(snapshot(3)),null);
  assert.equal(calls.filter(x=>x==='play').length,1);
  player.dispose();
});

test('listener positioning never starts playback',()=>{
  const {player,calls}=fixture();
  player.updateListener({position:{x:0,y:1.6,z:0}});
  assert.equal(calls.includes('play'),false);
  player.dispose();
});
