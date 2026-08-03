import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const count=(text,pattern)=>(text.match(pattern)||[]).length;

const [
  packageRaw,worker,adapter,modelWorker,hubHtml,hubCss,hubRuntime,cabinetHtml,cabinetCss,surfacesCss,surfacesRuntime,sharingRuntime,
  realmHtml,anarchadiaHtml,shellRaw,gateway
]=await Promise.all([
  read('package.json'),read('public/service-worker.js'),read('public/app/models/all-minilm-l6-v2/adapter.js'),read('public/app/models/all-minilm-l6-v2/worker.js'),
  read('public/app/loom-v128.html'),read('public/app/hub-runtime-v143.css'),read('public/app/hub-runtime-v143.js'),read('public/app/cabinet-mode-v142.html'),read('public/app/cabinet-runtime-v143.css'),
  read('public/app/cabinet-surfaces-v143.css'),read('public/app/cabinet-surfaces-v143.js'),read('public/app/sharing-library-v143.js'),read('public/app/realm-console-v140.html'),read('public/app/anarchadia-console-v139.html'),
  read('public/app/shared/cabinet-shells-v129.json'),read('server-gateway-v131.mjs')
]);
const pkg=JSON.parse(packageRaw),shells=JSON.parse(shellRaw),anarchadia=shells.systems.anarchadia;

assert(count(packageRaw,/"check:syntax"\s*:/g)===1,'package.json must contain exactly one check:syntax key.');
assert(count(packageRaw,/"check"\s*:/g)===1,'package.json must contain exactly one check key.');
assert(pkg.scripts['check:syntax'].includes('cabinet-surfaces-v143.js')&&pkg.scripts['check:syntax'].includes('sharing-library-v143.js'),'Syntax suite omits v143 cabinet runtimes.');
assert(pkg.scripts.check.includes('verify-cabinet-mode-v142.mjs')&&pkg.scripts.check.includes('verify-cabinet-home-v142.mjs')&&pkg.scripts.check.includes('verify-cabinet-runtime-v143.mjs'),'Merged cabinet regression suites are not all active.');

for(const token of ["DEVICE_REVISION='device-package-r23'",'DEVICE_REQUIRED','model_q4f16.onnx','model_quantized.onnx','ort-wasm-simd-threaded.jsep.wasm','cabinet-surfaces-v143.js','sharing-library-v143.js','async function deviceOnly'])assert(worker.includes(token),`Device package worker missing ${token}`);
assert(worker.includes("if(url.pathname.startsWith('/api/'))return"),'Shared APIs must bypass the device asset cache.');
assert(worker.includes("url.pathname.startsWith('/app/')")&&worker.includes('event.respondWith(deviceOnly(request))'),'Application assets must be cache-only during ordinary use.');
assert(!worker.includes('staleWhileRevalidate'),'Installed application assets still revalidate against the node.');
assert(!/url\.pathname\.startsWith\('\/app\/'\)[\s\S]{0,120}fetch\(/.test(worker),'Application asset handling still falls through to fetch.');

assert(adapter.includes('caches.match')&&adapter.includes("source:'installed-device-package'"),'MiniLM adapter does not inspect the installed package.');
assert(!adapter.includes("cache:'reload'")&&!adapter.includes("method:'HEAD'"),'MiniLM adapter still creates network probes.');
assert(modelWorker.includes('fromDevicePackage')&&modelWorker.includes('caches.match'),'MiniLM worker does not load verification assets from Cache Storage.');
assert(!modelWorker.includes("cache:'reload'")&&!modelWorker.includes("headers:{range:"),'MiniLM worker still bypasses the device package.');

assert(hubHtml.includes('data-action="updates"')&&hubHtml.indexOf('data-action="updates"')>hubHtml.indexOf('cw127-version'),'Update control is not restored directly below the version control.');
assert(hubHtml.includes('hub-runtime-v143.css')&&hubHtml.includes('hub-runtime-v143.js'),'Hub does not load the coordinate/update runtime.');
assert(hubCss.includes('.cw127-scene-bg')&&hubCss.includes('object-fit:fill')&&hubRuntime.includes('syncSceneFrame'),'Hub overlays are not locked to the rendered background coordinate frame.');
assert(hubRuntime.includes('/api/releases/current')&&hubRuntime.includes('registration.update()'),'Update hub cannot check release metadata and the local package.');

assert(cabinetHtml.includes('cabinet-runtime-v143.css'),'Cabinet mode does not load physical control geometry.');
assert(cabinetCss.includes('aspect-ratio:1/1')&&cabinetCss.includes('height:auto!important'),'Cabinet controls are not forced to circular width-based hit areas.');
assert(anarchadia.screen.width===70.8&&anarchadia.screen.height===56.15,'Anarchadia screen calibration regressed.');
const expectedX=[23.28,39.50,54.96,71.18,87.02];
anarchadia.controls.forEach((control,index)=>assert(Math.abs(control.x-expectedX[index])<0.001,`Anarchadia control ${index+1} is off-center at ${control.x}.`));

for(const token of ['Commonweave settings','NODE LEARNING LIBRARY','ACTIVE QUEST','LOCAL MARKET BOARD','SUBMISSION → CHANGE PIPELINE','data-market-offer','data-quest-step','data-test-share-node','dedupeBands'])assert(surfacesRuntime.includes(token),`Cabinet work surfaces missing ${token}`);
for(const token of ['cw143-button-coin','cw143-market','cw143-step-light','cw143-progress'])assert(surfacesCss.includes(token),`Cabinet surface styling missing ${token}`);
assert(realmHtml.includes('cabinet-surfaces-v143.js')&&realmHtml.includes('sharing-library-v143.js'),'Realm console does not mount local work surfaces and shared learning bridge.');
assert(anarchadiaHtml.includes('cabinet-surfaces-v143.js'),'Anarchadia does not mount Merlin request status lights.');
assert(sharingRuntime.includes("kind:'learning-library.record'")&&sharingRuntime.includes("new URL('/api/envelopes'"),'Learning library does not use the shared envelope ledger.');
assert(gateway.includes('localInstallRequired: true')&&gateway.includes('intentionally does not serve the application'),'Public node is no longer a release/share-only gateway.');

console.log(JSON.stringify({
  ok:true,
  packageScripts:{duplicateKeys:false,mergedSuites:true},
  devicePackage:{applicationTraffic:'cache-only',modelProbes:'cache-storage',sharedApis:'network-only-on-feature-use'},
  hub:{updateControl:true,hologramCoordinateLock:true},
  cabinets:{circularControls:true,anarchadiaControlCenters:expectedX},
  surfaces:{commonweaveSettings:true,livingLibrary:true,cerbanimoQuest:true,fellowfareBoard:true,anarchadiaPipeline:true},
  sharing:{learningLibrary:'envelope-ledger'}
},null,2));
