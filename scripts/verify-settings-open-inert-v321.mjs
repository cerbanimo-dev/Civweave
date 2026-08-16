import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [gateway,lifecycle,manager,policy,panel,serverAI,livingActions]=await Promise.all([
  'public/app/settings-gateway-v317.js',
  'public/app/document-lifecycle-v221.js',
  'public/app/local-ai/download-manager-v267.js',
  'public/app/local-ai/download-policy-v278.js',
  'public/app/local-ai/settings-panel-v267.js',
  'public/app/server-ai-settings-v301.js',
  'public/app/cabinets/living-school/living-school-cleanroom-actions-v218.mjs'
].map(read));
for(const source of [gateway,lifecycle,manager,policy,panel,serverAI])new Function(source);

const openBlock=gateway.slice(gateway.indexOf('function open(launcher)'),gateway.indexOf('function ensure()'));
assert.doesNotMatch(openBlock,/ensureManagement\(/,'Opening Settings must not load downloaded-model management automatically.');
assert.doesNotMatch(openBlock,/local-inference-cancel-requested|requestInferenceQuiescence/,'Opening Settings must not tear down inference automatically.');
assert.doesNotMatch(gateway,/data-load-local-model-management/,'The freeze-triggering Manage downloaded local AI gate returned.');
assert.match(gateway,/data-settings-tabs="1"/,'Canonical Settings must own the three-tab layout.');
assert.match(gateway,/data-settings-tab="general"/);
assert.match(gateway,/data-settings-tab="local-models"/);
assert.match(gateway,/data-settings-tab="membership"/);
assert.match(gateway,/const GEMINI_SMALL='gemini-3\.1-flash-lite'/);
assert.match(gateway,/const GEMINI_COMPLEX='gemini-3\.7-flash'/);
assert.match(gateway,/geminiRouting:GEMINI_ROUTING/,'Gemini save path must persist the current task-tier preset pair.');
assert.match(gateway,/if\(name==='local-models'\)/,'Local model management must be activated by the Local models tab.');
const localTabBlock=gateway.slice(gateway.indexOf("if(name==='local-models')"),gateway.indexOf("if(name==='membership')"));
assert.match(localTabBlock,/ensureManagement\(layer\)/);
assert.doesNotMatch(localTabBlock,/requestInferenceQuiescence|local-inference-cancel-requested/,'Viewing Local models must not terminate inference or initialize a runtime.');
assert.match(gateway,/afterPaint\(\(\)=>void ensureSettingsUI\(layer\)\)/,'Shared lightweight Settings extensions must be attached consistently after paint.');

assert.match(lifecycle,/explicitTabActivation:true/);
assert.match(lifecycle,/bfCacheAutoManagement:false/);
assert.match(lifecycle,/snapshot-first-v322/);
assert.doesNotMatch(lifecycle,/function revive\(\)[\s\S]*scheduleSettingsManagement\(layer\)/,'BFCache restore must not silently activate model management.');

assert.match(manager,/autoSyncOnLoad:false/);
assert.match(manager,/explicitSyncOnly:true/);
assert.doesNotMatch(manager,/queueMicrotask\(\(\)=>sync\(\)/,'Download manager must not reconcile cache/background jobs on module load.');
assert.doesNotMatch(manager,/addEventListener\('pageshow',[^\n]*sync/,'Download manager must not reconcile jobs merely because a page returned.');
assert.match(policy,/autoSyncOnLoad:false/);
assert.doesNotMatch(policy,/queueMicrotask\(\(\)=>sync\(\)/,'Download policy must not reconcile jobs on module load.');
assert.match(panel,/backgroundSyncOnView:false/);
assert.match(panel,/snapshotOnlyView:true/);
assert.doesNotMatch(panel,/pageshow[^\n]*syncBackgroundJobs/,'Local model UI must render from saved state on BFCache restore.');

assert.match(serverAI,/if\(form\.dataset\.settingsTabs==='1'\)return form/,'Server/membership enhancer must reuse canonical tabs instead of creating a second layout.');
assert.doesNotMatch(livingActions,/['"]open-ai-settings['"]/,'Living School cabinet-era Settings action must not survive canonical consolidation.');

console.log(JSON.stringify({
  ok:true,
  contract:'settings-open-inert-v322',
  canonicalTabs:true,
  geminiPresets:['gemini-3.1-flash-lite','gemini-3.7-flash'],
  localModelsOnTabOnly:true,
  cacheSyncOnView:false,
  livingSchoolSpecialSettings:false
},null,2));