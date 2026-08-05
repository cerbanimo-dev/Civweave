import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [boundary,consoleHtml,worker,critical]=await Promise.all([
  read('public/app/cerbanimo-deterministic-boundary-v203.js'),
  read('public/app/realm-console-v140.html'),
  read('public/service-worker-v156.js'),
  read('public/service-worker-critical-v199.js'),
]);

assert(boundary.includes("VERSION='1.0.6-cerbanimo-deterministic-boundary-v203'"),'The Cerbanimo provider boundary revision is missing.');
assert(boundary.includes('DETERMINISTIC_PROVIDER_BOUNDARY'),'The hard external-call rejection is missing.');
assert(boundary.includes("requestSystem(request)==='cerbanimo'"),'The model guard is not scoped to Cerbanimo guide calls.');
assert(boundary.includes("deterministic?.respond"),'The assistant boundary does not route to the deterministic runtime.');
assert(consoleHtml.includes('/app/cerbanimo-deterministic-boundary-v203.js?v=provider-boundary-r1'),'The active realm console does not load the provider boundary.');
assert(consoleHtml.indexOf('family-ai-loader-v105.js')<consoleHtml.indexOf('cerbanimo-deterministic-boundary-v203.js'),'The provider boundary must load after the shared loader.');
assert(consoleHtml.indexOf('cerbanimo-deterministic-boundary-v203.js')<consoleHtml.indexOf('cerbanimo-ai-validator-v159.js'),'The provider boundary must load before Cerbanimo validation code.');
assert(worker.includes("importScripts('/service-worker-critical-v199.js?v=memory-bridge-frozen-proxy-v205')"),'The installed worker must import the v205 critical coordinator.');
assert(critical.includes("VERSION='fellowfare-active-v203-cerbanimo-boundary-v204-memory-bridge-v205'"),'The combined FellowFare, Cerbanimo, and memory-bridge critical revision is missing.');
const criticalList=critical.slice(critical.indexOf('const CRITICAL_FILES=['),critical.indexOf('const CRITICAL_PATHS='));
for(const required of [
  '/app/fellowfare-cabinet-v144.html',
  '/app/services/fellowfare/cabinet-embed.css',
  '/app/realm-console-v140.html',
  '/app/cerbanimo-deterministic-boundary-v203.js',
  '/app/weaveling-memory-bridge-v191.js',
])assert(criticalList.includes(`'${required}'`),`Critical boot does not refresh ${required}.`);

class MemoryStorage{
  constructor(seed={}){this.rows=new Map(Object.entries(seed))}
  getItem(key){return this.rows.has(key)?this.rows.get(key):null}
  setItem(key,value){this.rows.set(key,String(value))}
  removeItem(key){this.rows.delete(key)}
}

const profilesKey='commonweave-model-profiles-v1';
const localStorage=new MemoryStorage({
  [profilesKey]:JSON.stringify({interactive:{provider:'deterministic',route:'deterministic',model:'commonweave-deterministic-v188'}}),
});
let modelCalls=0;
let assistantCalls=0;
let deterministicCalls=0;
const listeners=new Map();
const sandbox={
  console,
  localStorage,
  URLSearchParams,
  Date,
  location:{pathname:'/app/realm-console-v140.html',search:'?system=cerbanimo',hostname:'commonweave.test'},
  setInterval(fn){sandbox.interval=fn;return 1},
  clearInterval(){},
  addEventListener(name,handler){listeners.set(name,handler)},
  CommonweaveModelRuntime:Object.freeze({
    readSharedConfig(){return{provider:'gemini',route:'gemini',model:'gemini-3.5-flash-lite'}},
    async generate(){modelCalls+=1;return{status:'success',actual:{provider:'gemini',model:'gemini-3.5-flash-lite'}}},
  }),
  CommonweaveAssistantV141:{
    async respond(){assistantCalls+=1;return{provider:'gemini',requestedProvider:'gemini'}},
  },
  CommonweaveDeterministicModeV175:{
    async respond(){deterministicCalls+=1;return{provider:'deterministic',requestedProvider:'deterministic'}},
  },
  globalThis:null,
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(boundary,sandbox,{filename:'cerbanimo-deterministic-boundary-v203.js'});

assert.equal(sandbox.CommonweaveCerbanimoDeterministicBoundaryV203.selectedProvider(),'deterministic','Stored deterministic mode did not outrank a stale Gemini runtime profile.');
const localReply=await sandbox.CommonweaveAssistantV141.respond({systemId:'cerbanimo',text:'Build a garden bench'});
assert.equal(localReply.provider,'deterministic','Cerbanimo assistant did not route through deterministic mode.');
assert.equal(assistantCalls,0,'Cerbanimo reached the original Gemini-capable assistant while deterministic mode was selected.');
assert.equal(deterministicCalls,1,'The deterministic Cerbanimo runtime was not called exactly once.');

const blocked=await sandbox.CommonweaveModelRuntime.generate({
  purpose:'commonweave-guide-response-v141',
  context:{guide:{system:'cerbanimo'}},
  config:{provider:'gemini',model:'gemini-3.5-flash-lite'},
});
assert.equal(blocked.error?.code,'DETERMINISTIC_PROVIDER_BOUNDARY','A direct Cerbanimo guide model call was not rejected.');
assert.equal(modelCalls,0,'The original Gemini generator ran while deterministic mode was selected.');

localStorage.setItem(profilesKey,JSON.stringify({interactive:{provider:'gemini',route:'gemini',model:'gemini-3.5-flash-lite'}}));
const remoteReply=await sandbox.CommonweaveAssistantV141.respond({systemId:'cerbanimo',text:'Hello'});
assert.equal(remoteReply.provider,'gemini','Explicit Gemini mode no longer reaches the configured provider.');
assert.equal(assistantCalls,1,'The original assistant was not restored for explicit Gemini mode.');
await sandbox.CommonweaveModelRuntime.generate({purpose:'commonweave-guide-response-v141',context:{guide:{system:'cerbanimo'}},config:{provider:'gemini'}});
assert.equal(modelCalls,1,'The model runtime remained blocked after the user explicitly selected Gemini.');

console.log(JSON.stringify({
  ok:true,
  revision:'cerbanimo-deterministic-boundary-v203',
  criticalRevision:'fellowfare-active-v203-cerbanimo-boundary-v204-memory-bridge-v205',
  deterministicAssistantCalls:deterministicCalls,
  blockedGeminiCalls:1,
  explicitGeminiCalls:modelCalls,
  staleRuntimeProfileOverridden:true,
  fellowfareCriticalFilesPreserved:true,
  memoryBridgeCritical:true,
  criticalRefreshIncludesConsoleAndBoundary:true,
},null,2));
