/**
 * A provider-neutral, opt-in handoff from an authenticated model pilot to the
 * one Worldweaver avatar proposal owner. No independent model runtime, no extra
 * Starling dialogue loop, and no implicit hosted inference.
 *
 * invokeModel is supplied by Civweave's selected local/consented cloud runtime.
 * It must enforce model capabilities, spend gates and device inference guards.
 */
import {validateAvatarPlan,avatarVisualRequest} from './worldweaver-avatar-v1.mjs';

function parseModelPlan(raw){
  let value=raw;
  if(value&&typeof value==='object'&&value.plan)value=value.plan;
  else if(value&&typeof value==='object'&&Array.isArray(value.choices))
    value=value.choices[0]?.message?.content;
  else if(value&&typeof value==='object'&&typeof value.content==='string')value=value.content;
  if(typeof value==='string'){
    if(value.length>32000)throw new TypeError('Model avatar response is too large.');
    try{value=JSON.parse(value)}catch{throw new TypeError('Model must return structured JSON for an avatar plan.')}
    if(value&&typeof value==='object'&&value.plan)value=value.plan;
  }
  return validateAvatarPlan(value);
}
/**
 * Produces a pending proposal only. It neither renders nor applies an avatar.
 * If inference fails or the plan is invalid, the existing NPC/rig is unchanged.
 */
export async function proposeAvatarViaModel({world,npcId,actor,seed,visionCapable=false,rasterImageDataUri,invokeModel}={}){
  if(!world?.dispatch||!world?.snapshot||typeof invokeModel!=='function')
    throw new TypeError('Worldweaver and an existing model runtime invoker are required.');
  const state=world.snapshot();
  const npc=state.npcs.find(x=>x.id===npcId);
  if(!npc)throw new RangeError('Unknown NPC.');
  if(actor?.kind!=='model'||actor.principalId!==npc.pilotPrincipalId||actor.modelId!==npc.modelId
    ||(npc.personaRef&&npc.personaRef!==actor.personaRef))
    throw new Error('Unverified or mismatched model pilot identity.');
  if(npc.personaRef&&npc.personaRef!==`starling:${seed?.personaId}`)
    throw new Error('Avatar reference is for the wrong persona.');
  if(visionCapable===true&&!rasterImageDataUri)
    throw new TypeError('A real raster image is required for a vision-capable avatar request.');
  const message=avatarVisualRequest(seed,{
    rasterImageDataUri:visionCapable===true?rasterImageDataUri:undefined,
    task:'Choose or build a faithful avatar body. Return a JSON object with format procedural-2d, 1-24 geometric parts, idle and optional other poses, and 0-16 safe event behaviors. This is a reversible proposal, not executable code.'
  });
  const reply=await invokeModel({
    modelId:npc.modelId,vision:message.vision,
    messages:[{role:'user',content:message.content}],
    responseFormat:'json',maxOutputTokens:2400,
    purpose:'worldweaver-avatar-proposal',
    npcId:npc.id
  });
  const plan=parseModelPlan(reply);
  return world.dispatch({type:'propose-avatar',npcId:npc.id,plan},actor).proposal;
}
