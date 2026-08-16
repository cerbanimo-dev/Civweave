import {POCKET_NODE_POLICY} from './shared/guild-host-resilience-v1.mjs';
import {CivweavePocketGuildNodeV1} from './pocket-guild-node-v1.mjs';
import {CivweaveEmergencyAiMeshV1} from './emergency-ai-mesh-v1.mjs';

export const GUILD_HOST_ONBOARDING_SCHEMA='civweave.guild-host-onboarding.v1';
const STATE_KEY='civweave.guild-host-onboarding.v1';
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const read=()=>{try{return JSON.parse(globalThis.localStorage?.getItem(STATE_KEY)||'null')}catch{return null}};
const write=value=>{try{globalThis.localStorage?.setItem(STATE_KEY,JSON.stringify(value))}catch{}return value};
const normalizedPrimary=value=>{if(value==null||value==='')return null;const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw new TypeError('primaryOrigin must use http or https.');url.hash='';url.search='';if(!url.pathname.endsWith('/'))url.pathname=`${url.pathname}/`;return url.href};

export function classifyHostDevice({userAgent='',maxTouchPoints=0,coarsePointer=false}={}){
  const agent=String(userAgent||'');
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(agent)||Number(maxTouchPoints||0)>1&&coarsePointer===true;
  if(mobile)return 'mobile';
  return 'desktop';
}

export function recommendedHostRoute({deviceClass='desktop',localMeshAvailable=true}={}){
  if(deviceClass==='mobile')return localMeshAvailable?'pocket-node':'cloudflare-host-node';
  return 'persistent-local-node';
}

export function deviceCapabilities(){
  const nav=globalThis.navigator||{};
  const coarsePointer=typeof globalThis.matchMedia==='function'&&globalThis.matchMedia('(pointer: coarse)').matches;
  const deviceClass=classifyHostDevice({userAgent:nav.userAgent||'',maxTouchPoints:nav.maxTouchPoints||0,coarsePointer});
  const localMeshAvailable=Boolean(globalThis.CivweaveLocalMeshV146?.credential&&globalThis.CivweaveLocalMeshV146?.configure);
  return Object.freeze({deviceClass,localMeshAvailable,recommendedRoute:recommendedHostRoute({deviceClass,localMeshAvailable}),persistentAlternatives:POCKET_NODE_POLICY.persistentAlternatives});
}

export async function completeGuildHostOnboarding({guildId,primaryOrigin=null,membershipKey=null,route='auto',enablePocketNode=true}={}){
  const id=clean(guildId,180);if(!id)throw new TypeError('guildId is required.');
  const origin=normalizedPrimary(primaryOrigin);
  const capabilities=deviceCapabilities();
  const selectedRoute=route==='auto'?capabilities.recommendedRoute:clean(route,80);
  const shouldEnrollPocket=enablePocketNode!==false&&selectedRoute==='pocket-node'&&capabilities.localMeshAvailable;
  let pocketNode=null,pocketNodeError=null,emergencyAiMesh=null,emergencyAiMeshError=null;
  if(shouldEnrollPocket){
    try{pocketNode=await CivweavePocketGuildNodeV1.enroll({guildId:id,primaryOrigin:origin,membershipKey})}
    catch(error){pocketNodeError=String(error?.message||error)}
  }
  if(capabilities.localMeshAvailable){
    try{emergencyAiMesh=await CivweaveEmergencyAiMeshV1.start({guildId:id,baseUrl:origin||''})}
    catch(error){emergencyAiMeshError=String(error?.message||error)}
  }
  const state=Object.freeze({
    schema:GUILD_HOST_ONBOARDING_SCHEMA,
    guildId:id,
    primaryOrigin:origin,
    cloudAttached:Boolean(origin),
    inheritedDownloadOrigin:false,
    premierRoute:POCKET_NODE_POLICY.routeId,
    selectedRoute,
    deviceClass:capabilities.deviceClass,
    pocketNodeRequested:shouldEnrollPocket,
    pocketNodeEnrolled:Boolean(pocketNode?.enrolled),
    pocketNodeError,
    emergencyAiMeshStarted:Boolean(emergencyAiMesh?.started),
    emergencyAiMeshError,
    persistentAlternatives:POCKET_NODE_POLICY.persistentAlternatives,
    completedAt:now(),
  });
  write(state);
  if(typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('civweave:guild-host-onboarding-complete',{detail:state}));
  return Object.freeze({...state,pocketNode,emergencyAiMesh});
}

export function onboardingStatus(){return read()}

export const CivweaveGuildHostOnboardingV1=Object.freeze({
  schema:GUILD_HOST_ONBOARDING_SCHEMA,
  policy:POCKET_NODE_POLICY,
  classifyHostDevice,
  recommendedHostRoute,
  deviceCapabilities,
  completeGuildHostOnboarding,
  onboardingStatus,
});
globalThis.CivweaveGuildHostOnboardingV1=CivweaveGuildHostOnboardingV1;