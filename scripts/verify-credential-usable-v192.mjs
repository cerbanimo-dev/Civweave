import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

const [settingsSource,deviceSource,runtimeSource,workerSource]=await Promise.all([
  readFile('public/app/model-settings-controller-v173.js','utf8'),
  readFile('public/extensions/commonweave-device-credentials-v160.js','utf8'),
  readFile('public/app/shared/commonweave-model-runtime.js','utf8'),
  readFile('public/service-worker-v156.js','utf8'),
]);
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

const apiKey='AIza-v192-test-key-not-real';
const config={route:'gemini',provider:'gemini',model:'gemini-3.5-flash-lite',endpoint:'https://generativelanguage.googleapis.com/v1beta',externalConsent:true};
const persistent={schema:'commonweave.device-model-secret.v191',apiKey,provider:'gemini',savedAt:'2026-08-05T00:00:00.000Z'};
const localStorage=new MemoryStorage({
  'commonweave-model-persistent-secrets-v191':JSON.stringify(persistent),
  'commonweave-model-credential-policy-v191':'device',
  'commonweave-model-profiles-v1':JSON.stringify({interactive:config,agentic:null,agenticEnabled:false}),
  'commonweave.universal-ai.v127':JSON.stringify({...config,consent:true}),
});
const sessionStorage=new MemoryStorage();
const listeners=new Map();
const document={documentElement:{dataset:{}},getElementById(){return null},querySelector(){return null},head:{append(){}},body:{append(){}}};
const sandbox={
  console,Date,Math,JSON,URL,TextEncoder,TextDecoder,AbortController,Headers,Request,Response,Promise,Set,Map,
  crypto:webcrypto,performance,localStorage,sessionStorage,CustomEvent,HTMLElement,document,
  location:{href:'https://commonweave.test/app/working-campus-v156.html',origin:'https://commonweave.test'},
  navigator:{userAgent:'Commonweave v192 verifier'},
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
const brokenSession=JSON.parse(sessionStorage.getItem('commonweave-model-session'));
assert(brokenSession.apiKey===apiKey,'Settings controller did not restore the remembered key fixture.');
assert(brokenSession.remoteConsent===false,'Regression fixture no longer demonstrates the key-without-consent split.');

vm.runInContext(deviceSource,sandbox,{filename:'commonweave-device-credentials-v160.js'});
const repairedSession=JSON.parse(sessionStorage.getItem('commonweave-model-session'));
assert(repairedSession.apiKey===apiKey,'Credential bridge lost the remembered key.');
assert(repairedSession.remoteConsent===true,'Credential bridge did not restore saved external-request consent.');
const bridge=sandbox.CommonweaveDeviceCredentialsV160;
assert(bridge.status().usable===true,'Credential bridge does not report the restored credential as usable.');
assert(bridge.restoresConsent===true&&bridge.mirrorsRuntimeSecret===true,'Credential bridge does not declare both halves of the repair.');

const secrets=JSON.parse(sessionStorage.getItem('commonweave-model-secrets-v1'));
const secretRows=Object.values(secrets);
assert(secretRows.some(row=>row.apiKey===apiKey&&row.externalConsent===true),'Credential was not mirrored into the fingerprinted runtime secret store.');
const enriched=JSON.parse(localStorage.getItem('commonweave-model-persistent-secrets-v191'));
assert(enriched.apiKey===apiKey&&enriched.remoteConsent===true,'Durable credential record was not enriched with consent.');

vm.runInContext(runtimeSource,sandbox,{filename:'commonweave-model-runtime.js'});
const runtimeConfig=sandbox.CommonweaveModelRuntime.readSharedConfig('interactive');
assert(runtimeConfig.apiKey===apiKey,'Real model runtime did not receive the remembered Gemini key.');
assert(runtimeConfig.externalConsent===true,'Real model runtime still considers external Gemini requests forbidden.');
assert(runtimeConfig.provider==='gemini','Real model runtime did not preserve the Gemini route.');

for(const forbidden of ['MutationObserver','setInterval('])assert(!deviceSource.includes(forbidden),`Credential repair introduced ${forbidden}.`);
for(const token of ['working-campus-additions-v192-credential-usable','usable-key-and-consent-v192','restoresConsent:true','mirrorsRuntimeSecret:true'])assert(workerSource.includes(token),`Device package is missing ${token}.`);

console.log(JSON.stringify({
  ok:true,
  revision:'v192-credential-usable',
  reproduced:{keyPresent:true,consentLost:true},
  repaired:{keyPresent:true,consentRestored:true,fingerprintedSecret:true,runtimeUsable:true},
  freezeBoundary:{observer:false,polling:false},
},null,2));
