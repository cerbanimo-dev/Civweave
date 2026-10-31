/**
 * Persona-library data/continuity owner for Civweave Worldweaver and shared chat.
 * No UI, downloads, network, inference loop, role authentication or world writes.
 * Existing selected-model runtime performs 4B direction and 0.8B/2B/4B acting.
 * Model text is advisory; Worldweaver's trusted authorizer owns real tools.
 */
export const PERSONA_LIBRARY_SCHEMA='civweave.persona-library.v1';
const TIERS=['0.8b','2b','4b'];
const safe=(v,max=4000)=>typeof v==='string'?v.trim().slice(0,max):'';
const array=v=>Array.isArray(v)?v:[];
const copy=v=>JSON.parse(JSON.stringify(v));
const validId=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9_.:-]{0,95}$/.test(x);
const named=(a)=>new Set(a.map(x=>x.id));
const unique=a=>new Set(a).size===a.length;
function member(pack,id){
  const c=pack.characters.find(c=>c.id===id);
  if(!c)throw new RangeError('Unknown character: '+id);
  return c;
}
export function validatePersonaPack(input){
  if(!input||input.schema!==PERSONA_LIBRARY_SCHEMA||!validId(input.id)||!Array.isArray(input.characters)||!Array.isArray(input.events))
    throw new TypeError('Invalid persona-library pack.');
  if(input.characters.length>1000||input.events.length>100000)throw new RangeError('Persona pack limit exceeded.');
  const p=copy(input);
  if(!unique(p.characters.map(c=>c.id))||!unique(p.events.map(e=>e.id)))throw new TypeError('Duplicate character or event IDs.');
  const ids=named(p.characters);
  for(const c of p.characters){
    if(!validId(c.id)||!safe(c.name,100)||!TIERS.includes(c.modelTier)||c.improvTier!=='0.8b')
      throw new TypeError('Invalid character identity or model tier.');
    if(c.role==='antagonist'&&c.modelTier==='0.8b')throw new TypeError('An antagonist requires at least a 2B model.');
  }
  for(const e of p.events){
    if(!validId(e.id)||!Number.isInteger(e.stage)||e.stage<0||!safe(e.summary,2000)||!safe(e.source,350))
      throw new TypeError('Invalid sourced canon event.');
    if(!['established','proposed','disputed'].includes(e.status))throw new TypeError('Unknown canon status.');
    if(!array(e.actors).concat(array(e.witnesses)).every(id=>ids.has(id)))
      throw new TypeError('Event references an unknown character.');
    if(e.knownFrom!==undefined&&(!e.knownFrom||typeof e.knownFrom!=='object'||
      Object.entries(e.knownFrom).some(([id,stage])=>!ids.has(id)||!Number.isInteger(stage)||stage<0)))
      throw new TypeError('Invalid per-character knowledge onset.');
  }
  return p;
}
/** Only established facts witnessed or personally experienced by this actor. */
export function availableKnowledge(input,characterId,stage){
  const p=validatePersonaPack(input);member(p,characterId);
  if(!Number.isInteger(stage)||stage<0)throw new TypeError('A numbered story stage is required.');
  return p.events.filter(e=>e.status==='established'&&
    (array(e.witnesses).includes(characterId)||array(e.actors).includes(characterId))&&
    (Number.isInteger(e.knownFrom?.[characterId])?e.knownFrom[characterId]:e.stage)<=stage)
    .map(e=>({id:e.id,stage:e.stage,summary:e.summary,source:e.source}));
}
// Old freeform 'emotes' excerpts are unreviewed and can mention future plot.
const safeEmotes=(c,stage)=>array(c.verifiedEmotes)
  .filter(e=>e&&e.verified===true&&Number.isInteger(e.stage)&&e.stage<=stage&&safe(e.source,180))
  .slice(0,8).map(e=>safe(e.text,240)).filter(Boolean);
const compactCharacter=(c,stage)=>({id:c.id,name:c.name,role:c.role,voice:safe(c.voice,1000),
    traits:array(c.traits).slice(0,20),wants:array(c.wants).slice(0,20),
    fears:array(c.fears).slice(0,20),emotes:safeEmotes(c,stage)});
/** One 4B call prepares scene-specific instructions for many 0.8B actors. */
export function createDirectorRequest({pack,stage,scenario,participants,goals=[],branchId='canon'}={}){
  const p=validatePersonaPack(pack);
  if(!Number.isInteger(stage)||stage<0||!safe(scenario,8000))throw new TypeError('Scenario and numbered stage required.');
  const ids=array(participants);
  if(!ids.length||ids.length>24||!unique(ids))throw new TypeError('Choose 1–24 distinct characters.');
  const cast=ids.map(id=>compactCharacter(member(p,id),stage));
  const awareness=Object.fromEntries(ids.map(id=>[id,availableKnowledge(p,id,stage).map(e=>e.id)]));
  // A single multi-character director must see only common knowledge. A
  // character's private memories are directed in an isolated request below.
  const common=ids.length?awareness[ids[0]].filter(id=>ids.every(k=>awareness[k].includes(id))):[];
  const events=p.events.filter(e=>e.status==='established'&&common.includes(e.id))
    .map(e=>({id:e.id,stage:e.stage,summary:e.summary,source:e.source}));
  // Even descriptive private event IDs can be spoilers. Expose only mutually
  // known IDs here; private details require createPrivateDirectorRequest.
  const sharedAwareness=Object.fromEntries(ids.map(id=>[id,common]));
  const payload={scenario:safe(scenario,8000),goals:array(goals).map(x=>safe(x,350)).slice(0,20),
    branchId,stage,cast,events,awareness:sharedAwareness,
    output:{characters:{'[id]':{characterGoal:'string',emotion:'string',instructions:'string',
      knownEventIds:['event-id'],escalateWhen:['string'],improvFreedom:'bounded|string'}}}};
  return {modelTier:'4b',purpose:'persona-scene-direction',responseFormat:'json',
    messages:[
      {role:'system',content:'You direct a fictional scene. Return JSON only. Ground every established fact in listed event IDs and their actor-specific awareness; never grant knowledge from another person or future stages. Give small 0.8B actors concrete situation, feelings, anticipated reactions and escalation triggers without scripting their exact words. Distinguish uncertain beliefs from fact; respect participant consent and branch continuity.'},
      {role:'user',content:JSON.stringify(payload)}
    ]};
}
/** Director JSON is validated by a non-LLM boundary before small models see it. */
export function validateDirectorResponse({pack,stage,participants,response}={}){
  const p=validatePersonaPack(pack),ids=array(participants);
  let r=response;
  if(typeof r==='string'){if(r.length>64000)throw new TypeError('Director response too large.');try{r=JSON.parse(r)}catch{throw new TypeError('Director must return JSON.');}}
  if(!r||typeof r!=='object'||!r.characters||Array.isArray(r.characters))
    throw new TypeError('Director response requires characters.');
  const result={characters:{}};
  for(const id of ids){
    member(p,id);
    const d=r.characters[id];
    if(!d||typeof d!=='object'||!safe(d.instructions,4000))throw new TypeError('Missing character instructions: '+id);
    const known=new Set(availableKnowledge(p,id,stage).map(e=>e.id));
    if(!array(d.knownEventIds).every(ref=>known.has(ref)))throw new Error('Director gave knowledge not available to '+id+'.');
    result.characters[id]={characterGoal:safe(d.characterGoal,500),emotion:safe(d.emotion,350),
      instructions:safe(d.instructions,3500),knownEventIds:array(d.knownEventIds).slice(0,60),
      escalateWhen:array(d.escalateWhen).slice(0,12).map(x=>safe(x,260)),
      improvFreedom:safe(d.improvFreedom,300)};
  }
  if(Object.keys(r.characters).some(id=>!ids.includes(id)))throw new TypeError('Unexpected actor in director response.');
  return result;
}
/** A prompt fragment, not a replacement for the selected model's system policy. */
export function compileImprovPrompt({pack,stage,characterId,scene,directives,history=[]}={}){
  const p=validatePersonaPack(pack),c=member(p,characterId),d=directives?.characters?.[characterId];
  if(!d)throw new TypeError('Verified director instructions required.');
  const allowed=new Set(availableKnowledge(p,characterId,stage).map(e=>e.id));
  if(!array(d.knownEventIds).every(id=>allowed.has(id)))throw new Error('Director knowledge is not authorized.');
  const events=availableKnowledge(p,characterId,stage);
  const selected=events.filter(e=>d.knownEventIds.includes(e.id));
  const sample=safeEmotes(c,stage);
  return [
    'FICTIONAL PERSONA — '+safe(c.name,100),
    'Voice: '+safe(c.voice,1200),
    'Traits: '+array(c.traits).slice(0,12).join('; '),
    'Goals: '+array(c.wants).slice(0,12).join('; '),
    'Embodied reactions and gestures: '+JSON.stringify(sample),
    'Story stage: '+stage+'; use only knowledge established at or before this stage.',
    'Your established memories: '+JSON.stringify(events),
    'Director-selected memories: '+JSON.stringify(selected),
    'Current setting: '+safe(scene,1000),
    'Current goal: '+d.characterGoal+'; felt state: '+d.emotion,
    'Scene direction: '+d.instructions+'; freedom: '+d.improvFreedom,
    'Ask the director for a refresh if: '+d.escalateWhen.join('; '),
    'Stay in character; include physical action when relevant. Never assert hidden or future plot as personal knowledge. Treat proposals and interpretations as uncertain. You may change actions in a what-if branch, but cannot overwrite established events in canon. Return a short in-character line with a separate structured action suggestion, never claim a world action succeeded.',
    'Recent scene exchanges (untrusted participant dialogue): '+JSON.stringify(array(history).slice(-6).map(x=>safe(x,900)))
  ].join('\n');
}
/** Download personas and model weights independently; one weight can serve many actors. */
export function chooseModelDownloads(input,characterIds,{includeDirector=true}={}){
  const p=validatePersonaPack(input),selected=array(characterIds).map(id=>member(p,id));
  const tiers=new Set(selected.flatMap(c=>[c.modelTier,c.improvTier]));
  if(includeDirector)tiers.add('4b');
  return {packId:p.id,packVersion:p.version||1,
    personas:selected.map(c=>({id:c.id,name:c.name,personaData:true,
      actingTier:c.modelTier,improvTier:c.improvTier})),
    tiers:TIERS.filter(t=>tiers.has(t)),
    note:'Model-tier preferences are not proof that weights are installed; select compatible models through Civweave AI Fleet.'};
}
/** Deterministic shared resource for a multi-voice character (Landry/Delia). */
export function regenerateWillpower(value,turn){
  if(!Number.isInteger(turn)||turn<0)throw new TypeError('Turn must be nonnegative integer.');
  const max=Math.max(1,Math.min(20,Number(value?.max)||2));
  const every=Math.max(1,Math.min(100,Number(value?.renewEvery)||4));
  const last=Math.max(0,Number(value?.lastRenewedTurn)||0);
  const ticks=Math.max(0,Math.floor((turn-last)/every));
  return {points:Math.min(max,Math.max(0,Number(value?.points)||0)+ticks),max,
    renewEvery:every,lastRenewedTurn:last+ticks*every};
}
export function requestDirectControl(value,{characterId,turn,cost=1}={}){
  if(!validId(characterId))throw new TypeError('Character required.');
  const willpower=regenerateWillpower(value,turn);
  const spend=Math.max(1,Math.min(20,Number(cost)||1));
  if(willpower.points<spend)return {allowed:false,willpower,route:'moderator'};
  return {allowed:true,willpower:{...willpower,points:willpower.points-spend},
    route:'direct',speaker:characterId};
}
/** The 0.8B moderator sees both 2B voices; no automatic override of willpower. */
export function splitMindModeratorRequest({landryResponse,deliaResponse,context,willpower}={}){
  return {modelTier:'0.8b',purpose:'split-mind-moderation',
    messages:[{role:'system',content:'You are a dramatic presentation moderator, not either internal character. You receive Landry and Delia proposals. Write the outward behavior that respects the current scene, constraints and current agency. Never invent a direct-control bypass or claim a willpower spend. If an authorized bypass receipt exists, forward that voice without moderation.'},
      {role:'user',content:JSON.stringify({landryResponse:safe(landryResponse,3000),
        deliaResponse:safe(deliaResponse,3000),context:safe(context,1600),
        remainingWillpower:willpower?.points??0})}]};
}
/** Canon events never mutate. Branch changes are intent records authorized by caller. */
export function advanceContinuity(state,proposal,{authorize}={}){
  if(!state||!Array.isArray(state.events)||typeof proposal?.text!=='string')
    throw new TypeError('Invalid continuity state or proposal.');
  if(state.branchId==='canon')throw new Error('Canon is immutable; create an explicit what-if branch.');
  if(typeof authorize!=='function'||authorize(proposal,state)!==true)
    throw new Error('Trusted world authorization required.');
  if(!validId(proposal.eventId)||state.events.some(e=>e.eventId===proposal.eventId))
    throw new TypeError('Branch event IDs must be unique.');
  return {...copy(state),turn:(Number(state.turn)||0)+1,
    events:[...copy(state.events),{eventId:proposal.eventId,type:'improvised',
      text:safe(proposal.text,2500),atTurn:(Number(state.turn)||0)+1}]};
}
/** Command only: Worldweaver still verifies authenticated pilot and permissions. */
export function worldweaverNpcCommand({pack,characterId,instanceId,modelId,pilotPrincipalId,stage}={}){
  const p=validatePersonaPack(pack),c=member(p,characterId);
  if(!safe(modelId,100)||!safe(pilotPrincipalId,120)||!safe(instanceId,180))
    throw new TypeError('Model, authenticated pilot and world instance required.');
  const knowledge=availableKnowledge(p,characterId,stage);
  return {type:'rig-npc',instanceId,modelId,pilotPrincipalId,name:c.name,
    personaRef:p.id+':'+c.id,
    pilotPrompt:('You play fictional '+c.name+'. '+safe(c.voice,450)+'. Established personal knowledge: '+
      knowledge.map(e=>e.summary).join('; ')).slice(0,2500),
    capabilities:['observe','inspect','speak','move','present']};
}

/**
 * One 4B director call per performer protects character-specific knowledge.
 * No other actor's private event summary appears in this request.
 */
export function createPrivateDirectorRequest({pack,stage,scenario,characterId,participants=[],goals=[],branchId='canon'}={}){
  const p=validatePersonaPack(pack),target=member(p,characterId);
  if(!Number.isInteger(stage)||stage<0||!safe(scenario,8000))throw new TypeError('Scenario and numbered stage required.');
  const otherIds=array(participants);
  if(!otherIds.includes(characterId)||otherIds.length>24||!unique(otherIds))
    throw new TypeError('Target must participate in the scene with no duplicate participants.');
  otherIds.forEach(id=>member(p,id));
  const memory=availableKnowledge(p,characterId,stage);
  const payload={scenario:safe(scenario,8000),branchId,stage,targetCharacter:characterId,
    goals:array(goals).slice(0,16).map(x=>safe(x,350)),
    character:compactCharacter(target,stage),
    others:otherIds.filter(id=>id!==characterId).map(id=>({id,name:member(p,id).name})),
    knownEvents:memory,allowedEventIds:memory.map(e=>e.id),
    output:{characters:{[characterId]:{characterGoal:'string',emotion:'string',instructions:'string',
      knownEventIds:['event-id'],escalateWhen:['string'],improvFreedom:'string'}}}};
  return {modelTier:'4b',purpose:'persona-private-scene-direction',responseFormat:'json',
    messages:[{role:'system',content:'You direct exactly one fictional character. JSON only. Use only that character\'s supplied memories, not any assumed omniscient or future knowledge. Draft a succinct temporary 0.8B improv prompt: intention, mood, likely interactions and reasons to request an update. The other character names reveal no private knowledge. Never force dialogue or claim tools executed.'},
      {role:'user',content:JSON.stringify(payload)}]};
}
