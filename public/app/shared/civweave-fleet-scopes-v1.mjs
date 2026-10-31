/**
 * Fleet scope projection. Local selections never become Guild records.
 * Guild pilots are obtained exclusively from an already verified Worldweaver
 * snapshot. A configured slot is not a currently running model.
 */
import {STARLING_PERSONAS} from './starling-collective-v1.mjs';
export const FLEET_SCOPE_SCHEMA='civweave.fleet-scopes.v1';
export const ROLE_ORDER=Object.freeze(['swift','archive','forge','quill','atlas']);
const string=(value,max=200)=>typeof value==='string'?value.slice(0,max):'';
const present=x=>x&&typeof x==='object'&&!Array.isArray(x);
export function localFleetProjection({catalogue=[],chosen={},bindings={},runtimeState={}}={}){
 const rows=Array.isArray(catalogue)?catalogue:[];
 const selections=present(chosen)?chosen:{};
 const verified=bindings?.schema==='civweave.ai.fleet.bindings.v1'&&present(bindings.roles)?bindings.roles:{};
 const current=present(runtimeState)?runtimeState:{};
 const roles=ROLE_ORDER.map(id=>{
  const record=verified[id],choice=selections[id];
  const match=rows.find(row=>row.role===id&&row.modelId===choice?.modelId);
  const other=rows.find(row=>row.role===id);
  const source=match||other;
  return Object.freeze({
   id,label:string(source?.name||id,60),purpose:string(source?.purpose||'',90),
   configuredModelId:string(choice?.modelId||'',180)||null,
   installedModelId:record?.importId&&record?.model?string(record.model,180):null,
   installedQuantization:record?.importId?string(record.quantization,80):null,
   status:record?.importId?'verified-local-import':choice?.modelId?'configured-not-verified':'unconfigured',
   runtime:source?.runtime||null
  });
 });
 return Object.freeze({schema:FLEET_SCOPE_SCHEMA,scope:'local',roles,
   activeRoute:string(current.provider||current.route||'',100)||null,
   selectedModel:string(current.model||'',160)||null,
   note:'Local catalogue and saved preferences do not prove that a model is generating or online.'});
}
export function guildFleetProjection({guildId,worldSnapshot=null,turns=[],hostJob=null}={}){
 if(typeof guildId!=='string'||!guildId)return Object.freeze({schema:FLEET_SCOPE_SCHEMA,scope:'guild',guildId:null,available:false,registered:[],eligible:[],signedTurns:0,running:[]});
 const instances=Array.isArray(worldSnapshot?.instances)?worldSnapshot.instances.filter(x=>x.guildId===guildId&&x.status==='live'):[];
 const ids=new Set(instances.map(x=>x.id));
 const registered=Array.isArray(worldSnapshot?.npcs)?worldSnapshot.npcs
  .filter(x=>ids.has(x.instanceId)&&typeof x.personaRef==='string'&&x.personaRef.startsWith('starling:'))
  .map(x=>Object.freeze({npcId:string(x.id,180),name:string(x.name,100),
    personaId:string(x.personaRef.slice(9),80),modelId:string(x.modelId,180),
    instanceId:string(x.instanceId,180),capabilities:Array.isArray(x.capabilities)?x.capabilities.filter(t=>typeof t==='string').slice(0,12):[],
    status:'registered-pilot-not-executing'})):[];
 const presentIds=new Set(registered.map(x=>x.personaId));
 const eligible=Object.keys(STARLING_PERSONAS).filter(id=>!presentIds.has(id));
 const authorizedTurns=Array.isArray(turns)?turns.filter(x=>x.guildId===guildId&&STARLING_PERSONAS[x.personaId]):[];
 const running=hostJob?.guildId===guildId&&['running','working','processing','started'].includes(hostJob.state)&&STARLING_PERSONAS[hostJob.personaId]?[hostJob.personaId]:[];
 return Object.freeze({schema:FLEET_SCOPE_SCHEMA,scope:'guild',guildId,available:instances.length>0,
  rooms:instances.map(x=>Object.freeze({id:x.id,title:string(x.title,140)})),
  registered,eligible,signedTurns:authorizedTurns.length,running,
  note:'Guild pilot registrations and signed model turns are not proof of world-space movement, tool execution, or Quest completion.'});
}
