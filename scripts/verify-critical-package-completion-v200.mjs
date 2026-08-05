import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFileSync(path.join(root,relative),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const workerSource=read('public/service-worker-v156.js');
const criticalSource=read('public/service-worker-critical-v199.js');
const installer=read('public/install-v130.js');
const pwa=read('public/app/pwa-v130.js');

assert(/importScripts\('\/service-worker-critical-v199\.js(?:\?[^']+)?'\)/.test(workerSource),'The main worker no longer imports the critical package coordinator.');
assert(/(?:CommonweaveCriticalBootV201\|\|self\.CommonweaveCriticalBootV199|CommonweaveCriticalBootV199).*finalize\(\)/.test(workerSource),'The main worker no longer finalizes the critical package coordinator.');
assert(criticalSource.includes("VERSION='critical-package-completion-v201-fast-runtime-proxy'"),'Critical package completion v201 is not active.');
assert(criticalSource.includes("CRITICAL_CACHE='cwboot-critical-fast-runtime-v201'"),'Critical package completion did not rotate its cache.');
assert(criticalSource.includes("'/app/fast-interactive-runtime-v192.js'"),'Critical package completion does not refresh the corrected fast runtime.');
assert(criticalSource.includes('runCapturedInstallListeners(event)'),'Captured full-package installers are not replayed when caches are incomplete.');
assert(criticalSource.includes('BASE_EXPECTED_FILES=111'),'The base package completeness boundary changed unexpectedly.');
assert(criticalSource.includes('EXTENSION_EXPECTED_FILES=53'),'The shared package completeness boundary changed unexpectedly.');
assert(installer.includes("key.startsWith('cwboot-')"),'Reset does not clear the critical boot cache.');
assert(installer.includes('critical-package-completion-v200'),'Installer does not request a critical-package-aware worker build.');
assert(installer.includes('GET_CRITICAL_BOOT_STATUS'),'Installer does not verify the critical and full package together.');
assert(pwa.includes('critical-package-completion-v200'),'Installed app does not request a critical-package-aware worker build.');

function makeRuntime({preloadComplete=false}={}){
  const origin='https://commonweave.test';
  const listeners=new Map();
  const stores=new Map();
  let fetchCount=0;
  const pathname=value=>{
    if(typeof value==='string')return new URL(value,origin).pathname;
    if(value?.url)return new URL(value.url,origin).pathname;
    return String(value);
  };
  const cacheFor=name=>{
    if(!stores.has(name))stores.set(name,new Map());
    const store=stores.get(name);
    return{
      async put(key,response){store.set(pathname(key),response.clone())},
      async match(key){const response=store.get(pathname(key));return response?.clone()||null},
      async keys(){return[...store.keys()].map(item=>new Request(new URL(item,origin)))},
    };
  };
  const caches={
    open:async name=>cacheFor(name),
    keys:async()=>[...stores.keys()],
    delete:async name=>stores.delete(name),
    async match(key){for(const name of stores.keys()){const response=await cacheFor(name).match(key);if(response)return response}return null},
  };
  const mimeFor=url=>{
    const p=pathname(url);
    if(p.endsWith('.html'))return'text/html';
    if(p.endsWith('.css'))return'text/css';
    if(/\.(?:js|mjs)$/.test(p))return'application/javascript';
    if(p.endsWith('.json'))return'application/json';
    if(p.endsWith('.wasm'))return'application/wasm';
    if(/\.(?:png|webp|jpe?g|svg)$/.test(p))return'image/webp';
    return'text/plain';
  };
  const fetch=async input=>{fetchCount+=1;return new Response(`asset:${pathname(input)}`,{status:200,headers:{'content-type':mimeFor(input)}})};
  const self={
    location:{origin},
    registration:{active:preloadComplete?{}:null},
    clients:{claim:async()=>{},matchAll:async()=>[]},
    skipWaiting:async()=>{},
    addEventListener(type,handler){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(handler)},
  };
  let context;
  const importScripts=(...urls)=>{
    for(const url of urls){
      const file=pathname(url)==='/service-worker.js'?'public/service-worker.js':pathname(url)==='/service-worker-critical-v199.js'?'public/service-worker-critical-v199.js':null;
      if(!file)throw new Error(`Unexpected importScripts target ${url}`);
      vm.runInContext(read(file),context,{filename:file});
    }
  };
  context=vm.createContext({console,URL,Request,Response,Headers,Set,Map,Promise,Object,Array,Date,Math,AbortController,setTimeout,clearTimeout,self,caches,fetch,importScripts});
  const preload=async()=>{
    if(!preloadComplete)return;
    const base=await caches.open('commonweave-static-1.0.6-direct-family-r45-memory-credential-v191-five-system-chat-r46-weaveling-memory-direct-software-r38-v106-device-package-r41-no-native-dialog-direct-entry-r45-memory-credential-v191');
    const extensions=await caches.open('cwext-working-campus-additions-v197-assistant-runtime-package');
    const basePaths=['/index.html','/app/installed-entry-v146.html','/app/cabinets/living-school/living-school-cabinet-v151.mjs','/app/services/fellowfare/app.js','/app/anarchadia-console-v139.html'];
    const extensionPaths=['/app/fast-interactive-runtime-v192.js','/app/context-plan-composer-v198.js','/app/themed-system-nav-v178.js','/app/cabinets/living-school/living-school-mutation-guard-v196.js','/extensions/commonweave-additions-v156.js'];
    for(let index=0;index<111;index++)basePaths.push(`/preloaded/base-${index}`);
    for(let index=0;index<53;index++)extensionPaths.push(`/preloaded/extension-${index}`);
    for(const item of new Set(basePaths))await base.put(item,new Response('base',{headers:{'content-type':mimeFor(item)}}));
    for(const item of new Set(extensionPaths))await extensions.put(item,new Response('extension',{headers:{'content-type':mimeFor(item)}}));
  };
  const run=async()=>{
    await preload();
    vm.runInContext(workerSource,context,{filename:'public/service-worker-v156.js'});
    const installWaits=[];
    const installEvent={waitUntil(promise){installWaits.push(Promise.resolve(promise))}};
    for(const handler of listeners.get('install')||[])handler(installEvent);
    await Promise.all(installWaits);
  };
  const message=async type=>{
    let packet=null;
    const waits=[];
    const event={data:{type},ports:[{postMessage(value){packet=value}}],source:null,waitUntil(promise){waits.push(Promise.resolve(promise))}};
    for(const handler of listeners.get('message')||[])handler(event);
    await Promise.all(waits);
    return packet;
  };
  return{run,message,get fetchCount(){return fetchCount},self,caches};
}

const fresh=makeRuntime();
await fresh.run();
const [critical,base,extensions]=await Promise.all([
  fresh.message('GET_CRITICAL_BOOT_STATUS'),
  fresh.message('GET_DEVICE_PACKAGE_STATUS'),
  fresh.message('GET_ADDITIONS_STATUS'),
]);
assert(critical?.ready===true,`Critical package was not ready after a fresh install: ${JSON.stringify(critical)}`);
assert(critical.fullPackage?.baseCount>=111,'Fresh install did not repopulate the 111-file core cache.');
assert(critical.fullPackage?.extensionCount>=53,'Fresh install did not repopulate the 53-file shared cache.');
assert(base?.ready===true&&base.missing.length===0,'Base worker still reports missing core files after repair.');
assert(extensions?.ready===true&&extensions.missing.length===0,'Additive worker still reports missing shared files after repair.');

const existing=makeRuntime({preloadComplete:true});
await existing.run();
const existingCritical=await existing.message('GET_CRITICAL_BOOT_STATUS');
assert(existingCritical?.ready===true,'Complete existing package was not preserved.');
assert(existing.fetchCount===existing.self.CommonweaveCriticalBootV201.paths.length,'Complete package update unnecessarily rebuilt the full cache instead of refreshing only critical files.');

console.log(JSON.stringify({
  ok:true,
  repair:'critical-package-completion-v201-fast-runtime-proxy',
  freshCoreFiles:critical.fullPackage.baseCount,
  freshSharedFiles:critical.fullPackage.extensionCount,
  freshCriticalFiles:critical.present,
  existingPackageNetworkFetches:existing.fetchCount,
  fastRuntimeCritical:true,
  resetClearsCriticalCache:true,
},null,2));
