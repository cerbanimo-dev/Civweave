import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [source,loader,campus,serviceWorker]=await Promise.all([
  read('public/app/local-chat-bounded-recovery-v1.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/app/working-campus-v440.html'),
  read('public/service-worker-local-ai-coherence-v307.js')
]);
new Function(source);
new Function(loader);
new Function(serviceWorker);

assert.match(source,/1\.0\.0-local-chat-bounded-recovery-v1/);
assert.match(source,/if\(recovering\)return 120000/,'Gemma 4 recovery attempts must not inherit the old 15-minute floor');
assert.match(source,/return recovering\?300000/,'Gemma 4 local recovery must have a bounded total budget');
assert.match(source,/fifteenMinuteChatFloorRetired:true/);
assert.match(source,/watchReject\?\.\(error\);\s*queueMicrotask\(\(\)=>\{try\{runtime\.shutdown/s,'stall reason must reject before worker cancellation');
assert.match(source,/reject\(error\);\s*queueMicrotask\(\(\)=>\{try\{runtime\.shutdown/s,'total timeout reason must reject before worker cancellation');
assert.doesNotMatch(source,/Math\.max\(900000/,'bounded chat recovery must not restore the retired 15-minute minimum');

const recoveryIndex=loader.indexOf('/app/local-chat-bounded-recovery-v1.js');
const authorityIndex=loader.indexOf('/app/local-provider-authority-v1.js');
assert.ok(recoveryIndex>=0&&authorityIndex>recoveryIndex,'bounded recovery watcher must install before provider authority can load local chat');
assert.match(loader,/1\.0\.160-shared-guide-surface-v236-bounded-local-recovery/);
assert.match(loader,/boundedLocalFallbackRecovery:true/);
assert.match(campus,/shared-guide-surface-v236\.js\?v=working-campus-v440-local-recovery-v326/,'Working Campus must cache-bust the shared loader carrying bounded recovery');
assert.match(serviceWorker,/local-ai-code-v312-bounded-local-recovery/);
assert.ok((serviceWorker.match(/'\/app\/local-chat-bounded-recovery-v1\.js'/g)||[]).length>=2,'bounded recovery must be both eligible and warmable in the local-AI coherence cache');
assert.match(serviceWorker,/boundedLocalRecoveryCoherent: true/);

class MemoryStorage{
  constructor(seed={}){this.values=new Map(Object.entries(seed))}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(key,String(value))}
}
const localStorage=new MemoryStorage({
  'civweave.local-ai.selection.v266':JSON.stringify({active:true,id:'gemma3-1b-it-q4f16'}),
  'civweave-model-profiles-v1':JSON.stringify({interactive:{provider:'downloaded-local',model:'gemma4-e2b-it-q2f16-mobile'}}),
  'civweave.local-ai.health.v286':JSON.stringify({'qwen3-0.6b-q4f16':{ok:true,metrics:{tokensPerSecond:4}}})
});
let selection={active:true,id:'gemma3-1b-it-q4f16'};
let fallbackSeen=[];
let serverCalls=0;
const models=new Map([
  ['gemma3-1b-it-q4f16',{id:'gemma3-1b-it-q4f16',device:'webgpu',estimatedBytes:884000000,workingContextTokens:4096,generation:{nonThinkingTemperature:.7}}],
  ['smollm2-360m-instruct-q4f16',{id:'smollm2-360m-instruct-q4f16',device:'webgpu',estimatedBytes:272000000}],
  ['qwen3-0.6b-q4f16',{id:'qwen3-0.6b-q4f16',device:'webgpu',estimatedBytes:610000000}],
  ['qwen3-1.7b-q4f16',{id:'qwen3-1.7b-q4f16',device:'webgpu',estimatedBytes:1470000000}]
]);
const registry={
  byId:id=>models.get(id)||null,
  fallbacks:()=>[],
  models:[...models.values()]
};
const sandbox={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  localStorage,
  queueMicrotask,setTimeout,clearTimeout,
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  dispatchEvent(){return true},addEventListener(){},
  document:{querySelector(){return null}},
  globalThis:null
};
sandbox.globalThis=sandbox;
sandbox.CivweaveLocalModelDownloadV266={selection:()=>selection};
sandbox.CivweaveLocalModelRegistryV266=registry;
sandbox.CivweaveLocalModelRuntimeV266={
  async generate(){
    const rows=sandbox.CivweaveLocalModelRegistryV266.fallbacks(models.get(selection.id));
    fallbackSeen=rows.map(row=>row.id);
    return{status:'success',outputText:'local recovery succeeded',id:selection.id,executionId:rows[0]?.id||selection.id,fallbackChain:rows.slice(0,1).map(row=>row.id)};
  },
  shutdown(){return true}
};
sandbox.CivweaveServerAIRouterV301={async handle(){serverCalls+=1}};

vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'local-chat-bounded-recovery-v1.js'});
sandbox.CivweaveLocalChatRuntimeV295={
  version:'test-local-chat',
  revision:'v312-runtime-first-bootstrap',
  inferenceCoreFirst:true,
  fullBootstrapBlocking:false,
  async ready(){return true},
  budget(){return{maxNewTokens:64}},
  async generate(){throw new Error('retired base generate must be wrapped')}
};
const wrapped=sandbox.CivweaveLocalChatRuntimeV295;
assert.equal(wrapped.boundedFallbackRecovery,true);
assert.equal(wrapped.stallReasonPreserved,true);
assert.equal(wrapped.fifteenMinuteChatFloorRetired,true);

const result=await wrapped.generate({systemPrompt:'system',messages:[{role:'user',content:'Test'}],timeoutMs:60000,totalTimeoutMs:90000});
assert.equal(result.executionId,'qwen3-0.6b-q4f16','a previously healthy installed local model should lead the recovery ladder');
assert.equal(fallbackSeen[0],'qwen3-0.6b-q4f16');
assert.ok(fallbackSeen.includes('smollm2-360m-instruct-q4f16'));
assert.equal(sandbox.CivweaveLocalModelRegistryV266,registry,'temporary recovery registry must be restored after generation');
assert.equal(serverCalls,0,'bounded local recovery must never contact the server router');

console.log(JSON.stringify({
  ok:true,
  revision:'local-chat-bounded-recovery-v1',
  boundedAttempt:true,
  boundedTotal:true,
  stallReasonPreserved:true,
  healthAwareInstalledFallbacks:true,
  registryRestored:true,
  noServerFallback:true,
  campusCacheBust:true,
  pwaCoherenceCache:true
},null,2));
