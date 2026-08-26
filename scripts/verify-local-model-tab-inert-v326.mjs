import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const canonicalUrl=new URL('../public/app/settings-local-route-v325.js',import.meta.url);
const compatUrl=new URL('../public/app/settings-local-route-v323.js',import.meta.url);
const campusUrl=new URL('../public/app/working-campus-v440.html',import.meta.url);
const [canonical,compat,campus]=await Promise.all([
  readFile(canonicalUrl,'utf8'),
  readFile(compatUrl,'utf8'),
  readFile(campusUrl,'utf8')
]);

assert.equal(compat,canonical,'v323 compatibility path must be byte-identical to canonical v325 so the two settings routes cannot drift.');
assert.match(campus,/settings-local-route-v325\.js/,'Current Working Campus must load the canonical v325 Local models route.');

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
    head:{append(){}},
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
vm.runInContext(canonical,context,{filename:'settings-local-route-v325.js'});
const api=context.CivweaveSettingsLocalRouteV323;
assert.ok(api?.renderLocalModels,'Canonical Local models route must expose renderLocalModels.');
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
  canonical:'settings-local-route-v325.js',
  compatibilityAlias:'settings-local-route-v323.js',
  routesByteIdentical:true,
  managerReads,
  storageWrites,
  rendered:true,
  hardLocalOnly:api.hardLocalOnly
},null,2));
