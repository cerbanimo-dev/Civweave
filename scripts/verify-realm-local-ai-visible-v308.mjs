import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const lifecycle=await readFile(new URL('../public/app/document-lifecycle-v221.js',import.meta.url),'utf8');
for(const token of [
  "const VERSION='document-lifecycle-v317-management-only'",
  "const REVISION='document-lifecycle-v317-explicit-activation'",
  "searchParams.get('activate')==='1'",
  'const LOCAL_AI_MANAGEMENT_FILES=',
  'function ensureLocalAISettingsManagement()',
  'function scheduleSettingsManagement(',
  'function stopOnPageHide(event){if(!event?.persisted)active=false}',
  "addEventListener('pagehide',stopOnPageHide)",
  "addEventListener('pageshow',revive)",
  'if(layer&&!layer.hidden)scheduleSettingsManagement(layer)',
  "settingsEntryOwner:'settings-gateway-v317'",
  'inputOwnership:false',
  'managementAfterPaint:true',
  'globalObserverPatch:false',
  'activationRequired:true',
  "launchWork:'none'"
]) assert.ok(lifecycle.includes(token),`Lifecycle local-AI revival lost: ${token}`);
assert.ok(!lifecycle.includes('warmVisibleManagement()'),'Local AI controls must not prewarm during lifecycle startup.');
assert.ok(!lifecycle.includes('new Worker('),'Settings lifecycle must not start inference workers.');
assert.ok(!lifecycle.includes('.generate('),'Settings lifecycle must not run inference.');
assert.ok(!/globalThis\.MutationObserver\s*=/.test(lifecycle),'Settings lifecycle must not replace MutationObserver globally.');
assert.ok(!lifecycle.includes("document.addEventListener('click'"),'Lifecycle must not intercept Settings input.');
new Function(lifecycle);
console.log(JSON.stringify({ok:true,revision:'realm-local-ai-visible-v317',bfcacheSafe:true,explicitActivation:true,visibleControlsOnDemand:true,managementAfterPaint:true,inferenceDormant:true,globalObserverUntouched:true,settingsOwner:'settings-gateway-v317'},null,2));
