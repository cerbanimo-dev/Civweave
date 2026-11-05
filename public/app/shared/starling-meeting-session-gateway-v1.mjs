import {createMeetingFloor} from './starling-meeting-floor-v1.mjs';

/**
 * Authenticated command boundary for session transports (HTTP, WS or DO).
 * No network listener is created here. The host transport must authenticate
 * EACH request and reject spoofed identities before calling dispatch().
 * In-memory state is process-local; use one authoritative owner per session.
 */
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,120}$/.test(value);
const permitted=new Set(['join','leave','floor.request','floor.grant','floor.revoke','host.mute','host.unmute','host.pause','host.resume','speech.chunk','speech.end','model.ready','snapshot','events']);
export function createMeetingSessionGateway({authenticate,now=()=>Date.now(),leaseMs=30000,maxSessions=100}={}){
  if(typeof authenticate!=='function')throw new TypeError('An authentication callback is required');
  const sessions=new Map();
  const error=(code,message)=>Object.freeze({ok:false,code,message});
  async function dispatch({token,sessionId,action,payload={}}={}){
    // Never trust actorId or role carried by a client payload.
    if(!validId(sessionId)||!permitted.has(action)||!payload||typeof payload!=='object'||Array.isArray(payload))
      return error('invalid_request','Invalid session, action or payload');
    let identity;
    try{identity=await authenticate({token,sessionId,action});}catch{return error('unauthorized','Authentication failed');}
    if(!identity||!validId(identity.actorId)||!['host','agent','human'].includes(identity.role)||
       identity.sessionId!==sessionId)return error('unauthorized','Session identity not authorized');
    const actorId=identity.actorId,role=identity.role;
    let record=sessions.get(sessionId);
    if(!record){
      if(role!=='host'||action!=='join')return error('not_found','Session has not been opened by its host');
      if(sessions.size>=maxSessions)return error('capacity','Session capacity reached');
      record={hostId:actorId,floor:createMeetingFloor({sessionId,hostId:actorId,now,leaseMs}),connections:new Map([[actorId,identity.connectionId||null]])};
      sessions.set(sessionId,record);
      return Object.freeze({ok:true,state:record.floor.snapshot(),events:[]});
    }
    const {floor,hostId,connections}=record;
    if(role==='host'&&actorId!==hostId||role!=='host'&&actorId===hostId)
      return error('forbidden','Role mismatch');
    // A fresh connection must explicitly join; stale connections cannot issue commands.
    const connected=connections.has(actorId);
    if(action!=='join'&&!connected)return error('not_joined','Join before sending commands');
    if(action!=='join'&&connections.get(actorId)!==(identity.connectionId||null))
      return error('stale_connection','Connection has changed');
    if(action==='join'){
      if(actorId===hostId){
        // Host reconnect is fail-closed while old connection may still exist.
        if(!connected)return error('host_disconnected','Host session must be restarted');
        if(connections.get(actorId)!==(identity.connectionId||null))return error('stale_connection','Host reauthentication requires a new session');
      }else{
        if(connected)return error('already_joined','Disconnect old connection first');
        if(role==='host')return error('forbidden','Only one host is permitted');
        floor.join(actorId,{role});connections.set(actorId,identity.connectionId||null);
      }
      return Object.freeze({ok:true,state:floor.snapshot(),events:[]});
    }
    const before=floor.snapshot().seq;
    try{
      let result=null;
      switch(action){
        case 'leave': floor.disconnect(actorId);connections.delete(actorId);break;
        case 'floor.request':floor.requestFloor(actorId);break;
        case 'floor.grant':floor.grantFloor(actorId,payload.targetId);break;
        case 'floor.revoke':floor.revokeFloor(actorId);break;
        case 'host.mute':floor.setMuted(actorId,payload.targetId,true);break;
        case 'host.unmute':floor.setMuted(actorId,payload.targetId,false);break;
        case 'host.pause':floor.setPaused(actorId,true);break;
        case 'host.resume':floor.setPaused(actorId,false);break;
        case 'speech.chunk':
          floor.assertSpeech(actorId);
          if(typeof payload.text!=='string'||!payload.text||payload.text.length>2000)
            return error('invalid_request','Speech chunk must be 1–2000 characters');
          result=Object.freeze({actorId,text:payload.text});
          break;
        case 'speech.end':floor.completeSpeech(actorId);break;
        case 'model.ready':
          result=floor.acceptModelResult(actorId,payload.text);
          break;
        case 'events':
          if(!Number.isSafeInteger(payload.afterSeq)||payload.afterSeq<0)return error('invalid_request','Invalid event checkpoint');
          result=floor.eventsSince(payload.afterSeq);break;
        case 'snapshot':break;
        default:return error('invalid_request','Unknown command');
      }
      return Object.freeze({ok:true,state:floor.snapshot(),events:floor.eventsSince(before),result});
    }catch(err){
      return error('rejected',String(err?.message||'Command rejected').slice(0,200));
    }
  }
  return Object.freeze({dispatch,sessionCount:()=>sessions.size});
}
