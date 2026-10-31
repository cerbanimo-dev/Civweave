/**
 * The server/mesh adapter for authenticated Persona Library campaigns.
 * This is not an HTTP endpoint: an existing authenticated service MUST supply
 * identity verification, storage and an atomic compare-and-swap writer.
 *
 * A client-supplied actor, verified flag, username or proposed role is never
 * authoritative. Writer must enforce atomic expectedRevision, not last-write-wins.
 */
import {applyCampaignEvent,exportCampaignSnapshot} from './persona-campaign-v1.mjs';

const boundedId=id=>typeof id==='string'&&id.length<=96&&/^[A-Za-z0-9][A-Za-z0-9:._/-]*$/.test(id);
function authenticated(identity){
  if(!identity||!['human','model','runtime'].includes(identity.kind)||
     !boundedId(identity.principalId))throw new Error('Authentication is required.');
  return {kind:identity.kind,principalId:identity.principalId,
    ...(identity.kind==='model'?{modelId:identity.modelId||'',personaRef:identity.personaRef||''}:{})};
}
function canRead(state,actor){
  return actor.kind==='human'&&(actor.principalId===state.ownerId||
    Object.hasOwn(state.seats,actor.principalId));
}
function canMutate(state,actor,command){
  if(actor.kind==='human'){
    if(actor.principalId===state.ownerId)return true;
    return Object.hasOwn(state.seats,actor.principalId)&&command.type==='player-cue';
  }
  if(actor.kind==='runtime')return ['resolve-proposal','stage-set'].includes(command.type);
  if(actor.kind==='model'&&command.type==='npc-proposal'){
    const pilot=state.pilots?.[command.characterId];
    return pilot?.principalId===actor.principalId&&pilot?.modelId===actor.modelId&&
      actor.personaRef===state.packId+':'+command.characterId;
  }
  return false;
}
export function createPersonaMultiplayerGateway({authenticate,load,writeIfRevision,authorize,verifyWorldReceipt}={}){
  if(typeof authenticate!=='function'||typeof load!=='function'||typeof writeIfRevision!=='function')
    throw new TypeError('A real auth provider, storage reader and atomic writer are required.');
  const read=async request=>{
    if(!boundedId(request?.campaignId))throw new TypeError('Invalid campaign ID.');
    // Authenticate against trusted transport/cookie/token before loading private data.
    const actor=authenticated(await authenticate(request));
    const state=await load(request.campaignId);
    if(!state||state.id!==request.campaignId)throw new RangeError('Unknown campaign.');
    // Bound structural contract. Never return private/unvalidated data by mistake.
    exportCampaignSnapshot(state);
    return {state,actor};
  };
  return Object.freeze({
    async snapshot(request){
      const {state,actor}=await read(request);
      if(!canRead(state,actor))throw new Error('Campaign membership or seat access is required.');
      return JSON.parse(exportCampaignSnapshot(state));
    },
    async dispatch(request){
      const {state,actor}=await read(request);
      const command=request?.command;
      if(!command||typeof command.type!=='string')throw new TypeError('Campaign command required.');
      // Disallow unseated human changes before user-level mutation validation.
      if(actor.kind==='human'&&!canRead(state,actor))
        throw new Error('Campaign membership or seat access is required.');
      if(!canMutate(state,actor,command))
        throw new Error('Owner, assigned player, or authorized runtime required for this action.');
      if(typeof authorize==='function'&&await authorize({actor,command,state})!==true)
        throw new Error('Campaign action denied by server permission policy.');
      if(command.type==='resolve-proposal'&&command.outcome==='succeeded'){
        const proposal=state.events.find(e=>e.id===command.proposalId&&e.type==='npc-proposal');
        if(!proposal)throw new RangeError('Unknown model action proposal.');
        // A runtime identity alone is not enough to assert a particular
        // simulated action succeeded. Validate the actual Worldweaver receipt.
        if(typeof verifyWorldReceipt!=='function'||await verifyWorldReceipt({
          worldReceiptId:command.worldReceiptId,proposal,
          campaignId:state.id,actor,expectedRevision:state.revision
        })!==true)throw new Error('Verified Worldweaver action receipt required.');
      }
      const next=applyCampaignEvent(state,command,{
        actor,expectedRevision:request.expectedRevision,authorize:()=>true
      });
      const receipt=await writeIfRevision(state.id,state.revision,next,{
        authenticatedActor:actor,commandType:command.type
      });
      if(receipt?.ok!==true||receipt.revision!==next.revision)
        throw new Error('Stale campaign revision or write conflict; fetch a fresh snapshot.');
      // Snapshot is validated & sanitized. Caller may deliver it only to
      // explicitly authenticated session members.
      return JSON.parse(exportCampaignSnapshot(next));
    }
  });
}
