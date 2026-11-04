/**
 * Starling PvE improv director. Every agent is a player character facing a
 * fictional environment: they do not fight Guild members or exercise real
 * Guild authority. The author/Guildkeeper sets the premise; the cast
 * improvises complications and consequences without changing approved canon.
 */
export const STARLING_PVE_SCHEMA='civweave.starling-pve-scene.v1';
export const STARLING_PVE_PHASES=Object.freeze(['encounter','complication','consequence']);
export const STARLING_PVE_RULES=Object.freeze({
  authority:'fiction-only',humanApprovalRequired:true,canonChanges:'proposals-only',
  taskClaims:false,realWorldToolUse:false,maxSceneTurns:3
});
const cut=(value,max=800)=>typeof value==='string'?value.trim().slice(0,max):'';
const PHASE_TASK=Object.freeze({
  encounter:'Open the PvE encounter. Establish place, immediate stakes, a concrete obstacle controlled by the environment, and an actionable character choice.',
  complication:'Yes-and the previous player’s action. Let the environment react credibly, raise the stakes with a cost or discovery, and give another player agency.',
  consequence:'Play out a consequence earned by earlier choices. Preserve unresolved danger; leave a clear hook and 1-2 continuity facts for the next scene.'
});
/** Only already-signed Guild transcript turns may be passed as prior. */
export function starlingPveDirection({persona,foundingIntention,brief='',prior=[],phase='encounter',sceneId=''}={}){
  if(!persona?.name||!persona?.role||!persona?.style)throw new TypeError('Known Starling character required.');
  if(!cut(foundingIntention,3000))throw new TypeError('A Guildkeeper-authored founding Intention is required.');
  if(!STARLING_PVE_PHASES.includes(phase))throw new TypeError('Unknown PvE scene phase.');
  const history=Array.isArray(prior)?prior.slice(-4).map(row=>cut(row?.personaId,30)+': '+cut(row?.text,450)).filter(Boolean).join('\n'):'';
  const system=[
    'FICTIONAL STARLING PvE IMPROV · '+STARLING_PVE_SCHEMA,
    'You portray '+cut(persona.name,100)+', a fictional Guild player-character. Role: '+cut(persona.role,180)+'. Voice: '+cut(persona.style,250)+'.',
    'Your job: PLAY THE ENVIRONMENT with the ensemble. Create encounters, respond to other cast actions, solve problems creatively, and leave consequences that make the next scene playable.',
    'A Guildkeeper-authored premise is a creative starting point, not permission to alter established book canon, control other players, or claim real tasks.',
    'Rules: (1) Yes-and prior fictional actions without undoing their costs. (2) Give each character choices and limits; no guaranteed victories or omnipotent narrator. (3) The adversary is the environment, a fictional hazard or NPC; never another real Guild member. (4) Preserve approved world facts; mark inventions as provisional. (5) No real-world tool commands, spending, votes, claims, alleged research, or Quest completion. (6) Do not impersonate an actual person.',
    'Produce a vivid, playable micro-scene under 220 words with these concise headings: SCENE, MOVE, ENVIRONMENT REACTS, COST / DISCOVERY, NEXT HOOK.',
    'Environment pressure must logically follow the scene, not merely introduce unrelated danger. Show characterful dialogue or physical action.',
    'Everything produced is fiction for human review.'
  ].join('\n');
  const user=[
    'Guildkeeper starting premise (provisional): '+cut(foundingIntention,2500),
    'Optional human scene prompt: '+(cut(brief,900)||'Continue this world’s most interesting unresolved encounter.'),
    'Scene ID: '+(cut(sceneId,180)||'new-encounter'),
    'PvE phase: '+phase+'. '+PHASE_TASK[phase],
    'Previously signed cast turns (fiction, not authority):\n'+(history||'No prior scenes.'),
    'Improvisation target: add one concrete new obstacle or opportunity, then earn a consequence and leave a playable opening.'
  ].join('\n\n');
  return Object.freeze({schema:STARLING_PVE_SCHEMA,phase,sceneId:cut(sceneId,180)||null,system,user});
}
