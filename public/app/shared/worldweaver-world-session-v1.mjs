/**
 * Civweave World Runtime: provider-neutral, revisioned presence and navigation.
 * This is a session projection, NOT a second Worldweaver manifest authority.
 * The host owns authentication, persistent storage, and broadcast transport.
 */
import {COMMONS_BETWEEN} from './worldweaver-universe-v1.mjs';

export const WORLD_SESSION_SCHEMA='civweave.world-session.v1';
const copy=x=>JSON.parse(JSON.stringify(x));
const token=x=>typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,180}$/.test(x);
const edges=new Set(COMMONS_BETWEEN.navigation.portals.flatMap(({from,to})=>[from+'>'+to,to+'>'+from]));
const rooms=new Set(COMMONS_BETWEEN.rooms.map(x=>x.id));
const defaultRoom=COMMONS_BETWEEN.navigation.nexus.roomId;
const limited=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
function checkedEvent(e){
  if(!e||typeof e!=='object'||Array.isArray(e)||!['join','move','leave'].includes(e.type))throw new TypeError('Invalid world session event');
  if(!token(e.principalId)||!token(e.guildId))throw new TypeError('Invalid principal or Guild');
  if(!limited(e.revision,Number.MAX_SAFE_INTEGER)||e.revision===0||!limited(e.at,Number.MAX_SAFE_INTEGER))throw new TypeError('Invalid event metadata');
  if(e.type!=='leave'&&!rooms.has(e.roomId))throw new TypeError('Unknown room');
  if(e.type==='leave'&&e.roomId!==undefined)throw new TypeError('Leave has no room');
  if(Object.keys(e).some(k=>!['type','principalId','guildId','roomId','revision','at'].includes(k)))throw new TypeError('Unexpected session event field');
}
/**
 * Pass only server-authenticated actors. authorize is mandatory for every
 * command, including joins and replay. Actors are never read from commands.
 * append(event) must durably write BEFORE its promise resolves in production.
 */
export function createWorldSession({guildId,authorize,append,clock=()=>Date.now(),historyLimit=256,initialEvents=[]}={}){
  if(!token(guildId)||typeof authorize!=='function'||typeof append!=='function'||typeof clock!=='function')
    throw new TypeError('Guild, authorizer, durable append and clock are required');
  if(!limited(historyLimit,4096)||historyLimit<1)throw new RangeError('Invalid history limit');
  if(!Array.isArray(initialEvents))throw new TypeError('Initial events must be an array');
  const participants=new Map();
  let revision=0;
  const history=[];
  function apply(e){
    checkedEvent(e);
    if(e.guildId!==guildId||e.revision!==revision+1)throw new Error('Non-contiguous or cross-Guild history');
    const previous=participants.get(e.principalId);
    if(e.type==='join'){
      if(previous)throw new Error('Duplicate join');
      if(e.roomId!==defaultRoom)throw new Error('Join must enter the Threshold');
      participants.set(e.principalId,{principalId:e.principalId,roomId:e.roomId});
    }else if(e.type==='move'){
      if(!previous||!edges.has(previous.roomId+'>'+e.roomId))throw new Error('Movement requires an adjacent portal');
      participants.set(e.principalId,{principalId:e.principalId,roomId:e.roomId});
    }else{
      if(!previous)throw new Error('Unknown participant');
      participants.delete(e.principalId);
    }
    revision=e.revision;
    history.push(copy(e));
    if(history.length>historyLimit)history.shift();
  }
  for(const e of initialEvents)apply(e);
  let lane=Promise.resolve();
  const snapshot=()=>copy({schema:WORLD_SESSION_SCHEMA,guildId,revision,participants:[...participants.values()].sort((a,b)=>a.principalId.localeCompare(b.principalId))});
  function delta(afterRevision){
    if(!limited(afterRevision,Number.MAX_SAFE_INTEGER)||afterRevision>revision)throw new RangeError('Invalid reconnect revision');
    const oldest=history.length?history[0].revision:revision+1;
    if(afterRevision<oldest-1)return {resync:true,snapshot:snapshot()};
    return copy({resync:false,revision,events:history.filter(e=>e.revision>afterRevision)});
  }
  function dispatch(command,actor){
    const job=lane.then(async()=>{
      if(!actor||!token(actor.principalId)||!command||typeof command!=='object')throw new TypeError('Authenticated actor and command required');
      const {type,roomId}=command;
      if(!['join','move','leave'].includes(type)||Object.keys(command).some(k=>!['type','roomId'].includes(k)))throw new TypeError('Unsupported command');
      if(type==='move'&&!rooms.has(roomId))throw new TypeError('Unknown room');
      if(type!=='move'&&roomId!==undefined)throw new TypeError('Room is only accepted for movement');
      if(await authorize({actor,command:copy(command),guildId,snapshot:snapshot()})!==true)throw new Error('World permission denied');
      const principalId=actor.principalId,previous=participants.get(principalId);
      const event={type,principalId,guildId,revision:revision+1,at:clock()};
      if(type==='join'){
        if(previous)throw new Error('Already joined');
        event.roomId=defaultRoom;
      }else if(type==='move'){
        if(!previous||!edges.has(previous.roomId+'>'+roomId))throw new Error('Portal inaccessible');
        event.roomId=roomId;
      }else if(!previous)throw new Error('Not joined');
      checkedEvent(event);
      await append(copy(event)); // do not expose success before persistence
      apply(event);
      return {event:copy(event),revision};
    });
    lane=job.catch(()=>{});
    return job;
  }
  return Object.freeze({snapshot,delta,dispatch});
}
