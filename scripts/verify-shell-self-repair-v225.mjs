import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [source,wrapper,indexHtml,repairOnly,canonicalNavigation,versionText,packageText]=await Promise.all([
  readFile(path.join(root,'public/service-worker-shell-repair-v225.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),
  readFile(path.join(root,'public/app/index.html'),'utf8'),
  readFile(path.join(root,'public/app/installer-repair-only-v2.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-canonical-navigation-v227.js'),'utf8'),
  readFile(path.join(root,'VERSION'),'utf8'),
  readFile(path.join(root,'package.json'),'utf8')
]);
const version=versionText.trim(),pkg=JSON.parse(packageText),revision='shell-self-repair-v225-install-only-pwa-v1';
assert.equal(pkg.version,version);
assert(wrapper.includes(`/service-worker-shell-repair-v225.js?v=${revision}`),'Worker wrapper does not import the stable V225 shell-repair module.');
assert(wrapper.indexOf('/service-worker-shell-repair-v225.js')>wrapper.indexOf('/service-worker-navigation-safety-v224.js'),'Shell repair must follow generic redirect safety.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v225.js'),'Canonical navigation must remain final after shell repair.');
assert(indexHtml.includes('/app/installer-repair-only-v2.js'),'Installer does not load cache-distinct repair bridge v2.');
assert(!indexHtml.includes('/app/installer-repair-only-v1.js'),'Installer still loads stale shell-cached repair bridge v1.');
assert(!indexHtml.includes('open-online-campus-v225'),'Installer still exposes browser campus fallback.');
assert(!indexHtml.includes('/app/installer-online-fallback-v225.js'),'Installer still loads retired online fallback.');
assert(indexHtml.includes('Launch Civweave from your device app launcher'),'Installer copy no longer preserves installed-only launch policy.');
for(const token of ['REPAIR_DEVICE_PACKAGE','repairableCacheShell','selfRepairingShellStatus','no-browser-runtime'])assert(source.includes(token),`Shell repair is missing ${token}.`);
assert(source.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-repair-only-v2.js']"),'Shell repair must cache repair bridge v2.');
assert(repairOnly.includes("browserRuntimePolicy:'installer-only-until-installed-display'"),'Repair bridge must keep browser runtime disabled.');
assert(repairOnly.includes("if(!required||!rawNext||!installedDisplay())return false"),'Required-next recovery must require installed display.');
assert(repairOnly.includes('cacheDistinctPath:true'),'Repair bridge must declare its stale-cache escape.');
assert(canonicalNavigation.includes('exact-route-network-first-exact-route-cache-never-launcher-fallback'),'Canonical navigation can be replaced by shell fallback.');
assert.doesNotThrow(()=>new vm.Script(source));assert.doesNotThrow(()=>new vm.Script(repairOnly));
const listeners=[],replies=[];let attempts=0,cached=false;
const missing=Array.from({length:12},(_,index)=>({pathname:`/required-${index+1}`,message:'network unavailable'}));
const context=vm.createContext({console,cacheShell:async()=>{attempts+=1;if(attempts===1){const error=new Error('App shell incomplete');error.failures=missing;throw error}cached=true;return{optionalFailures:[]}},shellStatus:async()=>({type:'CIVWEAVE_DEVICE_PACKAGE',mode:'lightweight-shell',version,ready:cached,assetCount:12,presentCount:cached?12:0,missing:cached?[]:missing.map(entry=>entry.pathname)}),OPTIONAL_SHELL_ASSETS:[],SHELL_ASSETS:[],post:(_event,packet)=>replies.push(packet),self:{addEventListener:(type,handler)=>listeners.push({type,handler})}});
vm.runInContext(source,context,{filename:'service-worker-shell-repair-v225.js'});
const installResult=await context.cacheShell();assert.equal(attempts,1);assert.equal(installResult.repaired,false);assert.equal(installResult.requiredFailures.length,12);
const status=await context.shellStatus();assert.equal(attempts,2);assert.equal(status.ready,true);assert.equal(status.repairRevision,revision);
assert(context.OPTIONAL_SHELL_ASSETS.includes('/app/installer-repair-only-v2.js'));assert(context.SHELL_ASSETS.includes('/app/installer-repair-only-v2.js'));
assert(!context.OPTIONAL_SHELL_ASSETS.includes('/app/installer-repair-only-v1.js'));
assert(!context.OPTIONAL_SHELL_ASSETS.includes('/app/installer-online-fallback-v225.js'));
const handler=listeners.find(row=>row.type==='message')?.handler;assert(handler);let promise=null;handler({data:{type:'REPAIR_DEVICE_PACKAGE'},waitUntil:value=>{promise=value},ports:[],source:null});await promise;assert.equal(replies.at(-1)?.type,'CIVWEAVE_DEVICE_PACKAGE');assert.equal(replies.at(-1)?.ready,true);
console.log(JSON.stringify({ok:true,version,revision,activatedIncomplete:true,retryAttempts:attempts,repaired:true,onlineFallback:false,repairOnly:true,cacheDistinctRepair:true,stableWorkerEpoch:true,canonicalNavigationFinal:true,manualFirst:true},null,2));
