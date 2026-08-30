import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const fastPath='public/app/local-ai/gemma4-litert-fast-extension-v1.js';
const controllerPath='public/app/model-settings-controller-v173.js';
const fast=readFileSync(fastPath,'utf8');
const controller=readFileSync(controllerPath,'utf8');
new vm.Script(fast,{filename:fastPath});
new vm.Script(controller,{filename:controllerPath});

assert.match(fast,/function directDownloadUrl\(model\)/,'LiteRT download UI must build a direct browser URL before any async handoff');
assert.match(fast,/data-litert-fast-browser-link=/,'LiteRT model rows must expose a real browser-download anchor');
assert.match(fast,/href=\"\$\{esc\(direct\)\}\" download=\"\$\{esc\(def\.artifact\)\}\"/,'LiteRT download anchor must carry href + download on the actual user-clicked element');
assert.match(fast,/data-litert-fast-import-input=/,'LiteRT model rows must expose a user-gesture file input for import');
assert.match(fast,/current\.importFiles\(PREMIER,\[\.\.\.files\]/,'selected browser files must import without a delayed synthetic file-picker click');
assert.match(fast,/directBrowserUserGesture:true/,'LiteRT extension must advertise direct browser user-gesture ownership');
assert.match(fast,/directFileImport:true/,'LiteRT extension must advertise direct file-input import ownership');
assert.doesNotMatch(fast,/<button[^>]+data-litert-fast-download=/,'the visible LiteRT download control must not regress to an async button handoff');
assert.doesNotMatch(fast,/target\.textContent='Opening browser download…'/,'the visible LiteRT path must not wait in the pre-download opening state');

assert.match(controller,/gemma4PassivePreload:false/,'Settings must keep Gemma passive on open');
assert.match(controller,/providerRuntimeOnOpen:false/,'Settings must keep provider/local runtime off on open');
assert.doesNotMatch(controller,/\nensureGemma4Pack\(\);/,'Settings controller must not reintroduce passive Gemma hydration');
assert.doesNotMatch(controller,/pageshow[^\n]*ensureGemma4Pack/,'Settings pageshow must not reintroduce passive Gemma hydration');

console.log('PASS Gemma 4 LiteRT downloads use real user-clicked browser anchors, imports use a real file input, and the working passive Settings boundary remains unchanged.');
