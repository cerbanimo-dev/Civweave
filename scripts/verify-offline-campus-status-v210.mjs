import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'public/app/offline-campus-status-v211.js'),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const nodes=new Map([
  ['#offline-package-state',{textContent:''}],
  ['#offline-package-assets',{textContent:''}],
  ['#download-offline-package',{textContent:'',addEventListener(type,handler){buttonListeners.set(type,handler)}}],
  ['#campus-install-progress',{addEventListener(type,handler){progressListeners.set(type,handler)}}],
]);
const listeners=new Map();
const serviceWorkerListeners=new Map();
const buttonListeners=new Map();
const progressListeners=new Map();
const document={documentElement:{dataset:{}},querySelector(selector){return nodes.get(selector)||null;}};
const navigator={serviceWorker:{controller:null,addEventListener(type,handler){serviceWorkerListeners.set(type,handler);},getRegistration:async()=>null}};
const sandbox={console,document,navigator,MessageChannel,setTimeout,clearTimeout,CustomEvent:function(type,options){this.type=type;this.detail=options?.detail},dispatchEvent(){},addEventListener(type,handler){listeners.set(type,handler);},globalThis:null};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'offline-campus-status-v211.js'});

const api=sandbox.CivweaveOfflineCampusStatusV211;
assert(api?.version?.includes('offline-campus-status-v211'),'Offline campus status API is not the production v211 reader.');
assert(api?.workerRevision==='offline-campus-current-graph-v280','Offline campus status reader is not aligned to the current worker graph.');
assert(api?.eagerStatusLookup===false&&api?.firstInputSafe===true,'Offline campus status reader lost its first-input-safe lazy lookup contract.');
assert(sandbox.CivweaveOfflineCampusStatusV210===api,'Legacy v210 API alias no longer points at the canonical v211 reader.');

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

api.render({type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',revision:'offline-campus-current-graph-v280',ready:false,attempted:53,downloaded:52,total:53,failed:[{pathname:'/app/explicit-required.js',required:true}],failedCount:1});
assert(nodes.get('#offline-package-state').textContent==='1 required file need retry','Explicit required failure is not distinguished in the production UI.');
assert(nodes.get('#download-offline-package').textContent==='Retry 1 required file','Explicit required retry action is incorrect.');

const ready=api.render({type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',revision:'offline-campus-current-graph-v280',ready:true,attempted:205,completed:205,total:205,failed:[],failedCount:0,bytes:17*1024*1024});
assert(ready.ready===true,'Complete package was not marked ready.');
assert(nodes.get('#offline-package-state').textContent==='ready offline','Ready state label is incorrect.');
assert(nodes.get('#offline-package-assets').textContent==='205/205 current files · 17 MB','Ready download count is incorrect.');
assert(nodes.get('#download-offline-package').textContent==='Refresh offline campus','Ready action label is incorrect.');

const retired=api.render({type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',revision:'offline-campus-current-graph-v280',ready:false,running:false,attempted:217,completed:217,downloaded:217,total:234,discovered:234,failed:[],failedCount:0,skipped:Array.from({length:17},(_,index)=>({pathname:`/retired-${index}.js`,reason:'stale-not-rediscovered'})),skippedCount:17});
assert(retired.total===217,'Retired references remained in the current-campus denominator.');
assert(retired.downloaded===217,'Retired references changed the downloaded count.');
assert(retired.ready===true,'A fully downloaded current campus with retired references was not marked ready.');
assert(retired.skippedCount===0&&retired.skipped.length===0,'Obsolete references were retained in normalized status.');
assert(nodes.get('#offline-package-state').textContent==='ready offline','Ready status still advertises obsolete references.');
assert(nodes.get('#offline-package-assets').textContent==='217/217 current files','Asset status still advertises obsolete references.');

assert(serviceWorkerListeners.has('message'),'Status reader does not listen for worker progress.');
assert(serviceWorkerListeners.has('controllerchange'),'Status reader does not refresh after service-worker controller changes once activated.');
assert(progressListeners.has('pointerdown')&&progressListeners.has('focusin'),'Status lookup is not gated behind explicit interaction with the offline-campus controls.');
assert(listeners.has('civweave:offline-campus-status-requested'),'Status reader lacks the explicit status-request event.');
assert(!listeners.has('load'),'Production v211 reader must not query the worker eagerly on page load.');
assert(!source.includes('registration.update(')&&!source.includes("postMessage({type:'SKIP_WAITING'"),'Status reader must remain read-only with respect to service-worker lifecycle.');

console.log(JSON.stringify({ok:true,revision:'offline-campus-status-v211-current-reader',workerRevision:api.workerRevision,runtimeVersion:api.version,legacyAttempted:205,legacyDownloaded:186,failedCount:19,obsoleteScenario:{reportedTotal:234,downloaded:217,obsoleteInput:17,currentTotal:retired.total,retainedReferences:retired.skippedCount,ready:retired.ready},contradictoryCountRemoved:true,requiredFailureLabel:true,liveWorkerProgress:true,eagerStatusLookup:false,lifecycleOwnership:'read-only-status-reader'},null,2));