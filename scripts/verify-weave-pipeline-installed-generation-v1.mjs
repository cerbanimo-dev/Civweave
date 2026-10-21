import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [rootWorker,canonicalWorker,takeover,shell]=await Promise.all([
  readFile('public/service-worker.js','utf8'),
  readFile('public/service-worker-v203.js','utf8'),
  readFile('public/service-worker-weave-pipeline-takeover-v1.js','utf8'),
  readFile('public/app/persistent-system-shell-v1.html','utf8')
]);

const rootBridge=rootWorker.match(/const CIVWEAVE_ROOT_WORKER_BRIDGE='([^']+)'/)?.[1];
assert.ok(rootBridge&&rootWorker.includes(`importScripts('/service-worker-v203.js?v=${rootBridge}')`),'root bridge must delegate to the canonical installed worker with its current revision');
const takeoverRevision=takeover.match(/const REVISION='([^']+)'/)?.[1];
assert.ok(takeoverRevision,'canonical installed-generation takeover revision must be declared');
for(const worker of [rootWorker,canonicalWorker])assert.ok(worker.includes(`importScripts('/service-worker-weave-pipeline-takeover-v1.js?v=${takeoverRevision}')`),'both worker entrypoints must import the current generation takeover');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-first-request-intake-bridge-v1.js'"),'installer CORE does not include the mandatory first-request intake bridge');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-route-integrity-v1.js'"),'installer CORE does not include post-loader route integrity');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-learning-plan-entry-authority-v1.js'"),'installer CORE does not include explicit Learning Journey entry authority');
assert.ok(rootWorker.includes("'/app/generation-failure-inspector-v1.js'"),'installer CORE does not include rejected generation inspector');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-weave-draft-pipeline-v1.js'"),'installer CORE does not include the E4B Weave Draft pipeline');
for(const path of ['/app/local-ai/gemma4-first-request-intake-bridge-v1.js','/app/local-ai/gemma4-route-integrity-v1.js','/app/local-ai/gemma4-learning-plan-entry-authority-v1.js','/app/generation-failure-inspector-v1.js']){
  const source=await readFile('public'+path,'utf8'),version=source.match(/const VERSION='(\d+\.\d+\.\d+)[^']*'/)?.[1];
  assert.ok(version&&shell.includes(`${path}?v=${version}-`),`persistent shell must load the canonical ${path} revision`);
}
assert.ok(takeover.includes(`const MARKER='/__civweave/${takeoverRevision}'`),'takeover installation marker must match its revision');
assert.match(takeover,/const CACHE='cwrecovery-v\d+-[^']+'/,'takeover must expose a versioned recovery cache');

for(const pathname of [
  '/app/persistent-system-shell-v1.html',
  '/app/shared-guide-surface-v236.js',
  '/app/guide-chat-surface-v350.js',
  '/app/local-guide-control-bypass-v1.js',
  '/app/unified-chat-system-v1.js',
  '/app/guide-generation-tracker-v1.js',
  '/app/generation-failure-inspector-v1.js',
  '/app/family-ai-loader-v105.js',
  '/app/local-ai/gemma4-litert-request-authority-v1.js',
  '/app/local-ai/gemma4-structured-task-authority-v1.js',
  '/app/local-ai/gemma4-first-request-intake-bridge-v1.js',
  '/app/local-ai/gemma4-route-integrity-v1.js',
  '/app/local-ai/gemma4-learning-plan-entry-authority-v1.js',
  '/app/local-ai/gemma4-weave-draft-pipeline-v1.js'
])assert.ok(takeover.includes(`'${pathname}'`),`takeover does not purge ${pathname}`);

assert.ok(takeover.includes('self.skipWaiting()'),'takeover does not activate immediately');
assert.ok(takeover.includes('self.clients.claim()'),'takeover does not claim installed clients');
assert.ok(!takeover.includes('await reloadControlledClients()'),'the Settings upgrade must not interrupt ongoing large-model transfers with forced navigation');
assert.match(takeover,/civweave-staging\.pages\.dev/,'takeover is not constrained to staging');

console.log('PASS: both installed workers consume the canonical generation takeover and the shell loads current intake, planning entry, route integrity, and failure inspection without forcing reload of an in-progress model transfer.');
