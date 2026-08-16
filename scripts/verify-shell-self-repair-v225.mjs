import assert from 'node:assert/strict';
import vm from 'node:vm';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exists=file=>access(path.join(root,file)).then(()=>true,()=>false);
const [shellAssets,repairWorker,wrapper,indexHtml,repairOnly,canonicalNavigation,versionText,packageText]=await Promise.all([
  readFile(path.join(root,'public/service-worker-shell-assets-v1.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-shell-repair-v293.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),
  readFile(path.join(root,'public/app/index.html'),'utf8'),
  readFile(path.join(root,'public/app/installer-repair-only-v2.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-canonical-navigation-v227.js'),'utf8'),
  readFile(path.join(root,'VERSION'),'utf8'),
  readFile(path.join(root,'package.json'),'utf8')
]);
const version=versionText.trim(),pkg=JSON.parse(packageText);
assert.equal(pkg.version,version);
assert.equal(await exists('public/service-worker-shell-repair-v225.js'),false,'Retired v225 repair runtime must stay deleted.');
assert(wrapper.includes('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v2'),'Worker wrapper does not import declarative repair-v2 shell assets.');
assert(wrapper.includes('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293'),'Worker wrapper does not import the v293 repair owner.');
assert(!wrapper.includes('/service-worker-shell-repair-v225.js'),'Worker wrapper resurrected v225.');
assert(indexHtml.includes('/app/installer-repair-only-v2.js'),'Installer does not load cache-distinct repair bridge v2.');
assert(!indexHtml.includes('/app/installer-repair-only-v1.js'),'Installer still loads stale shell-cached repair bridge v1.');
assert(!indexHtml.includes('open-online-campus-v225'),'Installer still exposes browser campus fallback.');
assert(!indexHtml.includes('/app/installer-online-fallback-v225.js'),'Installer still loads retired online fallback.');
assert(shellAssets.includes("const OPTIONAL=['/app/installer-repair-only-v2.js']"),'Declarative shell assets must cache repair bridge v2.');
assert(shellAssets.includes("policy:'declarative-shell-assets-only-no-repair-or-message-ownership'"),'Shell asset helper must not claim repair ownership.');
assert(!/addEventListener\(['"]message/.test(shellAssets),'Shell asset helper must not listen for repair messages.');
for(const token of ["const REVISION='installed-shell-repair-v293'","event.data?.type!=='REPAIR_DEVICE_PACKAGE'",'const result=await cacheShell()','const status=await shellStatus()',"policy:'verified-shell-only-preserve-campus-model-school-storage'"])assert(repairWorker.includes(token),`Installed shell repair worker is missing ${token}`);
assert(repairOnly.includes("browserRuntimePolicy:'installer-only-until-installed-display'"),'Repair bridge must keep browser runtime disabled.');
assert(repairOnly.includes('cacheDistinctPath:true'),'Repair bridge must declare its stale-cache escape.');
assert(canonicalNavigation.includes('exact-route-network-first-exact-route-cache-never-launcher-fallback'),'Canonical navigation can be replaced by shell fallback.');
assert.doesNotThrow(()=>new vm.Script(shellAssets));assert.doesNotThrow(()=>new vm.Script(repairWorker));assert.doesNotThrow(()=>new vm.Script(repairOnly));
console.log(JSON.stringify({ok:true,version,retiredOwner:'v225-absent',repairOwner:'v293',shellAssets:'v1-repair-v2',singleRepairOwner:true,onlineFallback:false,repairOnly:true,cacheDistinctRepair:true,canonicalNavigationFinal:true},null,2));
