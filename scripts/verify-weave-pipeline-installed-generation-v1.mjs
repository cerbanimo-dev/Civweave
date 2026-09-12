import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [rootWorker,takeover,shell]=await Promise.all([
  readFile('public/service-worker.js','utf8'),
  readFile('public/service-worker-weave-pipeline-takeover-v1.js','utf8'),
  readFile('public/app/persistent-system-shell-v1.html','utf8')
]);

assert.match(rootWorker,/root-worker-bridge-v27-living-school-weave-rebind/,'root service worker generation was not bumped for the Living School Weave rebind');
assert.ok(rootWorker.includes("importScripts('/service-worker-weave-pipeline-takeover-v1.js?v=weave-pipeline-takeover-v1-r2')"),'root worker does not import the r2 Weave pipeline takeover');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-first-request-intake-bridge-v1.js'"),'installer CORE does not include the mandatory first-request intake bridge');
assert.ok(rootWorker.includes("'/app/local-ai/gemma4-weave-draft-pipeline-v1.js'"),'installer CORE does not include the E4B Weave Draft pipeline');
assert.ok(shell.includes('/app/local-ai/gemma4-first-request-intake-bridge-v1.js'),'persistent shell does not load the first-request intake bridge');
assert.match(takeover,/weave-pipeline-takeover-v1-r2/,'takeover marker was not advanced beyond the already-consumed r1 generation');
assert.match(takeover,/cwrecovery-v458-living-school-weave-rebind/,'takeover does not use a fresh cache marker for the Living School rebind');

for(const pathname of [
  '/app/persistent-system-shell-v1.html',
  '/app/shared-guide-surface-v236.js',
  '/app/local-guide-control-bypass-v1.js',
  '/app/unified-chat-system-v1.js',
  '/app/guide-generation-tracker-v1.js',
  '/app/local-ai/gemma4-litert-request-authority-v1.js',
  '/app/local-ai/gemma4-structured-task-authority-v1.js',
  '/app/local-ai/gemma4-first-request-intake-bridge-v1.js',
  '/app/local-ai/gemma4-weave-draft-pipeline-v1.js'
])assert.ok(takeover.includes(`'${pathname}'`),`takeover does not purge ${pathname}`);

assert.ok(takeover.includes('self.skipWaiting()'),'takeover does not activate immediately');
assert.ok(takeover.includes('self.clients.claim()'),'takeover does not claim installed clients');
assert.ok(takeover.includes('client.navigate(client.url)'),'takeover does not reload controlled installed clients onto the new shell generation');
assert.match(takeover,/civweave-staging\.pages\.dev/,'takeover is not constrained to staging');

console.log('PASS: installed staging clients consume the r2 Living School Weave generation, purge stale direct-generation assets, and reload onto the E2B-intake/E4B-Weave path.');