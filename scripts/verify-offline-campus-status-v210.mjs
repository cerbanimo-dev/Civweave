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
const document={
  documentElement:{dataset:{}},
  querySelector(selector){return nodes.get(selector)||null;}
};
const navigator={
  serviceWorker:{
    controller:null,
    addEventListener(type,handler){serviceWorkerListeners.set(type,handler);}
  }
};
const sandbox={
  console,document,navigator,MessageChannel,setTimeout,clearTimeout,
  addEventListener(type,handler){listeners.set(type,handler);},
  globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'offline-campus-status-v210.js'});

const api=sandbox.CommonweaveOfflineCampusStatusV210;
assert(api?.version==='1.0.6-offline-campus-status-v210','Offline campus status repair API is missing.');

const legacy=api.normalize({
  type:'COMMONWEAVE_OFFLINE_PACKAGE_STATUS',
  revision:'lightweight-shell-v208',
  ready:false,
  completed:205,
  total:205,
  failedCount:19,
  failed:Array.from({length:19},(_,index)=>({pathname:`/failed-${index}.js`})),
  bytes:17*1024*1024
});
assert(legacy.attempted===205,'Legacy status did not preserve attempted count.');
assert(legacy.downloaded===186,'Legacy attempted count was still presented as downloaded count.');
assert(legacy.ready===false,'A package with failed files was marked ready.');

const current=api.normalize({
  type:'COMMONWEAVE_OFFLINE_PACKAGE_STATUS',
  revision:'lightweight-shell-v210',
  ready:false,
  attempted:205,
  completed:186,
  total:205,
  failedCount:19
});
assert(current.downloaded===186&&current.attempted===205,'Current successful and attempted counts were not kept separate.');

api.render({
  type:'COMMONWEAVE_OFFLINE_PACKAGE_STATUS',
  revision:'lightweight-shell-v208',
  ready:false,
  completed:205,
  total:205,
  failedCount:19,
  failed:Array.from({length:19},(_,index)=>({pathname:`/failed-${index}.js`})),
  bytes:17*1024*1024
});
assert(nodes.get('#offline-package-state').textContent==='19 files need retry','Retry state label is incorrect.');
assert(nodes.get('#offline-package-assets').textContent==='186/205 files · 205/205 checked · 17 MB','Downloaded display remains contradictory.');
assert(nodes.get('#download-offline-package').textContent==='Retry 19 missing files','Retry action label is incorrect.');

const ready=api.render({
  type:'COMMONWEAVE_OFFLINE_PACKAGE_STATUS',
  revision:'lightweight-shell-v210',
  ready:true,
  attempted:205,
  completed:205,
  total:205,
  failed:[],
  failedCount:0,
  bytes:17*1024*1024
});
assert(ready.ready===true,'Complete package was not marked ready.');
assert(nodes.get('#offline-package-state').textContent==='ready offline','Ready state label is incorrect.');
assert(nodes.get('#offline-package-assets').textContent==='205/205 files · 17 MB','Ready download count is incorrect.');
assert(nodes.get('#download-offline-package').textContent==='Refresh offline campus','Ready action label is incorrect.');
assert(serviceWorkerListeners.has('message'),'Status repair does not listen for worker progress.');
assert(listeners.has('load'),'Status repair does not query the current worker after page load.');

console.log(JSON.stringify({
  ok:true,
  revision:'offline-campus-status-v210',
  legacyAttempted:205,
  legacyDownloaded:186,
  failedCount:19,
  contradictoryCountRemoved:true,
  liveWorkerProgressRepair:true
},null,2));
