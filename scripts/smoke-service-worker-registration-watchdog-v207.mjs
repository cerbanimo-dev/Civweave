import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');

const installerSource=await fs.readFile('public/install-v130.js','utf8');
const updaterSource=await fs.readFile('public/app/pwa-update-controller-v204.js','utf8');
const boundarySource=await fs.readFile('public/app/install-boundary-v146.js','utf8');
const statusSource=await fs.readFile('public/app/offline-campus-status-v210.js','utf8');
const workerWrapperSource=await fs.readFile('public/service-worker-v203.js','utf8');
const workerCoreSource=await fs.readFile('public/service-worker-core-v208.js','utf8');
const offlineOverrideSource=await fs.readFile('public/service-worker-offline-v211-override.js','utf8');
const version=(await fs.readFile('VERSION','utf8')).trim();
const revision=installerSource.match(/const\s+WORKER_SCRIPT_REVISION\s*=\s*['"]([^'"]+)['"]/)?.[1];
assert.ok(revision,'Installer must expose a worker revision.');

for(const [pattern,message] of [
  [/const\s+REGISTRATION_TIMEOUT_MS\s*=\s*15000/,'Installer registration deadline is missing.'],
  [/const\s+REGISTRATION_QUERY_TIMEOUT_MS\s*=\s*6000/,'Installer registration-query deadline is missing.'],
  [/const\s+ACTIVATION_TIMEOUT_MS\s*=\s*45000/,'Installer activation deadline is missing.'],
  [/CIVWEAVE_PACKAGE_TIMEOUT/,'Installer timeout errors are not typed.'],
  [/recoverStalledRegistration/,'Installer one-shot recovery is missing.'],
  [/registration-recovery/,'Installer recovery reload marker is missing.'],
  [/navigator\.serviceWorker\.register\(WORKER_URL/,'Installer registration path is missing.'],
  [/registration\.update\(\)/,'Installer explicit update path is missing.'],
  [/navigator\.serviceWorker\.ready/,'Installer activation readiness check is missing.'],
  [/exactActive/,'Installer current-worker reuse path is missing.'],
  [/exactCandidate/,'Installer waiting-worker reuse path is missing.']
])assert.match(installerSource,pattern,message);
assert.match(updaterSource,/const\s+UPDATE_TIMEOUT_MS\s*=\s*15000/,'Installed updater deadline is missing.');
assert.match(updaterSource,/const\s+REGISTRATION_QUERY_TIMEOUT_MS\s*=\s*6000/,'Installed updater registration-query deadline is missing.');
assert.ok(updaterSource.includes('withTimeout(registration.update()'),'Installed updater must bound registration.update().');
assert.ok(updaterSource.includes("setState('Open updater','error'"),'Installed updater must expose a repair action after timeout.');
assert.ok(boundarySource.includes("const PWA_UPDATE_SCRIPT='/app/pwa-update-controller-v204.js'"),'Installed boundary no longer names the shared update controller.');
assert.ok(boundarySource.includes("canonicalSubsystemCompatibility:'route-version-settings-only-no-legacy-additions'"),'Canonical startup corridor changed unexpectedly.');
assert.ok(boundarySource.includes("const REVISION='browser-install-boundary-v228-chat-escape-install-only-pwa-v1';"),'Installed boundary lost the install-only browser revision.');
assert.ok(boundarySource.includes("browserRuntimePolicy:'installed-display-only'"),'Installed boundary no longer rejects browser runtime.');
assert.ok(!statusSource.includes('registration.update()'),'Offline status reader must not compete with the installer update watchdog.');
assert.ok(!statusSource.includes('SKIP_WAITING'),'Offline status reader must not activate workers behind the installer watchdog.');
assert.ok(workerWrapperSource.includes('/service-worker-core-v208.js'),'Active worker wrapper omits the retained core.');
assert.ok(workerWrapperSource.includes('working-campus-return-v425-install-only-pwa-v1'),'Active worker wrapper omits install-only cache refresh.');
assert.ok(workerWrapperSource.includes('/service-worker-chat-repair-v245.js?v=chat-avatar-visible-v346&purge=chat-avatar-visible-v346'),'Active worker wrapper omits current avatar/chat migration.');
assert.ok(workerWrapperSource.includes('/service-worker-shell-repair-v225.js?v=shell-self-repair-v225-install-only-pwa-v1'),'Active worker wrapper omits install-only repair refresh.');
assert.ok(workerCoreSource.includes("const BUILD = 'lightweight-shell-v208-installer-brand-v1-working-campus-return-v425'"),'Worker core build identity drifted.');
assert.ok(offlineOverrideSource.includes("const V211_POLICY = 'resumable-pause-v280'"),'Offline resume/pause policy is missing.');

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function makeStorage(initial={}){const values=new Map(Object.entries(initial));return{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}}
function makeNode(){const listeners=new Map();return{textContent:'',disabled:false,dataset:{},title:'',isConnected:true,classList:{add(){},remove(){}},addEventListener:(type,listener)=>listeners.set(type,listener),setAttribute(){},append(){},click(){listeners.get('click')?.({})}}}
function makeInstallerContext({getRegistration,register,getRegistrations=async()=>[],ready=Promise.resolve(),cacheNames=['cwknowledge-school-seeds-v2'],session={}}){
  const selectors=['#install-help','#install-app','#check-update','#package-state','#package-assets','#local-mode','#offline-package-state','#offline-package-assets','#download-offline-package'];
  const nodes=new Map(selectors.map(selector=>[selector,makeNode()]));
  const deleted=[];let names=[...cacheNames];
  const caches={keys:async()=>[...names],delete:async name=>{deleted.push(name);names=names.filter(item=>item!==name);return true},open:async()=>({keys:async()=>[],match:async()=>null,put:async()=>{}})};
  const sessionStorage=makeStorage(session),localStorage=makeStorage();
  const location={origin:'https://example.test',href:'https://example.test/',pathname:'/',replaced:null,assigned:null,replace(url){this.replaced=String(url)},assign(url){this.assigned=String(url)}};
  const serviceWorker={getRegistration,register,getRegistrations,ready,controller:null,addEventListener(){}};
  class FakeMessageChannel{constructor(){this.port1={onmessage:null,close(){}};this.port2={deliver:data=>setTimeout(()=>this.port1.onmessage?.({data}),0)}}}
  const context={console,URL,Date,Promise,Error,setTimeout,clearTimeout,location,navigator:{standalone:false,onLine:true,userAgent:'Chrome watchdog test',serviceWorker},caches,sessionStorage,localStorage,MessageChannel:FakeMessageChannel,matchMedia:()=>({matches:false}),addEventListener(){},removeEventListener(){},document:{documentElement:{isConnected:true,dataset:{}},head:{isConnected:true,append(){}},body:{isConnected:true,append(){}},querySelector:selector=>nodes.get(selector)||null}};
  context.window=context;context.globalThis=context;return{context,location,nodes,deleted,sessionStorage};
}
const acceleratedInstaller=installerSource.replace(/const\s+REGISTRATION_TIMEOUT_MS\s*=\s*15000\s*;/,'const REGISTRATION_TIMEOUT_MS = 25;').replace(/const\s+REGISTRATION_QUERY_TIMEOUT_MS\s*=\s*6000\s*;/,'const REGISTRATION_QUERY_TIMEOUT_MS = 25;').replace(/const\s+ACTIVATION_TIMEOUT_MS\s*=\s*45000\s*;/,'const ACTIVATION_TIMEOUT_MS = 120;');
const recoveryKey='civweave.shell.registration-watchdog.v208';

{
  const harness=makeInstallerContext({getRegistration:async()=>null,register:()=>new Promise(()=>{}),getRegistrations:async()=>[],cacheNames:['cwknowledge-school-seeds-v2','civweave-stale-package']});
  vm.runInNewContext(acceleratedInstaller,harness.context,{filename:'install-watchdog-stall.js'});harness.nodes.get('#check-update').click();await delay(300);
  assert.match(harness.location.replaced||'',/registration-recovery=/,'A stalled registration did not trigger one automatic recovery reload.');
  assert.ok(harness.deleted.includes('civweave-stale-package'),'Automatic recovery did not clear stale app caches.');
  assert.ok(!harness.deleted.includes('cwknowledge-school-seeds-v2'),'Automatic recovery deleted protected knowledge cache.');
  assert.equal(harness.sessionStorage.getItem(recoveryKey),'1','Automatic recovery was not one-shot.');
}
{
  const harness=makeInstallerContext({getRegistration:async()=>null,register:()=>new Promise(()=>{}),getRegistrations:async()=>[],session:{[recoveryKey]:'1'}});
  vm.runInNewContext(acceleratedInstaller,harness.context,{filename:'install-watchdog-repeat.js'});harness.nodes.get('#check-update').click();await delay(100);
  assert.equal(harness.location.replaced,null,'A second watchdog failure entered a reload loop.');
  assert.equal(harness.nodes.get('#install-app').textContent,'Reset app shell and retry','A repeated stall did not expose manual recovery.');
}
{
  let registerCalls=0;
  const responses={GET_DEVICE_PACKAGE_STATUS:{type:'CIVWEAVE_DEVICE_PACKAGE',mode:'lightweight-shell',ready:true,missing:[],assetCount:10,presentCount:10},GET_OFFLINE_PACKAGE_STATUS:{type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',ready:true,running:false,total:186,completed:186,failed:[],failedCount:0}};
  const worker={state:'activated',scriptURL:`https://example.test/service-worker-v203.js?v=${version}-lightweight-shell-v208&revision=${revision}`,postMessage(message,ports){ports?.[0]?.deliver(responses[message.type]||null)}};
  const registration={scope:'https://example.test/',active:worker,waiting:null,installing:null,update:async()=>registration,unregister:async()=>true,addEventListener(){}};
  const harness=makeInstallerContext({getRegistration:async()=>registration,register:async()=>{registerCalls+=1;return registration},ready:Promise.resolve(registration)});
  vm.runInNewContext(acceleratedInstaller,harness.context,{filename:'install-watchdog-current.js'});harness.nodes.get('#check-update').click();await delay(100);
  assert.equal(registerCalls,0,'An already-current active worker was redundantly registered.');
  assert.equal(harness.nodes.get('#package-state').textContent,'ready','Reused worker did not complete shell readiness.');
  assert.equal(harness.nodes.get('#install-app').textContent,`Install Civweave v${version}`,'Install button did not become available after current-worker reuse.');
}
{
  const acceleratedUpdater=updaterSource.replace(/const\s+UPDATE_TIMEOUT_MS\s*=\s*15000\s*;/,'const UPDATE_TIMEOUT_MS=25;').replace(/const\s+REGISTRATION_QUERY_TIMEOUT_MS\s*=\s*6000\s*;/,'const REGISTRATION_QUERY_TIMEOUT_MS=25;');
  let updateButton=null;const makeElement=tag=>{const node=makeNode();node.tagName=tag.toUpperCase();return node};
  const document={readyState:'complete',documentElement:{isConnected:true,dataset:{}},head:{isConnected:true,append(){}},body:{isConnected:true,append(node){if(node.dataset?.civweaveUpdateControl!==undefined)updateButton=node}},getElementById:()=>null,querySelector:selector=>selector==='[data-civweave-update-control]'?updateButton:null,createElement:makeElement};
  class FakeMutationObserver{constructor(callback){this.callback=callback}observe(){}disconnect(){}}
  const registration={active:{scriptURL:'https://example.test/service-worker-v203.js'},waiting:null,installing:null,update:()=>new Promise(()=>{})};
  const context={console,URL,Promise,Error,Date,setTimeout,clearTimeout,document,MutationObserver:FakeMutationObserver,matchMedia:()=>({matches:false}),addEventListener(){},removeEventListener(){},navigator:{standalone:false,onLine:true,serviceWorker:{controller:null,getRegistration:async()=>registration,addEventListener(){}}},caches:{keys:async()=>[],open:async()=>({keys:async()=>[],match:async()=>null,put:async()=>{}}),delete:async()=>true},sessionStorage:makeStorage(),localStorage:makeStorage(),location:{pathname:'/',assigned:null,assign(url){this.assigned=String(url)},reload(){}}};
  context.window=context;context.globalThis=context;vm.runInNewContext(acceleratedUpdater,context,{filename:'installed-update-watchdog.js'});await context.CivweavePwaUpdateV204.checkForUpdates(true);
  assert.equal(updateButton.textContent,'Open updater','A stalled in-app update did not become a visible repair action.');assert.equal(updateButton.dataset.state,'error','A stalled in-app update did not leave checking state.');
}
console.log(JSON.stringify({ok:true,revision:'current-registration-watchdog-install-only-v1',version,workerRevision:revision,registrationDeadline:true,activationDeadline:true,exactWorkerReuse:true,oneShotRecovery:true,knowledgeCachePreserved:true,inAppUpdateRepairAction:true,browserRuntime:false},null,2));
