import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [broker,boundary,registry,bridge,bootstrap]=await Promise.all([
  read('public/app/ai-capability-broker-v268.js'),
  read('public/app/cerbanimo-deterministic-boundary-v203.js'),
  read('public/app/local-ai/model-registry-v266.js'),
  read('public/app/local-ai/runtime-bridge-v266.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
]);

assert(broker.includes("VERSION='1.0.0-ai-capability-broker-v268'"),'The shared AI capability broker revision is missing.');
assert(boundary.includes("VERSION='1.0.8-cerbanimo-authority-boundary-v268'"),'The Cerbanimo authority boundary revision is missing.');
assert(!boundary.includes('DETERMINISTIC_PROVIDER_BOUNDARY'),'The legacy hard provider rejection still exists.');
assert(boundary.includes('/app/ai-capability-broker-v268.js'),'Cerbanimo does not load the shared capability broker.');
assert(boundary.includes("consequentialActions:'deterministic-contracts'"),'Consequential authority is no longer explicit.');
assert(registry.includes('agenticReasoning:true'),'No downloaded model declares bounded agentic reasoning capability.');
assert(registry.includes('externalResearch:false'),'Downloaded models must explicitly deny live external research capability.');
assert(bridge.includes("generateAgentic:request=>generate({...request,executionProfile:'agentic'})"),'Agentic requests still bypass the downloaded-model capability router.');
assert(bridge.includes('civweave:local-model-route-skipped'),'Capability-based local escalation diagnostics are missing.');
assert(bootstrap.indexOf('ai-capability-broker-v268.js')<bootstrap.indexOf('model-registry-v266.js'),'The local AI bootstrap must load the capability broker before model declarations.');

class MemoryStorage{
  constructor(seed={}){this.rows=new Map(Object.entries(seed))}
  getItem(key){return this.rows.has(key)?this.rows.get(key):null}
  setItem(key,value){this.rows.set(key,String(value))}
  removeItem(key){this.rows.delete(key)}
}
const profilesKey='civweave-model-profiles-v1';
const listeners=new Map();
class FakeCustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const localStorage=new MemoryStorage({
  [profilesKey]:JSON.stringify({interactive:{provider:'minilm',route:'minilm',model:'Xenova/all-MiniLM-L6-v2'}}),
});
const originalGenerate=async()=>({status:'success',actual:{provider:'gemini'}});
const originalRespond=async()=>({provider:'gemini'});
const sandbox={
  console,Date,performance:{now:()=>10},localStorage,CustomEvent:FakeCustomEvent,
  dispatchEvent(event){sandbox.lastEvent=event;return true},
  addEventListener(name,handler){listeners.set(name,handler)},
  setInterval(){return 1},clearInterval(){},setTimeout(){return 1},clearTimeout(){},
  CivweaveModelRuntime:Object.freeze({version:'base',generate:originalGenerate}),
  CivweaveAssistantV141:{respond:originalRespond},
  globalThis:null,
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(broker,sandbox,{filename:'ai-capability-broker-v268.js'});
vm.runInContext(boundary,sandbox,{filename:'cerbanimo-deterministic-boundary-v203.js'});

assert.equal(sandbox.CivweaveAICapabilityBrokerV268.selectedProvider(),'semantic-local','MiniLM was still collapsed into deterministic mode.');
assert.equal(sandbox.CivweaveModelRuntime.generate,originalGenerate,'The authority boundary still wraps or replaces model generation.');
assert.equal(sandbox.CivweaveAssistantV141.respond,originalRespond,'The authority boundary still hijacks guide conversation.');
assert.equal(sandbox.CivweaveCerbanimoDeterministicBoundaryV203.legacyProviderWall,false,'The legacy provider wall remains enabled.');
assert.equal(sandbox.CivweaveCerbanimoDeterministicBoundaryV203.authority.consequentialActions,'deterministic-contracts');

vm.runInContext(registry,sandbox,{filename:'model-registry-v266.js'});
let selectedId='qwen3-1.7b-q4f16';
let localCalls=0;
let baseCalls=0;
sandbox.CivweaveLocalModelDownloadV266={selection:()=>({active:true,id:selectedId})};
sandbox.CivweaveLocalModelRuntimeV266={
  activeSpec:()=>sandbox.CivweaveLocalModelRegistryV266.byId(selectedId),
  async generate(){localCalls+=1;return{text:'{"ok":true}',json:{ok:true},elapsedMs:12}},
};
sandbox.CivweaveModelRuntime=Object.freeze({
  version:'base-runtime',
  async generate(request){baseCalls+=1;return{status:'success',actual:{provider:'base-runtime'},request}},
  async generateAgentic(request){baseCalls+=1;return{status:'success',actual:{provider:'base-agentic'},request}},
});
vm.runInContext(bridge,sandbox,{filename:'runtime-bridge-v266.js'});
sandbox.CivweaveLocalModelBridgeV266.patch();

const localAgent=await sandbox.CivweaveModelRuntime.generateAgentic({purpose:'cerbanimo-plan-code',code:true,messages:[{role:'user',content:'Plan a bounded refactor'}],responseFormat:'json'});
assert.equal(localAgent.actual.provider,'downloaded-local','A capable downloaded model did not receive a bounded agentic task.');
assert.equal(localCalls,1);
assert.equal(baseCalls,0);

const toolAgent=await sandbox.CivweaveModelRuntime.generateAgentic({purpose:'living-school-live-research',requiresTools:true,externalResearch:true,messages:[{role:'user',content:'Search the current web'}]});
assert.equal(toolAgent.actual.provider,'base-runtime','A tool/network task incorrectly stayed on a tool-less local model.');
assert.equal(baseCalls,1);

selectedId='qwen3-0.6b-q4f16';
const smallAgent=await sandbox.CivweaveModelRuntime.generateAgentic({purpose:'complex-agentic-plan',messages:[{role:'user',content:'Do a complex multi-step project analysis'}]});
assert.equal(smallAgent.actual.provider,'base-runtime','The small model was incorrectly promoted to agentic reasoning.');
assert.equal(baseCalls,2);

const backgroundDecision=sandbox.CivweaveAICapabilityBrokerV268.supportsLocalRequest(sandbox.CivweaveLocalModelRegistryV266.byId(selectedId),{background:true,messages:[{role:'user',content:'Analyze these local notes'}]});
assert.equal(backgroundDecision.ok,false,'Background work without an explicit profile was incorrectly treated as interactive.');
assert.equal(backgroundDecision.requirements.profile,'agentic');

const smallInteractive=await sandbox.CivweaveModelRuntime.generateInteractive({purpose:'civweave-guide-response-v141',messages:[{role:'user',content:'Help me understand this JavaScript code'}]});
assert.equal(smallInteractive.actual.provider,'downloaded-local','The small model lost ordinary interactive code conversation.');
assert.equal(localCalls,2);

const decision=sandbox.CivweaveAICapabilityBrokerV268.decide({executionProfile:'agentic',requiresTools:true});
assert.equal(decision.route,'base-runtime');
assert.match(decision.reason,/tools/i);

console.log(JSON.stringify({
  ok:true,
  revision:'ai-capability-broker-v268',
  localitySeparatedFromDeterminism:true,
  authorityBoundaryPreserved:true,
  localAgenticReasoning:true,
  toolTasksEscalate:true,
  backgroundTasksAreAgentic:true,
  smallModelAgenticGate:true,
  interactiveLocalPreserved:true,
  localCalls,
  baseCalls,
},null,2));
