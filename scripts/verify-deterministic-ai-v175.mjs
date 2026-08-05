import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const files={
  controller:'public/app/model-settings-controller-v173.js',
  settings:'public/app/unified-ai-settings-v175.js',
  deterministic:'public/app/deterministic-mode-v175.js',
  delegation:'public/app/settings-delegation-v175.js',
  cleanup:'public/app/shared-tools-cleanup-v175.js',
  loader:'public/app/family-ai-loader-v105.js',
  additions:'public/extensions/commonweave-additions-v156.js',
  boundary:'public/app/install-boundary-v146.js',
  worker:'public/service-worker.js',
  additiveWorker:'public/service-worker-v156.js',
  installer:'public/install-v130.js',
  installerHtml:'public/index.html',
  pwa:'public/app/pwa-v130.js',
  prepare:'scripts/prepare-start-v131.mjs',
  pkg:'package.json',
  directWorkflow:'.github/workflows/verify-v126.yml',
  additionsWorkflow:'.github/workflows/verify-working-campus-additions-v156.yml',
  campusTail:'public/app/working-campus-v156.part5.txt'
};
const entries=await Promise.all(Object.entries(files).map(async([key,relative])=>[key,await read(relative)]));
const source=Object.fromEntries(entries),pkg=JSON.parse(source.pkg);
for(const key of ['controller','settings','deterministic','delegation','cleanup','loader','additions','boundary','worker','additiveWorker','installer','pwa'])new Function(source[key]);

for(const token of ["VERSION='175.0-deterministic-single-authority-controller'",'/app/unified-ai-settings-v175.js',"defaultRoute:'deterministic'",'transformerActive:false'])assert(source.controller.includes(token),`controller missing ${token}`);
for(const forbidden of ['minilm-model-settings','minilm-reflex-runtime','GET_MODEL_PACKAGE_STATUS','ensureReflex','modelPackageStatus'])assert(!source.controller.includes(forbidden),`controller still owns ${forbidden}`);

for(const token of ["VERSION='175.0-deterministic-single-authority'",'<option value="deterministic">Deterministic local mode</option>','Gemini API key','data-paste-key','data-import-key','data-forget-key','Save Commonweave AI settings','migrateDeterministicDefault','transformerActive'])assert(source.settings.includes(token),`unified settings missing ${token}`);
for(const forbidden of ['data-check-package','data-benchmark','Run reflex speed trial','Checking MiniLM','Semantic package is incomplete'])assert(!source.settings.includes(forbidden),`unified settings still exposes ${forbidden}`);

for(const token of ["VERSION='175.1-deterministic-default'",'commonweave-deterministic-v175','transformerActive:false','currentProvider','installAssistantPatch'])assert(source.deterministic.includes(token),`deterministic runtime missing ${token}`);
assert(!source.loader.includes('/app/minilm-reflex-runtime-v138.js'),'chat loader still loads MiniLM');
assert(!source.loader.includes('/app/models/all-minilm-l6-v2'),'chat loader still references a MiniLM package');
for(const token of ['/app/deterministic-mode-v175.js',"defaultProvider:'deterministic'",'transformerActive:false'])assert(source.loader.includes(token),`chat loader missing ${token}`);

for(const token of ['commonweave.model-setup','data-native-form="model"','data-open-unified-ai-settings','CommonweaveModelSettingsControllerV173'])assert(source.delegation.includes(token),`legacy settings delegation missing ${token}`);
for(const token of ["VERSION='1.0.4-v175-shared-tools-no-ai-vault'",'Node & friends','Rewards','Active thread','aiVault:false','modelChecks:false'])assert(source.additions.includes(token),`Shared Tools replacement missing ${token}`);
for(const forbidden of ['data-cwv-model-check','adapter.js','Check local MiniLM','Download local model','cwv156-remember','cwv156-unlock'])assert(!source.additions.includes(forbidden),`Shared Tools still exposes ${forbidden}`);

for(const token of ["ADDITIONS_VERSION='v175-deterministic-single-ai-settings'",'DETERMINISTIC_MODE_SCRIPT','SETTINGS_DELEGATION_SCRIPT','SHARED_TOOLS_CLEANUP_SCRIPT','transformerActive:false'])assert(source.boundary.includes(token),`install boundary missing ${token}`);
for(const forbidden of ['MODEL_DOWNLOAD_SCRIPT','commonweave-model-download-v157','addScript(MODEL_DOWNLOAD_SCRIPT)'])assert(!source.boundary.includes(forbidden),`install boundary still activates ${forbidden}`);

for(const token of ["CACHE_REVISION='direct-family-r38-deterministic'","DEVICE_REVISION='device-package-r38-no-transformer'","AI_REVISION='deterministic-single-authority-v175'",'/app/unified-ai-settings-v175.js','defaultProvider:\'deterministic\'','transformerActive:false'])assert(source.worker.includes(token),`base worker missing ${token}`);
for(const forbidden of ['MODEL_CACHE','MODEL_FILES','MODEL_REVISION','GET_MODEL_PACKAGE_STATUS','modelOnDemand','/app/minilm-','/app/models/all-minilm','/app/vendor/transformers'])assert(!source.worker.includes(forbidden),`base worker still activates ${forbidden}`);
for(const token of ["EXTENSION_VERSION='working-campus-additions-v175-deterministic-single-ai-settings'",'defaultProvider:\'deterministic\'','transformerActive:false'])assert(source.additiveWorker.includes(token),`additive worker missing ${token}`);
for(const forbidden of ['commonweave-model-download-v157','minilm-model-settings','all-minilm-l6-v2','MODEL_PACKAGE'])assert(!source.additiveWorker.includes(forbidden),`additive worker still activates ${forbidden}`);

for(const token of ["WORKER_REVISION='device-package-r38-no-transformer'","ADDITIONS_REVISION='working-campus-additions-v175-deterministic-single-ai-settings'",'deterministic · no model loaded'])assert(source.installer.includes(token),`installer missing ${token}`);
for(const forbidden of ['GET_MODEL_PACKAGE_STATUS','model:pull','local semantic package','downloads when enabled'])assert(!source.installer.includes(forbidden),`installer still checks ${forbidden}`);
assert(source.installerHtml.includes('DETERMINISTIC OFFLINE SOFTWARE PACKAGE'),'installer page does not describe the deterministic package');
assert(!source.installerHtml.includes('optional local semantic model'),'installer page still advertises the active local semantic model');
assert(source.pwa.includes('device-package-r38-no-transformer'),'PWA updater does not rotate to the deterministic worker');

assert(!('postinstall'in pkg.scripts),'npm install still stages Transformer assets');
for(const name of ['prestart','prestart:local','setup:local','dev','check']){const command=String(pkg.scripts[name]||'');for(const forbidden of ['ensure-minilm-model','stage-transformers-assets','verify-minilm-local','model:pull','model:check'])assert(!command.includes(forbidden),`${name} still activates ${forbidden}`)}
for(const name of ['transformer:stage','transformer:model:pull','transformer:model:check','transformer:lab:check'])assert(pkg.scripts[name],`manual lab command ${name} is missing`);
assert(pkg.scripts.check.includes('verify-deterministic-ai-v175.mjs'),'default check does not enforce the deterministic boundary');
assert(!source.prepare.includes('spawn'),'startup preparation can still launch model subprocesses');
assert(!source.prepare.includes('ensure-minilm-model'),'startup preparation still checks MiniLM');

for(const workflow of ['directWorkflow','additionsWorkflow'])for(const forbidden of ['model:pull','model:check','ensure-minilm-model','verify-minilm-local','all-minilm-l6-v2/adapter.js','all-minilm-l6-v2/worker.js','GET_MODEL_PACKAGE_STATUS','commonweave-model-download-v157'])assert(!source[workflow].includes(forbidden),`${workflow} still validates or downloads ${forbidden}`);
for(const workflow of ['directWorkflow','additionsWorkflow'])assert(source[workflow].includes('verify-deterministic-ai-v175.mjs'),`${workflow} does not run the deterministic boundary verifier`);
assert(source.campusTail.includes("deterministic:'Deterministic local'"),'Working Campus does not label deterministic mode');

for(const archived of ['public/app/minilm-reflex-runtime-v138.js','public/app/minilm-model-settings-v138.js','public/app/models/all-minilm-l6-v2/adapter.js','public/app/models/all-minilm-l6-v2/worker.js','scripts/ensure-minilm-model.mjs','scripts/stage-transformers-assets.mjs'])await access(path.join(root,archived));

class MemoryStorage{constructor(seed={}){this.rows=new Map(Object.entries(seed))}getItem(key){return this.rows.has(key)?this.rows.get(key):null}setItem(key,value){this.rows.set(key,String(value))}removeItem(key){this.rows.delete(key)}}
const localStorage=new MemoryStorage({'commonweave.universal-ai.v127':JSON.stringify({route:'bundled',provider:'bundled',model:'Xenova/all-MiniLM-L6-v2'})}),sessionStorage=new MemoryStorage();
const events=[];
const sandbox={console,localStorage,sessionStorage,setInterval:()=>1,clearInterval(){},setTimeout(){},clearTimeout(){},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},dispatchEvent:event=>events.push(event),globalThis:null};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(source.deterministic,sandbox,{filename:'deterministic-mode-v175.js'});
const migrated=JSON.parse(localStorage.getItem('commonweave.universal-ai.v127'));
assert(migrated.provider==='deterministic'&&migrated.route==='deterministic','legacy bundled route was not migrated to deterministic mode');
assert(sandbox.CommonweaveDeterministicModeV175.transformerActive===false,'deterministic runtime reports an active Transformer');
assert(sandbox.CommonweaveDeterministicModeV175.route('I need to borrow a trailer').system==='fellowfare','deterministic router lost resource routing');

console.log(JSON.stringify({ok:true,defaultProvider:'deterministic',settingsAuthority:'CommonweaveUnifiedAISettingsV175',apiKeyField:'Gemini API key',sharedToolsTabs:['Node & friends','Rewards','Active thread'],activeTransformer:false,activeModelChecks:false,activeModelDownload:false,archivedTransformerLab:true,deviceRevision:'device-package-r38-no-transformer'},null,2));
