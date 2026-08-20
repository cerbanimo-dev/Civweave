import {completeGuildHostOnboarding} from './guild-host-onboarding-v1.mjs';
import {CivweavePocketGuildNodeV1} from './pocket-guild-node-v1.mjs';

export const MOBILE_GUILD_CREATE_SCHEMA='civweave.mobile-guild-create.v3';
export const MOBILE_GUILD_EDGE_TEMPLATE_PATH='cloudflare/mobile-guild-edge';
const STATE_KEY='civweave.mobile-guild.v1';
const STEWARD_KEY='civweave.host-steward.v1';
const DIRECTORY_STATUS_KEY='civweave.mobile-guild.directory-status.v1';
const DIRECTORY_REGISTER_PATH='/api/guild-directory-register';
const DIRECTORY_PROOF_KIND='civweave.guild-directory-registration.v1';
const HISTORICAL_DIRECTORY_KINDS=new Set(['civweave.guild-genesis.v1','civweave.guild-edge-attachment.v1','civweave.guild-location-update.v1']);
const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const slug=value=>clean(value,120).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,42)||'guild';
const randomSuffix=()=>{try{return [...crypto.getRandomValues(new Uint8Array(5))].map(value=>value.toString(36)).join('').slice(0,8)}catch{return Math.random().toString(36).slice(2,10)}};
const b64url=bytes=>{let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'')};
const randomSecret=()=>{const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return b64url(bytes)};
const read=()=>{try{return JSON.parse(globalThis.localStorage?.getItem(STATE_KEY)||'null')}catch{return null}};
const write=value=>{try{globalThis.localStorage?.setItem(STATE_KEY,JSON.stringify(value));globalThis.localStorage?.setItem(STEWARD_KEY,'1')}catch{}return value};
function urlCharterContext(){try{const params=new URLSearchParams(globalThis.location?.search||'');const charterId=clean(params.get('charter'),180);if(!charterId)return null;const route=clean(params.get('charterRoute'),40);const sourceGuildId=clean(params.get('charterSource'),180);return Object.freeze({schema:'civweave.guild-charter-provenance.v1',charterId,route:['founder-transfer','mentor-direct'].includes(route)?route:null,sourceGuildId:sourceGuildId||null,capturedAt:now()})}catch{return null}}
function normalizeCharterContext(value){if(!value)return urlCharterContext();const charterId=clean(value.charterId||value.id,180);if(!charterId)return urlCharterContext();const route=clean(value.route,40);return Object.freeze({schema:'civweave.guild-charter-provenance.v1',charterId,route:['founder-transfer','mentor-direct'].includes(route)?route:null,sourceGuildId:clean(value.sourceGuildId||value.charterkeeperNodeId,180)||null,capturedAt:now()})}

async function loadClassic(src,globalName){
  if(globalThis[globalName])return globalThis[globalName];
  if(typeof document==='undefined')throw new Error(`${globalName} is not available in this runtime.`);
  await new Promise((resolve,reject)=>{const existing=[...(document.scripts||[])].find(script=>String(script.src||'').includes(src));if(existing){if(globalThis[globalName])return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error(`Could not load ${src}.`)),{once:true});return}const script=document.createElement('script');script.src=src;script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script)});
  if(!globalThis[globalName])throw new Error(`${globalName} did not become available.`);return globalThis[globalName];
}
export async function ensurePocketMesh(){return loadClassic('/app/local-object-mesh-v146.js','CivweaveLocalMeshV146')}
export function createGuildId(displayName){return `${slug(displayName)}-${randomSuffix()}`}
function normalizeEdgeOrigin(value){const url=new URL(clean(value,2000));if(url.protocol!=='https:')throw new TypeError('The Guild public edge must use HTTPS.');url.pathname='/';url.search='';url.hash='';return url.origin}
function normalizeCloudUrl(value){try{const url=new URL(clean(value,2000));return url.protocol==='https:'?url.href.replace(/\/$/,''):null}catch{return null}}
function normalizeCloudFabric(value,origin){if(!value||typeof value!=='object')return null;const starterNodes=Array.isArray(value.starterNodes)?value.starterNodes.slice(0,12).map(node=>{const nodeId=clean(node?.nodeId,180),publicOrigin=normalizeCloudUrl(node?.publicOrigin);if(!nodeId||!publicOrigin)return null;return Object.freeze({nodeId,publicOrigin,runtime:clean(node?.runtime,80)||'cloudflare-workers-ai'})}).filter(Boolean):[];return Object.freeze({schema:clean(value.schema,120)||'civweave.guild-cloud-fabric.v1',status:clean(value.status,40)||'unknown',capacityOrigin:normalizeCloudUrl(value.capacityOrigin)||`${origin}/api/fabric/capacity`,manifestOrigin:normalizeCloudUrl(value.manifestOrigin)||`${origin}/api/fabric/manifest`,aiEnabled:Boolean(value.aiEnabled),starterNodes})}
function deployTemplateRef(){const explicit=clean(globalThis.CIVWEAVE_GUILD_EDGE_TEMPLATE_REF,120);if(explicit)return explicit;const host=clean(globalThis.location?.hostname,300).toLowerCase();return host.includes('staging')?'staging':'main'}
export function cloudflareDeployUrl(){const repo=`https://github.com/cerbanimo-dev/Civweave/tree/${encodeURIComponent(deployTemplateRef())}/${MOBILE_GUILD_EDGE_TEMPLATE_PATH}`;return `https://deploy.workers.cloudflare.com/?url=${encodeURIComponent(repo)}`}
function withCloudCredentials(input){const state=input&&typeof input==='object'?{...input}:null;if(!state)return null;if(state.cloudAttached)return state;let changed=false;if(!/^[A-Za-z0-9_-]{40,200}$/.test(state.membershipKey||'')){state.membershipKey=randomSecret();changed=true}if(!/^[A-Za-z0-9_-]{40,200}$/.test(state.cloudPairingCode||'')){state.cloudPairingCode=randomSecret();changed=true}if(state.schema!==MOBILE_GUILD_CREATE_SCHEMA){state.schema=MOBILE_GUILD_CREATE_SCHEMA;changed=true}if(!state.cloudStage){state.cloudStage='ready-to-connect';changed=true}if(changed){state.updatedAt=now();write(state)}return state}
export function prepareCloudflareEdge(){const state=withCloudCredentials(read());if(!state)throw new Error('Create the local Guild before connecting Cloudflare.');return Object.freeze({...state,deployUrl:cloudflareDeployUrl()})}

function publicLocationFromPosition(position,{precise=false}={}){
  const latitude=Number(position?.coords?.latitude),longitude=Number(position?.coords?.longitude),accuracyMeters=Number(position?.coords?.accuracy),capturedAt=new Date(position?.timestamp||Date.now()).toISOString();
  if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)throw new Error('The Guild location reading was invalid.');
  if(!Number.isFinite(accuracyMeters)||accuracyMeters<=0||accuracyMeters>5000)throw new Error('The Guild location reading is too broad. Move outdoors or near a window and try again.');
  if(precise&&accuracyMeters>250)throw new Error('A precise public Guild pin needs a location reading within 250 meters.');
  const coordinateDecimals=precise?6:3;
  return Object.freeze({schema:'civweave.hub-location.v1',latitude:Number(latitude.toFixed(coordinateDecimals)),longitude:Number(longitude.toFixed(coordinateDecimals)),precisionMeters:precise?Math.max(1,Math.ceil(accuracyMeters)):Math.max(100,Math.ceil(accuracyMeters/100)*100),coordinateDecimals,source:'guildkeeper-browser-geolocation',capturedAt,syncedAt:now()});
}
export function bestGuildLocation(){
  return new Promise((resolve,reject)=>{
    if(globalThis.isSecureContext===false)return reject(new Error('Guild setup needs an HTTPS page before it can request location.'));
    const geolocation=globalThis.navigator?.geolocation;if(!geolocation)return reject(new Error('This device cannot provide the Guild location. Location is required during Guild setup.'));
    let best=null,finished=false,watchId=null;
    const finish=(error=null)=>{if(finished)return;finished=true;if(watchId!==null)geolocation.clearWatch?.(watchId);clearTimeout(timer);if(best)return resolve(best);reject(error||new Error('No Guild location reading was available.'))};
    const timer=setTimeout(()=>finish(new Error('The Guild location did not settle. Move outdoors or near a window and try again.')),15000);
    watchId=geolocation.watchPosition(position=>{if(!best||position.coords.accuracy<best.coords.accuracy)best=position;if(best.coords.accuracy<=50)finish()},error=>finish(new Error(error?.code===1?'Location permission is required to create a Guild. Enable it for Civweave and try again.':'The Guild location could not be read. Move outdoors or near a window and try again.')),{enableHighAccuracy:true,maximumAge:0,timeout:14000});
  });
}
export async function captureGuildLocation({precise=false,position=null}={}){return publicLocationFromPosition(position||await bestGuildLocation(),{precise})}

function directoryRegisterUrl(){try{const origin=clean(globalThis.location?.origin,1000);if(!/^https?:\/\//i.test(origin))return null;return new URL(DIRECTORY_REGISTER_PATH,origin)}catch{return null}}
function writeDirectoryStatus(value,state=read()){
  const packet=Object.freeze({schema:'civweave.mobile-guild-directory-status.v1',guildId:state?.guildId||null,publicOrigin:state?.primaryOrigin||null,ok:Boolean(value?.ok),status:clean(value?.status,80)||'pending',error:value?.error?clean(value.error,600):null,registration:value?.registration||null,updatedAt:now()});
  try{globalThis.localStorage?.setItem(DIRECTORY_STATUS_KEY,JSON.stringify(packet))}catch{}
  const node=globalThis.document?.getElementById?.('mobile-guild-cloud-status');
  if(node&&state?.cloudAttached){
    node.dataset.state=packet.ok?'ready':'failed';
    node.textContent=packet.ok?`Guild online and published to the Guild Map. ${state.primaryOrigin||''}`.trim():`Guild online, but Guild Map listing is pending: ${packet.error||'directory publication did not complete.'}`;
  }
  try{globalThis.dispatchEvent?.(new CustomEvent('civweave:mobile-guild-directory-status',{detail:packet}))}catch{}
  return packet;
}
async function directoryRegistrationProof(current,mesh=null){
  const runtime=mesh||await ensurePocketMesh(),publicOrigin=normalizeEdgeOrigin(current.primaryOrigin),requestedAt=now();
  const proof=await runtime.createObject({id:`guild-directory-registration:${current.guildId}:${Date.now()}`,revision:1,kind:DIRECTORY_PROOF_KIND,purpose:'Authorize this founding device to publish the Guild location into the public Civweave Guild directory.',consent:'public',audience:[],publish:false,hopLimit:0,payload:{schema:DIRECTORY_PROOF_KIND,guildId:current.guildId,displayName:current.displayName,publicOrigin,location:current.location,requestedAt}});
  if(current.deviceId&&proof?.origin?.nodeId!==current.deviceId)throw new Error('The current signing key is not the Guild founding-device key.');
  return proof;
}
async function historicalDirectoryProofs(current,mesh){
  const rows=[],seen=new Set(),add=value=>{if(!value||!HISTORICAL_DIRECTORY_KINDS.has(clean(value.kind,160))||clean(value?.payload?.guildId,180)!==clean(current.guildId,180))return;if(value.revisionHash&&seen.has(value.revisionHash))return;if(value.revisionHash)seen.add(value.revisionHash);rows.push(value)};
  for(const id of [current.edgeAttachmentObjectId,current.genesisObjectId])if(id)try{add(await mesh.getObject(id))}catch{}
  try{for(const object of await mesh.listObjects())add(object)}catch{}
  rows.sort((a,b)=>{const priority=kind=>kind==='civweave.guild-location-update.v1'?3:kind==='civweave.guild-edge-attachment.v1'?2:1;return priority(b.kind)-priority(a.kind)||Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0)});
  return rows.slice(0,12);
}
export async function registerMobileGuildDirectory(input=read()){
  const current=input&&typeof input==='object'?input:read();if(!current?.cloudAttached||!current?.primaryOrigin||!current?.location)return Object.freeze({ok:false,status:'not-public-yet'});
  const endpoint=directoryRegisterUrl();if(!endpoint)return Object.freeze({ok:false,status:'browser-route-unavailable'});
  const mesh=await ensurePocketMesh();let proof=null,freshProofError=null;
  try{proof=await directoryRegistrationProof(current,mesh)}catch(error){freshProofError=String(error?.message||error)}
  const historicalProofs=await historicalDirectoryProofs(current,mesh);
  if(!proof&&!historicalProofs.length)throw new Error(freshProofError||'No founding-device signed Guild record remains on this device for directory recovery.');
  const response=await fetch(endpoint,{method:'POST',cache:'no-store',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({publicOrigin:normalizeEdgeOrigin(current.primaryOrigin),...(proof?{proof}:{}),historicalProofs})}),payload=await response.json().catch(()=>({}));
  if(!response.ok||payload?.ok!==true)throw new Error(payload?.error||payload?.message||freshProofError||`Guild directory returned HTTP ${response.status}.`);
  const result=Object.freeze({ok:true,status:'registered',registration:payload.registration||null});writeDirectoryStatus(result,current);
  try{globalThis.dispatchEvent?.(new CustomEvent('civweave:mobile-guild-directory-registered',{detail:{guildId:current.guildId,registration:payload.registration||null,at:now()}}))}catch{}
  return result;
}
async function registerDirectoryBestEffort(state){try{return await registerMobileGuildDirectory(state)}catch(error){const result=Object.freeze({ok:false,status:'pending',error:String(error?.message||error)});writeDirectoryStatus(result,state);return result}}

async function recordLocationObject(mesh,state,location){try{return await mesh.createObject({id:`guild-location:${state.guildId}:${Date.now()}`,revision:1,kind:'civweave.guild-location-update.v1',purpose:'Record the Guildkeeper-published map location for this Guild.',consent:'group',audience:[`guild:${state.guildId}`],publish:true,priority:100,payload:{schema:'civweave.guild-location-update.v1',guildId:state.guildId,location,updatedAt:now()}})}catch{return null}}
export async function updateMobileGuildLocation({precise=false,position=null}={}){
  const current=withCloudCredentials(read());if(!current)throw new Error('Create the local Guild before updating its location.');
  const proposed=await captureGuildLocation({precise,position});let location=proposed;
  if(current.cloudAttached&&current.primaryOrigin){
    const response=await fetch(new URL('/api/fabric/location',current.primaryOrigin),{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${current.membershipKey}`},body:JSON.stringify({...proposed,publicPrecision:precise?'precise':'rounded',accuracyMeters:proposed.precisionMeters})}),payload=await response.json().catch(()=>({}));
    if(response.ok&&payload?.ok===true){if(payload.location)location=payload.location}else if(![404,405].includes(response.status))throw new Error(payload?.error||`Guild public edge returned HTTP ${response.status}.`);
  }
  const updatedAt=location.syncedAt||now(),next=Object.freeze({...current,schema:MOBILE_GUILD_CREATE_SCHEMA,location,updatedAt});write(next);
  const mesh=await ensurePocketMesh();await recordLocationObject(mesh,next,location);if(next.cloudAttached)await registerDirectoryBestEffort(next);
  if(typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('civweave:mobile-guild-location-updated',{detail:next}));
  return Object.freeze({...next,deployUrl:cloudflareDeployUrl()});
}

export async function createMobileGuild({displayName,guildId='',charter=null}={}){
  const name=clean(displayName,120);if(!name)throw new TypeError('Give the Guild a name first.');
  const location=await captureGuildLocation({precise:false});
  const id=clean(guildId,180)||createGuildId(name),membershipKey=randomSecret(),cloudPairingCode=randomSecret(),charterContext=normalizeCharterContext(charter);
  const mesh=await ensurePocketMesh();
  const onboarding=await completeGuildHostOnboarding({guildId:id,primaryOrigin:null,membershipKey,route:'pocket-node',enablePocketNode:true});
  if(!onboarding.pocketNodeEnrolled)throw new Error(onboarding.pocketNodeError||'This device could not enroll as the Pocket Guild host.');
  const deviceId=await mesh.deviceId(),createdAt=now();
  const genesis=await mesh.createObject({id:`guild-genesis:${id}`,revision:1,kind:'civweave.guild-genesis.v1',purpose:'Create a Pocket-first Guild whose canonical identity begins on this device.',consent:'group',audience:[`guild:${id}`],publish:true,priority:100,payload:{schema:'civweave.guild-genesis.v1',guildId:id,displayName:name,foundingDeviceId:deviceId,hostRoute:'pocket-node',cloudAttached:false,workerCreated:false,downloadOriginUsedAsBackend:false,charter:charterContext,location,createdAt}});
  const state=Object.freeze({schema:MOBILE_GUILD_CREATE_SCHEMA,guildId:id,displayName:name,deviceId,route:'pocket-node',cloudAttached:false,workerCreated:false,cloudStage:'ready-to-connect',membershipKey,cloudPairingCode,downloadOriginUsedAsBackend:false,charter:charterContext,location,createdAt,updatedAt:createdAt,genesisObjectId:genesis.id});write(state);
  if(typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('civweave:mobile-guild-created',{detail:state}));
  return Object.freeze({...state,deployUrl:cloudflareDeployUrl()});
}

export async function attachCloudflareEdge({primaryOrigin}={}){
  let state=withCloudCredentials(read());if(!state)throw new Error('Create the local Guild before pairing a public edge.');if(state.cloudAttached){await registerDirectoryBestEffort(state);return Object.freeze({...state,deployUrl:cloudflareDeployUrl()})}
  if(!state.location){state=await updateMobileGuildLocation({precise:false})}
  const origin=normalizeEdgeOrigin(primaryOrigin),response=await fetch(new URL('/api/guild/claim',origin),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({guildId:state.guildId,displayName:state.displayName,foundingDeviceId:state.deviceId,claimToken:state.cloudPairingCode,membershipKey:state.membershipKey,charter:state.charter||undefined,location:state.location})});
  const payload=await response.json().catch(()=>({}));if(!response.ok||payload?.ok!==true)throw new Error(payload?.error||`Guild public edge returned HTTP ${response.status}.`);if(payload.guildId&&payload.guildId!==state.guildId)throw new Error('The deployed public edge belongs to a different Guild ID.');
  const cloudFabric=normalizeCloudFabric(payload.infrastructure,origin);await CivweavePocketGuildNodeV1.attachPrimary(origin,{membershipKey:state.membershipKey});
  const mesh=await ensurePocketMesh(),attachedAt=now();
  const attachment=await mesh.createObject({id:`guild-edge:${state.guildId}`,revision:1,kind:'civweave.guild-edge-attachment.v1',purpose:'Attach this Guild identity to its Guildkeeper-owned always-online Cloudflare Guild fabric.',consent:'group',audience:[`guild:${state.guildId}`],publish:true,priority:100,payload:{schema:'civweave.guild-edge-attachment.v1',guildId:state.guildId,primaryOrigin:origin,cloudProvider:'cloudflare',workerCreated:true,downloadOriginUsedAsBackend:false,cloudFabric,charter:state.charter||null,location:payload.location||state.location,attachedAt}});
  const next=Object.freeze({...state,schema:MOBILE_GUILD_CREATE_SCHEMA,cloudAttached:true,workerCreated:true,cloudStage:'online',primaryOrigin:origin,primaryGateway:payload.primaryGateway||origin,cloudFabric,location:payload.location||state.location,cloudPairingCode:null,edgeAttachmentObjectId:attachment.id,attachedAt,updatedAt:attachedAt});write(next);
  try{await CivweavePocketGuildNodeV1.syncPrimary()}catch{}await registerDirectoryBestEffort(next);
  if(typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('civweave:mobile-guild-cloud-attached',{detail:next}));
  return Object.freeze({...next,deployUrl:cloudflareDeployUrl()});
}

export function mobileGuildStatus(){const state=read();return state?Object.freeze({...state,deployUrl:cloudflareDeployUrl()}):null}

function selfHealPublicDirectory(){
  const eligible=()=>{const state=read();return state?.cloudAttached&&state?.primaryOrigin&&state?.location?state:null};
  if(!eligible())return false;
  const run=()=>{const state=eligible();if(state)void registerDirectoryBestEffort(state)};
  const schedule=()=>[250,2500,8000].forEach(delay=>setTimeout(run,delay));
  if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  globalThis.addEventListener?.('pageshow',()=>setTimeout(run,250));
  globalThis.addEventListener?.('online',()=>setTimeout(run,250));
  return true;
}

export const CivweaveMobileGuildCreateV1=Object.freeze({schema:MOBILE_GUILD_CREATE_SCHEMA,ensurePocketMesh,createGuildId,cloudflareDeployUrl,prepareCloudflareEdge,bestGuildLocation,captureGuildLocation,registerMobileGuildDirectory,updateMobileGuildLocation,createMobileGuild,attachCloudflareEdge,mobileGuildStatus,urlCharterContext,selfHealPublicDirectory});
globalThis.CivweaveMobileGuildCreateV1=CivweaveMobileGuildCreateV1;
selfHealPublicDirectory();
