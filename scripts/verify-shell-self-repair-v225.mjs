import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [source,wrapper,indexHtml,canonicalNavigation,versionText,packageText]=await Promise.all([
  readFile(path.join(root,'public/service-worker-shell-repair-v225.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),
  readFile(path.join(root,'public/app/index.html'),'utf8'),
  readFile(path.join(root,'public/service-worker-canonical-navigation-v227.js'),'utf8'),
  readFile(path.join(root,'VERSION'),'utf8'),
  readFile(path.join(root,'package.json'),'utf8')
]);
const version=versionText.trim(),pkg=JSON.parse(packageText),revision='shell-self-repair-v225-install-only-pwa-v1-local-first';
assert.equal(pkg.version,version);
assert(wrapper.includes(`/service-worker-shell-repair-v225.js?v=${revision}`),'Worker wrapper does not import local-first shell repair.');
assert(wrapper.indexOf('/service-worker-shell-repair-v225.js')>wrapper.indexOf('/service-worker-navigation-safety-v224.js'),'Shell repair must follow generic redirect safety.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v225.js'),'Canonical navigation must remain final after shell repair.');
assert(!indexHtml.includes('open-online-campus-v225'),'Installer still exposes browser campus fallback.');
assert(!indexHtml.includes('/app/installer-online-fallback-v225.js'),'Installer still loads retired online fallback.');
assert(indexHtml.includes('Required local campus'),'Installer must expose package completion rather than browser fallback.');
for(const token of ['REPAIR_DEVICE_PACKAGE','repairableCacheShell','reportShellStatusWithoutRepair','runtimeAutoRepair: false','explicit-repair-only-report-missing-without-runtime-fetch'])assert(source.includes(token),`Shell repair is missing ${token}.`);
assert(source.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-repair-only-v1.js']"),'Shell repair must retain repair-only bridge as a package asset.');
assert(canonicalNavigation.includes('exact-route-cache-only-never-runtime-network-fallback'),'Canonical navigation can be replaced by an online shell fallback.');
assert.doesNotThrow(()=>new vm.Script(source));
const listeners=[],replies=[];let attempts=0,cached=false;
const missing=Array.from({length:12},(_,index)=>({pathname:`/required-${index+1}`,message:'package missing'}));
const context=vm.createContext({console,cacheShell:async()=>{attempts+=1;if(attempts===1){const error=new Error('App shell incomplete');error.failures=missing;throw error}cached=true;return{optionalFailures:[]}},shellStatus:async()=>({type:'CIVWEAVE_DEVICE_PACKAGE',mode:'lightweight-shell',version,ready:cached,assetCount:12,presentCount:cached?12:0,missing:cached?[]:missing.map(entry=>entry.pathname)}),OPTIONAL_SHELL_ASSETS:[],SHELL_ASSETS:[],post:(_event,packet)=>replies.push(packet),self:{addEventListener:(type,handler)=>listeners.push({type,handler})}});
vm.runInContext(source,context,{filename:'service-worker-shell-repair-v225.js'});
const installResult=await context.cacheShell();assert.equal(attempts,1);assert.equal(installResult.repaired,false);assert.equal(installResult.requiredFailures.length,12);
const status=await context.shellStatus();assert.equal(attempts,1,'Reading shell status must not trigger repair acquisition.');assert.equal(status.ready,false);assert.equal(status.repairRevision,revision);assert.equal(status.repairRequiresExplicitAction,true);
assert(context.OPTIONAL_SHELL_ASSETS.includes('/app/installer-repair-only-v1.js'));assert(context.SHELL_ASSETS.includes('/app/installer-repair-only-v1.js'));
assert(!context.OPTIONAL_SHELL_ASSETS.includes('/app/installer-online-fallback-v225.js'));
const handler=listeners.find(row=>row.type==='message')?.handler;assert(handler);let promise=null;handler({data:{type:'REPAIR_DEVICE_PACKAGE'},waitUntil:value=>{promise=value},ports:[],source:null});await promise;assert.equal(attempts,2,'Explicit repair message must perform exactly one repair attempt.');assert.equal(replies.at(-1)?.type,'CIVWEAVE_DEVICE_PACKAGE');assert.equal(replies.at(-1)?.ready,true);
console.log(JSON.stringify({ok:true,version,revision,incompleteReportedWithoutNetwork:true,statusTriggeredRepair:false,explicitRepairAttempts:1,repaired:true,onlineFallback:false,canonicalNavigationFinal:true,runtimeAutoRepair:false},null,2));
