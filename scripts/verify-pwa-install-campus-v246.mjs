import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const readBytes=path=>readFile(new URL(path,root));
const [hostRoot,html,manifestText,bridge,autostart,statusRuntime,workerRepair,workerWrapper,offlineRuntime,canonicalNavigation,onlineFallback,installBoundary,installedEntry]=await Promise.all([
  read('public/index.html'),
  read('public/app/index.html'),
  read('public/app/manifest.webmanifest'),
  read('public/app/pwa-install-prompt-v246.js'),
  read('public/app/required-campus-autostart-v1.js'),
  read('public/app/offline-campus-status-v210.js'),
  read('public/service-worker-campus-completion-v246.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-offline-runtime-boundary-v266.js'),
  read('public/service-worker-canonical-navigation-v227.js'),
  read('public/app/installer-online-fallback-v225.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/installed-entry-v146.js')
]);

const manifest=JSON.parse(manifestText);
assert.equal(manifest.display,'standalone');
assert.equal(manifest.prefer_related_applications,false);
assert.equal(manifest.start_url,'/app/installed-entry-v146.html?installed=1','installed PWA must launch through updater entry before entering the downloaded runtime');
assert.ok((manifest.shortcuts||[]).every(shortcut=>String(shortcut.url||'').startsWith('/app/installed-entry-v146.html?')),'all installed shortcuts must pass through updater entry');
assert.ok(!manifestText.includes('working-campus-v156.html?installed=1&version='),'manifest must not pin installed launch directly to Working Campus');
assert.ok(installedEntry.includes("fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store'})"),'installed entry must resolve current release without cache');
assert.ok(installedEntry.includes("updateViaCache:'none'"));
assert.ok(installedEntry.includes('await registration.update()'));
assert.ok(installedEntry.includes("candidate.postMessage({type:'SKIP_WAITING'})"),'installed entry must activate a waiting worker before routing');
assert.ok(installedEntry.indexOf('await refreshWorker(releaseVersion)')<installedEntry.indexOf('const requested='),'worker refresh must finish before installed route selection');

assert.ok(hostRoot.includes("new URL('/app/index.html',location.origin)"),'hosted root must route to installer/update/recovery');
assert.ok(hostRoot.includes("source','host-bootstrap'"),'hosted root must identify itself as a bootstrap source');
assert.ok(!hostRoot.includes("new URL('/app/working-campus-v156.html',location.origin)"),'hosted root must never launch Working Campus directly');
assert.ok(!hostRoot.includes("source','web-root'"),'retired live-site runtime provenance must not return');

for(const forbidden of ['Open online campus','launch=online','Open Civweave online'])assert.ok(!html.includes(forbidden),`installer resurrected live runtime escape hatch: ${forbidden}`);
assert.ok(html.includes('This hosted page is only the installer, updater, and recovery dock.'),'installer must state the hosted-origin role plainly');
assert.ok(html.includes('pages are package-only at runtime'),'installer must expose the package-only runtime contract');
assert.ok(html.includes('will not silently substitute the live website'),'installer must explain failure behavior');

const any192=manifest.icons?.find(icon=>icon.sizes==='192x192'&&String(icon.purpose||'any').includes('any'));
const any512=manifest.icons?.find(icon=>icon.sizes==='512x512'&&String(icon.purpose||'any').includes('any'));
const mask512=manifest.icons?.find(icon=>icon.sizes==='512x512'&&String(icon.purpose||'').includes('maskable'));
assert.ok(any192,'manifest must advertise a 192x192 app icon');
assert.ok(any512,'manifest must advertise a 512x512 app icon');
assert.ok(mask512,'manifest must retain a maskable 512x512 icon');
assert.notEqual(any512.src,'/app/logos/civweave-canonical.png','malformed canonical display PNG must not be used for PWA installation');
assert.ok((manifest.shortcuts||[]).every(shortcut=>(shortcut.icons||[]).every(icon=>icon.src!=='/app/logos/civweave-canonical.png')),'manifest shortcuts must not use malformed canonical display PNG');
function localIconPath(src){assert.match(src,/^\/app\/logos\/[A-Za-z0-9._-]+\.png$/,'install icon must be a local PNG');return`public${src}`}
function pngDimensions(buffer,label){
  const signature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  assert.ok(buffer.length>=33,`${label} is too short to be a usable PNG`);assert.ok(buffer.subarray(0,8).equals(signature),`${label} has an invalid PNG signature`);assert.equal(buffer.toString('ascii',12,16),'IHDR',`${label} is missing its IHDR chunk`);
  const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);assert.ok(width>0&&height>0,`${label} has invalid PNG dimensions`);assert.ok(buffer.includes(Buffer.from('IDAT')),`${label} is missing image data`);assert.ok(buffer.includes(Buffer.from('IEND')),`${label} is missing its end chunk`);return[width,height];
}
const [bytes192,bytes512,bytesMask512]=await Promise.all([readBytes(localIconPath(any192.src)),readBytes(localIconPath(any512.src)),readBytes(localIconPath(mask512.src))]);
assert.deepEqual(pngDimensions(bytes192,'192 install icon'),[192,192]);assert.deepEqual(pngDimensions(bytes512,'512 install icon'),[512,512]);assert.deepEqual(pngDimensions(bytesMask512,'maskable 512 install icon'),[512,512]);assert.notDeepEqual(bytes192,bytes512);

const bridgeIndex=html.indexOf('/app/pwa-install-prompt-v246.js'),manifestIndex=html.indexOf('rel="manifest"');
assert.ok(bridgeIndex>=0&&manifestIndex>=0&&bridgeIndex<manifestIndex,'native install bridge must load before manifest discovery');
for(const marker of [
  "const VERSION='pwa-install-prompt-v266-downloaded-runtime'",
  'function campusReady()',
  "button.textContent=ready?'Open downloaded Civweave':'Finishing campus download…'",
  'if(!campusReady())',
  "const BOOT_KEY='civweave.install-boundary.boot.v227'",
  'authorizeRuntime();',
  'navigation=downloaded-package-v266',
  "addEventListener('beforeinstallprompt',capture)",
  'await prompt.prompt()',
  "document.addEventListener('click',ownInstallClick,true)"
])assert.ok(bridge.includes(marker),`PWA bridge lost ${marker}.`);
assert.ok(bridge.includes('Do not use Create shortcut'),'installer must distinguish a PWA install from a website shortcut');
assert.ok(!bridge.includes('launch=online'),'PWA bridge must not expose online runtime launch');

assert.ok(!autostart.includes('civweave.pwa.install-accepted'),'campus download must not depend on a stale persisted install flag');
for(const marker of ['dataset.campusLaunchReady','dataset.civweaveDownloadedRuntime',"civweave:downloaded-runtime-gate",'globalThis.CivweavePWAInstallV246?.refresh?.()'])assert.ok(autostart.includes(marker),`required campus autostart lost runtime gate marker ${marker}.`);
assert.ok(html.includes('campus downloads before runtime opens'),'installer wording must preserve download-before-runtime behavior');

for(const marker of ["revision:REVISION,onlineFallback:false","policy:'repair-downloaded-package-never-open-live-campus'",'Repair package before opening','will not fall back to the hosted website'])assert.ok(onlineFallback.includes(marker),`retired online fallback lost package-repair contract ${marker}.`);
assert.ok(!onlineFallback.includes("new URL('/app/working-campus-v156.html'"),'compatibility fallback script must not manufacture a live campus URL');
assert.ok(!onlineFallback.includes('Open online campus'),'compatibility fallback script must not recreate online launch UI');

for(const marker of ["runtimeAuthorizationPolicy:'standalone-or-preauthorized-session-never-route-intrinsic'","runtimeSourcePolicy:'current-downloaded-package-never-live-site-fallback'","onlineSelfHeal:false"])assert.ok(installBoundary.includes(marker),`install boundary lost ${marker}.`);
assert.ok(!/function systemSurface\(\)[\s\S]{0,300}authorize\(\)/.test(installBoundary),'canonical route detection must not implicitly authorize hosted runtime');

const sandbox={console,document:{querySelector:()=>null,documentElement:{dataset:{}}},navigator:{serviceWorker:null},addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class CustomEvent{},setTimeout:()=>0,clearTimeout:()=>{}};
vm.createContext(sandbox);vm.runInContext(statusRuntime,sandbox,{filename:'offline-campus-status-v210.js'});
const normalize=sandbox.CivweaveOfflineCampusStatusV210?.normalize;assert.equal(typeof normalize,'function');
const legacy=normalize({type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',revision:'offline-campus-current-graph-v238',total:234,discovered:234,downloaded:217,completed:217,attempted:217,running:false,ready:false,failed:[],failedCount:0,skipped:Array.from({length:17},(_,index)=>({pathname:`/retired-${index}.js`})),skippedCount:17});
assert.equal(legacy.total,217,'retired references must be removed from current-campus denominator');assert.equal(legacy.downloaded,217);assert.equal(legacy.ready,true,'217 downloaded + 17 retired must complete legacy 234-item ledger');
assert.ok(workerRepair.includes('retired-references-do-not-block-current-campus-readiness'));assert.ok(workerRepair.includes('downloaded+skippedCount>=reportedTotal'));assert.ok(workerRepair.includes('writeOfflineMeta'));

const routeImport=workerWrapper.indexOf("importScripts('/app/system-routes-v227.js");
const offlineImport=workerWrapper.indexOf("importScripts('/service-worker-offline-runtime-boundary-v266.js");
const coreImport=workerWrapper.indexOf("importScripts('/service-worker-core-v208.js");
assert.ok(routeImport>=0&&offlineImport>routeImport&&offlineImport<coreImport,'downloaded runtime boundary must load before the general service-worker core');
assert.ok(workerWrapper.includes("importScripts('/service-worker-campus-completion-v246.js?v=campus-retired-completion-v246')"));
assert.ok(workerWrapper.includes("self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})"));
for(const marker of ['canonical-runtime-current-downloaded-package-only-no-live-site-fallback',"headers.set('x-civweave-runtime-source','downloaded-package')",'event.stopImmediatePropagation()','package-miss'])assert.ok(offlineRuntime.includes(marker),`offline runtime boundary lost ${marker}.`);
for(const marker of ['exact-route-current-package-first-no-live-network-runtime-fallback','runtimeNetworkFallback:false','currentPackage(pathname)'])assert.ok(canonicalNavigation.includes(marker),`canonical navigation lost ${marker}.`);
const runtimeBranch=canonicalNavigation.slice(canonicalNavigation.indexOf('networkFirst=async function canonicalFiveSystemPackageFirst'),canonicalNavigation.indexOf('self.CivweaveCanonicalNavigationV227'));
assert.ok(runtimeBranch&&!runtimeBranch.includes('fetch('),'canonical runtime route branch must not fetch the hosted site');

console.log(JSON.stringify({ok:true,revision:'pwa-install-campus-v266-downloaded-runtime',manifestIcons:{any192:pngDimensions(bytes192,'192 install icon'),any512:pngDimensions(bytes512,'512 install icon'),maskable512:pngDimensions(bytesMask512,'maskable 512 install icon')},retiredCampusLedger:true,nativeInstallBridge:true,installedLaunch:'updater-first',hostedRoot:'installer-only',runtimeOpenGate:'required-campus-ready',canonicalRuntime:'downloaded-package-only',liveSiteFallback:false},null,2));
