/**
 * Private author-only Landryverse role rehearsal. The model request uses the
 * EXISTING character-fleet benchmark inference adapter. This is not a second
 * user-facing Civweave chat, NPC authority, automatic novel writer, or world owner.
 *
 * No network access without explicit --run, --config and --accept-creative-context.
 * All story outputs are provisional. Model success is not author approval.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {infer as existingCharacterFleetInfer} from '../tools/character-fleet-bench/run.mjs';
import {loadLandryverseInputs,validateLandryverseInputs} from './build-landryverse-story-v1.mjs';

const roles=[
 ['landry','Ask the girl one evidence-based question. Speak as Landry only.'],
 ['delia','Offer a new observation Landry could hear; do not control Landry. Speak as Delia only.'],
 ['maggie','Give a wry line that helps rather than overrides the child. Speak as Maggie only.'],
 ['magnus','Propose a concrete test of the photograph or calendar anomaly. Speak as Magnus only.'],
 ['merlin','Add an editorial one-sentence systems check; do not impersonate Magnus.'],
 ['gaia-kami','Offer a short ethical story edit preserving everyone\'s choice; editorial voice only.'],
 ['diner-child','Answer one question while keeping your own choice about what you reveal. Speak as the child only.'],
 ['landry','Close the beat with a new question or reversible next action. Speak as Landry only.']
];
const sceneByRole=Object.freeze({
 landry:'You are at the diner. The child claims six rescues. You have seen the cut photograph and the bidding announcement. Their origins are unverified.',
 delia:'You share observations with Landry at the diner, not control of her speech. The child, photograph and bidding screens are observed; their origins remain unknown.',
 maggie:'You are on a phone connection about the calendar anomaly. You have not yet been told about the child, the photograph or the diner screen.',
 magnus:'You are on a phone connection investigating scheduling and calendar failures. You have not personally seen the photograph or the diner.',
 merlin:'You are an outside-the-scene editorial systems reviewer. The chapter proposal is provisional, not your own in-world memory.',
 'gaia-kami':'You are an outside-the-scene thematic editor. Respect uncertainty and consent; no character has a verified backstory beyond the stated proposal.',
 'diner-child':'You are in the diner and have a photograph. You claim to have saved Landry six times; how much to reveal remains your choice.'
});
const forbidden=/Other Landry|counterpart.landry|Auction Registrar|Library Beyond Tomorrow|designer of the system|\bfuck\b/i;

export function validateLandryverseBinding(b){
 if(!b||!['ollama','openai-compatible'].includes(b.provider))throw new TypeError('Unsupported model provider');
 if(typeof b.model!=='string'||!b.model.trim()||b.model.length>160)throw new TypeError('Selected model required');
 if(typeof b.endpoint!=='string'||!/^https?:\/\//.test(b.endpoint)||b.endpoint.length>500)
  throw new TypeError('Valid HTTP(S) model endpoint required');
 return Object.freeze({...b});
}
function profile(inputs,actor){
 const p=inputs.cast.characters.find(c=>c.id===actor);
 if(!p)throw new RangeError('Unrecognized authoring role');
 return p;
}
export function planLandryverseRehearsal(inputs){
 validateLandryverseInputs(inputs);
 return roles.map(([actor,direction],index)=>{
  const p=profile(inputs,actor);
  const facts=inputs.loom.chapterOneState.knowledgeByActor?.[actor]??[];
  const personalFacts=Array.isArray(facts)?facts.slice(0,8):[];
  const system=[
   'Private preview of a fictional novel. You are '+p.name+'.',
   'No tool authority, no actual human or Guild authority, no publication, no canonical story edits.',
   'Maintain separate identities, consent and POV. Do not invent private memories or knowledge.',
   'Style: '+p.voice,
   'Knowledge available for this scene: '+personalFacts.join('; ')+'.',
   'What this character wants: '+(p.wants||[]).slice(0,2).join('; ')+'.',
   'Only write one short turn of your own dialogue or, for editorial roles, one short editorial observation.',
   'If you cannot know a fact, ask; never invent evidence. Do not write screenplay instructions as fact.'
  ].join('\n');
  const base='Chapter One private rehearsal context: '+sceneByRole[actor]+'\nAssignment: '+direction;
  if(forbidden.test(system)||forbidden.test(base))throw new Error('Author-only spoiler leaked into a public role prompt');
  return Object.freeze({index,actor,scene:'diner',mode:'private-preview',system,base});
 });
}
export async function runLandryverseRehearsal({inputs,bindings,invokeModel,timeoutMs=120000}={}){
 if(typeof invokeModel!=='function')throw new TypeError('Explicit invokeModel adapter required; no model call is implicit');
 if(!bindings?.default)throw new TypeError('An explicit default model binding is required');
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>300000)throw new RangeError('Timeout must be bounded');
 const plan=planLandryverseRehearsal(inputs);
 const turns=[];
 for(const beat of plan){
  const b=validateLandryverseBinding({...bindings.default,...(bindings.characters?.[beat.actor]||{})});
  // Only publicly spoken, already generated lines enter the following turn.
  const visible=turns.filter(t=>{
   if(beat.actor==='magnus'||beat.actor==='maggie')return ['magnus','maggie'].includes(t.actor);
   if(beat.actor==='diner-child')return ['landry','diner-child'].includes(t.actor);
   if(beat.actor==='delia')return ['landry','delia'].includes(t.actor);
   if(beat.actor==='landry')return ['landry','delia','diner-child'].includes(t.actor);
   return true; // only non-diegetic editors inspect the full public scene
  });
  const preceding=visible.slice(-4).map(t=>t.actor+': '+t.text).join('\\n');
  const content=beat.base+'\nPreviously spoken lines only:\n'+(preceding||'(none)')+
   '\nStay under 100 words. Give one attributed response; do not write anybody else\'s turn.';
  const messages=[{role:'system',content:beat.system},{role:'user',content}];
  const result=await invokeModel(b,messages,{actor:beat.actor,index:beat.index,timeoutMs});
  const answer=result?.text;
  if(typeof answer!=='string'||!answer.trim())throw new Error('Empty model response for '+beat.actor);
  if(answer.length>2200)throw new Error('Overlong model response for '+beat.actor);
  if(forbidden.test(answer))throw new Error('Unapproved spoiler/profanity in model response for '+beat.actor);
  turns.push({
   index:beat.index,actor:beat.actor,scene:beat.scene,model:b.model,provider:b.provider,
   text:answer.trim(),elapsedMs:Number.isFinite(result.elapsedMs)?result.elapsedMs:null,
   tokens:Number.isFinite(result.tokens)?result.tokens:null,
   status:'provisional-awaits-human-review'
  });
 }
 return {
  schema:'civweave.landryverse.live-preview-report.v1',
  universeId:inputs.manifest.id,
  status:'completed-model-invocations',
  note:'The adapter returned responses; this does not prove a live world, independent minds, or editorial approval.',
  modelCalls:turns.length,worldWrites:0,canonChanges:0,authorApproval:'pending',
  scene:'diner',turns
 };
}
async function main(){
 const argv=process.argv.slice(2);
 const flag=x=>argv.includes(x);
 const opt=(x,def='')=>{const k=argv.indexOf(x);return k<0?def:argv[k+1]||def;};
 const allowed=new Set(['--run','--accept-creative-context','--allow-lan','--allow-remote','--config','--out','--timeout-ms']);
 for(const a of argv)if(a.startsWith('--')&&!allowed.has(a))throw new Error('Unknown option '+a);
 const inputs=await loadLandryverseInputs();
 const plan=planLandryverseRehearsal(inputs);
 if(!flag('--run')){
  process.stdout.write(JSON.stringify({mode:'preview-only',modelCalls:0,turnsPlanned:plan.length,
   actors:plan.map(p=>p.actor),
   command:'--run --config path/to/private-model-bindings.json --accept-creative-context'},null,2)+'\n');
  return;
 }
 if(!flag('--accept-creative-context'))
  throw new Error('Explicit --accept-creative-context required before sending any author text to a model');
 const configPath=opt('--config');
 if(!configPath)throw new Error('A local private --config file is required for actual model calls');
 const bindings=JSON.parse(await readFile(resolve(configPath),'utf8'));
 const timeoutMs=Number(opt('--timeout-ms','120000'));
 const report=await runLandryverseRehearsal({
  inputs,bindings,timeoutMs,
  invokeModel:(binding,messages,{timeoutMs:timeout})=>
   existingCharacterFleetInfer(binding,messages,timeout,flag('--allow-lan'),flag('--allow-remote'))
 });
 const out=resolve(opt('--out','dist/landryverse-private-rehearsal.json'));
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 process.stdout.write(JSON.stringify({mode:'model-generated-provisional',output:out,
  calls:report.modelCalls,characters:[...new Set(report.turns.map(t=>t.actor))],
  authorApproval:report.authorApproval},null,2)+'\n');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
