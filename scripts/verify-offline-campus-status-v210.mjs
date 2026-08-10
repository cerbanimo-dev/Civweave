import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'public/app/offline-campus-status-v210.js'),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const nodes=new Map([
  ['#offline-package-state',{textContent:''}],
  ['#offline-package-assets',{textContent:''}],
  ['#download-offline-package',{textContent:''}],
]);
const listeners=new Map();
const serviceWorkerListeners=new Map();
const document={documentElement:{dataset:{}},querySelector(selector){return nodes.get(selector)||null;}};
const navigator={serviceWorker:{controller:null,addEventListener(type,handler){serviceWorkerListeners.set(type,handler);}}};
const sandbox={console,document,navigator,MessageChannel,setTimeout,clearTimeout,addEventListener(type,handler){listeners.set(type,handler);},globalThis:null};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'offline-campus-status-v210.js'});

const api=sandbox.CivweaveOfflineCampusStatusV210;
assert(api?.version?.includes('offline-campus-status-v210')&&api.version.includes('retired-completion-v246'),'Offline campus status API is missing the retired-reference completion repair.');
assert(api?.workerRevision==='offline-campus-current-graph-v280','Offline campus status reader is not aligned to the current worker graph.');

const legacy=api.normalize({type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',revision:'lightweight-shell-v208',ready:false,completed:205,total:205,failedCount:19,failed:Array.from({length:19},(_,index)=>({pathname:`/failed-${index}.js`})),bytes:17*1024*1024});
assert(legacy.attempted===205,'Legacy status did not preserve attempted count.');
assert(legacy.downloaded===186,'Legacy attempted count was still presented as downloaded count.');
assert(legacy.ready===false,'A package with failed files was marked ready.');

const current=api.normalize({type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',revision:'offline-campus-current-graph-v280',ready:false,attempted:205,completed:186,total:205,failedCount:19});
assert(current.downloaded===186&&current.attempted===205,'Current successful and attempted counts were not kept separate.');

api.render({type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',revision:'lightweight-shell-v208',ready:false,completed:205,total:205,failedCount:19,failed:Array.from({length:19},(_,index)=>({pathname:`/failed-${index}.js`})),bytes:17*1024*1024});
assert(nodes.get('#offline-package-state').textContent==='19 files need retry','Retry state label is incorrect.');
assert(nodes.get('#offline-package-assets').textContent==='186/205 current files · 205/205 checked · 17 MB','Downloaded display remains contradictory.');
assert(nodes.get('#download-offline-package').textContent==='Retry 19 missing files','Retry action label is incorrect.');

const ready=api.render({type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',revision:'offline-campus-current-graph-v280',ready:true,attempted:205,completed:205,total:205,failed:[],failedCount:0,bytes:17*1024*1024});
assert(ready.ready===true,'Complete package was not marked ready.');
assert(nodes.get('#offline-package-state').textContent==='ready offline','Ready state label is incorrect.');
assert(nodes.get('#offline-package-assets').textContent==='205/205 current files · 17 MB','Ready download count is incorrect.');
assert(nodes.get('#download-offline-package').textContent==='Refresh offline campus','Ready action label is incorrect.');

const retired=api.render({type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',revision:'offline-campus-current-graph-v280',ready:false,running:false,attempted:217,completed:217,downloaded:217,total:234,discovered:234,failed:[],failedCount:0,skipped:Array.from({length:17},(_,index)=>({pathname:`/retired-${index}.js`,reason:'stale-not-rediscovered'})),skippedCount:17});
assert(retired.total===217,'Retired references remained in the current-campus denominator.');
assert(retired.downloaded===217,'Retired references changed the downloaded count.');
assert(retired.ready===true,'A fully downloaded current campus with retired references was not marked ready.');
assert(nodes.get('#offline-package-state').textContent==='ready offline · 17 retired references skipped','Retired-reference ready label is incorrect.');
assert(nodes.get('#offline-package-assets').textContent==='217/217 current files · 17 retired','Retired-reference count is incorrect.');

assert(serviceWorkerListeners.has('message'),'Status reader does not listen for worker progress.');
assert(listeners.has('load'),'Status reader does not query the current worker after page load.');
assert(!source.includes('registration.update(')&&!source.includes("postMessage({type:'SKIP_WAITING'"),'Status reader must remain read-only with respect to service-worker lifecycle.');

console.log(JSON.stringify({ok:true,revision:'offline-campus-status-v210-retired-completion-v246',workerRevision:api.workerRevision,runtimeVersion:api.version,legacyAttempted:205,legacyDownloaded:186,failedCount:19,retiredScenario:{reportedTotal:234,downloaded:217,retired:17,currentTotal:retired.total,ready:retired.ready},contradictoryCountRemoved:true,liveWorkerProgress:true,lifecycleOwnership:'read-only-status-reader'},null,2));