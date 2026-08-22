import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const cabinetDir=path.join(root,'public/app/cabinets/living-school');
const serviceDir=path.join(root,'public/app/services/living-school');
const [index,runtime,core,renderSource,actionsSource,css,serviceIndex,serviceManifest,localResearch,knowledgeRuntime]=await Promise.all([
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-core-v218.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-render-v218.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-actions-v218.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-v218.css'),
  read('public/app/services/living-school/index.html'),
  read('public/app/services/living-school/manifest.webmanifest'),
  read('public/app/living-school-local-research-v243.mjs'),
  read('public/app/knowledge-school-runtime-v243.mjs')
]);

assert(index.includes('data-living-school-runtime="cleanroom-v218"'),'Living School is not marked as the clean-room runtime.');
assert(index.includes('data-living-school-revision="structured-single-v221"'),'The structured single-module curriculum revision is not exposed.');
assert(index.includes('id="living-school-root"'),'The canonical continuous surface is missing.');
assert(index.includes('living-school-cleanroom-v218.mjs?v=structured-single-v221'),'The structured single-module runtime cache revision is not loaded.');
assert(index.includes('living-school-cleanroom-v218.css?v=research-first-v218.1'),'The research-first stylesheet cache revision is not loaded.');
for(const retired of ['id="room"','data-room','ls-tray','ls-drawer','id="actions"','id="moss"','id="compass"','living-school-bootstrap-v194.js','living-school-flat-loader','living-school-workbench','living-school-interactions','living-school-paths','living-school-two-agent-relay','living-school-mutation-guard'])assert(!index.includes(retired),`Canonical HTML still contains retired surface token ${retired}.`);

const cabinetFiles=(await readdir(cabinetDir)).filter(name=>/\.(?:js|mjs)$/.test(name));
const activeFiles=new Set(['living-school-cleanroom-v218.mjs','living-school-cleanroom-core-v218.mjs','living-school-cleanroom-core-v218-base.mjs','living-school-cleanroom-core-v219.mjs','living-school-cleanroom-render-v218.mjs','living-school-cleanroom-actions-v218.mjs']);
let listenerCount=0;
const forbidden=[
  ['room map',/\bconst\s+rooms\b|\bfunction\s+room\s*\(|\bstate\.room\b/],
  ['room attributes',/data-room/],
  ['room API',/setRoom/],
  ['synthetic activation',/\.click\s*\(/],
  ['indirect native bridge',/openNative/],
  ['mutation observer',/MutationObserver/],
  ['legacy drawer',/ls-drawer|action-list/],
  ['legacy local tray',/ls-tray/],
];
for(const name of cabinetFiles){
  const source=await read(`public/app/cabinets/living-school/${name}`);
  listenerCount+=(source.match(/addEventListener\s*\(/g)||[]).length;
  for(const [label,pattern] of forbidden)assert(!pattern.test(source),`${name} still contains ${label}.`);
  if(!activeFiles.has(name))assert(source.length<1000&&source.includes('living-school-legacy-removed-v218'),`${name} is not a small explicit removal marker.`);
}
assert.equal(listenerCount,1,'Living School must contain exactly one page event-listener registration across every cabinet script.');
assert.equal((runtime.match(/document\.addEventListener\('click',handleLivingSchoolClick,true\)/g)||[]).length,1,'The one listener must be the canonical delegated click controller.');
assert(!/addEventListener\s*\(\s*['"](?:submit|change|pointer|touch|storage)/.test(runtime),'A second input or state listener was introduced.');
assert(runtime.includes("controller:'single-delegated-click-handler'"),'The runtime does not expose its single-owner contract.');
assert(runtime.includes('if(target.disabled||busy)return'),'The canonical controller lacks a re-entry lock.');
assert(runtime.includes('dispatchCount+=1')&&runtime.includes('livingSchoolDispatchCount'),'Dispatches are not inspectable.');
assert(runtime.includes('source-links-v260'),'The canonical runtime does not cache-bust the source-linked renderer.');
assert(core.includes('delete next.room')&&core.includes('delete next.currentRoom')&&core.includes('delete next.lastRoom'),'Legacy navigation fields are not removed during migration.');
assert(core.includes('You are Moss, Living School learning guide'),'Moss does not own Living School generation.');
assert(core.includes('never impersonate another Civweave guide')||core.includes('Never impersonate another guide'),'Guide identity boundary is missing from curriculum generation.');

for(const token of [
  "purpose:'living-school-live-source-research-v218.1'",
  "purpose:'living-school-training-data-research-fallback-v218.1'",
  'liveFetched===true',
  'NO LIVE SOURCE FETCHED · MODEL-DERIVED AND UNVERIFIED',
  'hasCurrentResearch',
  'researchCapability',
  'Use only supplied source IDs.',
  'Every lesson block must include sourceIds when grounded',
  'generated-unverified',
  "formatContract:'living-school-module-contract-v218.1'"
])assert(core.includes(token),`Research-first curriculum core is missing ${token}.`);

for(const token of [
  'summary','relevance','prerequisites','estimatedEffort','artifact','completionCriteria','learningObjectives',
  'lessonBlocks','visualization','practice','quiz','badge','xp','navigation','cerbanimoQuest',
  "questionsPerAttempt:3","type:'multiple-choice'","type:'multi-select'","type:'short-answer'"
])assert(core.includes(token),`Living School module contract is missing ${token}.`);
assert(core.includes('while(rows.length<count+2)'),'Quiz banks are not guaranteed to be larger than an attempt.');
assert(core.includes("['network','flow','timeline','cycle','comparison','matrix','tree']"),'Supported visualization types are not constrained.');

for(const token of [
  "'research-sources':",
  'await researchCapability(data.capability,{force:false})',
  "'evaluate-assessment':",
  'quizQuestions(module,progress)',
  'Targeted review:',
  "'prefill-practicum':"
])assert(actionsSource.includes(token),`Canonical action layer is missing ${token}.`);

for(const token of [
  'Research sources',
  'Research & regenerate curriculum',
  'Research & generate curriculum',
  'Concepts and definitions',
  'Completion criteria',
  'Visible rubric',
  'mixed questions from a bank of',
  'data-ls-action="inspect-visual-item"',
  'data-ls-action="prefill-practicum"',
  'provenanceFlag',
  'Open referenced article',
  'sourceChip(source)',
  'target="_blank"',
  'rel="noopener noreferrer"'
])assert(renderSource.includes(token),`Visible curriculum surface is missing ${token}.`);

for(const token of [
  'source-links-v260',
  'canonicalUrl',
  'linkProvenance',
  'url:source.url',
  'Every returned source must preserve its exact opened URL',
  'Preserve supplied source IDs and URLs exactly'
])assert(localResearch.includes(token),`Living School research adapter is missing source-link contract ${token}.`);
for(const token of [
  'extractArticleMetadata',
  'canonicalNearHit',
  'bestMetadataForPassage',
  'canonicalUrl:url',
  'archive-manifest-title-match',
  'canonical-source-links'
])assert(knowledgeRuntime.includes(token),`Knowledge-school reader is missing canonical-link recovery ${token}.`);

const actionTokens=new Set([...index.matchAll(/data-ls-action="([^"]+)"/g),...renderSource.matchAll(/data-ls-action=\\?"([^"\\]+)\\?"/g)].map(match=>match[1]));
assert(actionTokens.size>=18,'The clean-room surface lost expected direct actions.');
for(const action of actionTokens)assert(actionsSource.includes(`'${action}':`),`Action ${action} is rendered without a canonical handler.`);
assert(!/<button(?![^>]*type="button")[^>]*data-ls-action/i.test(index+renderSource),'Every actionable button must be explicitly non-submitting.');
for(const token of ['.lsc218-root','touch-action:manipulation','.lsc218-research-status','.lsc218-contract-grid','.lsc218-visual','.lsc218-question','.lsc218-provenance'])assert(css.includes(token),`The clean-room interaction styling is missing ${token}.`);

assert(serviceIndex.includes('http-equiv="refresh"')&&serviceIndex.includes('/app/cabinets/living-school/index.html'),'The retired service page does not route to the canonical surface.');
assert(JSON.parse(serviceManifest).start_url==='/app/cabinets/living-school/index.html','The retired standalone manifest can still launch the old surface.');
for(const name of ['index.inline.js','interface-surfaces.js','living-displays.js','visual-core.js','world-engine.js']){
  const source=await read(`public/app/services/living-school/${name}`);
  const size=(await stat(path.join(serviceDir,name))).size;
  assert(size<1000,`${name} still carries legacy application logic.`);
  assert(source.includes('living-school-service-surface-retired-v218'),`${name} is not an explicit retirement marker.`);
  assert(!/addEventListener|MutationObserver|\.click\s*\(|data-room|setRoom/.test(source),`${name} still contains an interaction tripwire.`);
}

console.log(JSON.stringify({
  ok:true,
  revision:'living-school-cleanroom-v221-structured-single',
  pageEventListeners:listenerCount,
  canonicalHandler:'handleLivingSchoolClick',
  continuousSurface:true,
  researchBeforeGeneration:true,
  explicitResearchControl:true,
  paragraphProvenance:true,
  linkedSourceProvenance:true,
  localCanonicalArticleLinks:true,
  completeModuleContract:true,
  mixedQuizBank:true,
  targetedRemediation:true,
  legacyNavigationLogic:false,
  syntheticActivations:false,
  mutationObservers:false,
  retiredServiceSurface:true,
  renderedActions:actionTokens.size
},null,2));