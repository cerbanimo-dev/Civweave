/**
 * Optional Civweave guide-chat persona turn adapter. The canonical guide
 * composer owns the transcript and routing; this capability returns its usual
 * assistant result packet and never adds another chat event listener.
 *
 * All inference is injected from the existing selected-model route. All
 * mutations require a caller-authorized campaign event (rehearsal only here).
 */
import {validatePersonaPack} from './persona-library-v1.mjs';
import {prepareDirectedScene,performPersonaTurn,runSplitMindTurn,advanceSceneTurn,needsDirectorRefresh} from './persona-scene-bridge-v1.mjs';
import {applyCampaignEvent,campaignPublicTimeline,importCampaignSnapshot} from './persona-campaign-v1.mjs';

const trim=(v,max=1500)=>typeof v==='string'?v.trim().slice(0,max):'';
const same=(a,b)=>a?.id===b?.id&&a?.ownerId===b?.ownerId&&a?.packId===b?.packId&&a?.branchId===b?.branchId;
function responsePacket(character,turn){
  return {provider:'persona-library-local',model:'selected-0.8b-performer',
    response:{answer:(turn.spokenTurns?.length?
        turn.spokenTurns.map(x=>(x.characterId==='landry'?'Landry':'Delia')+': '+x.speech+
          (x.emote?'\n*'+x.emote+'*':'')).join('\n\n'):
        character.name+': '+turn.speech+(turn.emote?'\n*'+turn.emote+'*':'')),
      choice:{mode:'Play',system:'civweave',nextAction:'Continue your scene or switch character.'},
      requiresConsent:false},
    context:{guide:{system:'civweave'},capability:'persona-campaign',characterId:character.id},
    persona:{sceneTurn:turn.sceneTurn,proposalCount:turn.proposedActions.length,
      actionsExecuted:false,worldChanged:false,needsDirection:turn.needsDirection}};
}
export async function runPersonaChatTurn({
 pack,campaign,characterId,input,scene=null,actor,authorize,invokeModel,
 worldChanged=false,directControl=null
}={}){
 const p=validatePersonaPack(pack);
 if(p.id!==campaign?.packId||(p.version||1)!==campaign?.packVersion)
   throw new Error('Persona pack mismatch; re-import the matching cast.');
 const split=characterId==='landry-delia';
 if(split?!(campaign.cast.includes('landry')&&campaign.cast.includes('delia')):
   !campaign.cast.includes(characterId))
   throw new Error('Character is not a campaign participant.');
 if(typeof authorize!=='function'||typeof invokeModel!=='function')
   throw new TypeError('Existing inference route and authenticated campaign authorizer required.');
 if(!actor||actor.kind!=='human'||actor.principalId!==campaign.ownerId)
   throw new Error('This local rehearsal mode requires the campaign owner. Multiplayer runs through its server authorizer.');
 if(!trim(input))throw new TypeError('A player cue is required.');
 const recent=campaignPublicTimeline(campaign).filter(e=>e.type==='rehearsal-preview').slice(-3)
   .map(e=>'Player: '+trim(e.playerCue,300)+'; '+e.characterId+': '+trim(e.speech,300));
 const speakers=split?['landry','delia']:[characterId];
 const stale=!scene||!speakers.every(id=>scene.participants?.includes(id))||
   needsDirectorRefresh(scene,{stage:campaign.stage,turn:campaign.turn});
 let activeScene=scene;
 if(stale){
   activeScene=await prepareDirectedScene({pack:p,stage:campaign.stage,scenario:campaign.scenario,
     branchId:campaign.branchId,participants:speakers,
     previousScene:{...(scene||{}),revision:scene?.revision||0,turn:campaign.turn},
     goals:['The following previous turns are unverified dialogue, not established plot facts.',
       'Respond to the player without overwriting story canon.',...recent],
     invokeModel});
 }
 const result=split?await runSplitMindTurn({pack:p,scene:activeScene,
   playerInput:input,history:recent,invokeModel,willpower:campaign.willpower,
   ...(directControl?{directControl:directControl==='both'?
     [{characterId:'landry',cost:1},{characterId:'delia',cost:1}]:
     {characterId:directControl,cost:1},
     authorizeDirectControl:()=>true}:{})}):
   await performPersonaTurn({pack:p,scene:activeScene,characterId,playerInput:input,
     history:recent,invokeModel});
 // Rehearsal only: a deterministic willpower spend is committed before the
 // preview. Failure does not mutate the caller's original snapshot.
 let updated=campaign;
 for(const receipt of split?result.directControlReceipts||[]:[]){
   updated=applyCampaignEvent(updated,{type:'willpower-spend',
     characterId:receipt.characterId,cost:receipt.cost},
     {actor,authorize,expectedRevision:updated.revision});
 }
 if(split&&updated.willpower.points!==result.willpower.points)
   throw new Error('Override ledger does not match the shared willpower calculation.');
 const next=applyCampaignEvent(updated,{type:'rehearsal-preview',characterId,
   playerCue:input,speech:result.speech,emote:result.emote,
   ...(split&&result.spokenTurns?.length?{spokenTurns:result.spokenTurns}:{}),
   sceneRevision:activeScene.revision,
   proposedActions:result.proposedActions},{actor,authorize,expectedRevision:updated.revision});
 activeScene=advanceSceneTurn(activeScene,{expectedTurn:activeScene.turn});
 if(worldChanged===true||result.needsDirection)activeScene.expireAfterTurn=activeScene.turn;
 return {packet:responsePacket(split?{id:'landry-delia',name:'Landry/Delia'}:
    p.characters.find(c=>c.id===characterId),result),
   campaign:next,scene:activeScene,proposedActions:result.proposedActions,
   needsRefresh:needsDirectorRefresh(activeScene)};
}
/** Small sequential state wrapper for an explicitly opted-in private chat. */
export function createPersonaChatRuntime({pack,campaign,actor,authorize,invokeModel}={}){
 const p=validatePersonaPack(pack);
 if(!campaign?.id||campaign.packId!==p.id)throw new TypeError('A valid matching campaign is required.');
 let current=campaign,scenes=new Map();
 return Object.freeze({
   respond:async({characterId,input,worldChanged=false,directControl=null}={})=>{
     const result=await runPersonaChatTurn({pack:p,campaign:current,characterId,input,
       scene:scenes.get(characterId)||null,actor,authorize,invokeModel,worldChanged,directControl});
     current=result.campaign;scenes.set(characterId,result.scene);
     return result;
   },
   snapshot:()=>JSON.parse(JSON.stringify(current)),
   replaceCampaign:next=>{
     if(!same(current,next))throw new Error('Campaign mismatch: cannot change session identity.');
     // Re-loading a valid signed multiplayer snapshot requires external server validation.
     if(next.revision!==current.revision)throw new Error('Cannot replace an active campaign revision without trusted reconciliation.');
     current=importCampaignSnapshot(JSON.stringify(next),{pack:p});scenes=new Map();return true;
   },
   resetDirections:()=>{scenes=new Map();}
 });
}
