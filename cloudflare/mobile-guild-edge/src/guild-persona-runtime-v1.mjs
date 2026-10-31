/**
 * Human-reviewed, server-authoritative simulated NPC speech in a Guild room.
 * This reuses Worldweaver's ONE state machine and its real queued-intent and
 * trusted-runtime reporting transition. It does not pretend to run a 3D engine.
 *
 * Inference happens in Civweave's existing selected-model route. Its browser
 * results are untrusted DRAFTS until the authenticated room owner approves.
 * Only speak is executable by this logical speech runtime: movement/geometry,
 * screens, payments, and quests require their own authenticated adapters.
 */
import {createWorldweaver} from '../../../public/app/shared/worldweaver-core-v1.mjs';
import {applyCampaignEvent} from '../../../public/app/shared/persona-campaign-v1.mjs';
import {createPersonaWorldReceiptVerifier} from '../../../public/app/shared/persona-worldweaver-receipt-v1.mjs';
const prefix='guild-persona:runtime:';
const draftPrefix='guild-persona:draft:';
const bound=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/.test(x);
const clean=(x,n=800)=>typeof x==='string'?x.trim().slice(0,n):'';
const deny=(m,status=403)=>{throw Object.assign(new Error(m),{status})};
const clone=v=>structuredClone(v);
export const personaRuntimeKey=(node,id)=>prefix+node+':'+id;
const draftKey=(node,id,code)=>draftPrefix+node+':'+id+':'+code;
function owners(room,actor){return actor?.kind==='human'&&actor.principalId===room.ownerId}
function access(room,actor){return owners(room,actor)||Object.hasOwn(room.seats,actor?.principalId||'')}
function allowedActions(values){
 if(!Array.isArray(values)||values.length!==1||
    values[0]?.tool!=='speak'||typeof values[0]?.args?.text!=='string'||
    !values[0].args.text.trim()||values[0].args.text.length>400||
    Object.keys(values[0].args).some(k=>k!=='text'))deny('Only one bounded simulated speech action is currently supported.',400);
 return [{tool:'speak',args:{text:values[0].args.text.trim()}}];
}
export function actorAuthorization({actor,command}){
 if(actor?.principalId==='server:persona-world'&&actor.kind==='runtime')
  return ['report-action'].includes(command.type);
 if(actor?.kind==='model'&&actor.principalId?.startsWith('server:persona-pilot:'))
  return command.type==='queue-actions';
 if(actor?.kind==='human'&&actor.principalId?.startsWith('member:'))
  return ['create','rig-npc'].includes(command.type);
 return false;
}
export function runtimeWorld(row,room){
 let i=row?.sequence||0;
 const world=createWorldweaver({
  initialState:row?.world,
  id:()=> 'persona-'+(++i),
  authorize:actorAuthorization
 });
 return {world,nextSequence:()=>i};
}
export async function stageNpcDraft(tx,{nodeId,room,actor,input}){
 if(!access(room,actor))deny('A room seat is required.');
 const characterId=input?.characterId;
 if(!room.cast.includes(characterId))deny('Character not present in room.',400);
 // Player-controlled roles may only stage their own character; the host can
 // review all actors. No caller gets a privileged model identity.
 if(!owners(room,actor)&&room.seats[actor.principalId]!==characterId)
  deny('Only your assigned character may submit an NPC draft.');
 if(!Number.isInteger(input.expectedRevision)||room.revision!==input.expectedRevision)
  deny('Campaign changed; reload before drafting.',409);
 const speech=clean(input.speech,400);
 if(!speech)deny('Spoken text is required.',400);
 const actions=allowedActions(input.actions||[{tool:'speak',args:{text:speech}}]);
 if(actions[0].args.text!==speech)deny('The reviewed spoken line and the queued speech must match.',400);
 const existing=await tx.list({prefix:draftPrefix+nodeId+':'+room.id+':',limit:25});
 if(existing.size>=24)deny('Review or clear existing drafts before submitting more.',409);
 // Any client-provided modelId, pilot ID, verified flag or receipt is discarded.
 const draft={id:'draft:'+crypto.randomUUID(),characterId,speech,emote:clean(input.emote,180),
  actions,submittedBy:actor.principalId,origin:'untrusted-player-submitted',
  createdAt:new Date().toISOString(),campaignRevision:room.revision};
 await tx.put(draftKey(nodeId,room.id,draft.id),draft);
 return {draft:clone(draft),authority:'pending-human-review'};
}
export async function pendingNpcDrafts(tx,{nodeId,room,actor}){
 if(!owners(room,actor))return[];
 const all=await tx.list({prefix:draftPrefix+nodeId+':'+room.id+':',limit:32});
 return [...all.values()].filter(x=>x&&x.status!=='approved').slice(0,24)
   .map(clone);
}
export async function approveNpcDraft(tx,{nodeId,room,actor,input}){
 if(!owners(room,actor))deny('Only the authenticated room owner may approve world speech.');
 if(room.revision!==input.expectedRevision)deny('Stale room revision.',409);
 const draftId=input.draftId;
 if(!bound(draftId)||!draftId.startsWith('draft:'))deny('Valid draft ID required.',400);
 const dk=draftKey(nodeId,room.id,draftId);
 const draft=await tx.get(dk);
 if(!draft||draft.status==='approved')deny('NPC draft not found or already approved.',404);
 if(draft.submittedBy!==room.ownerId&&room.seats[draft.submittedBy]!==draft.characterId)
   deny('The draft author no longer holds the assigned character seat.',403);
 const actions=allowedActions(draft.actions);
 if(draft.campaignRevision>room.revision)deny('Invalid draft timeline.',409);
 const actorOwner={kind:'human',principalId:room.ownerId};
 const worldActor={kind:'runtime',principalId:'server:persona-world'};
 const pilotId='server:persona-pilot:'+draft.characterId;
 const modelId='human-reviewed-dialogue';
 const personaRef=room.packId+':'+draft.characterId;
 let current=clone(room);
 if(!current.pilots[draft.characterId]||
    current.pilots[draft.characterId].principalId!==pilotId||
    current.pilots[draft.characterId].modelId!==modelId)
   current=applyCampaignEvent(current,{type:'bind-pilot',characterId:draft.characterId,
     principalId:pilotId,modelId},{actor:actorOwner,expectedRevision:current.revision,authorize:()=>true});
 const entry=await tx.get(personaRuntimeKey(nodeId,room.id));
 const runtime=runtimeWorld(entry,current),world=runtime.world;
 let instanceId=entry?.instanceId;
 if(!instanceId){
   // This creates only a DRAFT logical Worldweaver instance. It does not
   // provision a remote region or claim an OpenSim/3D session exists.
   const created=world.dispatch({type:'create',guide:'moss',
     title:current.title||'Persona rehearsal',scope:'standalone'},actorOwner);
   instanceId=created.instance.id;
 }
 let npc=world.snapshot().npcs.find(n=>n.personaRef===personaRef&&
   n.pilotPrincipalId===pilotId&&n.instanceId===instanceId);
 if(!npc){
   npc=world.dispatch({type:'rig-npc',instanceId,modelId,pilotPrincipalId:pilotId,
    name:draft.characterId,pilotPrompt:'Human-reviewed dialogue and approved bounded motion only.',
    personaRef,capabilities:['speak','move']},actorOwner).npc;
 }
 const pilot={kind:'model',principalId:pilotId,modelId,personaRef};
 current=applyCampaignEvent(current,{type:'npc-proposal',characterId:draft.characterId,
   speech:draft.speech,emote:draft.emote,proposedActions:actions},
   {actor:pilot,expectedRevision:current.revision,authorize:()=>true});
 const proposal=current.events.at(-1);
 const queue=world.dispatch({type:'queue-actions',npcId:npc.id,actions},pilot);
 // The trusted logical-speech adapter can actually complete speak ONLY.
 // Other tool kinds never reach this code; a visual/3D runtime must separately
 // verify geometry/tool outcomes before marking those successful.
 for(const intent of queue.intents){
   if(intent.tool!=='speak')deny('No trusted renderer is attached for this tool.',409);
   world.dispatch({type:'report-action',intentId:intent.id,outcome:'succeeded',
     summary:'Accepted into authoritative Guild scene transcript'},worldActor);
 }
 const receiptId='world:'+crypto.randomUUID();
 const binding={receiptId,proposalId:proposal.id,campaignId:room.id,
   npcId:npc.id,instanceId,packId:room.packId,personaRef,
   modelId,pilotPrincipalId:pilotId,intentIds:queue.intents.map(x=>x.id)};
 const verified=await createPersonaWorldReceiptVerifier({
   world,getBinding:async()=>binding
 })({worldReceiptId:receiptId,campaignId:room.id,proposal,actor:worldActor});
 if(verified!==true)deny('Worldweaver did not verify the speech intent.',409);
 current=applyCampaignEvent(current,{type:'resolve-proposal',
   proposalId:proposal.id,outcome:'succeeded',worldReceiptId:receiptId},
   {actor:worldActor,expectedRevision:current.revision,authorize:()=>true});
 await tx.put(personaRuntimeKey(nodeId,room.id),{world:world.snapshot(),
   sequence:runtime.nextSequence(),instanceId,bindings:{
    ...(entry?.bindings||{}),[proposal.id]:binding
   }});
 // Once the authoritative world/campaign receipts are stored, the untrusted
 // temporary draft is no longer needed. Prevent indefinite storage growth.
 await tx.delete(dk);
 // Caller commits room and Worldweaver snapshot in the SAME DO transaction.
 return {room:current,worldReceiptId:receiptId,proposalId:proposal.id,
   world:{instanceId,revision:world.snapshot().revision,kind:'logical-speech',
     simulatedOnly:true},speech:draft.speech};
}
export async function guildPersonaWorldSnapshot(tx,{nodeId,room,actor}){
 if(!access(room,actor))deny('Room access required.');
 const entry=await tx.get(personaRuntimeKey(nodeId,room.id));
 if(!entry)return null;
 const snapshot=runtimeWorld(entry,room).world.snapshot();
 // Never disclose pilot prompts/private world details. Only room-scoped NPC
 // speech intents are made visible to authenticated players.
 return {schema:'civweave.persona-world-view.v1',instanceId:entry.instanceId,
   revision:snapshot.revision,
   speeches:snapshot.intents.filter(x=>x.instanceId===entry.instanceId&&x.tool==='speak')
    .slice(-50).map(x=>({id:x.id,npcId:x.npcId,text:x.args.text,
      status:x.status,createdAt:x.createdAt,resolvedAt:x.resolvedAt||null})),
   backend:'logical-speech',simulatedOnly:true};
}
