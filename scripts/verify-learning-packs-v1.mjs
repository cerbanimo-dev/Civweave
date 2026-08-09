import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const runtime=await import('../public/app/shared/learning-pack-runtime-v1.mjs');
const coreModule=await import('../public/app/shared/core-practice-pack-v1.mjs');
const expertLibrary=await import('../public/app/shared/expert-pack-library-v1.mjs');
const resolver=await import('../public/app/shared/learning-pack-resolver-v1.mjs');
const catalogUrl=new URL('../public/downloads/learning-packs/catalog.json',import.meta.url);
const catalog=JSON.parse(fs.readFileSync(catalogUrl,'utf8'));
const livingEntry=fs.readFileSync(new URL('../public/app/cabinets/living-school/index.html',import.meta.url),'utf8');
const cerbanimoEntry=fs.readFileSync(new URL('../public/app/realm-console-v140.html',import.meta.url),'utf8');
const cerbanimoAdapter=fs.readFileSync(new URL('../public/app/cerbanimo-learning-packs-v1.js',import.meta.url),'utf8');
const livingAdapter=fs.readFileSync(new URL('../public/app/living-school-learning-packs-v1.mjs',import.meta.url),'utf8');
const builder=fs.readFileSync(new URL('./build-learning-packs-v1.mjs',import.meta.url),'utf8');
const seedRuntime=fs.readFileSync(new URL('../public/app/learning-pack-seeds-v1.js',import.meta.url),'utf8');

const normalized=runtime.registerPack(coreModule.default);
assert.equal(normalized.schema,'civweave.learning-pack.v1');
assert.equal(normalized.taskTemplates.length,20);
assert.equal(normalized.learningUnits.length,12);
assert.equal(normalized.expertGuides.length,10);
assert.ok(normalized.skills.length>=20);

assert.equal(expertLibrary.expertPacks.length,9,'Expert library must expose nine domain packs.');
const normalizedExperts=expertLibrary.expertPacks.map(pack=>runtime.registerPack(pack));
for(const pack of normalizedExperts){
  assert.equal(pack.packType,'expert',`${pack.id} is not marked as an expert pack.`);
  assert.equal(pack.taskTemplates.length,6,`${pack.id} must contain six reusable task templates.`);
  assert.equal(pack.learningUnits.length,3,`${pack.id} must contain three learning units.`);
  assert.equal(pack.expertGuides.length,1,`${pack.id} must contain one domain expert guide.`);
}
const totalTasks=normalized.taskTemplates.length+normalizedExperts.reduce((sum,pack)=>sum+pack.taskTemplates.length,0);
const totalLearning=normalized.learningUnits.length+normalizedExperts.reduce((sum,pack)=>sum+pack.learningUnits.length,0);
const totalGuides=normalized.expertGuides.length+normalizedExperts.reduce((sum,pack)=>sum+pack.expertGuides.length,0);
assert.equal(totalTasks,74);
assert.equal(totalLearning,39);
assert.equal(totalGuides,19);

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
const expertGuarded=runtime.compileTaskTemplate('task.labor.documented-assembly',{packId:'civweave-expert-labor-v1'});
assert.equal(expertGuarded.packMetadata.riskClass,'guarded');
assert.match(expertGuarded.description,/Stop conditions:/);

const laborDraft=runtime.laborTaskDraft({
  id:'labor:1',title:'Example occupation',occupationCode:'00-0000.00',
  essentialSkills:[{id:'skill.example',label:'Example skill'}],
  taskStatements:[{id:'1',text:'Operate example equipment.'}],sourceRefs:['source']
},'1');
assert.equal(laborDraft.requiresAdaptation,true);
assert.equal(laborDraft.riskClass,'guarded');
assert.equal(laborDraft.steps.length,0);

const expertCatalog=catalog.packs.filter(row=>row.packType==='expert');
assert.equal(expertCatalog.length,9,'Catalog must expose nine separately stageable expert packs.');
assert.equal(new Set(expertCatalog.map(row=>row.export)).size,9,'Expert pack export names must be unique.');
for(const record of expertCatalog){
  assert.equal(record.optional,true,`${record.id} should remain optional.`);
  assert.equal(record.bundled,true,`${record.id} should be locally materializable.`);
  assert.equal(record.autoStage,false,`${record.id} should not inflate the mandatory startup pack.`);
  assert.ok(record.module&&record.export,`${record.id} needs module and export metadata.`);
}

const recommendations=[
  ['fix a login bug','civweave-expert-software-v1'],
  ['make a rubric for a lesson','civweave-expert-learning-v1'],
  ['pack a warehouse order','civweave-expert-labor-v1'],
  ['analyze a csv dashboard metric','civweave-expert-data-v1'],
  ['write a source-grounded comparison brief','civweave-expert-research-v1']
];
for(const [query,expected] of recommendations){
  const result=resolver.scoreCatalogRecords(catalog.packs,query,{audience:'cerbanimo',packTypes:['expert'],limit:3});
  assert.equal(result[0]?.id,expected,`Resolver routed “${query}” to ${result[0]?.id||'nothing'} instead of ${expected}.`);
}
const expanded=resolver.expandedQuery('fix a login bug');
assert.match(expanded,/software/);
assert.match(expanded,/debugging/);
const expandedResults=runtime.search(expanded,{kinds:['task-template'],limit:8});
assert(expandedResults.some(row=>row.packId==='civweave-expert-software-v1'),'Expanded task vocabulary did not retrieve a software expert template.');

const core=catalog.packs.find(row=>row.id==='civweave-core-practice-v1');
assert.ok(core?.available&&core?.bundled&&core?.module);
const onet=catalog.packs.find(row=>row.id==='onet-labor-atlas-30-3');
assert.ok(onet?.generated&&onet?.buildCommand);

const atlasUrl=new URL('../public/downloads/learning-packs/onet-labor-atlas-30-3.json.gz',import.meta.url);
let atlasStats=null;
if(fs.existsSync(atlasUrl)){
  const compressed=fs.readFileSync(atlasUrl);
  const hash=crypto.createHash('sha256').update(compressed).digest('hex');
  assert.equal(onet.available,true,'Generated Labor Atlas must become available in the catalog.');
  assert.equal(onet.bytes,compressed.byteLength,'Catalog byte count does not match generated Labor Atlas.');
  assert.equal(onet.sha256,hash,'Catalog SHA-256 does not match generated Labor Atlas.');
  assert.match(onet.sha256,/^[a-f0-9]{64}$/);
  const atlas=JSON.parse(gunzipSync(compressed).toString('utf8'));
  assert.equal(atlas.schema,'civweave.learning-pack.v1');
  assert.equal(atlas.id,'onet-labor-atlas-30-3');
  assert.equal(atlas.sourceRelease,'30.3');
  assert.ok(atlas.laborReferences.length>=1000,'Labor Atlas should cover the wide O*NET occupation set.');
  const taskStatements=atlas.laborReferences.reduce((sum,row)=>sum+row.taskStatements.length,0);
  const essentialSkillRows=atlas.laborReferences.reduce((sum,row)=>sum+row.essentialSkills.length,0);
  const dwaRefs=atlas.laborReferences.reduce((sum,row)=>sum+row.taskStatements.reduce((taskSum,task)=>taskSum+(task.dwaRefs?.length||0),0),0);
  assert.ok(taskStatements>=18000,'Labor Atlas lost too many O*NET task statements.');
  assert.ok(essentialSkillRows>=17000,'Labor Atlas lost too many O*NET essential-skill rows.');
  assert.ok(dwaRefs>=23000,'Labor Atlas lost too many task-to-DWA crosswalks.');
  assert.equal(atlas.license?.id,'CC-BY-4.0');
  assert.equal(atlas.license?.url,'https://creativecommons.org/licenses/by/4.0/');
  assert.match(atlas.license?.attribution||'',/USDOL\/ETA has not approved, endorsed, or tested these modifications/);
  atlasStats={compressedBytes:compressed.byteLength,occupations:atlas.laborReferences.length,taskStatements,essentialSkillRows,dwaRefs,sha256:hash};
}

assert(livingEntry.includes('/app/living-school-learning-packs-v1.mjs'),'Living School active entry does not load the pack adapter.');
assert(cerbanimoEntry.includes('/app/cerbanimo-learning-packs-v1.js'),'Cerbanimo active entry does not load the pack adapter.');
assert(cerbanimoEntry.indexOf('cerbanimo-quest-engine-v144.js')<cerbanimoEntry.indexOf('cerbanimo-learning-packs-v1.js'),'Cerbanimo pack adapter must load after the quest engine.');
for(const token of ['CivweaveCerbanimoLearningPacksV1','recommendPacks','resolve','templateToQuest','createQuest','createRecommendedQuest','laborTaskDraft'])assert(cerbanimoAdapter.includes(token),`Cerbanimo pack adapter missing ${token}`);
for(const token of ['CivweaveLivingSchoolLearningPacksV1','recommendPacks','resolve','curriculumInput','generateCurriculum','generateRecommendedCurriculum'])assert(livingAdapter.includes(token),`Living School pack adapter missing ${token}`);
for(const token of ['record.module','record.export','moduleBuffer','X-Civweave-Pack-Export','sha256','bootstrapCore'])assert(seedRuntime.includes(token),`Offline pack seed runtime missing ${token}`);
for(const token of ['occupation_data.json','task_statements.json','essential_skills.json','tasks_to_dwas.json','DWA Element ID','CC-BY-4.0','LICENSE_URL','reference examples, not procedural instructions','USDOL/ETA has not approved, endorsed, or tested these modifications'])assert(builder.includes(token),`O*NET builder missing ${token}`);

const fingerprint=crypto.createHash('sha256').update(JSON.stringify({core:coreModule.default,experts:expertLibrary.expertPacks})).digest('hex').slice(0,16);
console.log('Learning-pack v1 contract passed.',{coreTasks:normalized.taskTemplates.length,expertPacks:normalizedExperts.length,totalTasks,totalLearning,totalGuides,atlasStats,coreAndExpertFingerprint:fingerprint});
