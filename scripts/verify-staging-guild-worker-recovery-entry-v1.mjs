import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync('public/guild-release-recovery.html','utf8');
const oldWorker=readFileSync('public/service-worker-release-generation-v1.js','utf8');
const core=readFileSync('public/service-worker-core-v208.js','utf8');
assert.match(html,/<title>Civweave · Safe Guild Release Recovery<\/title>/);
assert.match(html,/<button[^>]+id="repair"/,'repair requires explicit click');
assert.match(html,/guild-release-recovery-v2/,'root landing is a separate recovery document');
assert.match(html,/model caches, or Guild data were changed/);
assert.doesNotMatch(html,/src="\/app\//,'page must not need Guild-owned application assets to load');
const inline=html.match(/<script>([\s\S]+?)<\/script>/)?.[1];
assert.ok(inline,'recovery page is self-contained with inline repair script');
assert.doesNotMatch(inline,/caches\.delete\(/,'repair must never delete any CacheStorage cache');
assert.doesNotMatch(inline,/indexedDB\.deleteDatabase\(/,'repair must not remove release trusts');
assert.doesNotMatch(inline,/\.unregister\(/,'repair must replace worker in-place, not unregister');
assert.doesNotMatch(inline,/location\.replace\(/,'repair must not automatically redirect');
assert.match(inline,/register\(url,\{scope:'\/',updateViaCache:'none'\}\)/,'fresh worker registration with no import script cache');
assert.match(inline,/text\.includes\(REQUIRED_REVISION\)/,'preflight staged recovery build before SW update');
assert.ok(!oldWorker.includes("pathname==='/guild-release-recovery.html'"),'rescue path is never owned by the Guild release boundary');
assert.match(core,/request\.mode === 'navigate' \|\| url\.pathname === '\/'/,'unowned root rescue is served network-first');

let calls,logs,controller;
function setup({versionReady=true,campusHealthy=true}={}){
  calls={network:0,register:[],cacheReads:0,cacheDeletes:0,unregister:0,campusChecks:0};
  const buttons={};
  const elm=id=>{
    if(buttons[id])return buttons[id];
    const n={id,hidden:id==='open',disabled:false,href:'',textContent:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn}};
    buttons[id]=n;return n;
  };
  const active={state:'activated',scriptURL:'https://civweave-staging.pages.dev/service-worker-v203.js?v=previous-release'};
  const reg={
    scope:'https://civweave-staging.pages.dev/',
    active,waiting:null,installing:null,
    unregister(){calls.unregister++;throw Error('must not unregister')},
  };
  const scope={
    document:{getElementById:elm},
    location:{hostname:'civweave-staging.pages.dev',origin:'https://civweave-staging.pages.dev'},
    navigator:{serviceWorker:{
      getRegistration:async()=>reg,
      register:async(url,options)=>{
        calls.register.push({url,options});
        active.scriptURL=new URL(url,scope.location.origin).href;
        return reg;
      }
    }},
    caches:{keys:async()=>{calls.cacheReads++;return ['civweave-model-generative-v266','civweave-offline-campus']},
      delete:async()=>{calls.cacheDeletes++;throw Error('must not delete caches')}},
    fetch:async request=>{
      calls.network++;
      if(new URL(request.url).pathname==='/app/working-campus-v440.html'){
        calls.campusChecks++;
        return campusHealthy
          ?new Response('<!doctype html><title>Working Campus</title>',{status:200,headers:{'content-type':'text/html; charset=utf-8'}})
          :new Response('The selected Guild does not yet have a compatible signed Civweave release.',{status:503,headers:{'content-type':'text/plain'}});
      }
      return new Response(versionReady
        ? "importScripts('/service-worker-release-generation-v1.js?v=release-generation-boundary-v8-navigation-resource-fetch');"
        : "importScripts('/service-worker-release-generation-v1.js?v=release-generation-boundary-v6-current-realm-navigation');",
      {status:200,headers:{'content-type':'application/javascript'}});
    },
    Request,Response,URL,Date,Promise,setTimeout,clearTimeout,
    console
  };
  scope.globalThis=scope;
  vm.createContext(scope);vm.runInContext(inline,scope,{filename:'guild-release-recovery.html'});
  return{scope,elm,calls,active,reg};
}
const old=setup({versionReady:false});
assert.equal(old.calls.network,0,'landing must not automatically request or mutate a worker');
assert.equal(old.calls.register.length,0);
await old.elm('repair').handlers.click();
await new Promise(resolve=>setTimeout(resolve,25));
assert.equal(old.calls.register.length,0,'stale worker MUST fail preflight without replacing registration');
assert.match(old.elm('output').textContent,/required signed-Guild recovery revision/);
assert.equal(old.calls.cacheDeletes,0);
const current=setup({versionReady:true});
await current.elm('inspect').handlers.click();
await new Promise(resolve=>setTimeout(resolve,25));
assert.match(current.elm('output').textContent,/Model cache namespaces detected: 1/);
assert.match(current.elm('output').textContent,/Recovery-version worker: not confirmed/);
assert.equal(current.calls.register.length,0,'read-only inspection never registers worker');
await current.elm('repair').handlers.click();
await new Promise(resolve=>setTimeout(resolve,25));
assert.equal(current.calls.register.length,1,'click explicitly registers newer worker');
assert.equal(current.calls.register[0].options.scope,'/');
assert.equal(current.calls.register[0].options.updateViaCache,'none');
assert.match(current.calls.register[0].url,/guild-origin-rescue-/);
assert.equal(current.calls.cacheDeletes,0,'no stored model files or app caches purged');
assert.equal(current.calls.unregister,0,'no unregistered or orphaned app');
assert.equal(current.elm('open').hidden,false,'open app only after new worker reports activated');
assert.match(current.elm('output').textContent,/All local data and model caches retained/);
assert.equal(new URL(current.elm('open').href,'https://civweave-staging.pages.dev').pathname,'/app/working-campus-v440.html','Browser recovery must bypass broken installed-entry and PWA start routes');
assert.doesNotMatch(current.elm('open').href,/installed=1|installed-entry|pwa-start/,'browser recovery must not enter PWA-only launch flow');
await current.elm('inspect').handlers.click();
await new Promise(resolve=>setTimeout(resolve,25));
assert.match(current.elm('output').textContent,/Recovery-version worker: YES/);
assert.match(current.elm('output').textContent,/Last repair: worker was activated in this session/);
assert.match(current.elm('output').textContent,/guild-origin-rescue-/,'Inspect must display worker query string rather than just pathname');
await current.elm('test').handlers.click();
await new Promise(resolve=>setTimeout(resolve,25));
assert.match(current.elm('output').textContent,/Working Campus response: HTTP 200/);
assert.equal(current.calls.campusChecks,1,'Campus health check must request the real campus, not another worker script');
const failing=setup({campusHealthy:false});
await failing.elm('test').handlers.click();
await new Promise(resolve=>setTimeout(resolve,25));
assert.match(failing.elm('output').textContent,/HTTP 503/,'recovery page must display actual Guild error rather than silently redirect');
assert.match(failing.elm('output').textContent,/selected Guild does not yet have a compatible signed/);
assert.equal(failing.calls.cacheDeletes,0,'diagnostics must not erase model weights');
console.log('PASS: old Guild-sw interception leaves root rescue navigable; guarded click updates worker with no model/cache/Guild deletion.');
