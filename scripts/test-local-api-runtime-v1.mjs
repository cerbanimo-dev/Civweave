import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app/shared/civweave-model-runtime.js', import.meta.url), 'utf8');
const endpoint = 'http://127.0.0.1:11434/api/chat';

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
    config: { provider: 'ollama', model: 'llama3.2', endpoint, stream: true, maxTokens: 64 },
    messages: [{ role: 'user', content: 'Reply briefly as JSON.' }], maxRepairAttempts: 0,
    onEvent: event => { if (event.phase === 'partial') partials.push(event.accumulatedText); },
  });
  assert.equal(app.calls[0].body.stream, true, 'The canonical spine must preserve the selected HTTP stream.');
  assert.equal(app.calls.length, 1, 'A valid stream must not issue a repair or second provider request.');
  assert.equal(result.status, 'success');
  assert.equal(result.outputJson.answer, 'Local answer.');
  assert.equal(result.stream.used, true);
  assert.equal(partials.at(-1), '{"answer":"Local answer."}');
});
