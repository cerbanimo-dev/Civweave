import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const json=async relative=>JSON.parse(await read(relative));
const forbiddenRuntime=['/assets/ai/','/local-ai/','/models/','/vendor/onnxruntime/','family-ai-loader','guide-chat','assistant-runtime','server-ai','node-ai','emergency-ai','browser-agent','minilm','smollm','gemini','model-settings','ai-settings'];
const forbiddenVisualMarkup=[/<img\b/i,/<picture\b/i,/<svg\b/i,/<canvas\b/i,/background-image\s*:/i,/\burl\s*\(/i];

function assertPlainSurface(html,label){for(const pattern of forbiddenVisualMarkup)assert.doesNotMatch(html,pattern,`${label} contains forbidden visual surface pattern ${pattern}`)}

test('standard installer links to a separate Lud download page and does not own the Lud download control',async()=>{
  const installer=await read('public/app/index.html');
  assert.match(installer,/href="\/app\/lud\/"/);
  assert.match(installer,/Download Lud Mode separately/);
  assert.doesNotMatch(installer,/id="download-lud-mode"/);
  assert.doesNotMatch(installer,/lud-installer-v1\.js/);
});

test('Lud download page is plain and opens the Cloudflare-canonical extensionless campus route',async()=>{
  const html=await read('public/app/lud/index.html');
  assert.match(html,/<h1>Lud Mode<\/h1>/);
  assert.match(html,/>Download Lud Mode<\/button>/);
  assert.match(html,/id="open-lud-mode"[^>]*href="\/app\/lud\/campus"[^>]*hidden/);
  assert.doesNotMatch(html,/href="\/app\/lud\/campus\.html"/);
  assert.match(html,/\[hidden\]\{display:none!important\}/);
  assert.match(html,/no generated visual assets/i);
  assertPlainSurface(html,'Lud download page');
});

test('Lud download controller forces a fresh dedicated worker and uses the canonical campus route',async()=>{
  const source=await read('public/app/lud-installer-v1.js');
  assert.match(source,/WORKER_URL='\/service-worker-lud-package-v1\.js\?v=/);
  assert.match(source,/WORKER_SCOPE='\/app\/lud\/'/);
  assert.match(source,/ENTRY_ROUTE='\/app\/lud\/campus'/);
  assert.match(source,/updateViaCache:'none'/);
  assert.match(source,/await reg\.update\(\)/);
  assert.match(source,/if\(reg\.installing\)/);
  assert.match(source,/new MessageChannel\(\)/);
  assert.match(source,/DOWNLOAD_IDLE_TIMEOUT_MS/);
  assert.match(source,/type:'SKIP_WAITING'/);
  assert.match(source,/location\.assign\(latest\?\.entryRoute\|\|ENTRY_ROUTE\)/);
  assert.doesNotMatch(source,/campus\.html/);
  assert.doesNotMatch(source,/service-worker-v203\.js/);
});

test('Lud campus is also plain and image-free',async()=>{
  const html=await read('public/app/lud/campus.html');
  assert.match(html,/<h1>Lud Mode<\/h1>/);
  assert.match(html,/AI generation off/);
  assertPlainSurface(html,'Lud campus');
});

test('Lud package is an explicit no-AI no-generated-visual allowlist with a clean entry route',async()=>{
  const manifest=await json('public/app/lud-package-v1.json');
  assert.equal(manifest.schema,'civweave.lud-package.v1');
  assert.equal(manifest.mode,'lud');
  assert.equal(manifest.label,'Lud Mode');
  assert.equal(manifest.entry,'/app/lud/campus.html');
  assert.equal(manifest.entryRoute,'/app/lud/campus');
  assert.equal(manifest.policy.recursiveDiscovery,false);
  assert.equal(manifest.policy.aiGeneration,false);
  assert.equal(manifest.policy.localModels,false);
  assert.equal(manifest.policy.remoteModels,false);
  assert.equal(manifest.policy.generatedVisualAssets,false);
  assert.ok(manifest.assets.includes('/app/shared/civweave-identity-sync.js'),'human validation signer must be packaged');
  for(const asset of manifest.assets){const lower=String(asset).toLowerCase();for(const fragment of [...forbiddenRuntime,'/images/','/logos/'])assert.equal(lower.includes(fragment),false,`${asset} contains forbidden ${fragment}`)}
});

test('dedicated Lud package worker normalizes redirected HTML and serves only its offline allowlist',async()=>{
  const source=await read('public/service-worker-lud-package-v1.js');
  assert.match(source,/LUD_ENTRY_ASSET='\/app\/lud\/campus\.html'/);
  assert.match(source,/LUD_ENTRY_ROUTE='\/app\/lud\/campus'/);
  assert.match(source,/LUD_STANDALONE=typeof OFFLINE_CACHE!=='string'/);
  assert.match(source,/LUD_CACHE_NAME=LUD_STANDALONE\?'civweave-lud-v1':OFFLINE_CACHE/);
  assert.match(source,/const ludKey=pathname=>new Request\(new URL\(pathname,self\.location\.origin\)\.href/);
  assert.match(source,/async function normalizeLudHtmlResponse/);
  assert.match(source,/headers\.delete\('content-length'\)/);
  assert.match(source,/headers\.delete\('content-encoding'\)/);
  assert.match(source,/headers\.delete\('location'\)/);
  assert.match(source,/new Response\(body,\{status:200,statusText:'OK',headers\}\)/);
  assert.match(source,/entryRoute:value\.entryRoute\|\|LUD_ENTRY_ROUTE/);
  assert.match(source,/event\.ports\?\.\[0\]\?\.postMessage/);
  assert.match(source,/type==='SKIP_WAITING'/);
  assert.match(source,/caches\.open\(LUD_CACHE_NAME\)/);
  assert.match(source,/if\(LUD_STANDALONE\)\{/);
  assert.match(source,/addEventListener\('fetch'/);
  assert.match(source,/policy\.assets\.has\(pathname\)/);
  assert.match(source,/cache\.match\(ludKey\(policy\.entry\)/);
  assert.match(source,/Lud Mode blocked a non-allowlisted request/);
  assert.match(source,/Lud Mode request failed safely/);
  assert.doesNotMatch(source,/clients\.claim\s*\(/);
});

test('identity signer is WebCrypto-only and exposes no AI runtime dependency',async()=>{
  const source=(await read('public/app/shared/civweave-identity-sync.js')).toLowerCase();
  assert.match(source,/crypto\.subtle/);
  assert.match(source,/civweaveidentitysync/);
  for(const fragment of forbiddenRuntime)assert.equal(source.includes(fragment),false,`identity signer contains forbidden ${fragment}`);
});

test('generation runtime stamps both result and structured output provenance',async()=>{
  const source=await read('public/app/fast-interactive-runtime-v192.js');
  assert.match(source,/schema:'civweave\.generation-provenance\.v1'/);
  assert.match(source,/schema:'civweave\.content-provenance\.v1'/);
  assert.match(source,/origin=generation\.aiGenerated\?'ai-generated'/);
  assert.match(source,/structuredOutputWithProvenance\(result\.outputJson,generation\)/);
  assert.match(source,/CIVWEAVE_LUD_AI_DISABLED/);
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
  assert.match(source,/lockedOrigin=existing\?\.origin&&existing\.origin!=='unknown'\?existing\.origin:incomingOrigin/);
  assert.match(source,/humanValidations/);
  assert.match(source,/function addHumanValidation/);
  assert.match(source,/function isLudVisible\(record\)\{return isHumanAuthored\(record\)\}/);
  assert.doesNotMatch(source,/isLudditeVisible/);
});

test('shared AI loader refuses Lud Mode',async()=>{
  const source=await read('public/app/family-ai-loader-v105.js');
  assert.match(source,/CIVWEAVE_LUD_AI_DISABLED/);
  assert.match(source,/assertAIAllowed\('Guide and model generation'\)/);
  assert.match(source,/ludGuard:true/);
});

test('manual authoring produces human provenance and human-only market filtering',async()=>{
  const source=await read('public/app/lud-manual-authoring-v1.js');
  assert.match(source,/humanAuthored\(/);
  assert.match(source,/isLudVisible/);
  assert.match(source,/validatorType:'human'/);
  assert.match(source,/provenance:'human-review'/);
  assert.doesNotMatch(source,/\.generate\s*\(/);
});

test('system ownership declares Lud authorities',async()=>{
  const ownership=await json('config/system-ownership.json');
  assert.equal(ownership.systems['content-provenance'].owner,'public/app/content-provenance-v1.js');
  assert.equal(ownership.systems['operating-mode'].owner,'public/app/lud-mode-v1.js');
  assert.equal(ownership.systems['operating-mode'].modeValue,'lud');
  assert.equal(ownership.systems['operating-mode'].manualAuthoringOwner,'public/app/lud-manual-authoring-v1.js');
  assert.equal(ownership.systems['operating-mode'].packageManifest,'public/app/lud-package-v1.json');
  assert.equal(ownership.systems['operating-mode'].downloadSurface,'public/app/lud/index.html');
});

test('service worker includes the separate Lud package lane',async()=>{
  const worker=await read('public/service-worker-v203.js'),builder=await read('scripts/build-service-worker-v211.mjs');
  assert.match(worker,/service-worker-lud-package-v1\.js/);
  assert.doesNotMatch(worker,/service-worker-luddite-package/);
  assert.match(builder,/service-worker-lud-package-v1\.js/);
  assert.match(builder,/ludPackage:'v1-explicit-allowlist-no-generated-visual-assets'/);
});

test('canonical Lud feature files contain no retired Luddite naming',async()=>{
  const files=['public/app/lud/index.html','public/app/lud/campus.html','public/app/lud-mode-v1.js','public/app/lud-installer-v1.js','public/app/lud-manual-authoring-v1.js','public/app/lud-package-v1.json','public/service-worker-lud-package-v1.js','docs/architecture/lud-mode-v1.md','config/system-ownership.json'];
  for(const file of files)assert.doesNotMatch(await read(file),/luddite/i,`${file} contains retired naming`);
});
