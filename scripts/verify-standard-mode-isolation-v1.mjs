import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const standardFiles=[
  'public/app/fast-interactive-runtime-v192.js',
  'public/app/family-ai-loader-v105.js',
  'public/app/shared-guide-surface-v236.js',
  'public/app/shared/civweave-model-runtime.js',
  'public/app/assistant-runtime-v141.js',
  'public/app/minilm-response-router-v347.js',
  'public/service-worker-v203.js',
  'public/app/index.html'
];
const forbidden=[
  /CivweaveLud/i,
  /civweave\.operating-mode\.v1/i,
  /CIVWEAVE_LUD_AI_DISABLED/i,
  /human-only-lud/i,
  /service-worker-lud-package-v1/i,
  /\/app\/lud\//i,
  /\/app\/lud-/i,
  /\blud\s*mode\b/i
];

for(const path of standardFiles){
  const source=await read(path);
  for(const pattern of forbidden)assert.doesNotMatch(source,pattern,`${path} must not reference the standalone alternate mode (${pattern}).`);
}

const runtime=await read('public/app/fast-interactive-runtime-v192.js');
assert.match(runtime,/standard-ai-only/);
assert.match(runtime,/standardAIOnly:true/);
assert.doesNotMatch(runtime,/function\s+lud/i);
assert.doesNotMatch(runtime,/Object\.freeze\(\{\.\.\.base,[\s\S]*?generate/,'Standard model runtime proxy must remain mutable for MiniLM/local/cloud composition.');
assert.doesNotMatch(runtime,/Object\.freeze\(\{\.\.\.runtime,generate:prior/,'Legacy runtime unwrapping must remain mutable.');

const loader=await read('public/app/family-ai-loader-v105.js');
assert.match(loader,/1\.0\.131-standard-ai-only/);
assert.match(loader,/fast-interactive-runtime-v192\.js\?v=1\.0\.117-standard-ai-only/);
assert.match(loader,/standardAIOnly:true/);

const surface=await read('public/app/shared-guide-surface-v236.js');
assert.match(surface,/1\.0\.139-shared-guide-surface-v236-standard-ai-only/);
assert.match(surface,/family-ai-loader-v105\.js\?v=1\.0\.131-standard-ai-only/);

const worker=await read('public/service-worker-v203.js');
assert.doesNotMatch(worker,/service-worker-lud-package-v1/);
assert.match(worker,/standard-ai-isolation-v1/);

const installer=await read('public/app/index.html');
assert.doesNotMatch(installer,/\/app\/lud\//);
assert.doesNotMatch(installer,/lud-mode-link/);

const manifest=JSON.parse(await read('public/app/offline-package-v208.json'));
assert.ok(manifest.excludePrefixes.includes('/app/lud/'),'Standard offline discovery must exclude the standalone route subtree.');
assert.ok(manifest.excludePrefixes.includes('/app/lud-'),'Standard offline discovery must exclude standalone mode assets.');
for(const value of [...(manifest.seeds||[]),...(manifest.assets||[])])assert.ok(!/^\/app\/lud(?:\/|-)/i.test(value),`Standard offline package explicitly includes standalone asset ${value}`);

console.log(JSON.stringify({
  ok:true,
  contract:'standard-mode-isolation-v1',
  standardRuntimeOwnsAlternateMode:false,
  standardWorkerImportsAlternateWorker:false,
  standardInstallerLinksAlternateMode:false,
  standardOfflinePackageExcludesAlternateAssets:true,
  modelRuntimeMutable:true
},null,2));
