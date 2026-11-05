import {createMeetingAudioPresenter} from './starling-meeting-audio-v1.mjs';
import {projectMeetingRoom} from './starling-meeting-room-v1.mjs';

/**
 * Positional presentation for already-authorized meeting media.
 * Media elements MUST be provisioned by the authenticated meeting transport.
 * This module neither captures a microphone nor grants a turn or calls a model.
 * Host must supply verified monotonically revisioned session snapshots.
 */
export function createStarlingMeetingSpatialAudio({context,mediaForActor}={}){
  if(!context || typeof context.createMediaElementSource!=='function' || typeof context.createPanner!=='function' ||
      typeof mediaForActor!=='function') throw new TypeError('Web Audio context and mediaForActor callback required');
  const nodes=new Map();
  let disposed=false;
  function coordinates(panner,position){
    const {x=0,y=0,z=0}=position||{};
    for(const [axis,value] of Object.entries({x,y,z})){
      const safe=Number.isFinite(value)?Math.max(-100,Math.min(100,value)):0;
      const param=panner['position'+axis.toUpperCase()];
      if(param && typeof param.setValueAtTime==='function')param.setValueAtTime(safe,context.currentTime||0);
      else if(typeof panner.setPosition==='function')panner.setPosition(
        axis==='x'?safe:(panner._x||0),axis==='y'?safe:(panner._y||0),axis==='z'?safe:(panner._z||0));
      panner['_'+axis]=safe;
    }
  }
  function getNode(id){
    if(nodes.has(id))return nodes.get(id);
    const media=mediaForActor(id);
    if(!media || typeof media.play!=='function'||typeof media.pause!=='function')return null;
    const source=context.createMediaElementSource(media);
    const panner=context.createPanner();
    panner.panningModel='HRTF';
    panner.distanceModel='inverse';
    panner.refDistance=1;
    panner.maxDistance=20;
    panner.rolloffFactor=1;
    source.connect(panner);
    panner.connect(context.destination);
    const node={media,source,panner};
    nodes.set(id,node);
    return node;
  }
  function silence(id){
    const node=nodes.get(id);
    if(node){node.media.pause();try{node.media.currentTime=0}catch{}}
  }
  const gate=createMeetingAudioPresenter({
    start(id){
      const node=getNode(id);
      if(!node)throw new Error('No authorized media element');
      const result=node.media.play();
      if(result && typeof result.catch==='function')result.catch(()=>silence(id));
    },
    stop:silence
  });
  function update(snapshot){
    if(disposed)return null;
    // The shared presenter checks session identity, revision and speaker state.
    // Coordinates are display-only and cannot enable media independently.
    const active=gate.update(snapshot);
    if(active!==null){
      const avatar=projectMeetingRoom(snapshot).avatars.find(a=>a.id===active);
      const node=nodes.get(active);
      if(avatar&&node)coordinates(node.panner,avatar.position);
    }
    return active;
  }
  function updateListener({position={x:0,y:1.6,z:0},forward={x:0,y:0,z:-1},up={x:0,y:1,z:0}}={}){
    if(disposed)return;
    const listener=context.listener;
    if(!listener)return;
    const write=(prefix,vector)=>{
      for(const axis of ['x','y','z']){
        const param=listener[prefix+axis.toUpperCase()];
        const n=Number.isFinite(vector[axis])?vector[axis]:0;
        if(param?.setValueAtTime)param.setValueAtTime(n,context.currentTime||0);
      }
    };
    write('position',position);
    write('forward',forward);
    write('up',up);
    if(typeof listener.setPosition==='function'&&!listener.positionX)
      listener.setPosition(position.x,position.y,position.z);
    if(typeof listener.setOrientation==='function'&&!listener.forwardX)
      listener.setOrientation(forward.x,forward.y,forward.z,up.x,up.y,up.z);
  }
  function dispose(){
    if(disposed)return;
    disposed=true;
    gate.dispose();
    for(const {media,source,panner} of nodes.values()){
      media.pause();
      try{source.disconnect()}catch{}
      try{panner.disconnect()}catch{}
    }
    nodes.clear();
  }
  return Object.freeze({update,updateListener,dispose});
}
