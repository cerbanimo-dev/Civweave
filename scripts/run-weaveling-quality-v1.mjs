#!/usr/bin/env node
// Opt-in model evaluation, deliberately absent from CI and npm test scripts.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repo = fileURLToPath(new URL('../', import.meta.url));
const defaultScenarios = path.join(repo, 'examples/weaveling-quality-scenarios-v1.json');
const sourcePaths = [
  'public/app/shared/civweave-model-runtime.js',
  'public/app/intention-planner-v141.js',
  'public/app/weaveling-plan-materialization-v265.js',
  'public/app/guide-capability-passover-v1.js',
  'public/extensions/civweave-weaveling-plan-json-v190.js',
];
const campusKey = 'civweave.working-campus.v1';
const intentionsKey = 'civweave.intentions.v127';
const unrelatedWish = 'UNRELATED_FIXTURE_CHESS_GOAL: practise chess openings.';
const realmType = { 'living-school': 'learning', cerbanimo: 'skilled-labor', fellowfare: 'material-acquirement', anarchadia: 'civic-governance' };
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
const errorRecord = error => ({ name: error?.name || 'Error', message: String(error?.message || error), ...(error?.code ? { code: error.code } : {}) });

function help() {
  return `Weaveling real-model quality runner (Node 22+)

  node scripts/run-weaveling-quality-v1.mjs --list
  node scripts/run-weaveling-quality-v1.mjs --dry-run [--scenario ID]
  node scripts/run-weaveling-quality-v1.mjs --run [--scenario ID]

Options:
  --scenarios FILE     JSON {scenarios:[{id,prompt,expectations?,reviewQuestions?}]}
  --prompt TEXT        One custom prompt instead of the scenario file
  --scenario ID        Select one scenario; otherwise run all sequentially
  --model NAME         Default llama3.2:latest
  --endpoint URL       Default http://127.0.0.1:11434/api/chat (loopback only)
  --timeout-ms NUMBER  Default 300000; range 5000..600000 per authoring request
  --max-tokens NUMBER  Default 2200 (source authoring minimum); range 2200..131072
  --temperature NUM    Default 0; range 0..2
  --out DIRECTORY      Default OS temp/civweave-weaveling-quality/TIMESTAMP

Without --run, no network request is sent. --dry-run executes the actual source
until the transport gate and records the outgoing prompt/schema/config.
--run enables real local inference, including the runtime's one repair attempt.
Each scenario gets fresh synthetic in-memory storage; browser chats are untouched.
Expected realms are review annotations and are never injected into model inputs.
Structural checks do not establish semantic quality; inspect every plan manually.
This evaluates source authoring/persistence, not UI routing or downstream execution.
`;
}

function options(argv) {
  const out = { mode: 'list', scenarios: defaultScenarios, model: 'llama3.2:latest', endpoint: 'http://127.0.0.1:11434/api/chat', timeoutMs: 300000, maxTokens: 2200, temperature: 0 };
  const names = { '--scenarios': 'scenarios', '--prompt': 'prompt', '--scenario': 'scenario', '--model': 'model', '--endpoint': 'endpoint', '--timeout-ms': 'timeoutMs', '--max-tokens': 'maxTokens', '--temperature': 'temperature', '--out': 'out' };
  let explicitMode;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { out.help = true; continue; }
    if (['--run', '--dry-run', '--list'].includes(arg)) {
      if (explicitMode && explicitMode !== arg) throw new Error('Choose only one of --run, --dry-run, or --list.');
      explicitMode = arg; out.mode = arg.slice(2); continue;
    }
    if (!names[arg]) throw new Error(`Unknown option ${arg}. Use --help.`);
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${arg}.`);
    out[names[arg]] = argv[++i];
  }
  for (const [key, min, max] of [['timeoutMs', 5000, 600000], ['maxTokens', 2200, 131072], ['temperature', 0, 2]]) {
    out[key] = Number(out[key]);
    if (!Number.isFinite(out[key]) || out[key] < min || out[key] > max) throw new Error(`${key} must be between ${min} and ${max}.`);
  }
  const url = new URL(out.endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/api/chat' || url.search || url.hash) throw new Error('Endpoint must be an unauthenticated loopback http(s) /api/chat URL without a query or fragment.');
  out.endpoint = url.href;
  return out;
}

async function scenariosFor(opts) {
  const document = opts.prompt ? { scenarios: [{ id: 'custom', prompt: opts.prompt, reviewQuestions: ['Are the selected subsystems necessary and the steps/evidence usable?'] }] } : JSON.parse(await readFile(path.resolve(opts.scenarios), 'utf8'));
  if (!Array.isArray(document.scenarios) || !document.scenarios.length) throw new Error('Scenario file needs a nonempty scenarios array.');
  const seen = new Set();
  for (const scenario of document.scenarios) {
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(scenario.id || '') || seen.has(scenario.id) || typeof scenario.prompt !== 'string' || !scenario.prompt.trim()) throw new Error('Each scenario needs a unique filesystem-safe id and a nonempty prompt.');
    seen.add(scenario.id);
  }
  const selected = document.scenarios.filter(scenario => !opts.scenario || scenario.id === opts.scenario);
  if (!selected.length) throw new Error(`No scenario named ${opts.scenario}.`);
  return selected;
}

function storageAdapter(map) {
  return { getItem: key => map.get(String(key)) ?? null, setItem: (key, value) => map.set(String(key), String(value)), removeItem: key => map.delete(String(key)), clear: () => map.clear(), key: index => [...map.keys()][index] ?? null, get length() { return map.size; } };
}

// Keep transport metadata and visible output; Ollama's private thinking is omitted.
function visibleResponse(payload) {
  if (!payload || typeof payload !== 'object') return { invalidTransportJson: true };
  const kept = {};
  for (const key of ['model', 'created_at', 'done', 'done_reason', 'total_duration', 'load_duration', 'prompt_eval_count', 'prompt_eval_duration', 'eval_count', 'eval_duration', 'error']) if (key in payload) kept[key] = payload[key];
  kept.outputText = payload.message?.content ?? payload.response ?? '';
  return kept;
}

export function objectiveChecks({ plan, request, storage, routing, runtimeResult, transport = [] }) {
  if (!plan) return { allPassed: null, checks: [], qualityReviewRequired: true };
  const saved = parse(storage[intentionsKey]) || [];
  const campus = parse(storage[campusKey]);
  const check = (id, passed, observed) => ({ id, passed: Boolean(passed), observed });
  const checks = [
    check('runtime-validated-output', runtimeResult?.status === 'success' && runtimeResult?.structured?.valid === true, { status: runtimeResult?.status, structured: runtimeResult?.structured }),
    check('no-token-limit-stop', !transport.some(call => /^(length|max_tokens|max_output_tokens)$/i.test(call.response?.done_reason || '')), transport.map(call => call.response?.done_reason || null)),
    check('review-gated', plan.state === 'review' && plan.requiresExplicitActivation === true, { state: plan.state, requiresExplicitActivation: plan.requiresExplicitActivation }),
    check('actual-ollama-provenance', plan.authoring?.aiGenerated === true && plan.authoring?.mode === 'model-structured-json' && plan.authoring?.provider === 'ollama', plan.authoring),
    check('persisted-by-planner', saved.some(item => item.id === plan.id && item.state === 'review' && item.plan?.id === plan.id), plan.id),
    check('request-owns-wish', plan.wish === request?.context?.workingMemory?.currentWish, plan.wish),
    check('campus-wish-preserved', campus?.wish === unrelatedWish, campus?.wish),
    check('no-unrelated-fixture-memory', !JSON.stringify(request?.context?.workingMemory || {}).includes('UNRELATED_FIXTURE_CHESS_GOAL') && !JSON.stringify(request?.messages || []).includes('UNRELATED_FIXTURE_CHESS_GOAL'), null),
    check('valid-realm-type-pairs', plan.paths?.length > 0 && plan.paths.every(row => realmType[row.realm] === row.type), plan.paths?.map(row => ({ realm: row.realm, type: row.type }))),
    check('nonempty-path-steps-and-evidence', plan.paths?.length > 0 && plan.paths.every(row => row.title && row.purpose && row.steps?.length && row.steps.every(step => typeof step === 'string' && step.trim()) && row.completionCriteria && row.evidence?.length && row.evidence.every(item => typeof item === 'string' && item.trim())), plan.paths?.map(row => ({ title: row.title, steps: row.steps?.length, evidence: row.evidence?.length }))),
  ];
  if (routing.directCanonicalArtifact === 'weave') checks.push(check('explicit-quest-not-learning-journey', routing.learningJourneyIntent === false, routing));
  return { allPassed: checks.every(item => item.passed), checks, qualityReviewRequired: true };
}

function reviewComparison(plan, expectations = {}) {
  const actualRealms = [...new Set((plan?.paths || []).map(row => row.realm))].sort();
  const expected = Array.isArray(expectations.expectedRealms) ? [...expectations.expectedRealms].sort() : null;
  return {
    expectedRealms: expected, observedRealms: actualRealms,
    missingExpectedRealms: expected?.filter(realm => !actualRealms.includes(realm)) ?? null,
    unexpectedRealms: expected ? actualRealms.filter(realm => !expected.includes(realm)) : null,
    expectedExactPaths: expectations.exactPaths ?? null, observedPaths: plan?.paths?.length ?? null,
    expectedStepsPerPath: expectations.exactStepsPerPath ?? null, observedStepsPerPath: plan?.paths?.map(row => row.steps.length) ?? null,
    expectedGovernanceIncluded: expectations.governanceIncluded ?? null, observedGovernanceIncluded: plan ? Boolean(plan.governance) : null,
    assessment: 'Human review required. Expectations did not alter the request or schema.',
  };
}

async function runScenario(scenario, opts, sources) {
  const startedAt = new Date().toISOString(), started = Date.now();
  const fixturePlan = { id: 'unrelated-fixture-plan', title: 'UNRELATED_FIXTURE_CHESS_GOAL', wish: unrelatedWish, state: 'review', paths: [], authoring: { aiGenerated: true, mode: 'model-structured-json', provider: 'fixture-only' } };
  const saved = new Map([[campusKey, JSON.stringify({ wish: unrelatedWish, profile: { constraints: 'UNRELATED_FIXTURE_CHESS_GOAL only' }, plan: fixturePlan })], [intentionsKey, JSON.stringify([{ id: fixturePlan.id, kind: 'weave-plan', state: 'review', plan: fixturePlan }])], ['civweave.realm-inbox.v1', '[]']]);
  const config = { provider: 'ollama', route: 'ollama', model: opts.model, endpoint: opts.endpoint, timeoutMs: opts.timeoutMs, maxTokens: opts.maxTokens, temperature: opts.temperature, context: 8192, stream: false };
  const transport = [], runtimeCalls = [], events = [], consoleMessages = [];
  const scope = {
    Date, Math, structuredClone, URL, URLSearchParams, AbortController, AbortSignal, DOMException, TextEncoder, TextDecoder, Headers, Request, Response,
    setTimeout, clearTimeout, queueMicrotask,
    console: { log: (...args) => consoleMessages.push(args.map(String).join(' ')), warn: (...args) => consoleMessages.push(args.map(String).join(' ')), error: (...args) => consoleMessages.push(args.map(String).join(' ')) },
    localStorage: storageAdapter(saved), sessionStorage: storageAdapter(new Map()),
    location: { href: 'https://civweave-fixture.invalid/app/working-campus-v440.html', origin: 'https://civweave-fixture.invalid', pathname: '/app/working-campus-v440.html', search: '' },
    document: { readyState: 'loading', documentElement: { dataset: { civweaveSystem: 'civweave' } }, addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], scripts: [] },
    navigator: { onLine: true }, addEventListener() {}, dispatchEvent() {},
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    fetch: async (url, init = {}) => {
      if (new URL(url).href !== opts.endpoint) throw new Error('Quality runner blocked a request outside its selected loopback endpoint.');
      const call = { url: String(url), method: init.method, request: parse(init.body), startedAt: new Date().toISOString(), sent: false };
      transport.push(call);
      if (opts.mode !== 'run') { call.skipped = 'Dry-run transport gate: no network request sent.'; throw new Error(call.skipped); }
      call.sent = true; const start = Date.now();
      try {
        const response = await fetch(url, { ...init, redirect: 'error' });
        call.httpStatus = response.status;
        call.response = visibleResponse(parse(await response.clone().text()));
        return response;
      } catch (error) { call.error = errorRecord(error); throw error; }
      finally { call.elapsedMs = Date.now() - start; }
    },
  };
  scope.globalThis = scope;
  const context = vm.createContext(scope);
  for (const source of sources) vm.runInContext(source.text, context, { filename: source.path });
  const runtime = scope.CivweaveModelRuntime;
  // Observation only in this isolated fixture; generation remains the real source closure.
  scope.CivweaveModelRuntime = { ...runtime, generate: async request => {
    const call = { request: copy({ ...request, signal: undefined, onEvent: undefined, onToken: undefined, transport: undefined }) };
    runtimeCalls.push(call);
    try { const result = await runtime.generate(request); call.result = copy(result); return result; }
    catch (error) { call.error = errorRecord(error); throw error; }
  } };
  const author = scope.CivweaveWeavelingPlanJsonV190;
  const routing = { directCanonicalArtifact: scope.CivweaveGuideCapabilityPassoverV1.directCanonicalArtifact(scenario.prompt.toLowerCase()), learningJourneyIntent: author.learningJourneyIntent(scenario.prompt) };
  let packet, error;
  try {
    packet = await author.createModelPlan({ text: scenario.prompt, history: [{ role: 'user', text: unrelatedWish }, { role: 'assistant', text: 'UNRELATED_FIXTURE_CHESS_GOAL saved for review.' }], onEvent: event => events.push(copy(event)) }, { selectedConfig: () => config });
  } catch (caught) { error = errorRecord(caught); }
  const storage = Object.fromEntries(saved), plan = copy(packet?.plan || null), request = runtimeCalls[0]?.request;
  return {
    schema: 'civweave.weaveling-quality-result.v1', mode: opts.mode, scenario: copy(scenario),
    status: opts.mode === 'dry-run' && transport.some(call => call.skipped) ? 'not-run' : error ? 'authoring-failed' : 'authored-for-review',
    qualityReviewRequired: true, timing: { startedAt, elapsedMs: Date.now() - started },
    versions: { runtime: runtime.version, author: author.version, planner: scope.CivweaveIntentionPlanner.version, materializer: scope.CivweaveWeavelingPlanMaterializationV265.version, passover: scope.CivweaveGuideCapabilityPassoverV1.version },
    config, routing, runtimeCalls, transport, events, error, plan,
    objective: objectiveChecks({ plan, request, storage, routing, runtimeResult: runtimeCalls[0]?.result, transport }),
    review: reviewComparison(plan, scenario.expectations),
    fixture: { browserStorageAccessed: false, storageKind: 'fresh-per-scenario-in-memory-synthetic-map' },
    storage, consoleMessages,
  };
}

function markdownReport(results, metadata) {
  const lines = ['# Weaveling model quality review', '', `Mode: ${metadata.mode}. Model: ${metadata.config.model}. Commit: ${metadata.git.head || 'unavailable'}.`, '', 'Semantic quality requires human review. Realm expectations were never supplied to the model. The source authoring pipeline and persistence ran in isolated synthetic storage; this does not test browser CORS, UI routing, approval, or downstream execution.', ''];
  for (const result of results) {
    lines.push(`## ${result.scenario.id}`, '', `Status: ${result.status}; ${(result.timing.elapsedMs / 1000).toFixed(1)}s; transport attempts sent: ${result.transport.filter(call => call.sent).length}.`, '', `Prompt: ${result.scenario.prompt}`, '', `Expected realms: ${(result.review.expectedRealms || []).join(', ') || 'unspecified'}. Observed: ${result.review.observedRealms.join(', ') || 'none'}.`, '', `Structural checks: ${result.objective.allPassed == null ? 'not evaluated (no plan)' : result.objective.allPassed ? 'passed; semantic review remains open' : 'failed'}.`);
    if (result.error) lines.push('', `Authoring error: ${result.error.message}`);
    for (const check of result.objective.checks.filter(item => !item.passed)) lines.push('', `Failed structural check: ${check.id}`);
    for (const row of result.plan?.paths || []) {
      lines.push('', `### ${row.title} (${row.realm} / ${row.type})`, '', row.purpose, '');
      for (const step of row.steps) lines.push(`- ${step}`);
      lines.push('', `Completion: ${row.completionCriteria}`, '', 'Evidence:', '');
      for (const item of row.evidence) lines.push(`- ${item}`);
    }
    if (result.plan) lines.push('', `Governance: ${JSON.stringify(result.plan.governance)}`);
    lines.push('', 'Review questions:', '');
    for (const question of result.scenario.reviewQuestions || ['Is every selected subsystem necessary and every step usable?']) lines.push(`- [ ] ${question}`);
    lines.push('', `Full source request, transport output, plan and fixture state: ${result.scenario.id}.json`, '');
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const opts = options(process.argv.slice(2));
  if (opts.help) { console.log(help()); return; }
  const scenarios = await scenariosFor(opts);
  if (opts.mode === 'list') {
    console.log('No network requests sent. Select --dry-run or explicitly --run for real Ollama authoring.');
    for (const scenario of scenarios) console.log(`${scenario.id}: ${scenario.prompt}`);
    return;
  }
  const sources = await Promise.all(sourcePaths.map(async relative => { const text = await readFile(path.join(repo, relative), 'utf8'); return { path: relative, text, sha256: createHash('sha256').update(text).digest('hex') }; }));
  const git = {};
  for (const [key, args] of [['head', ['rev-parse', 'HEAD']], ['status', ['status', '--short']]]) try { git[key] = execFileSync('git', ['-c', 'core.fscache=false', ...args], { cwd: repo, encoding: 'utf8', windowsHide: true }).trim(); } catch { git[key] = null; }
  const destination = path.resolve(opts.out || path.join(os.tmpdir(), 'civweave-weaveling-quality', new Date().toISOString().replace(/[:.]/g, '-')));
  await mkdir(destination, { recursive: true });
  const metadata = { schema: 'civweave.weaveling-quality-run.v1', mode: opts.mode, at: new Date().toISOString(), git, config: { model: opts.model, endpoint: opts.endpoint, timeoutMs: opts.timeoutMs, maxTokens: opts.maxTokens, temperature: opts.temperature }, sources: sources.map(({ text, ...source }) => source), outputDirectory: destination, qualityReviewRequired: true };
  const results = [];
  await writeFile(path.join(destination, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  for (const scenario of scenarios) {
    console.log(`${opts.mode}: ${scenario.id} (${opts.model})`);
    const result = await runScenario(scenario, opts, sources);
    results.push(result);
    await writeFile(path.join(destination, `${scenario.id}.json`), `${JSON.stringify(result, null, 2)}\n`);
    await writeFile(path.join(destination, 'results.json'), `${JSON.stringify({ ...metadata, results }, null, 2)}\n`);
    await writeFile(path.join(destination, 'report.md'), markdownReport(results, metadata));
    console.log(`${scenario.id}: ${result.status}; structural=${result.objective.allPassed ?? 'not-evaluated'}; realms=${result.review.observedRealms.join(',') || 'none'}; human quality review required`);
  }
  console.log(`Artifacts: ${destination}`);
  if (opts.mode === 'run' && results.some(result => result.status !== 'authored-for-review' || result.objective.allPassed !== true)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
