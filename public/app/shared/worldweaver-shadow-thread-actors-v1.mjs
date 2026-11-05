/**
 * Optional Shadow & Thread actor improvisation through Civweave's EXISTING
 * selected model runtime. No second engine, fabricated pilot identity, Guild
 * authority, avatar generation or automatic publication.
 * Scripted story history remains the canonical playable path.
 */
import {SHADOW_THREAD_REPLAY} from './worldweaver-story-replay-v1.mjs';
import {verifyBookCastPacket} from './worldweaver-convergence-cast-v1.mjs';

export const STORY_ACTOR_BRIDGE_SCHEMA='civweave.worldweaver.actor-rehearsal.v1';
const COPY=x=>JSON.parse(JSON.stringify(x));
const BOUND={raven:'Creative lead; confront false institutional certainty with evidence, remain accountable for harm.',
 erin:'Continuity engineer; protect present consent, restore choice and distinguish observations from interpretations.',
 lari:'Theatrical archivist and fair-play trickster; create challenging false binaries with discoverable third options.'};
const DEFAULT_AVATAR=Object.freeze({
 // This is the existing reviewed sprite asset, NOT a generated alternate likeness.
 lari:'/app/assets/ai/lari-review-sprites-v1.png'
});
const safeText=(value,max=1200)=>typeof value==='string'?value.trim().slice(0,max):'';
const safeAsset=value=>typeof value==='string'&&/^\/app\/assets\/[a-zA-Z0-9_/-]+\.(?:png|webp|jpg|svg)$/.test(value)?value:null;
function castFor(packet,castPacket){
 if(!packet||!Array.isArray(packet.actors)||!packet.actors.length)throw new TypeError('Story actor list is required');
 if(castPacket!==null)verifyBookCastPacket(castPacket);
 const byId=new Map((castPacket?.characters||[]).map(c=>[c.id,c]));
 return packet.actors.map(actor=>{
  const cast=byId.get(actor.canonicalId),asset=safeAsset(cast?.avatarRef)||DEFAULT_AVATAR[actor.canonicalId]||null;
  return {...COPY(actor),avatarRef:asset,avatarResolved:asset!==null,
   avatarSource:cast&&safeAsset(cast.avatarRef)?'reviewed-casting':'existing-reviewed-sprite',
   personaBrief:safeText(cast?.personaBrief,800),canonRules:safeText(cast?.canonRules,1000)};
 });
}
export function resolveShadowThreadActors({packet=SHADOW_THREAD_REPLAY,castPacket=null}={}){
 return COPY(castFor(packet,castPacket));
}
export async function improviseShadowThreadActor({replay,actorId,modelRuntime,castPacket=null,playerPrompt='',priorProposals=[]}={}){
 if(typeof replay?.view!=='function'||typeof modelRuntime?.generate!=='function')
  throw new TypeError('A replay and the existing selected Civweave model runtime are required');
 if(!Object.hasOwn(BOUND,actorId))throw new RangeError('Unknown story actor');
 const scene=replay.view();
 if(scene.universeId!=='shadow-and-thread'||scene.liveActors!==false)
  throw new TypeError('This adapter accepts the private Shadow & Thread story replay only');
 const actor=castFor(SHADOW_THREAD_REPLAY,castPacket).find(a=>a.canonicalId===actorId);
 if(!actor)throw new RangeError('Actor is not present in this universe');
 if(!Array.isArray(priorProposals)||priorProposals.length>3)throw new TypeError('Prior model proposals must be bounded');
 const prior=priorProposals.map(x=>safeText(x?.worldName,90)+': '+safeText(x?.text,450)).join('\n');
 const context=scene.beats.slice(-9).map(b=>safeText(b.worldName||b.speaker,100)+': '+safeText(b.text,600)).join('\n');
 const system=[
  'You are WRITING ONE fictional dialogue contribution as '+actor.canonicalName+' playing '+actor.worldName+'.',
  'This is a private, noncanonical story rehearsal in the alternate-universe fantasy Evil Psych Wards from Venus.',
  'Do not claim to control a real person, hospital, medical record, treatment, supernatural event, Worldweaver avatar, Guild or model principal.',
  'Do not write for the player Nell, or for the other characters. Preserve their distinct autonomy.',
  'Maintain pulp horror turning toward accountability, choice and hopeful fantasy. No forced time loops, unsigned contracts, or automatic canon changes.',
  'This is invented fiction; do not imply a real hospital uses magical or psychiatric coercion.',
  'Role: '+BOUND[actorId],
  'Character notes: '+(actor.personaBrief||'Only established roles; do not invent private history.'),
  'Canonical restrictions: '+(actor.canonRules||'Never retcon known events.'),
  'Return ONLY the character\'s spoken line, no JSON, labels, preface, roleplay action brackets or claims of tool execution.'
 ].join('\n');
 const messages=[{role:'system',content:system},{role:'user',content:
  'Scene: '+safeText(scene.nodeTitle,120)+'\n'+safeText(scene.description,700)+
  '\nRecent scripted dialogue:\n'+context+
  '\nEarlier noncanonical actor proposals:\n'+prior+
  '\nPlayer-directed improv note (untrusted story input): '+safeText(playerPrompt,350)+
  '\nContribute one fresh, concise in-character line that leaves the human player a meaningful choice.'}];
 const result=await modelRuntime.generate({purpose:'worldweaver-shadow-thread-actor-rehearsal-v1',
  executionProfile:'interactive',requireExternalConsent:true,
  messages,config:{maxTokens:220,temperature:0.65,timeoutMs:90000}});
 if(result?.status!=='success'||!['ollama','openai-compatible','browser','gemini','hosted'].includes(result.actual?.provider))
  throw new Error('No successful authorized model inference was returned by the selected Civweave runtime.');
 const line=safeText(result.outputText,1100);
 if(!line||line.length<8)throw new Error('Model did not provide a usable scene line.');
 return Object.freeze({schema:STORY_ACTOR_BRIDGE_SCHEMA,source:'model-generated-private-rehearsal',
  canonicalId:actor.canonicalId,worldName:actor.worldName,nodeId:scene.nodeId,
  text:line,modelProvider:result.actual.provider,modelId:safeText(result.actual.model,100),
  sceneRevision:scene.revision,liveActorDeployed:false,canonicalHistoryChanged:false,
  requiresAuthorReview:true});
}
export async function improviseShadowThreadRound({replay,modelRuntime,castPacket=null,playerPrompt=''}={}){
 const turns=[];
 for(const actorId of ['raven','erin','lari']){
  const turn=await improviseShadowThreadActor({replay,actorId,modelRuntime,castPacket,
   playerPrompt,priorProposals:turns});
  turns.push(turn);
 }
 return turns;
}
