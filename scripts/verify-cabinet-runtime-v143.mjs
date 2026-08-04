import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [worker,familyCss,familyRuntime,aiLoader,cabinetHtml,cabinetRuntime,calibrationRaw,realmHtml,livingHtml,fellowfareHtml,anarchadiaHtml,gateway]=await Promise.all([
  read('public/service-worker.js'),read('public/app/family-shell-v104.css'),read('public/app/family-shell-v104.js'),read('public/app/family-ai-loader-v105.js'),read('public/app/cabinet-mode-v142.html'),read('public/app/cabinet-mode-v142.js'),read('public/app/shared/cabinet-calibration-v144.json'),read('public/app/realm-console-v140.html'),read('public/app/cabinets/living-school/index.html'),read('public/app/fellowfare-cabinet-v144.html'),read('public/app/anarchadia-console-v139.html'),read('server-gateway-v131.mjs')
]);
const calibration=JSON.parse(calibrationRaw);
assert(worker.includes("const VERSION='1.0.4'"),'Device worker version regressed.');
for(const token of ["DEVICE_REVISION='progressive-device-r37'","INSTALL_REVISION='instant-entry-r37'",'APP_FILES','MODEL_FILES','async function staleWhileRevalidate','async function cacheFirst','previousStatic','previousRuntime'])assert(worker.includes(token),`Progressive worker missing ${token}`);
const core=worker.match(/const CORE=(\[[\s\S]*?\]);\nconst DEVICE_REQUIRED=/),required=worker.match(/const DEVICE_REQUIRED=(\[[\s\S]*?\]);\nasync function cacheRequired/);
assert(core&&required,'Fast-shell manifest cannot be parsed.');
const bootAssets=Function(`"use strict";const CORE=${core[1]};return ${required[1]};`)();
assert(bootAssets.length<40,'Boot shell is no longer lean.');
assert(!bootAssets.some(asset=>asset.endsWith('.onnx')||asset.includes('/vendor/transformers/')),'Model binaries block boot.');
for(const retired of ['cabinet-calibrator-v144.html','cabinet-calibration-v144.js','cabinet-mode-v142.js','cabinet-runtime-v143.css','cabinet-shells-v129.json'])assert(!worker.includes(retired),`Marketing runtime is installed: ${retired}`);
assert(worker.includes("if(url.pathname.startsWith('/api/'))return"),'APIs do not bypass asset caching.');
assert(worker.includes('event.waitUntil(update)'),'Cached app files do not refresh in the background.');
assert(worker.includes("pathname.includes('anarchadia')&&!text.includes('/app/anarchadia-local-sovereignty-v146.js')"),'Anarchadia injection scope regressed.');
for(const token of ['grid-template-columns:repeat(4','cwf104-badge','cwf104-tray'])assert(familyCss.includes(token),`Family styling missing ${token}`);
for(const token of ["document.documentElement.dataset.familyShell='direct'",'commonweave.family-status.v105','badge.hidden=value.count<1'])assert(familyRuntime.includes(token),`Family runtime missing ${token}`);
assert(!familyRuntime.includes('MutationObserver')&&!familyRuntime.includes('contentDocument'),'Family runtime observes nested documents.');
for(const token of ['async function ensure()','CommonweaveGuideChatV153','CommonweaveModelSettingsV133'])assert(aiLoader.includes(token),`Lazy AI runtime missing ${token}`);
for(const [name,html] of [['realm',realmHtml],['living',livingHtml],['fellowfare',fellowfareHtml],['anarchadia',anarchadiaHtml]]){
  assert(html.includes('/app/family-shell-v104.js')&&html.includes('/app/family-ai-loader-v105.js'),`${name} does not mount family controls`);
  assert(!html.includes('/app/guide-chat-v153.js'),`${name} eagerly loads guide chat`);
}
for(const token of ['cv141-art-a','cv141-art-b','cabinet-calibration-v144.js'])assert(cabinetHtml.includes(token),`Marketing cabinet source missing ${token}`);
for(const token of ['renderControls','preloadAll','swapArt','image.decode'])assert(cabinetRuntime.includes(token),`Marketing cabinet runtime missing ${token}`);
assert(calibration.schema==='commonweave.cabinet-calibration.v1'&&calibration.sourceSize.width===941&&calibration.sourceSize.height===1672,'Marketing calibration regressed.');
for(const id of ['commonweave','living-school','cerbanimo','fellowfare','anarchadia'])assert(calibration.systems[id]?.hotspots?.length===5,`${id} hotspot count regressed.`);
assert(gateway.includes('localInstallRequired: true')&&gateway.includes('applicationSurface && !installerSurface && !packageInstall'),'Public node does not enforce installation.');
new Function(familyRuntime);new Function(aiLoader);new Function(worker);
console.log(JSON.stringify({ok:true,version:'1.0.4',bootAssets:bootAssets.length,updates:'background refresh',models:'first-use cache',previousPackage:'retained during update',marketingCabinets:'retained in source'},null,2));
