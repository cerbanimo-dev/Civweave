import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const sources = Object.fromEntries([
  'guide-provider-policy-v1.js',
  'guide-forward-failure-policy-v1.js',
  'weaveling-memory-bridge-v191.js',
  'family-ai-loader-v105.js',
].map(name => [name, readFileSync(new URL(`../public/app/${name}`, import.meta.url), 'utf8')]));

function harness() {
  const values = new Map();
  const turns = [], requests = [], network = [], pending = [];
  const config = { provider: 'ollama', route: 'ollama', model: 'qwen2.5:0.5b', baseUrl: 'http://127.0.0.1:11434' };
  const document = {
    readyState: 'loading',
    head: { append() {} },
    documentElement: { dataset: {}, hasAttribute: () => false },
    body: { dataset: {} },
    getElementById() { return null; },
    createElement() { return {}; },
  };
  const context = vm.createContext({
    console, URL, URLSearchParams, document,
    location: { href: 'https://civweave-staging.pages.dev/app/', pathname: '/app/', search: '', hostname: 'civweave-staging.pages.dev' },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) },
    addEventListener() {},
    dispatchEvent() { return true; },
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    queueMicrotask: callback => pending.push(callback),
    fetch: (...args) => { network.push(args); throw new Error('Unexpected network fallback'); },
    CivweaveCodeAutomationV217: { install: () => true },
    CivweaveDeterministicModeV175: {},
    CivweaveKnowledgeEncyclopediaBridgeV271: { install: () => true },
    CivweaveFastInteractiveV192: { install: () => true },
    CivweaveServerAIRouterV301: { status: () => ({ registered: true }) },
    CivweaveResponseRouterV347: { classify: async () => ({ networkRequired: false }) },
    CivweaveBasicValueV1: {}, CivweaveEconomicPolicyV1: {},
    CivweaveBasicValueModelV1: {}, CivweaveBasicValueReviewV1: {},
    CivweaveBasicValueSystemsV1: { eventDriven: true },
    CivweaveIntentionUI: {}, CivweaveLocalMeshV146: {},
    CivweaveCoreLoopV152: {}, CivweaveValidationCloudOptInV1: {},
    CivweaveWeavelingMemoryV191: {
      handleCommand: text => text === '/memory' ? { answer: 'Stored locally' } : null,
      command: text => text,
      recordTurn: (text, meta) => turns.push({ text, ...meta }),
      snapshot: () => ({ focus: 'Test local AI' }),
    },
    CivweaveModelRuntime: { readSharedConfig: () => config, generate: async () => { throw new Error('Unexpected fallback inference'); } },
    CivweaveAssistantV141: {
      selectedConfig: () => config,
      respond: async args => {
        requests.push(args);
        return { response: { answer: 'Ollama reply' }, requestedProvider: 'ollama', provider: 'ollama', model: config.model };
      },
    },
  });
  return {
    context, turns, requests, network,
    load(name) { vm.runInContext(sources[name], context, { filename: `public/app/${name}` }); },
    flush() { for (let count = 0; pending.length && count < 50; count++) pending.shift()(); assert.equal(pending.length, 0); },
  };
}

for (const policies of [
  ['guide-provider-policy-v1.js', 'guide-forward-failure-policy-v1.js'],
  ['guide-forward-failure-policy-v1.js', 'guide-provider-policy-v1.js'],
]) {
  for (const memoryFirst of [false, true]) {
  test(`assistant extension startup (${memoryFirst ? 'memory first' : 'policies first'}): ${policies.join(' then ')}`, async () => {
    const app = harness();
    if (memoryFirst) app.load('weaveling-memory-bridge-v191.js');
    policies.forEach(name => app.load(name));
    if (!memoryFirst) assert.doesNotThrow(() => app.load('weaveling-memory-bridge-v191.js'), 'the loader must be able to decorate the policy-provided assistant');
    app.load('family-ai-loader-v105.js');
    app.flush();

    const { context, turns, requests, network } = app;
    const installed = context.CivweaveAssistantV141.respond;
    for (let count = 0; count < 4; count++) {
      context.CivweaveGuideProviderPolicyV1.install();
      context.CivweaveGuideForwardFailurePolicyV1.install();
      assert.equal(await context.CivweaveFamilyAILoaderV105.ensure(), true);
      app.flush();
      assert.equal(context.CivweaveAssistantV141.respond, installed, 'repeated readiness/loader installs must not stack response wrappers');
    }

    const result = await context.CivweaveAssistantV141.respond({ systemId: 'civweave', text: 'Hello local model', history: [] });
    assert.equal(result.provider, 'ollama');
    assert.equal(result.response.answer, 'Ollama reply');
    assert.equal(context.CivweaveAssistantV141.selectedConfig().provider, 'ollama');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].history.length, 1);
    assert.match(requests[0].history[0].text, /Test local AI/);
    assert.deepEqual(turns.map(turn => turn.role), ['user', 'assistant']);

    const command = await context.CivweaveAssistantV141.respond({ systemId: 'civweave', text: '/memory' });
    assert.equal(command.provider, 'civweave-memory');
    assert.equal(command.response.answer, 'Stored locally');
    assert.equal(requests.length, 1, 'memory commands must not invoke inference');
    assert.equal(network.length, 0, 'local provider and memory requests must not contact fallback services');
  });
  }
}

test('platform assistant decoration remains extensible for shared capabilities',async()=>{
  const source=readFileSync(new URL('../public/app/platform-experience-v160.js',import.meta.url),'utf8');
  const start=source.indexOf('function patchAssistant('),end=source.indexOf('\nfunction buttonBudget(',start);
  const patch=vm.runInNewContext(`${source.slice(start,end)};patchAssistant`,{explicitActionSystem:()=>'',document:{documentElement:{dataset:{}}}});
  const base={respond:async()=>({response:{answer:'local'}})};
  const decorated=patch(base),prior=decorated.respond;
  const capability=async args=>({...await prior(args),persisted:true});
  assert.doesNotThrow(()=>{decorated.respond=capability},'Platform theme decoration must not freeze the shared capability extension point');
  assert.equal((await decorated.respond({systemId:'civweave'})).persisted,true);
});
