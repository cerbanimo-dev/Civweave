import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const repair=await readFile('public/service-worker-chat-repair-v245.js','utf8');
const generated=await readFile('public/service-worker-v203.js','utf8');
const builder=await readFile('scripts/build-service-worker-v211.mjs','utf8');
const installedEntry=await readFile('public/app/installed-entry-v146.js','utf8');
const localAIGate=await readFile('public/service-worker-local-ai-coherence-v307.js','utf8');

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

assert.match(repair,/const REVISION='chat-css-contract-v343'/,'local AI cache repair must not rename the unrelated chat CSS contract');
assert.match(repair,/local-ai-cache-coherence-v306/);
assert.match(repair,/cache\.delete\(request,\{ignoreSearch:true\}\)/,'local AI cache repair must evict every query-string revision for the same runtime path');
for(const pathname of requiredLocalAIPaths){
  assert.ok(repair.includes(`'${pathname}'`),`cache repair lost local AI dependency ${pathname}`);
}

const canonicalImport="importScripts('/service-worker-chat-repair-v245.js?v=chat-css-contract-v343&purge=chat-css-contract-v343');";
assert.ok(generated.includes(canonicalImport),'generated service worker must preserve the canonical chat repair import identity');
assert.ok(builder.includes(canonicalImport),'service worker generator must preserve the canonical chat repair import identity');
assert.match(generated,/local-ai-code-coherence-v307-local-first/,'generated parent worker must carry the active local-first local AI code-coherence epoch');
assert.match(builder,/localAICodeCoherence:'v307-explicit-package-install-cache-only-runtime'/,'service worker generator must report the active local-first local AI code-coherence epoch');
assert.match(localAIGate,/runtimeNetworkFallback: false/,'local AI code runtime must not fall through to the network');
assert.match(installedEntry,/allowProvision:localDeveloper\(\)/,'installed production launch must not provision a worker implicitly');
assert.match(installedEntry,/browserRuntimePolicy:'installed-display-cache-only'/,'installed runtime must advertise cache-only policy');

console.log(JSON.stringify({
  ok:true,
  revision:'local-ai-cache-coherence-v306-local-first',
  localAICodeCoherence:'v307-explicit-package-install-cache-only-runtime',
  chatContract:'chat-css-contract-v343',
  protectedPaths:requiredLocalAIPaths.length,
  ignoreSearchEviction:true,
  parentWorkerBytesRotated:true,
  runtimeNetworkFallback:false
},null,2));
