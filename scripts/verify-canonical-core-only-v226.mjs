import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'public/app/install-boundary-v146.js'),'utf8');

function runBoundary({pathname,search=''}){
  const appended=[];
  const replaced=[];
  const storage=new Map();
  const documentElement={isConnected:true,dataset:{}};
  const head={isConnected:true,append:node=>appended.push(node)};
  const document={
    documentElement,
    head,
    querySelector:()=>null,
    createElement:tag=>({tagName:String(tag).toUpperCase(),async:true,rel:'',href:'',src:''})
  };
  const location={
    pathname,
    search,
    hash:'',
    hostname:'commonweave.invalid',
    origin:'https://commonweave.invalid',
    href:`https://commonweave.invalid${pathname}${search}`,
    replace:url=>replaced.push(String(url))
  };
  const selfWindow={};
  selfWindow.top=selfWindow;
  selfWindow.self=selfWindow;
  const context={
    console,
    URL,
    URLSearchParams,
    CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    navigator:{standalone:false},
    matchMedia:()=>({matches:false}),
    sessionStorage:{
      getItem:key=>storage.get(key)??null,
      setItem:(key,value)=>storage.set(key,String(value))
    },
    document,
    location,
    window:selfWindow,
    addEventListener:()=>{},
    dispatchEvent:()=>true,
    queueMicrotask:callback=>callback(),
    globalThis:null
  };
  context.globalThis=context;
  vm.runInNewContext(source,context,{filename:'install-boundary-v146.js'});
  return {appended,replaced,documentElement,api:context.CommonweaveInstallBoundaryV146};
}

const canonical=runBoundary({
  pathname:'/app/working-campus-v156.html',
  search:'?installed=1&version=1.0.13'
});
assert.equal(canonical.replaced.length,0,'Canonical Working Campus was redirected.');
assert.equal(canonical.appended.length,0,'Canonical Working Campus auto-loaded global additions.');
assert.equal(canonical.documentElement.dataset.installBoundary,'canonical');
assert.equal(canonical.documentElement.dataset.commonweaveCanonicalCore,'only');
assert.equal(canonical.api.version,'1.0.13');
assert.equal(canonical.api.canonicalAutoScripts,0);
assert.equal(canonical.api.canonicalPolicy,'core-only-no-global-additions-no-redirect');

const legacy=runBoundary({
  pathname:'/app/realm-console-v140.html',
  search:'?system=cerbanimo&installed=1'
});
assert.equal(legacy.replaced.length,0,'Installed legacy realm was redirected.');
assert(legacy.appended.length>10,'Legacy realm did not receive its compatibility scripts.');
assert(legacy.appended.some(node=>String(node.src||'').includes('/extensions/commonweave-additions-v156.js')),'Legacy realm lost shared additions compatibility.');
assert(legacy.appended.some(node=>String(node.href||'').includes('/extensions/commonweave-additions-v156.css')),'Legacy realm lost shared additions styles.');

console.log(JSON.stringify({
  ok:true,
  version:canonical.api.version,
  revision:canonical.api.revision,
  canonicalAppended:canonical.appended.length,
  canonicalRedirects:canonical.replaced.length,
  legacyAppended:legacy.appended.length
},null,2));
