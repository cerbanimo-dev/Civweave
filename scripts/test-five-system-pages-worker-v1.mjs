import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = path => readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8');
const source = read('service-worker-five-system-pages-v1.js');
const origin = 'https://civweave-staging.pages.dev';
const pages = [
  ['living-school', '/app/cabinets/living-school/index.html'],
  ['cerbanimo', '/app/realm-console-v140.html'],
  ['fellowfare', '/app/fellowfare-cabinet-v144.html'],
  ['anarchadia', '/app/anarchadia-console-v139.html'],
];

function harness({ releaseOwner = false, guildActive = false, stagingRecovery = false } = {}) {
  const listeners = {}, stores = new Map();
  let online = true, networkBody, networkType = 'text/html; charset=utf-8';
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        match: async path => store.get(path)?.clone(),
        put: async (path, response) => store.set(path, response.clone()),
        keys: async () => [...store.keys()].map(path => new Request(new URL(path,origin).href)),
        delete: async request => store.delete(request.url)||store.delete(new URL(request.url).pathname),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
  };
  const context = { URL, Request, Response, Headers, AbortController, setTimeout, clearTimeout, caches,
    self: { location: { origin,hostname:new URL(origin).hostname }, clients:{claim:async()=>{}}, skipWaiting:async()=>{}, addEventListener: (name, handler) => { (listeners[name] ||= []).push(handler); } },
    fetch: async request => {
      if (!online) throw new Error('offline');
      const pathname = new URL(request.url).pathname;
      const actual = pages.find(([, path]) => path === pathname || path.replace(/index\.html$/, '').replace(/\.html$/, '') === pathname)?.[1] ?? pathname;
      return new Response(networkBody ?? read(actual.slice(1)), { headers: { 'content-type': networkType } });
    },
  };
  if(releaseOwner){
    Object.assign(context,{OWNED_PREFIXES:['/app/'],REVISION:'review-release',ownedRuntimePath:()=>true,
      guildConfig:async()=>guildActive?{origin:'https://guild.test'}:null,
      activeGuildRelease:async()=>guildActive?{releaseId:'signed-fixture'}:null,
      activeGuildResponse:async()=>new Response('signed Guild runtime',{headers:{'x-review-owner':'guild'}}),
      network:async()=>new Response('generic unvalidated runtime',{headers:{'x-review-owner':'generic'}}),
      freshCached:async()=>null,legacyFallback:async()=>null,checkGuildRelease:async()=>null,dbGet:async()=>null,
      // Realm-cache retirement is tested with a complete origin replacement available.
      originFallbackReady:async()=>true,
    });
    const release=read('service-worker-release-generation-v1.js');
    for(const name of ['CACHE','CACHE_PREFIX','GUILD_CACHE_PREFIX'])context[name]=release.match(new RegExp(`const ${name}=['"]([^'"]+)['"]`))?.[1];
    const responseStart=release.indexOf('async function responseFor('),responseEnd=release.indexOf('async function warmOne(',responseStart);
    const purgeStart=release.indexOf('async function purgeStaleRuntimeEntries('),purgeEnd=release.indexOf("self.addEventListener('message'",purgeStart);
    const fetchStart=release.lastIndexOf("self.addEventListener('fetch',event=>{"),fetchEnd=release.indexOf('self.CivweaveReleaseGenerationV1=',fetchStart);
    assert.ok(responseStart>=0&&responseEnd>responseStart&&fetchStart>=0&&fetchEnd>fetchStart,'canonical release transport contract must remain discoverable');
    assert.ok(purgeStart>=0&&purgeEnd>purgeStart,'canonical release activation must remain discoverable');
    vm.runInNewContext(release.slice(responseStart,responseEnd)+release.slice(purgeStart,purgeEnd)+release.slice(fetchStart,fetchEnd),context);
  }
  vm.runInNewContext(source, context);
  context.CivweaveFiveSystemPagesV1=context.self.CivweaveFiveSystemPagesV1;
  if(stagingRecovery){
    const registered=read('service-worker-v203.js'),start=registered.indexOf('const V203_STAGING_RECOVERY_HOST='),end=registered.indexOf('// staging-installed-entry-takeover-v24',start);
    assert.ok(start>=0&&end>start,'the canonical staging activation lane must remain discoverable');
    vm.runInNewContext(registered.slice(start,end),context);
  }
  return {
    stores, api: context.self.CivweaveFiveSystemPagesV1,
    offline() { online = false; },
    payload(body, type = 'text/html') { networkBody = body; networkType = type; },
    async activate() { for(const listener of listeners.activate||[]){let completion;listener({ waitUntil: promise => { completion = promise; } });await completion;} },
    async navigate(path, { embedded = true, method = 'GET' } = {}) {
      const request = new Request(`${origin}${path}${embedded ? '?system=cerbanimo&installed=1&embed=1&persistentShell=1' : ''}`, { method });
      Object.defineProperty(request, 'mode', { value: 'navigate' });
      let response, intercepted = false;
      for(const listener of listeners.fetch||[]){listener({request,stopImmediatePropagation(){intercepted=true},respondWith(value){response=value},waitUntil(value){void value.catch(()=>{})}});if(intercepted)break;}
      assert.equal(intercepted, true);
      return await response;
    },
  };
}

test('the navigation worker accepts every current realm HTML and retains it offline', async () => {
  for (const [system, path] of pages) {
    const h = harness();
    const online = await h.navigate(path);
    assert.equal(online.status, 200, `${system}: current checked-in page must pass validation`);
    assert.equal(online.headers.get('x-civweave-system'), system);
    assert.equal(await online.text(), read(path.slice(1)));
    h.offline();
    assert.equal(await (await h.navigate(path)).text(), read(path.slice(1)));
    const head = await h.navigate(path, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  }
});

test('the earlier release transport delegates ordinary realm navigation to the validated owner',async()=>{
  const registered=read('service-worker-v203.js');
  assert.ok(registered.indexOf('/service-worker-release-generation-v1.js')<registered.indexOf('/service-worker-five-system-pages-v1.js'),'test must model the registered worker listener order');
  const h=harness({releaseOwner:true}),path='/app/realm-console-v140';
  assert.equal((await h.navigate(path)).headers.get('x-civweave-system'),'cerbanimo','generic release transport must not preempt canonical realm validation');
  h.payload(read('app/fellowfare-cabinet-v144.html'));
  const bad=harness({releaseOwner:true});bad.payload(read('app/fellowfare-cabinet-v144.html'));
  assert.equal((await bad.navigate(path)).status,503,'wrong-system HTML must still be rejected through the combined listener graph');
  const redirect=await h.navigate(path,{embedded:false});
  assert.equal(redirect.status,302);
});

test('signed Guild releases retain exclusive transport ahead of ordinary realm validation',async()=>{
  const h=harness({releaseOwner:true,guildActive:true});
  const result=await h.navigate('/app/realm-console-v140');
  assert.equal(result.headers.get('x-review-owner'),'guild');
  assert.equal(await result.text(),'signed Guild runtime');
});

test('release activation preserves current validated realm pages for delegated offline navigation',async()=>{
  const h=harness({releaseOwner:true}),path='/app/realm-console-v140';
  assert.equal((await h.navigate(path)).status,200);
  h.stores.set('cw-five-system-pages-v2',new Map([['/app/realm-console-v140.html',new Response('old realm')]]));
  await h.activate();
  assert.equal(h.stores.has('cw-five-system-pages-v2'),false,'the realm owner must still retire old generations');
  h.offline();
  const offline=await h.navigate(path);
  assert.equal(offline.status,200,'generic activation must not erase the current canonical realm cache');
  assert.equal(await offline.text(),read('app/realm-console-v140.html'));
});

test('combined staging activation preserves the declared realm cache for offline navigation',async()=>{
  const h=harness({releaseOwner:true,stagingRecovery:true}),path='/app/realm-console-v140';
  assert.equal((await h.navigate(path)).status,200);
  await h.activate();
  h.offline();
  const offline=await h.navigate(path);
  assert.equal(offline.status,200,'source takeover must not erase the canonical realm owner’s freshly validated cache');
  assert.equal(await offline.text(),read('app/realm-console-v140.html'));
});

test('old Cerbanimo HTML is replaced by the current page and cannot hide an unavailable update', async () => {
  const h = harness(), path = '/app/realm-console-v140.html';
  const oldPage = '<title>Civweave Realm Console</title><script src="/app/realm-console-v140.js"></script><p>Old screen</p>';
  const oldStore = new Map([[path, new Response(oldPage, { headers: { 'content-type': 'text/html' } })]]);
  h.stores.set('cw-five-system-pages-v2', oldStore);
  await h.activate();
  assert.equal(h.stores.has('cw-five-system-pages-v2'), false, 'retire the obsolete page cache');
  assert.equal(await (await h.navigate(path)).text(), read(path.slice(1)));
  h.stores.get(h.api.cache).set(path, new Response(oldPage, { headers: { 'content-type': 'text/html' } }));
  h.offline();
  assert.equal((await h.navigate(path)).status, 503, 'reject old markup rather than report it as the current system');
});

test('the realm worker rejects wrong-system and non-HTML responses', async () => {
  for (const [body, type] of [[read('app/fellowfare-cabinet-v144.html'), 'text/html'], ['{"ok":true}', 'application/json'], [read('app/realm-console-v140.html'), 'text/plain']]) {
    const h = harness(); h.payload(body, type);
    assert.equal((await h.navigate('/app/realm-console-v140.html')).status, 503);
  }
});

test('top-level Cerbanimo entry still redirects to the shared shell', async () => {
  const response = await harness().navigate('/app/realm-console-v140.html', { embedded: false });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `${origin}/app/persistent-system-shell-v1.html?system=cerbanimo&installed=1`);
});

test('Pages clean URLs use the same validated realm response and offline cache', async () => {
  for (const [, path] of pages) {
    const h = harness(), cleanPath = path.replace(/index\.html$/, '').replace(/\.html$/, '');
    assert.equal((await h.navigate(cleanPath)).status, 200);
    h.offline();
    assert.equal(await (await h.navigate(path)).text(), read(path.slice(1)));
  }
});

test('staging activates the corrected worker and purges only changed executable assets', async () => {
  const registered = read('service-worker-v203.js');
  const start = registered.indexOf("const V203_STAGING_RECOVERY_HOST=");
  const end = registered.indexOf('// staging-installed-entry-takeover-v24', start);
  assert.ok(start > 0 && end > start);
  const listeners = {}, deleted = [], stores = new Map();
  const requests = [
    '/app/realm-console-v140.html', '/app/realm-console-v140',
    '/app/realm-console-v140.js', '/app/cerbanimo-quest-engine-v144.js',
    '/app/cerbanimo-video-task-contract-v1.mjs', '/app/cw-reward-receivers-v2.js',
    '/app/persistent-system-shell-v1.js',
    '/app/local-ai/model-packs/user-model.litertlm', '/saved-proof.bin',
  ].map(path => new Request(origin + path));
  stores.set('app-cache', { keys: async () => requests, delete: async request => { deleted.push(new URL(request.url).pathname); } });
  stores.set('cw-guild-release-v1-signed-fixture', { keys: async () => requests, delete: async () => { assert.fail('signed Guild package bytes must remain immutable during a staging update'); } });
  stores.set('cwrecovery-v453-learning-source-pack-authority', { keys: async () => [], match: async () => new Response('previous-generation'), put: async () => {} });
  let skipped = 0, claimed = 0;
  const context = vm.createContext({ URL, Request, Response,
    caches: { keys: async () => [...stores.keys()], open: async name => {
      if (!stores.has(name)) stores.set(name, { keys: async () => [], match: async () => undefined, put: async () => {} });
      return stores.get(name);
    } },
    self: { location: { origin, hostname: 'civweave-staging.pages.dev' },
      skipWaiting: async () => { skipped++; },
      clients: { matchAll: async () => [], claim: async () => { claimed++; } },
      addEventListener: (name, fn) => { listeners[name] = fn; },
    },
  });
  vm.runInContext(registered.slice(start, end), context);
  for (const type of ['install', 'activate']) {
    let done; listeners[type]({ waitUntil: value => { done = value; } }); await done;
  }
  assert.equal(skipped, 1, 'old recovery marker must not suppress the new staging activation');
  assert.equal(claimed, 1);
  assert.deepEqual(deleted.sort(), requests.slice(0, 7).map(request => new URL(request.url).pathname).sort());
});
