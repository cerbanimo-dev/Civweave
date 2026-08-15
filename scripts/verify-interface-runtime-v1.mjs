import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [html,runtime,gateway,prepare,coherence,workerCore,ownership]=await Promise.all([
  'public/app/working-campus-v156.html',
  'public/app/working-campus-v156.js',
  'public/app/settings-gateway-v317.js',
  'scripts/prepare-start-v131.mjs',
  'scripts/sync-release-coherence-v220.mjs',
  'public/service-worker-core-v208.js',
  'config/system-ownership.json'
].map(read));

new Function(runtime);
new Function(gateway);
const registry=JSON.parse(ownership);

for(const forbidden of [
  'working-campus-return-guard-v425.js',
  'document-lifecycle-v221.js',
  'install-boundary-v146.js',
  'model-settings-controller-v173.js?v=',
  'working-campus-v156.part1.txt',
  'working-campus-planner-v199'
])assert.ok(!html.includes(forbidden),`Working Campus HTML reintroduced ${forbidden}.`);

for(const required of ['model-settings-controller-v173.js?activate=1','language-settings-v1.js','settings-gateway-v317.js','system-routes-v227.js','family-ai-loader-v105.js','working-campus-v156.js'])assert.ok(html.includes(required),`Working Campus HTML is missing ${required}.`);

for(const forbidden of ['Function(','working-campus-v156.part','fetchPart(','repairPersistedCampusState','working-campus-return-v425','location.reload()'])assert.ok(!runtime.includes(forbidden),`Static campus runtime reintroduced ${forbidden}.`);
assert.match(runtime,/architecture:'static-runtime-no-fragment-eval'/);
assert.match(runtime,/generativeStart:'submit-only'/);
assert.match(runtime,/function build\(/);
assert.match(runtime,/async function send\(/);

assert.doesNotMatch(gateway,/document-lifecycle-v221|bootstrap-v266|runtime-v266|runtime-bridge-v266/);
assert.match(gateway,/generativeRuntimeOnOpen:false/);

assert.doesNotMatch(prepare,/sync-release-version-assets|sync-release-coherence-v220|generate-prelive-metadata-v281/,'Process startup must not mutate release files, architecture, or prelive metadata.');
assert.doesNotMatch(coherence,/writeFile/,'Coherence check must validate, not mutate the checkout.');
assert.match(coherence,/retiredRecoveryLayersAbsent:true/);
assert.doesNotMatch(workerCore,/working-campus-return-guard-v425|document-lifecycle-v221/,'Service-worker shell must not cache retired interface repair layers.');

const settings=registry.systems.settings;
assert.equal(settings.inputOwner,'public/app/settings-gateway-v317.js');
assert.equal(settings.managementSubscriber,'public/app/settings-gateway-v317.js');
assert.ok(settings.activeRouteDependencies.includes('public/app/working-campus-v156.js'));
assert.ok(!JSON.stringify(settings).includes('working-campus-v156.part5.txt'));
assert.ok(!JSON.stringify(settings).includes('document-lifecycle-v221.js'));

console.log(JSON.stringify({
  ok:true,
  revision:'interface-runtime-static-v1',
  runtimeFragments:0,
  runtimeEval:false,
  runtimeRecoveryRedirects:false,
  settingsOwners:1,
  startupArchitectureMutation:false
},null,2));
