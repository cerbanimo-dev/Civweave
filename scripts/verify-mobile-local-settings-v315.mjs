import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [gateway,lifecycle,living,actions,boundary,mobile,release,recovery]=await Promise.all([
  read('public/app/settings-gateway-v317.js'),
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/cabinets/living-school/living-school-cleanroom-actions-v218.mjs'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/mobile-ai-hardening-v302.js'),
  read('public/app/release-version-v1.js'),
  read('public/app/settings-local-tab-recovery-v334.js')
]);
assert.match(gateway,/globalThis\.CivweaveSettingsV320=api/);
assert.match(gateway,/singleMenu:true/);
assert.match(gateway,/singleLauncherListener:true/);
assert.match(gateway,/settingsTabsCanonical:true/);
assert.match(gateway,/localModelManagementOnTab:true/);
assert.match(gateway,/data-settings-tab="local-models"/);
assert.match(gateway,/afterPaint\(\(\)=>void ensureManagement\(layer\)\)/);
const openBlock=gateway.slice(gateway.indexOf('function open(launcher)'),gateway.indexOf('function ensure()'));
assert.doesNotMatch(openBlock,/ensureManagement\(/,'Mobile Settings open must remain UI-only.');
assert.doesNotMatch(openBlock,/requestInferenceQuiescence|local-inference-cancel-requested/);
assert.match(lifecycle,/document-lifecycle-v322-explicit-local-model-tab/);
assert.match(lifecycle,/activationRequired:true/);
assert.match(lifecycle,/managementAfterPaint:true/);
assert.match(lifecycle,/explicitTabActivation:true/);
assert.match(lifecycle,/bfCacheAutoManagement:false/);
assert.match(lifecycle,/presentationOwnership:false/);
assert.doesNotMatch(living,/>Settings<\/button>/i);
assert.doesNotMatch(actions,/['"]open-ai-settings['"]|openSettings/,'Living School may not keep a cabinet-local Settings action.');
assert.match(living,/family-shell-v104\.js/);
assert.ok(boundary.indexOf('SETTINGS_GATEWAY')<boundary.indexOf('EXPERIENCE_ORCHESTRATOR'),'Settings gateway must be registered before general experience modules.');
assert.match(mobile,/mobileFullscreenChat:true/);
assert.doesNotMatch(mobile,/addEventListener\('click'/,'Mobile hardening must not own Settings input.');
assert.match(release,/SETTINGS_LOCAL_RECOVERY='\/app\/settings-local-tab-recovery-v334\.js'/,'Every canonical system must bootstrap the bounded Local Models recovery sidecar.');
assert.match(release,/ensureSettingsLocalRecovery\(\)/);
assert.match(recovery,/ROUTE_PATH='\/app\/settings-local-route-v325\.js'/,'Recovery must use the canonical saved-state-only Local Models route.');
assert.match(recovery,/MutationObserver/,'Recovery must not depend on requestAnimationFrame to notice the selected Local Models tab.');
assert.match(recovery,/animationFrameDependency:false/);
assert.match(recovery,/savedStateOnly:true/);
assert.match(recovery,/clearsSavedState:false/);
assert.match(recovery,/clearsModelFiles:false/);
assert.doesNotMatch(recovery,/localStorage\.clear|sessionStorage\.clear|caches\.delete|indexedDB\.deleteDatabase|CivweaveLocalModelRuntime/,'Local Models view recovery must never clear user state or touch inference/runtime storage.');
console.log(JSON.stringify({ok:true,revision:'mobile-local-settings-v334',systems:5,settingsOwner:'CivweaveSettingsV320',singleMenu:true,localModelsOnTabOnly:true,localModelsRecovery:'mutation-observer-plus-canonical-route',livingSchoolShared:true},null,2));
