import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [orchestrator,parity,lifecycle,livingSchool,boundary]=await Promise.all([
  read('public/app/experience-orchestrator-v232.js'),
  read('public/app/settings-parity-v295.js'),
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/install-boundary-v146.js')
]);
for(const source of [orchestrator,parity,lifecycle])new Function(source);

assert.match(orchestrator,/experience-orchestrator-v316-settings-nonblocking-single-owner/);
assert.match(orchestrator,/experience-orchestrator-v315-mobile-settings-first-open/,'v315 compatibility marker must remain available');
assert.match(orchestrator,/globalThis\.addEventListener\('click',earlySettings,true\)/,'settings tap must have one window-level canonical owner');
assert.doesNotMatch(orchestrator,/document\.addEventListener\('click',earlySettings,true\)/);
const openIndependent=orchestrator.match(/async function openSettingsIndependent\(target\)\{([\s\S]*?)\}\nfunction earlyLocalSubmit/)?.[1]||'';
assert.ok(openIndependent);
assert.ok(openIndependent.indexOf('direct.open(target)')>=0);
assert.ok(openIndependent.indexOf('direct.open(target)')<openIndependent.indexOf('await ensureSettingsModule()'),'visible settings must open before lazy management code');
const finishOpen=orchestrator.match(/function finishSettingsOpen\(layer\)\{([\s\S]*?)\}\nasync function openSettingsIndependent/)?.[1]||'';
assert.match(finishOpen,/afterSettingsPaint/,'management must not run in the input event turn');
assert.match(finishOpen,/scheduleManagement/,'parity must own the post-paint management handoff');
assert.match(orchestrator,/settingsCaptureOwner:'window-only-v316'/);
assert.match(orchestrator,/legacySettingsCaptureOwner:'window-first-v315'/);
assert.match(orchestrator,/settingsManagementAfterPaint:true/);
assert.match(orchestrator,/#cw-ai-settings-cleanroom-v188\{z-index:2147483647!important\}/);

assert.match(parity,/1\.0\.127-settings-parity-v316-nonblocking-single-owner/);
assert.match(parity,/1\.0\.126-settings-parity-v315-mobile-first-open/,'v315 parity compatibility marker must remain available');
assert.match(parity,/function canonicalCaptureOwner\(/);
assert.match(parity,/function syncCaptureOwner\(/);
assert.match(parity,/if\(!canonicalCaptureOwner\(\)\)\{document\.addEventListener\('click',capture,true\)/,'document capture must be fallback-only');
assert.match(parity,/managementAfterPaint:true/);
assert.match(parity,/canonicalCaptureDelegated:true/);
const parityOpen=parity.match(/async function open\(launcher\)\{([\s\S]*?)\}\nfunction legacyBypass/)?.[1]||'';
assert.match(parityOpen,/scheduleManagement\(visible\)/);
assert.ok(parityOpen.indexOf('owner?.open?.(launcher)')<parityOpen.indexOf('scheduleManagement(layer)'));

assert.match(lifecycle,/document-lifecycle-v316-nonblocking-no-global-observer-patch/);
assert.doesNotMatch(lifecycle,/globalThis\.MutationObserver\s*=/,'settings lifecycle must never replace a browser primitive');
assert.doesNotMatch(lifecycle,/document\.addEventListener\('click',captureSettingsOpen,true\)/,'lifecycle must not compete for Settings taps');
assert.match(lifecycle,/function scheduleSettingsManagement\(/);
assert.match(lifecycle,/managementAfterPaint:true/);
assert.match(lifecycle,/globalObserverPatch:false/);

const settingsButton=livingSchool.match(/<button[^>]*>Settings<\/button>/)?.[0]||'';
assert.ok(settingsButton,'Living School Settings button is missing');
assert.match(settingsButton,/data-open-unified-ai-settings/);
assert.match(settingsButton,/data-living-school-settings-owner="canonical"/);
assert.doesNotMatch(settingsButton,/data-ls-action="open-ai-settings"/);
for(const route of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert.ok(boundary.includes(route),`mobile settings coverage lost ${route}`);
assert.ok(boundary.indexOf('MOBILE_AI_HARDENING')<boundary.indexOf('EXPERIENCE_ORCHESTRATOR'));

console.log(JSON.stringify({ok:true,revision:'mobile-local-settings-v316-nonblocking',systems:5,windowOnlySettingsCapture:true,visibleBeforeManagement:true,managementAfterPaint:true,noGlobalObserverPatch:true,mobileSettingsAboveChat:true},null,2));
