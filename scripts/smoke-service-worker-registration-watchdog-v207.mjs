import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const installerSource=await fs.readFile('public/install-v130.js','utf8');
const updaterSource=await fs.readFile('public/app/pwa-update-controller-v204.js','utf8');
const wrapperSource=await fs.readFile('public/service-worker-v203.js','utf8');
const updateWorkerSource=await fs.readFile('public/service-worker-update-v204.js','utf8');
const boundarySource=await fs.readFile('public/app/install-boundary-v146.js','utf8');
const indexSource=await fs.readFile('public/index.html','utf8');

for(const token of [
  'REGISTRATION_TIMEOUT_MS=15000',
  'UPDATE_TIMEOUT_MS=15000',
  'REGISTRATION_QUERY_TIMEOUT_MS=6000',
  'COMMONWEAVE_PACKAGE_TIMEOUT',
  'recoverStalledRegistration',
  "registration-recovery",
  'navigator.serviceWorker.register(WORKER_URL',
  'registration.update()',
  'navigator.serviceWorker.ready',
  'exactActive',
  'exactCandidate',
])assert(installerSource.includes(token),`Installer watchdog is missing ${token}`);

for(const token of [
  "const VERSION='v207-registration-watchdog'",
  'UPDATE_TIMEOUT_MS=15000',
  'withTimeout(registration.update()',
  "setState('Open updater','error'",
])assert(updaterSource.includes(token),`Installed updater is missing ${token}`);

assert(wrapperSource.includes("visible-update-library-preservation-v207-registration-watchdog"),'Composite worker does not refresh the v207 update lane.');
assert(updateWorkerSource.includes("const CACHE='cwupdate-visible-v207'"),'Update controls are not isolated in the v207 cache.');
assert(boundarySource.includes("const ADDITIONS_VERSION='v207-registration-watchdog'"),'Installed pages do not cache-bust the v207 update controller.');
assert(indexSource.includes('/install-v130.js?v=1.0.6-registration-watchdog-v207'),'Gateway does not cache-bust the watchdog installer.');

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function makeStorage(initial={}){
  const values=new Map(Object.entries(initial));
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
    dump:()=>Object.fromEntries(values),
  };
}

function makeNode(){
  const listeners=new Map();
  return {
    textContent:'',
    disabled:false,
    dataset:{},
    title:'',
    isConnected:true,
    classList:{add(){},remove(){}},
    addEventListener:(type,listener)=>listeners.set(type,listener),
    setAttribute(){},
    append(){},
    click(){listeners.get('click')?.({})},
  };
}

function makeInstallerContext({getRegistration,register,getRegistrations=async()=>[],ready=Promise.resolve(),cacheNames=['cwknowledge-school-seeds-v2'],session={}}){
  const nodes=new Map(['#install-help','#install-app','#check-update','#package-state','#package-assets','#local-mode'].map(selector=>[selector,makeNode()]));
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
      this.port1={onmessage:null};
      this.port2={deliver:data=>setTimeout(()=>this.port1.onmessage?.({data}),0)};
    }
  }
  const context={
    console,
    URL,
    Date,
    Promise,
    Error,
    setTimeout,
    clearTimeout,
    location,
    navigator:{standalone:false,onLine:true,userAgent:'Chrome watchdog test',serviceWorker},
    caches,
    sessionStorage,
    localStorage,
    MessageChannel:FakeMessageChannel,
    matchMedia:()=>({matches:false}),
    addEventListener(){},
    document:{querySelector:selector=>nodes.get(selector)||null},
  };
  context.window=context;
  context.globalThis=context;
  return {context,location,nodes,deleted,sessionStorage,serviceWorker};
}

const acceleratedInstaller=installerSource
  .replace('const PREPARE_TIMEOUT_MS=180000;','const PREPARE_TIMEOUT_MS=120;')
  .replace('const REGISTRATION_TIMEOUT_MS=15000;','const REGISTRATION_TIMEOUT_MS=25;')
  .replace('const UPDATE_TIMEOUT_MS=15000;','const UPDATE_TIMEOUT_MS=25;')
  .replace('const REGISTRATION_QUERY_TIMEOUT_MS=6000;','const REGISTRATION_QUERY_TIMEOUT_MS=25;');

{
  const harness=makeInstallerContext({
    getRegistration:async()=>null,
    register:()=>new Promise(()=>{}),
    getRegistrations:async()=>[],
    cacheNames:['cwknowledge-school-seeds-v2','commonweave-stale-package'],
  });
  vm.runInNewContext(acceleratedInstaller,harness.context,{filename:'install-watchdog-stall.js'});
  await delay(450);
  assert.match(harness.location.replaced||'',/registration-recovery=/,'A stalled registration did not trigger one automatic recovery reload.');
  assert(harness.deleted.includes('commonweave-stale-package'),'Automatic recovery did not clear stale app caches.');
  assert(!harness.deleted.includes('cwknowledge-school-seeds-v2'),'Automatic recovery deleted the protected knowledge cache.');
  assert.equal(harness.sessionStorage.getItem('commonweave.device-package.registration-watchdog.v107-r1'),'1','Automatic recovery was not guarded as one-shot.');
}

{
  const harness=makeInstallerContext({
    getRegistration:async()=>null,
    register:()=>new Promise(()=>{}),
    getRegistrations:async()=>[],
    session:{'commonweave.device-package.registration-watchdog.v107-r1':'1'},
  });
  vm.runInNewContext(acceleratedInstaller,harness.context,{filename:'install-watchdog-repeat.js'});
  await delay(100);
  assert.equal(harness.location.replaced,null,'A second watchdog failure entered a reload loop.');
  assert.equal(harness.nodes.get('#install-app').textContent,'Reset app package and retry','A repeated stall did not expose manual recovery.');
  assert.match(harness.nodes.get('#install-help').textContent,/Automatic recovery already ran once/,'Repeated stall guidance is not explicit.');
}

{
  const constant=name=>installerSource.match(new RegExp(`const ${name}='([^']+)'`))?.[1];
  const build=[constant('VERSION'),constant('WORKER_REVISION'),constant('ADDITIONS_REVISION'),constant('UPDATE_REVISION')].join('-');
  let registerCalls=0;
  const responses={
    GET_SHARED_IMAGE_STATUS:{type:'COMMONWEAVE_SHARED_IMAGE_STATUS',ready:true,missing:[],total:5},
    GET_CRITICAL_BOOT_STATUS:{type:'COMMONWEAVE_CRITICAL_BOOT_STATUS',mode:'flat',ready:true,missing:[],total:4,fullPackage:{baseCount:111,extensionCount:53}},
    GET_DEVICE_PACKAGE_STATUS:{type:'COMMONWEAVE_DEVICE_PACKAGE',ready:true,missing:[],assetCount:111},
    GET_ADDITIONS_STATUS:{type:'COMMONWEAVE_ADDITIONS_STATUS',ready:true,missing:[],assetCount:53},
  };
  const worker={
    state:'activated',
    scriptURL:`https://example.test/service-worker-v203.js?v=${build}`,
    postMessage(message,ports){ports?.[0]?.deliver(responses[message.type]||null)},
  };
  const registration={scope:'https://example.test/',active:worker,waiting:null,installing:null,update:async()=>registration,unregister:async()=>true};
  const harness=makeInstallerContext({
    getRegistration:async()=>registration,
    register:async()=>{registerCalls+=1;return registration},
    ready:Promise.resolve(registration),
  });
  vm.runInNewContext(acceleratedInstaller,harness.context,{filename:'install-watchdog-current.js'});
  await delay(100);
  assert.equal(registerCalls,0,'An already-current active worker was redundantly registered.');
  assert.equal(harness.nodes.get('#package-state').textContent,'complete','The reused current worker did not complete package readiness.');
  assert.equal(harness.nodes.get('#install-app').textContent,'Install Commonweave v1.0.6','The install button did not become available after current-worker reuse.');
}

{
  const acceleratedUpdater=updaterSource
    .replace('const UPDATE_TIMEOUT_MS=15000;','const UPDATE_TIMEOUT_MS=25;')
    .replace('const REGISTRATION_QUERY_TIMEOUT_MS=6000;','const REGISTRATION_QUERY_TIMEOUT_MS=25;');
  let updateButton=null;
  const makeElement=tag=>{
    const node=makeNode();
    node.tagName=tag.toUpperCase();
    return node;
  };
  const document={
    readyState:'complete',
    documentElement:{},
    head:{append(node){}},
    body:{append(node){if(node.dataset?.commonweaveUpdateControl!==undefined)updateButton=node}},
    getElementById:()=>null,
    querySelector:selector=>selector==='[data-commonweave-update-control]'?updateButton:null,
    createElement:makeElement,
  };
  class FakeMutationObserver{constructor(callback){this.callback=callback}observe(){}}
  const registration={active:{scriptURL:'https://example.test/service-worker-v203.js'},waiting:null,installing:null,update:()=>new Promise(()=>{})};
  const context={
    console,
    URL,
    Promise,
    Error,
    setTimeout,
    clearTimeout,
    document,
    MutationObserver:FakeMutationObserver,
    matchMedia:()=>({matches:false}),
    navigator:{standalone:false,onLine:true,serviceWorker:{controller:null,getRegistration:async()=>registration,addEventListener(){}}},
    caches:{keys:async()=>[],open:async()=>({keys:async()=>[],match:async()=>null,put:async()=>{}}),delete:async()=>true},
    sessionStorage:makeStorage(),
    localStorage:makeStorage(),
    location:{assigned:null,assign(url){this.assigned=String(url)},reload(){}},
  };
  context.window=context;
  context.globalThis=context;
  vm.runInNewContext(acceleratedUpdater,context,{filename:'installed-update-watchdog.js'});
  await context.CommonweavePwaUpdateV204.checkForUpdates(true);
  assert.equal(updateButton.textContent,'Open updater','A stalled in-app update did not become a visible repair action.');
  assert.equal(updateButton.dataset.state,'error','A stalled in-app update did not leave checking state.');
}

console.log(JSON.stringify({
  ok:true,
  revision:'v207-registration-watchdog',
  registrationDeadline:true,
  updateDeadline:true,
  readyDeadline:true,
  exactWorkerReuse:true,
  oneShotRecovery:true,
  knowledgeCachePreserved:true,
  inAppUpdateRepairAction:true,
},null,2));
