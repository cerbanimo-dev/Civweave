import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../public/app/${path}`, import.meta.url), 'utf8');
const endpoint = 'http://127.0.0.1:11434/api/chat';

function harness() {
  const values = new Map([['civweave-model-profiles-v1', JSON.stringify({ interactive: { provider: 'ollama', route: 'ollama', model: 'qa-local', endpoint } })]]);
  const calls = [], events = [];
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const node = () => ({ dataset: {}, addEventListener() {}, append() {}, querySelector: () => null, querySelectorAll: () => [], setAttribute() {} });
  const context = {
    console, URL, URLSearchParams, AbortController, TextDecoder, TextEncoder, structuredClone,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, queueMicrotask,
    requestAnimationFrame: () => 0,
    document: { readyState: 'complete', documentElement: node(), body: node(), head: node(), scripts: [],
      createElement: node, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    location: { href: 'https://civweave-staging.pages.dev/app/working-campus-v440.html', origin: 'https://civweave-staging.pages.dev', pathname: '/app/working-campus-v440.html', hostname: 'civweave-staging.pages.dev', search: '' },
    localStorage: storage, sessionStorage: storage,
    addEventListener() {}, dispatchEvent: event => { events.push(event); return true; },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    MutationObserver: class { observe() {} },
    CivweaveParity: { load: async () => ({ systems: [], rooms: [] }) },
    CivweaveContextRouterV344: { status: () => ({ ready: true }), route: async (_text, options) => ({ system: options.currentSystem, mode: 'Acquire', confidence: 1, source: 'rules' }) },
    CivweaveResponseRouterV347: { tiers: {}, classify: async () => ({ networkRequired: true, artifactClass: 'resource' }) },
    fetch: async (url, options) => {
      assert.equal(url, endpoint, 'A selected HTTP provider must not call a Guild or Cloudflare fallback.');
      calls.push(JSON.parse(options.body));
      const content = JSON.stringify({ answer: 'Your Manifest is saved for review.', choice: { mode: 'Acquire', system: 'fellowfare', nextAction: '' }, assumptions: [], confidence: 1, questDraft: null });
      return new Response(JSON.stringify({ message: { content }, done: false }) + '\n' + JSON.stringify({ message: { content: '' }, done: true }) + '\n');
    },
  };
  vm.createContext(context);
  const load = path => vm.runInContext(read(path), context, { filename: path });
  return { context, load, calls, events, values };
}

for (const policyFirst of [true, false]) test(`Ollama Manifest uses real capability state through shared wrappers (${policyFirst ? 'policies first' : 'capabilities first'})`, async () => {
  const app = harness();
  for (const path of ['shared/civweave-model-runtime.js', 'fast-interactive-runtime-v192.js', 'guide-contracts-v141.js', 'assistant-runtime-v141.js']) app.load(path);
  const policies = () => { app.load('guide-forward-failure-policy-v1.js'); app.load('guide-forward-failure-hardening-v1.js'); };
  if (policyFirst) policies();
  for (const path of ['action-followthrough-v165.js', 'unified-chat-system-v1.js', 'guide-capability-passover-v1.js']) app.load(path);
  if (!policyFirst) policies();
  const tokens = [];
  const result = await app.context.CivweaveAssistantV141.respond({
    text: 'Create a Manifest for 2 notebooks; area: Albany, NY; timing: tomorrow; exchange: free; budget: 0.',
    systemId: 'fellowfare', handoffSystem: 'fellowfare', history: [], onToken: (...args) => tokens.push(args),
  });
  assert.equal(result.action?.system, 'fellowfare', 'The selected provider must reach the canonical artifact owner.');
  assert.equal(result.action?.kind, 'trade-request');
  assert.equal(result.action?.state, 'review');
  assert.equal(app.context.CivweaveGuideContractsV141.get(result.action.id)?.id, result.action.id);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].model, 'qa-local');
  assert.equal(app.calls[0].stream, true);
  assert.ok(tokens.length > 0);
  const approved = await app.context.CivweaveAssistantV141.respond({ text: 'Approve the Manifest', systemId: 'fellowfare', handoffSystem: 'fellowfare', history: [] });
  assert.equal(approved.action?.state, 'published', 'A real approval control must survive fallback wrappers.');
  assert.equal(app.calls.length, 1, 'Approval must not turn into a second generation or cloud fallback.');
});

test('Ollama wrapper failures and cancellation propagate without a Guild request', async () => {
  const app = harness();
  const failure = new Error('QA Ollama unavailable');
  app.context.CivweaveAssistantV141 = { respond: async () => { throw failure; } };
  app.load('guide-forward-failure-policy-v1.js');
  app.load('guide-forward-failure-hardening-v1.js');
  await assert.rejects(app.context.CivweaveAssistantV141.respond({ text: 'Create a Manifest', systemId: 'fellowfare' }), error => error === failure);
  assert.equal(app.calls.length, 0);
  const abort = new AbortController(); abort.abort(new Error('QA cancelled'));
  await assert.rejects(app.context.CivweaveAssistantV141.respond({ text: 'Stop', systemId: 'civweave', signal: abort.signal }), /QA Ollama unavailable|QA cancelled/);
  assert.equal(app.events.some(event => event.type === 'civweave:cloud-fallback-route'), false);
});

test('knowledge installation after the stream subscriber can extend the shared runtime', async () => {
  const app = harness();
  app.load('shared/civweave-model-runtime.js');
  app.load('fast-interactive-runtime-v192.js');
  app.load('guide-stream-thinking-v249.js');
  app.context.__testKnowledge = { classifyKnowledgeQuestion: () => ({ eligible: false }), PERSONALITY_MATRICES: {} };
  const source = read('knowledge-encyclopedia-bridge-v271.js');
  const importExpression = "import('/app/shared/knowledge-encyclopedia-v271.mjs?v=knowledge-encyclopedia-v271')";
  assert.equal(source.split(importExpression).length, 2, 'Exercise the real knowledge installer with only its module transport replaced.');
  vm.runInContext(source.replace(importExpression, 'Promise.resolve(globalThis.__testKnowledge)'), app.context, { filename: 'knowledge-encyclopedia-bridge-v271.js' });
  await app.context.CivweaveKnowledgeEncyclopediaBridgeV271.install();
  assert.equal(app.context.CivweaveKnowledgeEncyclopediaBridgeV271.installed, true);
  const result = await app.context.CivweaveModelRuntime.generate({
    purpose: 'civweave-guide-response-v141', executionProfile: 'interactive', responseFormat: 'json',
    context: { userMessage: 'Hello', guide: { system: 'civweave' } },
    config: { provider: 'ollama', model: 'qa-local', endpoint, stream: true },
    messages: [{ role: 'user', content: 'Hello' }],
  });
  assert.equal(result.status, 'success'); assert.equal(app.calls.length, 1);
});
