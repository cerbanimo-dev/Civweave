import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [routesSource,boundarySource,versionText]=await Promise.all([
  readFile(path.join(root,'public/app/system-routes-v227.js'),'utf8'),
  readFile(path.join(root,'public/app/install-boundary-v146.js'),'utf8'),
  readFile(path.join(root,'VERSION'),'utf8')
]);
const version=versionText.trim();
const systems={civweave:'/app/working-campus-v156.html','living-school':'/app/cabinets/living-school/index.html',cerbanimo:'/app/realm-console-v140.html',fellowfare:'/app/fellowfare-cabinet-v144.html',anarchadia:'/app/anarchadia-console-v139.html'};
const allowedCanonicalSupport=['/app/system-routes-v227.js','/app/release-version-v1.js','/app/ai-settings-bind-guard-v230.js','/app/ai-settings-device-repair-v229.js'];
function runBoundary(pathname){
  const appended=[],replaced=[],storage=new Map(),documentElement={isConnected:true,dataset:{}},head={isConnected:true,append:node=>appended.push(node)},body={isConnected:true};
  const document={documentElement,head,body,querySelector:()=>null,createElement:tag=>({tagName:String(tag).toUpperCase(),async:true,rel:'',href:'',src:''})};
  const location={pathname,search:'',hash:'',hostname:'civweave.invalid',origin:'https://civweave.invalid',href:`https://civweave.invalid${pathname}`,replace:url=>replaced.push(String(url))};
  const context={console,URL,URLSearchParams,Map,Object,String,Boolean,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},navigator:{standalone:false},matchMedia:()=>({matches:false}),sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},document,location,addEventListener:()=>{},dispatchEvent:()=>true,queueMicrotask:callback=>callback()};
  context.window=context;context.top=context;context.self=context;context.globalThis=context;
  vm.runInNewContext(routesSource,context,{filename:'system-routes-v227.js'});
  vm.runInNewContext(boundarySource,context,{filename:'install-boundary-v146.js'});
  return{appended,replaced,documentElement,api:context.CivweaveInstallBoundaryV146};
}
for(const [system,pathname] of Object.entries(systems)){
  const result=runBoundary(pathname);
  assert.equal(result.replaced.length,0,`${system} was redirected with empty session state.`);
  assert.equal(result.api.version,version);
  assert.equal(result.api.systemSurface(),system);
  assert.equal(result.api.allowed(),true);
  assert.equal(result.documentElement.dataset.civweaveSystemRoute,system);
  if(system==='civweave'){
    assert.equal(result.appended.length,0,'Civweave auto-loaded global additions.');
    assert.equal(result.documentElement.dataset.installBoundary,'canonical');
    assert.equal(result.documentElement.dataset.civweaveCanonicalCore,'only');
  }else{
    assert.equal(result.documentElement.dataset.installBoundary,'canonical-system');
    assert.equal(result.documentElement.dataset.civweaveCanonicalRealm,'self-contained');
    const scriptPaths=result.appended.map(node=>{try{return new URL(String(node.src||''),'https://civweave.invalid').pathname}catch{return''}}).filter(Boolean);
    assert.deepEqual(scriptPaths,allowedCanonicalSupport,`${system} canonical support drifted into the legacy compatibility bundle.`);
    assert(!scriptPaths.includes('/extensions/civweave-additions-v156.js'),`${system} reintroduced the post-paint shared-additions injector.`);
    assert(!scriptPaths.includes('/app/persistent-guide-chat-v215.js'),`${system} reintroduced the persistent-guide overlay during canonical startup.`);
    assert(!scriptPaths.includes('/app/pwa-update-controller-v204.js'),`${system} reintroduced the update overlay during canonical startup.`);
  }
}
const api=runBoundary(systems.civweave).api;
assert.equal(api.canonicalSystemCount,5);
assert.equal(api.canonicalAutoScripts,0);
assert.equal(api.canonicalSubsystemSupportScripts,4);
assert.equal(api.canonicalSubsystemCompatibility,'route-version-settings-only-no-legacy-additions');
assert.equal(api.canonicalPolicy,'five-system-first-class-routes-civweave-core-only');
console.log(JSON.stringify({ok:true,version,revision:api.revision,canonicalSystems:Object.keys(systems),emptySessionAuthorized:true,civweaveAutoScripts:0,canonicalSubsystemSupportScripts:api.canonicalSubsystemSupportScripts,legacyCompatibility:'noncanonical-only'},null,2));
