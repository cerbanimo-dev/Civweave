import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const bridgePath='public/app/local-ai/browser-pack-download-v1.js';
const workerPath='public/app/local-ai/browser-pack-import-worker-v1.js';
const controllerPath='public/app/model-settings-controller-v173.js';
const bridge=readFileSync(bridgePath,'utf8');
const worker=readFileSync(workerPath,'utf8');
const controller=readFileSync(controllerPath,'utf8');

new vm.Script(bridge,{filename:bridgePath});
new vm.Script(worker,{filename:workerPath});
new vm.Script(controller,{filename:controllerPath});

assert.match(bridge,/1\.3\.1-browser-pack-download-v1-worker-import/,'browser-pack bridge must carry the worker-import revision');
assert.match(bridge,/new Worker\(IMPORT_WORKER_SRC/,'large browser files must be delegated to a dedicated worker');
assert.match(bridge,/total>=LARGE_BYTES&&typeof Worker==='function'/,'only large browser-pack files should take the worker path');
assert.match(bridge,/worker\.postMessage\(\{type:'CIVWEAVE_BROWSER_PACK_IMPORT_FILE_V1'/,'the selected File must be handed to the worker without reading it on the UI thread');
assert.match(bridge,/workerImport:true/,'the bridge must advertise the non-blocking import contract');
assert.match(worker,/file\.stream\(\)\.getReader\(\)/,'the worker must stream the browser file instead of materializing it in page memory');
assert.match(worker,/await cache\.put\(url,new Response\(stream/,'the worker must own the multi-gigabyte Cache Storage write');
assert.match(worker,/postMessage\(\{type,version:VERSION/,'worker progress must be reported back to the page');

assert.match(controller,/gemma4PassivePreload:false/,'Settings must remain passive on open');
assert.match(controller,/providerRuntimeOnOpen:false/,'Settings must not restart local runtimes on open');
assert.doesNotMatch(controller,/\nensureGemma4Pack\(\);/,'Settings must not regain passive Gemma hydration');

console.log('PASS: multi-gigabyte browser-pack imports stream through a dedicated worker while the working passive Settings boundary remains intact.');
