import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync('public/service-worker-release-generation-v1.js','utf8');
const worker=readFileSync('public/service-worker-v203.js','utf8');
const rootWorker=readFileSync('public/service-worker.js','utf8');
const revision=src.match(/const REVISION='([^']+)'/)?.[1];
const rootRevision=rootWorker.match(/const CIVWEAVE_ROOT_WORKER_BRIDGE='([^']+)'/)?.[1];
assert.ok(revision&&rootRevision,'canonical release worker revisions must remain declared');
const block=(start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert(a>=0&&b>a,'missing release-generation code '+start);return src.slice(a,b)};
const warm=block('async function warm({guildChecked=false}={}){','async function originFallbackReady(){');
const ready=block('async function originFallbackReady(){','async function purgeStaleRuntimeEntries(){');
const purge=block('async function purgeStaleRuntimeEntries(){','async function activationRepair(){');
const legacy=block('async function legacyFallback(pathname,method){','async function responseFor(request,pathname){');
const response=block('async function responseFor(request,pathname){','async function warmOne(cache,pathname){');
const execute=(code,context)=>{const scope={...context,console,Date,Promise,Response,Request,Headers,Set,Map,URL,Object,String,Boolean,Number};vm.createContext(scope);vm.runInContext(code,scope);return scope};
const paths=['/index.html','/app/persistent-system-shell-v1.html','/app/working-campus-v440.html'];
const calls=[];
let guild={origin:'https://legacy-guild.example'},signed=false,checks=0;
const warmCtx=execute(warm+'\nthis.goWarm=warm;',{
  guildConfig:async()=>guild,checkGuildRelease:async()=>{checks++;return{ok:false,reason:'guild-has-no-release'}},
  activeGuildRelease:async()=>signed?{cacheName:'cw-guild-release-v1-active'}:null,
  caches:{open:async()=>({})},CACHE:'cw-live-runtime-release-generation-v6-20261021',
  WARM_PATHS:paths,WARM_CONCURRENCY:3,
  warmOne:async(_,path)=>{calls.push(path);return path}
});
const downloaded=await warmCtx.goWarm();
assert.equal(checks,1,'selected Guild without signed release must still be checked');
assert.deepEqual([...downloaded],paths,'selected unsigned Guild must warm the current origin release');
assert.deepEqual(calls,paths,'previous code returned [] and never warmed this origin');
signed=true;calls.length=0;
assert.equal((await warmCtx.goWarm()).length,0,'verified signed Guild remains exclusive; do not warm origin when installed');
assert.equal(calls.length,0);
guild=null; signed=false;calls.length=0;
assert.equal((await warmCtx.goWarm({guildChecked:true})).length,paths.length,'no selected Guild also warms origin package');
// Do not invalidate the only older installed origin package if new origin is
// incomplete, even if activation happened while offline.
const cacheNames=[
 'cw-live-runtime-release-generation-v5-20260923',
 'cw-live-runtime-release-generation-v6-20261021',
 'cw-guild-release-v1-partial',
 'civweave-shell-1.0.163',
 'civweave-offline-1.0.163',
 'civweave-model-cache-v1',
 'cwknowledge-offline-v1'
];
const deleted=[];let warmed=false,active=null;
const purgeCtx=execute(ready+purge+'\nthis.goPurge=purgeStaleRuntimeEntries;',{
  caches:{keys:async()=>cacheNames,delete:async name=>{deleted.push(name);return true}},
  dbGet:async key=>key==='activeRelease'?active:null,
  activeGuildRelease:async()=>active,
  WARM_PATHS:paths,freshCached:async path=>warmed||path===paths[0]?new Response('ok'):null,
  CACHE:'cw-live-runtime-release-generation-v6-20261021',
  CACHE_PREFIX:'cw-live-runtime-release-generation-',GUILD_CACHE_PREFIX:'cw-guild-release-v1-',
  self:{CivweaveFiveSystemPagesV1:null}
});
await purgeCtx.goPurge();
assert.deepEqual(deleted,[],'before new package is complete do not purge last known working shell or Guild records');
warmed=true;
await purgeCtx.goPurge();
assert.deepEqual(deleted.sort(),[
 'cw-live-runtime-release-generation-v5-20260923','cw-guild-release-v1-partial'
].sort(),'when new origin release is complete, only outdated release-generation caches are pruned');
assert.ok(!deleted.some(n=>/civweave-(?:shell|offline|model)/.test(n)),'preserve installed PWA, offline campus and model weights');
deleted.length=0;warmed=false;
active={cacheName:'cw-guild-release-v1-active'};
await purgeCtx.goPurge();
assert.ok(!deleted.includes('cw-guild-release-v1-active'),'complete signed Guild cache is never deleted');
// Unverified Guild fragments in CacheStorage must not be mistaken for
// trusted origin release bytes; existing signature verification is retained.
const url='https://civweave-staging.pages.dev/app/persistent-system-shell-v1.html';
const forged=new Response('UNVERIFIED GUILD',{headers:{'content-type':'text/html','x-civweave-guild-release':'bad'}});
const original=new Response('INSTALLED ORIGIN RELEASE',{headers:{'content-type':'text/html'}});
let serveGuild=false;
const legacyCtx=execute(legacy+'\nthis.readLegacy=legacyFallback;',{
 caches:{
  keys:async()=>['cw-guild-release-v1-partial','civweave-shell-1.0.163','cw-live-runtime-release-generation-v5-20260923'],
  open:async name=>({match:async()=>name==='cw-guild-release-v1-partial'?forged.clone():name==='civweave-shell-1.0.163'?(serveGuild?forged.clone():original.clone()):undefined})
 },
 ORIGIN_CACHE_PREFIXES:['cw-live-runtime-release-generation-','civweave-shell-','civweave-runtime-','civweave-offline-'],
 cacheKey:pathname=>new Request(new URL(pathname,'https://civweave-staging.pages.dev')),
 valid:(r,path)=>Boolean(r?.ok&&r.headers.get('content-type')==='text/html'),
 head:r=>new Response(null,{status:r.status,headers:r.headers})
});
let rescued=await legacyCtx.readLegacy('/app/persistent-system-shell-v1.html','GET');
assert.equal(await rescued.text(),'INSTALLED ORIGIN RELEASE','offline runtime comes from installed origin, never partial Guild cache');
serveGuild=true;
rescued=await legacyCtx.readLegacy('/app/persistent-system-shell-v1.html','GET');
assert.equal(rescued,null,'a signed-Guild-labelled response cannot be served as unsigned origin fallback');
const responseCtx=execute(response+'\nthis.goResponse=responseFor;',{
  guildConfig:async()=>({origin:'https://legacy-guild.example'}),
  activeGuildRelease:async()=>null,
  self:{CivweaveFiveSystemPagesV1:null},
  network:async()=>null,freshCached:async()=>null,
  legacyFallback:async()=>original.clone(),
  activeGuildResponse:async()=>{throw Error('no signed Guild release should be selected')},
  REVISION:revision,
  Response
});
const recovered=await responseCtx.goResponse({method:'GET',mode:'navigate'},'/app/persistent-system-shell-v1.html');
assert.equal(await recovered.text(),'INSTALLED ORIGIN RELEASE','selected legacy Guild cannot strand cached installed origin');
assert.match(src,/if\(active\)return activeGuildResponse\(pathname,request\.method,active\)/,'verified signed Guild still exclusive');
assert.match(src,/verifyManifest\(manifest,bundle\)/,'signed release must still be verified');
assert.match(src,/Guild release signature was rejected/,'signature validation must remain intact');
assert.match(src,/Guild release asset hash mismatch/,'release assets must remain verified');
assert.match(src,/release-key-revocation\.v1/,'revocations must remain active');
assert.ok(worker.includes(`/service-worker-release-generation-v1.js?v=${revision}`));
assert.ok(rootWorker.includes(`/service-worker-v203.js?v=${rootRevision}`));
console.log('PASS: selected unsigned Guild warms origin, failed update preserves installed shell and models, partial Guild cache excluded, signed release remains exclusive.');
