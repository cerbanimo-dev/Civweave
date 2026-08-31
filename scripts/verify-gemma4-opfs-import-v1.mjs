import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(path,'utf8');
const settingsPath='public/app/model-settings-controller-v173.js';
const overlayPath='public/app/local-ai/gemma4-opfs-storage-v1.js';
const workerPath='public/app/local-ai/browser-pack-import-worker-v2.js';
const settings=read(settingsPath),overlay=read(overlayPath),worker=read(workerPath);
for(const [path,source] of [[settingsPath,settings],[overlayPath,overlay],[workerPath,worker]])new vm.Script(source,{filename:path});

assert.match(settings,/gemma4PassivePreload:false/,'Settings must remain passive while OPFS support is added.');
assert.match(settings,/providerRuntimeOnOpen:false/,'Opening Settings must not start provider/model runtime work.');
assert.doesNotMatch(settings,/^\s*ensureGemma4Pack\(\);\s*$/m,'Settings must not hydrate Gemma on page load.');
assert.doesNotMatch(settings,/addEventListener\(\s*['"]pageshow['"][^\n]*ensureGemma4Pack/,'Settings must not hydrate Gemma on pageshow.');
assert.match(settings,/loadScript\(GEMMA4_BROWSER_PACK_SRC[\s\S]*loadScript\(GEMMA4_OPFS_SRC/,'OPFS must load only inside the explicit Gemma action chain, after the browser handoff.');

assert.match(overlay,/const OPFS_ROOT='civweave-models-v1'/);
assert.match(overlay,/gemma-4-E2B-it-web\.litertlm/);
assert.match(overlay,/gemma-4-E4B-it-web\.litertlm/);
assert.match(overlay,/new Worker\(WORKER_SRC/,'Large LiteRT import must use a dedicated worker.');
assert.match(overlay,/storageBackend:'opfs'/,'LiteRT files must be explicitly routed to OPFS.');
assert.match(overlay,/if\(prop==='put'\)[\s\S]*uses origin-private file storage/,'Cache facade must reject new multi-gigabyte LiteRT Cache Storage puts.');
assert.match(overlay,/if\(prop==='match'\)[\s\S]*opfsResponse/,'Existing manager/runtime cache reads must resolve through the OPFS facade.');
assert.match(overlay,/if\(prop==='delete'\)[\s\S]*removeOpfs/,'Model removal must remove OPFS payloads.');

assert.match(worker,/const VERSION='2\.0\.1-browser-pack-import-worker-v2-opfs-chunked'/);
assert.match(worker,/const CHUNK_BYTES=8\*1024\*1024/,'OPFS import must use bounded chunks.');
assert.match(worker,/createSyncAccessHandle/,'Dedicated-worker OPFS path should use synchronous access handles when Chromium exposes them.');
assert.match(worker,/file\.slice\(start,end\)\.arrayBuffer\(\)/,'Worker must materialize only one bounded chunk at a time.');
const opfsBlock=worker.slice(worker.indexOf('async function writeOpfs'),worker.indexOf('async function writeCache'));
assert.doesNotMatch(opfsBlock,/caches\.open|cache\.put/,'OPFS import must never enter Cache Storage.');
assert.match(worker,/packet\.storageBackend==='opfs'\?writeOpfs\(packet,file\):writeCache\(packet,file\)/,'Only explicit OPFS records may take the OPFS path.');

console.log(JSON.stringify({ok:true,contract:'gemma4-opfs-import-v1',settingsPassive:true,largeLiteRTCachePut:false,opfsWorker:true,chunkBytes:8*1024*1024,legacyCacheReadFacade:true},null,2));
