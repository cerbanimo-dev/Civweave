/**
 * Server-side 3D character motion for the SAME authoritative Worldweaver
 * instance and Guild Durable Object as the existing NPC speech runtime.
 * This is a bounded kinematic rehearsal scene, NOT an OpenSimulator or real
 * physical actuation claim. Real OpenSim region movement uses a separate
 * independently verified adapter (see worldweaver-opensim-motion-bridge-v1).
 */
import {applyCampaignEvent} from '../../../public/app/shared/persona-campaign-v1.mjs';
import {createPersonaWorldReceiptVerifier} from '../../../public/app/shared/persona-worldweaver-receipt-v1.mjs';
import {createPersonaMotionScene,movePersonaBody,personaMotionRegion} from '../../../public/app/shared/worldweaver-persona-motion-v1.mjs';
import {runtimeWorld,personaRuntimeKey} from './guild-persona-runtime-v1.mjs';

const prefix='guild-persona:motion-draft:';
const deny=(message,status=403)=>{throw Object.assign(new Error(message),{status})};
const owner=(room,actor)=>actor?.kind==='human'&&room.ownerId===actor.principalId;
const seated=(room,actor,characterId)=>owner(room,actor)||room.seats[actor?.principalId]===characterId;
const key=(scope,room,draft)=>prefix+scope+':'+room+':'+draft;
const ID=/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/;
const clean=(value,n)=>typeof value==='string'?value.trim().slice(0,n):'';
function initialMotion(room,instanceId){
 return createPersonaMotionScene({roomId:room.id,instanceId,characters:room.cast});
}
export async function draftPersonaMove(tx,{scope,room,actor,input}={}){
 const characterId=input?.characterId;
 if(!room.cast.includes(characterId)||!seated(room,actor,characterId))
   deny('The selected character is not assigned to this player.',403);
 if(room.revision!==input.expectedRevision)deny('Stale campaign revision.',409);
 const entry=await tx.get(personaRuntimeKey(scope,room.id));
 const motion=entry?.motion||initialMotion(room,entry?.instanceId||'stage:'+room.id);
 // Preview the trusted physics solver without mutating the canonical state;
 // rejected collision/teleport requests never enter the review queue.
 const checked=movePersonaBody(motion,{characterId,to:input.to,expectedRevision:motion.revision});
 const pending=await tx.list({prefix:prefix+scope+':'+room.id+':',limit:21});
 if(pending.size>=20)deny('Movement review queue is full.',409);
 const draft={id:'motion:'+crypto.randomUUID(),characterId,
  from:checked.movement.from,to:checked.movement.to,
  distance:checked.movement.distance,sceneRevision:motion.revision,
  campaignRevision:room.revision,submittedBy:actor.principalId,
  createdAt:new Date().toISOString(),status:'pending-human-review',
  provider:'guild-kinematic'};
 await tx.put(key(scope,room.id,draft.id),draft);
 return {draft,sceneRevision:motion.revision};
}
export async function pendingPersonaMoves(tx,{scope,room,actor}={}){
 if(!owner(room,actor))return[];
 const entries=await tx.list({prefix:prefix+scope+':'+room.id+':',limit:25});
 return [...entries.values()].slice(0,20).map(x=>structuredClone(x));
}
export async function approvePersonaMove(tx,{scope,room,actor,input}={}){
 if(!owner(room,actor))deny('Only a room host may approve character motion.');
 if(room.revision!==input.expectedRevision)deny('Stale campaign revision.',409);
 const draftId=input.draftId;
 if(typeof draftId!=='string'||!ID.test(draftId)||!draftId.startsWith('motion:'))
   deny('A valid reviewed movement is required.',400);
 const k=key(scope,room.id,draftId),draft=await tx.get(k);
 if(!draft)deny('Movement draft was already resolved or is unknown.',404);
 if(draft.submittedBy!==room.ownerId&&room.seats[draft.submittedBy]!==draft.characterId)
   deny('Player lost the character seat before approval.',403);
 const row=await tx.get(personaRuntimeKey(scope,room.id));
 const runtime=runtimeWorld(row,room),world=runtime.world;
 const human={kind:'human',principalId:room.ownerId};
 const authority={kind:'runtime',principalId:'server:persona-world'};
 let instanceId=row?.instanceId;
 if(!instanceId){
  instanceId=world.dispatch({type:'create',guide:'moss',scope:'standalone',
    title:room.title||'Persona three-dimensional rehearsal'},human).instance.id;
 }
 const motion=row?.motion||initialMotion(room,instanceId);
 if(motion.instanceId!==instanceId||motion.roomId!==room.id||
   motion.revision!==draft.sceneRevision)deny('3D scene changed; refresh and review the new path.',409);
 const preview=movePersonaBody(motion,{
   characterId:draft.characterId,to:draft.to,expectedRevision:draft.sceneRevision});
 if(JSON.stringify(preview.movement.from)!==JSON.stringify(draft.from))
   deny('Avatar moved since the draft was submitted.',409);
 const pilotId='server:persona-pilot:'+draft.characterId;
 const modelId='human-reviewed-dialogue';
 const personaRef=room.packId+':'+draft.characterId;
 let current=structuredClone(room);
 if(!current.pilots[draft.characterId]||
    current.pilots[draft.characterId].principalId!==pilotId||
    current.pilots[draft.characterId].modelId!==modelId)
  current=applyCampaignEvent(current,{type:'bind-pilot',characterId:draft.characterId,
     principalId:pilotId,modelId},
    {actor:human,authorize:()=>true,expectedRevision:current.revision});
 let npc=world.snapshot().npcs.find(n=>n.instanceId===instanceId&&
   n.personaRef===personaRef&&n.pilotPrincipalId===pilotId);
 if(!npc){
  npc=world.dispatch({type:'rig-npc',instanceId,modelId,pilotPrincipalId:pilotId,
    name:draft.characterId,personaRef,capabilities:['speak','move'],
    pilotPrompt:'Human-reviewed speech and bounded simulated 3D navigation only.'},human).npc;
 }
 if(!npc.capabilities.includes('move'))deny('The existing NPC is not rigged for movement.',409);
 const action={tool:'move',args:{to:draft.to,from:draft.from,
   expectedSceneRevision:draft.sceneRevision}};
 const pilot={kind:'model',principalId:pilotId,modelId,personaRef};
 current=applyCampaignEvent(current,{type:'npc-proposal',
   characterId:draft.characterId,proposedActions:[action],
   speech:'',emote:''},{actor:pilot,authorize:()=>true,expectedRevision:current.revision});
 const proposal=current.events.at(-1);
 const queued=world.dispatch({type:'queue-actions',npcId:npc.id,actions:[action]},pilot);
 // Only after the actual authoritative kinematic solver advances the
 // 3D body do we report success through Worldweaver's runtime-only gate.
 world.dispatch({type:'report-action',intentId:queued.intents[0].id,outcome:'succeeded',
   summary:'Guild kinematic avatar moved '+preview.movement.distance+' metres'},authority);
 const receiptId='world:'+crypto.randomUUID();
 const binding={receiptId,proposalId:proposal.id,campaignId:room.id,
   npcId:npc.id,instanceId,packId:room.packId,personaRef,modelId,
   pilotPrincipalId:pilotId,intentIds:queued.intents.map(x=>x.id),
   sceneRevision:preview.scene.revision,provider:'guild-kinematic'};
 const verifies=await createPersonaWorldReceiptVerifier({world,
   getBinding:async()=>binding
 })({worldReceiptId:receiptId,campaignId:room.id,proposal,actor:authority});
 if(!verifies)deny('Worldweaver did not confirm the move intent.',409);
 current=applyCampaignEvent(current,{type:'resolve-proposal',
   proposalId:proposal.id,outcome:'succeeded',worldReceiptId:receiptId},
   {actor:authority,authorize:()=>true,expectedRevision:current.revision});
 await tx.put(personaRuntimeKey(scope,room.id),{
   ...row,world:world.snapshot(),sequence:runtime.nextSequence(),
   instanceId,motion:preview.scene,
   bindings:{...(row?.bindings||{}),[proposal.id]:binding}
 });
 await tx.delete(k);
 return {room:current,movement:preview.movement,worldReceiptId:receiptId,
   provider:'guild-kinematic',simulatedOnly:true,
   region:personaMotionRegion(preview.scene)};
}
export function worldMotionView(room,row){
 const motion=row?.motion||initialMotion(room,row?.instanceId||'stage:'+room.id);
 const region=personaMotionRegion(motion);
 return {schema:'civweave.persona-motion-view.v1',revision:motion.revision,
   provider:'guild-kinematic',simulatedOnly:true,
   instanceId:motion.instanceId,region,
   actors:motion.actors.map(x=>({characterId:x.characterId,position:x.position})),
   movements:motion.movements.slice(-20)};
}
