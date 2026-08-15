import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const sources=Object.fromEntries(await Promise.all(Object.entries({
  gateway:'public/app/settings-gateway-v317.js',
  controller:'public/app/model-settings-controller-v173.js',
  unified:'public/app/unified-ai-settings-v175.js',
  model:'public/app/model-settings-v133.js',
  visual:'public/app/visual-model-settings-v132.js',
  language:'public/app/language-settings-v1.js',
  parity:'public/app/settings-parity-v295.js',
  delegation:'public/app/settings-delegation-v175.js',
  bindGuard:'public/app/ai-settings-bind-guard-v230.js',
  deviceRepair:'public/app/ai-settings-device-repair-v229.js',
  lifecycle:'public/app/document-lifecycle-v221.js',
  codeCache:'public/service-worker-code-coherence-v288.js',
  localAICache:'public/service-worker-local-ai-coherence-v307.js',
  criticalCache:'public/service-worker-critical-v199.js'
}).map(async([key,path])=>[key,await read(path)])));

for(const source of Object.values(sources))new Function(source);
assert.match(sources.gateway,/globalThis\.CivweaveSettingsV320=api/);
assert.match(sources.gateway,/inputOwner:true,presentationOwner:true,credentialOwner:true/);
assert.match(sources.gateway,/singleMenu:true/);
assert.match(sources.gateway,/singleLauncherListener:true/);
assert.equal((sources.gateway.match(/document\.addEventListener\('click'/g)||[]).length,1,'Canonical Settings must have exactly one document click owner.');
assert.match(sources.gateway,/data-cw-language-settings="v320"/);
assert.match(sources.gateway,/data-settings-tab-panel="local-models"/);

for(const key of ['controller','unified','model','visual','language','parity','delegation','bindGuard','deviceRepair']){
  assert.match(sources[key],/(compatibilityFacade:true|retired:true)/,`${key} is not visibly retired/facade-only.`);
  assert.doesNotMatch(sources[key],/document\.addEventListener\('click'/,`${key} can still become a Settings click owner.`);
  assert.doesNotMatch(sources[key],/showModal\(|document\.createElement\(['"]dialog['"]\)/,`${key} can still create a competing Settings dialog.`);
}
assert.doesNotMatch(sources.controller,/globalThis\.CivweaveUnifiedAISettingsV175\s*=/,'Retired controller still republishes the old unified Settings authority.');
assert.doesNotMatch(sources.unified,/globalThis\.CivweaveUnifiedAISettingsV175\s*=/,'Retired unified settings module still publishes itself as authority.');
assert.match(sources.lifecycle,/serviceRole:'downloaded-model-settings-content'/);
assert.match(sources.lifecycle,/inputOwnership:false/);
assert.match(sources.lifecycle,/presentationOwnership:false/);
assert.match(sources.lifecycle,/settingsRootCreation:false/);
for(const key of ['codeCache','localAICache','criticalCache'])assert.ok(sources[key].includes("'/app/settings-gateway-v317.js'"),`${key} does not pin the one Settings owner for offline use.`);

console.log(JSON.stringify({ok:true,revision:'final-settings-retirement-v320',settingsAuthority:'CivweaveSettingsV320',oneInputOwner:true,onePresentationOwner:true,oneCredentialOwner:true,legacySettingsAuthorities:false,lazyLocalModelContentOnly:true},null,2));
