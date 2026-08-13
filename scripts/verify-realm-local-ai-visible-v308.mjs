import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const lifecycle=await readFile(new URL('../public/app/document-lifecycle-v221.js',import.meta.url),'utf8');
for(const token of [
  "const BF_CACHE_REVISION='v308-bfcache-visible-local-ai'",
  "const SETTINGS_LOAD_POLICY_COMPAT='management-only-no-inference-bootstrap-v296'",
  'const LOCAL_AI_VISIBLE_FILES=',
  'function ensureVisibleManagement()',
  'function scheduleSettingsManagement(',
  'function stopOnPageHide(event){if(event?.persisted)return;stop()}',
  "addEventListener('pagehide',stopOnPageHide)",
  "addEventListener('pageshow',reviveFromPageShow)",
  'if(layer&&!layer.hidden)scheduleSettingsManagement(layer)',
  "visibleSettingsLoadPolicy:'on-open-after-paint-management-only-v316'",
  'managementAfterPaint:true',
  'bfCacheSafe:true'
]) assert.ok(lifecycle.includes(token),`Lifecycle local-AI revival lost: ${token}`);
assert.ok(!lifecycle.includes('warmVisibleManagement()'),'Local AI controls must not prewarm during lifecycle startup.');
assert.ok(!lifecycle.includes('new Worker('),'Settings lifecycle must not start inference workers.');
assert.ok(!lifecycle.includes('.generate('),'Settings lifecycle must not run inference.');
assert.ok(!/globalThis\.MutationObserver\s*=/.test(lifecycle),'Settings lifecycle must not replace MutationObserver globally.');
new Function(lifecycle);
console.log(JSON.stringify({ok:true,revision:'realm-local-ai-visible-v316',bfcacheSafe:true,visibleControlsOnDemand:true,managementAfterPaint:true,inferenceDormant:true,globalObserverUntouched:true},null,2));
