import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const bridgeUrl=new URL('../public/app/settings-local-route-v325.js',import.meta.url);
const compatUrl=new URL('../public/app/settings-local-route-v323.js',import.meta.url);
const freshUrl=new URL('../public/app/settings-local-route-v327.js',import.meta.url);
const campusUrl=new URL('../public/app/working-campus-v440.html',import.meta.url);
const shellUrl=new URL('../public/app/persistent-system-shell-v1.js',import.meta.url);
const [bridge,compat,fresh,campus,shell]=await Promise.all([
  readFile(bridgeUrl,'utf8'),
  readFile(compatUrl,'utf8'),
  readFile(freshUrl,'utf8'),
  readFile(campusUrl,'utf8'),
  readFile(shellUrl,'utf8')
]);

assert.equal(compat,fresh,'v323 compatibility route and v327 fresh implementation must remain byte-identical.');
assert.notEqual(bridge,fresh,'v325 is intentionally a parent-shell bridge now; it must not silently collapse back to the full implementation.');
assert.match(bridge,/FULL_ROUTE='\/app\/settings-local-route-v327\.js\?v=1\.1\.4-settings-local-route-v325-parent-bridge'/,'Persistent Settings bridge must hand off to the cache-distinct v327 implementation.');
assert.match(bridge,/delete globalThis\.CivweaveSettingsLocalRouteV323/,'Bridge must evict a stale same-version Local models global before loading the fresh implementation.');
assert.match(bridge,/loaderBridge:true/,'Bridge API must identify itself so the full implementation can replace it.');
assert.match(bridge,/renderLocalModels/,'Bridge must expose renderLocalModels immediately so Settings never remains on the gateway placeholder.');
assert.match(shell,/settings-local-route-v325\.js/,'Persistent shell must enter Local models through the v325 bridge.');
assert.match(campus,/settings-local-route-v327\.js\?v=1\.1\.3-settings-local-route-v326-canonical-inert-hard-local-fresh-path/,'Current Working Campus must load the cache-distinct v327 Local models implementation directly.');
assert.doesNotMatch(campus,/settings-local-route-v325\.js\?v=working-campus-v440-settings-v325/,'Working Campus must not retain the stale-cache v325 full implementation URL.');

let managerReads=0;
let storageWrites=0;
let panel=null;
let dock=null;

const store=new Map([
  ['civweave.local-ai.downloads.v266',JSON.stringify({'gemma4-e2b-it-q2f16-mobile':{status:'ready',percent:100,bytesDownloaded:2335000000,totalBytes:2335000000}})],
  ['civweave.local-ai.selection.v266',JSON.stringify({active:true,id:'gemma4-e2b-it-q2f16-mobile'})],
  ['civweave.local-ai.packs.v1',JSON.stringify({'premier-phone':{status:'error',phase:'browser-download-required',errorCode:'CIVWEAVE_AI_PACK_BROWSER_DOWNLOAD_REQUIRED'}})],
  ['civweave.local-ai.health.v286','{}']
]);

const placeholder={remove(){}};
const target={
  isConnected:true,
  querySelector(selector){return selector==='[data-local-model-slot-placeholder]'?placeholder:null},
  append(node){panel=node}
};
const form={
  isConnected:true,
  dataset:{activeSettingsTab:'local-models'},
  matches(selector){return selector==='[data-cw-settings-form]'},
  querySelector(selector){
    if(selector==='[data-settings-tab-panel="local-models"]')return target;
    if(selector==='#cw-local-ai-v324')return panel;
    return null;
  }
};

function element(tag='div'){
  return{
    tagName:String(tag).toUpperCase(),
    id:'',
    dataset:{},
    className:'',
    classList:{toggle(){}},
    addEventListener(){},
    remove(){},
    setAttribute(){},
    append(){},
    querySelector(){return null},
    innerHTML:'',
    hidden:false,
    type:''
  };
}

const context={
  console,
  setTimeout,
  clearTimeout,
  URL,
  location:{href:'https://example.test/app/'},
  document:{
    readyState:'loading',
    documentElement:{isConnected:true},
    head:{append(){},isConnected:true},
    body:{append(node){dock=node}},
    scripts:[],
    getElementById(id){return id==='cw-local-ai-download-dock-v324'?dock:null},
    createElement(tag){return element(tag)},
    addEventListener(){},
    querySelector(){return null}
  },
  localStorage:{
    getItem(key){return store.get(key)||null},
    setItem(key,value){storageWrites++;store.set(key,String(value))}
  },
  addEventListener(){},
  dispatchEvent(){},
  CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},
  queueMicrotask(){}
};
Object.defineProperty(context,'CivweaveLocalModelDownloadV266',{
  configurable:true,
  get(){managerReads++;throw new Error('Live local-model manager was touched while rendering Local models.')}
});

vm.createContext(context);
vm.runInContext(fresh,context,{filename:'settings-local-route-v327.js'});
const api=context.CivweaveSettingsLocalRouteV323;
assert.ok(api?.renderLocalModels,'Fresh Local models implementation must expose renderLocalModels.');
const rendered=api.renderLocalModels(form);
assert.ok(rendered,'Local models must render from saved state.');
assert.equal(managerReads,0,'Opening Local models must not touch the live model manager.');
assert.equal(storageWrites,0,'Opening Local models must not mutate saved state.');
assert.match(panel?.innerHTML||'',/AI Downloads/);
assert.match(panel?.innerHTML||'',/Gemma 4 E2B IT/);
assert.match(panel?.innerHTML||'',/Ready for browser download/);
assert.equal(api.savedStateOnlyView,true);
assert.equal(api.viewWritesState,false);
assert.equal(api.hardLocalOnly,true);
assert.equal(api.canonicalPath,'/app/settings-local-route-v325.js');

console.log(JSON.stringify({
  ok:true,
  revision:api.version,
  persistentBridge:'settings-local-route-v325.js -> settings-local-route-v327.js',
  compatibilityAlias:'settings-local-route-v323.js',
  freshImplementation:'settings-local-route-v327.js',
  staleGlobalEviction:true,
  managerReads,
  storageWrites,
  rendered:true,
  hardLocalOnly:api.hardLocalOnly
},null,2));
