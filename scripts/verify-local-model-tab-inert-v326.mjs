import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/app/settings-local-route-v323.js',import.meta.url),'utf8');
let managerReads=0;
let storageWrites=0;
let panel=null;

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

function element(){
  return{
    dataset:{},
    classList:{toggle(){}},
    addEventListener(){},
    remove(){},
    setAttribute(){},
    append(){},
    querySelector(){return null},
    innerHTML:'',
    hidden:false
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
    body:{append(){}},
    scripts:[],
    getElementById(){return null},
    createElement(){return element()},
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
  get(){managerReads++;throw new Error('Local-model manager was touched while rendering the Local models tab.')}
});

vm.createContext(context);
vm.runInContext(source,context,{filename:'settings-local-route-v323.js'});
const api=context.CivweaveSettingsLocalRouteV323;
assert.ok(api?.renderLocalModels,'Local-model settings API must expose renderLocalModels.');
const rendered=api.renderLocalModels(form);
assert.ok(rendered,'Local models must render from saved state.');
assert.equal(managerReads,0,'Opening Local models must not touch the live model manager.');
assert.equal(storageWrites,0,'Opening Local models must not mutate saved state.');
assert.match(panel?.innerHTML||'',/AI Downloads/);
assert.match(panel?.innerHTML||'',/Gemma 4 E2B IT/);
assert.match(api.version,/v326-inert-view/);
assert.equal(api.savedStateOnlyView,true);
assert.equal(api.viewWritesState,false);

console.log(JSON.stringify({ok:true,revision:'local-model-tab-inert-v326',managerReads,storageWrites,rendered:true},null,2));
