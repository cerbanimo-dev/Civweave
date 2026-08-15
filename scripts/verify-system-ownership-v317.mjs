import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [registryText,gateway,controller,campusHtml,campusRuntime,shell,anarchadia]=await Promise.all([
  'config/system-ownership.json',
  'public/app/settings-gateway-v317.js',
  'public/app/model-settings-controller-v173.js',
  'public/app/working-campus-v156.html',
  'public/app/working-campus-v156.js',
  'public/app/family-shell-v104.js',
  'public/app/anarchadia-runtime-stability-v159.js'
].map(read));

const registry=JSON.parse(registryText);
const settings=registry.systems.settings;
for(const [source,label] of [[gateway,'gateway'],[controller,'controller'],[campusRuntime,'campus runtime'],[shell,'family shell'],[anarchadia,'anarchadia stability']])assert.doesNotThrow(()=>new Function(source),`${label} does not compile.`);

assert.equal(registry.policy,'extend-existing-owner-never-add-parallel-owner');
assert.equal(settings.inputOwner,'public/app/settings-gateway-v317.js');
assert.equal(settings.presentationOwner,'public/app/model-settings-controller-v173.js');
assert.equal(settings.managementSubscriber,'public/app/settings-gateway-v317.js');
assert.equal(settings.credentialOwner,'public/app/model-settings-controller-v173.js');
assert.equal(settings.canonicalControl,'[data-open-unified-ai-settings]');
assert.deepEqual(settings.allowedInputListenerFiles,['public/app/settings-gateway-v317.js']);

assert.match(gateway,/const SELECTOR='\[data-open-unified-ai-settings\]'/);
assert.equal((gateway.match(/document\.addEventListener\('click'/g)||[]).length,1);
assert.match(gateway,/document\.addEventListener\('click',onClick,true\)/);
assert.match(gateway,/launchWork:'none'/);
assert.match(gateway,/generativeRuntimeOnOpen:false/);
assert.doesNotMatch(gateway,/bootstrap-v266|runtime-v266|document-lifecycle-v221/);

assert.match(controller,/activationRequired:true/);
assert.match(controller,/quiescenceAfterPaint:true/);
assert.match(campusHtml,/model-settings-controller-v173\.js\?activate=1/);
assert.match(campusHtml,/settings-gateway-v317\.js/);
assert.doesNotMatch(campusHtml,/working-campus-return-guard-v425|document-lifecycle-v221|install-boundary-v146/);
assert.doesNotMatch(campusRuntime,/Function\s*\(|working-campus-v156\.part\d|fetchPart|repairPersistedCampusState/);
assert.match(campusRuntime,/generativeStart:'submit-only'/);
assert.doesNotMatch(campusRuntime,/\$\('#settings-button'\)\.addEventListener\('click'/);
assert.doesNotMatch(campusRuntime,/\$\('#model-chip'\)\.addEventListener\('click'/);

for(const source of [shell,anarchadia])assert.doesNotMatch(source,/addEventListener\('click'[^\n]*(settings|Settings|data-open-unified-ai-settings)/i);
assert.match(shell,/data-open-unified-ai-settings/);
assert.match(anarchadia,/settingsInputOwnership:false/);

console.log(JSON.stringify({
  ok:true,
  schema:registry.schema,
  policy:registry.policy,
  settings:{
    inputOwner:settings.inputOwner,
    presentationOwner:settings.presentationOwner,
    managementSubscriber:settings.managementSubscriber,
    credentialOwner:settings.credentialOwner,
    oneInputListener:true,
    workingCampusStaticPresentation:true,
    inferenceDormantOnOpen:true
  }
},null,2));
