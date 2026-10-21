import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const source=read('public/app/settings-local-route-v331.js');
const canonical=read('public/app/settings-local-route-v327.js');
const direct=read('public/app/settings-local-models-direct-v325.js');
const shell=read('public/app/persistent-system-shell-v1.html');
const loader=read('public/app/settings-local-loader-v337.js');
assert.equal(source,canonical,'actual Settings renderer and inert canonical copy must remain identical');
const installed='llama32-3b-instruct-q4f16';
const store=new Map([
 ['civweave.local-ai.selection.v266',JSON.stringify({active:true,id:installed})],
 ['civweave.local-ai.downloads.v266',JSON.stringify({
  [installed]:{status:'ready',percent:100},
  'qwen3-4b-q4f16':{status:'downloading',percent:27,bytesDownloaded:800000000,totalBytes:2900000000}
 })],
 ['civweave.local-ai.performance.v1',JSON.stringify({
  'qwen35-4b-litert-web':{samples:[{ttftMs:1200,tokensPerSecond:21.5,approximate:true}],
    lastPlan:{validated:true}}
 })]
]);
let cacheReads=0,modelLoads=0;
const target={isConnected:true,children:[],querySelector:()=>null,append(node){this.children.push(node)}};
const elements={};
const form={isConnected:true,dataset:{activeSettingsTab:'local-models'},matches:s=>s==='[data-cw-settings-form]',
 querySelector(selector){
  if(selector==='[data-settings-tab-panel="local-models"]')return target;
  if(selector==='#cw-local-ai-v324')return elements['cw-local-ai-v324']||null;
  return null;
 }};
const layer={isConnected:true,hidden:false,matches:()=>false,querySelector:s=>s==='[data-cw-settings-form]'?form:null};
const document={
 documentElement:{isConnected:true},body:{append(){}},head:{append(){}},
 readyState:'loading',addEventListener(){},
 getElementById:id=>elements[id]||null,
 querySelector:s=>s==='[data-cw-settings-form]'?form:null,
 createElement(tag){const e={tag,id:'',dataset:{},className:'',isConnected:true,innerHTML:'',hidden:false,
  addEventListener(){},append(){},replaceChildren(){},classList:{toggle(){}},querySelector:()=>null};
  Object.defineProperty(e,'id',{set(v){this._id=v;elements[v]=this},get(){return this._id}});
  return e}
};
const ctx={console,JSON,String,Array,Object,Map,Set,Number,Math,Date,Promise,
 document,window:null,localStorage:{getItem:k=>store.get(k)||null,setItem(){throw Error('Settings view must not save state')}},
 addEventListener(){},dispatchEvent(){},queueMicrotask(){},
 setTimeout(){},clearTimeout(){},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
};
ctx.globalThis=ctx;
Object.defineProperty(ctx,'CivweaveLocalModelDownloadV266',{get(){modelLoads++;throw Error('readiness view must not start model runtime')}});
Object.defineProperty(ctx,'caches',{get(){cacheReads++;throw Error('Settings view may not touch Cache Storage')}});
vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'settings-local-route-v331.js'});
const api=ctx.CivweaveSettingsLocalRouteV323;
assert.ok(api,'active full route exported');
assert.equal(api.renderLocalModels(layer).id,'cw-local-ai-v324');
const markup=elements['cw-local-ai-v324'].innerHTML;
assert.match(markup,/PHONE FIRST · Qwen 3\.5 4B/,'the phone-primary model must be in the actual v324 menu');
assert.match(markup,/2\.75 GB/,'correct Qwen 3.5 4B size displayed');
assert.match(markup,/data-local-phone-import="qwen35-4b-litert-web"/,'file-import control visible in the actual menu');
assert.match(markup,/Download Qwen 4B in browser/,'native download link shown, not 2.75GB foreground fetch');
assert.match(markup,/Actual local speed:/);
assert.match(markup,/21\.5 approximate tokens\/s/);
assert.match(markup,/Moss structure PASS/);
assert.match(markup,/27%/,'existing 27% Qwen3 4B download must be preserved in Settings');
assert.match(markup,/Llama 3B Android GPU tests remain blocked/);
assert.match(markup,/Legacy Gemma Premier Pack/,'existing installed pack remains visible without representing current phone default');
assert.doesNotMatch(markup,/Download 2\.75 GB.*data-local-download="qwen35-4b-litert-web"/s,'do not start a browser Web Fetch of the 2.75GB model');
assert.equal(cacheReads,0);assert.equal(modelLoads,0);
assert.match(source,/await importChunkedFile\(cache,url,file/);
assert.match(source,/file\.size!==model\.estimatedBytes/);
assert.match(source,/progress\.chunk/);
assert.ok(shell.includes('settings-local-route-v331.js?cwAction=1&amp;v=1.2.2-qwen-phone-settings'));
assert.ok(loader.includes("ROUTE_VERSION='1.1.5-settings-local-route-v327-qwen-phone-fast'"));
assert.match(direct,/data-local-phone-import/,'direct v325 fallback must expose same Qwen 4B standalone import');
console.log('PASS: actual v324 Settings shows Qwen 3.5 4B native import, real performance, active Llama and live 27% Qwen3 4B progress without model/cache reads.');
