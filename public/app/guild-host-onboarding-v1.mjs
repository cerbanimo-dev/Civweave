import {POCKET_NODE_POLICY} from './shared/guild-host-resilience-v1.mjs';
import {CivweavePocketGuildNodeV1} from './pocket-guild-node-v1.mjs';

export const GUILD_HOST_ONBOARDING_SCHEMA='civweave.guild-host-onboarding.v1';
const STATE_KEY='civweave.guild-host-onboarding.v1';
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const read=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'null')}catch{return null}};
const write=value=>{try{localStorage.setItem(STATE_KEY,JSON.stringify(value))}catch{}return value};

export function classifyHostDevice({userAgent='',maxTouchPoints=0,coarsePointer=false}={}){
  const agent=String(userAgent||'');
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(agent)||Number(maxTouchPoints||0)>1&&coarsePointer===true;
  if(mobile)return 'mobile';
  if(/CrOS/i.test(agent))return 'desktop';
  return 'desktop';
}

export function recommendedHostRoute({deviceClass='desktop',localMeshAvailable=true}={}){
  if(deviceClass==='mobile'&&localMeshAvailable)return 'pocket-node';
  return 'persistent-local-node';
}

export function deviceCapabilities(){
  const coarsePointer=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
  const deviceClass=classifyHostDevice({userAgent:navigator?.userAgent||'',maxTouchPoints:navigator?.maxTouchPoints||0,coarsePointer});
  const localMeshAvailable=Boolean(globalThis.CivweaveLocalMeshV146?.credential&&globalThis.CivweaveLocalMeshV146?.syncGateway);
  return Object.freeze({deviceClass,localMeshAvailable,recommendedRoute:recommendedHostRoute({deviceClass,localMeshAvailable}),persistentAlternatives:POCKET_NODE_POLICY.persistentAlternatives});
}

export async function completeGuildHostOnboarding({guildId,primaryOrigin=location.origin,route='auto',enablePocketNode=true}={}){
  const id=clean(guildId,180);if(!id)throw new TypeError('guildId is required.');
  const origin=new URL(primaryOrigin||location.origin).origin;
  const capabilities=deviceCapabilities();
  const selectedRoute=route==='auto'?capabilities.recommendedRoute:clean(route,80);
  const shouldEnrollPocket=enablePocketNode!==false&&(selectedRoute==='pocket-node'||capabilities.deviceClass==='mobile');
  let pocketNode=null,pocketNodeError=null;
  if(shouldEnrollPocket){
    try{pocketNode=await CivweavePocketGuildNodeV1.enroll({guildId:id,primaryOrigin:origin})}
    catch(error){pocketNodeError=String(error?.message||error)}
  }
  const state=Object.freeze({
    schema:GUILD_HOST_ONBOARDING_SCHEMA,
    guildId:id,
    primaryOrigin:origin,
    premierRoute:POCKET_NODE_POLICY.routeId,
    selectedRoute,
    deviceClass:capabilities.deviceClass,
    pocketNodeRequested:shouldEnrollPocket,
    pocketNodeEnrolled:Boolean(pocketNode?.enrolled),
    pocketNodeError,
    persistentAlternatives:POCKET_NODE_POLICY.persistentAlternatives,
    completedAt:now(),
  });
  write(state);
  globalThis.dispatchEvent?.(new CustomEvent('civweave:guild-host-onboarding-complete',{detail:state}));
  return Object.freeze({...state,pocketNode});
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
