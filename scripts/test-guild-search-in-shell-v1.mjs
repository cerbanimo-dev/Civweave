import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';

const read=path=>readFileSync(new URL(`../public/app/${path}`,import.meta.url),'utf8');
const shell=read('persistent-system-shell-v1.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const lobbySource=read('host-node-installer-lobby-v1.js'),symbolSource=read('guild-symbol-v1.js'),actionsSource=read('persistent-shell-actions-v1.js');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t,{lobby=true,symbol=true,failResource='',html=shell}={}){
  const errors=[],virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>errors.push(error.message));
  const dom=new JSDOM(html,{url:'https://civweave.test/app/persistent-system-shell-v1.html?system=fellowfare&installed=1',runScripts:'outside-only',virtualConsole}),{window}=dom;
  Object.defineProperty(window.document,'readyState',{value:'complete',configurable:true});
  window.HTMLElement.prototype.scrollIntoView=function(){};
  const requests=[],intervals=new Map(),observers=[];let locationCalls=0,joins=0,timerId=0,failures=0;
  const NativeObserver=window.MutationObserver;
  window.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this)}};
  window.setInterval=fn=>{const id=++timerId;intervals.set(id,fn);return id};window.clearInterval=id=>intervals.delete(id);
  window.requestAnimationFrame=fn=>window.setTimeout(fn,0);
  window.CivweaveHostNodeSessionV1={sessionFor:()=>null,hasCredential:()=>false,join:async()=>{joins++;throw new Error('No join was requested by this test.')}};
  Object.defineProperty(window.navigator,'geolocation',{value:{getCurrentPosition(resolve){locationCalls++;resolve({coords:{latitude:42.653789,longitude:-73.754321,accuracy:183}})}}});
  window.fetch=async(url,options={})=>{
    const parsed=new URL(String(url),window.location.href);requests.push({url:parsed,options});
    if(parsed.pathname==='/api/host-node-search')return Response.json({nodes:[{hostOrigin:'https://qa-guild.example.test',nodeId:'qa-guild',displayName:'QA fixture Guild',distanceKm:2.7,slots:{free:2,paid:0}}]});
    if(parsed.pathname==='/api/host-node-status')return Response.json({ok:true,nodeId:'qa-guild',displayName:'QA fixture Guild',hostOrigin:'https://qa-guild.example.test',capacityAvailable:true,slots:{free:2,paid:0}});
    return Response.json({ok:false},{status:503});
  };
  const append=window.document.head.append.bind(window.document.head);
  window.document.head.append=(...nodes)=>{
    append(...nodes);
    for(const node of nodes){
      if(node.tagName!=='SCRIPT')continue;
      const path=new URL(node.src,window.location.href).pathname;
      if(!['/app/guild-symbol-v1.js','/app/host-node-installer-lobby-v1.js'].includes(path))continue;
      queueMicrotask(()=>{
        if(path===failResource&&failures++===0){node.dispatchEvent(new window.Event('error'));return}
        window.eval(path.includes('guild-symbol')?symbolSource:lobbySource);node.dispatchEvent(new window.Event('load'));
      });
    }
  };
  if(lobby)window.eval(lobbySource);if(symbol)window.eval(symbolSource);
  t.after(async()=>{for(const observer of observers)observer.disconnect();intervals.clear();await flush();window.close()});
  return{window,requests,intervals,errors,get locationCalls(){return locationCalls},get joins(){return joins}};
}

test('nearby Guild search mounts the canonical lobby in a persistent shell without a main element',async t=>{
  const h=fixture(t),{window}=h;
  assert.equal(window.document.querySelector('main'),null,'Exercise the real persistent-parent document shape.');
  assert.equal(await window.CivweaveGuildSymbolV1.openNearbyGuilds(),true);await flush();
  const overlay=window.document.querySelector('#cw-nearby-guilds-overlay-v1'),mount=overlay.querySelector('#cw-nearby-guilds-mount-v1');
  assert.equal(overlay.hidden,false);assert.equal(mount.querySelectorAll('#cw-host-node-lobby').length,1);
  assert.ok(mount.querySelector('#cw-host-node-search-run'));assert.equal(mount.querySelector('#cw-host-node-search').hidden,false);
  assert.equal(h.locationCalls,0);assert.equal(h.joins,0);
  window.CivweaveGuildSymbolV1.closeNearbyGuilds();assert.equal(overlay.hidden,true);
  await window.CivweaveGuildSymbolV1.openNearbyGuilds();await flush();
  assert.equal(window.document.querySelectorAll('#cw-host-node-lobby').length,1);assert.equal(h.intervals.size,1,'Reopening must not create another refresh loop.');
  assert.equal(h.requests.filter(row=>row.url.pathname==='/api/federation/health').length,1,'Concurrent auto-boot/open must share the same owner initialization.');
  assert.deepEqual(h.errors,[]);assert.match(window.location.href,/persistent-system-shell-v1/);
});

test('the same lobby retains installer placement when no explicit in-app mount is requested',async t=>{
  const h=fixture(t,{symbol:false,html:'<main><section class="install-card"></section><section class="knowledge-card"></section></main>'}),{window}=h;
  await window.CivweaveHostNodeInstallerLobbyV1.boot();await flush();
  const lobby=window.document.querySelector('#cw-host-node-lobby');assert.ok(lobby);
  assert.equal(lobby.parentElement.tagName,'MAIN');assert.equal(lobby.nextElementSibling.className,'knowledge-card');
  assert.equal(window.document.querySelectorAll('#cw-host-node-lobby').length,1);assert.equal(h.intervals.size,1);assert.equal(h.locationCalls,0);assert.equal(h.joins,0);assert.deepEqual(h.errors,[]);
});

test('in-shell search requests location only from its real search control and renders the canonical rounded-location result',async t=>{
  const h=fixture(t),{window}=h;await window.CivweaveGuildSymbolV1.openNearbyGuilds();await flush();
  const select=window.document.querySelector('#cw-host-node-search-mode');assert.ok(select);select.value='free';
  assert.equal(h.locationCalls,0);window.document.querySelector('#cw-host-node-search-run').click();await flush();
  const request=h.requests.find(row=>row.url.pathname==='/api/host-node-search');assert.ok(request);assert.equal(request.options.method,'POST');
  assert.deepEqual(JSON.parse(request.options.body),{latitude:42.654,longitude:-73.754,accuracyMeters:200,mode:'free'});
  assert.equal(h.locationCalls,1);assert.equal(h.joins,0);
  const result=window.document.querySelector('[data-guild-origin]');assert.match(result.textContent,/QA fixture Guild/);result.click();await flush();
  assert.match(window.document.querySelector('#cw-host-node-title').textContent,/QA fixture Guild/);assert.equal(h.joins,0,'Selecting a search result must not silently join a Guild.');
  assert.deepEqual(h.errors,[]);assert.match(window.location.href,/persistent-system-shell-v1/);
});

test('a failed lobby resource leaves an actionable in-shell error and retries the same canonical search owner',async t=>{
  const h=fixture(t,{lobby:false,failResource:'/app/host-node-installer-lobby-v1.js'}),{window}=h;
  const result=await Promise.race([window.CivweaveGuildSymbolV1.openNearbyGuilds(),new Promise(resolve=>setTimeout(()=>resolve('stalled'),250))]);
  assert.equal(result,false,'A script error must settle instead of leaving an empty dialog waiting for a polling timeout.');
  const overlay=window.document.querySelector('#cw-nearby-guilds-overlay-v1');assert.equal(overlay.hidden,false);
  assert.match(overlay.textContent,/could not.*load|unavailable/i);
  const retry=overlay.querySelector('[data-cw-guild-search-retry]');assert.ok(retry);retry.click();await flush();await flush();
  assert.ok(overlay.querySelector('#cw-host-node-search-run'));assert.equal(window.document.querySelectorAll('#cw-host-node-lobby').length,1);
  assert.deepEqual(h.errors,[]);assert.match(window.location.href,/persistent-system-shell-v1/);
});

test('the persistent Guild launcher stays in the installed shell when its runtime fails and offers a retry',async t=>{
  const h=fixture(t,{lobby:false,symbol:false,failResource:'/app/guild-symbol-v1.js'}),{window}=h;
  window.document.body.insertAdjacentHTML('beforeend','<nav id="cw-themed-system-nav"><div class="cw-nav-utilities"></div></nav>');window.eval(actionsSource);
  assert.equal(await window.CivweavePersistentShellActionsV1.openGuilds(),false);await flush();
  const button=window.document.querySelector('[data-cw-persistent-action="guilds"]');assert.match(button.textContent,/Retry Guilds/);assert.match(button.getAttribute('aria-label'),/unavailable/i);
  assert.deepEqual(h.errors,[]);assert.match(window.location.href,/persistent-system-shell-v1/);
  button.click();await flush();await flush();assert.ok(window.document.querySelector('#cw-nearby-guilds-mount-v1 #cw-host-node-search-run'));
  assert.deepEqual(h.errors,[]);
});
