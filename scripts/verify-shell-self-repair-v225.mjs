import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [source,wrapper,indexHtml,installerFallback,versionText,packageText]=await Promise.all([
  readFile(path.join(root,'public/service-worker-shell-repair-v225.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),
  readFile(path.join(root,'public/index.html'),'utf8'),
  readFile(path.join(root,'public/app/installer-online-fallback-v225.js'),'utf8'),
  readFile(path.join(root,'VERSION'),'utf8'),
  readFile(path.join(root,'package.json'),'utf8')
]);

const version=versionText.trim();
const pkg=JSON.parse(packageText);
const revision='shell-self-repair-v225';
assert.equal(version,'1.0.12');
assert.equal(pkg.version,version);
assert(wrapper.includes(`/service-worker-shell-repair-v225.js?v=${revision}`),'Active worker wrapper does not import shell repair.');
assert(wrapper.indexOf('/service-worker-shell-repair-v225.js')>wrapper.indexOf('/service-worker-navigation-safety-v224.js'),'Shell repair must be the final worker override.');
assert(indexHtml.includes('/app/installer-online-fallback-v225.js?v=shell-self-repair-v225'),'Installer does not load the online fallback.');
assert(indexHtml.includes('You can open the online campus immediately.'),'Installer copy still treats offline preparation as an access gate.');
for(const token of ['REPAIR_DEVICE_PACKAGE','repairableCacheShell','selfRepairingShellStatus','activate-incomplete-retry-required-shell-and-report-paths'])assert(source.includes(token),`Shell repair is missing ${token}.`);
for(const token of ['Open online campus','Open Commonweave online','working-campus-v156.html','launch','online'])assert(installerFallback.includes(token),`Installer fallback is missing ${token}.`);
assert.doesNotThrow(()=>new vm.Script(source,{filename:'service-worker-shell-repair-v225.js'}));
assert.doesNotThrow(()=>new vm.Script(installerFallback,{filename:'installer-online-fallback-v225.js'}));

const listeners=[];
const replies=[];
let attempts=0;
let cached=false;
const missing=Array.from({length:12},(_,index)=>({pathname:`/required-${index+1}`,message:'network unavailable'}));
const originalCacheShell=async()=>{
  attempts+=1;
  if(attempts===1){
    const error=new Error('App shell incomplete: 12/12 required files failed.');
    error.failures=missing;
    throw error;
  }
  cached=true;
  return {optionalFailures:[]};
};
const originalShellStatus=async()=>({
  type:'COMMONWEAVE_DEVICE_PACKAGE',
  mode:'lightweight-shell',
  version,
  ready:cached,
  assetCount:12,
  presentCount:cached?12:0,
  missing:cached?[]:missing.map(entry=>entry.pathname)
});
const context=vm.createContext({
  console,
  cacheShell:originalCacheShell,
  shellStatus:originalShellStatus,
  OPTIONAL_SHELL_ASSETS:[],
  SHELL_ASSETS:[],
  post:(_event,packet)=>replies.push(packet),
  self:{
    addEventListener:(type,handler)=>listeners.push({type,handler})
  }
});
vm.runInContext(source,context,{filename:'service-worker-shell-repair-v225.js'});

const installResult=await context.cacheShell();
assert.equal(attempts,1,'Initial worker install did not attempt the shell.');
assert.equal(installResult.repaired,false,'Incomplete shell should activate as repairable, not pretend to be ready.');
assert.equal(installResult.requiredFailures.length,12,'Initial failure paths were not retained.');

const status=await context.shellStatus();
assert.equal(attempts,2,'Status check did not retry the required shell.');
assert.equal(status.ready,true,'Shell did not become ready after a successful retry.');
assert.equal(status.presentCount,12);
assert.equal(status.repairRevision,revision);
assert(context.OPTIONAL_SHELL_ASSETS.includes('/app/installer-online-fallback-v225.js'),'Installer fallback was not added to optional shell assets.');
assert(context.SHELL_ASSETS.includes('/app/installer-online-fallback-v225.js'),'Installer fallback was not added to the cache pass.');

const messageHandler=listeners.find(row=>row.type==='message')?.handler;
assert(messageHandler,'Shell repair message listener was not registered.');
let repairPromise=null;
messageHandler({data:{type:'REPAIR_DEVICE_PACKAGE'},waitUntil:promise=>{repairPromise=promise},ports:[],source:null});
await repairPromise;
assert(replies.at(-1)?.type==='COMMONWEAVE_DEVICE_PACKAGE','Explicit repair did not return package status.');
assert.equal(replies.at(-1)?.ready,true);

console.log(JSON.stringify({ok:true,version,revision,initialMissing:12,activatedIncomplete:true,retryAttempts:attempts,repaired:true,onlineFallback:true},null,2));
