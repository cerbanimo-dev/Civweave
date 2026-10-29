import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app/shared/civweave-model-runtime.js', import.meta.url), 'utf8');
const endpoint = 'http://127.0.0.1:11434/api/chat';

test('canonical Settings round-trips the generation timeout without overriding caller budgets', async t => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://civweave-staging.pages.dev/app/' });
  t.after(() => dom.window.close());
  const app = localRuntime(() => assert.fail('Opening or saving Settings must not contact a provider.'));
  Object.assign(app.context, {
    document: dom.window.document, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, CustomEvent: dom.window.CustomEvent,
    addEventListener() {}, dispatchEvent() {}, requestAnimationFrame() {},
  });
  vm.runInNewContext(readFileSync(new URL('../public/app/settings-gateway-v317.js', import.meta.url), 'utf8'), app.context);
  vm.runInNewContext(readFileSync(new URL('../public/app/model-settings-controller-v173.js', import.meta.url), 'utf8'), app.context);
  const owner = app.context.CivweaveSettingsV320;
  assert.equal(app.runtime.readSharedConfig().timeoutMs, 90000);
  await owner.ensure();
  const form = dom.window.document.querySelector('[data-cw-settings-form]'), timeout = form.elements.namedItem('timeoutSeconds');
  assert.ok(timeout, 'The existing AI and safety form must expose the supported generation timeout.');
  assert.equal(timeout.type, 'number'); assert.equal(timeout.min, '5'); assert.equal(timeout.max, '600'); assert.equal(timeout.value, '90');
  timeout.value = '300'; form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(JSON.parse(app.context.localStorage.getItem('civweave-model-profiles-v1')).interactive.timeoutMs, 300000);
  assert.equal(JSON.parse(app.context.localStorage.getItem('civweave.universal-ai.v127')).timeoutMs, 300000);
  assert.equal(app.context.CivweaveModelSettingsControllerV173.readState().timeoutSeconds, 300);
  assert.equal(app.runtime.readSharedConfig().timeoutMs, 300000);
  timeout.value = '90'; owner.open(); assert.equal(timeout.value, '300', 'Reopening Settings reads the saved timeout.');
  assert.equal(app.calls.length, 0);
  const budgets = [];
  const generate = config => app.runtime.generate({ config, messages: [{ role: 'user', content: 'Reply.' }], transport: async ({ config }) => { budgets.push(config); return { text: 'Ready' }; } });
  assert.equal((await generate({})).status, 'success');
  assert.equal((await generate({ timeoutMs: 120000, maxTokens: 17 })).status, 'success');
  assert.equal(budgets[0].timeoutMs, 300000);
  assert.equal(budgets[1].timeoutMs, 120000, 'An explicit capability request retains its own deadline.');
  assert.equal(budgets[1].maxTokens, 17, 'Timeout configuration does not raise caller output budgets.');
  timeout.value = '601'; form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(app.runtime.readSharedConfig().timeoutMs, 300000, 'An out-of-range edit cannot replace the saved setting.');
  assert.match(form.querySelector('[data-status]').textContent, /5.*600/);
});

function localRuntime(response) {
  const calls = [];
  const settings = new Map([
    ['civweave-model-profiles-v1', JSON.stringify({
      interactive: { provider: 'ollama', route: 'ollama', model: 'llama3.2', endpoint },
    })],
  ]);
  const storage = values => ({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  });
  const context = {
    URL, AbortController, TextDecoder, TextEncoder, setTimeout, clearTimeout,
    location: { href: 'https://civweave-staging.pages.dev/app/', origin: 'https://civweave-staging.pages.dev' },
    localStorage: storage(settings), sessionStorage: storage(new Map()),
    fetch: async (url, options) => {
      assert.equal(url, endpoint, 'a configured local API must not depend on Guild trust, releases, or cloud AI');
      calls.push({ url, options, body: JSON.parse(options.body) });
      return response();
    },
  };
  vm.runInNewContext(source, context, { filename: 'civweave-model-runtime.js' });
  return { runtime: context.CivweaveModelRuntime, calls, context };
}

test('saved Ollama route returns nonstreaming chat content without a Guild or external credential', async () => {
  const { runtime, calls } = localRuntime(() => Response.json({
    model: 'llama3.2', message: { role: 'assistant', content: 'Local model is ready.' }, done: true,
  }));
  const result = await runtime.generate({
    config: { provider: 'ollama', model: 'llama3.2', endpoint, maxTokens: 8 },
    executionProfile: 'interactive', messages: [{ role: 'user', content: 'Reply briefly.' }],
  });
  assert.equal(result.status, 'success');
  assert.equal(result.actual.provider, 'ollama');
  assert.equal(result.outputText, 'Local model is ready.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.model, 'llama3.2');
  assert.equal(calls[0].body.stream, false);
  assert.equal(calls[0].body.options.num_predict, 8, 'Ollama must honor the caller output budget');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.headers.authorization, undefined);
});

test('nonstreaming Ollama JSON is validated from message content without an unnecessary repair', async () => {
  const { runtime, calls } = localRuntime(() => Response.json({
    model: 'llama3.2', message: { role: 'assistant', content: '{"ready":true}', thinking: 'not answer text' }, done: true,
  }));
  const result = await runtime.generate({
    messages: [{ role: 'user', content: 'Return readiness as JSON.' }], maxRepairAttempts: 0,
    schema: { type: 'object', required: ['ready'], properties: { ready: { type: 'boolean' } } },
  });
  assert.equal(result.status, 'success');
  assert.equal(result.outputText, '{"ready":true}');
  assert.equal(result.outputJson.ready, true);
  assert.equal(result.structured.valid, true);
  assert.equal(result.structured.repairAttempts, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.format.type, 'object');
});

for (const think of [false, true, 'low', undefined, null, 0]) test(`Ollama forwards only an explicit boolean or string think option (${String(think)})`, async () => {
  const {runtime,calls}=localRuntime(()=>Response.json({message:{content:'Ready'},done:true}));
  const result=await runtime.generate({messages:[{role:'user',content:'Reply briefly.'}],think});
  assert.equal(result.status,'success');assert.equal(calls.length,1);
  if(typeof think==='boolean'||typeof think==='string')assert.equal(calls[0].body.think,think);
  else assert.equal(Object.hasOwn(calls[0].body,'think'),false,'ordinary requests retain the provider’s default thinking behavior');
});

test('streaming Ollama chat still combines visible answer tokens', async () => {
  const frames = [
    { message: { content: 'Local ' }, done: false },
    { message: { content: 'answer.' }, done: false },
    { message: { content: '' }, done: true },
  ];
  const { runtime } = localRuntime(() => new Response(frames.map(frame => JSON.stringify(frame) + '\n').join('')));
  const result = await runtime.generate({
    config: { provider: 'ollama', model: 'llama3.2', endpoint, stream: true },
    messages: [{ role: 'user', content: 'Reply briefly.' }],
  });
  assert.equal(result.status, 'success');
  assert.equal(result.outputText, 'Local answer.');
  assert.equal(result.stream.used, true);
});

test('the real shared runtime spine preserves selected Ollama streaming and its token callback', async () => {
  const frames = [
    { message: { content: '{"answer":"Local ' }, done: false },
    { message: { content: 'answer."}' }, done: false },
    { message: { content: '' }, done: true },
  ];
  const app = localRuntime(() => new Response(frames.map(frame => JSON.stringify(frame) + '\n').join('')));
  const spine = readFileSync(new URL('../public/app/fast-interactive-runtime-v192.js', import.meta.url), 'utf8');
  vm.runInNewContext(spine, app.context, { filename: 'fast-interactive-runtime-v192.js' });
  const partials = [];
  const result = await app.context.CivweaveModelRuntime.generate({
    purpose: 'civweave-guide-response-v141', executionProfile: 'interactive', responseFormat: 'json',
    think: false,
    config: { provider: 'ollama', model: 'llama3.2', endpoint, stream: true, maxTokens: 64 },
    messages: [{ role: 'user', content: 'Reply briefly as JSON.' }], maxRepairAttempts: 0,
    onEvent: event => { if (event.phase === 'partial') partials.push(event.accumulatedText); },
  });
  assert.equal(app.calls[0].body.stream, true, 'The canonical spine must preserve the selected HTTP stream.');
  assert.equal(app.calls[0].body.think, false, 'The canonical spine must preserve an explicit request-level thinking preference.');
  assert.equal(app.calls.length, 1, 'A valid stream must not issue a repair or second provider request.');
  assert.equal(result.status, 'success');
  assert.equal(result.outputJson.answer, 'Local answer.');
  assert.equal(result.stream.used, true);
  assert.equal(partials.at(-1), '{"answer":"Local answer."}');
});
