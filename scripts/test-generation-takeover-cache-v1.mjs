import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../public/service-worker-weave-pipeline-takeover-v1.js',import.meta.url),'utf8');
const origin='https://civweave-staging.pages.dev';

test('generation activation purges stale origin executables while preserving signed Guild packages and user data',async()=>{
  const changed=['/app/persistent-system-shell-v1.html','/app/local-ai/litert-gemma4-fast-runtime-v1.js','/app/human-message-bubble-v1.js','/app/human-chat-ble-controls-v1.js','/app/minilm-response-router-v347.js','/app/minilm-decision-strip-v1.js','/app/shared-chat-face-icons-v255.js','/app/themed-system-nav-v178.js','/app/persistent-shell-actions-v1.js','/app/host-node-session-v1.js','/app/guild-chat-usage-v1.js'];
  const data=['/app/local-ai/user-model.litertlm','/proofs/saved-image.bin'];
  const listeners={},deleted=[],stores=new Map();
  function cache(name,paths=[]){
    const entries=new Map(paths.map(path=>[origin+path,new Response(path)]));
    const value={
      keys:async()=>[...entries.keys()].map(url=>new Request(url)),
      match:async request=>entries.get(request.url)?.clone(),
      put:async(request,response)=>entries.set(request.url,response.clone()),
      delete:async request=>{deleted.push([name,new URL(request.url).pathname]);return entries.delete(request.url)},
    };
    stores.set(name,value);return value;
  }
  cache('civweave-runtime-fixture',[...changed,...data]);
  cache('cw-guild-release-v1-signed-fixture',[...changed,...data]);
  cache('current-realm-fixture',[...changed,...data]);
  const context={URL,Request,Response,caches:{keys:async()=>[...stores.keys()],open:async name=>stores.get(name)||cache(name)},
    self:{location:{origin,hostname:'civweave-staging.pages.dev'},CivweaveFiveSystemPagesV1:{cache:'current-realm-fixture'},skipWaiting:async()=>{},
      clients:{claim:async()=>{},matchAll:async()=>[]},addEventListener:(type,listener)=>{listeners[type]=listener}}};
  vm.runInNewContext(source,context);
  let completion;listeners.activate({waitUntil:value=>{completion=value}});await completion;
  assert.deepEqual(deleted,[...changed.map(path=>['civweave-runtime-fixture',path])],'signed executable bytes must remain immutable and proofs/model weights must remain intact');
  for(const path of [...changed,...data])assert.ok(await stores.get('cw-guild-release-v1-signed-fixture').match(new Request(origin+path)));
  deleted.length=0;
  listeners.activate({waitUntil:value=>{completion=value}});await completion;
  assert.deepEqual(deleted,[],'completed recovery marker must prevent repeated purge work');
});
