import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [gateway,lifecycle,panel,localRoute,boundary,manager,policy,serverAI,gemini,livingActions,workingCampus,directEntry,parentLocalRoute,freshLocalRoute]=await Promise.all([
  'public/app/settings-gateway-v317.js',
  'public/app/document-lifecycle-v221.js',
  'public/app/local-ai/settings-panel-v267.js',
  'public/app/settings-local-route-v323.js',
  'public/app/install-boundary-v146.js',
  'public/app/local-ai/download-manager-v267.js',
  'public/app/local-ai/download-policy-v278.js',
  'public/app/server-ai-settings-v301.js',
  'public/app/gemini-task-tier-router-v213.js',
  'public/app/cabinets/living-school/living-school-cleanroom-actions-v218.mjs',
  'public/app/working-campus-v440.html',
  'public/app/settings-direct-entry-v339.js',
  'public/app/settings-local-route-v325.js',
  'public/app/settings-local-route-v327.js'
].map(read));
for(const source of [gateway,lifecycle,panel,localRoute,boundary,manager,policy,serverAI,gemini,directEntry,parentLocalRoute,freshLocalRoute])new Function(source);

const openBlock=gateway.slice(gateway.indexOf('function open(launcher)'),gateway.indexOf('function ensure()'));
assert.doesNotMatch(openBlock,/ensureManagement\(/,'Opening Settings must not load downloaded-model management automatically.');
assert.doesNotMatch(openBlock,/requestInferenceQuiescence|local-inference-cancel-requested/,'Opening Settings must not tear down inference automatically.');
assert.doesNotMatch(gateway,/data-load-local-model-management/,'The old freeze-triggering management button returned.');
assert.match(gateway,/data-settings-tabs="1"/);
assert.match(gateway,/data-settings-tab="general"/);
assert.match(gateway,/data-settings-tab="local-models"/);
assert.match(gateway,/data-settings-tab="membership"/);
assert.match(gateway,/const GEMINI_SMALL='gemini-3\.1-flash-lite'/);
assert.match(gateway,/const GEMINI_COMPLEX='gemini-3\.7-flash'/);
assert.match(gateway,/geminiRouting:GEMINI_ROUTING/);
assert.match(gateway,/if\(name==='local-models'\)/);
const localTabBlock=gateway.slice(gateway.indexOf("if(name==='local-models')"),gateway.indexOf("if(name==='membership')"));
assert.match(localTabBlock,/ensureManagement\(layer\)/);
assert.match(localTabBlock,/afterPaint\(\(\)=>void ensureManagement\(layer\)\)/,'Local Models view work must start only after its tab paints.');
assert.doesNotMatch(localTabBlock,/requestInferenceQuiescence|local-inference-cancel-requested|requestAdapter|new Worker|\.generate\(/);

// The v339 recovery shim used a subtree MutationObserver that rewrote the visible
// Settings header on every inspection. Rewriting textContent generated another
// childList mutation, so opening Settings could starve the main thread before a
// paint. Fast Boot keeps only the canonical Settings gateway on the page; the
// gateway lazily loads the small v325 recovery bridge after explicit tab use,
// and that bridge retains the fresh v327 implementation as its validated fallback.
assert.doesNotMatch(workingCampus,/settings-direct-entry-v339\.js/,'Working Campus must not load the recursive Local Models recovery shim.');
assert.match(workingCampus,/settings-gateway-v317\.js/,'Working Campus must retain the canonical Settings gateway.');
assert.doesNotMatch(workingCampus,/<script[^>]+settings-local-route-v32[57]\.js/,'Fast Boot must not eagerly load a Local Models route.');
assert.match(gateway,/const SETTINGS_LOCAL_ROUTE='\/app\/settings-local-route-v325\.js/,'Settings gateway must retain the small self-loading Local Models recovery route.');
assert.match(gateway,/localModelRouteSelfLoading:true/,'Settings gateway must self-load the Local Models route.');
assert.match(parentLocalRoute,/const FULL_ROUTE='\/app\/settings-local-route-v327\.js/,'The parent Local Models bridge must retain the fresh v327 implementation fallback.');
assert.match(parentLocalRoute,/staleWorkerSourceRecovery:true/,'The parent Local Models bridge must retain stale-worker source recovery.');
assert.doesNotMatch(directEntry,/new MutationObserver/,'Local Models fallback must not observe and rewrite the Settings subtree.');
assert.doesNotMatch(directEntry,/const watchdog\s*=\s*setInterval/,'Local Models fallback must not run a presentation watchdog.');
assert.match(directEntry,/mutationWatch:false/);
assert.match(directEntry,/watchdog:false/);
assert.match(directEntry,/eventDriven:true/);
assert.match(directEntry,/canonicalRouteFirst:true/);
assert.match(freshLocalRoute,/renderLocalModels/,'The fresh Local Models route must own direct saved-state rendering.');

assert.match(lifecycle,/document-lifecycle-v323-local-model-view-service/);
assert.match(lifecycle,/document-lifecycle-v323-view-only-actions-lazy/);
assert.match(lifecycle,/viewOnlyOnTab:true/);
assert.match(lifecycle,/actionModulesOnDemand:true/);
const viewList=lifecycle.match(/const LOCAL_AI_VIEW_FILES=\[([\s\S]*?)\n\];/)?.[1]||'';
for(const required of ['model-registry-v266.js','settings-panel-v267.js'])assert.ok(viewList.includes(required),`Local-model view lost ${required}`);
for(const forbidden of ['download-manager-v267.js','download-policy-v278.js','metadata-repair-v276.js','primary-route-v283.js','hardware-tier-ui-v278.js','runtime-v266','bootstrap-v266'])assert.ok(!viewList.includes(forbidden),`Opening Local models still loads action/runtime module ${forbidden}`);
assert.doesNotMatch(lifecycle,/HardwareTierUI|\.decorate\(/,'Local-model view lifecycle must not run hardware decoration.');
assert.doesNotMatch(lifecycle,/function revive\(\)[\s\S]*scheduleSettingsManagement\(layer\)/,'BFCache restore must not silently activate local-model view work.');

assert.match(panel,/openPath:'saved-state-view-v323'/);
assert.match(panel,/snapshotOnlyView:true/);
assert.match(panel,/actionModulesOnDemand:true/);
assert.match(panel,/managerLoadedOnView:false/);
assert.match(panel,/cacheReadOnView:false/);
assert.match(panel,/serviceWorkerReadyOnView:false/);
assert.match(panel,/hardwareProbeOnView:false/);
const renderBlock=panel.slice(panel.indexOf('function render(panel)'),panel.indexOf('function show('));
assert.doesNotMatch(renderBlock,/\.status\(|caches\.|serviceWorker\.ready|requestAdapter|ensureActionModules/,'Rendering Local models must use saved state only.');
const actionFiles=panel.match(/const ACTION_FILES=\[([\s\S]*?)\n\];/)?.[1]||'';
for(const required of ['download-manager-v267.js','download-policy-v278.js','metadata-repair-v276.js'])assert.ok(actionFiles.includes(required),`Explicit model actions lost ${required}`);
assert.match(panel,/await afterPaint\(\);await ensureActionModules\(\)/,'Explicit model action must paint feedback before loading its action stack.');

assert.match(manager,/autoSyncOnLoad:false/);
assert.match(manager,/explicitSyncOnly:true/);
assert.doesNotMatch(manager,/queueMicrotask\(\(\)=>sync\(\)/);
assert.match(policy,/autoSyncOnLoad:false/);
assert.doesNotMatch(policy,/queueMicrotask\(\(\)=>sync\(\)/);

assert.match(localRoute,/const ROUTE='downloaded-local'/);
assert.match(localRoute,/option\.textContent='Downloaded local AI'/);
assert.match(localRoute,/managerDependency:false/);
assert.match(localRoute,/runtimeDependency:false/);
assert.match(localRoute,/cacheDependency:false/);
assert.match(localRoute,/event\.preventDefault\(\);event\.stopImmediatePropagation\(\)/,'Downloaded local route must preserve the configured fallback instead of overwriting provider settings.');
assert.match(boundary,/const SETTINGS_LOCAL_ROUTE='\/app\/settings-local-route-v323\.js'/);
assert.match(boundary,/SYSTEM_EXPERIENCE_SCRIPTS=\[SETTINGS_GATEWAY,SETTINGS_LOCAL_ROUTE,/,'All five systems must load the same lightweight local-route enhancer after the canonical Settings owner.');

assert.match(serverAI,/if\(form\.dataset\.settingsTabs==='1'\)return form/);
assert.match(gemini,/canonicalSettingsPresentation:true/);
assert.doesNotMatch(livingActions,/['"]open-ai-settings['"]/);

console.log(JSON.stringify({
  ok:true,
  contract:'settings-local-model-v342-fast-boot-v1',
  canonicalTabs:true,
  workingCampusSettingsGatewayOnly:true,
  localModelsRouteSelfLoading:'v325-parent-to-v327-fallback',
  recursiveSettingsObserver:false,
  localRouteVisibleWithoutManager:true,
  localModelsViewOnlyOnTab:true,
  localModelActionModulesOnDemand:true,
  cacheReadOnView:false,
  serviceWorkerReadyOnView:false,
  hardwareProbeOnView:false,
  geminiPresets:['gemini-3.1-flash-lite','gemini-3.7-flash'],
  livingSchoolSpecialSettings:false
},null,2));