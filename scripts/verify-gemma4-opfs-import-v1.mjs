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
assert.match(settings,/1\.0\.1-gemma4-opfs-storage-v1-stream-transfer/,'Settings must require the stream-transfer OPFS overlay.');

assert.match(overlay,/const OPFS_ROOT='civweave-models-v1'/);
assert.match(overlay,/gemma-4-E2B-it-web\.litertlm/);
assert.match(overlay,/gemma-4-E4B-it-web\.litertlm/);
assert.match(overlay,/new Worker\(WORKER_SRC/,'Large LiteRT import must use a dedicated worker.');
assert.match(overlay,/storageBackend:'opfs'/,'LiteRT files must be explicitly routed to OPFS.');
assert.match(overlay,/worker\.postMessage\(\{\.\.\.packet,sourceStream\},\[sourceStream\]\)/,'The page must transfer a ReadableStream instead of structured-cloning the multi-GB File.');
assert.match(overlay,/URL\.createObjectURL\(file\)/,'Browsers without transferable streams need an O(1) blob-URL fallback.');
assert.match(overlay,/worker\.postMessage\(\{\.\.\.packet,sourceUrl:objectUrl\}\)/,'Blob fallback must send only the URL string to the worker.');
assert.doesNotMatch(overlay,/worker\.postMessage\([^\n]*[,\s]file\s*[,}]/,'The large Gemma worker message must never contain the raw File object.');
assert.match(overlay,/if\(prop==='put'\)[\s\S]*uses origin-private file storage/,'Cache facade must reject new multi-gigabyte LiteRT Cache Storage puts.');
assert.match(overlay,/if\(prop==='match'\)[\s\S]*opfsResponse/,'Existing manager/runtime cache reads must resolve through the OPFS facade.');
assert.match(overlay,/if\(prop==='delete'\)[\s\S]*removeOpfs/,'Model removal must remove OPFS payloads.');

assert.match(worker,/const VERSION='2\.0\.2-browser-pack-import-worker-v2-opfs-stream-transfer'/);
assert.match(worker,/const CHUNK_BYTES=8\*1024\*1024/,'OPFS import must use bounded writes.');
assert.match(worker,/createSyncAccessHandle/,'Dedicated-worker OPFS path should use synchronous access handles when Chromium exposes them.');
assert.match(worker,/packet\.sourceStream/,'Worker must accept a transferred browser-file stream.');
assert.match(worker,/packet\.sourceUrl/,'Worker must accept the blob-URL fallback without receiving the File object.');
assert.match(worker,/subarray\(start,Math\.min\(value\.byteLength,start\+CHUNK_BYTES\)\)/,'Worker must cap every OPFS write to the configured chunk bound.');
const opfsBlock=worker.slice(worker.indexOf('async function writeOpfs'),worker.indexOf('async function writeCache'));
assert.doesNotMatch(opfsBlock,/caches\.open|cache\.put/,'OPFS import must never enter Cache Storage.');
assert.match(worker,/if\(packet\.storageBackend==='opfs'\)return writeOpfs\(packet\)/,'Only explicit OPFS records may take the OPFS path.');

console.log(JSON.stringify({ok:true,contract:'gemma4-opfs-import-v1',settingsPassive:true,largeLiteRTCachePut:false,rawFileWorkerClone:false,transferableStream:true,blobUrlFallback:true,opfsWorker:true,chunkBytes:8*1024*1024,legacyCacheReadFacade:true},null,2));