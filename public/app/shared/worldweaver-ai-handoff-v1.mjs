/**
 * The only Worldweaver-specific adapter for invoking the shared AI runtime.
 * A character response is queued as a canonical NPC intent, never executed.
 * Existing Worldweaver authority verifies the model pilot and tool capability.
 */
import {createWorldweaverAISession} from './worldweaver-ai-session-v1.mjs';

export function createConfiguredWorldweaverAISession({
  settings,runtime,consent=false,budget,pricePerMillion,tested=[]
}={}){
  if(typeof settings?.readWorldMode!=='function'
    ||typeof settings?.worldweaverConnections!=='function'
    ||typeof settings?.readWorldweaverProviderConfig!=='function'
    ||typeof runtime?.generate!=='function')throw new TypeError('The canonical Settings and model runtime are required.');
  const mode=settings.readWorldMode(),selected=settings.readState?.()||{};
  const primary=selected.route==='openai-compatible'?'openai':'gemini';
  const local=Boolean(settings.readWorldweaverProviderConfig('local')?.model);
  return createWorldweaverAISession({
    mode,primary,localModelAvailable:local,
    connected:settings.worldweaverConnections(),tested,consent,budget,pricePerMillion,
    runtime,readProviderConfig:provider=>settings.readWorldweaverProviderConfig(provider)
  });
}

/** Never let a model choose the actor, world, target NPC or allowed tool. */
export async function queueWorldweaverActorLine({
  world,session,npcId,actor,role='actors',scenePrompt,worldContext=''
}={}){
  if(!world?.snapshot||typeof world?.dispatch!=='function'||typeof session?.propose!=='function')
    throw new TypeError('Canonical Worldweaver and an explicit model session are required.');
  if(!['actors','lari'].includes(role))throw new RangeError('Only character roles can queue NPC speech.');
  const npc=world.snapshot().npcs.find(row=>row.id===npcId);
  if(!npc)throw new RangeError('Unknown NPC.');
  if(actor?.kind!=='model'||actor.principalId!==npc.pilotPrincipalId||actor.modelId!==npc.modelId
    ||(npc.personaRef&&actor.personaRef!==npc.personaRef))
    throw new Error('Model pilot identity mismatch.');
  if(role==='lari'&&!/lari/i.test(npc.name+' '+(npc.personaRef||'')))
    throw new Error('Lari can only be piloted through her own NPC identity.');
  if(!npc.capabilities.includes('speak'))throw new Error('NPC cannot speak without its approved tool capability.');
  const result=await session.propose({
    role,worldId:npc.instanceId,personaId:npc.personaRef||npc.id,actorPrompt:npc.pilotPrompt||'',
    worldContext,scenePrompt,maxOutputTokens:300
  });
  if(result?.kind!=='fiction-proposal'||result.applied!==false||typeof result.text!=='string'||!result.text.trim())
    throw new TypeError('Only uncommitted, nonempty fiction proposals may become NPC intents.');
  const receipt=world.dispatch({type:'queue-actions',npcId:npc.id,actions:[{
    tool:'speak',args:{text:result.text.slice(0,1600)}
  }]},actor);
  return{proposal:result,intents:receipt.intents,worldStateApplied:false,requiresRuntimeAcknowledgement:true};
}
