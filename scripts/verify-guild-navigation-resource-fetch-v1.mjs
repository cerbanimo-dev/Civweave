import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/service-worker-release-generation-v1.js','utf8');
const worker=readFileSync('public/service-worker-v203.js','utf8');
const root=readFileSync('public/service-worker.js','utf8');
const recovery=readFileSync('public/guild-release-recovery.html','utf8');
const revision=source.match(/const REVISION='([^']+)'/)?.[1];
const rootRevision=root.match(/const CIVWEAVE_ROOT_WORKER_BRIDGE='([^']+)'/)?.[1];
assert.ok(revision&&rootRevision,'canonical worker revisions must remain declared');
const get=(start,end)=>{const i=source.indexOf(start),j=source.indexOf(end,i+start.length);assert.ok(i>=0&&j>i,'missing worker source '+start);return source.slice(i,j)};
const body=get('async function network(request,pathname){','async function freshCached(pathname,method){');
const gate=get('async function responseFor(request,pathname){','async function warmOne(cache,pathname){');
const fetchStart=source.lastIndexOf("self.addEventListener('fetch',event=>{");
const fetchEnd=source.indexOf('\n});',fetchStart);
assert.ok(fetchStart>=0&&fetchEnd>fetchStart,'missing outer fetch listener');
const fetchListener=source.slice(fetchStart,fetchEnd+4);
assert.ok(fetchListener.includes('event.respondWith('),'real worker fetch handler must be used');
function evaluate(js,vars={}){
  const env={console,URL,Response,Request,Headers,Promise,Date,Map,Set,...vars};
  env.self=vars.self||{location:{origin:'https://civweave-staging.pages.dev'}};
  vm.createContext(env);
  vm.runInContext(js,env,{filename:'release-generation-worker.js'});
  return env;
}
const origin='https://civweave-staging.pages.dev',campus='/app/working-campus-v440.html',url=origin+campus;
let actualMode='',writes=0,writeFailures=0;
const env=evaluate(body+'\nthis.runNetwork=network;',{
  cacheKey:pathname=>new Request(origin+pathname),
  NETWORK_TIMEOUT_MS:3200,
  boundedFetch:async input=>{actualMode=input.mode;return new Response('CURRENT CAMPUS HTML',{status:200,headers:{'content-type':'text/html'}})},
  valid:r=>Boolean(r?.ok&&r.headers.get('content-type')==='text/html'),
  caches:{open:async()=>({put:async()=>{writes++;if(writeFailures)throw Error('QuotaExceededError: offline models occupy device storage')}})},
  CACHE:'cw-live-runtime-release-generation-v6-20261021',
  head:r=>new Response(null,{status:r.status,headers:r.headers})
});
const navigationRequest={url,mode:'navigate',method:'GET'};
let checked=await env.runNetwork(navigationRequest,campus);
assert.ok(checked?.ok,'document navigation must return an origin HTML response');
assert.equal(await checked.text(),'CURRENT CAMPUS HTML');
assert.equal(actualMode,'cors','nested worker fetch must use regular resource mode, not navigate mode');
assert.equal(writes,1,'origin cache still normally saves successful navigation');
writeFailures=1;
checked=await env.runNetwork(navigationRequest,campus);
assert.equal(checked.status,200,'quota error must not lose the successfully fetched Working Campus page');
assert.equal(await checked.text(),'CURRENT CAMPUS HTML');
const signed=[];
let signedInstalled=true;
const gateContext=evaluate(gate+'\nthis.runGate=responseFor;',{
 guildConfig:async()=>({origin:'https://legacy-guild.example'}),
 activeGuildRelease:async()=>signedInstalled?{cacheName:'cw-guild-release-v1-trusted'}:null,
 activeGuildResponse:async()=>{signed.push('signed');return new Response('SIGNED GUILD PAGE')},
 network:async()=>{signed.push('origin');return new Response('ORIGIN PAGE')},
 freshCached:async()=>null,legacyFallback:async()=>null,
 self:{location:{origin},CivweaveFiveSystemPagesV1:null}
});
let result=await gateContext.runGate(navigationRequest,campus);
assert.equal(await result.text(),'SIGNED GUILD PAGE');
assert.deepEqual(signed,['signed'],'complete signed Guild remains exclusive');
signedInstalled=false;signed.length=0;
result=await gateContext.runGate(navigationRequest,campus);
assert.equal(await result.text(),'ORIGIN PAGE');
assert.deepEqual(signed,['origin'],'unsigned Guild uses current same-origin recovery bytes');
const events=[];
const context=evaluate(fetchListener,{
  self:{location:{origin},addEventListener:(type,fn)=>events.push({type,fn})},
  ownedRuntimePath:()=>true,
  OWNED_PREFIXES:['/app/'],
  checkGuildRelease:async()=>null,
  responseFor:async()=>{throw Error('IndexedDB release state read failed')},
  REVISION:revision
});
const handler=events.find(event=>event.type==='fetch')?.fn;
assert.equal(typeof handler,'function');
let intercepted=false,outstanding;
handler({
 request:navigationRequest,
 stopImmediatePropagation(){intercepted=true},
 waitUntil(p){p.catch(()=>{})},
 respondWith(p){outstanding=p}
});
assert.equal(intercepted,true);
const failure=await outstanding;
assert.equal(failure.status,503,'fail closed on exceptions in release selection');
assert.match(failure.headers.get('content-type'),/text\/html/,'do not produce browser ERR_FAILED when a fetch promise rejects');
assert.match(await failure.text(),/guild-release-recovery\.html/,'provide non-destructive recovery link');
assert.ok(worker.includes(`/service-worker-release-generation-v1.js?v=${revision}`));
assert.ok(root.includes(`/service-worker-v203.js?v=${rootRevision}`));
assert.ok(recovery.includes(`REQUIRED_REVISION='${revision}'`));
assert.doesNotMatch(source,/caches\.delete\([^)]*model/,'release navigation must not erase local models');
console.log('PASS: browser navigation uses same-origin resource fetch; quota/cache errors do not discard fetched HTML; signed Guild remains exclusive; rejected fetch events show safe recovery page.');
