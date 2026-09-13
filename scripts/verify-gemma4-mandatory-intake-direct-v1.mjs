import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const bypassPath = 'public/app/local-guide-control-bypass-v1.js';
const sharedPath = 'public/app/shared-guide-surface-v236.js';
const takeoverPath = 'public/service-worker-weave-pipeline-takeover-v1.js';
const rootWorkerPath = 'public/service-worker.js';
const installedWorkerPath = 'public/service-worker-v203.js';

const bypass = read(bypassPath);
const shared = read(sharedPath);
const takeover = read(takeoverPath);
const rootWorker = read(rootWorkerPath);
const installedWorker = read(installedWorkerPath);

assert.match(bypass, /1\.4\.3-local-guide-control-bypass-v1-mandatory-intake-direct/);
assert.match(bypass, /bridge\.directIntake\(input\)/);
assert.match(bypass, /mandatoryGemmaIntakeDirect:true/);
assert.doesNotMatch(bypass, /intakeFirst===true\)return local\(input\)/, 'eligible Gemma requests must never defer to a captured legacy local wrapper');

assert.match(shared, /1\.0\.180-shared-guide-surface-v236-current-gemma-route/);
assert.match(shared, /gemma4-litert-fast-extension-v1\.js\?v=1\.1\.1-browser-handoff-guard/);
assert.match(shared, /litert-gemma4-fast-runtime-v1\.js\?v=1\.4\.0-formatted-output/);
assert.match(shared, /local-guide-control-bypass-v1\.js\?v=1\.4\.3-mandatory-intake-direct/);
assert.doesNotMatch(shared, /local-guide-control-bypass-v1\.js\?v=1\.4\.1-ai-quest-lazy-route/);
assert.doesNotMatch(shared, /litert-gemma4-fast-runtime-v1\.js\?v=1\.0\.1-web-safe/);

assert.match(takeover, /weave-pipeline-takeover-v1-r6/);
assert.match(takeover, /cwrecovery-v462-mandatory-gemma-intake/);
assert.match(rootWorker, /root-worker-bridge-v31-mandatory-gemma-intake/);
assert.match(rootWorker, /weave-pipeline-takeover-v1\.js\?v=weave-pipeline-takeover-v1-r6/);
assert.match(installedWorker, /service-worker-weave-pipeline-takeover-v1\.js\?v=weave-pipeline-takeover-v1-r6/, 'the canonical installed PWA worker must itself import takeover r6');
assert.doesNotMatch(installedWorker, /service-worker-weave-pipeline-takeover-v1\.js\?v=weave-pipeline-takeover-v1-r5/);

let bridgeCalls = 0;
let legacyCalls = 0;
let deterministicCalls = 0;
const legacy = async () => { legacyCalls += 1; return { provider: 'legacy-direct' }; };
legacy.__civweaveLocalProviderAuthorityV1 = true;
legacy.__civweaveLocalProviderAuthorityVersion = 'test';
legacy.__prior = async () => { deterministicCalls += 1; return { provider: 'deterministic' }; };

const context = {
  console,
  setInterval: () => 1,
  clearInterval: () => {},
  setTimeout: fn => { queueMicrotask(fn); return 1; },
  queueMicrotask,
  addEventListener: () => {},
  dispatchEvent: () => {},
  CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  document: { scripts: [], head: { isConnected: true, append: () => {} } },
  CivweaveAssistantV141: { respond: legacy },
  CivweaveGemma4StructuredTaskAuthorityV1: {
    intakeFirst: true,
    intakeEligible: args => args?.systemId === 'civweave' && /tarot/i.test(args?.text || '')
  },
  CivweaveGemma4FirstRequestIntakeBridgeV1: {
    directIntake: async () => { bridgeCalls += 1; return { handled: true, result: { provider: 'bridge-intake', model: 'gemma4-e2b-it-litert-web' } }; }
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(bypass, context, { filename: bypassPath });

const result = await context.CivweaveAssistantV141.respond({
  systemId: 'civweave',
  text: 'Can you teach me how to read and memorize the tarot?'
});
assert.equal(result.provider, 'bridge-intake');
assert.equal(bridgeCalls, 1, 'mandatory first-request bridge must own eligible Gemma intake');
assert.equal(legacyCalls, 0, 'captured legacy local provider must not run for eligible Gemma intake');
assert.equal(deterministicCalls, 0, 'deterministic control path must not run for substantive intake');

console.log('PASS: local Gemma learning requests cannot bypass mandatory E2B intake and the canonical installed worker forces takeover r6.');
