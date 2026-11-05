/**
 * Starling meeting client speech player safety boundary.
 * Consumes only messages from a trusted meeting WebSocket.
 * The caller provides a player with play({text,actorId,signal}) and stop().
 * No automatic model text is ever passed here.
 */
export function createStarlingMeetingSpeechPlayback({player,now=()=>Date.now()}={}){
  if(typeof player?.play!=='function'||typeof player?.stop!=='function')
    throw new TypeError('A cancelable speech player is required');
  let state=null,epoch=0,abort=null,closed=false;
  let chain=Promise.resolve();
  const stop=()=>{
    ++epoch;
    abort?.abort();abort=null;
    player.stop();
  };
  const authorized=actorId=>!closed&&state&&!state.paused&&state.holder===actorId&&
    Array.isArray(state.participants)&&state.participants.some(p=>p.actorId===actorId&&p.connected&&!p.muted)&&
    Number.isFinite(state.expiresAt)&&now()<state.expiresAt;
  const receive=frame=>{
    if(!frame||typeof frame!=='object')return false;
    if(frame.type==='speech.stop'){stop();return true;}
    if(frame.type==='meeting.welcome'||frame.type==='meeting.state'){
      const next=frame.state;
      if(!next||typeof next!=='object')return false;
      const previouslyAuthorized=abort&&authorized(abort.actorId);
      state=next;
      if(previouslyAuthorized&&!authorized(abort.actorId))stop();
      if(next.paused||next.holder===null)stop();
      return true;
    }
    if(frame.type!=='speech.chunk')return false;
    if(typeof frame.actorId!=='string'||typeof frame.text!=='string'||!frame.text.trim()||frame.text.length>2000
      ||!authorized(frame.actorId))return false;
    const actorId=frame.actorId,text=frame.text,playEpoch=epoch;
    chain=chain.catch(()=>{}).then(async()=>{
      if(playEpoch!==epoch||!authorized(actorId))return;
      const controller=new AbortController();controller.actorId=actorId;
      abort=controller;
      try{await player.play({actorId,text,signal:controller.signal});}
      finally{if(abort===controller)abort=null;}
    });
    return true;
  };
  const disconnect=()=>{closed=true;state=null;stop();};
  return Object.freeze({receive,disconnect,stop,isAuthorized:authorized,whenIdle:()=>chain});
}
