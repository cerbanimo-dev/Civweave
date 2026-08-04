import test from 'node:test';
import assert from 'node:assert/strict';
import { balances, buildCurriculum, buildIntention, buildMarketDraft, buildProject, createEnvelope, forwardEnvelope, rewardEvents, taskAvailability, unlockCurriculum, validateEnvelope, validatePatch } from '../public/core/domain.js';

test('Commonweave produces three typed requests', () => {
  const intention = buildIntention('Build a small community greenhouse with friends and learn irrigation.');
  assert.equal(intention.schema, 'commonweave.intention.v1');
  assert.equal(intention.learningRequest.schema, 'commonweave.learning-request.v1');
  assert.equal(intention.taskRequest.schema, 'commonweave.task-request.v1');
  assert.equal(intention.materialsRequest.schema, 'commonweave.materials-request.v1');
  assert.equal(intention.learningRequest.intentionId, intention.id);
  assert.equal(intention.taskRequest.intentionId, intention.id);
  assert.equal(intention.materialsRequest.intentionId, intention.id);
});

test('Living School curriculum unlocks in sequence and rewards skills', () => {
  const intention = buildIntention('Learn bicycle repair and repair a neighbor bicycle.');
  let curriculum = unlockCurriculum(buildCurriculum(intention.learningRequest));
  assert.equal(curriculum.modules[0].status, 'available');
  assert.ok(curriculum.modules.slice(1).every(module => module.status === 'locked'));
  curriculum.modules[0].status = 'completed';
  curriculum = unlockCurriculum(curriculum);
  assert.equal(curriculum.modules[1].status, 'available');
  const events = rewardEvents({ system:'living-school', sourceId:curriculum.modules[0].id, rewards:curriculum.modules[0].rewards, skillTags:curriculum.modules[0].skillTags });
  const totals = balances(events);
  assert.equal(totals.acorns, curriculum.modules[0].rewards.acorns);
  assert.ok(Object.values(totals.xp).every(value => value === curriculum.modules[0].rewards.xp));
});

test('Cerbanimo enforces dependencies and carries all reward currencies', () => {
  const intention = buildIntention('Build a small accessible website for a community pantry.');
  let project = buildProject(intention.taskRequest);
  assert.equal(project.tasks[0].status, 'ready');
  assert.ok(project.tasks.slice(1).every(task => task.status === 'blocked'));
  project.tasks[0].status = 'completed';
  project = taskAvailability(project);
  assert.equal(project.tasks[1].status, 'ready');
  const events = rewardEvents({ system:'cerbanimo', sourceId:project.tasks[0].id, rewards:project.tasks[0].rewards, skillTags:project.tasks[0].skillTags });
  const totals = balances(events);
  assert.equal(totals.cotokens, 1);
  assert.equal(totals.buttons, 2);
  assert.equal(totals.acorns, 1);
});

test('FellowFare converts materials to a Button-denominated draft', () => {
  const intention = buildIntention('Build shelving and request reclaimed boards and screws.');
  const listing = buildMarketDraft(intention.materialsRequest, { offeredButtons: 12 });
  assert.equal(listing.schema, 'fellowfare.listing.v1');
  assert.equal(listing.status, 'draft');
  assert.equal(listing.offeredButtons, 12);
  assert.ok(listing.items.length > 0);
});

test('Anarchadia accepts application patches and rejects rail changes', () => {
  const good = validatePatch({
    diff: 'diff --git a/public/styles.css b/public/styles.css\n--- a/public/styles.css\n+++ b/public/styles.css\n@@ -1 +1 @@\n-body{}\n+body{line-height:1.5}',
    tests: ['Contrast remains readable'],
    railsChecked: ['Accessibility rail']
  });
  assert.equal(good.ok, true);
  const bad = validatePatch({
    diff: 'diff --git a/public/core/vault.js b/public/core/vault.js\n--- a/public/core/vault.js\n+++ b/public/core/vault.js\n@@ -1 +1 @@\n-safe\n+apiKey="leak"',
    tests: ['It runs'],
    railsChecked: ['none']
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some(error => error.includes('Protected path')));
});

test('Mesh envelopes are bounded, typed, and secret-scanned', () => {
  const envelope = createEnvelope({ type:'trade.request', origin:'peer-a', payload:{ item:'boards' }, ttl:2 });
  assert.equal(validateEnvelope(envelope).ok, true);
  const once = forwardEnvelope(envelope);
  const twice = forwardEnvelope(once);
  assert.equal(twice.hops, 2);
  assert.equal(forwardEnvelope(twice), null);
  const unsafe = createEnvelope({ type:'trade.request', origin:'peer-a', payload:{ apiKey:'secret' } });
  assert.equal(validateEnvelope(unsafe).ok, false);
});
