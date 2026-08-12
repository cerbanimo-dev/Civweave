import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const repair=await readFile('public/service-worker-chat-repair-v245.js','utf8');
const generated=await readFile('public/service-worker-v203.js','utf8');
const builder=await readFile('scripts/build-service-worker-v211.mjs','utf8');

const requiredLocalAIPaths=[
  '/app/ai-capability-broker-v268.js',
  '/app/fast-interactive-runtime-v192.js',
  '/app/local-ai/bootstrap-v266.js',
  '/app/local-ai/model-registry-v266.js',
  '/app/local-ai/download-manager-v267.js',
  '/app/local-ai/download-policy-v278.js',
  '/app/local-ai/metadata-repair-v276.js',
  '/app/local-ai/small-model-policy-v283.js',
  '/app/local-ai/runtime-v266.js',
  '/app/local-ai/runtime-bridge-v266.js',
  '/app/local-ai/settings-panel-v267.js',
  '/app/local-ai/primary-route-v283.js',
  '/app/local-ai/hardware-tier-ui-v278.js',
  '/app/local-ai/worker-v266.js',
  '/app/local-ai/test-pulse-v269.js'
];

assert.match(repair,/chat-css-contract-v344-local-ai-coherence/);
assert.match(repair,/local-ai-cache-coherence-v306/);
assert.match(repair,/cache\.delete\(request,\{ignoreSearch:true\}\)/,'local AI cache repair must evict every query-string revision for the same runtime path');
for(const pathname of requiredLocalAIPaths){
  assert.ok(repair.includes(`'${pathname}'`),`cache repair lost local AI dependency ${pathname}`);
}

const importLine="importScripts('/service-worker-chat-repair-v245.js?v=chat-css-contract-v344-local-ai-coherence&purge=local-ai-cache-coherence-v306');";
assert.ok(generated.includes(importLine),'generated service worker must force browsers to fetch the expanded local AI repair worker');
assert.ok(builder.includes(importLine),'service worker generator must preserve the local AI repair revision');
assert.match(builder,/localAICacheCoherence:'v306'/);

console.log(JSON.stringify({
  ok:true,
  revision:'local-ai-cache-coherence-v306',
  protectedPaths:requiredLocalAIPaths.length,
  ignoreSearchEviction:true,
  serviceWorkerImportRevved:true
},null,2));
