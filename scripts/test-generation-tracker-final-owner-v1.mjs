import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app/guide-generation-tracker-v1.js', import.meta.url), 'utf8');

for (const provider of ['ollama', 'native-server', 'downloaded-local', 'local-contract']) {
  test(`tracker completion records ${provider} metadata without replaying the final answer`, () => {
    const handlers = new Map(), writes = [], timers = [], frames = [];
    let text = 'Already streamed answer', panel;
    const bubble = { get textContent() { return text; }, set textContent(value) { writes.push(value); text = value; }, classList: { add() {}, remove() {} } };
    const finalPre = { textContent: '' }, section = { querySelector: () => finalPre };
    const host = { querySelector: () => panel || null, append: node => { panel = node; } };
    const article = { children: [{}, host], querySelector: () => bubble };
    const root = { querySelectorAll: () => [article] };
    const context = {
      console, document: {
        getElementById: id => id === 'cw-persistent-guide-chat-v215' ? root : id === 'cw-guide-generation-tracker-v1-style' ? {} : null,
        createElement: () => ({ dataset: {}, innerHTML: '', querySelector: () => section, remove() {} }),
        addEventListener() {}, head: { append() {} },
      },
      localStorage: { getItem: () => null },
      addEventListener: (name, handler) => handlers.set(name, handler),
      queueMicrotask: callback => callback(),
      setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
      requestAnimationFrame: callback => { frames.push(callback); return frames.length; }, cancelAnimationFrame() {},
      matchMedia: () => ({ matches: false }),
    };
    vm.runInNewContext(source, context, { filename: 'guide-generation-tracker-v1.js' });
    const changed = handlers.get('civweave:realm-guide-thread-changed');
    changed({ detail: { thread: { updatedAt: '2026-10-24T12:00:00.000Z', messages: [{ role: 'user', text: 'QA', at: '2026-10-24T12:00:00.000Z' }, { role: 'assistant', text: 'Thinking', pending: true }] } } });
    handlers.get('civweave:weave-pipeline')({ detail: { origin: 'native-local-api', phase: 'pipeline', state: 'complete', artifactKey: 'qa-record' } });
    const final = { detail: { thread: { updatedAt: '2026-10-24T12:00:01.000Z', messages: [{ role: 'user', text: 'QA' }, { role: 'assistant', text, provider, model: 'qa-model' }] } } };
    changed(final);
    while (timers.length) timers.shift()();
    assert.deepEqual(writes, [], 'The tracker must never blank or rewrite the canonical answer bubble.');
    assert.equal(frames.length, 0, 'Completion must not schedule synthetic token replay.');
    assert.equal(bubble.textContent, 'Already streamed answer');
    const state = context.CivweaveGuideGenerationTrackerV1.state();
    assert.equal(state.streams.final, 'Already streamed answer');
    assert.equal(state.finalSource, `${provider} · qa-model`);
    assert.equal(state.terminal, 'complete'); assert.equal(state.artifactKey, 'qa-record');
    changed(final);
    assert.deepEqual(writes, [], 'Duplicate completion events must remain inert.');
  });
}
