import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [bridge,boundary,worker,activeWorker,critical]=await Promise.all([
  read('public/app/weaveling-memory-bridge-v191.js'),
  read('public/app/cerbanimo-deterministic-boundary-v203.js'),
  read('public/service-worker-v156.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-critical-v199.js'),
]);

assert(bridge.includes("VERSION='1.0.6-weaveling-memory-bridge-v205-frozen-runtime-proxy'"),'The frozen-runtime bridge revision is missing.');
assert(!/runtime\.generate\s*=/.test(bridge),'The memory bridge still mutates runtime.generate directly.');
assert(!/runtime\.fastMemoryRevision\s*=/.test(bridge),'The memory bridge still mutates a frozen runtime property.');
assert(bridge.includes('__cerbanimoDeterministicBoundaryV203'),'The bridge does not recognize the Cerbanimo provider guard as an existing wrapper.');
assert(bridge.includes('const proxy=Object.freeze({...runtime,generate:wrapped,fastMemoryRevision:VERSION})'),'The immutable memory-runtime proxy is missing.');
assert(critical.includes("'/app/weaveling-memory-bridge-v191.js'"),'Critical boot compatibility package does not retain the corrected memory bridge.');

const lightweightBridge=worker.includes('legacy-v156-bridge-v209');
if(lightweightBridge){
  assert(worker.includes("importScripts('/service-worker-v203.js?v=1.0.6-lightweight-shell-v208-legacy-v156-bridge-v209')"),'The legacy registration path does not bridge to the active lightweight worker.');
  assert(activeWorker.includes("const BUILD = 'lightweight-shell-v208'"),'The active v203 worker is not the direct lightweight shell.');
  assert(!activeWorker.includes('importScripts('),'The direct lightweight worker reintroduced the layered worker stack.');
  assert(activeWorker.includes('DOWNLOAD_OFFLINE_PACKAGE'),'The direct lightweight worker no longer exposes resumable campus hydration.');
}else{
  assert(worker.includes('memory-bridge-frozen-proxy-v205'),'The inner service worker does not force the memory-bridge refresh.');
  assert(activeWorker.includes('flat-living-school-v203-memory-bridge-v205'),'The active v203 wrapper does not refresh the changed inner worker.');
}

class MemoryStorage{
  constructor(seed={}){this.rows=new Map(Object.entries(seed))}
  getItem(key){return this.rows.has(key)?this.rows.get(key):null}
  setItem(key,value){this.rows.set(key,String(value))}
  removeItem(key){this.rows.delete(key)}
}

let modelCalls=0;
let assistantCalls=0;
let deterministicCalls=0;
let tick=0;
const listeners=new Map();
const frozenResult=Object.freeze({status:'success',actual:{provider:'gemini'},latency:Object.freeze({baseMs:3})});
const baseRuntime=Object.freeze({
  version:'frozen-base-runtime',
  async generate(request){modelCalls+=1;return frozenResult},
  readSharedConfig(){return{provider:'gemini',route:'gemini',model:'gemini-3.5-flash-lite'}},
});
const localStorage=new MemoryStorage({
  'commonweave-model-profiles-v1':JSON.stringify({interactive:{provider:'gemini',route:'gemini',model:'gemini-3.5-flash-lite'}}),
});
const memory={
  snapshot(){return{items:[]}},
  handleCommand(){return null},
  command(){return null},
  recordTurn(){},
  applyPlan(){},
  updateWorking(){},
  remember(){},
};
const sandbox={
  console,
  Date,
  URLSearchParams,
  localStorage,
  performance:{now(){tick+=11;return tick}},
  location:{pathname:'/app/realm-console-v140.html',search:'?system=cerbanimo',hostname:'commonweave.test'},
  setInterval(fn){sandbox.interval=fn;return 1},
  clearInterval(){},
  addEventListener(name,handler){listeners.set(name,handler)},
  dispatchEvent(){return true},
  CommonweaveModelRuntime:baseRuntime,
  CommonweaveWeavelingMemoryV191:memory,
  CommonweaveAssistantV141:{async respond(){assistantCalls+=1;return{provider:'gemini'}}},
  CommonweaveDeterministicModeV175:{async respond(){deterministicCalls+=1;return{provider:'deterministic',requestedProvider:'deterministic'}}},
  globalThis:null,
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);

vm.runInContext(bridge,sandbox,{filename:'weaveling-memory-bridge-v191.js'});
assert.notEqual(sandbox.CommonweaveModelRuntime,baseRuntime,'The memory bridge did not replace the frozen runtime with a proxy.');
assert.equal(Object.isFrozen(sandbox.CommonweaveModelRuntime),true,'The memory bridge proxy must remain immutable.');
assert.equal(baseRuntime.generate.name,'generate','The source frozen runtime was mutated.');
const optimized=await sandbox.CommonweaveModelRuntime.generate({
  purpose:'commonweave-guide-response-v141-weaveling',
  config:{provider:'gemini',timeoutMs:60000,maxTokens:9000,stream:true},
});
assert.equal(modelCalls,1,'The proxied generator did not call the base runtime exactly once.');
assert.notEqual(optimized,frozenResult,'The bridge must not mutate or return the frozen provider result directly.');
assert.equal(optimized.latency.revision,'1.0.6-weaveling-memory-bridge-v205-frozen-runtime-proxy','The proxy latency revision is missing.');

vm.runInContext(boundary,sandbox,{filename:'cerbanimo-deterministic-boundary-v203.js'});
localStorage.setItem('commonweave-model-profiles-v1',JSON.stringify({interactive:{provider:'deterministic',route:'deterministic',model:'commonweave-deterministic-v175'}}));
assert.doesNotThrow(()=>sandbox.CommonweaveWeavelingMemoryBridgeV191.install(),'Reinstalling the memory bridge after the Cerbanimo guard still mutates a frozen runtime.');
const reply=await sandbox.CommonweaveAssistantV141.respond({systemId:'cerbanimo',text:'Build a bench'});
assert.equal(reply.provider,'deterministic','Kamiya did not remain deterministic after the memory bridge reinstall.');
assert.equal(deterministicCalls,1,'The deterministic Cerbanimo path was not called exactly once.');
assert.equal(assistantCalls,0,'The original Gemini-capable assistant ran in deterministic mode.');
const blocked=await sandbox.CommonweaveModelRuntime.generate({purpose:'commonweave-guide-response-v141',context:{guide:{system:'cerbanimo'}},config:{provider:'gemini'}});
assert.equal(blocked.error?.code,'DETERMINISTIC_PROVIDER_BOUNDARY','The direct Cerbanimo model guard was lost.');
assert.equal(modelCalls,1,'Gemini was called after deterministic mode was selected.');

console.log(JSON.stringify({
  ok:true,
  revision:'memory-bridge-frozen-runtime-v205',
  frozenRuntimeProxy:true,
  frozenResultSafe:true,
  cerbanimoBoundaryComposition:true,
  deterministicGeminiCalls:0,
  criticalRefresh:true,
  installedWorkerMode:lightweightBridge?'v209-direct-lightweight':'v205-layered-wrapper',
  flatWrapperRefresh:!lightweightBridge,
  lightweightShellDirect:lightweightBridge,
},null,2));
