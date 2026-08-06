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
const revision='navigation-redirect-safety-v224';
const version=versionText.trim();
const semver=value=>value.split('.').map(Number);
const atLeast=(value,floor)=>{const left=semver(value),right=semver(floor);return left.some((part,index)=>part>right[index]&&left.slice(0,index).every((prior,i)=>prior===right[i]))||left.every((part,index)=>part===right[index])};

assert(atLeast(version,'1.0.11'),`Navigation redirect safety requires Commonweave 1.0.11 or newer; found ${version}.`);
assert(wrapper.includes(`/service-worker-navigation-safety-v224.js?v=${revision}`),'Active worker wrapper does not import navigation safety.');
assert(wrapper.indexOf('/service-worker-navigation-safety-v224.js')>wrapper.indexOf('/service-worker-release-coherence-v220.js'),'Navigation safety must follow release coherence.');
for(const token of [
  "redirect: 'follow'",
  "response.type === 'opaqueredirect'",
  "headers.delete('location')",
  'x-commonweave-navigation-normalized',
  'follow-internally-normalize-before-respond-with'
])assert(source.includes(token),`Navigation safety is missing ${token}.`);
assert.doesNotThrow(()=>new vm.Script(source,{filename:'service-worker-navigation-safety-v224.js'}));

const runtimeWrites=[];
let lastFetchRequest=null;
let cachedFactory=()=>null;
let networkFactory=()=>redirectedResponse('fresh campus');

function redirectedResponse(text){
  const response=new Response(text,{status:200,headers:{'content-type':'text/html; charset=utf-8','location':'/app/working-campus-v156.html'}});
  Object.defineProperty(response,'redirected',{value:true});
  return response;
}
function manualNavigation(url=`https://commonweave.invalid/app/working-campus-v156.html?installed=1&version=${version}`){
  const request=new Request(url,{method:'GET',redirect:'manual'});
  Object.defineProperty(request,'mode',{value:'navigate'});
  return request;
}

const context={
  console,URL,Request,Response,Headers,
  self:{},
  RUNTIME_CACHE:`runtime-v${version}`,
  cacheKey:pathname=>new Request(new URL(pathname,'https://commonweave.invalid').href),
  withTimeout:promise=>Promise.resolve(promise),
  responseLooksValid:response=>Boolean(response?.ok),
  caches:{open:async()=>({put:async(_key,response)=>runtimeWrites.push(response)})},
  findCached:async pathname=>cachedFactory(pathname),
  fetch:async request=>{lastFetchRequest=request;return networkFactory(request)},
  networkFirst:async()=>{throw new Error('original networkFirst should be replaced')},
  stableAppEntry:async()=>redirectedResponse('stable launcher'),
  cacheFirst:async()=>redirectedResponse('cached asset')
};
vm.runInNewContext(source,context,{filename:'service-worker-navigation-safety-v224.js'});

const fresh=await context.networkFirst(manualNavigation(),'/offline.html');
assert.equal(lastFetchRequest.redirect,'follow','Internal navigation fetch did not follow redirects.');
assert.equal(fresh.redirected,false,'Fresh navigation response retained its redirected flag.');
assert.equal(fresh.status,200);
assert.equal(fresh.headers.get('location'),null,'Normalized navigation leaked a Location header.');
assert.equal(fresh.headers.get('x-commonweave-navigation-normalized'),revision);
assert.equal(await fresh.text(),'fresh campus');
assert.equal(runtimeWrites.length,1,'Normalized fresh navigation was not cached.');
assert.equal(runtimeWrites[0].redirected,false,'Runtime cache stored a redirected response.');

networkFactory=()=>{throw new Error('offline')};
cachedFactory=pathname=>pathname.includes('working-campus')?redirectedResponse('cached campus'):null;
const cached=await context.networkFirst(manualNavigation(),'/offline.html');
assert.equal(cached.redirected,false,'Cached navigation response retained its redirected flag.');
assert.equal(await cached.text(),'cached campus');

cachedFactory=()=>({type:'opaqueredirect',status:0,headers:new Headers()});
const rejected=await context.networkFirst(manualNavigation(),'/offline.html');
assert.equal(rejected.status,503,'Unreadable opaqueredirect should be rejected instead of returned.');

const stable=await context.stableAppEntry(manualNavigation('https://commonweave.invalid/app/installed-entry-v146.html'));
assert.equal(stable.redirected,false,'Stable app entry retained its redirected flag.');
assert.equal(stable.headers.get('location'),null);

console.log(JSON.stringify({ok:true,version,revision,minimumVersion:'1.0.11',internalRedirectMode:lastFetchRequest.redirect,freshNormalized:true,cachedNormalized:true,opaqueRedirectRejected:true},null,2));
