import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [finderHtml,finderRuntime,marketplace,operatorHtml,operatorRuntime,offlineManifest,offlineWorker,gateway,inferenceHttp]=await Promise.all([
  read('public/app/federation-finder-local-v269.html'),
  read('public/app/federation-finder-local-v269.js'),
  read('public/app/node-ai-marketplace-surface-v1.js'),
  read('public/app/node-ai-operator-v1.html'),
  read('public/app/node-ai-operator-v1.js'),
  read('public/app/offline-package-v208.json'),
  read('public/service-worker-offline-v211-override.js'),
  read('releases/1.0.81/server/server-gateway-v131.mjs'),
  read('lib/node-ai-inference-http-v1.mjs')
]);
const manifest=JSON.parse(offlineManifest);
assert.ok(finderHtml.includes('id="nodeAiServices"'),'Finder does not expose the node AI marketplace surface.');
assert.ok(finderHtml.includes('/app/node-ai-marketplace-surface-v1.js'),'Finder does not load the marketplace runtime.');
assert.ok(finderRuntime.includes("const NODE_KEY='federation-finder.physical-node-endpoint'"),'Maintained local-first Finder runtime is missing.');
assert.ok(marketplace.includes('CivweaveNodeAIMeshV1'),'Marketplace surface does not consume signed mesh discovery.');
assert.ok(marketplace.includes("const SESSION_KEY='civweave.node-ai-marketplace.sessions.v1'"),'Marketplace does not isolate node sessions.');
assert.ok(marketplace.includes('sessionStorage.setItem(SESSION_KEY'),'Node wallet sessions are not tab/session scoped.');
assert.ok(!marketplace.includes('localStorage.setItem(SESSION_KEY'),'Node wallet sessions leaked into persistent local storage.');
assert.ok(!/\/api\/ai\/node\/wallet\/payments\/webhook|\/api\/ai\/node\/wallet\/internal\//i.test(marketplace),'Public marketplace surface contains a live-payment webhook or privileged wallet path.');
assert.ok(marketplace.includes('/api/ai/node/trial/topups'),'Sandbox trial-credit path is missing from the public marketplace surface.');
assert.ok(marketplace.includes("circle.classList.add('ai-service')"),'Marketplace does not decorate observed map nodes with AI-service availability.');
assert.ok(marketplace.includes("preferredNodeId"),'Device-owned node preference is missing.');
assert.ok(operatorHtml.includes('/app/node-ai-operator-v1.js'),'Operator status shell is disconnected.');
assert.ok(operatorRuntime.includes('/api/ai/node/manifest')&&operatorRuntime.includes('/api/ai/node/inference/status'),'Operator status does not use safe public status endpoints.');
assert.ok(!/FIREWORKS_API_KEY|NODE_AI_CAPABILITY_SECRET/.test(operatorRuntime),'Operator surface references provider or capability credential values.');
assert.deepEqual(manifest.seeds,[
  '/app/installed-entry-v146.html',
  '/app/cw-reward-ledger-v2.js',
  '/app/civweave-basic-value-v1.js',
  '/app/civweave-economic-policy-v1.js',
  '/app/civweave-basic-value-model-v1.js',
  '/app/civweave-basic-value-review-v1.js',
  '/app/civweave-basic-value-systems-v1.js',
  '/app/cw-reward-receivers-v2.js',
  '/app/cw-reward-legacy-bridge-v2.js',
  '/app/cw-reward-surfaces-v2.js',
  '/app/cerbanimo-commerce-distribution-v1.js',
  '/app/civweave-systems-mesh-v251.js',
  '/app/working-campus-v156.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
],'Canonical offline roots changed.');
for(const asset of ['/finder','/app/federation-finder-local-v269.html','/app/federation-finder-local-v269.js','/app/federation-finder-data/federation-seed-v269.json','/app/node-ai-marketplace-surface-v1.js','/app/node-ai-operator-v1.html','/app/node-ai-operator-v1.js'])assert.ok(manifest.assets.includes(asset),`Offline marketplace asset ${asset} is missing.`);
assert.ok(offlineWorker.includes("const initialAssets = [...new Set((manifest.seeds || []).filter(Boolean))]"),'Canonical current-graph seed contract changed.');
assert.ok(offlineWorker.includes("for (const asset of (manifest.assets || []).filter(Boolean))"),'Optional offline asset carriage is missing.');
assert.ok(offlineWorker.includes('required: requiredSeeds.has(pathname)'),'Optional marketplace assets are incorrectly promoted to required roots.');
assert.ok(gateway.includes("pathname === '/api/finder-status'"),'Gateway does not expose sanitized Finder topology.');
assert.ok(gateway.includes('sanitizeLocation'),'Finder status does not sanitize public locations.');
assert.ok(inferenceHttp.includes("pathname === '/api/ai/node/inference/status'"),'Public inference readiness endpoint is missing.');
console.log(JSON.stringify({ok:true,revision:'node-ai-marketplace-surface-v1',canonicalRoots:manifest.seeds.length,optionalAssets:manifest.assets.length,sessionScoped:true,noLivePaymentMutation:true,sandboxTrialCredit:true,finderIntegrated:true,operatorStatus:true},null,2));
