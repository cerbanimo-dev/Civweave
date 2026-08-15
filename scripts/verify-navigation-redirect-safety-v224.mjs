import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [source,wrapper,versionText]=await Promise.all([
  readFile(path.join(root,'public/service-worker-navigation-safety-v224.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),
  readFile(path.join(root,'VERSION'),'utf8')
]);
const revision='navigation-redirect-safety-v224-local-first';
const version=versionText.trim();

assert(wrapper.includes(`/service-worker-navigation-safety-v224.js?v=${revision}`),'Active worker wrapper does not import local-first navigation safety.');
assert(wrapper.indexOf('/service-worker-navigation-safety-v224.js')>wrapper.indexOf('/service-worker-release-coherence-v220.js'),'Navigation safety must follow release coherence.');
for(const token of [
  "headers.delete('location')",
  'x-civweave-navigation-normalized',
  "policy: 'cache-only-runtime-explicit-package-acquisition'",
  'runtimeNetworkFallback: false',
  'modelRuntimeNetworkFallback: false',
  'const cached = await findCached(pathname)',
  'if (!packageIntent)'
])assert(source.includes(token),`Navigation safety is missing ${token}.`);
assert.doesNotThrow(()=>new vm.Script(source,{filename:'service-worker-navigation-safety-v224.js'}));

let fetchCalls=0;
let cachedFactory=()=>null;
function redirectedResponse(text){
  const response=new Response(text,{status:200,headers:{'content-type':'text/html; charset=utf-8','location':'/app/working-campus-v156.html'}});
  Object.defineProperty(response,'redirected',{value:true});
  return response;
}
function manualNavigation(url=`https://civweave.invalid/app/working-campus-v156.html?installed=1&version=${version}`){
  const request=new Request(url,{method:'GET',redirect:'manual'});
  Object.defineProperty(request,'mode',{value:'navigate'});
  return request;
}

const modelCache={match:async()=>null,put:async()=>{}};
const context={
  console,URL,Request,Response,Headers,VERSION:version,
  self:{location:{origin:'https://civweave.invalid'}},
  cacheKey:pathname=>new Request(new URL(pathname,'https://civweave.invalid').href),
  responseLooksValid:response=>Boolean(response?.ok),
  caches:{open:async()=>modelCache,match:async()=>null},
  findCached:async pathname=>cachedFactory(pathname),
  fetch:async()=>{fetchCalls+=1;return new Response('network',{status:200})},
  networkFirst:async()=>{throw new Error('original networkFirst should be replaced')},
  stableAppEntry:async()=>redirectedResponse('stable launcher'),
  cacheFirst:async()=>redirectedResponse('cached asset')
};
vm.runInNewContext(source,context,{filename:'service-worker-navigation-safety-v224.js'});

cachedFactory=pathname=>pathname.includes('working-campus')?redirectedResponse('cached campus'):null;
const cached=await context.networkFirst(manualNavigation(),'/offline.html');
assert.equal(cached.redirected,false,'Cached navigation response retained its redirected flag.');
assert.equal(cached.headers.get('location'),null,'Normalized cached navigation leaked a Location header.');
assert.equal(cached.headers.get('x-civweave-navigation-normalized'),revision);
assert.equal(await cached.text(),'cached campus');
assert.equal(fetchCalls,0,'Normal installed navigation must never contact the network.');

cachedFactory=()=>null;
const missing=await context.networkFirst(manualNavigation(),'/offline.html');
assert.equal(missing.status,503,'Missing local navigation must fail closed with package-required state.');
assert.equal(missing.headers.get('x-civweave-local-first'),'package-required');
assert.equal(fetchCalls,0,'Missing local navigation must not trigger a network fallback.');

cachedFactory=pathname=>pathname.includes('installed-entry')?redirectedResponse('stable launcher'):null;
const stable=await context.stableAppEntry(manualNavigation('https://civweave.invalid/app/installed-entry-v146.html'));
assert.equal(stable.redirected,false,'Stable app entry retained its redirected flag.');
assert.equal(stable.headers.get('location'),null);
assert.equal(fetchCalls,0);

const modelRequest=new Request('https://civweave.invalid/app/models/example.bin');
const modelMissing=await context.modelOnDemand(modelRequest);
assert.equal(modelMissing.status,503,'Uninstalled model must require explicit package acquisition.');
assert.equal(modelMissing.headers.get('x-civweave-local-first'),'package-required');
assert.equal(fetchCalls,0,'Normal model runtime must not fetch missing weights.');

console.log(JSON.stringify({ok:true,version,revision,cachedNormalized:true,missingLocalPackageVisible:true,runtimeNetworkFallback:false,modelRuntimeNetworkFallback:false},null,2));
