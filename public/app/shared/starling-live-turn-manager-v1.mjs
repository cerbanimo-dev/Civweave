/**
 * Starling live-meeting turn arbiter. No model or audio provider may publish
 * speech without a current lease. Not an authentication service: callers must
 * pass trusted host/participant identity from the meeting owner.
 */
export const STARLING_LIVE_PROTOCOL = 'civweave.starling-live-turn.v1';
const ID = x => typeof x === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(x);
const clip = (x,n=512) => typeof x === 'string' ? x.trim().slice(0,n) : '';
export function createStarlingLiveTurnManager({hostId, now=()=>Date.now(), cooldownMs=4000, leaseMs=30000, onEvent=()=>{}}={}) {
  if(!ID(hostId)||typeof now!=='function'||typeof onEvent!=='function') throw new TypeError('A trusted host ID, clock and event sink are required.');
  if(!Number.isSafeInteger(cooldownMs)||cooldownMs<0||!Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>120000) throw new RangeError('Invalid turn timing.');
  const people=new Map([[hostId,{kind:'human',muted:false,lastEnd:-Infinity}]]);
  const requests=new Map(), seen=new Set(), events=[];
  let active=null, epoch=1, locked=false, sequence=0;
  function time(){const t=now();if(!Number.isFinite(t))throw new Error('Invalid meeting clock.');return t}
  function event(type,detail={}){const v=Object.freeze({schema:STARLING_LIVE_PROTOCOL,sequence:++sequence,epoch,at:time(),type,...detail});events.push(v);if(events.length>500)events.shift();try{onEvent(v)}catch{}return v}
  function isHost(actor){if(actor!==hostId)throw new Error('Host authority required.')}
  function member(id){if(!people.has(id))throw new Error('Unknown participant.');return people.get(id)}
  function stop(reason='ended'){
    if(!active)return false;
    const prior=active;active=null;
    const p=people.get(prior.speakerId);if(p)p.lastEnd=time();
    event('turn-ended',{speakerId:prior.speakerId,turnId:prior.turnId,reason});
    return true;
  }
  function expire(){if(active&&time()>=active.expiresAt)stop('lease-expired')}
  function snapshot(){expire();return Object.freeze({schema:STARLING_LIVE_PROTOCOL,epoch,locked,active:active?Object.freeze({...active}):null,pending:Object.freeze([...requests.values()].map(v=>Object.freeze({...v}))),participants:Object.freeze([...people].map(([id,p])=>Object.freeze({id,kind:p.kind,muted:p.muted})))})}
  function join({actorId,participantId,kind='agent'}={}){
    isHost(actorId);if(!ID(participantId)||!['agent','human'].includes(kind))throw new TypeError('Invalid participant.');
    if(people.has(participantId))throw new Error('Participant already registered.');
    people.set(participantId,{kind,muted:false,lastEnd:-Infinity});event('joined',{participantId,kind});return snapshot();
  }
  function leave({actorId,participantId}={}){
    if(actorId!==hostId&&actorId!==participantId)throw new Error('Permission denied.');
    if(participantId===hostId)throw new Error('Host cannot leave without ending the meeting.');
    member(participantId);if(active?.speakerId===participantId)stop('left');
    requests.delete(participantId);people.delete(participantId);event('left',{participantId});return snapshot();
  }
  function ask({actorId,requestId,reason='',directedBy=null}={}){
    expire();const p=member(actorId);
    if(p.kind!=='agent'||p.muted||locked)return Object.freeze({accepted:false,reason:'not-eligible'});
    if(!ID(requestId))throw new TypeError('Stable request ID required.');
    const key=actorId+':'+requestId;
    if(seen.has(key))return Object.freeze({accepted:false,reason:'duplicate'});
    seen.add(key);if(seen.size>2000)seen.clear();
    if(requests.has(actorId))return Object.freeze({accepted:false,reason:'already-pending'});
    const req=Object.freeze({speakerId:actorId,requestId,reason:clip(reason,180),directedBy:directedBy===hostId?hostId:null,at:time()});
    requests.set(actorId,req);event('hand-raised',{speakerId:actorId,requestId});
    return Object.freeze({accepted:true,request:req});
  }
  function grant({actorId,speakerId,turnId}={}){
    isHost(actorId);expire();const p=member(speakerId);
    if(!ID(turnId))throw new TypeError('Turn ID required.');
    if(locked||p.muted||active)return Object.freeze({granted:false,reason:locked?'meeting-muted':active?'floor-occupied':'muted'});
    if(p.kind==='agent'&&!requests.has(speakerId))return Object.freeze({granted:false,reason:'no-request'});
    if(p.kind==='agent'&&time()-p.lastEnd<cooldownMs)return Object.freeze({granted:false,reason:'cooldown'});
    requests.delete(speakerId);
    active=Object.freeze({speakerId,turnId,epoch,expiresAt:time()+leaseMs});
    event('turn-granted',{speakerId,turnId});return Object.freeze({granted:true,lease:active});
  }
  function authorize({speakerId,turnId,leaseEpoch}={}){
    expire();return !!(active&&!locked&&active.speakerId===speakerId&&active.turnId===turnId&&active.epoch===leaseEpoch&&!member(speakerId).muted);
  }
  function complete({actorId,turnId}={}){
    expire();if(!active||active.turnId!==turnId)return false;
    if(actorId!==hostId&&actorId!==active.speakerId)throw new Error('Permission denied.');
    return stop('completed');
  }
  function humanSpeech({actorId}={}){
    const p=member(actorId);if(p.kind!=='human')throw new Error('Human interruption requires trusted human identity.');
    if(active?.speakerId!==actorId)stop('human-interruption');
    event('human-speaking',{participantId:actorId});return snapshot();
  }
  function mute({actorId,participantId,muted=true}={}){
    isHost(actorId);const p=member(participantId);p.muted=muted===true;
    if(p.muted){requests.delete(participantId);if(active?.speakerId===participantId)stop('participant-muted');}
    event('participant-mute',{participantId,muted:p.muted});return snapshot();
  }
  function emergencyMute({actorId}={}){
    isHost(actorId);locked=true;epoch++;stop('emergency-mute');requests.clear();
    event('meeting-muted');return snapshot();
  }
  function resume({actorId}={}){isHost(actorId);locked=false;epoch++;requests.clear();event('meeting-resumed');return snapshot()}
  function reconnect({actorId,participantId}={}){
    if(actorId!==hostId&&actorId!==participantId)throw new Error('Permission denied.');
    member(participantId);epoch++;if(active)stop('reconnection');requests.clear();
    event('participant-reconnected',{participantId});return snapshot();
  }
  function directedQuestion({actorId,targetId,requestId}={}){
    const p=member(actorId);if(p.kind!=='human'||actorId!==hostId)throw new Error('Only the host can direct agent questions.');
    if(member(targetId).kind!=='agent')throw new Error('Target must be an agent.');
    return ask({actorId:targetId,requestId,reason:'directed-question',directedBy:actorId});
  }
  return Object.freeze({join,leave,ask,grant,authorize,complete,humanSpeech,mute,emergencyMute,resume,reconnect,directedQuestion,snapshot,events:()=>Object.freeze([...events])});
}
