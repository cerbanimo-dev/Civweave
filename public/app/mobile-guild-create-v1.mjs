import {completeGuildHostOnboarding} from './guild-host-onboarding-v1.mjs';
import {CivweavePocketGuildNodeV1} from './pocket-guild-node-v1.mjs';

export const MOBILE_GUILD_CREATE_SCHEMA='civweave.mobile-guild-create.v2';
export const MOBILE_GUILD_EDGE_TEMPLATE_PATH='cloudflare/mobile-guild-edge';
const STATE_KEY='civweave.mobile-guild.v1';
const STEWARD_KEY='civweave.host-steward.v1';
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

export async function createMobileGuild({displayName,guildId='',charter=null}={}){
  const name=clean(displayName,120);if(!name)throw new TypeError('Give the Guild a name first.');
  const id=clean(guildId,180)||createGuildId(name),membershipKey=randomSecret(),cloudPairingCode=randomSecret(),charterContext=normalizeCharterContext(charter);
  const mesh=await ensurePocketMesh();
  const onboarding=await completeGuildHostOnboarding({guildId:id,primaryOrigin:null,membershipKey,route:'pocket-node',enablePocketNode:true});
  if(!onboarding.pocketNodeEnrolled)throw new Error(onboarding.pocketNodeError||'This device could not enroll as the Pocket Guild host.');
  const deviceId=await mesh.deviceId(),createdAt=now();
  const genesis=await mesh.createObject({
    id:`guild-genesis:${id}`,
    revision:1,
    kind:'civweave.guild-genesis.v1',
    purpose:'Create a Pocket-first Guild whose canonical identity begins on this device.',
    consent:'group',
    audience:[`guild:${id}`],
    publish:true,
    priority:100,
    payload:{schema:'civweave.guild-genesis.v1',guildId:id,displayName:name,foundingDeviceId:deviceId,hostRoute:'pocket-node',cloudAttached:false,workerCreated:false,downloadOriginUsedAsBackend:false,charter:charterContext,createdAt},
  });
  const state=Object.freeze({schema:MOBILE_GUILD_CREATE_SCHEMA,guildId:id,displayName:name,deviceId,route:'pocket-node',cloudAttached:false,workerCreated:false,cloudStage:'ready-to-connect',membershipKey,cloudPairingCode,downloadOriginUsedAsBackend:false,charter:charterContext,createdAt,updatedAt:createdAt,genesisObjectId:genesis.id});
  write(state);
  if(typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('civweave:mobile-guild-created',{detail:state}));
  return Object.freeze({...state,deployUrl:cloudflareDeployUrl()});
}

export async function attachCloudflareEdge({primaryOrigin}={}){
  const state=withCloudCredentials(read());if(!state)throw new Error('Create the local Guild before pairing a public edge.');if(state.cloudAttached)return Object.freeze({...state,deployUrl:cloudflareDeployUrl()});
  const origin=normalizeEdgeOrigin(primaryOrigin),response=await fetch(new URL('/api/guild/claim',origin),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({guildId:state.guildId,displayName:state.displayName,foundingDeviceId:state.deviceId,claimToken:state.cloudPairingCode,membershipKey:state.membershipKey,charter:state.charter||undefined})});
  const payload=await response.json().catch(()=>({}));if(!response.ok||payload?.ok!==true)throw new Error(payload?.error||`Guild public edge returned HTTP ${response.status}.`);if(payload.guildId&&payload.guildId!==state.guildId)throw new Error('The deployed public edge belongs to a different Guild ID.');
  const cloudFabric=normalizeCloudFabric(payload.infrastructure,origin);
  await CivweavePocketGuildNodeV1.attachPrimary(origin,{membershipKey:state.membershipKey});
  const mesh=await ensurePocketMesh(),attachedAt=now();
  const attachment=await mesh.createObject({
    id:`guild-edge:${state.guildId}`,
    revision:1,
    kind:'civweave.guild-edge-attachment.v1',
    purpose:'Attach this Guild identity to its Guildkeeper-owned always-online Cloudflare Guild fabric.',
    consent:'group',
    audience:[`guild:${state.guildId}`],
    publish:true,
    priority:100,
    payload:{schema:'civweave.guild-edge-attachment.v1',guildId:state.guildId,primaryOrigin:origin,cloudProvider:'cloudflare',workerCreated:true,downloadOriginUsedAsBackend:false,cloudFabric,charter:state.charter||null,attachedAt},
  });
  const next=Object.freeze({...state,schema:MOBILE_GUILD_CREATE_SCHEMA,cloudAttached:true,workerCreated:true,cloudStage:'online',primaryOrigin:origin,primaryGateway:payload.primaryGateway||origin,cloudFabric,cloudPairingCode:null,edgeAttachmentObjectId:attachment.id,attachedAt,updatedAt:attachedAt});write(next);
  try{await CivweavePocketGuildNodeV1.syncPrimary()}catch{}
  if(typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('civweave:mobile-guild-cloud-attached',{detail:next}));
  return Object.freeze({...next,deployUrl:cloudflareDeployUrl()});
}

export function mobileGuildStatus(){const state=read();return state?Object.freeze({...state,deployUrl:cloudflareDeployUrl()}):null}

export const CivweaveMobileGuildCreateV1=Object.freeze({schema:MOBILE_GUILD_CREATE_SCHEMA,ensurePocketMesh,createGuildId,cloudflareDeployUrl,prepareCloudflareEdge,createMobileGuild,attachCloudflareEdge,mobileGuildStatus,urlCharterContext});
globalThis.CivweaveMobileGuildCreateV1=CivweaveMobileGuildCreateV1;