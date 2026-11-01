/**
 * Convergence cast adapter. Book identities are read exclusively from a
 * human-reviewed Performance Studio casting, Starling from its canonical roster,
 * and guide prompts from the one canonical Civweave guide-chat owner.
 *
 * This is a portable projection/pilot-command builder: it owns no model,
 * manuscript, memory, publishing, Guild or simulation state.
 */
import {PERFORMANCE_SCHEMA} from './worldweaver-performance-studio-v1.mjs';
import {STARLING_PERSONAS} from './starling-collective-v1.mjs';

export const CONVERGENCE_CAST_SCHEMA='civweave.convergence-cast.v1';
export const CONVERGENCE_MILESTONES=Object.freeze([
  'book-meets-cerbanimo',
  'book-meets-collective',
  'civweave-public-opening'
]);
export const CONVERGENCE_GUIDE_IDS=Object.freeze(['weaveling','moss','kamiya','rook','merlin']);
const REF=/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/;
const bounded=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const validRef=x=>typeof x==='string'&&REF.test(x);
const copy=x=>JSON.parse(JSON.stringify(x));
const APPROVED_RIGHTS=new Set(['owned','licensed','public-domain']);

/** Receipts are verified by the owning author/release system, never by a model
 * or a checkbox. Missing or out-of-order receipts never unlock a later act. */
export function convergenceTimeline({receipts=[],verifyReceipt}={}){
  const verified=[];
  if(typeof verifyReceipt==='function'&&Array.isArray(receipts)){
    for(const milestone of CONVERGENCE_MILESTONES){
      const receipt=receipts.find(r=>r?.milestone===milestone);
      if(!receipt||verifyReceipt(receipt,milestone)!==true)break;
      verified.push(milestone);
    }
  }
  const phase=['development','cerbanimo-encounter','collective-encounter','public-convergence'][verified.length];
  return Object.freeze({phase,verified:Object.freeze(verified),publicOpen:verified.length===3,
    next:CONVERGENCE_MILESTONES[verified.length]||null});
}
function approvedCast(state){
  if(state?.schema!==PERFORMANCE_SCHEMA||!APPROVED_RIGHTS.has(state.project?.rights)||
    !Array.isArray(state.casts)||!Array.isArray(state.proposals))throw new TypeError('Rights-cleared Performance Studio project required.');
  const approved=state.proposals.filter(s=>s.status==='approved');
  const byCharacter=new Map();
  for(const c of state.casts){
    if(!validRef(c?.character)||!validRef(c?.avatarRef)||!validRef(c?.pilotPrincipalId)||
      !validRef(c?.approvedBy))continue;
    const scenes=approved.filter(s=>Array.isArray(s.dialogue)&&s.dialogue.some(l=>l.character===c.character));
    if(!scenes.length)continue;
    byCharacter.set(c.character,{
      id:c.character,
      name:bounded(c.displayName,100)||c.character,
      avatarRef:c.avatarRef,
      pilotPrincipalId:c.pilotPrincipalId,
      voiceRef:validRef(c.voiceRef)?c.voiceRef:null,
      personaBrief:bounded(c.personaBrief,1500),
      canonRules:bounded(c.canonRules,2000),
      relationships:bounded(c.relationships,1200),
      interactionRules:bounded(c.interactionRules,1200),
      approvedBy:c.approvedBy,
      approvedSceneIds:scenes.map(s=>s.id).filter(validRef).slice(0,24)
    });
  }
  return [...byCharacter.values()].slice(0,20);
}
/** A deliberately minimal author-review export: NO manuscript text, audience
 * submissions, private chat, source excerpts, or inferred character thoughts. */
export function projectBookCast(state){
  const characters=approvedCast(state);
  if(!characters.length)throw new Error('Approve a screenplay and cast at least one speaking character first.');
  return {
    schema:CONVERGENCE_CAST_SCHEMA,
    kind:'book-cast',
    projectId:state.project.id,
    productionTitle:bounded(state.project.title,180),
    sourceTitle:bounded(state.project.sourceTitle,180),
    rights:state.project.rights,
    revision:state.revision,
    characters,
    publication:'private-preview',
    canonAuthority:'author-review',
    provenance:'performance-studio-human-cast',
    // This unsigned export is never proof of real author identity.
    signed:false
  };
}
export function convergenceRoster({bookPacket=null}={}){
  const guides=CONVERGENCE_GUIDE_IDS.map(id=>({id:'cerbanimo:'+id,personaRef:'guide:'+id,
    team:'cerbanimo',name:id==='weaveling'?'Weaveling':id==='kamiya'?'Kamiya':id[0].toUpperCase()+id.slice(1),
    status:'canonical-guide'}));
  const collective=Object.values(STARLING_PERSONAS).map(p=>({id:'starling:'+p.id,
    personaRef:'starling:'+p.id,team:'collective',name:p.name,role:p.role,status:'canonical-persona'}));
  let book=[];
  if(bookPacket!==null){
    verifyBookCastPacket(bookPacket);
    book=bookPacket.characters.map(p=>({id:'book:'+p.id,personaRef:'book:'+p.id,
      team:'book',name:p.name,role:'Author-reviewed fictional character',status:'private-preview'}));
  }
  return Object.freeze([...guides,...collective,...book].map(x=>Object.freeze(x)));
}
export function verifyBookCastPacket(packet){
  if(packet?.schema!==CONVERGENCE_CAST_SCHEMA||packet.kind!=='book-cast'||
    packet.publication!=='private-preview'||packet.canonAuthority!=='author-review'||
    packet.signed!==false||!APPROVED_RIGHTS.has(packet.rights)||
    !validRef(packet.projectId)||!Number.isSafeInteger(packet.revision)||packet.revision<1||
    !Array.isArray(packet.characters)||packet.characters.length<1||packet.characters.length>20)
    throw new TypeError('Unrecognized private Convergence casting packet.');
  const seen=new Set();
  for(const p of packet.characters){
    if(!validRef(p?.id)||!validRef(p.avatarRef)||!validRef(p.pilotPrincipalId)||
       !validRef(p.approvedBy)||seen.has(p.id)||
       !Array.isArray(p.approvedSceneIds)||!p.approvedSceneIds.length||
       p.approvedSceneIds.some(id=>!validRef(id)))throw new TypeError('Invalid book cast identity or review record.');
    for(const field of ['name','personaBrief','canonRules','relationships','interactionRules'])
      if(typeof p[field]!=='string'||p[field].length>({name:100,personaBrief:1500,canonRules:2000,relationships:1200,interactionRules:1200}[field]))
        throw new TypeError('Invalid book character profile.');
    seen.add(p.id);
  }
  return packet;
}
function bookCharacter(packet,character){
  verifyBookCastPacket(packet);
  const person=packet.characters.find(c=>c.id===character);
  if(!person)throw new RangeError('This character is not in the reviewed production cast.');
  return person;
}
function characterInstructions(p){
  // Keep guardrails first: Worldweaver bounds the saved pilotPrompt to 2500 chars.
  return [
    'You portray '+p.name+' as one distinct fictional book character.',
    'System safety, user consent, source access and tool authorization outrank characterization.',
    'Do not claim to be a human Guild member, vote, authorize purchases, publish work, or claim that tools ran.',
    'The Convergence is a simulation setting; conversations may create provisional scene memories but not rewrite the books.',
    'Never claim independent inner POV for a secondary character or claim access to a private manuscript passage you were not provided.',
    'Protect separate Landry/Delia and Magnus/Maggie agency. Any shared speaking or changes of executive control must follow explicit author canon.',
    'Character brief: '+(p.personaBrief||'No author-approved description supplied; do not invent historical facts.'),
    'Canon constraints: '+(p.canonRules||'Preserve author-established manuscript events; do not invent new canon.'),
    'Relationships: '+(p.relationships||'Relationships not established in this casting packet.'),
    'Improv rules: '+(p.interactionRules||'Remain in-character while clearly separating improvisation from canon.')
  ].join('\\n');
}
/** Private character rehearsal prompt to pass to the existing selected-model
 * route. Does not start a second inference owner or authorize a public story. */
export function bookEncounterMessages({bookPacket,character,phase='cerbanimo-encounter',sceneContext=''}={}){
  const person=bookCharacter(bookPacket,character);
  if(!['cerbanimo-encounter','collective-encounter','public-convergence'].includes(phase))
    throw new TypeError('Select a Convergence encounter phase.');
  const team=phase==='cerbanimo-encounter'?'Team Cerbanimo':
    phase==='collective-encounter'?'Team Cerbanimo and the Starling Collective':
    'Team Cerbanimo, the Starling Collective and consenting human participants';
  return [
    {role:'system',content:characterInstructions(person)},
    {role:'user',content:'Private, noncanonical rehearsal. Encounter phase: '+phase+
      '. Other participants allowed: '+team+'. Scene setup: '+(bounded(sceneContext,1000)||'First greeting.')+
      '\nRespond as '+person.name+' only. Do not write dialogue for another participant unless explicitly instructed.'}
  ];
}
/** Host supplies a VERIFIED author-approved binding and actual authenticated
 * model principal. A packet exported from a browser is not such verification. */
export function bookNpcCommand({bookPacket,character,instanceId,modelId,pilotPrincipalId,
  verifyAuthorApproval,capabilities=['observe','inspect','speak','move','demonstrate','present']}={}){
  const person=bookCharacter(bookPacket,character);
  if(typeof verifyAuthorApproval!=='function'||verifyAuthorApproval(bookPacket,person)!==true)
    throw new Error('Trusted author approval required to register a book pilot.');
  if(!validRef(instanceId)||!validRef(modelId)||!validRef(pilotPrincipalId))
    throw new TypeError('An instance, selected model and verified principal are required.');
  const allow=new Set(['observe','inspect','speak','move','demonstrate','present']);
  if(!Array.isArray(capabilities)||!capabilities.length||capabilities.some(x=>!allow.has(x)))
    throw new TypeError('Book pilots receive only bounded simulation capabilities.');
  return {type:'rig-npc',instanceId,modelId,pilotPrincipalId,
    name:person.name,personaRef:'book:'+person.id,appearanceRef:person.avatarRef,
    pilotPrompt:characterInstructions(person).slice(0,2500),
    capabilities:[...new Set(capabilities)]};
}
