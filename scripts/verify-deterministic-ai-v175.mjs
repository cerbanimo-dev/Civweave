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
  surface:'public/app/cabinet-surfaces-v143.js',
  cleanup:'public/app/shared-tools-cleanup-v175.js',
  loader:'public/app/family-ai-loader-v105.js',
  additions:'public/extensions/commonweave-additions-v156.js',
  mobile:'public/app/mobile-regression-v170.js',
  rails:'public/app/local-rails-validator-v170.js',
  merlinites:'public/app/merlinites-semantic-planner-v164.js',
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
const source=Object.fromEntries(await Promise.all(Object.entries(files).map(async([key,relative])=>[key,await read(relative)]))),pkg=JSON.parse(source.pkg);
for(const key of ['controller','settings','deterministic','delegation','surface','cleanup','loader','additions','mobile','rails','merlinites','boundary','worker','additiveWorker','installer','pwa'])new Function(source[key]);

for(const token of ["VERSION='175.0-deterministic-single-authority-controller'",'/app/unified-ai-settings-v175.js',"defaultRoute:'deterministic'",'transformerActive:false'])assert(source.controller.includes(token),`controller missing ${token}`);
for(const forbidden of ['minilm-model-settings','minilm-reflex-runtime','GET_MODEL_PACKAGE_STATUS','ensureReflex','modelPackageStatus'])assert(!source.controller.includes(forbidden),`controller still owns ${forbidden}`);
for(const token of ["VERSION='175.0-deterministic-single-authority'",'<option value="deterministic">Deterministic local mode</option>','Gemini API key','data-paste-key','data-import-key','data-forget-key','Save Commonweave AI settings','migrateDeterministicDefault'])assert(source.settings.includes(token),`unified settings missing ${token}`);
for(const forbidden of ['data-check-package','data-benchmark','Run reflex speed trial','Checking MiniLM','Semantic package is incomplete'])assert(!source.settings.includes(forbidden),`unified settings still exposes ${forbidden}`);
for(const token of ["VERSION='175.2-deterministic-default'",'commonweave-deterministic-v175','transformerActive:false','currentProvider','installAssistantPatch','stabilize'])assert(source.deterministic.includes(token),`deterministic runtime missing ${token}`);

for(const active of ['loader','mobile','rails','merlinites','surface'])for(const forbidden of ['/app/minilm-reflex-runtime-v138.js','/app/minilm-model-settings-v138.js','/app/models/all-minilm-l6-v2','Xenova/all-MiniLM-L6-v2','ADAPTER_URL'])assert(!source[active].includes(forbidden),`${active} still activates or advertises ${forbidden}`);
for(const token of ['/app/deterministic-mode-v175.js',"defaultProvider:'deterministic'",'transformerActive:false'])assert(source.loader.includes(token),`chat loader missing ${token}`);
for(const token of ["mobile-regression-v175-deterministic","defaultProvider:'deterministic'",'transformerActive:false'])assert(source.mobile.includes(token),`mobile runtime missing ${token}`);
for(const token of ['deterministic-lexical-advisory','transformerActive:false','model:null'])assert(source.rails.includes(token),`rail validator missing ${token}`);
for(const token of ['merlinites-deterministic-v175',"model:'none'",'transformerActive:false'])assert(source.merlinites.includes(token),`Merlinites missing ${token}`);

for(const token of ["VERSION='177.0-final-legacy-ai-retirement'",'form[data-cw143-settings]','commonweave.model-setup','data-open-unified-ai-settings','migrateLegacyAI','savePlatform'])assert(source.delegation.includes(token),`legacy settings retirement missing ${token}`);
for(const token of ['PLATFORM CONFIGURATION','Save platform settings','data-open-ai-settings','Open Commonweave AI settings'])assert(source.surface.includes(token),`platform surface missing ${token}`);
for(const forbidden of ["const AI_KEY=","provider:'bundled'",'Xenova/all-MiniLM-L6-v2','Save platform and AI settings'])assert(!source.surface.includes(forbidden),`platform surface still owns ${forbidden}`);
for(const token of ["VERSION='1.0.4-v175-shared-tools-no-ai-vault'",'Node & friends','Rewards','Active thread','aiVault:false','modelChecks:false'])assert(source.additions.includes(token),`Shared Tools replacement missing ${token}`);
for(const forbidden of ['data-cwv-model-check','adapter.js','Check local MiniLM','Download local model','cwv156-remember','cwv156-unlock'])assert(!source.additions.includes(forbidden),`Shared Tools still exposes ${forbidden}`);

for(const token of ["ADDITIONS_VERSION='v177-final-settings-retirement'",'DETERMINISTIC_MODE_SCRIPT','SETTINGS_DELEGATION_SCRIPT','SHARED_TOOLS_CLEANUP_SCRIPT','transformerActive:false'])assert(source.boundary.includes(token),`install boundary missing ${token}`);
for(const forbidden of ['MODEL_DOWNLOAD_SCRIPT','commonweave-model-download-v157','addScript(MODEL_DOWNLOAD_SCRIPT)'])assert(!source.boundary.includes(forbidden),`install boundary still activates ${forbidden}`);
for(const token of ["CACHE_REVISION='direct-family-r39-final-settings-retirement'","DEVICE_REVISION='device-package-r39-no-legacy-ai'","AI_REVISION='deterministic-single-authority-v177'",'/app/unified-ai-settings-v175.js',"defaultProvider:'deterministic'",'transformerActive:false'])assert(source.worker.includes(token),`base worker missing ${token}`);
for(const forbidden of ['MODEL_CACHE','MODEL_FILES','MODEL_REVISION','GET_MODEL_PACKAGE_STATUS','modelOnDemand','/app/minilm-','/app/models/all-minilm','/app/vendor/transformers'])assert(!source.worker.includes(forbidden),`base worker still activates ${forbidden}`);
for(const token of ["EXTENSION_VERSION='working-campus-additions-v177-final-settings-retirement'","defaultProvider:'deterministic'",'transformerActive:false','APP_FILES'])assert(source.additiveWorker.includes(token),`additive worker missing ${token}`);
for(const forbidden of ['commonweave-model-download-v157','minilm-model-settings','all-minilm-l6-v2','MODEL_PACKAGE'])assert(!source.additiveWorker.includes(forbidden),`additive worker still activates ${forbidden}`);

for(const token of ["WORKER_REVISION='device-package-r39-no-legacy-ai'","ADDITIONS_REVISION='working-campus-additions-v177-final-settings-retirement'",'one AI settings surface'])assert(source.installer.includes(token),`installer missing ${token}`);
for(const forbidden of ['GET_MODEL_PACKAGE_STATUS','model:pull','local semantic package','downloads when enabled'])assert(!source.installer.includes(forbidden),`installer still checks ${forbidden}`);
assert(source.installerHtml.includes('DETERMINISTIC OFFLINE SOFTWARE PACKAGE'),'installer page does not describe the deterministic package');
assert(source.installerHtml.includes('clean-settings-r39'),'installer page does not rotate its public assets');
assert(source.pwa.includes('device-package-r39-no-legacy-ai'),'PWA updater does not rotate to the clean settings worker');

assert(!('postinstall'in pkg.scripts),'npm install still stages Transformer assets');
for(const name of ['prestart','prestart:local','setup:local','dev','check']){const command=String(pkg.scripts[name]||'');for(const forbidden of ['ensure-minilm-model','stage-transformers-assets','verify-minilm-local','model:pull','model:check'])assert(!command.includes(forbidden),`${name} still activates ${forbidden}`)}
for(const name of ['transformer:stage','transformer:model:pull','transformer:model:check','transformer:lab:check'])assert(pkg.scripts[name],`manual lab command ${name} is missing`);
assert(pkg.scripts.check.includes('verify-deterministic-ai-v175.mjs'),'default check does not enforce the deterministic boundary');
assert(pkg.scripts.check.includes('verify-final-settings-retirement-v177.mjs'),'default check does not enforce final settings retirement');
assert(!source.prepare.includes('spawn')&&!source.prepare.includes('ensure-minilm-model'),'startup preparation still launches model work');
for(const workflow of ['directWorkflow','additionsWorkflow'])for(const forbidden of ['model:pull','model:check','ensure-minilm-model','verify-minilm-local','all-minilm-l6-v2/adapter.js','all-minilm-l6-v2/worker.js','GET_MODEL_PACKAGE_STATUS','commonweave-model-download-v157'])assert(!source[workflow].includes(forbidden),`${workflow} still validates or downloads ${forbidden}`);
assert(source.campusTail.includes("deterministic:'Deterministic local'"),'Working Campus does not label deterministic mode');

for(const archived of ['public/app/minilm-reflex-runtime-v138.js','public/app/minilm-model-settings-v138.js','public/app/models/all-minilm-l6-v2/adapter.js','public/app/models/all-minilm-l6-v2/worker.js','scripts/ensure-minilm-model.mjs','scripts/stage-transformers-assets.mjs'])await access(path.join(root,archived));
class MemoryStorage{constructor(seed={}){this.rows=new Map(Object.entries(seed))}getItem(key){return this.rows.has(key)?this.rows.get(key):null}setItem(key,value){this.rows.set(key,String(value))}removeItem(key){this.rows.delete(key)}}
const localStorage=new MemoryStorage({'commonweave.universal-ai.v127':JSON.stringify({route:'bundled',provider:'bundled',model:'Xenova/all-MiniLM-L6-v2'})}),sessionStorage=new MemoryStorage(),events=[];
const sandbox={console,localStorage,sessionStorage,setInterval:()=>1,clearInterval(){},setTimeout(){},clearTimeout(){},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},dispatchEvent:event=>events.push(event),globalThis:null};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(source.deterministic,sandbox,{filename:'deterministic-mode-v175.js'});
const migrated=JSON.parse(localStorage.getItem('commonweave.universal-ai.v127'));
assert(migrated.provider==='deterministic'&&migrated.route==='deterministic','legacy bundled route was not migrated to deterministic mode');
assert(sandbox.CommonweaveDeterministicModeV175.transformerActive===false,'deterministic runtime reports an active Transformer');
assert(sandbox.CommonweaveDeterministicModeV175.route('I need to borrow a trailer').system==='fellowfare','deterministic router lost resource routing');
console.log(JSON.stringify({ok:true,defaultProvider:'deterministic',settingsAuthority:'CommonweaveUnifiedAISettingsV175',visiblePlatformSurface:'platform-only',apiKeyField:'Gemini API key',sharedToolsTabs:['Node & friends','Rewards','Active thread'],activeTransformer:false,activeModelChecks:false,activeModelDownload:false,activeSemanticAdapter:false,archivedTransformerLab:true,deviceRevision:'device-package-r39-no-legacy-ai'},null,2));
