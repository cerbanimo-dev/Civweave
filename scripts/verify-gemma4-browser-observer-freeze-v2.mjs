import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(path,'utf8');
const settingsPath='public/app/model-settings-controller-v173.js';
const browserPath='public/app/local-ai/gemma4-browser-pack-coherence-v2.js';
const opfsPath='public/app/local-ai/gemma4-opfs-storage-v1.js';
const workerPath='public/app/local-ai/browser-pack-import-worker-v2.js';
const settings=read(settingsPath),browser=read(browserPath),opfs=read(opfsPath),worker=read(workerPath);
for(const [path,source] of [[settingsPath,settings],[browserPath,browser],[opfsPath,opfs],[workerPath,worker]])new vm.Script(source,{filename:path});

assert.match(settings,/gemma4PassivePreload:false/,'Settings must stay passive.');
assert.match(settings,/providerRuntimeOnOpen:false/,'Settings open must not start provider runtime.');
assert.doesNotMatch(settings,/^\s*ensureGemma4Pack\(\);\s*$/m,'Gemma action modules must not hydrate on Settings load.');
assert.match(settings,/GEMMA4_BROWSER_PACK_VERSION='1\.0\.2-gemma4-browser-pack-coherence-v2-event-driven'/,'Controller must require the observer-free browser handoff generation.');
assert.match(settings,/GEMMA4_BROWSER_PACK_SRC='\/app\/local-ai\/gemma4-browser-pack-coherence-v2\.js\?v=1\.0\.2-event-driven'/,'Controller must use a cache-distinct v2 browser handoff pathname.');

assert.match(browser,/VERSION='1\.0\.2-gemma4-browser-pack-coherence-v2-event-driven'/);
assert.doesNotMatch(browser,/new\s+MutationObserver|MutationObserver\s*\(/,'Gemma browser handoff must not observe and rewrite the Settings subtree.');
assert.match(browser,/eventDriven:true/,'Gemma browser handoff must declare event-driven refresh.');
assert.match(browser,/mutationObserver:false/,'Gemma browser handoff must explicitly retire the observer.');
assert.match(browser,/idempotentDomWrites:true/,'Gemma browser handoff must keep DOM writes idempotent.');
assert.match(browser,/function setText\(node,value\)/,'Text writes must be guarded.');
assert.match(browser,/if\(node\.textContent===next\)return false/,'Repeated equal text must not rewrite the DOM.');
assert.match(browser,/for\(const name of \['civweave:settings-opened'/,'State refresh must be driven by explicit Settings/model events.');
assert.match(browser,/addEventListener\('civweave:local-model-pack-installed'/,'Install completion must explicitly refresh state.');
assert.match(browser,/current\.pickAndImport\(PREMIER/,'Import action must remain wired.');
assert.match(browser,/event\.stopImmediatePropagation\(\)/,'Browser handoff must continue blocking the retired legacy action listener.');

assert.match(opfs,/opfsLargeModels:true/,'Gemma large payloads must remain OPFS-backed.');
assert.match(opfs,/rawFileWorkerClone:false/,'Raw multi-GB File worker clone must remain retired.');
assert.match(opfs,/transferableFileStream:true/,'Large import must keep transferable-stream handoff.');
assert.match(worker,/const CHUNK_BYTES=8\*1024\*1024/,'OPFS writes must remain bounded.');

console.log(JSON.stringify({ok:true,contract:'gemma4-browser-observer-freeze-v2',settingsPassive:true,eventDriven:true,mutationObserver:false,idempotentDomWrites:true,opfs:true,rawFileWorkerClone:false},null,2));
