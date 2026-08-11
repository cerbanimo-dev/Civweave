import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const installerSource=await fs.readFile('public/install-v130.js','utf8');
const updaterSource=await fs.readFile('public/app/pwa-update-controller-v204.js','utf8');
const workerSource=await fs.readFile('public/service-worker-v203.js','utf8');
const updateWorkerSource=await fs.readFile('public/service-worker-update-v204.js','utf8');
const boundarySource=await fs.readFile('public/app/install-boundary-v146.js','utf8');
const indexSource=await fs.readFile('public/index.html','utf8');
const statusSource=await fs.readFile('public/app/offline-campus-status-v210.js','utf8');

const has=(source,pattern,message)=>assert.match(source,pattern,message);
has(installerSource,/const\s+REGISTRATION_TIMEOUT_MS\s*=\s*15000/,'Installer registration deadline is missing.');
has(installerSource,/const\s+REGISTRATION_QUERY_TIMEOUT_MS\s*=\s*6000/,'Installer registration-query deadline is missing.');
has(installerSource,/const\s+ACTIVATION_TIMEOUT_MS\s*=\s*45000/,'Installer activation deadline is missing.');
has(installerSource,/const\s+WORKER_SCRIPT_REVISION\s*=\s*['"]stable-entry-v217['"]/,'Stable entry worker revision is missing.');
assert(installerSource.includes("url.searchParams.get('revision') === WORKER_SCRIPT_REVISION"),'Installer accepts a stale worker without the stable-entry revision.');
for(const token of [
  'CIVWEAVE_PACKAGE_TIMEOUT',
  'recoverStalledRegistration',
  'registration-recovery',
  'navigator.serviceWorker.register(WORKER_URL',
  'registration.update()',
  'navigator.serviceWorker.ready',
  'exactActive',
  'exactCandidate',
])assert(installerSource.includes(token),`Installer watchdog is missing ${token}`);

has(updaterSource,/const\s+VERSION\s*=\s*['"]v207-registration-watchdog['"]/,'Installed updater revision is missing.');
has(updaterSource,/const\s+UPDATE_TIMEOUT_MS\s*=\s*15000/,'Installed updater deadline is missing.');
assert(updaterSource.includes('withTimeout(registration.update()'),'Installed updater does not bound registration.update().');
assert(updaterSource.includes("setState('Open updater','error'"),'Installed updater lacks a visible repair action.');

assert(workerSource.startsWith('// GENERATED: lightweight-shell-v208 core + offline-campus-seed-provenance-v211'),'Generated lightweight worker marker is missing.');
assert(workerSource.includes("const BUILD = 'lightweight-shell-v208'"),'Verified lightweight worker core is missing.');
assert(workerSource.includes("const V211_REVISION = 'offline-campus-seed-provenance-v211'"),'Offline retry-loop repair is missing.');
assert(updateWorkerSource.includes("const CACHE='cwupdate-visible-v207'"),'Update controls are not isolated in the v207 cache.');
assert(boundarySource.includes("const ADDITIONS_VERSION='v207-registration-watchdog'"),'Installed pages do not cache-bust the v207 update controller.');
assert(indexSource.includes('/install-v130.js?v=1.0.7-lightweight-shell-v208'),'Gateway does not load the lightweight installer.');
assert(indexSource.includes('offline-retry-loop-v211'),'Gateway does not cache-bust the retry-loop repair.');
assert(statusSource.includes('registration.update()'),'Offline status repair does not force-check the current worker.');

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function makeStorage(initial={}){
  const values=new Map(Object.entries(initial));
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
  };
}

function makeNode(){
  const listeners=new Map();
  return {
    textContent:'',disabled:false,dataset:{},title:'',isConnected:true,
    classList:{add(){},remove(){}},
    addEventListener:(type,listener)=>listeners.set(type,listener),
    setAttribute(){},append(){},click(){listeners.get('click')?.({})},
  };
}

function makeInstallerContext({getRegistration,register,getRegistrations=async()=>[],ready=Promise.resolve(),cacheNames=['cwknowledge-school-seeds-v2'],session={}}){
  const selectors=[
    '#install-help','#install-app','#check-update','#package-state','#package-assets','#local-mode',
    '#offline-package-state','#offline-package-assets','#download-offline-package'
  ];
  const nodes=new Map(selectors.map(selector=>[selector,makeNode()]));
  const deleted=[];
  let names=[...cacheNames];
  const caches={
    keys:async()=>[...names],
    delete:async name=>{deleted.push(name);names=names.filter(item=>item!==name);return true},
    open:async()=>({keys:async()=>[],match:async()=>null,put:async()=>{}}),
  };
  const sessionStorage=makeStorage(session);
  const localStorage=makeStorage();
  const location={origin:'https://example.test',href:'https://example.test/',replaced:null,assigned:null,replace(url){this.replaced=String(url)},assign(url){this.assigned=String(url)}};
  const serviceWorker={getRegistration,register,getRegistrations,ready,controller:null,addEventListener(){}};
  class FakeMessageChannel{
    constructor(){
      this.port1={onmessage:null,close(){}};
      this.port2={deliver:data=>setTimeout(()=>this.port1.onmessage?.({data}),0)};
    }
  }
  const context={
    console,URL,Date,Promise,Error,setTimeout,clearTimeout,location,
    navigator:{standalone:false,onLine:true,userAgent:'Chrome watchdog test',serviceWorker},
    caches,sessionStorage,localStorage,MessageChannel:FakeMessageChannel,
    matchMedia:()=>({matches:false}),addEventListener(){},
    document:{querySelector:selector=>nodes.get(selector)||null},
  };
  context.window=context;
  context.globalThis=context;
  return {context,location,nodes,deleted,sessionStorage};
}

const acceleratedInstaller=installerSource
  .replace(/const\s+REGISTRATION_TIMEOUT_MS\s*=\s*15000\s*;/,'const REGISTRATION_TIMEOUT_MS = 25;')
  .replace(/const\s+REGISTRATION_QUERY_TIMEOUT_MS\s*=\s*6000\s*;/,'const REGISTRATION_QUERY_TIMEOUT_MS = 25;')
  .replace(/const\s+ACTIVATION_TIMEOUT_MS\s*=\s*45000\s*;/,'const ACTIVATION_TIMEOUT_MS = 120;');
const recoveryKey='civweave.shell.registration-watchdog.v208';

{
  const harness=makeInstallerContext({
    getRegistration:async()=>null,
    register:()=>new Promise(()=>{}),
    getRegistrations:async()=>[],
    cacheNames:['cwknowledge-school-seeds-v2','civweave-stale-package'],
  });
  vm.runInNewContext(acceleratedInstaller,harness.context,{filename:'install-watchdog-stall.js'});
  harness.nodes.get('#check-update').click();
  await delay(450);
  assert.match(harness.location.replaced||'',/registration-recovery=/,'A stalled registration did not trigger one automatic recovery reload.');
  assert(harness.deleted.includes('civweave-stale-package'),'Automatic recovery did not clear stale app caches.');
  assert(!harness.deleted.includes('cwknowledge-school-seeds-v2'),'Automatic recovery deleted the protected knowledge cache.');
  assert.equal(harness.sessionStorage.getItem(recoveryKey),'1','Automatic recovery was not guarded as one-shot.');
}

{
  const harness=makeInstallerContext({
    getRegistration:async()=>null,
    register:()=>new Promise(()=>{}),
    getRegistrations:async()=>[],
    session:{[recoveryKey]:'1'},
  });
  vm.runInNewContext(acceleratedInstaller,harness.context,{filename:'install-watchdog-repeat.js'});
  harness.nodes.get('#check-update').click();
  await delay(120);
  assert.equal(harness.location.replaced,null,'A second watchdog failure entered a reload loop.');
  assert.equal(harness.nodes.get('#install-app').textContent,'Reset app shell and retry','A repeated stall did not expose manual recovery.');
  assert.match(harness.nodes.get('#install-help').textContent,/Automatic recovery already ran once/,'Repeated stall guidance is not explicit.');
}

{
  let registerCalls=0;
  const responses={
    GET_DEVICE_PACKAGE_STATUS:{type:'CIVWEAVE_DEVICE_PACKAGE',mode:'lightweight-shell',ready:true,missing:[],assetCount:10,presentCount:10},
    GET_OFFLINE_PACKAGE_STATUS:{type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',ready:true,running:false,total:186,completed:186,failed:[],failedCount:0},
  };
  const worker={
    state:'activated',
    scriptURL:'https://example.test/service-worker-v203.js?v=1.0.7-lightweight-shell-v208&revision=stable-entry-v217',
    postMessage(message,ports){ports?.[0]?.deliver(responses[message.type]||null)},
  };
  const registration={scope:'https://example.test/',active:worker,waiting:null,installing:null,update:async()=>registration,unregister:async()=>true,addEventListener(){}};
  const harness=makeInstallerContext({
    getRegistration:async()=>registration,
    register:async()=>{registerCalls+=1;return registration},
    ready:Promise.resolve(registration),
  });
  vm.runInNewContext(acceleratedInstaller,harness.context,{filename:'install-watchdog-current.js'});
  harness.nodes.get('#check-update').click();
  await delay(120);
  assert.equal(registerCalls,0,'An already-current active worker was redundantly registered.');
  assert.equal(harness.nodes.get('#package-state').textContent,'ready','The reused current worker did not complete shell readiness.');
  assert.equal(harness.nodes.get('#install-app').textContent,'Install Civweave v1.0.7','The install button did not become available after current-worker reuse.');
}

{
  const acceleratedUpdater=updaterSource
    .replace(/const\s+UPDATE_TIMEOUT_MS\s*=\s*15000\s*;/,'const UPDATE_TIMEOUT_MS=25;')
    .replace(/const\s+REGISTRATION_QUERY_TIMEOUT_MS\s*=\s*6000\s*;/,'const REGISTRATION_QUERY_TIMEOUT_MS=25;');
  let updateButton=null;
  const makeElement=tag=>{const node=makeNode();node.tagName=tag.toUpperCase();return node};
  const document={
    readyState:'complete',documentElement:{},head:{append(){}},
    body:{append(node){if(node.dataset?.civweaveUpdateControl!==undefined)updateButton=node}},
    getElementById:()=>null,
    querySelector:selector=>selector==='[data-civweave-update-control]'?updateButton:null,
    createElement:makeElement,
  };
  class FakeMutationObserver{constructor(callback){this.callback=callback}observe(){}}
  const registration={active:{scriptURL:'https://example.test/service-worker-v203.js'},waiting:null,installing:null,update:()=>new Promise(()=>{})};
  const context={
    console,URL,Promise,Error,setTimeout,clearTimeout,document,MutationObserver:FakeMutationObserver,
    matchMedia:()=>({matches:false}),
    navigator:{standalone:false,onLine:true,serviceWorker:{controller:null,getRegistration:async()=>registration,addEventListener(){}}},
    caches:{keys:async()=>[],open:async()=>({keys:async()=>[],match:async()=>null,put:async()=>{}}),delete:async()=>true},
    sessionStorage:makeStorage(),localStorage:makeStorage(),location:{assigned:null,assign(url){this.assigned=String(url)},reload(){}},
  };
  context.window=context;
  context.globalThis=context;
  vm.runInNewContext(acceleratedUpdater,context,{filename:'installed-update-watchdog.js'});
  await context.CivweavePwaUpdateV204.checkForUpdates(true);
  assert.equal(updateButton.textContent,'Open updater','A stalled in-app update did not become a visible repair action.');
  assert.equal(updateButton.dataset.state,'error','A stalled in-app update did not leave checking state.');
}

console.log(JSON.stringify({
  ok:true,
  revision:'v211-lightweight-registration-watchdog',
  registrationDeadline:true,
  activationDeadline:true,
  exactWorkerReuse:true,
  oneShotRecovery:true,
  knowledgeCachePreserved:true,
  retryLoopRepairCacheBusted:true,
  inAppUpdateRepairAction:true,
},null,2));
