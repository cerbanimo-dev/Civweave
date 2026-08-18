import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const repair=await readFile('public/service-worker-chat-repair-v245.js','utf8');
const generated=await readFile('public/service-worker-v203.js','utf8');
const builder=await readFile('scripts/build-service-worker-v211.mjs','utf8');
const installedEntry=await readFile('public/app/installed-entry-v146.js','utf8');

const requiredLocalAIPaths=[
  '/app/ai-capability-broker-v268.js',
  '/app/fast-interactive-runtime-v192.js',
  '/app/local-ai/bootstrap-v266.js',
  '/app/local-ai/model-registry-v266.js',
  '/app/local-ai/download-manager-v267.js',
  '/app/local-ai/download-policy-v278.js',
  '/app/local-ai/metadata-repair-v276.js',
  '/app/local-ai/small-model-policy-v283.js',
  '/app/local-ai/runtime-v266.js',
  '/app/local-ai/runtime-bridge-v266.js',
  '/app/local-ai/settings-panel-v267.js',
  '/app/local-ai/primary-route-v283.js',
  '/app/local-ai/hardware-tier-ui-v278.js',
  '/app/local-ai/worker-v266.js',
  '/app/local-ai/test-pulse-v269.js'
];

assert.match(repair,/const REVISION='chat-avatar-visible-v346'/,'local AI cache repair must preserve the active chat repair identity');
assert.match(repair,/LOCAL_AI_COHERENCE_REVISION='local-ai-cache-coherence-v306'/,'local AI cache repair marker must remain explicit');
assert.match(repair,/MODEL_ROUTE_REVISION='selected-local-minilm-v357'/,'selected-local/MiniLM delivery epoch must remain explicit');
assert.match(repair,/SERVER_AUTO_FAILOVER_REVISION='server-auto-local-failover-v358'/,'server-auto failover delivery epoch must remain explicit');
assert.match(repair,/GUIDE_VOICE_REVISION='guide-native-voice-v1'/,'native guide voice delivery epoch must remain explicit');
assert.match(repair,/cache\.delete\(request,\{ignoreSearch:true\}\)/,'local AI cache repair must evict every query-string revision for the same runtime path');
for(const pathname of requiredLocalAIPaths){
  assert.ok(repair.includes(`'${pathname}'`),`cache repair lost local AI dependency ${pathname}`);
}
assert.ok(repair.includes("'/app/guide-native-voice-v1.js'"),'cache repair must rotate the lazy native guide voice helper with chat/local-AI revisions');

const canonicalImport="importScripts('/service-worker-chat-repair-v245.js?v=chat-avatar-visible-v346&purge=chat-avatar-visible-v346&freeze=mobile-chat-main-thread-quiescence-v349&layout=mobile-chat-css-dvh-v349&party=lazy-v353&model=selected-local-minilm-v357&failover=server-auto-local-failover-v358&voice=guide-native-voice-v1');";
assert.ok(generated.includes(canonicalImport),'generated service worker must preserve the current chat/local-AI/native-voice repair import identity');
assert.ok(builder.includes(canonicalImport),'service worker generator must preserve the current chat/local-AI/native-voice repair import identity');
assert.match(generated,/local-ai-code-coherence-v308-bootstrap-capability/,'generated parent worker must carry the active local AI bootstrap-capability coherence epoch');
assert.match(builder,/localAICodeCoherence:'v308-bootstrap-capability-network-first-pre-core'/,'service worker generator must report the active local AI code-coherence epoch');
assert.match(builder,/localAIBootstrapCapability:'v359'/,'service worker generator must report the bootstrap capability repair epoch');
assert.match(builder,/guideNativeVoice:'v1'/,'service worker generator must report the native guide voice delivery epoch');
assert.match(installedEntry,/updateViaCache:'none'/,'installed worker registration must bypass HTTP cache so the changed parent worker fetches current imported repair code');
assert.ok(installedEntry.includes('registration.update()')&&installedEntry.includes('bounded(registration.update()'),'installed entry must explicitly perform a bounded update check for the changed parent worker');

console.log(JSON.stringify({
  ok:true,
  revision:'local-ai-cache-coherence-v359-bootstrap-capability-guide-native-voice-v1',
  localAICodeCoherence:'v308-bootstrap-capability-network-first-pre-core',
  chatContract:'chat-avatar-visible-v346',
  selectedLocalMiniLM:'v357',
  serverAutoFailover:'v358',
  guideNativeVoice:'v1',
  bootstrapCapability:'v359',
  protectedPaths:requiredLocalAIPaths.length,
  ignoreSearchEviction:true,
  parentWorkerBytesRotated:true,
  importedRepairFetchedWithoutHttpCache:true
},null,2));