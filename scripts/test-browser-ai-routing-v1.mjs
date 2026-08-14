import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import {
  estimateGenerationNeurons,
  selectWorkersAiModel,
  WORKERS_AI_MODEL_PROFILES,
} from '../cloudflare/node-cloud/src/model-router-v1.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [brokerSource, spineSource, routerSource, settingsSource, deterministicSource, assistantSource] = await Promise.all([
  read('public/app/ai-capability-broker-v268.js'),
  read('public/app/fast-interactive-runtime-v192.js'),
  read('public/app/server-ai-router-v301.js'),
  read('public/app/server-ai-settings-v301.js'),
  read('public/app/deterministic-mode-v175.js'),
  read('public/app/assistant-runtime-v141.js'),
]);

function storage(seed = {}) {
  const values = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
  return {
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)),
    clear: () => values.clear(),
    dump: key => values.get(String(key)) ?? null,
  };
}

function eventClass() {
  return class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };
}

function settingsSandbox(seed = {}) {
  const localStorage = storage(seed);
  const context = {
    console,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Promise,
    URL,
    localStorage,
    sessionStorage: storage(),
    CustomEvent: eventClass(),
    dispatchEvent: () => true,
    addEventListener: () => {},
    document: { readyState: 'loading' },
  };
  context.globalThis = context;
  vm.runInNewContext(settingsSource, context, { filename: 'server-ai-settings-v301.js' });
  return { context, localStorage };
}

{
  const { context, localStorage } = settingsSandbox();
  const result = context.CivweaveServerAISettingsV301.ensureDefaultRoute();
  assert.equal(result.applied, true, 'A fresh browser did not receive the local-first server route.');
  const profiles = JSON.parse(localStorage.dump('civweave-model-profiles-v1'));
  assert.equal(profiles.interactive.provider, 'server-auto');
  assert.deepEqual(Array.from(profiles.interactive.serverOrder), ['device-local', 'server-local', 'cloudflare-workers-ai']);
}

{
  const saved = JSON.stringify({ interactive: { provider: 'deterministic', route: 'deterministic' } });
  const { context, localStorage } = settingsSandbox({ 'civweave-model-profiles-v1': saved });
  const result = context.CivweaveServerAISettingsV301.ensureDefaultRoute();
  assert.equal(result.applied, false, 'An explicit user model choice was overwritten.');
  assert.equal(JSON.parse(localStorage.dump('civweave-model-profiles-v1')).interactive.provider, 'deterministic');
}

{
  const delegated = { response: { answer: 'server-auto delegate reached' }, provider: 'cloudflare-workers-ai' };
  const intervalHandlers = [];
  const deterministicContext = {
    console, Date, JSON, Object, Array, String, Number, Boolean, Promise, URL,
    localStorage: storage({
      'civweave-model-profiles-v1': JSON.stringify({ interactive: { provider: 'server-auto', route: 'server-auto' } }),
    }),
    CustomEvent: eventClass(),
    dispatchEvent: () => true,
    setInterval(handler) { intervalHandlers.push(handler); return intervalHandlers.length; },
    clearInterval() {},
    setTimeout() { return 1; },
    CivweaveModelRuntime: { readSharedConfig: () => ({ provider: 'server-auto', route: 'server-auto' }) },
    CivweaveAssistantV141: { respond: async () => delegated },
  };
  deterministicContext.globalThis = deterministicContext;
  vm.runInNewContext(deterministicSource, deterministicContext, { filename: 'deterministic-mode-v175.js' });
  intervalHandlers[0]?.();
  assert.equal(deterministicContext.CivweaveDeterministicModeV175.currentProvider(), 'server-auto');
  const result = await deterministicContext.CivweaveAssistantV141.respond({ text: 'Write a seven-word metaphor.' });
  assert.equal(result, delegated, 'The deterministic compatibility layer swallowed a server-auto request.');
}

{
  let modelCalls = 0;
  class MutationObserver { observe() {} disconnect() {} }
  const assistantContext = {
    console, Date, JSON, Object, Array, String, Number, Boolean, Promise, URL, URLSearchParams, Map, Set, RegExp, Math, structuredClone,
    localStorage: storage({
      'civweave.universal-ai.v127': JSON.stringify({ provider: 'server-auto', route: 'server-auto', model: 'civweave-server-auto-v1' }),
    }),
    location: { search: '?system=cerbanimo', pathname: '/app/realm-console-v140.html', hostname: 'civweave.pages.dev' },
    document: { documentElement: { dataset: { civweaveSystem: 'cerbanimo' } }, body: { dataset: {} }, querySelectorAll: () => [] },
    MutationObserver,
    addEventListener: () => {},
    CivweaveModelRuntime: {
      readSharedConfig: () => ({ provider: 'server-auto', route: 'server-auto', model: 'civweave-server-auto-v1' }),
      async generate() { modelCalls += 1; throw new Error('A health check must not consume Cloudflare neurons.'); },
    },
  };
  assistantContext.globalThis = assistantContext;
  vm.runInNewContext(assistantSource, assistantContext, { filename: 'assistant-runtime-v141.js' });
  const health = await assistantContext.CivweaveAssistantV141.respond({ text: 'test', systemId: 'cerbanimo', history: [] });
  assert.equal(modelCalls, 0, 'A deterministic health check invoked a model.');
  assert.equal(health.provider, 'deterministic-local');
  assert.equal(health.model, 'civweave-conversation-contract-v141');
  assert.equal(health.response.choice.nextAction, 'Tell Kamiya what visible result should exist.');
  const task = assistantContext.CivweaveAssistantV141.taskMetadata({ userMessage: 'Build a small PWA and test its API.', guide: { system: 'cerbanimo' } });
  assert.equal(task.kind, 'code-project');
  assert.equal(task.requirements.code, true);
  assert.equal(task.requirements.planning, true);
  assert.equal(assistantContext.CivweaveAssistantV141.nextAction('awaitVisibleResult', 'cerbanimo'), 'Tell Kamiya what visible result should exist.');
}

const dialogue = selectWorkersAiModel({ task: { kind: 'dialogue', text: 'Why do fireflies glow?' }, responseFormat: 'json' });
assert.equal(dialogue.model, WORKERS_AI_MODEL_PROFILES.quick.id);
assert.equal(dialogue.tier, 'quick');
const standard = selectWorkersAiModel({ task: { kind: 'quest-draft', text: 'Plan a bounded neighborhood tool-library quest.' }, responseFormat: 'json', capabilityRequirements: { planning: true, structuredOutput: true } });
assert.equal(standard.model, WORKERS_AI_MODEL_PROFILES.smart.id);
assert.equal(standard.tier, 'smart');
const vision = selectWorkersAiModel({ task: { kind: 'analysis', text: 'Read this chart.' }, capabilityRequirements: { vision: true } });
assert.equal(vision.model, WORKERS_AI_MODEL_PROFILES.smart.id);
assert.equal(vision.tier, 'smart');
const reasoning = selectWorkersAiModel({
  task: { kind: 'campus-weave', text: 'Design a cross-realm governance migration strategy.', complexity: 'complex' },
  executionProfile: 'agentic',
  capabilityRequirements: { profile: 'agentic', planning: true, complexity: true },
});
assert.equal(reasoning.model, WORKERS_AI_MODEL_PROFILES.deep.id);
assert.equal(reasoning.tier, 'deep');
const code = selectWorkersAiModel({ task: { kind: 'code-project', text: 'Refactor this TypeScript service.' }, capabilityRequirements: { code: true, planning: true } });
assert.equal(code.model, WORKERS_AI_MODEL_PROFILES.smart.id);
assert.equal(code.tier, 'code');
assert.equal(code.variant, 'standard');
assert.deepEqual([...code.pipeline], [WORKERS_AI_MODEL_PROFILES.smart.id, WORKERS_AI_MODEL_PROFILES.qwen.id, WORKERS_AI_MODEL_PROFILES.deep.id]);
const advancedCode = selectWorkersAiModel({ task: { kind: 'code-project', text: 'Refactor this TypeScript service.' }, capabilityRequirements: { code: true, planning: true }, workersPlan: 'paid' });
assert.equal(advancedCode.model, WORKERS_AI_MODEL_PROFILES.code.id);
assert.equal(advancedCode.tier, 'code');
assert.equal(advancedCode.variant, 'advanced');
const patchHeavyCode = selectWorkersAiModel({ task: { kind: 'code-project', text: 'Debug the failing tests and stack trace across many files.' }, capabilityRequirements: { code: true } });
assert.equal(patchHeavyCode.requirements.patchHeavy, true);
const codeDeclined = selectWorkersAiModel({ task: { kind: 'code-project', text: 'Refactor this TypeScript service.' }, capabilityRequirements: { code: true, planning: true }, modelTierCeiling: 'smart' });
assert.equal(codeDeclined.model, WORKERS_AI_MODEL_PROFILES.smart.id);
assert.equal(codeDeclined.tier, 'smart');
assert.ok(
  estimateGenerationNeurons(2_000, 1_000, advancedCode.model) > estimateGenerationNeurons(2_000, 1_000, dialogue.model),
  'The reservation estimator did not account for the selected Cloudflare model.',
);

const profiles = JSON.stringify({
  interactive: {
    provider: 'server-auto',
    route: 'server-auto',
    model: 'civweave-server-auto-v1',
    externalConsent: true,
  },
});
const localStorage = storage({ 'civweave-model-profiles-v1': profiles });
const capacitySession = JSON.stringify({
  campus: {
    nodeId: 'campus',
    userId: 'browser-test',
    origin: 'https://campus.nodes.commonweave.earth',
    token: 'test-capacity-session',
    expiresAt: '2099-01-01T00:00:00.000Z',
  },
});
const sessionStorage = storage({ 'civweave.host-capacity.sessions.v1': capacitySession });
const fetchCalls = [];
const listeners = new Map();
const addEventListener = (type, handler) => {
  const rows = listeners.get(type) || [];
  rows.push(handler);
  listeners.set(type, rows);
};
const dispatchEvent = event => {
  for (const handler of listeners.get(event.type) || []) handler(event);
  return true;
};
const context = {
  console,
  Date,
  JSON,
  Object,
  Array,
  Map,
  Set,
  String,
  Number,
  Boolean,
  Promise,
  Error,
  RegExp,
  Math,
  URL,
  Response,
  Headers,
  structuredClone,
  performance,
  crypto,
  localStorage,
  sessionStorage,
  location: { href: 'https://civweave.pages.dev/app/working-campus-v156', origin: 'https://civweave.pages.dev' },
  CustomEvent: eventClass(),
  addEventListener,
  dispatchEvent,
  fetch: async (input, init = {}) => {
    const body = JSON.parse(String(init.body || '{}'));
    fetchCalls.push({ url: String(input), body, headers: new Headers(init.headers || {}) });
    const selected = selectWorkersAiModel(body).model;
    return new Response(JSON.stringify({
      ok: true,
      text: body.responseFormat === 'json' ? '{"answer":"cloud structured answer"}' : 'cloud answer',
      outputJson: body.responseFormat === 'json' ? { answer: 'cloud structured answer' } : null,
      model: selected,
      usage: { inputTokens: 10, outputTokens: 6, chargedNeurons: 1 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
  CivweaveModelRuntime: {
    version: 'browser-test-base',
    readSharedConfig: () => ({ provider: 'server-auto', route: 'server-auto', model: 'civweave-server-auto-v1' }),
    generate: async () => { throw new Error('The base runtime should not handle server-auto browser tests.'); },
  },
};
context.globalThis = context;
vm.runInNewContext(brokerSource, context, { filename: 'ai-capability-broker-v268.js' });

context.CivweaveLocalModelDownloadV266 = { selection: () => ({ active: true, id: 'small-local' }) };
context.CivweaveLocalModelRegistryV266 = {
  byId: () => ({
    id: 'small-local',
    capabilities: { interactive: true, structuredOutput: false, agenticReasoning: false, code: false, tools: false, externalResearch: false },
  }),
};
const localDecision = context.CivweaveAICapabilityBrokerV268.decide({ purpose: 'friendly chat', prompt: 'Say hello.' });
assert.equal(localDecision.route, 'downloaded-local');
const escalatedDecision = context.CivweaveAICapabilityBrokerV268.decide({
  purpose: 'code architecture plan',
  executionProfile: 'agentic',
  prompt: 'Refactor this JavaScript and plan the migration.',
});
assert.equal(escalatedDecision.route, 'base-runtime');
assert.equal(escalatedDecision.provider, 'server-auto');

vm.runInNewContext(spineSource, context, { filename: 'fast-interactive-runtime-v192.js' });
vm.runInNewContext(routerSource, context, { filename: 'server-ai-router-v301.js' });
context.CivweaveFastInteractiveV192.register('downloaded-local-browser-test', {
  async handle(request) {
    if (request.purpose === 'complex-code') throw new Error('The active local model is not capable of this coding task.');
    if (request.responseFormat === 'json') {
      return { handled: true, result: { status: 'success', outputText: '', outputJson: null, structured: { requested: true, valid: false } } };
    }
    return { handled: true, result: { status: 'success', outputText: 'local answer', actual: { provider: 'downloaded-local', model: 'small-local' }, structured: { requested: false, valid: true } } };
  },
}, 80);

const localResult = await context.CivweaveModelRuntime.generate({
  purpose: 'routine-chat',
  prompt: 'Give me one short next step.',
  config: { provider: 'server-auto' },
});
assert.equal(localResult.outputText, 'local answer');
assert.equal(localResult.runtimeSpine.handledBy, 'downloaded-local-browser-test');
assert.equal(fetchCalls.length, 0, 'A locally qualified task was sent to Cloudflare.');

const cloudResult = await context.CivweaveModelRuntime.generate({
  purpose: 'complex-code',
  executionProfile: 'agentic',
  prompt: 'Refactor this JavaScript service and plan a safe migration.',
  capabilityRequirements: { profile: 'agentic', code: true, planning: true },
  config: { provider: 'server-auto' },
});
assert.equal(cloudResult.outputText, 'cloud answer');
assert.equal(cloudResult.actual.provider, 'cloudflare-workers-ai');
assert.equal(cloudResult.actual.model, WORKERS_AI_MODEL_PROFILES.smart.id);
assert.equal(cloudResult.runtimeSpine.handledBy, 'server-auto-v301');
assert.equal(fetchCalls.length, 1);
assert.equal(fetchCalls[0].body.capabilityRequirements.code, true);
assert.equal(fetchCalls[0].body.capabilityRequirements.planning, true);
assert.equal(fetchCalls[0].headers.get('x-civweave-node-id'), 'campus');

const repairedStructuredResult = await context.CivweaveModelRuntime.generate({
  purpose: 'routine-structured',
  prompt: 'Return a small structured answer.',
  responseFormat: 'json',
  responseSchema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
  capabilityRequirements: { profile: 'interactive', structuredOutput: true },
  config: { provider: 'server-auto' },
});
assert.deepEqual(repairedStructuredResult.outputJson, { answer: 'cloud structured answer' });
assert.equal(fetchCalls.length, 2, 'An invalid local structured result did not fail over to Cloudflare.');

{
  const publicSessions = storage();
  const publicCalls = [];
  const publicListeners = new Map();
  const publicContext = {
    console, Date, JSON, Object, Array, Map, Set, String, Number, Boolean, Promise, Error, RegExp, Math, URL, Response, Headers, structuredClone, performance, crypto,
    localStorage: storage({ 'civweave-model-profiles-v1': profiles }),
    sessionStorage: publicSessions,
    location: { href: 'https://civweave.pages.dev/app/working-campus-v156', origin: 'https://civweave.pages.dev' },
    CustomEvent: eventClass(),
    addEventListener(type, handler) { const rows = publicListeners.get(type) || []; rows.push(handler); publicListeners.set(type, rows); },
    dispatchEvent(event) { for (const handler of publicListeners.get(event.type) || []) handler(event); return true; },
    async fetch(input, init = {}) {
      const url = String(input), headers = new Headers(init.headers || {}), body = JSON.parse(String(init.body || '{}'));
      publicCalls.push({ url, headers, body });
      if (url.endsWith('/api/fabric/capacity/members/admit')) return new Response(JSON.stringify({
        ok: true,
        capacitySession: { nodeId: 'civweave-cloud', userId: 'civweave-public-guest', origin: 'https://civweave-node-cloud.cerbanimo.workers.dev', token: 'public-session', expiresAt: '2099-01-01T00:00:00.000Z' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ ok: true, text: 'public cloud answer', model: WORKERS_AI_MODEL_PROFILES.quick.id, usage: { chargedNeurons: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
    CivweaveModelRuntime: {
      version: 'public-capacity-test-base',
      readSharedConfig: () => ({ provider: 'server-auto', route: 'server-auto', model: 'civweave-server-auto-v1' }),
      generate: async () => { throw new Error('The base runtime should not handle the public-capacity test.'); },
    },
  };
  publicContext.globalThis = publicContext;
  vm.runInNewContext(spineSource, publicContext, { filename: 'fast-interactive-runtime-v192.js' });
  vm.runInNewContext(routerSource, publicContext, { filename: 'server-ai-router-v301.js' });
  const publicResult = await publicContext.CivweaveModelRuntime.generate({ purpose: 'public-capacity-chat', prompt: 'Give me a next step.', config: { provider: 'server-auto' } });
  assert.equal(publicResult.outputText, 'public cloud answer');
  assert.equal(publicCalls.length, 2, 'A fresh browser must admit capacity once, then generate.');
  assert.ok(publicCalls[0].url.endsWith('/api/fabric/capacity/members/admit'));
  assert.ok(publicCalls[1].url.endsWith('/api/ai/node/generate'));
  assert.equal(publicCalls[1].headers.get('x-civweave-node-id'), 'civweave-cloud');
  assert.equal(JSON.parse(publicSessions.dump('civweave.host-capacity.sessions.v1'))['civweave-cloud']?.token, 'public-session');
}

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.browser-ai-routing-test.v1',
  firstRunDefault: 'server-auto',
  explicitChoicePreserved: true,
  localQualifiedTask: 'downloaded-local',
  localCapabilityFailure: 'cloudflare-workers-ai',
  invalidLocalStructuredOutput: 'cloudflare-workers-ai',
  firstCloudflareRequest: 'public-community-capacity-admission',
  cloudModels: {
    quick: WORKERS_AI_MODEL_PROFILES.quick.id,
    smart: WORKERS_AI_MODEL_PROFILES.smart.id,
    deep: WORKERS_AI_MODEL_PROFILES.deep.id,
    codeStandard: [WORKERS_AI_MODEL_PROFILES.smart.id, WORKERS_AI_MODEL_PROFILES.qwen.id, WORKERS_AI_MODEL_PROFILES.deep.id],
    codeAdvanced: WORKERS_AI_MODEL_PROFILES.code.id,
  },
}, null, 2));
