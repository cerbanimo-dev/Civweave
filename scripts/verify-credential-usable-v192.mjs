import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

const [settingsSource,deviceSource,runtimeSource,legacyWorker,workerWrapper,workerCore,offlineManifestText,installBoundary]=await Promise.all([
  readFile('public/app/model-settings-controller-v173.js','utf8'),
  readFile('public/extensions/civweave-device-credentials-v160.js','utf8'),
  readFile('public/app/shared/civweave-model-runtime.js','utf8'),
  readFile('public/service-worker-v156.js','utf8'),
  readFile('public/service-worker-v203.js','utf8'),
  readFile('public/service-worker-core-v208.js','utf8'),
  readFile('public/app/offline-package-v208.json','utf8'),
  readFile('public/app/install-boundary-v146.js','utf8'),
]);
const offlineManifest=JSON.parse(offlineManifestText);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
class MemoryStorage{
  constructor(seed={}){this.values=new Map(Object.entries(seed))}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(key,String(value))}
  removeItem(key){this.values.delete(key)}
  clear(){this.values.clear()}
}
class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
class HTMLElement{}

const apiKey='test-gemini-key-not-real-v192';
const config={route:'gemini',provider:'gemini',model:'gemini-3.5-flash-lite',endpoint:'https://generativelanguage.googleapis.com/v1beta',externalConsent:true};
const persistent={schema:'civweave.device-model-secret.v191',apiKey,provider:'gemini',savedAt:'2026-08-05T00:00:00.000Z'};
const localStorage=new MemoryStorage({
  'civweave-model-persistent-secrets-v191':JSON.stringify(persistent),
  'civweave-model-credential-policy-v191':'device',
  'civweave-model-profiles-v1':JSON.stringify({interactive:config,agentic:null,agenticEnabled:false}),
  'civweave.universal-ai.v127':JSON.stringify({...config,consent:true}),
});
const sessionStorage=new MemoryStorage();
const listeners=new Map();
const controllerUrl='https://civweave.test/app/model-settings-controller-v173.js?activate=1';
const document={currentScript:{src:controllerUrl},documentElement:{dataset:{}},getElementById(){return null},querySelector(){return null},head:{append(){}},body:{append(){}}};
const sandbox={
  console,Date,Math,JSON,URL,TextEncoder,TextDecoder,AbortController,Headers,Request,Response,Promise,Set,Map,
  crypto:webcrypto,performance,localStorage,sessionStorage,CustomEvent,HTMLElement,document,
  location:{href:controllerUrl,origin:'https://civweave.test'},
  navigator:{userAgent:'Civweave v192 verifier'},
  fetch:async()=>new Response('{}',{status:200,headers:{'content-type':'application/json'}}),
  setTimeout,clearTimeout,setInterval,clearInterval,
  addEventListener(type,handler){const rows=listeners.get(type)||[];rows.push(handler);listeners.set(type,rows)},
  removeEventListener(){},
  dispatchEvent(event){for(const handler of listeners.get(event.type)||[])handler(event);return true},
  globalThis:null,window:null,self:null,
};
sandbox.globalThis=sandbox;sandbox.window=sandbox;sandbox.self=sandbox;
vm.createContext(sandbox);

vm.runInContext(settingsSource,sandbox,{filename:'model-settings-controller-v173.js'});
const controller=sandbox.CivweaveModelSettingsControllerV173;
assert(controller?.activationRequired===true,'Settings controller was not explicitly activated.');
assert(!sessionStorage.getItem('civweave-model-session'),'Settings controller restored credentials merely because the script was parsed.');
assert(controller.restoreRememberedCredential()===true,'Explicit Settings credential restore failed.');
const brokenSession=JSON.parse(sessionStorage.getItem('civweave-model-session'));
assert(brokenSession.apiKey===apiKey,'Settings controller did not restore the remembered key fixture.');
assert(brokenSession.remoteConsent===false,'Regression fixture no longer demonstrates the key-without-consent split.');

vm.runInContext(deviceSource,sandbox,{filename:'civweave-device-credentials-v160.js'});
const repairedSession=JSON.parse(sessionStorage.getItem('civweave-model-session'));
assert(repairedSession.apiKey===apiKey,'Credential bridge lost the remembered key.');
assert(repairedSession.remoteConsent===true,'Credential bridge did not restore saved external-request consent.');
const bridge=sandbox.CivweaveDeviceCredentialsV160;
assert(bridge.status().usable===true,'Credential bridge does not report the restored credential as usable.');
assert(bridge.restoresConsent===true&&bridge.mirrorsRuntimeSecret===true,'Credential bridge does not declare both halves of the repair.');

const secrets=JSON.parse(sessionStorage.getItem('civweave-model-secrets-v1'));
const secretRows=Object.values(secrets);
assert(secretRows.some(row=>row.apiKey===apiKey&&row.externalConsent===true),'Credential was not mirrored into the fingerprinted runtime secret store.');
const enriched=JSON.parse(localStorage.getItem('civweave-model-persistent-secrets-v191'));
assert(enriched.apiKey===apiKey&&enriched.remoteConsent===true,'Durable credential record was not enriched with consent.');

vm.runInContext(runtimeSource,sandbox,{filename:'civweave-model-runtime.js'});
const runtimeConfig=sandbox.CivweaveModelRuntime.readSharedConfig('interactive');
assert(runtimeConfig.apiKey===apiKey,'Real model runtime did not receive the remembered Gemini key.');
assert(runtimeConfig.externalConsent===true,'Real model runtime still considers external Gemini requests forbidden.');
assert(runtimeConfig.provider==='gemini','Real model runtime did not preserve the Gemini route.');

for(const forbidden of ['MutationObserver','setInterval('])assert(!deviceSource.includes(forbidden),`Credential repair introduced ${forbidden}.`);
for(const token of ['restoresConsent:true','mirrorsRuntimeSecret:true'])assert(deviceSource.includes(token),`Credential bridge is missing ${token}.`);
assert(legacyWorker.includes("importScripts('/service-worker-v203.js"),'Legacy registrations do not reach the active worker wrapper.');
assert(workerWrapper.includes("importScripts('/service-worker-core-v208.js"),'Active worker wrapper does not load the retained offline core.');
assert(workerCore.includes('discoverReferences')&&workerCore.includes('DOWNLOAD_OFFLINE_PACKAGE'),'Offline campus no longer discovers or stores dependencies.');
assert(offlineManifest.seeds.includes('/app/working-campus-v156.html'),'Offline campus no longer seeds the installed working campus.');
assert(offlineManifest.includePrefixes.includes('/extensions/'),'Offline campus excludes extension runtimes.');
assert(installBoundary.includes('/extensions/civweave-device-credentials-v160.js'),'Compatibility boundary no longer retains the explicit credential bridge.');

console.log(JSON.stringify({
  ok:true,
  revision:'v192-credential-usable-v317-explicit',
  activationRequired:true,
  moduleLoadMutation:false,
  reproduced:{keyPresent:true,consentLost:true},
  repaired:{keyPresent:true,consentRestored:true,fingerprintedSecret:true,runtimeUsable:true},
  offlinePackaged:'discovered-through-working-campus-install-boundary',
  freezeBoundary:{observer:false,polling:false},
},null,2));
