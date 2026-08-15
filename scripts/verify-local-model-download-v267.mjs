import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [manager,settings,registry,runtime,worker,background,sw,campus,gateway]=await Promise.all([
  'public/app/local-ai/download-manager-v267.js',
  'public/app/local-ai/settings-panel-v267.js',
  'public/app/local-ai/model-registry-v266.js',
  'public/app/local-ai/runtime-v266.js',
  'public/app/local-ai/worker-v266.js',
  'public/service-worker-local-model-download-v267.js',
  'public/service-worker-v203.js',
  'public/app/working-campus-v156.js',
  'public/app/settings-gateway-v317.js'
].map(read));
for(const source of [manager,settings,registry,runtime,worker,background,sw,campus,gateway])new Function(source);

assert.match(manager,/bytesDownloaded/);
assert.match(manager,/async function repair\(/);
assert.match(background,/validateRecord\(record,response\)/);
assert.ok(background.indexOf('validateRecord(record,response)')<background.indexOf('cache.put(record.request,response)'));
assert.match(sw,/service-worker-local-model-download-v267\.js/);
assert.match(registry,/contextWindowTokens/);
assert.match(registry,/function fallbacks\(/);
assert.match(worker,/AutoModelForCausalLM\.from_pretrained/);
assert.match(worker,/apply_chat_template/);
assert.match(worker,/backend:'wasm'/);
assert.match(runtime,/serializedInference:true/);
assert.match(runtime,/tierFallback:true/);
assert.match(settings,/Downloaded local AI/);
assert.match(settings,/Model window/);

assert.match(gateway,/managementActivation:'explicit-secondary-action'/);
assert.match(gateway,/generativeRuntimeOnOpen:false/);
assert.doesNotMatch(gateway,/bootstrap-v266|runtime-v266|runtime-bridge-v266|test-pulse-v269/);
assert.match(campus,/async function send\(/);
const submit=campus.indexOf('async function send(');
const bootstrap=campus.indexOf('/app/local-ai/bootstrap-v266.js',submit);
assert.ok(bootstrap>submit,'Downloaded local AI bootstrap must remain inside explicit chat submission.');
assert.doesNotMatch(campus,/working-campus-v156\.part|Function\s*\(|repairPersistedCampusState/);

const context={console,globalThis:null,localStorage:{getItem:()=>null,setItem:()=>{}},addEventListener(){},dispatchEvent(){return true},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}}};
context.globalThis=context;vm.createContext(context);vm.runInContext(registry,context,{filename:'model-registry-v266.js'});
const R=context.CivweaveLocalModelRegistryV266;
assert.ok(R?.byId?.('gemma3-1b-it-q4f16'));
assert.ok(Array.isArray(R?.fallbacks?.('gemma4-e4b-it-q2f16-mobile')));

console.log(JSON.stringify({ok:true,revision:'local-model-download-static-interface-v1',backgroundDownloadIntegrity:true,causalLM:true,settingsOpenInference:false,managementExplicit:true,generativeStart:'submit-only'},null,2));
