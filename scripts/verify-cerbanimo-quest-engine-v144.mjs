import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../public/app/cerbanimo-quest-engine-v144.js', import.meta.url), 'utf8');
const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
};
const context = {
  console,
  localStorage,
  URLSearchParams,
  structuredClone,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  Date,
  Math,
  JSON,
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'cerbanimo-quest-engine-v144.js' });

const engine = context.CommonweaveCerbanimoQuestV144;
assert.ok(engine, 'quest engine global should be exported');
assert.equal(engine.VERSION, '1.0.32-cerbanimo-v144');

const quest = engine.createQuestFromInput({
  title: 'Restore the workshop',
  objective: 'A dependency-aware quest engine works inside Cabinet Mode.',
  steps: 'Define the result\nBuild the engine\nAttach proof',
  acceptanceCriteria: 'Progress is computed\nBlocked tasks stay blocked',
  proofRequirements: 'Design note\nWorking code\nTest output',
  sequential: true,
});
assert.equal(quest.tasks.length, 3);
assert.deepEqual(Array.from(quest.tasks[1].dependencies), [quest.tasks[0].id]);
assert.equal(engine.deriveQuest(quest).blocked, 2);
assert.match(engine.deriveQuest(quest).nextAction, /Start: Define the result/);

engine.writeState({ schema: 'cerbanimo.quest-engine.v144', version: 1, quests: [quest], receipts: [], migration: {}, preferences: { activeQuestId: quest.id } });
let result = engine.applyTaskTransition(quest.id, quest.tasks[1].id, 'in-progress');
assert.equal(result.ok, false, 'dependent task cannot start early');
result = engine.applyTaskTransition(quest.id, quest.tasks[0].id, 'in-progress');
assert.equal(result.ok, true);
result = engine.applyTaskTransition(quest.id, quest.tasks[0].id, 'review');
assert.equal(result.ok, false, 'proof gate should prevent review');
result = engine.addProof(quest.id, quest.tasks[0].id, { kind: 'test', label: 'Test output', value: 'All checks pass.' });
assert.equal(result.ok, true);
result = engine.applyTaskTransition(quest.id, quest.tasks[0].id, 'review');
assert.equal(result.ok, true);
result = engine.applyTaskTransition(quest.id, quest.tasks[0].id, 'completed', 'Accepted.');
assert.equal(result.ok, true);

const afterFirst = engine.readState().quests[0];
assert.equal(engine.dependencyState(afterFirst, afterFirst.tasks[1]).blocked, false);
assert.ok(engine.deriveQuest(afterFirst).progress > 0);
assert.match(engine.deriveQuest(afterFirst).nextAction, /Start: Build the engine/);

const action = {
  id: 'action-quest-1',
  title: 'Build a time-loop prototype',
  sourceText: 'Make a game with friends.',
  fields: { objective: 'Build one playable time-loop encounter.', smallestVisibleResult: 'A friend can finish one loop.' },
  checkpoints: ['Write the rules', 'Build one encounter', 'Run a playtest'],
  acceptanceCriteria: ['One loop is playable'],
  evidence: ['Playable artifact', 'Test notes'],
};
const imported = engine.importActionAsQuest(action);
assert.equal(imported.sourceActionId, action.id);
assert.equal(imported.tasks.length, 3);
assert.equal(imported.source, 'kamiya-approved-action');

console.log('Cerbanimo quest engine v144 verification passed.');
