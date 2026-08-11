import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [source,wrapper,indexHtml,installerFallback,canonicalNavigation,versionText,packageText]=await Promise.all([
  readFile(path.join(root,'public/service-worker-shell-repair-v225.js'),'utf8'),readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),readFile(path.join(root,'public/app/index.html'),'utf8'),readFile(path.join(root,'public/app/installer-online-fallback-v225.js'),'utf8'),readFile(path.join(root,'public/service-worker-canonical-navigation-v227.js'),'utf8'),readFile(path.join(root,'VERSION'),'utf8'),readFile(path.join(root,'package.json'),'utf8')
]);
const version=versionText.trim(),pkg=JSON.parse(packageText),revision='shell-self-repair-v225';
assert.equal(pkg.version,version);
assert(wrapper.includes(`/service-worker-shell-repair-v225.js?v=${revision}`),'Worker wrapper does not import shell repair.');
assert(wrapper.indexOf('/service-worker-shell-repair-v225.js')>wrapper.indexOf('/service-worker-navigation-safety-v224.js'),'Shell repair must follow generic redirect safety.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v225.js'),'Canonical route navigation must remain final after shell repair.');
assert(indexHtml.includes('/app/installer-online-fallback-v225.js?v=shell-self-repair-v225'),'Installer does not load online fallback.');
assert(indexHtml.includes('Download offline files only when you choose.'),'Installer copy no longer preserves the manual-first campus boundary.');
assert(indexHtml.includes('Open online campus'),'Installer no longer exposes an immediate online-campus fallback.');
for(const token of ['REPAIR_DEVICE_PACKAGE','repairableCacheShell','selfRepairingShellStatus','activate-incomplete-retry-required-shell-and-report-paths'])assert(source.includes(token),`Shell repair is missing ${token}.`);
for(const token of ['Open online campus','Open Civweave online','working-campus-v156.html','launch','online'])assert(installerFallback.includes(token),`Installer fallback is missing ${token}.`);
assert(canonicalNavigation.includes('exact-route-network-first-exact-route-cache-never-launcher-fallback'),'Canonical navigation can be replaced by shell fallback.');
assert.doesNotThrow(()=>new vm.Script(source));assert.doesNotThrow(()=>new vm.Script(installerFallback));
const listeners=[],replies=[];let attempts=0,cached=false;
const missing=Array.from({length:12},(_,index)=>({pathname:`/required-${index+1}`,message:'network unavailable'}));
const context=vm.createContext({console,cacheShell:async()=>{attempts+=1;if(attempts===1){const error=new Error('App shell incomplete');error.failures=missing;throw error}cached=true;return{optionalFailures:[]}},shellStatus:async()=>({type:'CIVWEAVE_DEVICE_PACKAGE',mode:'lightweight-shell',version,ready:cached,assetCount:12,presentCount:cached?12:0,missing:cached?[]:missing.map(entry=>entry.pathname)}),OPTIONAL_SHELL_ASSETS:[],SHELL_ASSETS:[],post:(_event,packet)=>replies.push(packet),self:{addEventListener:(type,handler)=>listeners.push({type,handler})}});
vm.runInContext(source,context,{filename:'service-worker-shell-repair-v225.js'});
const installResult=await context.cacheShell();assert.equal(attempts,1);assert.equal(installResult.repaired,false);assert.equal(installResult.requiredFailures.length,12);
const status=await context.shellStatus();assert.equal(attempts,2);assert.equal(status.ready,true);assert.equal(status.repairRevision,revision);
assert(context.OPTIONAL_SHELL_ASSETS.includes('/app/installer-online-fallback-v225.js'));assert(context.SHELL_ASSETS.includes('/app/installer-online-fallback-v225.js'));
const handler=listeners.find(row=>row.type==='message')?.handler;assert(handler);let promise=null;handler({data:{type:'REPAIR_DEVICE_PACKAGE'},waitUntil:value=>{promise=value},ports:[],source:null});await promise;assert.equal(replies.at(-1)?.type,'CIVWEAVE_DEVICE_PACKAGE');assert.equal(replies.at(-1)?.ready,true);
console.log(JSON.stringify({ok:true,version,revision,activatedIncomplete:true,retryAttempts:attempts,repaired:true,onlineFallback:true,canonicalNavigationFinal:true,manualFirst:true},null,2));