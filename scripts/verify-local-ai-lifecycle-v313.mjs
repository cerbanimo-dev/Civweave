import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [bootstrap,settings,coherence]=await Promise.all([
  readFile('public/app/local-ai/bootstrap-v266.js','utf8'),
  readFile('public/app/local-ai/settings-panel-v267.js','utf8'),
  readFile('public/service-worker-local-ai-coherence-v307.js','utf8')
]);

for(const source of [bootstrap,settings,coherence])new Function(source);

assert.match(bootstrap,/const fastInteractiveReady=.*?runtime-spine-v271.*?register.*?diagnostics.*?serverAuto.*?localResultNeedsFailover/s,'bootstrap must accept the shipping fast runtime by capability contract');
assert.doesNotMatch(bootstrap,/CivweaveFastInteractiveV192\?\.version==='1\.0\.67-runtime-spine-v271'/,'bootstrap must not pin the retired exact runtime string');
assert.match(bootstrap,/fast-interactive-runtime-v192\.js\?v=1\.0\.124-v313-runtime-spine-contract/,'bootstrap must rotate the fast-runtime fetch epoch');

assert.match(settings,/let notice='',error=false,navigating=false/,'settings panel must track document navigation state');
assert.match(settings,/function writable\(\).*?document\.documentElement\?\.isConnected/s,'settings panel must verify the document is still writable');
assert.match(settings,/const head=document\.head;if\(!writable\(\)\|\|!head\)return false/,'style installation must tolerate a detached head');
assert.doesNotMatch(settings,/document\.head\.append\(/,'settings panel must not append through an unchecked document.head');
assert.doesNotMatch(settings,/document\.body\.append\(/,'download dock must not append through an unchecked document.body');
assert.match(settings,/addEventListener\('pagehide',\(\)=>\{navigating=true\}\)/,'pagehide must stop late DOM writes');
assert.match(settings,/addEventListener\('pageshow',\(\)=>\{navigating=false/,'BFCache restore must re-enable safe rendering');
assert.match(settings,/lifecycleSafeDom:true/,'settings API must advertise lifecycle-safe DOM ownership');

assert.match(coherence,/'\/app\/fast-interactive-runtime-v192\.js'/,'local-AI network-first coherence must own the fast runtime asset too');

console.log(JSON.stringify({
  ok:true,
  revision:'local-ai-lifecycle-v313',
  fastRuntimeCompatibility:'capability-based',
  fastRuntimeOwnedByLocalAICoherence:true,
  settingsDockLifecycleSafe:true,
  detachedHeadAppendBlocked:true,
  detachedBodyAppendBlocked:true
},null,2));
