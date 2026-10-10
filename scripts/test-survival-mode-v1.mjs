import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planAssessment,normalizeReferenceCards,buildReferenceQuery,buildFieldPacket,verificationChecklist} from '../public/app/survival/survival-mode.mjs';

test('unassessed conditions are unknown, never declared safe',()=>{
  const assessment=planAssessment();
  assert.equal(assessment.priority,'unassessed');
  assert.match(assessment.nextStep,/check|assess|look/i);
  assert.deepEqual(assessment.reportedConcerns,[]);
});
test('urgent danger outranks repairs and research without an AI call',()=>{
  const result=planAssessment({concerns:['plant','pipe','immediate-danger']});
  assert.equal(result.priority,'emergency');
  assert.equal(result.primaryConcern,'immediate-danger');
  assert.match(result.nextStep,/emergency|safe/i);
});
test('injury is flagged for qualified emergency help, not diagnosed',()=>{
  const result=planAssessment({concerns:['injury']});
  assert.equal(result.priority,'emergency');
  assert.match(result.nextStep,/emergency/i);
  assert.equal(result.diagnosis,null);
});
test('a plant photograph alone is not treated as identification or proof of edibility',()=>{
  const result=planAssessment({concerns:['plant'],photoAttached:true});
  assert.equal(result.photoStatus,'not-analyzed');
  assert.equal(result.diagnosis,null);
  assert.match(result.nextStep,/do not eat|do not consume/i);
  assert.match(result.caution,/lookalikes|identification/i);
});
test('electrical hazards take precedence over ordinary pipe troubleshooting',()=>{
  const result=planAssessment({concerns:['pipe','electricity']});
  assert.equal(result.primaryConcern,'electricity');
  assert.equal(result.priority,'emergency');
});
test('unknown concern values and photo bytes are not accepted as inferred observations',()=>{
  const result=planAssessment({concerns:['plant','imagined-danger'],resources:['tarp'],photoAttached:true});
  assert.deepEqual(result.reportedConcerns,['plant']);
  assert.deepEqual(result.reportedResources,['tarp']);
  assert.equal(result.photoStatus,'not-analyzed');
  assert.equal(JSON.stringify(result).includes('imagined-danger'),false);
});
test('offline reference cards preserve source metadata and reject empty passages',()=>{
  const cards=normalizeReferenceCards([
    {title:'Field botany',notes:'Compare venation and stem morphology.',canonicalUrl:'https://example.org/botany',schoolName:'Botany',license:'CC BY-SA'},
    {title:'Empty article',notes:'  '},
    {title:'Duplicate',notes:'Compare venation and stem morphology.',canonicalUrl:'https://example.org/botany'}
  ],'foundation');
  assert.equal(cards.length,1);
  assert.equal(cards[0].availability,'offline-excerpt');
  assert.equal(cards[0].title,'Field botany');
  assert.equal(cards[0].license,'CC BY-SA');
  assert.equal(cards[0].url,'https://example.org/botany');
});
test('reference search terms are based on user reports, not image inference',()=>{
  assert.match(buildReferenceQuery({concerns:['plant'],photoAttached:true}),/plant|botan/i);
  assert.match(buildReferenceQuery({concerns:['pipe']}),/plumb|water/i);
});
test('active entry exposes Survival Mode and keeps it in offline package',async()=>{
  const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
  const actions=await read('public/app/persistent-shell-actions-v1.js');
  const pack=JSON.parse(await read('public/app/offline-package-v208.json'));
  const ownership=JSON.parse(await read('config/system-ownership.json'));
  assert.match(actions,/data-cw-persistent-action="survival"/);
  assert.ok(pack.seeds.includes('/app/survival/index.html'));
  assert.ok(pack.assets.includes('/app/survival/app.mjs'));
  assert.equal(ownership.systems['survival-assessment']?.owner,'public/app/survival/survival-mode.mjs');
});


test('ICM field packet contains user-reported observations, never inferred photo contents',()=>{
  const packet=buildFieldPacket({
    concerns:['plant','pipe'],
    resources:['tarp','water bottle'],
    observations:['Serrated leaves observed','White flowers visible'],
    photoAttached:true,
    imageBytes:'data:image/jpeg;base64,VERY_PRIVATE_PHOTO_BYTES',
    location:{latitude:44,longitude:-76}
  },[{title:'Botany note',notes:'Several species share these characteristics.',canonicalUrl:'https://example.org/botany'}]);
  assert.equal(packet.schema,'civweave.survival-field-packet.v1');
  assert.deepEqual(packet.observations.userReported,['Serrated leaves observed','White flowers visible']);
  assert.deepEqual(packet.observations.aiInferred,[]);
  assert.equal(packet.photo.status,'not-analyzed');
  assert.equal(packet.photo.bytesIncluded,false);
  assert.equal(packet.priority.primaryConcern,'plant');
  assert.equal(packet.references[0].verifiedIdentification,false);
  assert.equal(packet.references[0].availability,'offline-excerpt');
  assert.equal(packet.privacy.exportRequiresAction,true);
  assert.doesNotMatch(JSON.stringify(packet),/VERY_PRIVATE_PHOTO_BYTES|latitude|longitude|data:image/);
});
test('field packets remain unassessed and unsourced if nothing was inspected',()=>{
  const packet=buildFieldPacket({photoAttached:false,observations:[]});
  assert.equal(packet.priority.priority,'unassessed');
  assert.deepEqual(packet.references,[]);
  assert.equal(packet.photo.status,'not-provided');
  assert.ok(packet.unknowns.includes('unverified-surroundings'));
});
test('plant lookalike prompts cannot be treated as approval to eat',()=>{
  const checks=verificationChecklist({concerns:['plant']});
  assert.ok(checks.length>=4);
  assert.ok(checks.some(row=>/lookalike/i.test(row)));
  assert.ok(checks.some(row=>/not eat|do not eat|do not consume/i.test(row)));
});
test('ICM survival workflow is explicitly a disabled, typed staged contract',async()=>{
  const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
  const manifest=JSON.parse(await read('public/app/ai-workflows/manifest.json'));
  assert.equal(manifest.runtimeEnabled,false);
  const survival=manifest.workflows.find(row=>row.id==='survival-assessment');
  assert.ok(survival);
  assert.equal(survival.canonicalOwner,'public/app/survival/survival-mode.mjs');
  assert.deepEqual(survival.stages.map(x=>x.id),['intake','observe','prioritize','research','verify','handoff']);
  assert.equal(survival.stages.find(x=>x.id==='prioritize').executor,'deterministic');
  assert.equal(survival.stages.find(x=>x.id==='verify').executor,'human');
});


test('exported field evidence preserves the saved source tier and availability',()=>{
  const record=buildFieldPacket({concerns:['pipe']},[
    {title:'Repair reference',notes:'Check hazards first.',canonicalUrl:'https://example.org/repair',tier:'expanded/deep'}
  ]);
  assert.equal(record.references[0].tier,'expanded/deep');
  assert.equal(record.references[0].availability,'offline-excerpt');
  assert.equal(record.references[0].verifiedIdentification,false);
});
