/**
 * Capability-limited AI observation and proposal preparation, without execution.
 * The same Worldweaver manifest drives AI perception and both visual renderers.
 * A queued proposal is NOT a Worldweaver intent until a verified model pilot is
 * authenticated by the shared host. Tools cannot self-approve.
 */
import {observeWorld2D} from './worldweaver-map-2d-v1.mjs';
export const SIMULATOR_TOOL_SCHEMA='civweave.worldweaver-simulator-tools.v1';
const VALID_TOOLS=new Set(['observe','inspect','speak','move','demonstrate','present','facilitate','cast-screen','clear-screen']);
const bounded=(x,max)=>typeof x==='string'?x.trim().slice(0,max):'';
function selectedPilot(snapshot,worldRef,personaId){
 const npc=snapshot.npcs.find(x=>x.instanceId===worldRef&&x.personaRef==='starling:'+personaId);
 if(!npc)throw new Error('This agent has no registered Worldweaver pilot in the selected room.');
 return npc;
}
export function createSimulatorToolBridge({getSnapshot,getLayout,getWorldRef}={}){
 if(typeof getSnapshot!=='function'||typeof getLayout!=='function'||typeof getWorldRef!=='function')
  throw new TypeError('Worldweaver source callbacks required.');
 function snapshot(){
  const state=getSnapshot(),worldRef=getWorldRef();
  if(!state||!Array.isArray(state.instances)||!Array.isArray(state.npcs)||
     !state.instances.some(x=>x.id===worldRef&&x.status==='live'))
   throw new Error('No authorized, live Worldweaver room is available.');
  return {state,worldRef};
 }
 function observe({personaId=null}={}){
  const {state,worldRef}=snapshot();
  const map=observeWorld2D(state,{worldRef,layout:getLayout()});
  const seen=map.entities.slice(0,28).map(x=>({id:x.id,type:x.type,label:x.label,
    x:x.x,y:x.y,actions:x.actions}));
  const owner=personaId?selectedPilot(state,worldRef,personaId):null;
  return Object.freeze({schema:SIMULATOR_TOOL_SCHEMA,tool:'observe',
    worldRef,revision:map.revision,geometryStatus:map.geometryStatus,
    entities:seen,pilotId:owner?.id||null,
    pendingIntents:map.pendingIntents,
    note:'Coordinates are an observational 2D projection; schematic coordinates never authorize movement.'});
 }
 function prepare({personaId,tool,args={}}={}){
  const {state,worldRef}=snapshot();
  const npc=selectedPilot(state,worldRef,personaId);
  if(!VALID_TOOLS.has(tool)||!npc.capabilities.includes(tool))
   throw new Error('Worldweaver pilot does not have that tool capability.');
  if(args===null||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>1400)
   throw new TypeError('Tool arguments must be bounded structured data.');
  if(tool==='move'){
   if(Object.keys(args).some(x=>!['x','y','z'].includes(x))||
     !Number.isFinite(args.x)||!Number.isFinite(args.y)||
     args.x<0||args.x>256||args.y<0||args.y>256||
     (args.z!==undefined&&(!Number.isFinite(args.z)||args.z<0||args.z>4096)))
    throw new TypeError('Move target must be bounded world coordinates.');
  }
  if(tool==='speak'&&(!bounded(args.text,1000)||Object.keys(args).some(x=>x!=='text')))
   throw new TypeError('Speech requires nonempty bounded text.');
  if(['cast-screen','clear-screen'].includes(tool)){
   const screen=state.screens?.find(x=>x.instanceId===worldRef&&x.id===args.screenId);
   if(!screen)throw new Error('Screen belongs to a different or nonexistent Worldweaver room.');
  }
  return Object.freeze({schema:SIMULATOR_TOOL_SCHEMA,tool:'proposal',
   status:'pending-verified-model-pilot',npcId:npc.id,personaId,modelId:npc.modelId,
   worldRef,revision:state.revision,action:{tool,args:JSON.parse(JSON.stringify(args))},
   requires:'Authenticated model principal, Worldweaver authorization, trusted runtime execution and receipt'});
 }
 return Object.freeze({observe,prepare});
}
