import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8');
const assistant = read('app/assistant-runtime-v141.js');
const orchestrator = read('extensions/civweave-weaveling-plan-json-v190.js');
const config = { provider: 'ollama', route: 'ollama', model: 'gemma4:latest', endpoint: 'http://127.0.0.1:11434/api/chat' };

test('shared assistant forwards cancellation and streamed tokens to the selected HTTP provider', async () => {
  let request;
  const tokens = [];
  const abort = new AbortController();
  const scope = {
    runtime: () => ({ generate: async input => {
      request = input;
      input.onEvent?.({ phase: 'partial', text: 'Hello', accumulatedText: 'Hello' });
      return { status: 'success', outputText: 'Hello', actual: config };
    } }),
    selectedConfig: () => config, taskMetadata: () => ({ requirements: {} }),
    prompt: () => [{ role: 'user', content: 'Say hello' }],
    normalize: result => ({ answer: result.outputText }),
  };
  const start = assistant.indexOf('async function model(');
  const end = assistant.indexOf('\nfunction persistModelQuest(', start);
  const model = vm.runInNewContext(`${assistant.slice(start, end)};model`, scope);
  const result = await model({}, { config, signal: abort.signal, onToken: (...args) => tokens.push(args) });
  assert.equal(result.provider, 'ollama');
  assert.equal(request.signal, abort.signal);
  assert.equal(request.config.model, config.model);
  assert.equal(request.stream, true);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0][1], 'Hello');
});

test('Quest authoring respects saved Ollama over a stale browser-model selection', async () => {
  let generated, saved;
  const abort = new AbortController();
  const events = [];
  const runtime = { generate: async input => {
    generated = input;
    input.onEvent?.({ phase: 'partial', text: 'Quest', accumulatedText: 'Quest' });
    return { status: 'success', structured: { valid: true }, outputJson: { title: 'QA Quest' }, actual: config };
  } };
  const scope = {
    globalThis: {
      CivweaveModelRuntime: runtime,
      CivweaveIntentionPlanner: { persist: plan => { saved = plan; return { plan }; } },
    },
    selectedLocal: () => ({ active: true, id: 'gemma4-e2b-it-litert-web' }),
    LOCAL_AI_PROVIDERS: new Set(['downloaded-local', 'local-ai']),
    clean: (value, max = 12000) => String(value ?? '').trim().slice(0, max),
    isAIProvider: value => value === 'ollama',
    preferredTaskModel: () => { throw new Error('HTTP Quest must not inspect or load browser model packs'); },
    resolvedPlanningText: value => value, memory: () => ({}), prompt: () => [], PLAN_SCHEMA: {},
    normalizePlan: value => value, planResponse: item => item,
    localStructuredTransport: () => { throw new Error('HTTP Quest must not use downloaded-model transport'); },
  };
  const start = orchestrator.indexOf('async function createModelPlan(');
  const end = orchestrator.indexOf('\nfunction install(', start);
  const create = vm.runInNewContext(`${orchestrator.slice(start, end)};createModelPlan`, scope);
  await create({ text: 'Create a Quest', history: [], signal: abort.signal, onToken: (...args) => events.push(args) }, { selectedConfig: () => config });
  assert.equal(saved.title, 'QA Quest');
  assert.equal(generated.config.provider, 'ollama');
  assert.equal(generated.config.model, config.model);
  assert.equal(generated.signal, abort.signal);
  assert.equal(generated.transport, undefined);
  assert.equal(events.length, 1);
});
