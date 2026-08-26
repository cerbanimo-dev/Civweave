import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const directSource=await readFile(new URL('../public/app/settings-local-models-direct-v325.js',import.meta.url),'utf8');
const workerSource=await readFile(new URL('../public/service-worker-settings-v325-override.js',import.meta.url),'utf8');
const v203Source=await readFile(new URL('../public/service-worker-v203.js',import.meta.url),'utf8');
const rootWorker=await readFile(new URL('../public/service-worker.js',import.meta.url),'utf8');

assert.match(directSource,/CIVWEAVE SETTINGS · v325/);
assert.match(directSource,/Settings v325 · renderer direct-local-v325(?:\.\d+)? · actions lazy-v331/);
assert.match(directSource,/hardLoadingGuardMs:900/);
assert.match(directSource,/cwAction=1/);
assert.match(directSource,/settingsV325DisplayShim!==true/,'Explicit actions must reject the lightweight display shim.');
assert.match(directSource,/actionModulesOnDemand===true/,'An already-loaded full action route must identify itself as action-capable.');
assert.doesNotMatch(directSource,/navigator\.serviceWorker/,'The direct display renderer must not touch the service worker.');
assert.doesNotMatch(directSource,/\bcaches\./,'The direct display renderer must not inspect CacheStorage.');

let managerReads=0;
let storageWrites=0;
const store=new Map([
  ['civweave.local-ai.selection.v266',JSON.stringify({active:true,id:'gemma4-e2b-it-q2f16-mobile'})],
  ['civweave.local-ai.downloads.v266',JSON.stringify({'gemma4-e2b-it-q2f16-mobile':{status:'ready',percent:100}})],
  ['civweave.local-ai.packs.v1',JSON.stringify({'premier-phone':{status:'ready',selectedModel:'gemma4-e2b-it-q2f16-mobile'}})],
  ['civweave.local-ai.health.v286',JSON.stringify({'gemma4-e2b-it-q2f16-mobile':{ok:true}})]
]);
const headerLabel={textContent:'CIVWEAVE SETTINGS · v324'};
const localTarget={innerHTML:'<p>Reading saved local model choices…</p>',querySelector(){return null}};
const form={dataset:{},querySelector(selector){
  if(selector==='[data-settings-tab-panel="local-models"]')return localTarget;
  if(selector==='[data-settings-tab="local-models"]')return{getAttribute(){return'true'}};
  return null;
}};
const layer={isConnected:true,hidden:false,dataset:{},querySelector(selector){
  if(selector==='[data-cw-settings-form]')return form;
  if(selector==='header small')return headerLabel;
  return null;
}};
function element(){return{id:'',dataset:{},style:{},classList:{toggle(){}},append(){},addEventListener(){},set textContent(value){this._text=value},get textContent(){return this._text||''}}}
const directContext={
  console,setTimeout,clearTimeout,URL,
  localStorage:{getItem(key){return store.get(key)||null},setItem(key,value){storageWrites++;store.set(key,String(value))}},
  document:{
    head:{append(){}},
    getElementById(id){return id==='cw-settings-v320'?layer:null},
    createElement(){return element()},
    addEventListener(){}
  },
  addEventListener(){},
  queueMicrotask(){},
  globalThis:null
};
directContext.globalThis=directContext;
Object.defineProperty(directContext,'CivweaveLocalModelDownloadV266',{configurable:true,get(){managerReads++;throw new Error('Display path touched the live model manager.')}});
vm.createContext(directContext);
vm.runInContext(directSource,directContext,{filename:'settings-local-models-direct-v325.js'});
assert.ok(directContext.CivweaveSettingsLocalDirectV325?.render);
assert.equal(directContext.CivweaveSettingsLocalDirectV325.render(layer),true);
assert.equal(managerReads,0,'Rendering Local models must not touch the live model manager.');
assert.equal(storageWrites,0,'Rendering Local models must not mutate saved state.');
assert.equal(headerLabel.textContent,'CIVWEAVE SETTINGS · v325');
assert.match(localTarget.innerHTML,/AI Downloads/);
assert.match(localTarget.innerHTML,/Gemma 4 E2B IT/);
assert.match(localTarget.innerHTML,/renderer direct-local-v325/);
assert.doesNotMatch(localTarget.innerHTML,/Reading saved local model choices/);

assert.ok(v203Source.indexOf("service-worker-settings-v325-override.js")>0,'v203 must import the Settings override.');
assert.ok(v203Source.indexOf("service-worker-settings-v325-override.js")<v203Source.indexOf("service-worker-release-generation-v1.js"),'Settings override must register before other fetch handlers.');
assert.ok(v203Source.indexOf("service-worker-settings-v325-override.js")<v203Source.indexOf("service-worker-core-v208.js"),'Settings override must register before cache-first core.');
assert.match(rootWorker,/root-worker-bridge-v23-settings-v325-direct/,'Root worker bytes must change so installed clients discover this generation.');
assert.match(workerSource,/stopImmediatePropagation\(\)/);
assert.match(workerSource,/settings-gateway-v317\.js/);
assert.match(workerSource,/settings-local-route-v331\.js/);
assert.match(workerSource,/CW_SETTINGS_V325_ACTION_PARAM='cwAction'/);

const listeners={};
const cacheStore=new Map();
const workerContext={
  console,URL,Headers,Request,Response,
  self:{
    location:{origin:'https://example.test'},
    addEventListener(type,listener){(listeners[type]??=[]).push(listener)}
  },
  caches:{
    async open(){return{
      async put(key,response){const url=typeof key==='string'?key:key.url;cacheStore.set(url,response.clone())},
      async match(key){const url=typeof key==='string'?key:key.url;return cacheStore.get(url)?.clone()||null},
      async keys(){return[]},
      async delete(){return true}
    }},
    async match(request){return cacheStore.get(request.url)?.clone()||null},
    async keys(){return[]}
  },
  fetch:async request=>{
    const url=new URL(typeof request==='string'?request:request.url);
    if(url.pathname==='/app/settings-gateway-v317.js')return new Response("const VERSION='1.0.133-settings-v324-direct-local-model-view';const x='CIVWEAVE SETTINGS · v324';const y='settings-v324';",{status:200,headers:{'content-type':'application/javascript'}});
    if(url.pathname==='/app/settings-local-models-direct-v325.js')return new Response("globalThis.CivweaveSettingsLocalDirectV325={version:'test-patch'};",{status:200,headers:{'content-type':'application/javascript'}});
    if(url.pathname==='/app/settings-local-route-v331.js')return new Response("globalThis.CivweaveSettingsLocalRouteV323={version:'action-route'};",{status:200,headers:{'content-type':'application/javascript'}});
    return new Response('not found',{status:404});
  }
};
workerContext.globalThis=workerContext;
vm.createContext(workerContext);
vm.runInContext(workerSource,workerContext,{filename:'service-worker-settings-v325-override.js'});
assert.equal(listeners.fetch?.length,1,'Settings override must own one focused fetch listener.');
const fetchListener=listeners.fetch[0];
async function runFetch(url){
  let stopped=false,promise=null;
  const event={request:new Request(url),stopImmediatePropagation(){stopped=true},respondWith(value){promise=Promise.resolve(value)}};
  fetchListener(event);
  assert.equal(stopped,true,`Settings request was not isolated: ${url}`);
  assert.ok(promise,`Settings request was not answered: ${url}`);
  return promise;
}
const gatewayResponse=await runFetch('https://example.test/app/settings-gateway-v317.js?v=old');
const gatewayText=await gatewayResponse.text();
assert.match(gatewayText,/1\.0\.134-settings-v325-direct-local-model-view/);
assert.match(gatewayText,/CIVWEAVE SETTINGS · v325/);
assert.match(gatewayText,/CivweaveSettingsLocalDirectV325/,'Gateway response must contain the direct display renderer.');
const shimResponse=await runFetch('https://example.test/app/settings-local-route-v325.js?v=old');
const shimText=await shimResponse.text();
assert.match(shimText,/settingsV325DisplayShim:true/);
assert.doesNotMatch(shimText,/download-manager|runtime-v266|WebGPU/i,'Display shim must not load local-model lifecycle/runtime code.');
const actionResponse=await runFetch('https://example.test/app/settings-local-route-v331.js?cwAction=1');
assert.match(await actionResponse.text(),/action-route/,'Explicit actions must receive the full action route rather than the display shim.');

console.log(JSON.stringify({ok:true,revision:'settings-v325-direct-local-models',visibleVersion:'v325',managerReads,storageWrites,gatewayTransformed:true,displayShim:true,actionRouteLazy:true},null,2));
