import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL(`../public/app/${name}`,import.meta.url),'utf8');
const loader=read('family-ai-loader-v105.js');
function fixture(){
  let appended=0,removed=0;
  const existing={src:'https://civweave.test/app/unified-chat-system-v1.js',dataset:{cwf105State:'ready'},remove(){removed++}};
  const document={readyState:'loading',documentElement:{dataset:{}},scripts:[existing],createElement:()=>({dataset:{},remove(){removed++}}),head:{append(script){appended++;queueMicrotask(()=>script.onload())}}};
  const scope=vm.createContext({console,URL,URLSearchParams,Date,Math,JSON,Map,Set,Promise,AbortController,structuredClone,queueMicrotask,setTimeout,clearTimeout,setInterval,clearInterval,document,location:{href:'https://civweave.test/app/working-campus-v440.html',pathname:'/app/working-campus-v440.html',search:''},localStorage:{getItem:()=>null},addEventListener(){}});
  vm.runInContext(read('unified-chat-system-v1.js'),scope);
  vm.runInContext(loader.slice(loader.indexOf('const GUIDE_CAPABILITIES='),loader.indexOf('const LABEL='))+'\nglobalThis.__guide=GUIDE_CAPABILITIES[0];',scope);
  vm.runInContext(loader.slice(loader.indexOf('function removeStale('),loader.indexOf('function loadSequence('))+'\nglobalThis.__load=loadScript;',scope);
  return{scope,get appended(){return appended},get removed(){return removed}};
}
test('the mandatory guide readiness predicate accepts the actual current unified chat owner',()=>{
  const {scope}=fixture();
  assert.equal(scope.__guide[1](),true,'A successfully loaded current chat owner must satisfy its loader predicate.');
});
test('an already loaded current guide is reused without removing or reloading its script',async()=>{
  const app=fixture();
  await app.scope.__load(...app.scope.__guide);
  assert.equal(app.appended,0);assert.equal(app.removed,0);
});
