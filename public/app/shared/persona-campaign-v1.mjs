/**
 * Optional persona campaign snapshot/event ledger. Extends the existing persona
 * capability; it does not own authentication, multiplayer transport, chat,
 * inference, or Worldweaver's authoritative world state.
 *
 * Never publish an imported snapshot as trusted multiplayer history. The caller
 * must reauthorize all operations on an authenticated server/mesh owner.
 */
import {validatePersonaPack,regenerateWillpower,requestDirectControl} from './persona-library-v1.mjs';

export const PERSONA_CAMPAIGN_SCHEMA='civweave.persona-campaign.v1';
const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_:.\/-]{0,95}$/.test(s)&&!['constructor','prototype','__proto__'].includes(s);
const clean=(s,max=1200)=>typeof s==='string'?s.trim().slice(0,max):'';
const clone=x=>JSON.parse(JSON.stringify(x));
const obj=x=>Boolean(x&&typeof x==='object'&&!Array.isArray(x));
const items=x=>Array.isArray(x)?x:[];
const EVENT_TYPES=new Set(['assign-player','bind-pilot','player-cue','npc-proposal','resolve-proposal','rehearsal-preview','willpower-spend','stage-set']);
const KEYS=['schema','id','title','packId','packVersion','ownerId','branchId','scenario','stage','cast','revision','turn','events','seats','pilots','willpower'];
const CANON='canon';
function requireId(s,label){if(!validId(s))throw new TypeError('Invalid '+label+'.');return s;}
function requireString(s,label,max=1200){const v=clean(s,max);if(!v)throw new TypeError(label+' is required.');return v;}
function assertPack(state,pack){
  const p=validatePersonaPack(pack);
  if(state.packId!==p.id||state.packVersion!==(p.version||1))throw new Error('Campaign pack mismatch.');
  return p;
}
function requireCharacter(pack,id){if(!pack.characters.some(c=>c.id===id))throw new RangeError('Unknown campaign character.');}
function sanitizedActions(actions){
  if(!Array.isArray(actions)||actions.length>3)throw new TypeError('Expected at most three proposed actions.');
  return actions.map(a=>{
    if(!obj(a)||!['speak','move','observe','inspect'].includes(a.tool)||!obj(a.args))
      throw new TypeError('Unsupported proposed action.');
    if(JSON.stringify(a.args).length>1000||Object.entries(a.args).some(([k,v])=>!validId(k)||typeof v!=='string'||v.length>400))
      throw new TypeError('Invalid proposed action arguments.');
    return {tool:a.tool,args:clone(a.args)};
  });
}
export function createPersonaCampaign({pack,id,title,ownerId,branchId,stage=0,scenario,cast}={}){
  const p=validatePersonaPack(pack);
  requireId(id,'campaign ID');requireId(ownerId,'owner ID');requireId(branchId,'branch ID');
  if(branchId===CANON||!branchId.startsWith('what-if:'))throw new TypeError('Improv requires an explicit what-if branch; canon is read-only.');
  if(!Number.isInteger(stage)||stage<0||stage>99999)throw new TypeError('Invalid campaign stage.');
  if(!Array.isArray(cast)||!cast.length||cast.length>12||new Set(cast).size!==cast.length)
    throw new TypeError('Campaign requires 1–12 distinct characters.');
  cast.forEach(id=>requireCharacter(p,id));
  return {schema:PERSONA_CAMPAIGN_SCHEMA,id,title:clean(title,140)||'Untitled private campaign',
    packId:p.id,packVersion:p.version||1,ownerId,branchId,scenario:requireString(scenario,'Scenario',8000),
    stage,cast:clone(cast),revision:0,turn:0,events:[],seats:{},pilots:{},
    willpower:{points:2,max:2,renewEvery:4,lastRenewedTurn:0}};
}
function validateState(s){
  if(obj(s)&&s.schema===PERSONA_CAMPAIGN_SCHEMA&&s.branchId===CANON)
    throw new TypeError('Canon branch is read-only. A persona campaign must use a what-if branch.');
  if(!obj(s)||s.schema!==PERSONA_CAMPAIGN_SCHEMA||Object.keys(s).some(k=>!KEYS.includes(k))||
    !validId(s.id)||!validId(s.ownerId)||!validId(s.branchId)||s.branchId===CANON||
    !s.branchId.startsWith('what-if:')||!validId(s.packId)||!Array.isArray(s.cast)||
    !Number.isInteger(s.stage)||s.stage<0||!Array.isArray(s.events)||
    !obj(s.seats)||!obj(s.pilots)||!obj(s.willpower)||!Number.isInteger(s.revision)||
    !Number.isInteger(s.turn)||s.events.length!==s.revision||s.events.length>120)
    throw new TypeError('Invalid campaign snapshot or unknown field.');
  if(s.events.some((e,i)=>!obj(e)||!EVENT_TYPES.has(e.type)||e.id!=='event-'+(i+1)||
    !validId(e.actorId)||!['human','model','runtime'].includes(e.actorKind)))
    throw new TypeError('Invalid campaign event history.');
}
export function applyCampaignEvent(input,command,{actor,authorize,expectedRevision}={}){
  validateState(input);
  if(typeof authorize!=='function'||authorize({actor,command,state:clone(input)})!==true)
    throw new Error('Unauthorized campaign event.');
  if(input.revision!==expectedRevision)throw new Error('Stale campaign revision: reload before updating.');
  if(input.events.length>=120)throw new RangeError('Campaign event log is full; export and start a new chapter.');
  if(!obj(actor)||!validId(actor.principalId)||!['human','model','runtime'].includes(actor.kind))
    throw new TypeError('Authenticated actor required.');
  if(!obj(command)||!EVENT_TYPES.has(command.type))throw new TypeError('Unsupported campaign event.');
  const s=clone(input),c=command;
  let record={id:'event-'+(s.revision+1),type:c.type,actorId:actor.principalId,actorKind:actor.kind};
  const owner=actor.kind==='human'&&actor.principalId===s.ownerId;
  switch(c.type){
    case 'assign-player':{
      if(!owner)throw new Error('Only the owner may assign player seats.');
      requireId(c.playerId,'player');requireId(c.roleId,'role');
      if(!s.cast.includes(c.roleId))throw new RangeError('Seat role is not in the scene.');
      if(Object.entries(s.seats).some(([id,role])=>id!==c.playerId&&role===c.roleId))
        throw new Error('This role is already assigned to another player.');
      s.seats[c.playerId]=c.roleId;
      record={...record,playerId:c.playerId,roleId:c.roleId};break;
    }
    case 'bind-pilot':{
      if(!owner)throw new Error('Only the owner may bind model pilots.');
      if(!s.cast.includes(c.characterId))throw new RangeError('Pilot character not in the cast.');
      requireId(c.principalId,'pilot');requireId(c.modelId,'model');
      s.pilots[c.characterId]={principalId:c.principalId,modelId:c.modelId};
      record={...record,characterId:c.characterId,principalId:c.principalId,modelId:c.modelId};break;
    }
    case 'player-cue':{
      if(actor.kind!=='human'||(!owner&&!Object.hasOwn(s.seats,actor.principalId)))
        throw new Error('A player seat or owner role is required.');
      record={...record,text:requireString(c.text,'Player cue',1200),worldChanged:false};
      s.turn++;s.willpower=regenerateWillpower(s.willpower,s.turn);break;
    }
    case 'npc-proposal':{
      if(actor.kind!=='model'||!s.cast.includes(c.characterId))throw new Error('Bound model pilot required.');
      const pilot=s.pilots[c.characterId];
      if(!pilot||pilot.principalId!==actor.principalId||pilot.modelId!==actor.modelId||
        actor.personaRef!==s.packId+':'+c.characterId)
        throw new Error('Model pilot identity mismatch.');
      record={...record,characterId:c.characterId,speech:clean(c.speech,800),emote:clean(c.emote,250),
        proposedActions:sanitizedActions(c.proposedActions||[]),status:'pending',worldChanged:false};
      if(!record.speech&&!record.emote&&!record.proposedActions.length)throw new TypeError('Empty proposal.');
      break;
    }
    case 'resolve-proposal':{
      if(actor.kind!=='runtime')throw new Error('Trusted runtime must confirm or reject world outcomes.');
      if(!['succeeded','failed','rejected'].includes(c.outcome))throw new TypeError('Unknown outcome.');
      const proposed=s.events.find(e=>e.id===c.proposalId&&e.type==='npc-proposal');
      if(!proposed)throw new RangeError('Unknown proposal.');
      if(s.events.some(e=>e.type==='resolve-proposal'&&e.proposalId===c.proposalId))
        throw new Error('Proposal already resolved.');
      const receipt=c.outcome==='succeeded'?requireId(c.worldReceiptId,'trusted world receipt'):null;
      record={...record,proposalId:c.proposalId,outcome:c.outcome,
        worldReceiptId:receipt,worldChanged:c.outcome==='succeeded'};
      break;
    }
    case 'rehearsal-preview':{
      if(!owner)throw new Error('Local preview requires the author/owner.');
      if(!s.cast.includes(c.characterId)&&c.characterId!=='landry-delia')
        throw new RangeError('Preview speaker is not in cast.');
      if(c.characterId==='landry-delia'&&!(s.cast.includes('landry')&&s.cast.includes('delia')))
        throw new RangeError('Both split-mind voices must be in the cast.');
      record={...record,characterId:c.characterId,playerCue:clean(c.playerCue,1200),
        speech:clean(c.speech,800),emote:clean(c.emote,250),
        proposedActions:sanitizedActions(c.proposedActions||[]),
        sceneRevision:Number.isInteger(c.sceneRevision)?c.sceneRevision:0,
        status:'unexecuted',worldChanged:false};
      if(!record.speech&&!record.emote&&!record.proposedActions.length)throw new TypeError('Empty preview.');
      s.turn++;s.willpower=regenerateWillpower(s.willpower,s.turn);break;
    }
    case 'willpower-spend':{
      if(!(owner||actor.kind==='runtime'))throw new Error('Only owner or trusted runtime may spend willpower.');
      requireId(c.characterId,'voice');requireCharacter({characters:s.cast.map(id=>({id}))},c.characterId);
      if(!Number.isInteger(c.cost)||c.cost<1||c.cost>5)throw new TypeError('Invalid willpower cost.');
      const spent=requestDirectControl(s.willpower,{characterId:c.characterId,turn:s.turn,cost:c.cost});
      if(!spent.allowed)throw new Error('Insufficient willpower.');
      s.willpower=spent.willpower;record={...record,characterId:c.characterId,cost:c.cost,
        remainingPoints:s.willpower.points};break;
    }
    case 'stage-set':{
      if(!(owner||actor.kind==='runtime'))throw new Error('Only owner/runtime may update story stage.');
      if(!Number.isInteger(c.stage)||c.stage<s.stage||c.stage>99999)
        throw new TypeError('Stage cannot move backward or exceed bounds.');
      s.stage=c.stage;record={...record,stage:c.stage};break;
    }
  }
  s.events.push(record);s.revision++;
  return s;
}
export function exportCampaignSnapshot(state){
  validateState(state);
  const data=JSON.stringify(state,null,2);
  if(data.length>200000)throw new RangeError('Campaign export size limit reached.');
  return data;
}
/**
 * Local import is ALWAYS untrusted. It is for rehearsal restoration, never an
 * authenticated remote game state or a signed record of player consent.
 */
export function importCampaignSnapshot(json,{pack}={}){
  if(typeof json!=='string'||json.length>200000)throw new RangeError('Campaign snapshot too large.');
  let s;
  try{s=JSON.parse(json)}catch{throw new TypeError('Invalid campaign JSON.');}
  validateState(s);
  const p=assertPack(s,pack);
  if(s.cast.length>12||s.cast.length<1||new Set(s.cast).size!==s.cast.length||
     !s.cast.every(id=>p.characters.some(c=>c.id===id)))throw new TypeError('Invalid campaign cast.');
  if(s.events.some(e=>JSON.stringify(e).length>2000)||s.events.some(e=>!Number.isInteger(Number(e.id.split('-')[1]))))
    throw new TypeError('Invalid campaign event details.');
  if(!Number.isInteger(s.willpower.points)||s.willpower.points<0||
    !Number.isInteger(s.willpower.max)||s.willpower.max>20||
    s.willpower.points>s.willpower.max)throw new TypeError('Invalid willpower snapshot.');
  return clone(s);
}
export function campaignPublicTimeline(state){
  validateState(state);
  return state.events.filter(e=>['player-cue','npc-proposal','resolve-proposal','rehearsal-preview','willpower-spend'].includes(e.type))
    .map(e=>clone(e));
}
