import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const json=async relative=>JSON.parse(await read(relative));

const forbidden=[
  '/assets/ai/','/local-ai/','/models/','/vendor/onnxruntime/',
  'family-ai-loader','guide-chat','assistant-runtime','server-ai','node-ai',
  'emergency-ai','browser-agent','minilm','smollm','gemini','model-settings','ai-settings'
];

test('installer exposes the canonical Luddite Mode download button',async()=>{
  const installer=await read('public/app/index.html');
  assert.match(installer,/>Download Luddite Mode<\/button>/);
  assert.match(installer,/id="luddite-install-progress"/);
  assert.match(installer,/luddite-installer-v1\.js/);
});

test('Luddite package is an explicit no-AI allowlist',async()=>{
  const manifest=await json('public/app/luddite-package-v1.json');
  assert.equal(manifest.schema,'civweave.luddite-package.v1');
  assert.equal(manifest.mode,'luddite');
  assert.equal(manifest.policy.recursiveDiscovery,false);
  assert.equal(manifest.policy.aiGeneration,false);
  assert.equal(manifest.policy.localModels,false);
  assert.equal(manifest.policy.remoteModels,false);
  assert.ok(Array.isArray(manifest.assets)&&manifest.assets.length>0);
  assert.ok(manifest.assets.includes('/app/shared/civweave-identity-sync.js'),'human validation signer must be packaged');
  for(const asset of manifest.assets){
    const lower=String(asset).toLowerCase();
    for(const fragment of forbidden)assert.equal(lower.includes(fragment),false,`${asset} contains forbidden ${fragment}`);
  }
});

test('Luddite campus does not import AI or model assets',async()=>{
  const html=(await read('public/app/luddite-campus-v1.html')).toLowerCase();
  const scriptSources=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match=>match[1]);
  assert.ok(scriptSources.length>0);
  assert.ok(scriptSources.includes('/app/shared/civweave-identity-sync.js'));
  for(const source of scriptSources)for(const fragment of forbidden)assert.equal(source.includes(fragment),false,`${source} contains forbidden ${fragment}`);
  assert.match(html,/ai generation off/);
  assert.match(html,/human-authored provenance/);
});

test('identity signer is WebCrypto-only and exposes no AI runtime dependency',async()=>{
  const source=(await read('public/app/shared/civweave-identity-sync.js')).toLowerCase();
  assert.match(source,/crypto\.subtle/);
  assert.match(source,/civweaveidentitysync/);
  for(const fragment of forbidden)assert.equal(source.includes(fragment),false,`identity signer contains forbidden ${fragment}`);
});

test('generation runtime stamps both result and structured output provenance',async()=>{
  const source=await read('public/app/fast-interactive-runtime-v192.js');
  assert.match(source,/schema:'civweave\.generation-provenance\.v1'/);
  assert.match(source,/schema:'civweave\.content-provenance\.v1'/);
  assert.match(source,/origin=generation\.aiGenerated\?'ai-generated'/);
  assert.match(source,/structuredOutputWithProvenance\(result\.outputJson,generation\)/);
  assert.match(source,/CIVWEAVE_LUDDITE_AI_DISABLED/);
});

test('cloud generation API labels AI provenance before returning artifacts',async()=>{
  const source=await read('cloudflare/node-cloud/src/server-ai-entry-v2.mjs');
  assert.match(source,/kind: 'ai-generated'/);
  assert.match(source,/aiGenerated: true/);
  assert.match(source,/origin: 'ai-generated'/);
  assert.match(source,/stampStructuredOutput\(parsedOutputJson, provenance\.artifact\)/);
  assert.match(source,/metadata: \{ generation: provenance\.generation \}/);
});

test('staging synthetic generation is explicitly non-AI provenance',async()=>{
  const source=await read('functions/api/ai/node/generate.ts');
  assert.match(source,/kind: "deterministic-generated"/);
  assert.match(source,/aiGenerated: false/);
  assert.match(source,/origin: "deterministic-generated"/);
});

test('provenance keeps AI origin immutable while human validation is additive',async()=>{
  const source=await read('public/app/content-provenance-v1.js');
  assert.match(source,/const lockedOrigin=existing\?\.origin&&existing\.origin!=='unknown'\?existing\.origin:incomingOrigin/);
  assert.match(source,/humanValidations/);
  assert.match(source,/function addHumanValidation/);
  assert.match(source,/function isLudditeVisible\(record\)\{return isHumanAuthored\(record\)\}/);
});

test('shared AI loader refuses Luddite Mode',async()=>{
  const source=await read('public/app/family-ai-loader-v105.js');
  assert.match(source,/CIVWEAVE_LUDDITE_AI_DISABLED/);
  assert.match(source,/assertAIAllowed\('Guide and model generation'\)/);
  assert.match(source,/ludditeGuard:true/);
});

test('manual authoring produces explicit human provenance and human-only market filtering',async()=>{
  const source=await read('public/app/luddite-manual-authoring-v1.js');
  assert.match(source,/humanAuthored\(/);
  assert.match(source,/isLudditeVisible/);
  assert.match(source,/validatorType:'human'/);
  assert.match(source,/provenance:'human-review'/);
  assert.doesNotMatch(source,/\.generate\s*\(/);
});

test('system ownership declares provenance and Luddite authorities',async()=>{
  const ownership=await json('config/system-ownership.json');
  assert.equal(ownership.systems['content-provenance'].owner,'public/app/content-provenance-v1.js');
  assert.equal(ownership.systems['operating-mode'].owner,'public/app/luddite-mode-v1.js');
  assert.equal(ownership.systems['operating-mode'].manualAuthoringOwner,'public/app/luddite-manual-authoring-v1.js');
  assert.equal(ownership.systems['operating-mode'].packageManifest,'public/app/luddite-package-v1.json');
});

test('service worker includes the separate Luddite package lane',async()=>{
  const worker=await read('public/service-worker-v203.js');
  const builder=await read('scripts/build-service-worker-v211.mjs');
  assert.match(worker,/service-worker-luddite-package-v1\.js/);
  assert.match(builder,/service-worker-luddite-package-v1\.js/);
  assert.match(builder,/ludditePackage:'v1-explicit-allowlist'/);
});
