import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const bytes=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url));
const catalog=JSON.parse(read('public/downloads/learning-packs/catalog.json'));
const laborCore=read('public/app/shared/labor-intelligence-core-v1.mjs');
const shelf=read('public/app/shared/learning-pack-shelf-v1.mjs');
const cerbanimo=read('public/app/cerbanimo-learning-packs-v1.js');
const living=read('public/app/living-school-learning-packs-v1.mjs');
const fellowfareCabinet=read('public/app/services/fellowfare/cabinet.html');
const fellowfareLabor=read('public/app/services/fellowfare/labor-context-v1.mjs');
const rook=read('public/app/rook-request-flow-v160.js');
const realm=read('public/app/realm-console-v140.html');

for(const id of ['onet-labor-atlas-30-3','esco-skill-crosswalk-v1']){
  const record=catalog.packs.find(row=>row.id===id);assert(record,`Missing core labor record ${id}.`);
  assert.equal(record.available,true,`${id} must be published in the core package.`);
  assert.equal(record.optional,false,`${id} must no longer be user-optional functionality.`);
  assert.equal(record.coreInfrastructure,true,`${id} must be marked as core infrastructure.`);
  assert.equal(record.hiddenFromShelf,true,`${id} must not appear as a user-managed shelf pack.`);
  assert.equal(record.managedBy,'labor-intelligence-core-v1',`${id} must be owned by the core labor manager.`);
  assert.equal(record.autoStage,false,`${id} must remain lazy so launch does not regress.`);
  assert(record.bytes>0&&/^[a-f0-9]{64}$/.test(record.sha256),`${id} needs a published verified artifact.`);
}

assert(shelf.includes("INTERNAL_CORE_PACKS=new Set(['onet-labor-atlas-30-3','esco-skill-crosswalk-v1'])"),'Shelf does not hide core labor infrastructure.');
assert(shelf.includes('!record?.coreInfrastructure'),'Shelf does not honor catalog core-infrastructure metadata.');
assert(laborCore.includes("ATLAS_ID='onet-labor-atlas-30-3'"));
assert(laborCore.includes("CROSSWALK_ID='esco-skill-crosswalk-v1'"));
assert(laborCore.includes('ensureAtlas'));assert(laborCore.includes('ensureCrosswalk'));assert(laborCore.includes('enrichWorkContext'));
assert(laborCore.includes('forceOccupations||isLaborQuery(text)'),'Labor Atlas must stay lazy for non-labor requests.');
assert(!realm.includes('labor-intelligence-core-v1'),'Cerbanimo boot entry must not eagerly load the heavy labor intelligence module.');

for(const [name,source] of [['Cerbanimo',cerbanimo],['Living School',living]]){
  assert(source.includes('labor-intelligence-core-v1'),`${name} generation is not wired to core labor intelligence.`);
  assert(source.includes('laborContext'),`${name} generation does not retain labor context.`);
  assert(source.includes('normalizedSkillRefs'),`${name} generation does not retain normalized skill refs.`);
}
assert(cerbanimo.includes('createRecommendedQuest')&&cerbanimo.includes('query});'),'Cerbanimo recommendation flow must carry the original request into labor enrichment.');
assert(living.includes('generateRecommendedCurriculum')&&living.includes('query});'),'Living School recommendation flow must carry the original capability request into labor enrichment.');
assert(living.includes('descriptive, not procedural'),'Living School must label occupation material as non-procedural context.');

assert(fellowfareCabinet.includes('labor-context-v1.mjs?v=core-labor-v1'),'FellowFare embedded market does not load its core labor bridge.');
for(const token of ['enrichThread','handoffWork','handoffLearning','laborContext','occupationRefs'])assert(fellowfareLabor.includes(token),`FellowFare labor bridge missing ${token}.`);
assert(rook.includes('enrichActionLabor')&&rook.includes('occupationRefs'),'Rook request previews do not gain core labor context.');

const atlasRecord=catalog.packs.find(row=>row.id==='onet-labor-atlas-30-3');
const atlas=JSON.parse(gunzipSync(bytes(`public/downloads/learning-packs/${atlasRecord.file}`)).toString('utf8'));
assert.equal(atlas.schema,'civweave.learning-pack.v1');
assert.equal(atlas.id,'onet-labor-atlas-30-3');
assert(atlas.laborReferences.length>=1000,'Core Labor Atlas lost broad occupation coverage.');
const sample=atlas.laborReferences.find(row=>row.taskStatements?.length&&row.essentialSkills?.length);assert(sample,'Labor Atlas has no usable occupation sample.');
const runtime=await import('../public/app/shared/learning-pack-runtime-v1.mjs');runtime.registerPack(atlas);
const draft=runtime.laborTaskDraft(sample.id,sample.taskStatements[0].id,{packId:atlas.id});
assert.equal(draft.requiresAdaptation,true,'O*NET reference statements must require adaptation.');
assert.equal(draft.steps.length,0,'O*NET reference statements must never become executable steps directly.');
assert.equal(draft.riskClass,'guarded','O*NET reference drafts must remain guarded.');

const escoRecord=catalog.packs.find(row=>row.id==='esco-skill-crosswalk-v1');
const esco=JSON.parse(gunzipSync(bytes(`public/downloads/learning-packs/${escoRecord.file}`)).toString('utf8'));
assert.equal(esco.id,'esco-skill-crosswalk-v1');
assert.equal(esco.crosswalks?.schema,'civweave.skill-crosswalk.v1','ESCO core artifact crosswalk schema is missing.');
assert(Array.isArray(esco.crosswalks?.skillMappings)&&esco.crosswalks.skillMappings.length>0,'ESCO core artifact has no skill mappings.');
assert(Array.isArray(esco.crosswalks?.occupationMappings)&&esco.crosswalks.occupationMappings.length>100,'ESCO core artifact has no occupation bridge.');

console.log('Core labor intelligence verified.',{
  occupations:atlas.laborReferences.length,
  taskStatements:atlas.laborReferences.reduce((sum,row)=>sum+(row.taskStatements?.length||0),0),
  essentialSkillRows:atlas.laborReferences.reduce((sum,row)=>sum+(row.essentialSkills?.length||0),0),
  occupationMappings:esco.crosswalks.occupationMappings.length,
  skillMappings:esco.crosswalks.skillMappings.length,
  atlasBytes:atlasRecord.bytes,
  escoBytes:escoRecord.bytes,
  safety:{requiresAdaptation:draft.requiresAdaptation,steps:draft.steps.length,riskClass:draft.riskClass}
});
