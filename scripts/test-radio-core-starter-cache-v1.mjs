import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const layer=await readFile(new URL('../public/service-worker-radio-core-v305.js',import.meta.url),'utf8');
const starter=await readFile(new URL('../public/downloads/hub-media/open-music/starter-catalog.json',import.meta.url),'utf8');
const MANIFEST='/downloads/hub-media/open-music/starter-catalog.json';
const SHELL='civweave-shell-test';
function runtime({failPath='',baseReady=true}={}){
  const stores=new Map(),fetched=[];
  const cacheFor=name=>{
    if(!stores.has(name))stores.set(name,new Map());
    const entries=stores.get(name);
    return{
      async put(key,response){entries.set(String(key),response.clone())},
      async match(key){return entries.get(String(key))?.clone()||null},
      async keys(){return [...entries.keys()]}
    };
  };
  const scope=vm.createContext({
    self:{},Promise,Object,String,Boolean,Array,Error,Response,
    SHELL_CACHE:SHELL,FETCH_TIMEOUT_MS:1000,cacheKey:path=>path,
    responseLooksValid:response=>Boolean(response?.ok),
    fetchFresh:async path=>{
      fetched.push(path);if(path===failPath)throw new Error('Synthetic required asset unavailable');
      return new Response(path===MANIFEST?starter:`asset:${path}`,{headers:{'content-type':path.endsWith('.json')?'application/json':'text/plain'}});
    },
    caches:{async open(name){return cacheFor(name)},async delete(name){return stores.delete(name)}},
    cacheShell:async()=>({integrity:'verified',baseOwnerPreserved:true}),
    shellStatus:async()=>({ready:baseReady,baseOwnerPreserved:true})
  });
  vm.runInContext(layer,scope,{filename:'service-worker-radio-core-v305.js'});
  return{scope,stores,fetched,api:scope.self.CivweaveRadioCoreV305};
}

test('required radio shell caches the small starter manifest without fetching any referenced MP3',async()=>{
  const x=runtime(),required=Array.from(x.api.requiredAssets);
  assert.ok(required.includes(MANIFEST));assert.match(x.api.revision,/direct-audio/);
  assert.ok(!required.some(path=>/\.mp3(?:\?|$)|\/open-music\/audio\//i.test(path)));
  const result=await x.scope.cacheShell();
  assert.equal(result.baseOwnerPreserved,true);assert.equal(result.integrity,'verified');
  assert.equal(result.radioRequiredAssetCount,required.length);assert.equal(result.radioRevision,x.api.revision);
  assert.deepEqual([...x.fetched].sort(),[...required].sort());
  const cached=x.stores.get(SHELL).get(MANIFEST);assert.ok(cached);
  const packet=await cached.clone().json();assert.equal(packet.records.length,3);
  assert.ok(Buffer.byteLength(starter)<32768,'install requires metadata, not large audio');
  assert.ok(packet.records.every(row=>row.files.some(file=>file.url.endsWith('.mp3'))),'fixture contains real audio references that must remain lazy');
  assert.equal(x.fetched.filter(path=>/\.mp3(?:\?|$)/i.test(path)).length,0);
  assert.equal(x.stores.has(`${SHELL}-radio-v305-staging`),false);
});

test('removing the required starter manifest makes the device package incomplete and reports the exact missing path',async()=>{
  const x=runtime();await x.scope.cacheShell();
  let status=await x.scope.shellStatus();const expected=Array.from(x.api.requiredAssets).length;
  assert.equal(status.ready,true);assert.equal(status.radioPresentCount,expected);
  assert.equal(status.radioRequiredAssetCount,expected);assert.equal(status.radioCoreReady,true);
  x.stores.get(SHELL).delete(MANIFEST);
  status=await x.scope.shellStatus();assert.equal(status.ready,false);assert.equal(status.radioCoreReady,false);
  assert.equal(status.baseOwnerPreserved,true);assert.equal(status.radioPresentCount,expected-1);
  assert.deepEqual(Array.from(status.radioMissing),[MANIFEST]);
  const repaired=await x.api.repair();assert.equal(repaired.ready,true);
  status=await x.scope.shellStatus();assert.equal(status.ready,true);assert.equal(status.radioPresentCount,expected);
});

test('a failed starter manifest fetch fails the atomic radio install and cannot publish partial radio assets',async()=>{
  const x=runtime({failPath:MANIFEST});
  await assert.rejects(x.scope.cacheShell(),error=>{
    assert.match(error.message,/Radio core incomplete/);assert.equal(error.radioRevision,x.api.revision);
    assert.deepEqual(Array.from(error.failures,row=>row.pathname),[MANIFEST]);return true;
  });
  assert.ok(x.fetched.includes(MANIFEST));assert.equal(x.stores.has(`${SHELL}-radio-v305-staging`),false);
  assert.equal(x.stores.has(SHELL),false,'failed staged radio transaction cannot copy successful partial assets into the active shell');
  const status=await x.scope.shellStatus();assert.equal(status.ready,false);assert.equal(status.radioCoreReady,false);
});

test('radio completeness cannot override a failure from the owning shell status',async()=>{
  const x=runtime({baseReady:false});await x.scope.cacheShell();
  const status=await x.scope.shellStatus();assert.equal(status.radioCoreReady,true);assert.equal(status.ready,false);
  assert.equal(status.baseOwnerPreserved,true);assert.equal(status.radioRequiredAssetCount,status.radioPresentCount);
});
