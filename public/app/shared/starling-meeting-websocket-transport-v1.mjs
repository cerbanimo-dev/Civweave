/**
 * Cloudflare-compatible WebSocket transport for the Starling meeting gateway.
 * Authentication happens before upgrade and on EVERY command inside gateway.
 * Only approved text speech chunks are broadcast. No binary/audio frames.
 *
 * NOTE: one transport instance must own each session. Durable Objects or
 * sticky single-owner routing are required for multi-instance deployments.
 */
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,120}$/.test(v);
const send=(socket,data)=>{try{socket.send(JSON.stringify(data));return true;}catch{return false;}};
export function createStarlingMeetingWebSocketTransport({gateway,authorizeUpgrade,createPair,maxFrameBytes=8192,maxSocketsPerSession=32}={}){
  if(typeof gateway?.dispatch!=='function'||typeof authorizeUpgrade!=='function'||typeof createPair!=='function')
    throw new TypeError('Gateway, upgrade authorization and WebSocket pair factory required');
  const rooms=new Map();
  const errorResponse=(status,message)=>new Response(JSON.stringify({ok:false,error:message}),{
    status,headers:{'content-type':'application/json','cache-control':'no-store'}});
  const broadcast=(room,message)=>{
    for(const socket of room.values())send(socket,message);
  };
  const attach=async({request,sessionId}={})=>{
    if(!(request instanceof Request)||!safeId(sessionId))return errorResponse(400,'invalid-request');
    if(request.method!=='GET')return errorResponse(405,'method-not-allowed');
    if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return errorResponse(426,'websocket-upgrade-required');
    let identity;
    try{identity=await authorizeUpgrade({request,sessionId});}catch{return errorResponse(401,'unauthorized');}
    if(!identity||identity.sessionId!==sessionId||!safeId(identity.actorId)||
      typeof identity.token!=='string'||!identity.token)return errorResponse(401,'unauthorized');
    const room=rooms.get(sessionId)||new Map();
    if(room.size>=maxSocketsPerSession)return errorResponse(429,'room-full');
    if(room.has(identity.actorId))return errorResponse(409,'actor-already-connected');
    let pair;
    try{pair=createPair();}catch{return errorResponse(503,'websocket-unavailable');}
    const [client,server]=Array.isArray(pair)?pair:Object.values(pair);
    if(!client||!server||typeof server.accept!=='function')return errorResponse(503,'websocket-unavailable');
    // No client-visible credential and no model prompt is sent in welcome.
    server.accept();
    let closed=false,pending=Promise.resolve();
    const member={socket:server,actorId:identity.actorId,token:identity.token};
    room.set(identity.actorId,member);
    rooms.set(sessionId,room);
    const dispatch=(action,payload={})=>gateway.dispatch({token:identity.token,sessionId,action,payload});
    const leave=async()=>{
      if(closed)return;
      closed=true;
      if(room.get(identity.actorId)===member){
        room.delete(identity.actorId);
        const result=await dispatch('leave');
        if(result.ok)broadcast(room,{type:'meeting.state',state:result.state,events:result.events});
        if(!room.size)rooms.delete(sessionId);
      }
    };
    const joined=await dispatch('join');
    if(!joined.ok){
      room.delete(identity.actorId);if(!room.size)rooms.delete(sessionId);
      try{server.close(1008,joined.code||'join-rejected');}catch{}
      return errorResponse(403,'join-rejected');
    }
    send(server,{type:'meeting.welcome',sessionId,actorId:identity.actorId,state:joined.state});
    broadcast(room,{type:'meeting.state',state:joined.state,events:joined.events||[]});
    server.addEventListener('message',event=>{
      pending=pending.then(async()=>{
        if(closed)return;
        if(typeof event.data!=='string'||new TextEncoder().encode(event.data).byteLength>maxFrameBytes){
          send(server,{type:'meeting.error',code:'invalid_frame'});return;
        }
        let frame;try{frame=JSON.parse(event.data);}catch{send(server,{type:'meeting.error',code:'invalid_json'});return;}
        if(!frame||typeof frame!=='object'||Array.isArray(frame)||typeof frame.action!=='string'||
          !frame.payload||typeof frame.payload!=='object'||Array.isArray(frame.payload)){
          send(server,{type:'meeting.error',code:'invalid_command'});return;
        }
        if(frame.action==='join'||frame.action==='leave'){
          send(server,{type:'meeting.error',code:'lifecycle_owned_by_transport'});return;
        }
        const response=await dispatch(frame.action,frame.payload);
        send(server,{type:'meeting.ack',requestId:typeof frame.requestId==='string'?frame.requestId.slice(0,100):null,
          ok:response.ok,code:response.code||null,result:frame.action==='model.ready'?response.result:frame.action==='events'?response.result:null});
        if(!response.ok)return;
        if(frame.action==='speech.chunk'){
          broadcast(room,{type:'speech.chunk',actorId:identity.actorId,text:response.result.text,seq:response.state.seq});
        }
        // State is authoritative and visible to all. Never broadcast private model.ready result.
        if(!['model.ready','events','snapshot','speech.chunk'].includes(frame.action)){
          broadcast(room,{type:'meeting.state',state:response.state,events:response.events||[]});
          if((response.events||[]).some(e=>e.type==='floor.revoked'))
            broadcast(room,{type:'speech.stop',reason:'floor-revoked',seq:response.state.seq});
        }else if(frame.action==='snapshot'){
          send(server,{type:'meeting.state',state:response.state,events:[]});
        }
      }).catch(()=>send(server,{type:'meeting.error',code:'internal_error'}));
    });
    server.addEventListener('close',()=>{pending=pending.then(leave).catch(()=>{});});
    server.addEventListener('error',()=>{pending=pending.then(leave).catch(()=>{});});
    return new Response(null,{status:101,webSocket:client});
  };
  return Object.freeze({attach,roomCount:()=>rooms.size});
}
