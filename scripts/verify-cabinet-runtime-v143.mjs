// Verifies the v1.0.4 direct software family and retained marketing cabinet source.
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd(),read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const count=(text,pattern)=>(text.match(pattern)||[]).length;
const [packageRaw,worker,adapter,modelWorker,compatHtml,familyCss,familyRuntime,aiLoader,cabinetHtml,cabinetCss,cabinetRuntime,calibrationRuntime,calibrationRaw,calibratorHtml,calibratorRuntime,surfacesCss,surfacesRuntime,sharingRuntime,realmHtml,livingHtml,fellowfareHtml,anarchadiaHtml,shellRaw,gateway]=await Promise.all([
  read('package.json'),read('public/service-worker.js'),read('public/app/models/all-minilm-l6-v2/adapter.js'),read('public/app/models/all-minilm-l6-v2/worker.js'),read('public/app/fullscreen-family-v104.html'),read('public/app/family-shell-v104.css'),read('public/app/family-shell-v104.js'),read('public/app/family-ai-loader-v105.js'),read('public/app/cabinet-mode-v142.html'),read('public/app/cabinet-runtime-v143.css'),read('public/app/cabinet-mode-v142.js'),read('public/app/cabinet-calibration-v144.js'),read('public/app/shared/cabinet-calibration-v144.json'),read('public/app/cabinet-calibrator-v144.html'),read('public/app/cabinet-calibrator-v144.js'),read('public/app/cabinet-surfaces-v143.css'),read('public/app/cabinet-surfaces-v143.js'),read('public/app/sharing-library-v143.js'),read('public/app/realm-console-v140.html'),read('public/app/cabinets/living-school/index.html'),read('public/app/fellowfare-cabinet-v144.html'),read('public/app/anarchadia-console-v139.html'),read('public/app/shared/cabinet-shells-v129.json'),read('server-gateway-v131.mjs')
]);
const pkg=JSON.parse(packageRaw),shells=JSON.parse(shellRaw),calibration=JSON.parse(calibrationRaw),anarchadia=shells.systems.anarchadia;
assert(count(packageRaw,/"check:syntax"\s*:/g)===1,'package.json must contain exactly one check:syntax key.');
assert(count(packageRaw,/"check"\s*:/g)===1,'package.json must contain exactly one check key.');
for(const token of ['family-shell-v104.js','anarchadia-cabinet-workbench-v144.js','anarchadia-governance-kernel-v145.js','local-object-mesh-v146.js'])assert(pkg.scripts['check:syntax'].includes(token),`Syntax suite omits ${token}.`);
assert(worker.includes("const VERSION='1.0.4'"),'Device package worker is not v1.0.4.');
for(const token of ["DEVICE_REVISION='device-package-r35-direct'","INSTALL_REVISION='direct-entry-r35'",'DEVICE_REQUIRED','family-ai-loader-v105.js','anarchadia-governance-kernel-v145.js','local-object-mesh-v146.js','async function deviceOnly'])assert(worker.includes(token),`Device package worker missing ${token}`);
for(const retired of ['cabinet-calibrator-v144.html','cabinet-calibration-v144.js','cabinet-mode-v142.js','cabinet-runtime-v143.css','cabinet-shells-v129.json'])assert(!worker.includes(retired),`Marketing cabinet runtime is still installed: ${retired}`);
assert(worker.includes("if(url.pathname.startsWith('/api/'))return"),'Shared APIs must bypass the device asset cache.');
assert(!worker.includes('staleWhileRevalidate'),'Installed application assets still revalidate against the node.');
assert(worker.includes("pathname.includes('anarchadia')&&!text.includes('/app/anarchadia-local-sovereignty-v146.js')"),'Sovereignty runtime is injected outside Anarchadia.');
assert(adapter.includes('caches.match')&&adapter.includes("source:'installed-device-package'"),'MiniLM adapter does not inspect the installed package.');
assert(!adapter.includes("cache:'reload'")&&!adapter.includes("method:'HEAD'"),'MiniLM adapter still creates network probes.');
assert(modelWorker.includes('fromDevicePackage')&&modelWorker.includes('caches.match'),'MiniLM worker does not load verification assets from Cache Storage.');
assert(compatHtml.includes('location.replace')&&!compatHtml.includes('<iframe'),'Compatibility host still contains the blocking family iframe.');
for(const token of ['grid-template-columns:repeat(4','cwf104-badge','cwf104-dot','cwf104-tray'])assert(familyCss.includes(token),`Direct family styling missing ${token}`);
for(const token of ["const VERSION='1.0.4'",'.filter(([id])=>id!==current)',"document.documentElement.dataset.familyShell='direct'",'commonweave.family-status.v105','timestamp(item)>last','badge.hidden=value.count<1'])assert(familyRuntime.includes(token),`Direct family runtime missing ${token}`);
assert(!familyRuntime.includes('MutationObserver')&&!familyRuntime.includes('contentDocument'),'Family runtime still observes nested frames.');
for(const token of ['async function ensure()','CommonweaveGuideChatV153','CommonweaveModelSettingsV133'])assert(aiLoader.includes(token),`Lazy AI runtime missing ${token}`);
for(const [name,html] of [['realm',realmHtml],['living',livingHtml],['fellowfare',fellowfareHtml],['anarchadia',anarchadiaHtml]]){assert(html.includes('/app/family-shell-v104.js')&&html.includes('/app/family-ai-loader-v105.js'),`${name} software does not mount direct family controls`);assert(!html.includes('/app/guide-chat-v153.js'),`${name} software eagerly loads guide chat`)}
// Physical cabinet renderer and calibration remain valid source for marketing production.
for(const token of ['cv144-overlay','cv141-art-a','cv141-art-b','cabinet-calibration-v144.js'])assert(cabinetHtml.includes(token),`Marketing cabinet source missing ${token}`);
for(const token of ['.cv144-overlay','.cv144-control','transition:opacity 120ms'])assert(cabinetCss.includes(token),`Marketing cabinet styling missing ${token}`);
for(const token of ['renderControls','preloadAll','for(const [id,shell] of Object.entries(shells))','swapArt','image.decode','viewBox'])assert(cabinetRuntime.includes(token),`Marketing cabinet runtime missing ${token}`);
assert(calibration.schema==='commonweave.cabinet-calibration.v1'&&calibration.revision==='source-svg-r24-user'&&calibration.sourceSize.width===941&&calibration.sourceSize.height===1672,'Marketing calibration schema, revision, or dimensions are wrong.');
for(const id of ['commonweave','living-school','cerbanimo','fellowfare','anarchadia'])assert(calibration.systems[id]?.hotspots?.length===5,`${id} does not have five marketing hotspots.`);
const anarchadiaX=[225.7,331.1,469.7,609,716.3];calibration.systems.anarchadia.hotspots.forEach((spot,index)=>assert(Math.abs(spot.cx-anarchadiaX[index])<0.01,`Anarchadia marketing hotspot ${index+1} x is ${spot.cx}.`));
assert(anarchadia.screen.width===70.8&&anarchadia.screen.height===56.15,'Anarchadia marketing screen calibration regressed.');
assert(calibrationRuntime.includes('localStorage.setItem(KEY')&&calibrationRuntime.includes('source-svg-r24-user'),'Marketing source defaults are not seeded before runtime.');
for(const token of ['pointerdown','pointermove','localStorage.setItem','Copy JSON','Export JSON'])assert(calibratorHtml.includes(token)||calibratorRuntime.includes(token),`Marketing calibrator missing ${token}`);
for(const token of ['Commonweave settings','NODE LEARNING LIBRARY','ACTIVE QUEST','LOCAL MARKET BOARD','SUBMISSION → CHANGE PIPELINE','dedupeBands'])assert(surfacesRuntime.includes(token),`Software work surfaces missing ${token}`);
for(const token of ['cw143-button-coin','cw143-market','cw143-step-light','cw143-progress'])assert(surfacesCss.includes(token),`Software surface styling missing ${token}`);
assert(realmHtml.includes('cabinet-surfaces-v143.js')&&anarchadiaHtml.includes('cabinet-surfaces-v143.js'),'Software surfaces are not mounted.');
const publishStart=sharingRuntime.indexOf('async function publish'),publishEnd=sharingRuntime.indexOf('document.addEventListener',publishStart),publishBody=sharingRuntime.slice(publishStart,publishEnd);
assert(publishStart>=0&&publishEnd>publishStart,'Learning library publish path is missing.');
assert(publishBody.includes('runtime.createObject')&&publishBody.includes('runtime.syncGateway')&&publishBody.indexOf('runtime.createObject')<publishBody.indexOf('runtime.syncGateway'),'Learning publication is not local-first.');
assert(gateway.includes('localInstallRequired: true')&&gateway.includes('applicationSurface && !installerSurface && !packageInstall'),'Public node does not enforce install-only boundary.');
new Function(familyRuntime);new Function(aiLoader);
console.log(JSON.stringify({ok:true,softwareFamily:{version:'1.0.4',systems:5,familyButtons:4,sharedSettings:'lazy',liveChat:'lazy',blockingWrapper:false,notifications:'unseen actionable records'},marketingCabinets:{coordinatePlane:'941x1672',retainedInSource:true,installed:false,anarchadiaControlCenters:anarchadiaX},package:{revision:'r35-direct',lean:true,governedUpdates:true,installOnly:true,localObjectOutbox:true}},null,2));
