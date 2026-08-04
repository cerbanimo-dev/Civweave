import { access, readFile } from 'node:fs/promises';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const [pkg,index,app,domain,protocol,vault,mesh,systems,server,rails,manifest,worker,modelManifest] = await Promise.all([
  read('package.json'),read('public/index.html'),read('public/app.js'),read('public/core/domain.js'),read('public/core/protocol.js'),read('public/core/vault.js'),read('public/core/mesh.js'),read('public/core/systems.js'),read('server.mjs'),read('RAILS.md'),read('public/manifest.webmanifest'),read('public/service-worker.js'),read('public/app/models/all-minilm-l6-v2/model-manifest.json')
]);
const packageJson=JSON.parse(pkg),webManifest=JSON.parse(manifest),model=JSON.parse(modelManifest);
assert(packageJson.version==='0.1.0','baseline version mismatch');
assert(packageJson.dependencies.ws&&packageJson.dependencies.qrcode&&packageJson.dependencies['@huggingface/transformers'],'required local dependencies missing');
for(const system of ['commonweave','living-school','cerbanimo','fellowfare','anarchadia'])assert(app.includes(system),`UI missing ${system}`);
for(const token of ['buildIntention','buildCurriculum','buildProject','buildMarketDraft','validatePatch','rewardEvents'])assert(domain.includes(token),`domain missing ${token}`);
for(const token of ['learning.request','task.request','materials.request','trade.request','validation.request','validation.receipt'])assert(protocol.includes(token),`protocol missing ${token}`);
assert(vault.includes('AES-GCM')&&vault.includes('PBKDF2')&&!vault.includes('localStorage.setItem(VAULT_KEY, JSON.stringify(normalized))'),'AI vault is not encrypted');
assert(mesh.includes('RTCPeerConnection')&&mesh.includes('BarcodeDetector')&&mesh.includes('QRCode.toCanvas'),'friend QR or direct mesh missing');
for(const token of ['generateCurriculum','generateProject','publishListing','createImplementationRequest','applyImplementation'])assert(systems.includes(token),`system orchestration missing ${token}`);
assert(server.includes('COMMONWEAVE_REPO_WRITE')&&server.includes('APPLY ON LOCAL BRANCH')&&server.includes("git', ['worktree','add'")&&server.includes('WebSocketServer'),'safe Anarchadia or node relay missing');
assert(rails.includes('API secrets')&&rails.includes('pushes or merges'),'Rails contract incomplete');
assert(webManifest.start_url==='/#commonweave','PWA does not open Commonweave first');
assert(worker.includes('commonweave-clean-baseline-v1'),'service worker revision missing');
assert(model.id==='Xenova/all-MiniLM-L6-v2'&&model.behavior.tokenGeneration===false,'local semantic model contract is inaccurate');
for(const path of ['public/app/models/all-minilm-l6-v2/adapter.js','public/app/models/all-minilm-l6-v2/worker.js','scripts/ensure-minilm-model.mjs','scripts/stage-transformers-assets.mjs'])await access(new URL(`../${path}`, import.meta.url));
console.log(JSON.stringify({ok:true,systems:5,plainWeb:true,sharedVault:'AES-GCM',mesh:['WebRTC','WebSocket relay','QR invite'],localSemanticModel:model.id,anarchadia:'isolated branch only'},null,2));
