import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const lifecycle=await readFile(new URL('../public/app/document-lifecycle-v221.js',import.meta.url),'utf8');
for(const token of [
  "const BF_CACHE_REVISION='v308-bfcache-visible-local-ai'",
  "const SETTINGS_LOAD_POLICY_COMPAT='management-only-no-inference-bootstrap-v296'",
  'const LOCAL_AI_VISIBLE_FILES=',
  'function ensureVisibleManagement()',
  'warmVisibleManagement()',
  'function stopOnPageHide(event){if(event?.persisted)return;stop()}',
  "addEventListener('pagehide',stopOnPageHide)",
  "addEventListener('pageshow',reviveFromPageShow)",
  'if(layer&&!layer.hidden)void ensureLocalAISettingsManagement()',
  "visibleSettingsLoadPolicy:'visible-controls-preloaded-management-only-no-inference-v308'"
]) assert.ok(lifecycle.includes(token),`Lifecycle local-AI revival lost: ${token}`);
assert.ok(lifecycle.indexOf('warmVisibleManagement()')<lifecycle.lastIndexOf('startEntryRepair();'),'Visible local AI controls must begin warming during lifecycle startup.');
assert.ok(!lifecycle.includes('new Worker('),'Settings lifecycle must not start inference workers.');
assert.ok(!lifecycle.includes('.generate('),'Settings lifecycle must not run inference.');
new Function(lifecycle);
console.log(JSON.stringify({ok:true,revision:'realm-local-ai-visible-v308',bfcacheSafe:true,visibleControlsPreloaded:true,inferenceDormant:true,compatibilityMarkerPreserved:true},null,2));
