import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [rootWorker,canonicalWorker,takeover,shell]=await Promise.all([
  readFile('public/service-worker.js','utf8'),
  readFile('public/service-worker-v203.js','utf8'),
  readFile('public/service-worker-weave-pipeline-takeover-v1.js','utf8'),
  readFile('public/app/persistent-system-shell-v1.html','utf8')
]);

assert.match(rootWorker,/root-worker-bridge-v29-explicit-learning-weave/,'root service worker generation was not bumped for explicit Learning Weave entry');
assert.ok(rootWorker.includes("importScripts('/service-worker-weave-pipeline-takeover-v1.js?v=weave-pipeline-takeover-v1-r4')"),'root worker does not import the r4 Weave takeover');
assert.ok(canonicalWorker.includes("importScripts('/service-worker-weave-pipeline-takeover-v1.js?v=weave-pipeline-takeover-v1-r4')"),'canonical registered v203 worker does not import the r4 Weave takeover');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-first-request-intake-bridge-v1.js'"),'installer CORE does not include the mandatory first-request intake bridge');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-route-integrity-v1.js'"),'installer CORE does not include post-loader route integrity');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-learning-plan-entry-authority-v1.js'"),'installer CORE does not include explicit Learning Journey entry authority');
assert.ok(rootWorker.includes("'/app/generation-failure-inspector-v1.js'"),'installer CORE does not include rejected generation inspector');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-weave-draft-pipeline-v1.js'"),'installer CORE does not include the E4B Weave Draft pipeline');
assert.ok(shell.includes('/app/local-ai/gemma4-first-request-intake-bridge-v1.js?v=1.0.1-living-school-intake'),'persistent shell does not load the current first-request intake bridge');
assert.ok(shell.includes('/app/local-ai/gemma4-route-integrity-v1.js?v=1.0.0-post-loader-original-text'),'persistent shell does not load post-loader original-text route integrity');
assert.ok(shell.includes('/app/local-ai/gemma4-learning-plan-entry-authority-v1.js?v=1.0.0-explicit-weave'),'persistent shell does not load explicit Learning Journey Weave entry');
assert.ok(shell.includes('/app/generation-failure-inspector-v1.js?v=1.0.0-rejected-output'),'persistent shell does not load rejected generation inspector');
assert.match(takeover,/weave-pipeline-takeover-v1-r4/,'takeover marker was not advanced beyond the already-consumed r3 generation');
assert.match(takeover,/cwrecovery-v460-explicit-learning-weave-entry/,'takeover does not use a fresh cache marker for explicit Learning Weave entry');

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
assert.ok(takeover.includes('client.navigate(client.url)'),'takeover does not reload controlled installed clients onto the new shell generation');
assert.match(takeover,/civweave-staging\.pages\.dev/,'takeover is not constrained to staging');

console.log('PASS: both root and canonical installed workers consume r4 explicit Learning Weave entry, purge stale generation assets, and reload with rejected-output inspection.');
