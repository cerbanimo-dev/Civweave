import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [controller,settings,adapter,worker,download,serviceWorker]=await Promise.all([
  read('public/app/model-settings-controller-v173.js'),
  read('public/app/unified-ai-settings-v175.js'),
  read('public/app/models/all-minilm-l6-v2/adapter.js'),
  read('public/app/models/all-minilm-l6-v2/worker.js'),
  read('public/extensions/commonweave-model-download-v157.js'),
  read('public/service-worker-v156.js')
]);

new Function(controller);
new Function(settings);
new Function(download);
new Function(serviceWorker.replace(/^importScripts\([^\n]+\);/m,''));

for(const token of [
  "VERSION='1.0.6-settings-controller-v180'",
  "const BOOTSTRAP_ID='cw-ai-settings-bootstrap-v180'",
  'function showBootstrap(generation)',
  'function afterPaint()',
  "transformerStarted:false",
  "presentation:'first-paint-fixed-layer'",
  'transformerActive:false'
])assert(controller.includes(token),`Settings first-paint boundary missing ${token}`);

const dependencyBlock=controller.slice(controller.indexOf('const DEPENDENCIES='),controller.indexOf('const BOOTSTRAP_ID='));
for(const forbidden of ['minilm','transformers','worker.js','pipeline('])assert(!dependencyBlock.toLowerCase().includes(forbidden),`Opening settings still depends on ${forbidden}`);
const openBlock=controller.slice(controller.indexOf('async function open()'),controller.indexOf('async function renderInline'));
assert(openBlock.indexOf('showBootstrap(generation)')<openBlock.indexOf('await afterPaint()'),'The settings shell is not mounted before asynchronous work.');
assert(openBlock.indexOf('await afterPaint()')<openBlock.indexOf('await ensure()'),'Settings dependencies begin before the first paint boundary.');

for(const forbidden of ['new Worker','pipeline(','transformers.min.js','/app/models/all-minilm-l6-v2/adapter.js','/app/models/all-minilm-l6-v2/worker.js'])assert(!settings.includes(forbidden),`Unified AI settings still contains runtime activation token ${forbidden}`);
assert(settings.includes('LEGACY_PATTERN'),'Unified settings must still recognize and retire legacy MiniLM configuration labels without activating them.');

for(const token of [
  "if(!explicit)return{ready:false,dormant:true,reason:'explicit-activation-required'}",
  'let worker=null,sequence=0,readyState=null,initPromise=null;',
  'function activeWorker()',
  "worker=new Worker(WORKER_URL,{type:'module',name:'commonweave-minilm-reflex'})"
])assert(adapter.includes(token),`MiniLM adapter dormancy contract missing ${token}`);
assert(adapter.indexOf('activeWorker().postMessage')>adapter.indexOf('function request('),'The worker may start outside an explicit request.');

for(const token of [
  "const VECTOR_DB='commonweave-semantic-cache-v1'",
  "const INDEX_BATCH_SIZE=1",
  'async function ensureIndexVectors(id,state)',
  "yieldMs:16",
  "source:'indexeddb'",
  "if(message.type==='prewarm')",
  'const index=await inspectIndex(state.profile);',
  "if(message.type==='match')",
  'const index=await ensureIndexVectors(message.id,state);'
])assert(worker.includes(token),`Lazy reflex-index boundary missing ${token}`);
const prewarmBlock=worker.slice(worker.indexOf("if(message.type==='prewarm')"),worker.indexOf("if(message.type==='match')"));
assert(!prewarmBlock.includes('ensureIndexVectors'),'Prewarm still embeds the entire reflex index.');
const loadBlock=worker.slice(worker.indexOf('async function load(id,requestedProfile)'),worker.indexOf('async function ensureIndexVectors'));
assert(!loadBlock.includes('index-embedding'),'Session creation still embeds the reflex index.');

for(const token of ["settingsHooks:false","automaticStartup:false","commonweave:open-semantic-lab"])assert(download.includes(token),`Semantic lab isolation missing ${token}`);
for(const forbidden of ['commonweave:open-ai-settings','#settings-button','#model-chip'])assert(!download.includes(forbidden),`Model download still hooks the settings lifecycle through ${forbidden}`);

for(const token of [
  'base-r42-settings-freeze-boundary',
  "SETTINGS_CONTROLLER_REVISION='first-paint-no-model-v180'",
  "settingsPresentation:'first-paint-fixed-layer'",
  'transformerActive:false'
])assert(serviceWorker.includes(token),`Installed-device refresh boundary missing ${token}`);

console.log(JSON.stringify({
  ok:true,
  revision:'v180-ai-settings-freeze-boundary',
  settingsFirstPaint:true,
  settingsTransformerWork:false,
  miniLMActivation:'explicit-only',
  prewarmEmbedsReflexIndex:false,
  reflexVectorCache:'indexeddb-or-precomputed',
  semanticLabSettingsHooks:false,
  installedDeviceRefresh:true
},null,2));
