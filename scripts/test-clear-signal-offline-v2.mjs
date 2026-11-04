import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../public/app/clear-signal-v1.html',import.meta.url),'utf8');
const match=page.match(/\/\* CLEAR_SIGNAL_OFFLINE_BEGIN \*\/([\s\S]*?)\/\* CLEAR_SIGNAL_OFFLINE_END \*\//);
assert.ok(match,'Offline controls must be defined inside the self-contained page');
const code=match[1];

function harness({file=false,good=true,controlled=true,cacheAvailable=true}={}){
  const elements=new Map();
  const storage=new Map();
  let requests=0,online=true;
  const el=id=>{
    if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,listeners:new Map(),addEventListener(type,listener){this.listeners.set(type,listener)}});
    return elements.get(id);
  };
  const cachesApi={
    async open(name){
      let entries=storage.get(name);
      if(!entries){entries=new Map();storage.set(name,entries)}
      return{
        async match(request){const response=entries.get(request.url);return response?.clone()},
        async put(request,response){entries.set(request.url,response.clone())}
      };
    }
  };
  const sandbox={
    document:{getElementById:el},
    location:{protocol:file?'file:':'https:',origin:file?'null':'https://civweave-staging.pages.dev'},
    navigator:{serviceWorker:{controller:controlled?{}:null},storage:{async persist(){return true}}},
    Request,Response,URL,
    ...(cacheAvailable?{caches:cachesApi}:{}),
    async fetch(request){
      requests++;
      if(!online)throw new TypeError('offline');
      assert.equal(request.url,'https://civweave-staging.pages.dev/app/clear-signal-v1.html');
      return new Response(good?page:'<!doctype html><title>Other page</title>',{status:200,headers:{'content-type':'text/html'}});
    }
  };
  vm.runInNewContext(code,sandbox,{timeout:3000});
  return{
    el,storage,
    get requests(){return requests},
    setOnline(value){online=Boolean(value)},
    async click(id){return el(id).listeners.get('click')()}
  };
}

test('loading the page checks local storage without making network requests',async()=>{
  const a=harness();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(a.requests,0);
  assert.match(a.el('offline-status').textContent,/No verified offline copy/);
});

test('save verifies exact page, retains a copy, and remains checkable without internet',async()=>{
  const a=harness();
  assert.equal(await a.click('save-offline'),true);
  assert.equal(a.requests,1);
  assert.equal(a.storage.get('civweave-offline-clear-signal-v1').size,1);
  assert.match(a.el('offline-status').textContent,/saved and verified locally/);
  a.setOnline(false);
  assert.equal(await a.click('check-offline'),true);
  assert.equal(a.requests,1);
  assert.match(a.el('offline-status').textContent,/verified in device storage/);
});

test('rejects unexpected HTML rather than caching an error or login page',async()=>{
  const a=harness({good:false});
  assert.equal(await a.click('save-offline'),false);
  assert.match(a.el('offline-status').textContent,/Could not save a verified offline copy/);
  assert.equal(a.storage.get('civweave-offline-clear-signal-v1')?.size||0,0);
});

test('portable file works without browser cache and never fetches',async()=>{
  const a=harness({file:true,cacheAvailable:false});
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(a.el('offline-status').textContent,/Portable HTML copy/);
  assert.equal(await a.click('save-offline'),true);
  assert.equal(a.requests,0);
});
