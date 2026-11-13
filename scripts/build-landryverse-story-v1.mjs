/**
 * The Girls Who Stole Tomorrow - authoring-fixture build and read-only test run.
 * One-off adapter for existing Worldweaver and portable client owners, NOT
 * a new game-state owner, model worker, author approval or chat runtime.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {exportPortableUniverseHtml,normalizePortableUniverse} from '../public/app/shared/worldweaver-portable-client-v1.mjs';

const root=new URL('../docs/universe/the-girls-who-stole-tomorrow/',import.meta.url);
const read=async file=>JSON.parse(await readFile(new URL(file,root),'utf8'));
const idPattern=/^[a-z0-9][a-z0-9-]{1,95}$/;
const scenes=['kitchen','bakery','diner'];
const allowedSpeakers=new Set(['loom','landry','delia','magnus','maggie','diner-child']);
const spoilers=/\bOther Landry\b|counterpart.landry|Auction Registrar|Library Beyond Tomorrow|benevolent architect|designer of the system/i;
const clone=v=>JSON.parse(JSON.stringify(v));

export async function loadLandryverseInputs(){
 const [manifest,loom,cast,fixture]=await Promise.all([
  read('manifest.json'),read('loom-coordinates.json'),read('cast/character-sheets.json'),
  read('rehearsals/02-scripted-test.json')
 ]);
 const inputs={manifest,loom,cast,fixture};
 validateLandryverseInputs(inputs);
 return inputs;
}

export function validateLandryverseInputs({manifest,loom,cast,fixture}){
 if(manifest?.schema!=='civweave.story-universe.authoring.v1'||!idPattern.test(manifest.id))
  throw new TypeError('Expected bounded authoring manifest');
 if(loom?.schema!=='civweave.loom-coordinates.story-draft.v1'||loom.universeId!==manifest.id)
  throw new TypeError('Loom Coordinates must match the authoring universe');
 if(manifest.integration?.actorProvisioning!==false||loom.provenance?.castApproval!=='pending'||
    loom.provenance.runtimeReceipts?.length!==0)
  throw new Error('Unapproved cast or runtime receipt may not become a live pilot');
 if(!Array.isArray(cast?.characters)||cast.characters.length!==11||
    cast.approval!=='required-by-human-author')
  throw new TypeError('Expected 11 author-review character profiles');
 const ids=cast.characters.map(p=>p.id);
 if(new Set(ids).size!==ids.length||ids.some(id=>!idPattern.test(id)))
  throw new TypeError('Invalid character identity or duplicated ID');
 if(fixture?.schema!=='civweave.landryverse.scripted-table-read.v1'||
    fixture.mode!=='scripted-no-inference'||!Array.isArray(fixture.turns))
  throw new TypeError('Invalid opt-in scripted fixture');
 if(!Array.isArray(loom.worldRules)||loom.worldRules.length<5||
    !Array.isArray(loom.chapterOneState?.openQuestions))
  throw new TypeError('Chapter one needs bounded evidence and open questions');
 return true;
}

/** In-world data intentionally excludes editorial cast, secret lore and private author files. */
export function buildLandryverseBlueprint(inputs){
 validateLandryverseInputs(inputs);
 const {manifest,loom}=inputs;
 const rooms=[
  {
   id:'kitchen',title:'Landry\'s Kitchen',guide:'moss',
   description:'A phone, a torn cat calendar and a rune-stone necklace. Record what you can observe before deciding what happened to tomorrow.',
   stations:[{stationType:'explanation',title:'Date anomaly',instructions:'Observe the calendar ending at midnight. Distinguish direct observation from an inferred cause.'}]
  },
  {
   id:'bakery',title:'The Corner Bakery',guide:'kamiya',
   description:'The town continues its day. A booking printer, a passenger timetable and witnesses offer partial, conflicting evidence.',
   stations:[{stationType:'practice',title:'Cross-check the reports',instructions:'Compare independently observed scheduling failures. Do not claim time has stopped.'}]
  },
  {
   id:'diner',title:'The Roadside Diner',guide:'merlin',
   description:'A child with blueberry pancakes and six sugar packets asks Landry to listen. The physical photograph raises more questions than it answers.',
   stations:[{stationType:'debate',title:'The seventh rescue',instructions:'Ask the child what she is comfortable sharing. Respect refusal; no prophecy is automatically canon.'}]
  },
  {
   id:'threshold',title:'The Unwritten Threshold',guide:'rook',
   description:'A provisional evidence table for the diner screens, the cut photograph and the unopened next day. No alternate life has been selected for anybody.',
   stations:[{stationType:'display',title:'Evidence ledger',instructions:'Compare the photograph with the local journal. Preserve uncertainty, individual agency and open exits.'}]
  }
 ];
 const prompts=[
  'Investigate the calendar anomaly without treating a scheduling error as proof that time has ended.',
  'Ask the child one respectful question about the missing fifth face in the photograph.',
  'Record one directly observed clue and one alternative explanation in the private journal.',
  'Cooperate to locate evidence about bidding at midnight without buying or assigning anyone a future.',
  'Respect each participant\'s consent when a new doorway or possible timeline appears.',
  'A fruit-fly bigfixer can reveal a clue. Do not infer speech or magic from ordinary movement.'
 ];
 // This is a presentation-ready portable blueprint; it is not authoring canon.
 return normalizePortableUniverse({
  id:manifest.id,title:manifest.title,premise:manifest.premise,
  rooms,storyPressure:prompts
 });
}

/** In-memory draft test uses exactly the canonical Worldweaver owner. */
export function buildLandryverseDraft(blueprint){
 const actor={kind:'human',principalId:'human:fixture-test'};
 let next=0;
 const world=createWorldweaver({
  id:()=>`landryverse-test-${++next}`,
  clock:()=> '2026-11-05T13:00:00.000Z',
  authorize:({actor:a,command})=>
   a===actor&&['create','create-screen','add-station'].includes(command.type)
 });
 for(const room of blueprint.rooms){
  const created=world.dispatch({type:'create',guide:room.guide,title:room.title,description:room.description},actor);
  const instanceId=created.instance.id;
  world.dispatch({type:'create-screen',instanceId,title:room.title+' evidence',aspectRatio:'16:9'},actor);
  for(const station of room.stations){
   world.dispatch({type:'add-station',instanceId,
    stationType:station.kind,title:station.title,instructions:station.instructions},actor);
  }
 }
 const snapshot=world.snapshot();
 // Safety invariant: never silently provision a draft or register an AI pilot.
 if(snapshot.instances.some(p=>p.status!=='draft'||p.world!==null)||snapshot.npcs.length||snapshot.intents.length)
  throw new Error('Worldweaver draft unexpectedly provisioned or changed external state');
 return snapshot;
}

export function runScriptedLandryverseTableRead(inputs){
 validateLandryverseInputs(inputs);
 const {manifest,loom,cast,fixture}=inputs;
 const castIds=new Set(cast.characters.map(x=>x.id));
 const knowledge=loom.chapterOneState.knowledgeByActor;
 const turnLog=[],roles=new Set(),seenScenes=[];
 for(let i=0;i<fixture.turns.length;i++){
  const turn=fixture.turns[i];
  if(turn.id!=='t'+String(i+1).padStart(2,'0')||
     !scenes.includes(turn.scene)||!castIds.has(turn.actor)||
     !allowedSpeakers.has(turn.actor))
   throw new Error('Actor not authorized for chapter one or nonsequential turn');
  if(turn.kind!==(turn.actor==='loom'?'scene':'dialogue'))
   throw new Error('Loom may only state scene context; fictional roles supply dialogue');
  if(typeof turn.text!=='string'||!turn.text.trim()||turn.text.length>1200)
   throw new TypeError('Empty or unbounded turn');
  if(spoilers.test(turn.text))throw new Error('Author-only spoiler leaked into chapter one');
  if(/\bfuck\b/i.test(turn.text))throw new Error('Reserved saga final-line profanity used');
  if(!Array.isArray(turn.factsUsed)||turn.factsUsed.length>5)
   throw new TypeError('Facts used must be bounded');
  const has=knowledge[turn.actor]||[];
  if(turn.factsUsed.some(f=>!has.includes(f)))
   throw new Error('Actor used unavailable knowledge: '+turn.actor);
  const sceneRank=scenes.indexOf(turn.scene);
  if(seenScenes.length&&sceneRank<scenes.indexOf(seenScenes.at(-1)))
   throw new Error('Scene clock must not move backward');
  if(!seenScenes.includes(turn.scene))seenScenes.push(turn.scene);
  if(turn.actor==='loom'&&turn.factsUsed.length)throw new Error('Loom context cannot claim private knowledge');
  roles.add(turn.actor);
  turnLog.push({id:turn.id,scene:turn.scene,actor:turn.actor,kind:turn.kind,
   text:turn.text,groundedFacts:[...turn.factsUsed],status:'scripted-provisional'});
 }
 if(!['kitchen','bakery','diner'].every(s=>seenScenes.includes(s))||
     !['landry','delia','maggie','magnus','diner-child'].every(a=>roles.has(a)))
  throw new Error('Incomplete chapter one scene or cast coverage');
 return {
  schema:'civweave.landryverse.rehearsal-test.v1',
  universeId:manifest.id,mode:'scripted-no-inference',status:'passed',
  scenario:fixture.id,turnCount:turnLog.length,scenes:seenScenes,roles:[...roles],
  authorApproval:'pending',modelCalls:0,externalWorldWrites:0,canonChanges:0,
  knowledgeChecks:'all turns passed actor-specific context allowlist',
  chapterOneOpenQuestions:[...loom.chapterOneState.openQuestions],
  turns:turnLog
 };
}

export function buildLandryverseArtifact(inputs){
 const blueprint=buildLandryverseBlueprint(inputs);
 const html=exportPortableUniverseHtml(blueprint);
 const report=runScriptedLandryverseTableRead(inputs);
 const draft=buildLandryverseDraft(blueprint);
 return {blueprint,html,report:{
  ...report,generatedBy:'scripts/build-landryverse-story-v1.mjs',
  pilotRuntime:'not-connected',authorApproval:'pending',
  portableClient:'existing-canonical-worldweaver-portable-client-v1',
  draftWorld:{schema:draft.schema,revision:draft.revision,
   instances:draft.instances.map(x=>({id:x.id,title:x.title,status:x.status,world:x.world})),
   stations:draft.stations.length,screens:draft.screens.length,
   intents:draft.intents.length,npcs:draft.npcs.length}
 }};
}

async function cli(){
 const args=process.argv.slice(2);
 const outIndex=args.indexOf('--out'),check=args.includes('--check');
 if(outIndex>=0&&(!args[outIndex+1]||args[outIndex+1].startsWith('--')))
  throw new TypeError('Specify an output directory after --out');
 if(args.some((a,i)=>a.startsWith('--')&&!['--check','--out'].includes(a)))
  throw new TypeError('Unsupported command option');
 const inputs=await loadLandryverseInputs();
 const bundle=buildLandryverseArtifact(inputs);
 const summary={status:'passed',turns:bundle.report.turnCount,
   actors:bundle.report.roles.length,rooms:bundle.report.draftWorld.instances.length,
   modelCalls:0,mode:'scripted-no-inference',htmlBytes:Buffer.byteLength(bundle.html)};
 if(!check){
  const dir=resolve(outIndex>=0?args[outIndex+1]:'dist/landryverse-test');
  await mkdir(dir,{recursive:true});
  await writeFile(resolve(dir,inputs.manifest.id+'.civweave.html'),bundle.html,'utf8');
  await writeFile(resolve(dir,'table-read-report.json'),JSON.stringify(bundle.report,null,2)+'\n','utf8');
  await writeFile(resolve(dir,'portable-blueprint.json'),JSON.stringify(bundle.blueprint,null,2)+'\n','utf8');
  summary.output=dir;
 }
 process.stdout.write(JSON.stringify(summary,null,2)+'\n');
}
const invoked=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(invoked)cli().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
