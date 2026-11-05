/**
 * Starling Collective live meeting floor control (pure, transport-agnostic).
 * Only the host grants the floor; model output is never itself speech permission.
 * This is an in-memory coordinator. Transport MUST authenticate actor roles,
 * enforce host-only operations server-side and distribute state to clients.
 */
export const MEETING_EVENT_SCHEMA='civweave.starling-meeting-event.v1';
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9:_-]{1,120}$/.test(v)?v:null;
export function createMeetingFloor({sessionId,hostId,now=()=>Date.now(),leaseMs=30000}={}){
  if(!id(sessionId)||!id(hostId))throw new TypeError('Valid session and host IDs required');
  if(!Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>120000)throw new RangeError('leaseMs must be 1000–120000');
  const participants=new Map([[hostId,{role:'host',connected:true,muted:false}]]);
  const queue=[],events=[];
  let holder=null,expiresAt=0,paused=false,sequence=0;
  const emit=(type,actorId,payload={})=>{
    const event=Object.freeze({schema:MEETING_EVENT_SCHEMA,event_id:sessionId+':'+(++sequence),session_id:sessionId,seq:sequence,
      timestamp:new Date(now()).toISOString(),actor_id:actorId,type,payload:Object.freeze({...payload}),visibility:'session'});
    events.push(event);return event;
  };
  const validActor=actorId=>{if(!id(actorId)||!participants.get(actorId)?.connected)throw new Error('Participant is not connected');};
  const requireHost=actorId=>{validActor(actorId);if(actorId!==hostId)throw new Error('Host permission required');};
  const dropQueue=actorId=>{for(let i=queue.length-1;i>=0;i--)if(queue[i]===actorId)queue.splice(i,1);};
  const revoke=(actorId,reason)=>{if(holder===null)return false;const previous=holder;holder=null;expiresAt=0;emit('floor.revoked',actorId,{previous,reason});return true;};
  const expire=()=>{if(holder!==null&&now()>=expiresAt)revoke(hostId,'lease-expired');};
  const snapshot=()=>{expire();return Object.freeze({sessionId,hostId,paused,holder,expiresAt,queue:Object.freeze([...queue]),
    participants:Object.freeze([...participants].map(([actorId,p])=>Object.freeze({actorId,...p}))),seq:sequence});};
  const api={
    join(actorId,{role='agent'}={}){
      if(!id(actorId)||!['agent','human'].includes(role)||actorId===hostId)throw new TypeError('Invalid participant');
      if(participants.has(actorId)&&participants.get(actorId).connected)throw new Error('Already connected');
      participants.set(actorId,{role,connected:true,muted:true});dropQueue(actorId);emit('session.joined',actorId,{role,muted:true});return snapshot();
    },
    disconnect(actorId){
      validActor(actorId);if(actorId===hostId){paused=true;revoke(hostId,'host-disconnected');queue.length=0;}
      if(holder===actorId)revoke(hostId,'participant-disconnected');
      dropQueue(actorId);participants.get(actorId).connected=false;participants.get(actorId).muted=true;
      emit('session.left',actorId);return snapshot();
    },
    requestFloor(actorId){validActor(actorId);expire();if(actorId===hostId)throw new Error('Host uses grantFloor');
      if(!queue.includes(actorId)&&holder!==actorId)queue.push(actorId);
      emit('floor.requested',actorId);return snapshot();},
    grantFloor(hostActorId,targetId){
      requireHost(hostActorId);validActor(targetId);expire();
      if(paused)throw new Error('Meeting is paused');
      if(participants.get(targetId).muted)throw new Error('Participant is muted');
      if(holder!==null&&holder!==targetId)throw new Error('Speaking floor is occupied');
      if(holder===targetId)return snapshot();
      holder=targetId;expiresAt=now()+leaseMs;dropQueue(targetId);
      emit('floor.granted',hostActorId,{targetId,expiresAt});return snapshot();
    },
    revokeFloor(hostActorId,reason='host-revoked'){requireHost(hostActorId);revoke(hostActorId,reason);return snapshot();},
    setMuted(hostActorId,targetId,muted=true){
      requireHost(hostActorId);validActor(targetId);if(targetId===hostId)throw new Error('Host mute is controlled externally');
      participants.get(targetId).muted=Boolean(muted);
      if(muted){dropQueue(targetId);if(holder===targetId)revoke(hostActorId,'host-muted');}
      emit(muted?'host.mute':'host.unmute',hostActorId,{targetId});return snapshot();
    },
    setPaused(hostActorId,value=true){
      requireHost(hostActorId);paused=Boolean(value);if(paused){revoke(hostActorId,'host-paused');queue.length=0;}
      emit(paused?'host.pause':'host.resume',hostActorId);return snapshot();
    },
    canSpeak(actorId){expire();return !paused&&holder===actorId&&participants.get(actorId)?.connected===true&&!participants.get(actorId)?.muted;},
    assertSpeech(actorId){if(!api.canSpeak(actorId))throw new Error('No active speaking permission');return true;},
    completeSpeech(actorId){api.assertSpeech(actorId);revoke(actorId,'speech-complete');return snapshot();},
    // Model text is always a private draft. Never route it straight to the speech sink.
    acceptModelResult(actorId,text){validActor(actorId);if(participants.get(actorId).role!=='agent')throw new Error('Agent required');
      if(typeof text!=='string'||!text.trim())throw new TypeError('Nonempty model text required');
      return Object.freeze({actorId,text:text.slice(0,12000),visibility:'private',requiresFloor:true});},
    snapshot,
    eventsSince(seq=0){if(!Number.isInteger(seq)||seq<0)throw new TypeError('Invalid checkpoint');return Object.freeze(events.filter(e=>e.seq>seq));}
  };
  return Object.freeze(api);
}
