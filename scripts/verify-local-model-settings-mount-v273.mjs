import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [gateway,settings,bootstrap,controller,pulse,registry,downloadPolicy]=await Promise.all([
  'public/app/settings-gateway-v317.js',
  'public/app/local-ai/settings-panel-v267.js',
  'public/app/local-ai/bootstrap-v266.js',
  'public/app/model-settings-controller-v173.js',
  'public/app/local-ai/test-pulse-v269.js',
  'public/app/local-ai/model-registry-v266.js',
  'public/app/local-ai/download-policy-v278.js'
].map(read));

for(const source of [gateway,settings,bootstrap,controller,pulse,registry,downloadPolicy])new Function(source);

assert.match(gateway,/managementActivation:'explicit-secondary-action'/);
assert.match(gateway,/data-cw-local-ai-manage/);
assert.match(gateway,/button\.addEventListener\('click',async\(\)=>/);
assert.match(gateway,/async function ensureManagement\(layer\)/);
const openBody=gateway.slice(gateway.indexOf('async function open(launcher)'),gateway.indexOf('function onClick(event)'));
assert.doesNotMatch(openBody,/ensureManagement\(/,'Opening Settings must not start local model management.');
const managementList=gateway.match(/const MANAGEMENT=\[([\s\S]*?)\n\];/)?.[1]||'';
for(const token of ['model-registry-v266.js','download-manager-v267.js','settings-panel-v267.js','primary-route-v283.js'])assert.ok(managementList.includes(token),`Explicit management action lost ${token}.`);
for(const forbidden of ['runtime-v266','runtime-bridge-v266','bootstrap-v266','test-pulse-v269','fast-interactive-runtime'])assert.ok(!managementList.includes(forbidden),`Management action includes inference asset ${forbidden}.`);

for(const text of ['Downloaded local AI','Download','Resume','Use locally','Remove','Model window','Civweave working default','TTFT'])assert.ok(settings.toLowerCase().includes(text.toLowerCase()));
assert.match(settings,/truthfulCompletion:true/);
assert.match(settings,/cacheIntegrityOnDemand:true/);
assert.match(settings,/openPath:'snapshot-first-v287'/);

assert.match(pulse,/1\.0\.116-local-model-test-pulse-v303-mobile-safe/);
assert.match(pulse,/Test model/);
assert.match(bootstrap,/capability-contract-v307/);
assert.match(bootstrap,/backendFallback:true/);
assert.match(controller,/activationRequired:true/);
assert.match(controller,/eventOwnership:'none-input-owned-by-settings-gateway-v317'/);
for(const token of ["id:'gemma3-1b-it-q4f16'","id:'qwen3-0.6b-q4f16'",'function directUrl','function artifactRevision'])assert.ok(registry.includes(token));
assert.match(downloadPolicy,/largeExternalDataForeground:true/);

console.log(JSON.stringify({
  ok:true,
  revision:'local-model-settings-explicit-management-v1',
  canonicalSettingsMount:true,
  settingsEntryOwner:'settings-gateway-v317',
  workingCampusStaticPresentation:true,
  managementOnSettingsOpen:false,
  managementActivation:'explicit-secondary-action',
  inferenceDormantUntilExplicitInference:true
},null,2));
