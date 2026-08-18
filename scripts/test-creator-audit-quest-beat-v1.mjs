import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../public/creator-suite/audit/quest-beat-v1.js', import.meta.url), 'utf8');
let advanced = null;
const quests = [];
const engine = {
  createQuestFromInput(input) {
    return {
      id: 'quest:audit-1',
      title: input.title,
      objective: input.objective,
      description: input.description,
      source: input.source,
      sourceActionId: input.sourceActionId,
      tasks: input.steps.map((title, index) => ({ id: `task:${index + 1}`, title, description: '', owner: '' })),
    };
  },
  addQuest(quest) { quests.push(structuredClone(quest)); return { ok: true, quest: structuredClone(quest) }; },
  readState() { return { quests: structuredClone(quests) }; },
};
const chronicle = {
  advance(questId, event, context) { advanced = { questId, event, context: structuredClone(context) }; return { questId, currentBeatId: context.beatId }; },
};
const context = vm.createContext({
  console,
  structuredClone,
  setInterval,
  clearInterval,
  URL,
  location: { href: 'https://civweave.test/creator-suite/' },
  document: { scripts: [], head: { append() {} } },
  CivweaveCerbanimoQuestV144: engine,
  CivweaveQuestArcChronicleV1: chronicle,
});
context.globalThis = context;
vm.runInContext(source, context, { filename: 'quest-beat-v1.js' });
const api = context.CivweaveCreatorAuditQuestBeatV1;
assert.ok(api, 'Creator audit Quest Beat API must load');

const batch = {
  schema: 'civweave.creator-audit-sample-batch.v1',
  batchId: 'audit-batch:guild:test:2026-08-18',
  guildId: 'guild:test',
  dayKey: '2026-08-18',
  samples: [
    { sampleId: 'audit:1', priorityReason: 'routine', reviewLane: 'model', receipt: { sessionId: 'creation:1', mediaType: 'text', origin: 'human-authored', receiptHash: 'receipt-1', headHash: 'head-1' } },
    { sampleId: 'audit:2', priorityReason: 'dispute', reviewLane: 'human', receipt: { sessionId: 'creation:2', mediaType: 'video', origin: 'unknown', receiptHash: 'receipt-2', headHash: 'head-2' } },
  ],
};

const built = api.buildQuest(batch);
assert.equal(built.source, 'creator-provenance-audit');
assert.equal(built.sourceActionId, batch.batchId);
assert.equal(built.sequential, false);
assert.equal(built.steps.length, 2);
assert.ok(built.acceptanceCriteria.every(row => /do not infer AI authorship from style/i.test(row)));

const materialized = await api.materialize(batch);
assert.equal(materialized.questBeat, 'reckoning');
assert.equal(materialized.taskCount, 2);
assert.equal(advanced.event, 'SET_BEAT');
assert.equal(advanced.context.beatId, 'reckoning');
assert.equal(advanced.context.reason, 'creator-provenance-audit');
assert.equal(quests.length, 1);
assert.equal(quests[0].sourceActionId, batch.batchId);
assert.match(quests[0].tasks[0].description, /Receipt: receipt-1/);
assert.match(quests[0].tasks[1].owner, /human tribunal/i);
const serialized = JSON.stringify(quests[0]);
assert.doesNotMatch(serialized, /ciphertext|rawPacket|packetContents|private draft/i, 'Quest Beat must carry receipt metadata only');

console.log('Creator provenance Cerbanimo Reckoning Quest Beat contract passed');
