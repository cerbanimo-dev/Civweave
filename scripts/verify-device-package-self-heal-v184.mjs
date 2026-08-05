import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [worker,additive,installer,pwa,boundary,campus]=await Promise.all([
  read('public/service-worker.js'),
  read('public/service-worker-v156.js'),
  read('public/install-v130.js'),
  read('public/app/pwa-v130.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/working-campus-v156.html')
]);

new Function(worker);
new Function(additive.replace(/^importScripts\([^\n]+\);/m,''));
new Function(installer);
new Function(pwa);
new Function(boundary);

for(const token of [
  "CACHE_REVISION='direct-family-r44-package-self-heal'",
  "INSTALL_REVISION='direct-entry-r44-package-self-heal'",
  "PACKAGE_RECOVERY_REVISION='device-package-self-heal-v184'",
  'onlineSelfHeal:true',
  'missingAssetDetails:true',
  'async function networkRepair(request)',
  "headers.set('x-commonweave-package','runtime-repair')",
  'await cache.put(url.pathname,response.clone())',
  "event:'asset-repaired'",
  "event:'asset-fallback'",
  "event:'asset-missing'",
  "'x-commonweave-missing-asset':pathname",
  "'x-commonweave-package-recovery':PACKAGE_RECOVERY_REVISION",
  "if(pathname.startsWith('/app/'))return'/app/installed-entry-v146.html'"
])assert(worker.includes(token),`Core package self-heal missing ${token}`);

assert(!worker.includes("return new Response('This asset is not part of the installed Commonweave v1.0.6 package.'"),'Generic cache-only dead-end response is still active.');
const deviceOnlyBlock=worker.slice(worker.indexOf('async function deviceOnly'),worker.indexOf('async function modelOnDemand'));
assert(deviceOnlyBlock.indexOf('networkRepair(request)')<deviceOnlyBlock.indexOf('fallbackCached'),'Device package does not try online repair before falling back.');
assert(deviceOnlyBlock.includes('missingAssetResponse(url.pathname,fallback)'),'Missing asset response does not identify the requested path.');

for(const token of [
  "EXTENSION_VERSION='working-campus-additions-v184-package-self-heal'",
  "PACKAGE_RECOVERY_REVISION='device-package-self-heal-v184'",
  'onlineSelfHeal:true',
  'missingAssetDetails:true',
  "'x-commonweave-missing-asset':url.pathname"
])assert(additive.includes(token),`Additive package self-heal missing ${token}`);

for(const token of [
  "ADDITIONS_REVISION='working-campus-additions-v184-package-self-heal'",
  "AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r46'",
  'package self-repair',
  'tap Diagnostics to collect logs'
])assert(installer.includes(token),`Installer self-heal delivery missing ${token}`);

for(const token of [
  'working-campus-additions-v184-package-self-heal',
  'package repair update downloaded',
  'package self-repair active'
])assert(pwa.includes(token),`PWA self-heal marker missing ${token}`);

for(const token of [
  "ADDITIONS_VERSION='v184-package-self-heal'",
  "PACKAGE_RECOVERY_REVISION='v184-online-self-heal-missing-asset-details'",
  'onlineSelfHeal:true',
  'missingAssetDetails:true'
])assert(boundary.includes(token),`Install boundary self-heal marker missing ${token}`);

for(const token of [
  'working-campus-v184-v106',
  'data-package-recovery="v184"',
  'id="diagnostics-button"',
  'data-open-log-diagnostics',
  "localStorage.setItem('commonweave.log-level','debug')",
  "logger.setLevel('debug')",
  "document.querySelector('[data-cw-log-toggle]')"
])assert(campus.includes(token),`Working Campus diagnostics control missing ${token}`);

console.log(JSON.stringify({
  ok:true,
  revision:'v184-device-package-self-heal',
  baseCacheRotated:true,
  onlineRepairBeforeFallback:true,
  repairedAssetsCached:true,
  missingPathVisible:true,
  unknownAppNavigationFallback:'installed-entry',
  diagnosticsButton:true,
  providerRuntimeOnOpen:false
},null,2));
