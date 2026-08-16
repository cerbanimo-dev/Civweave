import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const lifecycle=await readFile(new URL('../public/app/document-lifecycle-v221.js',import.meta.url),'utf8');
for(const token of [
  "const VERSION='document-lifecycle-v322-settings-tab-service'",
  "const REVISION='document-lifecycle-v322-explicit-local-model-tab'",
  "searchParams.get('activate')==='1'",
  'const LOCAL_AI_MANAGEMENT_FILES=',
  'function ensureLocalAISettingsManagement(',
  'function scheduleSettingsManagement(',
  'function stopOnPageHide(event){if(!event?.persisted)active=false}',
  "addEventListener('pagehide',stopOnPageHide)",
  "addEventListener('pageshow',revive)",
  "settingsOwner:'settings-v320'",
  "serviceRole:'downloaded-model-settings-content'",
  'inputOwnership:false',
  'presentationOwnership:false',
  'settingsRootCreation:false',
  'managementAfterPaint:true',
  'globalObserverPatch:false',
  'activationRequired:true',
  'explicitTabActivation:true',
  'bfCacheAutoManagement:false',
  "launchWork:'none'"
])assert.ok(lifecycle.includes(token),`Lifecycle local-AI contract lost: ${token}`);
assert.ok(!lifecycle.includes('warmVisibleManagement()'),'Local AI controls must not prewarm during lifecycle startup.');
assert.ok(!lifecycle.includes('new Worker('),'Settings lifecycle must not start inference workers.');
assert.ok(!lifecycle.includes('.generate('),'Settings lifecycle must not run inference.');
assert.ok(!/globalThis\.MutationObserver\s*=/.test(lifecycle),'Settings lifecycle must not replace MutationObserver globally.');
assert.ok(!lifecycle.includes("document.addEventListener('click'"),'Lifecycle must not intercept Settings input.');
const revive=lifecycle.slice(lifecycle.indexOf('function revive()'),lifecycle.indexOf("addEventListener('pagehide'"));
assert.doesNotMatch(revive,/scheduleSettingsManagement|ensureLocalAISettingsManagement/,'BFCache revival may restore lifecycle availability but may not open model management.');
new Function(lifecycle);
console.log(JSON.stringify({ok:true,revision:'realm-local-ai-visible-v322',bfcacheSafe:true,explicitTabActivation:true,visibleControlsOnDemand:true,managementAfterPaint:true,inferenceDormant:true,globalObserverUntouched:true,settingsAuthority:'CivweaveSettingsV320',managementServiceOnly:true},null,2));