import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const files=await Promise.all([
  readFile('public/app/weaveling-memory-v191.js','utf8'),
  readFile('public/app/weaveling-memory-bridge-v191.js','utf8'),
  readFile('public/app/model-settings-controller-v173.js','utf8'),
  readFile('public/extensions/civweave-device-credentials-v160.js','utf8'),
  readFile('public/service-worker.js','utf8'),
  readFile('public/service-worker-v156.js','utf8'),
  readFile('public/app/install-boundary-v146.js','utf8'),
  readFile('public/app/family-ai-loader-v105.js','utf8'),
  readFile('public/app/working-campus-v156.part5.txt','utf8'),
]);
const [memorySource,bridgeSource,settingsSource,deviceSource,baseWorker,additiveWorker,boundarySource,loaderSource,campusSource]=files;
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
class MemoryStorage{constructor(seed={}){this.values=new Map(Object.entries(seed))}getItem(key){return this.values.has(key)?this.values.get(key):null}setItem(key,value){this.values.set(key,String(value))}removeItem(key){this.values.delete(key)}clear(){this.values.clear()}}
class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}}

const localStorage=new MemoryStorage(),sessionStorage=new MemoryStorage(),events=[];
const sandbox={console,Date,Math,Set,Map,Promise,structuredClone,localStorage,sessionStorage,CustomEvent,dispatchEvent:event=>{events.push(event);return true},globalThis:null};
sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(memorySource,sandbox,{filename:'weaveling-memory-v191.js'});
const memory=sandbox.CivweaveWeavelingMemoryV191;
assert(memory?.version.includes('v191'),'Memory runtime did not initialize.');
let command=memory.handleCommand('remember that the infinite loop is intentionally unresolved');
assert(command?.ok&&memory.readLong().length===1,'Explicit long-term memory command did not persist.');
assert(memory.snapshot('infinite loop').longTerm.some(item=>/intentionally unresolved/i.test(item.text)),'Relevant long-term memory was not retrieved.');
const beforeSecret=memory.readLong().length;
memory.remember({kind:'fact',text:'api key: AIza123456789012345678901234567890123456'});
assert(memory.readLong().length===beforeSecret,'A credential-like value entered Weaveling memory.');
const plan={id:'weave-memory-test',title:'Write the infinite-loop book',wish:'Write a book about a time looper meeting a time traveler in an uncertain infinite loop',outcome:'Draft a coherent manuscript while preserving the unresolved loop premise.',assumptions:['Whether the loop is literally infinite remains unresolved.'],paths:[{realm:'living-school',type:'learning',title:'Study loop structures',purpose:'Clarify options',completionCriteria:'Rules are reviewable'}]};
memory.applyPlan(plan);
assert(memory.readWorking().activeWeaveId===plan.id&&memory.readWorking().objective===plan.outcome,'Plan did not populate working memory.');
assert(memory.readLong().some(item=>item.scope===`weave:${plan.id}`&&item.kind==='project'),'Plan did not populate durable project memory.');

let captured=null;
sandbox.CivweaveAssistantV141={respond:async args=>{captured=args;return{response:{answer:'Memory-aware answer'},provider:'gemini',model:'gemini-test',plan}}};
vm.runInContext(bridgeSource,sandbox,{filename:'weaveling-memory-bridge-v191.js'});
const bridged=await sandbox.CivweaveAssistantV141.respond({text:'Continue the book plan',systemId:'civweave',history:[{role:'user',text:'Earlier turn'}]});
assert(bridged.response.answer==='Memory-aware answer','Memory bridge changed the underlying assistant result.');
assert(captured.history.some(item=>item.role==='system'&&/Local Weaveling memory follows/.test(item.text)),'Memory bridge did not inject working and long-term memory.');
command=await sandbox.CivweaveAssistantV141.respond({text:'what do you remember',systemId:'civweave',history:[]});
assert(command.provider==='civweave-memory'&&/durable memory/i.test(command.response.answer),'Memory status command did not stay local.');

const persisted={schema:'civweave.device-model-secret.v191',apiKey:'AIza-device-test-key-not-real',provider:'gemini',savedAt:'2026-08-05T00:00:00.000Z'};
const settingsLocal=new MemoryStorage({'civweave-model-persistent-secrets-v191':JSON.stringify(persisted)}),settingsSession=new MemoryStorage(),settingsEvents=[];
const document={documentElement:{dataset:{}},getElementById(){return null},querySelector(){return null},head:{append(){}},body:{append(){}}};
class HTMLElement{}
const settingsSandbox={console,Date,Math,JSON,localStorage:settingsLocal,sessionStorage:settingsSession,CustomEvent,HTMLElement,document,dispatchEvent:event=>{settingsEvents.push(event);return true},globalThis:null};
settingsSandbox.globalThis=settingsSandbox;vm.createContext(settingsSandbox);vm.runInContext(settingsSource,settingsSandbox,{filename:'model-settings-controller-v173.js'});
const controller=settingsSandbox.CivweaveModelSettingsControllerV173;
assert(controller?.credentialStatus?.().remembered===true,'Remembered device credential was not detected.');
assert(controller.credentialStatus().session===true,'Remembered device credential was not restored into the runtime session.');
assert(JSON.parse(settingsSession.getItem('civweave-model-session')).apiKey===persisted.apiKey,'Restored Gemini key did not reach the session key used by the model runtime.');
controller.forgetCredential();
assert(!controller.credentialStatus().remembered&&!controller.credentialStatus().session,'Forget saved key did not clear both durable and session copies.');

for(const token of ['name="credentialMode"','Remember on this device','This app session only','unlocked browser profile','credentialPersistence'])assert(settingsSource.includes(token),`Settings teaching flow is missing ${token}.`);
for(const forbidden of ['MutationObserver','setInterval(','setTimeout('])assert(!settingsSource.includes(forbidden),`Clean-room settings reintroduced ${forbidden}.`);
assert(!deviceSource.includes('MutationObserver'),'Credential compatibility shim still observes the document.');
assert(deviceSource.includes("addEventListener('civweave:model-settings-saved'"),'Credential bridge does not canonicalize an explicitly saved credential.');
assert(deviceSource.includes("detail.credentialPersistence==='device'"),'Credential bridge does not preserve the explicit device-only persistence choice.');
assert(deviceSource.includes('automaticPersistence:false'),'Credential shim does not declare indiscriminate automatic persistence retired.');
assert(deviceSource.includes('restoresConsent:true')&&deviceSource.includes('mirrorsRuntimeSecret:true'),'Credential bridge does not declare the v192 usability repair.');
for(const token of ['/app/weaveling-memory-v191.js','/app/weaveling-memory-bridge-v191.js']){
  assert(baseWorker.includes(token),`Base device package is missing ${token}.`);
  assert(additiveWorker.includes(token),`Additive package is missing ${token}.`);
  assert(boundarySource.includes(token),`Install boundary is missing ${token}.`);
  assert(loaderSource.includes(token),`Family loader is missing ${token}.`);
}
assert(campusSource.includes('hasResponseLayer')&&campusSource.includes('__weavelingMemoryV191'),'Working Campus does not protect against wrapper stacking.');
assert(/working-campus-additions-v19[12]-(?:memory-credential|credential-usable)/.test(additiveWorker),'Additive cache did not retain or advance the memory/credential package.');

console.log(JSON.stringify({ok:true,revision:'v191-memory-credential-v192-compatible',memory:{working:true,longTerm:true,explicitCommands:true,secretsExcluded:true,planPersistence:true},credential:{sessionChoice:true,deviceChoice:true,restoresAtBoot:true,forget:true,automaticPersistence:false,explicitCanonicalization:true},packaged:true},null,2));
