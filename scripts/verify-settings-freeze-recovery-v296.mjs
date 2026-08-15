import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [gateway,controller,runtime,chatRuntime,chatOwner,campusHtml,campusRuntime]=await Promise.all([
  'public/app/settings-gateway-v317.js',
  'public/app/model-settings-controller-v173.js',
  'public/app/local-ai/runtime-v266.js',
  'public/app/local-chat-runtime-v295.js',
  'public/app/local-chat-owner-v295.js',
  'public/app/working-campus-v156.html',
  'public/app/working-campus-v156.js'
].map(read));

for(const source of [gateway,controller,runtime,chatRuntime,chatOwner,campusRuntime])new Function(source);

assert.match(gateway,/launchWork:'none'/);
assert.match(gateway,/generativeRuntimeOnOpen:false/);
assert.match(gateway,/workingCampusStaticController:true/);
assert.match(gateway,/document\.addEventListener\('click',onClick,true\)/);
assert.equal((gateway.match(/document\.addEventListener\('click'/g)||[]).length,1,'Settings must have exactly one DOM click owner.');
assert.doesNotMatch(gateway,/bootstrap-v266|runtime-v266|runtime-bridge-v266|test-pulse-v269|fast-interactive-runtime|document-lifecycle-v221/,'Settings gateway must not load model runtime or lifecycle repair code.');

assert.match(controller,/activationRequired:true/);
assert.match(controller,/quiescenceAfterPaint:true/);
assert.match(campusHtml,/model-settings-controller-v173\.js\?activate=1/,'Working Campus must preload the inert Settings presentation controller rather than inject it on Settings open.');
assert.match(campusHtml,/language-settings-v1\.js/);
assert.match(campusHtml,/settings-gateway-v317\.js/);
assert.doesNotMatch(campusHtml,/document-lifecycle-v221|working-campus-return-guard-v425|install-boundary-v146\.js/,'Working Campus HTML regained obsolete startup layers.');

assert.doesNotMatch(campusRuntime,/Function\s*\(|working-campus-v156\.part\d|fetchPart|repairPersistedCampusState|location\.reload\(\)/,'Working Campus runtime regained fragment evaluation, repair redirects, or reload-based planning.');
assert.match(campusRuntime,/async function send\(/);
const submitIndex=campusRuntime.indexOf('async function send(');
const localCallIndex=campusRuntime.indexOf('await ensureLocal();',submitIndex);
assert.ok(localCallIndex>submitIndex,'Downloaded local AI must start only from explicit message submission.');

assert.match(runtime,/generationEpoch/);
assert.match(chatRuntime,/shutdown\?\.\(\{reason:'chat-stage-stalled'\}\)/);
assert.match(chatOwner,/generativePrewarmDisabled:true/);
assert.match(chatOwner,/generativeStartsOnSubmit:true/);
assert.doesNotMatch(chatOwner,/\.prewarm\s*\(/);

console.log(JSON.stringify({
  ok:true,
  revision:'settings-static-interface-v1',
  singleSettingsInputOwner:true,
  workingCampusStaticSettingsGraph:true,
  settingsOpenModelWork:false,
  generativePrewarmOnChat:false,
  generativeStartsOnSubmit:true,
  campusRuntime:'static-no-fragment-eval'
},null,2));
