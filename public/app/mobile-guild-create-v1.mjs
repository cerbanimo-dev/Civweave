import {completeGuildHostOnboarding} from './guild-host-onboarding-v1.mjs';

export const MOBILE_GUILD_CREATE_SCHEMA='civweave.mobile-guild-create.v1';
const STATE_KEY='civweave.mobile-guild.v1';
const STEWARD_KEY='civweave.host-steward.v1';
const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const slug=value=>clean(value,120).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,42)||'guild';
const randomSuffix=()=>{try{return [...crypto.getRandomValues(new Uint8Array(5))].map(value=>value.toString(36)).join('').slice(0,8)}catch{return Math.random().toString(36).slice(2,10)}};
const read=()=>{try{return JSON.parse(globalThis.localStorage?.getItem(STATE_KEY)||'null')}catch{return null}};
const write=value=>{try{globalThis.localStorage?.setItem(STATE_KEY,JSON.stringify(value));globalThis.localStorage?.setItem(STEWARD_KEY,'1')}catch{}return value};

async function loadClassic(src,globalName){
  if(globalThis[globalName])return globalThis[globalName];
  await new Promise((resolve,reject)=>{const existing=[...(document.scripts||[])].find(script=>String(script.src||'').includes(src));if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error(`Could not load ${src}.`)),{once:true});return}const script=document.createElement('script');script.src=src;script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script)});
  if(!globalThis[globalName])throw new Error(`${globalName} did not become available.`);return globalThis[globalName];
}
export async function ensurePocketMesh(){return loadClassic('/app/local-object-mesh-v146.js','CivweaveLocalMeshV146')}
export function createGuildId(displayName){return `${slug(displayName)}-${randomSuffix()}`}

export async function createMobileGuild({displayName,guildId=''}={}){
  const name=clean(displayName,120);if(!name)throw new TypeError('Give the Guild a name first.');
  const id=clean(guildId,180)||createGuildId(name);
  const mesh=await ensurePocketMesh();
  const onboarding=await completeGuildHostOnboarding({guildId:id,primaryOrigin:null,route:'pocket-node',enablePocketNode:true});
  if(!onboarding.pocketNodeEnrolled)throw new Error(onboarding.pocketNodeError||'This device could not enroll as the Pocket Guild host.');
  const deviceId=await mesh.deviceId();
  const createdAt=now();
  const genesis=await mesh.createObject({
    id:`guild-genesis:${id}`,
    revision:1,
    kind:'civweave.guild-genesis.v1',
    purpose:'Create an independent Pocket Guild whose first canonical replica lives on this device.',
    consent:'group',
    audience:[`guild:${id}`],
    publish:true,
    priority:100,
    payload:{schema:'civweave.guild-genesis.v1',guildId:id,displayName:name,foundingDeviceId:deviceId,hostRoute:'pocket-node',cloudAttached:false,workerCreated:false,downloadOriginUsedAsBackend:false,createdAt},
  });
  const state=Object.freeze({schema:MOBILE_GUILD_CREATE_SCHEMA,guildId:id,displayName:name,deviceId,route:'pocket-node',cloudAttached:false,workerCreated:false,downloadOriginUsedAsBackend:false,createdAt,genesisObjectId:genesis.id});
  write(state);
  if(typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('civweave:mobile-guild-created',{detail:state}));
  return state;
}

export function mobileGuildStatus(){return read()}

export const CivweaveMobileGuildCreateV1=Object.freeze({schema:MOBILE_GUILD_CREATE_SCHEMA,ensurePocketMesh,createGuildId,createMobileGuild,mobileGuildStatus});
globalThis.CivweaveMobileGuildCreateV1=CivweaveMobileGuildCreateV1;
