/**
 * Private Guild persona campaigns. This is the server domain service on the
 * existing Civweave node Durable Object; never a second chat/model runtime.
 *
 * Guild membership identity is supplied ONLY by the verified session adapter.
 * Each room is stored in the Guild's transactional Durable Object storage and
 * never published to the public object mesh.
 *
 * Source manuscripts, character private memories and model prompts are not
 * accepted or retained by this service. Only a bounded cast roster/scene and
 * player-visible campaign ledger may be uploaded on deliberate user action.
 */
import {createPersonaCampaign,applyCampaignEvent,exportCampaignSnapshot} from '../../../public/app/shared/persona-campaign-v1.mjs';
import {createPersonaMultiplayerGateway} from '../../../public/app/shared/persona-multiplayer-gateway-v1.mjs';
import {stageNpcDraft,pendingNpcDrafts,approveNpcDraft,guildPersonaWorldSnapshot} from './guild-persona-runtime-v1.mjs';
import {draftPersonaMove,pendingPersonaMoves,approvePersonaMove,worldMotionView} from './guild-persona-motion-v1.mjs';
import {personaRuntimeKey} from './guild-persona-runtime-v1.mjs';

export const GUILD_PERSONA_ROUTE='/api/node/persona-campaigns';
export const GUILD_PERSONA_SCHEMA='civweave.guild-persona-room.v1';
const ROOM_PREFIX='guild-persona:room:';
const COUNTER_PREFIX='guild-persona:owner-count:';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const bounded=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_:.\/-]{0,95}$/.test(value);
const text=(value,max=8000)=>typeof value==='string'?value.trim().slice(0,max):'';
function memberActor(member,nodeId){
  if(!bounded(nodeId)||!bounded(member?.nodeId)||member.nodeId!==nodeId||
    !bounded(member?.userId)||member.isAI===true)
    fail('An authenticated human Guild member and matching node scope are required.',403);
  return {kind:'human',principalId:'member:'+member.userId};
}
function minimalPack(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||!bounded(input.packId)||
    !Number.isInteger(input.packVersion)||input.packVersion<1||input.packVersion>10000||
    !Array.isArray(input.characters)||input.characters.length<1||input.characters.length>12)
    fail('Valid private pack identity and a bounded scene cast are required.');
  const ids=new Set();
  const characters=input.characters.map(row=>{
    if(!bounded(row?.id)||ids.has(row.id))fail('Cast IDs must be unique and bounded.');
    ids.add(row.id);
    return {id:row.id,name:text(row.name,100)||row.id,role:'supporting',
      modelTier:'2b',improvTier:'0.8b',voice:''};
  });
  // Source events and author-only voice traits are intentionally not received.
  return {schema:'civweave.persona-library.v1',id:input.packId,version:input.packVersion,characters,events:[]};
}
export async function executeGuildPersonaAction(storage,member,action,input={},options={}){
  if(typeof storage?.transaction!=='function')fail('Guild transactional storage is required.',503);
  const nodeId=text(options.nodeId,96);
  const actor=memberActor(member,nodeId);
  // A mobile-owned Guild capacity DO is shared by all its starter nodes.
  // Use only the VERIFIED adapter-provided Guild ID for its storage scope.
  // Node-cloud services without a Guild-scoped shared store stay node-scoped.
  const scope=options.guildId?text(options.guildId,96):nodeId;
  if(!bounded(scope)||options.guildId&&scope!==member.guildId)
    fail('Trusted Guild storage scope mismatch.',403);
  if(!['create','snapshot','dispatch','draft','approve','approve-both','move-draft','move-approve'].includes(action))fail('Unsupported private campaign action.',405);
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Campaign JSON object required.');
  const id=text(input.campaignId,96);
  if(action!=='create'&&!bounded(id))fail('Campaign ID required.');
  // Transaction scope covers both authority reads and compare-and-swap writes.
  return storage.transaction(async tx=>{
    const roomKey=ROOM_PREFIX+scope+':'+id;
    if(action==='create'){
      const pack=minimalPack(input);
      const ownerKey=COUNTER_PREFIX+scope+':'+actor.principalId;
      const count=Number(await tx.get(ownerKey)||0);
      if(!Number.isSafeInteger(count)||count<0||count>=20)
        fail('Maximum private campaign rooms per member reached.',409);
      const generated='room:'+crypto.randomUUID();
      const room=createPersonaCampaign({pack,id:generated,ownerId:actor.principalId,
        branchId:'what-if:'+crypto.randomUUID(),title:text(input.title,140),
        stage:input.stage,scenario:input.scenario,cast:input.cast});
      // Ensure roster is an exact visible selection, not an unreviewed archive.
      if(room.cast.some(memberId=>!pack.characters.some(row=>row.id===memberId)))
        fail('Unrecognized private campaign member.');
      const key=ROOM_PREFIX+scope+':'+generated;
      await tx.put(key,room);
      await tx.put(ownerKey,count+1);
      return {ok:true,schema:GUILD_PERSONA_SCHEMA,room:JSON.parse(exportCampaignSnapshot(room)),serverAuthoritative:true};
    }
    const room=await tx.get(roomKey);
    if(!room)fail('Private campaign not found.',404);
    if(action==='move-draft'||action==='move-approve'){
      const result=action==='move-draft'?
        await draftPersonaMove(tx,{scope,room,actor,input}):
        await approvePersonaMove(tx,{scope,room,actor,input});
      if(action==='move-approve')await tx.put(roomKey,result.room);
      return {ok:true,schema:GUILD_PERSONA_SCHEMA,
        room:result.room||room,
        ...(action==='move-draft'?{motionDraft:result.draft}:{
           movement:result.movement,
           worldReceiptId:result.worldReceiptId,
           motion:worldMotionView(result.room,await tx.get(personaRuntimeKey(scope,room.id)))
        }),serverAuthoritative:true};
    }
    if(['draft','approve','approve-both'].includes(action)){
      if(action==='draft'){
        const result=await stageNpcDraft(tx,{nodeId:scope,room,actor,input});
        return {ok:true,schema:GUILD_PERSONA_SCHEMA,room,draft:result.draft,serverAuthoritative:true};
      }
      if(action==='approve'){
        const result=await approveNpcDraft(tx,{nodeId:scope,room,actor,input});
        await tx.put(roomKey,result.room);
        return {ok:true,schema:GUILD_PERSONA_SCHEMA,...result,serverAuthoritative:true};
      }
      // Simultaneous direct speech: both verified human-reviewed drafts must
      // exist, be different voices, and have TWO shared willpower points.
      // All six-plus ledger events, both Worldweaver acknowledgments and
      // both draft resolutions commit in one DO storage.transaction.
      if(actor.principalId!==room.ownerId||actor.kind!=='human')
        fail('Only the Guild room owner can approve simultaneous overrides.',403);
      if(room.revision!==input.expectedRevision)fail('Stale campaign revision.',409);
      const ids=input.draftIds;
      if(!room.cast.includes('landry')||!room.cast.includes('delia')||
        !Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2)
        fail('Two distinct Landry and Delia speech drafts are required.',400);
      const drafts=await Promise.all(ids.map(draftId=>
        tx.get('guild-persona:draft:'+scope+':'+room.id+':'+draftId)));
      if(drafts.some(d=>!d||d.status==='approved')||
        new Set(drafts.map(d=>d.characterId)).size!==2||
        !drafts.some(d=>d.characterId==='landry')||
        !drafts.some(d=>d.characterId==='delia'))
        fail('Both unapproved, distinct internal voices must be present.',409);
      if(room.willpower.points<2)fail('Insufficient shared willpower for simultaneous overrides.',409);
      const owner={kind:'human',principalId:room.ownerId};
      let current=room;
      // Keep narrative order deterministic regardless of selection order.
      const ordered=['landry','delia'].map(id=>drafts.find(d=>d.characterId===id));
      for(const d of ordered){
        current=applyCampaignEvent(current,{type:'willpower-spend',characterId:d.characterId,cost:1},
          {actor:owner,authorize:()=>true,expectedRevision:current.revision});
      }
      const outcomes=[];
      for(const d of ordered){
        const result=await approveNpcDraft(tx,{nodeId:scope,room:current,actor,
          input:{draftId:d.id,expectedRevision:current.revision}});
        current=result.room;outcomes.push(result);
      }
      await tx.put(roomKey,current);
      return {ok:true,schema:GUILD_PERSONA_SCHEMA,room:current,
        world:outcomes.at(-1).world,
        worldReceiptIds:outcomes.map(x=>x.worldReceiptId),
        speech:ordered.map((x,i)=>
          (x.characterId==='landry'?'Landry':'Delia')+': '+outcomes[i].speech).join('\n'),
        bothSpoke:true,serverAuthoritative:true};
    }
    const gateway=createPersonaMultiplayerGateway({
      authenticate:async()=>actor,
      load:async campaignId=>tx.get(ROOM_PREFIX+scope+':'+campaignId),
      writeIfRevision:async(campaignId,expectedRevision,next)=>{
        const key=ROOM_PREFIX+scope+':'+campaignId;
        const previous=await tx.get(key);
        if(!previous||previous.revision!==expectedRevision)return{ok:false};
        await tx.put(key,next);
        return{ok:true,revision:next.revision};
      },
      // Human-only member transport: server/model/run-time receipts must flow
      // through a separate trusted Worldweaver adapter, not this endpoint.
    });
    try {
      const snapshot=action==='snapshot'
        ?await gateway.snapshot({campaignId:id})
        :await gateway.dispatch({campaignId:id,expectedRevision:input.expectedRevision,
          command:input.command});
      const extra=action==='snapshot'?{
        pendingDrafts:await pendingNpcDrafts(tx,{nodeId:scope,room:snapshot,actor}),
        world:await guildPersonaWorldSnapshot(tx,{nodeId:scope,room:snapshot,actor}),
        motion:worldMotionView(snapshot,await tx.get(personaRuntimeKey(scope,snapshot.id))),
        pendingMoves:await pendingPersonaMoves(tx,{scope,room:snapshot,actor})
      }:{};
      return {ok:true,schema:GUILD_PERSONA_SCHEMA,room:snapshot,...extra,serverAuthoritative:true};
    }catch(error){
      if(/membership|seat access|not found|unknown campaign/i.test(String(error.message)))
        fail('Private campaign not found or access denied.',404);
      if(/stale|revision|conflict/i.test(String(error.message)))fail('Campaign revision conflict: reload authoritative room.',409);
      if(/owner|authorized|permission|only|seat/i.test(String(error.message)))
        fail('Campaign action is not permitted for this Guild member.',403);
      throw error;
    }
  });
}
