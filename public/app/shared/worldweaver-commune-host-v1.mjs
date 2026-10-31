/**
 * Starling Commune -> canonical Worldweaver host.
 * A verified Guild founder can provision a real local-renderer manifest.
 * No impersonated model pilot, fake OpenSim presence, or separate inference loop.
 */
import {createWorldweaver,WORLDWEAVER_SCHEMA} from './worldweaver-core-v1.mjs';
import {createProvisionalOpenSimScene} from './worldweaver-visual-scene-v1.mjs';
import {buildOpenSimGeometry} from './worldweaver-opensim-geometry-v1.mjs';
import {projectWorld2D} from './worldweaver-map-2d-v1.mjs';
import {starlingNpcCommand} from './worldweaver-starling-bridge-v1.mjs';

export const COMMUNE_WORLD_KIND='civweave.worldweaver-commune.v1';
const validGuild=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,180}$/.test(x);
const ref=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/.test(x);
const copy=x=>JSON.parse(JSON.stringify(x));
const named=[
 {guide:'merlin',title:'Starling Commons',description:'Collective conversation, proposals and shared decisions.'},
 {guide:'moss',title:'Living School',description:'Study and shared learning.'},
 {guide:'kamiya',title:'Quest Forge',description:'Making, evidence and review.'},
 {guide:'rook',title:'FellowFare Hall',description:'Resources, tools and authorized exchanges.'}
];
export function createCommuneWorldHost({guildId,mesh,founder,verifyReader,clock=()=>new Date().toISOString(),id=()=>crypto.randomUUID()}={}){
 if(!validGuild(guildId)||!mesh?.getObject||!mesh?.createObject||!mesh?.validateObject||!mesh?.deviceId||
    typeof founder!=='function'||typeof verifyReader!=='function')
   throw new TypeError('Worldweaver commune requires a Guild, canonical signed mesh, founder and reader policy.');
 let closed=false,revision=-1,packet=null,layoutCache=null,activeRef=null,subs=new Set(),meshUnsub=null,writing=false;
 const objectId='worldweaver-commune:'+guildId;
 const tell=()=>{for(const callback of [...subs])try{callback()}catch{}};
 async function genesis(){
  const row=await mesh.getObject('guild-genesis:'+guildId);
  if(row?.kind!=='civweave.guild-genesis.v1'||row.payload?.guildId!==guildId||
     row.payload?.foundingDeviceId!==row.origin?.nodeId||
     (await mesh.validateObject(row))?.ok!==true)
    throw new Error('Valid signed Guild genesis is required to use a shared Worldweaver commune.');
  return row;
 }
 async function reader(){
  if(closed)throw new Error('Worldweaver host closed.');
  if(verifyReader(guildId)!==true)throw new Error('Current Guild membership is required to view its commune.');
  return genesis();
 }
 async function foundingWriter(){
  const record=await reader(),who=founder();
  if(who?.guildId!==guildId||who.deviceId!==record.origin.nodeId||
     (await mesh.deviceId())!==record.origin.nodeId)
    throw new Error('Only the verified Guild founding device can provision the initial local world.');
  return record;
 }
 function validPacket(row,genesis){
  const p=row?.payload;
  if(row?.kind!==COMMUNE_WORLD_KIND||row.consent!=='group'||
      !Array.isArray(row.audience)||!row.audience.includes('guild:'+guildId)||
      row.origin?.nodeId!==genesis.origin.nodeId||p?.schema!==COMMUNE_WORLD_KIND||
      p.guildId!==guildId||p.snapshot?.schema!==WORLDWEAVER_SCHEMA||
      !Number.isSafeInteger(p.snapshot.revision)||p.snapshot.revision<1||
      !ref(p.worldRef)||!Array.isArray(p.snapshot.instances)||
      !p.snapshot.instances.some(x=>x.id===p.worldRef&&x.guildId===guildId&&x.status==='live'&&x.world?.backend==='local-renderer'))
    return false;
  return true;
 }
 async function refresh(){
  const founding=await reader();
  const row=await mesh.getObject(objectId);
  if(!row){packet=null;layoutCache=null;activeRef=null;revision=-1;tell();return null}
  if(!validPacket(row,founding)||(await mesh.validateObject(row))?.ok!==true)
    throw new Error('Worldweaver commune record is invalid or not signed by this Guild founder.');
  if(row.revision!==revision){revision=row.revision;packet=copy(row.payload);activeRef=packet.worldRef;layoutCache=null;tell()}
  return copy(packet);
 }
 function getSnapshot(){return packet?copy(packet.snapshot):null}
 function worldRef(){return activeRef||packet?.worldRef||null}
 function selectRoom(worldId){
  const match=packet?.snapshot.instances.find(row=>row.id===worldId&&row.guildId===guildId&&row.status==='live'&&row.world?.backend==='local-renderer');
  if(!match)throw new RangeError('Selected Worldweaver room is unavailable to this Guild.');
  if(activeRef!==worldId){activeRef=worldId;layoutCache=null;tell()}
  return match;
 }
 function getLayout(){
  if(!packet)return {};
  // One immutable revisioned geometry object is consumed by 2D and 3D.
  if(!layoutCache){
    const scene=createProvisionalOpenSimScene({instanceId:worldRef(),revision:packet.snapshot.revision});
    layoutCache=Object.freeze({sceneGeometry:buildOpenSimGeometry(scene)});
  }
  return layoutCache;
 }
 async function provision({rendererReady}={}){
  const genesis=await foundingWriter();
  if(packet)return copy(packet);
  const existing=await mesh.getObject(objectId);
  if(existing)return refresh();
  if(typeof rendererReady!=='function')throw new TypeError('Local renderer verification is required before provisioning.');
  // Authorization is object-identity based, supplied by the verified founder path;
  // nothing in untrusted model output can create principal credentials.
  const human=Object.freeze({kind:'human',principalId:genesis.origin.nodeId});
  const renderer=Object.freeze({kind:'runtime',principalId:'civweave:local-renderer'});
  const world=createWorldweaver({id,clock,authorize:({actor,command})=>
    actor===human&&['create','add-station','create-screen','request-provision'].includes(command.type)||
    actor===renderer&&command.type==='provisioned'
  });
  const rooms=[];
  for(const row of named){
   const room=world.dispatch({type:'create',guide:row.guide,title:row.title,description:row.description,
      scope:'guild-map',guildId},human).instance;
   rooms.push(room);
  }
  const primary=rooms[0];
  world.dispatch({type:'create-screen',instanceId:primary.id,title:'Communal presentation screen'},human);
  world.dispatch({type:'add-station',instanceId:primary.id,stationType:'display',
     title:'Shared work display',instructions:'Show only reviewed Guild content with authorized source references.'},human);
  const scene=buildOpenSimGeometry(createProvisionalOpenSimScene({instanceId:primary.id}));
  // Both renderers consume the exact same canonical manifest and source geometry.
  const projection=projectWorld2D(world.snapshot(),{worldRef:primary.id,layout:{sceneGeometry:scene},includeDrafts:true});
  if(!projection.nodes?.length||!scene.faces?.length||await rendererReady({snapshot:world.snapshot(),geometry:scene,projection})!==true)
    throw new Error('The local 2D/3D renderer could not be verified. No world was provisioned.');
  for(const room of rooms)world.dispatch({type:'request-provision',instanceId:room.id},human);
  for(const room of rooms)world.dispatch({type:'provisioned',instanceId:room.id,backend:'local-renderer',
    worldRef:room.id},renderer);
  const snapshot=world.snapshot(),at=clock();
  const payload={schema:COMMUNE_WORLD_KIND,guildId,worldRef:primary.id,snapshot,createdAt:at,
     geometrySource:'provisional',backend:'local-renderer',status:'live-local'};
  await mesh.createObject({id:objectId,revision:1,kind:COMMUNE_WORLD_KIND,
     purpose:'Guild-founder signed local Worldweaver commune manifest, not a hosted 3D or simulated agent run.',
     consent:'group',audience:['guild:'+guildId],publish:true,priority:55,payload});
  return refresh();
 }
 /**
  * A human founding-device action to register a configured model as an NPC
  * candidate. The registration does NOT authorize generation or impersonate
  * an authenticated model principal. Actual tool submission remains blocked
  * until a trusted model-runtime credential adapter exists.
  */
 async function registerPilot({personaId,modelId}={}){
  if(writing)throw new Error('Worldweaver already has a pending signed change.');
  writing=true;
  try{
   const signer=await foundingWriter();
   if(!packet)throw new Error('Provision the signed Guild world before registering a pilot.');
   if(typeof modelId!=='string'||!ref(modelId)||modelId.length>180)
     throw new TypeError('A selected local model identifier is required.');
   const current=await mesh.getObject(objectId);
   if(!current||!validPacket(current,signer)||(await mesh.validateObject(current))?.ok!==true||
      current.revision!==revision)
     throw new Error('Worldweaver revision changed; reload before modifying the Guild world.');
   if(packet.snapshot.npcs.some(row=>row.instanceId===worldRef()&&row.personaRef==='starling:'+personaId))
     throw new Error('This Starling persona is already registered in the selected world.');
   if(packet.snapshot.npcs.filter(row=>row.instanceId===worldRef()).length>=24)
     throw new Error('Worldweaver room has reached its NPC limit.');
   const owner=Object.freeze({kind:'human',principalId:signer.origin.nodeId});
   const world=createWorldweaver({initialState:packet.snapshot,id,clock,
      authorize:({actor,command})=>actor===owner&&command.type==='rig-npc'});
   const command=starlingNpcCommand({
     personaId,instanceId:worldRef(),modelId,
     pilotPrincipalId:'starling-pilot:'+guildId+':'+personaId,
     capabilities:['observe','inspect','speak','move','demonstrate','present']
   });
   const receipt=world.dispatch(command,owner);
   const updated={...packet,snapshot:world.snapshot(),updatedAt:clock()};
   await mesh.createObject({id:objectId,revision:current.revision+1,
     kind:COMMUNE_WORLD_KIND,
     purpose:'Guild-founder signed Worldweaver NPC pilot registration. No model execution was authorized.',
     consent:'group',audience:['guild:'+guildId],publish:true,priority:55,payload:updated});
   await refresh();
   return receipt.npc;
  }finally{writing=false}
 }
 function subscribe(callback){
  if(typeof callback!=='function')throw new TypeError('Callback required');
  subs.add(callback);return()=>subs.delete(callback);
 }
 function connect(){
  if(meshUnsub||typeof mesh.subscribe!=='function')return;
  meshUnsub=mesh.subscribe(event=>{
   if(closed)return;
   if(['object-created','object-received'].includes(event?.type)&&
      event.detail?.kind===COMMUNE_WORLD_KIND){void refresh().catch(()=>{})}
  });
 }
 function close(){
  closed=true;subs.clear();if(typeof meshUnsub==='function')meshUnsub();meshUnsub=null;
 }
 connect();
 return Object.freeze({guildId,refresh,provision,registerPilot,getSnapshot,getLayout,worldRef,selectRoom,subscribe,close,
   get status(){return packet?'live-local':'unprovisioned'}});
}
