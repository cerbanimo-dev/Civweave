import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [failsafe,sharedLoader,repair,syncSource,versionText,packageText]=await Promise.all([
  read('public/app/chat-runtime-failsafe-v266.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('scripts/sync-release-version-assets.mjs'),
  read('VERSION'),
  read('package.json')
]);
const version=versionText.trim(),pkg=JSON.parse(packageText);
assert.equal(pkg.version,version,'package.json and VERSION must match');
assert.match(version,/^\d+\.\d+\.\d+$/,'VERSION must be semantic');

for(const token of [
  "const VERSION='chat-runtime-failsafe-v266'",
  'const LOADER_TIMEOUT_MS=6000',
  'const ASSISTANT_TIMEOUT_MS=10000',
  'const GUIDE_FALLBACK_TIMEOUT_MS=6000',
  "error.code='CIVWEAVE_CHAT_TIMEOUT'",
  'chatRuntimeFailsafeVersion:VERSION',
  "purpose.endsWith('-guide-workspace-v250')",
  "provider:'deterministic-local'"
])assert.ok(failsafe.includes(token),`chat failsafe is missing ${token}`);

assert.ok(sharedLoader.includes('/app/chat-runtime-failsafe-v266.js?v=chat-runtime-failsafe-v266'),'shared guide loader does not install the chat failsafe');
assert.ok(sharedLoader.includes(`const VERSION='${version}-shared-guide-surface-v236-v266-chat-failsafe';`),'shared guide loader release identity is stale after synchronization');
assert.ok(!/\?v=(?!chat-runtime-failsafe-v266)\d+\.\d+\.\d+/.test(sharedLoader.replaceAll(`?v=${version}`,'?v=current')),'shared guide loader still contains a frozen semantic cache key');

for(const required of [
  '/app/guide-identity-integrity-v216.js',
  '/app/realm-session-integrity-v237.js',
  '/app/guide-workspace-v242.js',
  '/app/chat-runtime-failsafe-v266.js',
  '/app/shared-guide-surface-v236.js',
  '/app/shared-guide-surface-v236-core-v244.js',
  '/app/family-ai-loader-v105.js',
  '/app/assistant-runtime-v141.js',
  '/app/guide-contracts-v141.js',
  '/app/shared/civweave-model-runtime.js'
])assert.ok(repair.includes(`'${required}'`),`chat cache repair does not purge ${required}`);
assert.ok(repair.includes("const REVISION='chat-runtime-recovery-v266'"),'chat cache repair revision did not advance');
assert.ok(repair.includes("cache.delete(request,{ignoreSearch:true})"),'chat cache repair must purge stale query identities');

for(const token of [
  "await patch('public/app/shared-guide-surface-v236.js'",
  "await patch('public/app/family-ai-loader-v105.js'",
  "source=source.replace(/\\?v=\\d+\\.\\d+\\.\\d+/g,`?v=${version}`);"
])assert.ok(syncSource.includes(token),`release synchronizer is missing ${token}`);

const scheduled=[];
const context={
  console,
  Date,
  Promise,
  Object,
  String,
  Array,
  Error,
  Math,
  JSON,
  setTimeout(fn){scheduled.push(fn);queueMicrotask(fn);return scheduled.length},
  clearTimeout(){},
  setInterval(){return 1},
  clearInterval(){},
  queueMicrotask,
  addEventListener(){},
  dispatchEvent(){return true},
  CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  CivweaveFamilyAILoaderV105:{ensure:()=>new Promise(()=>{})},
  CivweaveAssistantV141:{respond:()=>new Promise(()=>{})},
  CivweaveModelRuntime:{generate:()=>new Promise(()=>{})}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(failsafe,context,{filename:'chat-runtime-failsafe-v266.js'});
const api=context.CivweaveChatRuntimeFailsafeV266;
assert.equal(api?.version,'chat-runtime-failsafe-v266','failsafe API did not install');
api.install();
assert.equal(context.CivweaveFamilyAILoaderV105.chatRuntimeFailsafeVersion,api.version,'loader wrapper did not install');
assert.equal(context.CivweaveAssistantV141.chatRuntimeFailsafeVersion,api.version,'assistant wrapper did not install');
assert.equal(context.CivweaveModelRuntime.chatRuntimeFailsafeVersion,api.version,'model fallback wrapper did not install');

const recovered=await context.CivweaveAssistantV141.respond({systemId:'fellowfare',text:'Need a replacement cable'});
assert.equal(recovered.provider,'deterministic-local','hung assistant did not recover locally');
assert.equal(recovered.response.choice.system,'fellowfare','failsafe lost the selected guide system');
assert.match(recovered.response.answer,/Rook/,'failsafe response lost guide identity');
assert.equal(await context.CivweaveFamilyAILoaderV105.ensure(),false,'hung family loader did not fail open');
const modelFallback=await context.CivweaveModelRuntime.generate({purpose:'fellowfare-guide-workspace-v250'});
assert.equal(modelFallback.status,'fallback','hung guide fallback model did not terminate');

console.log(JSON.stringify({
  ok:true,
  version,
  revision:'chat-runtime-failsafe-v266',
  assistantTimeoutRecovery:true,
  loaderTimeoutRecovery:true,
  guideFallbackTimeoutRecovery:true,
  cacheGraphPurged:true,
  releaseCacheKeysSynchronized:true
},null,2));
