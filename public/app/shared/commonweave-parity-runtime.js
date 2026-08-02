(()=>{
'use strict';
const LEDGER_URL='/app/shared/commonweave-parity-ledger.json';
let promise=null;
const parse=(value,fallback)=>{try{return JSON.parse(value)}catch{return fallback}};
function index(ledger){
  const systems=new Map((ledger.systems||[]).map(system=>[system.id,system]));
  const rooms=new Map();
  for(const system of systems.values())for(const room of system.rooms||[])rooms.set(`${system.id}:${room.id}`,room);
  const capabilities=new Map((ledger.capabilities||[]).map(capability=>[capability.id,capability]));
  return {systems,rooms,capabilities};
}
async function load({force=false}={}){
  if(!promise||force){
    promise=fetch(`${LEDGER_URL}?v=1.0.29`,{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error(`Parity ledger returned ${response.status}`);
      const ledger=await response.json();
      ledger.index=index(ledger);
      const validation=validate(ledger);
      if(!validation.ok)throw new Error(`Parity ledger invalid: ${validation.errors.join('; ')}`);
      return ledger;
    });
  }
  return promise;
}
function validate(ledger){
  const errors=[];const ids=new Set();const systemIds=new Set((ledger.systems||[]).map(system=>system.id));const roomIds=new Set();
  for(const system of ledger.systems||[]){
    if(ids.has(system.id))errors.push(`duplicate system ${system.id}`);ids.add(system.id);
    if(!system.interfaceShell?.asset&&!system.interfaceShell?.assetParts?.length)errors.push(`system ${system.id} has no cabinet asset`);
    if(!system.interfaceShell?.screen)errors.push(`system ${system.id} has no cabinet screen rectangle`);
    for(const room of system.rooms||[]){const key=`${system.id}:${room.id}`;if(roomIds.has(key))errors.push(`duplicate room ${key}`);roomIds.add(key);if(!room.visualAsset)errors.push(`room ${key} has no visual asset`);if(!room.liteRoute)errors.push(`room ${key} has no lite route`)}
  }
  const capabilityIds=new Set();
  for(const capability of ledger.capabilities||[]){
    if(capabilityIds.has(capability.id))errors.push(`duplicate capability ${capability.id}`);capabilityIds.add(capability.id);
    if(!systemIds.has(capability.system))errors.push(`unknown system for ${capability.id}`);
    if(!roomIds.has(`${capability.system}:${capability.room}`))errors.push(`unknown room for ${capability.id}`);
    if(!capability.visual?.status)errors.push(`missing visual mapping for ${capability.id}`);
    if(!capability.lite?.status)errors.push(`missing lite mapping for ${capability.id}`);
    if(!['automatic','review','explicit'].includes(capability.consent))errors.push(`invalid consent for ${capability.id}`);
  }
  return {ok:errors.length===0,errors,counts:{systems:systemIds.size,rooms:roomIds.size,capabilities:capabilityIds.size}};
}
function resolve(ledger,{systemId,roomId,capabilityId}={}){
  const system=ledger.index.systems.get(systemId)||ledger.systems[0];
  const room=ledger.index.rooms.get(`${system.id}:${roomId}`)||system.rooms[0];
  const capability=capabilityId?ledger.index.capabilities.get(capabilityId):null;
  return {system,room,capability:capability?.system===system.id&&capability?.room===room.id?capability:null};
}
function routeState(locationLike=location){
  const query=new URLSearchParams(locationLike.search||'');
  return {systemId:query.get('system')||'',roomId:query.get('room')||'',capabilityId:query.get('capability')||''};
}
function liteUrl({systemId,roomId,capabilityId}={}){
  const query=new URLSearchParams();if(systemId)query.set('system',systemId);if(roomId)query.set('room',roomId);if(capabilityId)query.set('capability',capabilityId);
  return `/lite/${query.size?`?${query}`:''}`;
}
function visualUrl({systemId,roomId,capabilityId}={}){
  if(!systemId||systemId==='commonweave')return '/loom/';
  const query=new URLSearchParams();if(roomId)query.set('room',roomId);if(capabilityId)query.set('capability',capabilityId);
  return `/loom/realm/${encodeURIComponent(systemId)}/${query.size?`?${query}`:''}`;
}
function sourceUrl(capability){return capability?.lite?.sourceRoute||null}
window.CommonweaveParity={LEDGER_URL,load,validate,resolve,routeState,liteUrl,visualUrl,sourceUrl,parse};
})();
