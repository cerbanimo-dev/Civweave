import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const direct = read('public/app/settings-local-models-direct-v325.js');
const placement = read('public/app/settings-local-progress-placement-v1.js');
const route = read('public/app/settings-local-route-v325.js');
const controller = read('public/app/model-settings-controller-v173.js');
const finalizer = read('public/app/local-ai/premier-phone-finalizer-v1.js');

assert.match(direct, /actionsStayInPlace:true/);
assert.match(direct, /fullRendererSwapOnAction:false/);
assert.match(direct, /data-local-pack-finish/);
assert.doesNotMatch(direct, /route\.renderLocalModels\(layer\)/);
assert.doesNotMatch(direct, /delegated\.click\(\)/);
assert.match(direct, /premierPhoneFinalizer:true/);

assert.match(placement, /#\$\{DIRECT_PANEL_ID\} \[data-pack-id=/);
assert.match(placement, /localPackFinish/);
assert.match(placement, /directCards:true/);

assert.match(route, /DIRECT_VERSION='1\.1\.0-settings-v325-direct-local-models-stable-actions'/);
assert.match(route, /1\.1\.0-stable-in-place-actions/);
assert.match(route, /STATUS_PLACEMENT_VERSION='1\.0\.1-settings-local-progress-card-owned-direct-aware'/);
assert.match(route, /stableInPlaceActions:true/);

assert.match(finalizer, /preservesExistingModels:true/);
assert.match(finalizer, /downloadsMissingSupportOnly:true/);
assert.match(finalizer, /requeuesVerifiedLargeModels:false/);
assert.match(finalizer, /individualDownloadsRecognized:true/);
assert.match(finalizer, /function repairReceipt\(models\)/);
assert.match(finalizer, /async function finish\(/);
assert.match(finalizer, /async function use\(/);

const finalizerLoad = controller.indexOf("loadScript(GEMMA4_FINALIZER_SRC");
const legacyActionsLoad = controller.indexOf("loadScript(GEMMA4_ACTIONS_SRC");
assert.ok(finalizerLoad >= 0, 'Premier Phone finalizer is not loaded by the model settings controller.');
assert.ok(legacyActionsLoad >= 0, 'Gemma phone actions are not loaded by the model settings controller.');
assert.ok(finalizerLoad < legacyActionsLoad, 'The idempotent finalizer must capture the action before the legacy reconciliation listener loads.');
assert.match(controller, /gemma4FinalizerPreservesExistingDownloads:true/);

console.log('Premier Phone finalizer regression contract: PASS');
