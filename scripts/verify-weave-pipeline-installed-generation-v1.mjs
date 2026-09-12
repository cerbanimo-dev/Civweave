import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [rootWorker,canonicalWorker,takeover,shell]=await Promise.all([
  readFile('public/service-worker.js','utf8'),
  readFile('public/service-worker-v203.js','utf8'),
  readFile('public/service-worker-weave-pipeline-takeover-v1.js','utf8'),
  readFile('public/app/persistent-system-shell-v1.html','utf8')
]);

assert.match(rootWorker,/root-worker-bridge-v28-gemma-route-integrity/,'root service worker generation was not bumped for Gemma route integrity');
assert.ok(rootWorker.includes("importScripts('/service-worker-weave-pipeline-takeover-v1.js?v=weave-pipeline-takeover-v1-r3')"),'root worker does not import the r3 Weave route takeover');
assert.ok(canonicalWorker.includes("importScripts('/service-worker-weave-pipeline-takeover-v1.js?v=weave-pipeline-takeover-v1-r3')"),'canonical registered v203 worker does not import the r3 Weave route takeover');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-first-request-intake-bridge-v1.js'"),'installer CORE does not include the mandatory first-request intake bridge');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-route-integrity-v1.js'"),'installer CORE does not include post-loader route integrity');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-weave-draft-pipeline-v1.js'"),'installer CORE does not include the E4B Weave Draft pipeline');
assert.ok(shell.includes('/app/local-ai/gemma4-first-request-intake-bridge-v1.js?v=1.0.1-living-school-intake'),'persistent shell does not load the current first-request intake bridge');
assert.ok(shell.includes('/app/local-ai/gemma4-route-integrity-v1.js?v=1.0.0-post-loader-original-text'),'persistent shell does not load post-loader original-text route integrity');
assert.match(takeover,/weave-pipeline-takeover-v1-r3/,'takeover marker was not advanced beyond the already-consumed r2 generation');
assert.match(takeover,/cwrecovery-v459-weave-pipeline-route-integrity/,'takeover does not use a fresh cache marker for route integrity');

for(const pathname of [
  '/app/persistent-system-shell-v1.html',
  '/app/shared-guide-surface-v236.js',
  '/app/guide-chat-surface-v350.js',
  '/app/local-guide-control-bypass-v1.js',
  '/app/unified-chat-system-v1.js',
  '/app/guide-generation-tracker-v1.js',
  '/app/family-ai-loader-v105.js',
  '/app/local-ai/gemma4-litert-request-authority-v1.js',
  '/app/local-ai/gemma4-structured-task-authority-v1.js',
  '/app/local-ai/gemma4-first-request-intake-bridge-v1.js',
  '/app/local-ai/gemma4-route-integrity-v1.js',
  '/app/local-ai/gemma4-weave-draft-pipeline-v1.js'
])assert.ok(takeover.includes(`'${pathname}'`),`takeover does not purge ${pathname}`);

assert.ok(takeover.includes('self.skipWaiting()'),'takeover does not activate immediately');
assert.ok(takeover.includes('self.clients.claim()'),'takeover does not claim installed clients');
assert.ok(takeover.includes('client.navigate(client.url)'),'takeover does not reload controlled installed clients onto the new shell generation');
assert.match(takeover,/civweave-staging\.pages\.dev/,'takeover is not constrained to staging');

console.log('PASS: both root and canonical installed workers consume r3 route integrity, purge stale guide/model routing assets, and reload onto original-text E2B-intake/E4B-Weave routing.');
