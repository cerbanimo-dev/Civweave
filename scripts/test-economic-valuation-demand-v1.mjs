import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app/civweave-basic-value-systems-v1.js', import.meta.url), 'utf8');
const loaderSource = readFileSync(new URL('../public/app/family-ai-loader-v105.js', import.meta.url), 'utf8');
const KEY = 'cerbanimo.quest-engine.v144';
const CIV = 'civweave.working-campus.v1';
const LIVING = 'civweave.living-school.cabinet.v151';
const task = (id, title = id) => ({ id, title, description: `Make ${title}`, status: 'in-progress', proofs: [], review: { state: 'pending' } });
const valuation = { status: 'model-reviewed-fair', pricingReady: true, laborWorthHours: 1, baseline: { buttons: 5 }, reviewer: { model: 'test-only' } };

function harness() {
  const stores = new Map(), listeners = new Map(), timers = [], calls = [], events = [], writes = [];
  let resolveReview;
  const pending = new Promise(resolve => { resolveReview = resolve; });
  const context = vm.createContext({
    console, Date, Math, JSON, Map, Set, Object, Array, String, Number,
    localStorage: { getItem: key => stores.get(key) ?? null, setItem: (key, value) => { stores.set(key, String(value)); writes.push(key); } },
    document: { readyState: 'loading', querySelectorAll: () => [], querySelector: () => null },
    addEventListener(type, callback) { const rows = listeners.get(type) || []; rows.push(callback); listeners.set(type, rows); },
    dispatchEvent(event) { events.push(event); for (const callback of listeners.get(event.type) || []) callback(event); return true; },
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    setTimeout(callback) { timers.push(callback); return timers.length; }, clearTimeout() {},
    CivweaveModelRuntime: { generate: async () => { throw new Error('The systems adapter must call the shared review owner'); } },
    CivweaveBasicValueReviewV1: { reviewSubjects: async (...args) => { calls.push(args); return pending; } },
  });
  vm.runInContext(source, context);
  context.dispatchEvent({ type: 'DOMContentLoaded' });
  return {
    api: context.CivweaveBasicValueSystemsV1, calls, events, writes,
    set(key, state) { stores.set(key, JSON.stringify(state)); },
    get(key) { return JSON.parse(stores.get(key)); },
    emit(type, detail) { context.dispatchEvent({ type, detail, key: detail?.key }); },
    async flush() { while (timers.length) await timers.shift()(); await Promise.resolve(); },
    resolve: resolveReview,
  };
}

test('boot, storage, plan creation, proof transitions and unscoped calls never start valuation inference', async () => {
  const app = harness();
  app.set(KEY, { quests: [{ id: 'q1', tasks: [task('t1')] }] });
  app.set(CIV, { plan: { id: 'p1', paths: [{ id: 'path1', tasks: [task('c1')] }] } });
  app.set(LIVING, { school: { id: 'school1', modules: [task('m1')] } });
  for (const name of ['storage', 'civweave:working-campus-plan-built', 'cerbanimo:quest-engine-changed', 'living-school:module-completed', 'living-school:assessment-completed', 'civweave:economic-review-requested']) app.emit(name, { key: KEY });
  app.api.run(); app.api.schedule?.(0);
  await app.flush();
  assert.equal(app.calls.length, 0, 'only an explicit review of identified subjects may start the model');
  assert.equal(app.writes.length, 0);
});

test('explicit request reviews only named IDs in one store and merges into fresh state', async () => {
  const app = harness();
  app.set(KEY, { quests: [{ id: 'q1', tasks: [task('t1'), task('t2')] }], preferences: { activeQuestId: 'q1' } });
  app.set(CIV, { plan: { id: 'p1', paths: [{ id: 'path1', tasks: [task('c1')] }] } });
  const run = app.api.run({ key: KEY, ids: ['t1'] });
  assert.equal(app.calls.length, 1);
  assert.deepEqual(Array.from(app.calls[0][1], row => row.id), ['t1']);
  const fresh = app.get(KEY);
  fresh.quests[0].tasks[0].proofs.push({ id: 'real-proof', note: 'Added during review' });
  fresh.quests[0].tasks[0].status = 'completed';
  fresh.quests[0].tasks[0].review = { state: 'accepted', validator: 'ai', id: 'review-now' };
  fresh.quests[0].tasks.push(task('t3'));
  fresh.preferences.activeQuestId = 'new-selection';
  app.set(KEY, fresh);
  app.resolve([{ id: 't1', valuation }, { id: 't2', valuation }]);
  assert.equal(await run, true);
  const saved = app.get(KEY);
  assert.deepEqual(saved.quests[0].tasks[0].proofs, fresh.quests[0].tasks[0].proofs);
  assert.equal(saved.quests[0].tasks[0].status, 'completed');
  assert.deepEqual(saved.quests[0].tasks[0].review, fresh.quests[0].tasks[0].review);
  assert.equal(saved.preferences.activeQuestId, 'new-selection');
  assert.equal(saved.quests[0].tasks.length, 3);
  assert.equal(saved.quests[0].tasks[0].valuation.laborWorthHours, 1);
  assert.equal(saved.quests[0].tasks[1].valuation, undefined);
  assert.equal(app.get(CIV).plan.paths[0].tasks[0].valuation, undefined);
  assert.equal(app.events.find(row => row.type === 'civweave:economic-valuations-updated').detail.count, 1);
});

for (const change of ['removed', 'edited', 'evidence-requirement', 'criteria', 'moved', 'duplicate']) test(`review result cannot resurrect or overwrite a ${change} subject`, async () => {
  const app = harness();
  app.set(KEY, { quests: [{ id: 'q1', tasks: [task('t1')] }] });
  const run = app.api.run({ key: KEY, ids: ['t1'] });
  const fresh = app.get(KEY);
  if (change === 'removed') fresh.quests[0].tasks = [];
  if (change === 'edited') fresh.quests[0].tasks[0].description = 'A different scope';
  if (change === 'evidence-requirement') fresh.quests[0].tasks[0].proofRequired = 'A different deliverable';
  if (change === 'criteria') fresh.quests[0].tasks[0].acceptanceCriteria = [{ criterion: 'An updated acceptance condition' }];
  if (change === 'moved') fresh.quests[0].id = 'q2';
  if (change === 'duplicate') fresh.quests.push({ id: 'q2', tasks: [task('t1')] });
  app.set(KEY, fresh);
  app.resolve([{ id: 't1', valuation }]);
  assert.equal(await run, false);
  assert.deepEqual(app.get(KEY), fresh);
  assert.equal(app.writes.length, 0);
});

test('ambiguous, missing, broad or invalid requests cannot invoke inference', async () => {
  const app = harness();
  app.set(KEY, { quests: [{ id: 'q1', tasks: [task('t1')] }, { id: 'q2', tasks: [task('t1')] }] });
  for (const request of [undefined, 'realm-work-created', { key: KEY }, { key: 'other', ids: ['t1'] }, { key: KEY, ids: [] }, { key: KEY, ids: ['missing'] }, { key: KEY, ids: ['t1'] }, { key: KEY, ids: Array.from({ length: 25 }, (_, i) => String(i)) }]) {
    assert.equal(await app.api.run(request), false);
  }
  assert.equal(app.calls.length, 0);
});

test('explicit requests have bounded backpressure and never queue hidden follow-up model jobs', async () => {
  const app = harness();
  app.set(KEY, { quests: [{ id: 'q1', tasks: [task('t1'), task('t2')] }] });
  const first = app.api.run({ key: KEY, ids: ['t1'] });
  assert.equal(await app.api.run({ key: KEY, ids: ['t2'] }), false);
  app.resolve([{ id: 't1', valuation }]);
  await first; await app.flush();
  assert.equal(app.calls.length, 1);
});

test('missing valuation is displayed as unreviewed rather than implying queued background work', () => {
  const app = harness();
  assert.match(app.api.valuationText(null), /not reviewed/i);
  assert.doesNotMatch(app.api.valuationText(null), /awaiting|queued|running/i);
});

test('family loader rejects unscoped requests before loading the model and has no generic inference subscribers', async () => {
  const start = loaderSource.indexOf('function requestEconomicReview(');
  const end = loaderSource.indexOf('\nfunction ', start + 1);
  assert.ok(start > 0 && end > start);
  const calls = [], context = vm.createContext({
    ensure: async () => { calls.push('ensure'); },
    globalThis: { CivweaveBasicValueSystemsV1: { run: async request => { calls.push(request); return true; } } },
    economicReviewQueued: false, Object, Array, String,
  });
  vm.runInContext(`${loaderSource.slice(start, end)};this.requestEconomicReview=requestEconomicReview`, context);
  for (const request of [undefined, 'cerbanimo-quest-changed', { key: KEY }, { key: 'invalid', ids: ['t1'] }]) context.requestEconomicReview(request);
  assert.equal(calls.length, 0);
  const request = { key: KEY, ids: ['t1'] }, result = context.requestEconomicReview(request);
  request.ids.push('t2');
  assert.equal(context.requestEconomicReview({ key: KEY, ids: ['t3'] }), false, 'loading an explicit review must apply backpressure');
  assert.equal(await result, true);
  assert.equal(calls[0], 'ensure');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), { key: KEY, ids: ['t1'] });
  assert.doesNotMatch(loaderSource, /addEventListener\('(civweave:working-campus-plan-built|cerbanimo:quest-engine-changed)'[^\n]*requestEconomicReview/);
});
