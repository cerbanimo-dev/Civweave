/**
 * Read-only adapter from the canonical Starling persona catalog to Worldweaver.
 * No duplicate personas, Starling inference loops, Guild authority or avatar store.
 */
import {STARLING_PERSONAS} from './starling-collective-v1.mjs';
const small=(value,max=800)=>typeof value==='string'?value.slice(0,max):'';
export function starlingAvatarSeed(personaId){
  const p=STARLING_PERSONAS[personaId];
  if(!p)throw new TypeError('Unknown Starling persona.');
  return Object.freeze({
    personaId:p.id,
    name:p.name,
    role:p.role,
    description:small(`${p.role}. ${p.style}. ${p.goal}`,1200),
    referenceAsset:`/app/assets/starling/${p.id}.svg`,
    style:p.style,
    goal:p.goal
  });
}
export function starlingRoster(){
  return Object.freeze(Object.keys(STARLING_PERSONAS).map(starlingAvatarSeed));
}
/** Prepare a standard rig-npc command for the shared Worldweaver dispatch.
 * Actual model identity must still be checked by Worldweaver's trusted authorizer.
 * Model assignment is supplied by Starling's current execution owner, not inferred.
 */
export function starlingNpcCommand({personaId,instanceId,modelId,pilotPrincipalId,capabilities}={}){
  const p=STARLING_PERSONAS[personaId];
  if(!p)throw new TypeError('Unknown Starling persona.');
  const seed=starlingAvatarSeed(personaId);
  return {
    type:'rig-npc',
    instanceId,
    modelId,
    pilotPrincipalId,
    name:p.name,
    personaRef:`starling:${p.id}`,
    appearanceRef:seed.referenceAsset,
    pilotPrompt:small(`You are ${p.name}, a fictional Starling collaborator. Role: ${p.role}. Character style: ${p.style}. Working goal: ${p.goal}. Act in this simulated world using only permitted tools. Do not claim to be a human Guild member. Leave payments, voting, publishing, and Quest proof to their actual authorities.`,2500),
    capabilities:capabilities??['observe','inspect','speak','move','demonstrate','present']
  };
}
