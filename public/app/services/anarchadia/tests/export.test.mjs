import test from 'node:test';
import assert from 'node:assert/strict';
import { syntheticFixture } from '../src/domain.js';
import { buildBundle, validateBundle, verifyBundleHash, bundleToImportState } from '../src/export.js';

test('selective export contains only selected record classes', async () => {
  const state = syntheticFixture();
  const bundle = await buildBundle(state, ['charter', 'dissent']);
  assert.ok(bundle.payload.charter);
  assert.ok(bundle.payload.dissents);
  assert.equal(bundle.payload.threats, undefined);
  assert.equal(validateBundle(bundle).valid, true);
  assert.equal((await verifyBundleHash(bundle)).valid, true);
});

test('tampered payload fails checksum verification', async () => {
  const bundle = await buildBundle(syntheticFixture(), ['charter']);
  bundle.payload.charter.title = 'Tampered';
  assert.equal((await verifyBundleHash(bundle)).valid, false);
});

test('bundle restores source-scoped metadata without inventing identity', async () => {
  const source = syntheticFixture();
  const bundle = await buildBundle(source, ['charter']);
  const fallback = syntheticFixture();
  const restored = bundleToImportState(bundle, fallback);
  assert.equal(restored.meta.communityRef, source.meta.communityRef);
  assert.equal(restored.charter.title, source.charter.title);
  assert.equal(restored.meta.identity, undefined);
});

test('decision bundles carry portable bug and forge improvement records', async () => {
  const state = syntheticFixture();
  state.improvementSystem = {
    bugs: [{ id: 'bug_demo', title: 'Broken visual route', status: 'triage' }],
    forgeDrafts: [{ id: 'forge_demo', proposalId: 'proposal_demo', at: '2026-07-29T00:00:00.000Z' }],
    railChecks: [{ id: 'local_only', result: 'conforming locally' }]
  };
  const bundle = await buildBundle(state, ['decisions']);
  assert.deepEqual(bundle.payload.improvementSystem.bugs, state.improvementSystem.bugs);
  assert.deepEqual(bundle.payload.improvementSystem.forgeDrafts, state.improvementSystem.forgeDrafts);
  assert.equal(bundle.payload.improvementSystem.railChecks, undefined);
  assert.equal(validateBundle(bundle).valid, true);
  assert.equal((await verifyBundleHash(bundle)).valid, true);
});


test('civic operations travel only with their selected export classes', async () => {
  const state = syntheticFixture();
  state.civicSystem.petitionSignals.push({ id:'petition_demo', proposalId:'proposal_demo', signal:'support' });
  state.civicSystem.rollbacks.push({ id:'rollback_demo', version:1, status:'proposal draft' });
  const decisions = await buildBundle(state, ['decisions']);
  assert.ok(decisions.payload.civicSystem.petitionSignals.length > 0);
  assert.ok(decisions.payload.civicSystem.experiments.length > 0);
  assert.equal(decisions.payload.civicSystem.rollbacks, undefined);
  const amendments = await buildBundle(state, ['amendments']);
  assert.ok(amendments.payload.civicSystem.rollbacks.length > 0);
  assert.equal(validateBundle(amendments).valid, true);
});
