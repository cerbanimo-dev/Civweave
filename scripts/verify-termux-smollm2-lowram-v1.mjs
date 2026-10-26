import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/app/shared/civweave-model-runtime.js', import.meta.url), 'utf8');
const familyLoader = await readFile(new URL('../public/app/family-ai-loader-v105.js', import.meta.url), 'utf8');
const settingsGateway = await readFile(new URL('../public/app/settings-gateway-v317.js', import.meta.url), 'utf8');
for (const [name, content] of [['family loader', familyLoader], ['canonical settings', settingsGateway]]) {
  assert.match(content, /civweave-model-runtime\.js\?v=1\.0\.17-termux-smollm2-lowram/, name + ' must request the updated runtime cache key');
}
const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const sandbox = { console, Date, Promise, Math, JSON, URL, AbortController, setTimeout, clearTimeout, localStorage: storage, sessionStorage: storage, location: { href: 'https://civweave-staging.pages.dev/', origin: 'https://civweave-staging.pages.dev' } };
sandbox.globalThis = sandbox;
runInNewContext(source, sandbox, { filename: 'civweave-model-runtime.js' });
const runtime = sandbox.CivweaveModelRuntime;

function request(overrides = {}) {
  const original = {
    purpose: 'civweave-guide-response-v141',
    executionProfile: 'interactive',
    responseFormat: 'json',
    config: { provider: 'openai-compatible', model: 'smollm2-360m', endpoint: 'http://127.0.0.1:8080/v1', context: 8192, maxTokens: 900, timeoutMs: 90000 },
    context: { userMessage: 'Introduce yourself in one short sentence.', guide: { name: 'Weaveling' }, recentConversation: [] },
    task: { kind: 'dialogue', requirements: { planning: false } },
    messages: [{ role: 'system', content: 'Do not preserve this enormous generic Civweave prompt.' }, { role: 'user', content: 'Introduce yourself in one short sentence.' }],
  };
  return { ...original, ...overrides, config: { ...original.config, ...(overrides.config || {}) } };
}

let captured;
let outcome = await runtime.generate({ ...request(), transport: async input => { captured = input; return 'I am Weaveling, your Civweave guide.'; } });
assert.equal(outcome.status, 'success');
assert.equal(outcome.outputText, 'I am Weaveling, your Civweave guide.');
assert.equal(outcome.structured.requested, false, 'ordinary 2 GB phone dialogue must not demand JSON');
assert.equal(captured.config.maxTokens, 64, '900-token guide floor must be capped to 64');
assert.equal(captured.config.context, 512);
assert.ok(captured.config.timeoutMs >= 180000);
assert.equal(captured.messages.length, 2);
assert.match(captured.messages[0].content, /You are Weaveling/);
assert.doesNotMatch(captured.messages[0].content, /enormous generic Civweave/);
assert.equal(captured.messages[1].content, 'Introduce yourself in one short sentence.');

outcome = await runtime.generate({ ...request({ config: { model: 'qwen35-4b-native' } }), transport: async input => { captured = input; return '{"answer":"Qwen route unchanged"}'; } });
assert.equal(outcome.status, 'success');
assert.equal(outcome.structured.requested, true, 'other models retain structured JSON');
assert.equal(captured.config.maxTokens, 900);
assert.match(captured.messages[0].content, /enormous generic Civweave/);

outcome = await runtime.generate({ ...request({ config: { endpoint: 'https://example.org/v1', externalConsent: true } }), transport: async input => { captured = input; return '{"answer":"remote route unchanged"}'; } });
assert.equal(outcome.status, 'success');
assert.equal(outcome.structured.requested, true, 'remote host does not opt into 2 GB phone rules');
assert.equal(captured.config.maxTokens, 900);

outcome = await runtime.generate({ ...request({ task: { kind: 'quest-draft', requirements: { planning: true } } }), transport: async input => { captured = input; return '{"answer":"structured task unchanged"}'; } });
assert.equal(outcome.status, 'success');
assert.equal(outcome.structured.requested, true, 'planning must keep its structured contract');
assert.equal(captured.config.maxTokens, 900);

const requiredSchema = { type: 'object', required: ['answer'], properties: { answer: { type: 'string' } } };
outcome = await runtime.generate({ ...request({ schema: requiredSchema }), transport: async input => { captured = input; return '{"answer":"schema unchanged"}'; } });
assert.equal(outcome.status, 'success');
assert.equal(outcome.structured.requested, true, 'explicit schemas must not be disabled');
assert.equal(captured.config.maxTokens, 900);

console.log('Termux SmolLM2 360M low-RAM route verified: plain-text tiny dialogue only; Qwen, remote, planning, schema unaffected.');
