import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {gzipSync} from 'node:zlib';
import vm from 'node:vm';
import test,{before,after} from 'node:test';

const source=readFileSync(new URL('../public/service-worker-release-generation-v1.js',import.meta.url),'utf8');
const block=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b)};
const network=block('async function network(request,pathname){','async function freshCached(pathname,method){');
const route=block('async function responseFor(request,pathname){','async function warmOne(cache,pathname){');
const fetchStart=source.lastIndexOf("self.addEventListener('fetch',event=>{"),fetchEnd=source.indexOf('self.CivweaveReleaseGenerationV1=',fetchStart);
assert.ok(fetchStart>=0&&fetchEnd>fetchStart);
const listener=source.slice(fetchStart,fetchEnd);
let origin,server;
before(async()=>{
  server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.endsWith('.html')){res.writeHead(302,{location:url.pathname.slice(0,-5)+url.search});res.end();return}
    const body=gzipSync('<!doctype html><title>Current origin shell</title>');
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'self'",'x-current-origin':'yes','content-encoding':'gzip','content-length':body.length});
    res.end(body);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))});

function harness({cached=null,offline=false,signed=false,response=null}={}){
  const events=[],saved=[];let requests=0;
  const env={console,URL,Request,Response,Headers,Promise,
    NETWORK_TIMEOUT_MS:500,CACHE:'origin-test-cache',REVISION:'review-generation',OWNED_PREFIXES:['/app/'],
    self:{location:{origin},addEventListener:(name,fn)=>events.push([name,fn])},
    ownedRuntimePath:()=>true,checkGuildRelease:async()=>null,
    guildConfig:async()=>signed?{origin:'https://guild.example'}:null,
    activeGuildRelease:async()=>signed?{cacheName:'signed-test-cache'}:null,
    activeGuildResponse:async()=>new Response('SIGNED RELEASE',{headers:{'x-civweave-guild-release':'signed-test'}}),
    cacheKey:path=>new Request(origin+path),valid:r=>Boolean(r?.ok),head:r=>new Response(null,{status:r.status,headers:r.headers}),
    freshCached:async()=>cached?.clone()||null,legacyFallback:async()=>null,
    caches:{open:async()=>({put:async(key,value)=>saved.push({key,value})})},
    boundedFetch:async request=>{requests++;if(offline)throw Error('offline');return fetch(request,{signal:AbortSignal.timeout(500)})}
  };
  vm.runInNewContext(network+route+listener,env);
  if(response)env.responseFor=async()=>response.clone();
  return{saved,get requests(){return requests},async request(path,{navigate=true}={}){
    const request=new Request(origin+path,{redirect:navigate?'manual':'follow'});
    if(navigate)Object.defineProperty(request,'mode',{value:'navigate'});
    let result;for(const [name,fn]of events)if(name==='fetch')fn({request,stopImmediatePropagation(){},waitUntil:p=>p.catch(()=>{}),respondWith:value=>{result=value}});
    return await result;
  }};
}

// Fetch Standard HTTP-fetch step 3.3.5 rejects a service-worker response whose
// URL list has multiple items when the incoming request redirect mode is not
// follow. A clone retains that list; a new streamed Response does not.
test('HTML redirects from the current origin remain usable for manual-mode navigation',async()=>{
  const h=harness(),response=await h.request('/app/persistent-system-shell-v1.html?system=cerbanimo');
  assert.equal(response.status,200);
  assert.equal(response.redirected,false,'redirect history must not make respondWith return a browser network error');
  assert.equal(response.headers.get('content-security-policy'),"default-src 'self'");
  assert.equal(response.headers.get('x-current-origin'),'yes');
  assert.equal(response.headers.get('content-encoding'),null,'streamed fetch body is already decoded');
  assert.equal(response.headers.get('content-length'),null,'compressed transfer length must not describe the decoded body');
  assert.match(await response.text(),/Current origin shell/);
  assert.equal(h.requests,1);assert.equal(h.saved.length,1);
});

test('an older cached redirected shell is navigation-safe offline',async()=>{
  const cached=await fetch(origin+'/app/working-campus-v440.html');assert.equal(cached.redirected,true,'use genuine HTTP redirect metadata');
  const h=harness({cached,offline:true}),response=await h.request('/app/working-campus-v440.html');
  assert.equal(response.status,200);assert.equal(response.redirected,false,'older caches must not replay redirect history into navigation');
  assert.match(await response.text(),/Current origin shell/);
});

test('ordinary resource fetches retain their valid redirect behavior',async()=>{
  const h=harness(),response=await h.request('/app/working-campus-v440.html',{navigate:false});
  assert.equal(response.status,200);assert.equal(response.redirected,true);assert.match(await response.text(),/Current origin shell/);
});

test('a complete signed Guild release stays exclusive before origin navigation',async()=>{
  const h=harness({signed:true}),response=await h.request('/app/working-campus-v440.html');
  assert.equal(response.headers.get('x-civweave-guild-release'),'signed-test');assert.equal(await response.text(),'SIGNED RELEASE');assert.equal(h.requests,0);
});

test('explicit navigation redirects remain redirects rather than substituted HTML',async()=>{
  const h=harness({response:Response.redirect(origin+'/app/persistent-system-shell-v1?system=civweave',302)}),response=await h.request('/app/working-campus-v440.html');
  assert.equal(response.status,302);assert.equal(response.headers.get('location'),origin+'/app/persistent-system-shell-v1?system=civweave');assert.equal(h.requests,0);
});
