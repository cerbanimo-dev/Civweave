import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const runtime=await import('../public/app/shared/learning-pack-runtime-v1.mjs');
const coreModule=await import('../public/app/shared/core-practice-pack-v1.mjs');
const catalog=JSON.parse(fs.readFileSync(new URL('../public/downloads/learning-packs/catalog.json',import.meta.url),'utf8'));
const livingEntry=fs.readFileSync(new URL('../public/app/cabinets/living-school/index.html',import.meta.url),'utf8');
const cerbanimoEntry=fs.readFileSync(new URL('../public/app/realm-console-v140.html',import.meta.url),'utf8');
const cerbanimoAdapter=fs.readFileSync(new URL('../public/app/cerbanimo-learning-packs-v1.js',import.meta.url),'utf8');
const livingAdapter=fs.readFileSync(new URL('../public/app/cabinets/living-school/living-school-learning-packs-v1.mjs',import.meta.url),'utf8');
const builder=fs.readFileSync(new URL('./build-learning-packs-v1.mjs',import.meta.url),'utf8');
const seedRuntime=fs.readFileSync(new URL('../public/app/learning-pack-seeds-v1.js',import.meta.url),'utf8');

const normalized=runtime.registerPack(coreModule.default);
assert.equal(normalized.schema,'civweave.learning-pack.v1');
assert.equal(normalized.taskTemplates.length,20);
assert.equal(normalized.learningUnits.length,12);
assert.equal(normalized.expertGuides.length,10);
assert.ok(normalized.skills.length>=20);

const software=runtime.search('small software change test regression',{kinds:['task-template']});
assert.equal(software[0].id,'task.software-small-change');
const quest=runtime.compileTaskTemplate('task.software-small-change');
assert.equal(quest.source,'learning-pack');
assert.equal(quest.steps.length,5);
assert.ok(quest.acceptanceCriteria.length>=3);
assert.match(quest.description,/Expert guidance:/);

const learning=runtime.compileLearningUnit('learn.software-change');
assert.equal(learning.intent,'new');
assert.equal(learning.level,'intermediate');
assert.equal(learning.newPath,true);

const guarded=runtime.compileTaskTemplate('task.work-area-check');
assert.equal(guarded.packMetadata.riskClass,'guarded');
assert.match(guarded.description,/Stop conditions:/);

const laborDraft=runtime.laborTaskDraft({
  id:'labor:1',title:'Example occupation',occupationCode:'00-0000.00',
  essentialSkills:[{id:'skill.example',label:'Example skill'}],
  taskStatements:[{id:'1',text:'Operate example equipment.'}],sourceRefs:['source']
},'1');
assert.equal(laborDraft.requiresAdaptation,true);
assert.equal(laborDraft.riskClass,'guarded');
assert.equal(laborDraft.steps.length,0);

const core=catalog.packs.find(row=>row.id==='civweave-core-practice-v1');
assert.ok(core?.available&&core?.bundled&&core?.module);
const onet=catalog.packs.find(row=>row.id==='onet-labor-atlas-30-3');
assert.ok(onet?.generated&&onet?.buildCommand);

assert(livingEntry.includes('living-school-learning-packs-v1.mjs'),'Living School active entry does not load the pack adapter.');
assert(cerbanimoEntry.includes('/app/cerbanimo-learning-packs-v1.js'),'Cerbanimo active entry does not load the pack adapter.');
assert(cerbanimoEntry.indexOf('cerbanimo-quest-engine-v144.js')<cerbanimoEntry.indexOf('cerbanimo-learning-packs-v1.js'),'Cerbanimo pack adapter must load after the quest engine.');
for(const token of ['CivweaveCerbanimoLearningPacksV1','templateToQuest','createQuest','laborTaskDraft'])assert(cerbanimoAdapter.includes(token),`Cerbanimo pack adapter missing ${token}`);
for(const token of ['CivweaveLivingSchoolLearningPacksV1','curriculumInput','generateCurriculum'])assert(livingAdapter.includes(token),`Living School pack adapter missing ${token}`);
for(const token of ['record.module','moduleBuffer','sha256','bootstrapCore'])assert(seedRuntime.includes(token),`Offline pack seed runtime missing ${token}`);
for(const token of ['occupation_data.json','task_statements.json','essential_skills.json','tasks_to_dwas.json','CC-BY-4.0','reference examples, not procedural instructions'])assert(builder.includes(token),`O*NET builder missing ${token}`);

const fingerprint=crypto.createHash('sha256').update(JSON.stringify(coreModule.default)).digest('hex').slice(0,16);
console.log('Learning-pack v1 contract passed.',{tasks:normalized.taskTemplates.length,learning:normalized.learningUnits.length,guides:normalized.expertGuides.length,coreFingerprint:fingerprint});
