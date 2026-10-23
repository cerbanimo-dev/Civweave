import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { TextEncoder, TextDecoder } from 'node:util';

const read = path => readFile(path, 'utf8');
const [serverSource, agentSource, localSource, bootstrap] = await Promise.all([
  read('cloudflare/node-cloud/src/browser-tool-entry-v1.mjs'),
  read('public/app/local-ai/browser-agent-v1.js'),
  read('public/app/local-provider-authority-v1.js'),
  read('public/app/local-ai/bootstrap-v266.js')
]);

// Test the actual server implementation with a fake upstream; never contact the internet.
let requestedUrl = '';
const server = vm.createContext({
  URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, setTimeout, clearTimeout,
  fetch: async (url, options) => {
    requestedUrl = String(url);
    assert.equal(options.redirect, 'error');
    return {
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({ results: [
        { title: 'Published article', url: 'https://example.org/article', content: 'Research snippet', engine: 'example' },
        { title: 'Duplicate', url: 'https://example.org/article', content: 'duplicate' },
        { title: 'Internal', url: 'http://127.0.0.1/admin', content: 'never reveal' },
      ] })
    };
  },
});
vm.runInContext(serverSource.replace(/^export /gm, ''), server);
const runTool = vm.runInContext('runTool', server);
const safeUrl = vm.runInContext('safeUrl', server);
const search = await runTool({ SEARXNG_BASE_URL: 'https://searx.example.net/' }, { action: 'search', query: 'Qwen & Gemma' });
assert.equal(search.source, 'searxng');
assert.equal(search.results.length, 1, 'duplicate and private search targets must be excluded');
assert.equal(search.results[0].url, 'https://example.org/article');
assert.equal(new URL(requestedUrl).searchParams.get('q'), 'Qwen & Gemma');
assert.equal(new URL(requestedUrl).searchParams.get('format'), 'json');
for (const host of ['127.0.0.1', '192.168.1.1', '10.1.2.3', '169.254.169.254', 'localhost', '[::1]']) {
  assert.throws(() => safeUrl('http://' + host + '/secret'), undefined, host + ' must not be fetched');
}
assert.throws(() => safeUrl('http://public.example:6379/'), /non-web ports/);
assert.match(serverSource, /verifyCapacitySession\(env, bearer\(request\), nodeId\)/,
  'host search must retain authenticated capacity sessions');

// The same router must work for a cold selected Qwen model.
const calls = [], phases = [], deltas = [];
let selection = [{ action: 'finish', answer: 'An answer with a source.' }];
const browser = {
  searchArchive: async () => ({ mode: 'archive', results: [] }),
  live: async (action, input) => {
    calls.push({ action, input });
    return { source: 'searxng', results: [{ title: 'First result', url: 'https://example.org/fact', snippet: 'Verified data.' }], liveFetched: true };
  },
  status: () => ({ liveBrowser: true })
};
const context = vm.createContext({
  URL, navigator: { onLine: true },
  CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data?.detail; } },
  addEventListener() {}, dispatchEvent() {},
  CivweaveBrowserToolV1: browser,
  CivweaveLocalModelDownloadV266: { selection: () => ({ active: true, id: 'qwen35-4b-native' }) },
  CivweaveLocalModelRegistryV266: { byId: () => ({ id: 'qwen35-4b-native', workingContextTokens: 2048 }) },
  CivweaveLocalModelRuntimeV266: {
    activeSpec: () => null,
    generate: async () => ({ text: JSON.stringify(selection.shift() || { action: 'finish', answer: 'Done.' }), metrics: {} })
  },
  CivweaveAICapabilityBrokerV268: { requirements: () => ({ externalResearch: true }) },
  CivweaveFastInteractiveV192: { register() {} },
});
vm.runInContext(agentSource, context);
const agent = context.CivweaveLocalBrowserAgentV1;
const input = {
  messages: [{ role: 'user', content: 'Search the web for this public fact' }],
  webSearch: true,
  onProgress: value => phases.push(value.stage),
  onToken: text => deltas.push(text),
};
const answered = await agent.handle(input);
assert.equal(answered.handled, true, 'cold Qwen should receive the research tool');
assert.equal(calls.length, 1, 'explicit research must deterministically search even when the model chooses finish');
assert.equal(calls[0].action, 'search');
assert.equal(answered.result.browserAgent.trace.some(x => x.action === 'live_search' && x.status === 'success'), true);
assert.match(answered.result.outputText, /^An answer with a source\\./);
assert.match(answered.result.outputText, /Search results \\(not independently verified\\):/);
assert.deepEqual(deltas, [answered.result.outputText], 'final text must stream only once');
assert.ok(phases.includes('searching') && phases.includes('complete'), 'research stages must be observable');
assert.ok(answered.result.browserAgent.sources.includes('https://example.org/fact'));

// Reject model-invented URLs before invoking the browser tool.
calls.length = 0;
selection = [{ action: 'open', url: 'https://not-from-search.example/secret' }, { action: 'finish', answer: 'Unable to verify.' }];
const suspicious = await agent.handle({ ...input, onToken: () => {} });
assert.equal(calls.length, 1, 'the only network call must be the initial search');
assert.ok(suspicious.result.browserAgent.trace.some(x => x.action === 'open' && x.status === 'failed'));

// No live backend is a visible failure, not a fabricated offline result.
browser.status = () => ({ liveBrowser: false });
await assert.rejects(agent.runAgent(input, { id: 'qwen35-4b-native' }), /Live web search is unavailable/);

// Protect the existing chat path; live research must be opt-in and wired from guide responses.
assert.match(localSource, /researchRequested\(args,messages\)/);
assert.match(localSource, /runLocalResearch\(runtime,args,messages,requestedModel\)/);
assert.match(localSource, /liveResearch\?await runLocalResearch/);
assert.match(bootstrap, /browser-tool-v1\.js\?v=1\.0\.1-research-router/);
assert.match(bootstrap, /browser-agent-v1\.js\?v=1\.0\.2-research-router/);
console.log('Local keyless research: server search, SSRF filtering, cold Qwen, deterministic tools, progress, and no-live failure PASS');
