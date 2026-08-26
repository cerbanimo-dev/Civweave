import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/app/settings-local-route-v327.js',import.meta.url),'utf8');
const campus=await readFile(new URL('../public/app/working-campus-v440.html',import.meta.url),'utf8');

assert.match(source,/stale-worker-bridge-v1/);
assert.match(source,/settings-local-models-direct-v325\.js\?v=settings-v325-source-truth-bridge-v1/);
assert.match(source,/CIVWEAVE SETTINGS · v325/);
assert.match(source,/settings-local-route-v331\.js\?cwAction=1/);
assert.match(source,/managerDependencyOnView:false/);
assert.match(source,/cacheReadOnView:false/);
assert.match(source,/serviceWorkerReadyOnView:false/);
assert.doesNotMatch(source,/navigator\.serviceWorker/);
assert.doesNotMatch(source,/\bcaches\./);
assert.match(campus,/settings-local-route-v327\.js/,'The current Working Campus must keep loading the stale-worker bridge pathname.');

const store=new Map([
  ['civweave.local-ai.selection.v266',JSON.stringify({active:true,id:'gemma4-e2b-it-q2f16-mobile'})],
  ['civweave.local-ai.downloads.v266',JSON.stringify({'gemma4-e2b-it-q2f16-mobile':{status:'ready'}})],
  ['civweave.local-ai.packs.v1',JSON.stringify({'premier-phone':{status:'ready'}})]
]);
let managerReads=0;
const appended=[];
const header={textContent:'CIVWEAVE SETTINGS · v324'};
const retry={addEventListener(){}};
const target={
  innerHTML:'<p>Reading saved local model choices…</p>',
  querySelector(selector){return selector==='[data-cw-v325-source-bridge-retry]'?retry:null}
};
const deterministic={after(){}};
const route={
  value:'deterministic',
  querySelector(selector){
    if(selector==='option[value="downloaded-local"]')return null;
    if(selector==='option[value="deterministic"]')return deterministic;
    return null;
  },
  prepend(){}
};
const form={
  isConnected:true,
  elements:{namedItem(name){return name==='route'?route:null}},
  querySelector(selector){
    if(selector==='[data-settings-tab-panel="local-models"]')return target;
    if(selector==='[data-settings-tab="local-models"]')return{getAttribute(){return'true'}};
    return null;
  }
};
const layer={
  isConnected:true,
  hidden:false,
  dataset:{},
  querySelector(selector){
    if(selector==='header small')return header;
    if(selector==='[data-cw-settings-form]')return form;
    if(selector==='[data-settings-tab-panel="local-models"]')return target;
    if(selector==='[data-settings-tab="local-models"]')return{getAttribute(){return'true'}};
    return null;
  }
};
function element(tag){
  if(tag==='script')return{src:'',async:true,dataset:{},onload:null,onerror:null,addEventListener(){}};
  if(tag==='option')return{value:'',textContent:''};
  return{dataset:{},addEventListener(){}};
}
const context={
  console,URL,setTimeout,clearTimeout,
  localStorage:{getItem(key){return store.get(key)||null}},
  location:{href:'https://example.test/app/working-campus-v440.html'},
  document:{
    readyState:'loading',
    scripts:[],
    head:{append(node){appended.push(node)}},
    documentElement:{append(node){appended.push(node)}},
    getElementById(id){return id==='cw-settings-v320'?layer:null},
    querySelector(selector){return selector==='[data-cw-settings-form]'?form:null},
    createElement:element,
    addEventListener(){}
  },
  addEventListener(){},
  queueMicrotask(){},
  globalThis:null
};
context.globalThis=context;
Object.defineProperty(context,'CivweaveLocalModelDownloadV266',{configurable:true,get(){managerReads++;throw new Error('Display path touched the live model manager.')}});
vm.createContext(context);
vm.runInContext(source,context,{filename:'settings-local-route-v327.js'});

const api=context.CivweaveSettingsLocalRouteV323;
assert.ok(api?.staleWorkerSourceBridge);
assert.equal(api.renderLocalModels(layer),true);
assert.equal(managerReads,0,'The stale-worker display bridge must not touch the live model manager.');
assert.equal(header.textContent,'CIVWEAVE SETTINGS · v325');
assert.equal(layer.dataset.settingsVisibleVersion,'v325');
assert.match(target.innerHTML,/AI Downloads/);
assert.match(target.innerHTML,/Saved local state loaded/);
assert.doesNotMatch(target.innerHTML,/Reading saved local model choices/);
assert.ok(appended.some(node=>String(node.src||'').includes('/app/settings-local-models-direct-v325.js')),'The bridge must request the cache-distinct direct renderer without waiting for a worker update.');

console.log(JSON.stringify({ok:true,revision:'settings-v325-stale-worker-source-bridge-v1',managerReads,visibleVersion:'v325',fallbackPainted:true,directRendererRequested:true},null,2));
