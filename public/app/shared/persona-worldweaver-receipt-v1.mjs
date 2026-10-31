/**
 * Independent Worldweaver receipt verifier. A model or browser cannot provide
 * its own binding. The server supplies a trusted mapping between its campaign
 * proposal and the queued NPC intents, then verifies real completed statuses.
 *
 * The Worldweaver object remains the sole world authority. This helper does not
 * execute, acknowledge, or fabricate world actions.
 */
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9:_./-]{0,179}$/.test(x);
export function createPersonaWorldReceiptVerifier({world,getBinding}={}){
 if(typeof world?.snapshot!=='function'||typeof getBinding!=='function')
   throw new TypeError('Trusted Worldweaver snapshot and server-owned proposal binding are mandatory.');
 return async function verifyWorldReceipt({worldReceiptId,proposal,campaignId,actor}={}){
   if(actor?.kind!=='runtime'||!valid(actor?.principalId)||!valid(worldReceiptId)||
     !valid(campaignId)||proposal?.type!=='npc-proposal')return false;
   const binding=await getBinding({campaignId,proposalId:proposal.id});
   if(!binding||binding.receiptId!==worldReceiptId||
     binding.campaignId!==campaignId||binding.proposalId!==proposal.id||
     !valid(binding.npcId)||!valid(binding.instanceId)||
     !Array.isArray(binding.intentIds)||binding.intentIds.length<1||binding.intentIds.length>3||
     new Set(binding.intentIds).size!==binding.intentIds.length)return false;
   const current=world.snapshot();
   const npc=current?.npcs?.find(row=>row.id===binding.npcId);
   if(!npc||npc.instanceId!==binding.instanceId||npc.personaRef!==binding.personaRef||
     npc.modelId!==binding.modelId||npc.pilotPrincipalId!==binding.pilotPrincipalId||
     npc.personaRef!==binding.packId+':'+proposal.characterId)return false;
   const actions=proposal.proposedActions||[];
   if(actions.length!==binding.intentIds.length)return false;
   // Each proposed action is tied to one completed Worldweaver intent in the
   // same position; tool/args must be exactly equal, not just the count.
   for(let i=0;i<actions.length;i++){
     const intent=current?.intents?.find(x=>x.id===binding.intentIds[i]);
     if(!intent||intent.status!=='succeeded'||!intent.resolvedAt||
       intent.instanceId!==binding.instanceId||intent.npcId!==binding.npcId||
       intent.tool!==actions[i].tool||!exact(intent.args,actions[i].args))return false;
   }
   return true;
 };
}
