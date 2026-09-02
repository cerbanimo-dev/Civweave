import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/app/settings-local-route-v325.js',import.meta.url),'utf8');
const compat=await readFile(new URL('../public/app/settings-local-route-v323.js',import.meta.url),'utf8');
const fresh=await readFile(new URL('../public/app/settings-local-route-v327.js',import.meta.url),'utf8');
const actions=await readFile(new URL('../public/app/settings-local-route-v331.js',import.meta.url),'utf8');

assert.match(source,/1\.1\.4-settings-local-route-v326-stable-local-actions/);
assert.match(source,/settings-v325-parent-source-recovery-v3-stable-actions-card-progress/);
assert.match(source,/DIRECT_VERSION='1\.1\.0-settings-v325-direct-local-models-stable-actions'/);
assert.match(source,/settings-local-models-direct-v325\.js\?v=1\.1\.0-stable-in-place-actions/);
assert.match(source,/STATUS_PLACEMENT_VERSION='1\.0\.1-settings-local-progress-card-owned-direct-aware'/);
assert.match(source,/CIVWEAVE SETTINGS · v325/);
assert.match(source,/settings-local-route-v331\.js\?cwAction=1/);
assert.match(source,/managerDependencyOnView:false/);
assert.match(source,/cacheReadOnView:false/);
assert.match(source,/serviceWorkerReadyOnView:false/);
assert.match(source,/staleWorkerSourceRecovery:true/);
assert.match(source,/stableInPlaceActions:true/);
assert.match(source,/directCardProgress:true/);
assert.match(source,/globalProgressBanner:false/);
assert.doesNotMatch(source,/navigator\.serviceWorker/);
assert.doesNotMatch(source,/\bcaches\./);
assert.equal(compat,fresh,'v323 and v327 validated inert implementations must remain byte-identical.');
assert.equal(actions,fresh,'v331 explicit action generation must remain the validated full implementation.');
assert.notEqual(source,fresh,'v325 must remain the small parent-shell recovery bridge.');

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
  isConnected:true,
  innerHTML:'<p>Reading saved local model choices…</p>',
  querySelector(selector){
    if(selector==='[data-cw-v325-parent-retry]')return retry;
    return null;
  }
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
const localTab={getAttribute(name){return name==='aria-selected'?'true':null}};
const form={
  isConnected:true,
  dataset:{activeSettingsTab:'local-models'},
  elements:{namedItem(name){return name==='route'?route:null}},
  matches(selector){return selector==='[data-cw-settings-form]'},
  querySelector(selector){
    if(selector==='[data-settings-tab-panel="local-models"]')return target;
    if(selector==='[data-settings-tab="local-models"]')return localTab;
    return null;
  }
};
const layer={
  id:'cw-settings-v320',
  isConnected:true,
  hidden:false,
  dataset:{},
  querySelector(selector){
    if(selector==='header small')return header;
    if(selector==='[data-cw-settings-form]')return form;
    if(selector==='[data-settings-tab-panel="local-models"]')return target;
    if(selector==='[data-settings-tab="local-models"]')return localTab;
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
    head:{isConnected:true,append(node){appended.push(node)}},
    documentElement:{isConnected:true,append(node){appended.push(node)}},
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
vm.runInContext(source,context,{filename:'settings-local-route-v325.js'});

const api=context.CivweaveSettingsLocalRouteV323;
assert.ok(api?.staleWorkerSourceRecovery);
assert.ok(api?.stableInPlaceActions);
assert.ok(api.renderLocalModels(layer));
assert.equal(managerReads,0,'The stale-worker parent bridge must not touch the live model manager.');
assert.equal(header.textContent,'CIVWEAVE SETTINGS · v325');
assert.equal(layer.dataset.settingsVisibleVersion,'v325');
assert.match(target.innerHTML,/AI Downloads/);
assert.match(target.innerHTML,/Saved local state loaded/);
assert.doesNotMatch(target.innerHTML,/Reading saved local model choices/);
assert.ok(appended.some(node=>String(node.src||'').includes('/app/settings-local-models-direct-v325.js?v=1.1.0-stable-in-place-actions')),'The parent bridge must request the cache-distinct current direct renderer without waiting for a worker update.');

console.log(JSON.stringify({ok:true,revision:'settings-v325-parent-source-recovery-v3-stable-actions-card-progress',managerReads,visibleVersion:'v325',fallbackPainted:true,directRendererRequested:true,stableInPlaceActions:true,directCardProgress:true,validatedAliasesPreserved:true},null,2));
