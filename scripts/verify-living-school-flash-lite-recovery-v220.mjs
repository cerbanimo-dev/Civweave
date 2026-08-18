import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const core=read('public/app/cabinets/living-school/living-school-cleanroom-core-v218.mjs');
const controller=read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs');
const index=read('public/app/cabinets/living-school/index.html');

assert.match(core,/const BATCH_SIZE=3;/,'Structured generation must batch at most three modules per Flash-Lite call.');
assert.match(core,/purpose:DESIGN_PURPOSE,taskTier:'complex',executionProfile:'agentic'/,'Research\/design must explicitly select the complex Flash tier.');
assert.match(core,/purpose:STRUCTURE_PURPOSE,taskTier:'small',executionProfile:'interactive'/,'Structured construction must explicitly select Flash-Lite.');
assert.match(core,/await ensureModuleVideo\(normalized,/,'A module must receive its required video before it can be admitted.');
assert.match(core,/regenerateLivingSchoolResearch/,'Heroes must be able to regenerate the unstructured research\/design packet.');
assert.match(core,/regenerateLivingSchoolStructure/,'Heroes must be able to retry only incomplete structured modules.');
assert.match(core,/discardLivingSchoolFailedDrafts/,'Heroes must be able to discard quarantined failed drafts.');
assert.match(core,/history:\[historyEntry\(1,count,completedCount,failedCount\)\]/,'The first structured pass must record measurable completion\/failure progress.');
assert.match(core,/const targets=\(report\.modules\|\|\[\]\)\.filter\(row=>row\.status!==['"]complete['"]\)/,'Structured retries must target incomplete modules only.');

const structureStart=core.indexOf('async function structureBatch');
const structureEnd=core.indexOf('async function runStructurePass',structureStart);
assert.ok(structureStart>=0&&structureEnd>structureStart,'Expected structureBatch implementation.');
const structureBody=core.slice(structureStart,structureEnd);
assert.equal((structureBody.match(/runtime\.generate\(/g)||[]).length,1,'Each Flash-Lite batch must make exactly one generation call; retries are Hero-controlled.');

assert.match(controller,/from'\.\/living-school-cleanroom-core-v218\.mjs';/,'Controller, renderer and actions must share the same unqueried core module instance.');
assert.doesNotMatch(controller,/living-school-cleanroom-core-v218\.mjs\?v=/,'Do not query-version the stateful core module; that would duplicate Living School state.');
assert.match(controller,/data-ls-action="regenerate-ls-research"/,'Recovery UI must expose research\/design regeneration.');
assert.match(controller,/data-ls-action="regenerate-ls-structure"/,'Recovery UI must expose structured regeneration.');
assert.match(controller,/data-ls-action="discard-ls-failed-drafts"/,'Recovery UI must expose failed-draft removal.');
assert.match(controller,/View unstructured research\/design content/,'Recovery UI must expose unstructured content.');
assert.match(controller,/Complete the missing generated modules before the final credential gate/,'Partial schools must not unlock final credentialing.');

assert.match(index,/living-school-cleanroom-v218\.mjs\?v=flash-design-lite-recovery-v220/,'Cache busting belongs at the top-level workbench import.');

const maxModules=8;
const maxFirstPassLiteCalls=Math.ceil(maxModules/3);
assert.equal(maxFirstPassLiteCalls,3,'Eight-module first pass must fit in three Flash-Lite structure calls.');

console.log('Living School Flash → Flash-Lite recovery v220 verification passed.');
