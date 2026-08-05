import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [surface,delegation,controller,settings,worker,additiveWorker,pwa,installer,boundary,indexHtml]=await Promise.all([
  read('public/app/cabinet-surfaces-v143.js'),
  read('public/app/settings-delegation-v175.js'),
  read('public/app/model-settings-controller-v173.js'),
  read('public/app/unified-ai-settings-v175.js'),
  read('public/service-worker.js'),
  read('public/service-worker-v156.js'),
  read('public/app/pwa-v130.js'),
  read('public/install-v130.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/index.html')
]);
for(const source of [surface,delegation,controller,settings,worker,additiveWorker,pwa,installer,boundary])new Function(source);

for(const token of ['PLATFORM CONFIGURATION','Commonweave platform settings','Save platform settings','data-open-ai-settings','Open Commonweave AI settings','Deterministic local mode is the default','function openAISettings()'])assert(surface.includes(token),`Cabinet surface missing ${token}`);
for(const forbidden of ["const AI_KEY=","provider:'bundled'",'Xenova/all-MiniLM-L6-v2','Save platform and AI settings','name="provider"','name="model"','name="externalConsent"',"localStorage.setItem(AI_KEY"] )assert(!surface.includes(forbidden),`Cabinet surface can still resurrect ${forbidden}`);

for(const token of ["VERSION='177.0-final-legacy-ai-retirement'",'form[data-cw143-settings]','migrateLegacyAI','savePlatform','PLATFORM CONFIGURATION','data-open-unified-ai-settings',"provider:'deterministic'",'commonweave-deterministic-v175'])assert(delegation.includes(token),`Settings retirement guard missing ${token}`);
assert(delegation.includes("document.addEventListener('submit'")&&delegation.includes('stopImmediatePropagation'),'Legacy full-page submit is not intercepted before its retired handler.');

for(const token of ["authority:'CommonweaveUnifiedAISettingsV175'","defaultRoute:'deterministic'",'transformerActive:false'])assert(controller.includes(token),`Controller missing ${token}`);
for(const token of ['Gemini API key','Deterministic local mode','Save Commonweave AI settings','data-paste-key','data-import-key','data-forget-key'])assert(settings.includes(token),`Single AI settings surface missing ${token}`);

for(const token of ["CACHE_REVISION='direct-family-r39-final-settings-retirement'","DEVICE_REVISION='device-package-r39-no-legacy-ai'","AI_REVISION='deterministic-single-authority-v177'"])assert(worker.includes(token),`Base package did not rotate through ${token}`);
for(const token of ["EXTENSION_VERSION='working-campus-additions-v177-final-settings-retirement'","EXTENSION_CACHE='cwext-working-campus-additions-v177-final-settings-retirement'",'base-r39-clean-settings'])assert(additiveWorker.includes(token),`Additive package did not rotate through ${token}`);
assert(pwa.includes('device-package-r39-no-legacy-ai-working-campus-additions-v177-final-settings-retirement'),'Installed PWA still registers the stale r38 worker.');
for(const token of ["WORKER_REVISION='device-package-r39-no-legacy-ai'","ADDITIONS_REVISION='working-campus-additions-v177-final-settings-retirement'",'one AI settings surface'])assert(installer.includes(token),`Installer missing ${token}`);
for(const token of ["ADDITIONS_VERSION='v177-final-settings-retirement'","SETTINGS_STABILITY_REVISION='v177-no-legacy-ai-surfaces'"])assert(boundary.includes(token),`Install boundary missing ${token}`);
assert(indexHtml.includes('clean-settings-r39')&&indexHtml.includes('one AI settings surface'),'Public installer does not publish the clean settings revision.');

console.log(JSON.stringify({ok:true,visiblePlatformSurface:'platform-only',settingsAuthority:'CommonweaveUnifiedAISettingsV175',legacyBundledRoute:false,legacyMiniLMModel:false,legacyAISubmit:false,devicePackage:'r39-no-legacy-ai',additivePackage:'v177-final-settings-retirement'},null,2));
