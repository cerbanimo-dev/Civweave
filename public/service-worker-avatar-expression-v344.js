'use strict';
(()=>{
  const VERSION='avatar-expression-offline-v344-rle-rowfix1';
  const CACHE=`civweave-avatar-expression-${VERSION}`;
  const PREFIX='civweave-avatar-expression-';
  const RLE='/app/assets/ai/chat/expressions/rle-v315/';
  const ROW_RE=/\/app\/assets\/ai\/chat\/expressions\/rle-v315\/[a-z-]+-row-[0-3]\.json$/i;
  const ASSETS=[
    '/app/avatar-expression-director-v343.js',
    '/app/avatar-rle-row-normalizer-v344.js',
    '/app/shared-chat-face-icons-v255.js',
    '/app/avatar-expression-qa-v344.html',
    '/app/local-ai/worker-v266.js',
    '/app/vendor/transformers/transformers.min.js',
    '/app/vendor/transformers/stage-manifest.json',
    '/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.mjs',
    '/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm',
    `${RLE}manifest.json`,
    ...['weaveling','moss','kamiya','rook','merlin'].flatMap(name=>[0,1,2,3].map(row=>`${RLE}${name}-row-${row}.json`))
  ];
  const KEYS=new Set(ASSETS);
  const key=pathname=>new Request(new URL(pathname,self.location.origin).href,{method:'GET'});
  const valid=(response,pathname)=>Boolean(response?.ok&&!(/text\/html/i.test(String(response.headers.get('content-type')||''))&&!/\.html$/i.test(pathname)));
  async function normalize(pathname,response){
    if(!ROW_RE.test(pathname)||!response?.ok)return response;
    const payload=await response.clone().json().catch(()=>null);
    if(!payload||payload.coordinateSpace==='atlas-global-v344'||!Number.isInteger(payload.row)||!Array.isArray(payload.runs))return response;
    const runs=payload.runs.slice(),dy=payload.row*27;for(let i=0;i+3<runs.length;i+=4)runs[i+2]+=dy;
    const headers=new Headers(response.headers);headers.set('content-type','application/json; charset=utf-8');headers.set('x-civweave-avatar-rle','atlas-global-v344');headers.delete('content-length');
    return new Response(JSON.stringify({...payload,runs,coordinateSpace:'atlas-global-v344'}),{status:response.status,statusText:response.statusText,headers});
  }
  async function fresh(pathname){const raw=await fetch(new Request(new URL(pathname,self.location.origin).href,{cache:'no-store',credentials:'same-origin',headers:{'x-civweave-package':'avatar-expression-v344'}}));if(!valid(raw,pathname))throw new Error(`${pathname} unavailable`);return normalize(pathname,raw)}
  async function install(){const cache=await caches.open(CACHE),results=await Promise.allSettled(ASSETS.map(async pathname=>{const response=await fresh(pathname);await cache.put(key(pathname),response.clone());return pathname}));return{loaded:results.filter(r=>r.status==='fulfilled').length,total:ASSETS.length,failed:results.flatMap((r,i)=>r.status==='rejected'?[ASSETS[i]]:[])}}
  async function cleanup(){const names=await caches.keys();await Promise.all(names.map(name=>name.startsWith(PREFIX)&&name!==CACHE?caches.delete(name):false))}
  self.addEventListener('install',event=>event.waitUntil(install().catch(()=>({loaded:0,total:ASSETS.length}))));
  self.addEventListener('activate',event=>event.waitUntil(cleanup()));
  self.addEventListener('fetch',event=>{
    const request=event.request,url=new URL(request.url);if(!['GET','HEAD'].includes(request.method)||url.origin!==self.location.origin||!KEYS.has(url.pathname))return;
    event.stopImmediatePropagation();
    event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(key(url.pathname),{ignoreSearch:true});const code=/\.(?:m?js|html)$/i.test(url.pathname);if(code){try{const response=await fresh(url.pathname);if(request.method==='GET')await cache.put(key(url.pathname),response.clone());return request.method==='HEAD'?new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers}):response}catch{}}
      if(valid(cached,url.pathname))return request.method==='HEAD'?new Response(null,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):cached;
      try{const response=await fresh(url.pathname);if(request.method==='GET')await cache.put(key(url.pathname),response.clone());return request.method==='HEAD'?new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers}):response}catch{return new Response(`Avatar expression asset unavailable offline: ${url.pathname}`,{status:503,headers:{'content-type':'text/plain; charset=utf-8'}})}})());
  });
  self.CivweaveAvatarExpressionOfflineV344=Object.freeze({version:VERSION,cache:CACHE,assets:ASSETS.slice(),modelCache:'civweave-model-generative-v266',policy:'code-network-first-assets-cache-first-rle-normalized',rleCoordinateSpace:'atlas-global-v344',alreadyDownloadedTinyLMSurvivesOffline:true});
})();
