'use strict';
(()=>{
const REVISION='release-generation-boundary-v5-compatible-guild-cutover-20260923';
const CACHE='cw-live-runtime-release-generation-v5-20260923';
const CACHE_PREFIX='cw-live-runtime-release-generation-';
const GUILD_CACHE_PREFIX='cw-guild-release-v1-';
const DB_NAME='civweave-decentralized-release-v1';
const DB_VERSION=1;
const STORE='state';
const TEXT_ASSET=/\.(?:html?|css|m?js|json|webmanifest|txt|md)$/i;
const OWNED_PREFIXES=Object.freeze(['/app/','/extensions/','/finder/']);
const NETWORK_TIMEOUT_MS=3200;
const WARM_TIMEOUT_MS=2500;
const WARM_CONCURRENCY=6;
const GUILD_CHECK_INTERVAL_MS=10*60*1000;
const TRUST_BUNDLE_SCHEMA='civweave.release-trust-bundle.v1';
const DELEGATION_SCHEMA='civweave.release-key-delegation.v1';
const REVOCATION_SCHEMA='civweave.release-key-revocation.v1';
const RELEASE_SCHEMA='civweave.guild-release-manifest.v1';
const encoder=new TextEncoder();
const WARM_PATHS=Object.freeze([
  '/index.html',
  '/app/',
  '/app/pwa-start-v436.html',
  '/app/persistent-system-shell-v1.html',
  '/app/persistent-system-shell-v1.js',
  '/app/system-routes-v227.js',
  '/app/themed-system-nav-v178.js',
  '/app/five-system-direct-navigation-v1.js',
  '/app/persistent-system-context-v1.js',
  '/app/persistent-shell-actions-v1.js',
  '/app/generation-lifecycle-v2.js',
  '/app/subsystem-avatar-state-v347.js',
  '/app/settings-local-route-v331.js',
  '/app/settings-local-loader-v337.js',
  '/app/settings-local-route-v325.js',
  '/app/settings-gateway-v317.js',
  '/app/shared-guide-surface-v236.js',
  '/app/guide-chat-surface-v350.js',
  '/app/local-ai/gemma4-current-registry-authority-v1.js',
  '/app/local-ai/gemma4-structured-quest-completion-v1.js',
  '/app/local-ai/gemma4-litert-request-authority-v1.js',
  '/app/local-ai/gemma4-structured-quest-compact-envelope-v1.js',
  '/app/local-ai/gemma4-structured-task-authority-v1.js',
  '/app/local-ai/gemma4-weave-draft-pipeline-v1.js',
  '/app/local-ai/gemma4-first-request-intake-bridge-v1.js',
  '/app/local-ai/gemma4-route-integrity-v1.js',
  '/app/local-ai/gemma4-learning-plan-entry-authority-v1.js',
  '/app/generation-failure-inspector-v1.js',
  '/app/human-message-bubble-v1.js',
  '/app/human-chat-network-v1.js',
  '/app/human-chat-guild-context-v1.js',
  '/app/platform-experience-v160.css',
  '/app/working-campus-v440.html',
  '/app/realm-console-v140.html',
  '/app/realm-console-v140.css',
  '/app/cerbanimo-quest-engine-v144.css',
  '/app/shared/civweave-parity-runtime.js',
  '/app/realm-console-v140.js',
  '/app/cerbanimo-quest-engine-v144.js',
  '/app/cerbanimo-quest-path-v266.js',
  '/app/cerbanimo-proof-attachments-v165.js',
  '/app/cerbanimo-video-task-contract-v1.mjs',
  '/app/cw-reward-ledger-v2.js',
  '/app/civweave-basic-value-v1.js',
  '/app/cw-reward-receivers-v2.js',
  '/app/civweave-basic-value-model-v1.js',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html',
  '/app/cabinets/living-school/index.html',
  '/finder/index.html',
  '/app/hub-map-v1.html',
  '/app/federation-finder-map-v275.html',
  '/app/civweave-hub-map-v1.js',
  '/app/civweave-guild-map-runtime-v2.js',
  '/app/civweave-map-service-v275.js',
  '/app/civweave-map-bootstrap-v1.js',
  '/app/civweave-map-mesh-v276.js',
  '/app/civweave-map-mesh-bridge-v276.js',
  '/app/civweave-map-coverage-v277.js',
  '/app/civweave-map-storage-v1.js',
  '/app/civweave-map-offline-v1.js',
  '/app/civweave-map-ui-v1.js'
]);
const normalized=value=>{
  if(Array.isArray(value))return value.map(normalized);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort())if(value[key]!==undefined)out[key]=normalized(value[key]);
    return out;
  }
  return value;
};
const canonical=value=>JSON.stringify(normalized(value));
const b64url=bytes=>{
  let binary='';
  for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const unb64=value=>{
  const raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  const padded=raw+'='.repeat((4-raw.length%4)%4);
  const binary=atob(padded);
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
};
const sha256=async value=>b64url(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value));
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Release trust database unavailable.'));
  });
}
async function dbGet(key){
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  finally{db.close()}
}
async function dbPut(key,value){
  const db=await openDb();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
  finally{db.close()}
  return value;
}
async function dbDelete(key){
  const db=await openDb();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
  finally{db.close()}
}
async function allAnchors(){return Array.isArray(await dbGet('anchors'))?await dbGet('anchors'):[]}
async function keyIdFor(jwk){return`p256:${(await sha256(canonical(jwk))).slice(0,32)}`}
async function importVerifyKey(jwk){return crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify'])}
async function verifySigned(record,jwk){
  if(!record?.signature)return false;
  const body={...record};delete body.signature;
  try{
    const key=await importVerifyKey(jwk);
    return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unb64(record.signature),encoder.encode(canonical(body)));
  }catch{return false}
}
function capabilities(value){return [...new Set((Array.isArray(value)?value:[]).map(v=>clean(v,40)).filter(v=>['release','delegate','revoke'].includes(v)))]}
function dateActive(record){
  const now=Date.now(),notBefore=Date.parse(record?.notBefore||''),expires=Date.parse(record?.expiresAt||'');
  return(!Number.isFinite(notBefore)||notBefore<=now)&&(!Number.isFinite(expires)||expires>now);
}
async function normalizeAnchor(anchor){
  const publicKey=anchor?.publicKey;
  if(!publicKey||publicKey.kty!=='EC'||publicKey.crv!=='P-256')throw new Error('Release trust anchor must be an ECDSA P-256 public JWK.');
  await importVerifyKey(publicKey);
  const keyId=await keyIdFor(publicKey);
  if(anchor?.keyId&&anchor.keyId!==keyId)throw new Error('Release trust anchor key id does not match its public key.');
  const caps=capabilities(anchor?.capabilities);
  if(!caps.length)throw new Error('Release trust anchor needs at least one release trust capability.');
  return Object.freeze({schema:'civweave.local-release-trust-anchor.v1',keyId,publicKey,capabilities:caps,label:clean(anchor?.label||keyId,160),trustedAt:new Date().toISOString(),source:'explicit-local-import'});
}
async function addAnchor(anchor){
  const next=await normalizeAnchor(anchor),rows=await allAnchors();
  const filtered=rows.filter(row=>row?.keyId!==next.keyId);
  filtered.push(next);
  await dbPut('anchors',filtered);
  return next;
}
async function removeAnchor(keyId){
  const rows=await allAnchors(),next=rows.filter(row=>row?.keyId!==keyId);
  await dbPut('anchors',next);
  return rows.length-next.length;
}
function safeGuildOrigin(value){
  const url=new URL(String(value||''));
  if(url.protocol!=='https:')throw new Error('Guild release origin must use HTTPS.');
  return url.origin;
}
async function setGuildConfig(input={}){
  const config=Object.freeze({schema:'civweave.guild-release-source.v1',origin:safeGuildOrigin(input.origin),nodeId:clean(input.nodeId,180),selectedAt:clean(input.selectedAt,80)||new Date().toISOString()});
  await dbPut('guild',config);
  return config;
}
async function guildConfig(){return await dbGet('guild')||null}
const guildCompatibility=new Map();
async function activeGuildRelease(){
  const active=await dbGet('activeRelease');
  if(!active?.cacheName)return null;
  if(guildCompatibility.has(active.cacheName))return guildCompatibility.get(active.cacheName)?active:null;
  let complete=true;
  try{
    const cache=await caches.open(active.cacheName);
    for(const pathname of WARM_PATHS){
      const response=await cache.match(cacheKey(pathname),{ignoreSearch:true});
      if(!valid(response,pathname)){complete=false;break}
    }
  }catch{complete=false}
  guildCompatibility.set(active.cacheName,complete);
  if(!complete){
    await dbDelete('activeRelease').catch(()=>{});
    try{await notifyClients({type:'CIVWEAVE_GUILD_RELEASE_INCOMPATIBLE',releaseId:active.releaseId||'',cacheName:active.cacheName,requiredGeneration:REVISION})}catch{}
    return null;
  }
  return active;
}
async function remoteTrustBundle(guild){
  const response=await boundedFetch(new Request(`${guild.origin}/api/civweave-trust/bundle`,{cache:'no-store'}),NETWORK_TIMEOUT_MS);
  if(response.status===404)return{schema:TRUST_BUNDLE_SCHEMA,delegations:[],revocations:[]};
  if(!response.ok)throw new Error(`Guild trust relay returned ${response.status}.`);
  const bundle=await response.json();
  if(bundle?.schema!==TRUST_BUNDLE_SCHEMA)throw new Error('Guild trust relay returned an unsupported trust bundle.');
  const safe={schema:TRUST_BUNDLE_SCHEMA,delegations:Array.isArray(bundle.delegations)?bundle.delegations:[],revocations:Array.isArray(bundle.revocations)?bundle.revocations:[]};
  await dbPut('relayedTrustBundle',safe);
  return safe;
}
async function buildTrust(bundle={}){
  const anchors=await allAnchors();
  const revoked=new Set();
  async function expand(blocked=new Set()){
    const trusted=new Map();
    for(const anchor of anchors)if(!blocked.has(anchor.keyId))trusted.set(anchor.keyId,{...anchor,capabilities:capabilities(anchor.capabilities),source:'local-anchor'});
    const rows=Array.isArray(bundle.delegations)?bundle.delegations:[];
    for(let pass=0;pass<8;pass++){
      let changed=false;
      for(const row of rows){
        if(row?.schema!==DELEGATION_SCHEMA||blocked.has(row.subjectKeyId)||blocked.has(row.issuerKeyId)||trusted.has(row.subjectKeyId)||!dateActive(row))continue;
        const issuer=trusted.get(row.issuerKeyId);
        if(!issuer||!issuer.capabilities.includes('delegate'))continue;
        const publicKey=row.subjectPublicKey;
        if(!publicKey)continue;
        if(await keyIdFor(publicKey)!==row.subjectKeyId)continue;
        const requested=capabilities(row.capabilities);
        if(!requested.length||requested.some(cap=>!issuer.capabilities.includes(cap)))continue;
        if(!await verifySigned(row,issuer.publicKey))continue;
        trusted.set(row.subjectKeyId,{keyId:row.subjectKeyId,publicKey,capabilities:requested,source:'delegation',issuerKeyId:row.issuerKeyId});
        changed=true;
      }
      if(!changed)break;
    }
    return trusted;
  }
  const initial=await expand();
  for(const row of Array.isArray(bundle.revocations)?bundle.revocations:[]){
    if(row?.schema!==REVOCATION_SCHEMA||!row.revokedKeyId||!dateActive(row))continue;
    const issuer=initial.get(row.issuerKeyId);
    if(!issuer||!issuer.capabilities.includes('revoke'))continue;
    if(await verifySigned(row,issuer.publicKey))revoked.add(row.revokedKeyId);
  }
  return{trusted:await expand(revoked),revoked};
}
function ownedRuntimePath(pathname){
  if(pathname==='/'||pathname==='/index.html'||pathname==='/offline.html')return true;
  return OWNED_PREFIXES.some(prefix=>pathname.startsWith(prefix))&&TEXT_ASSET.test(pathname);
}
function releaseAssetPath(value){
  const pathname=new URL(String(value||''),self.location.origin).pathname;
  if(!ownedRuntimePath(pathname))throw new Error(`Release asset is outside the Civweave runtime boundary: ${pathname}`);
  return pathname;
}
async function verifyManifest(manifest,bundle){
  if(manifest?.schema!==RELEASE_SCHEMA)throw new Error('Guild release manifest schema is unsupported.');
  const releaseId=clean(manifest.releaseId,180);
  if(!releaseId||!manifest.signerKeyId||!Array.isArray(manifest.assets)||!manifest.assets.length)throw new Error('Guild release manifest is incomplete.');
  if(!dateActive(manifest))throw new Error('Guild release manifest is outside its validity window.');
  const {trusted,revoked}=await buildTrust(bundle);
  if(revoked.has(manifest.signerKeyId))throw new Error('Guild release signer has been revoked.');
  const signer=trusted.get(manifest.signerKeyId);
  if(!signer||!signer.capabilities.includes('release'))throw new Error('Guild release signer is not trusted by this device.');
  if(!await verifySigned(manifest,signer.publicKey))throw new Error('Guild release signature was rejected.');
  const seen=new Set();
  for(const asset of manifest.assets){
    const path=releaseAssetPath(asset?.path);
    if(seen.has(path))throw new Error(`Guild release repeats asset ${path}.`);
    seen.add(path);
    if(!/^[A-Za-z0-9_-]{40,100}$/.test(clean(asset?.sha256,120)))throw new Error(`Guild release asset hash is invalid for ${path}.`);
  }
  for(const required of WARM_PATHS)if(!seen.has(required))throw new Error(`Guild release is missing required shell asset ${required}.`);
  return{releaseId,signer,manifest};
}
function cacheKey(pathname){return new Request(new URL(pathname,self.location.origin).href,{method:'GET'})}
function valid(response,pathname){
  if(!response?.ok)return false;
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(/\.html?$/i.test(pathname))return type.includes('text/html')||!type;
  if(/\.(?:m?js)$/i.test(pathname))return !type.includes('text/html');
  if(/\.css$/i.test(pathname))return !type.includes('text/html');
  return true;
}
function head(response){return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers})}
async function boundedFetch(request,timeout=NETWORK_TIMEOUT_MS){
  const controller=typeof AbortController==='function'?new AbortController():null;
  let timer=0;
  try{
    if(controller)timer=setTimeout(()=>controller.abort(),timeout);
    return await fetch(new Request(request,{cache:'no-store',...(controller?{signal:controller.signal}:{})}));
  }finally{if(timer)clearTimeout(timer)}
}
async function installGuildRelease(guild,manifest){
  const cacheName=`${GUILD_CACHE_PREFIX}${(await sha256(manifest.releaseId)).slice(0,24)}`;
  const cache=await caches.open(cacheName);
  await caches.delete(`${cacheName}-staging`).catch(()=>false);
  const stagingName=`${cacheName}-staging`,staging=await caches.open(stagingName);
  try{
    for(const asset of manifest.assets){
      const pathname=releaseAssetPath(asset.path);
      const url=new URL('/api/civweave-release/asset',guild.origin);
      url.searchParams.set('releaseId',manifest.releaseId);
      url.searchParams.set('path',pathname);
      const response=await boundedFetch(new Request(url.href,{cache:'no-store'}),Math.max(NETWORK_TIMEOUT_MS,10000));
      if(!response.ok)throw new Error(`Guild release asset ${pathname} returned ${response.status}.`);
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(await sha256(bytes)!==asset.sha256)throw new Error(`Guild release asset hash mismatch for ${pathname}.`);
      const headers=new Headers(response.headers);
      headers.set('x-civweave-guild-release',manifest.releaseId);
      await staging.put(cacheKey(pathname),new Response(bytes,{status:200,headers}));
    }
    for(const asset of manifest.assets){
      const pathname=releaseAssetPath(asset.path),response=await staging.match(cacheKey(pathname),{ignoreSearch:true});
      if(!response)throw new Error(`Guild release staging cache lost ${pathname}.`);
      await cache.put(cacheKey(pathname),response.clone());
    }
    await dbPut('activeRelease',{schema:'civweave.active-guild-release.v1',releaseId:manifest.releaseId,cacheName,signerKeyId:manifest.signerKeyId,activatedAt:new Date().toISOString(),guildOrigin:guild.origin});
    guildCompatibility.set(cacheName,true);
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith(GUILD_CACHE_PREFIX)&&name!==cacheName&&name!==stagingName).map(name=>caches.delete(name)));
    return{releaseId:manifest.releaseId,cacheName};
  }finally{await caches.delete(stagingName).catch(()=>false)}
}
async function checkGuildRelease({force=false}={}){
  const guild=await guildConfig();
  if(!guild)return{ok:false,reason:'no-guild-selected'};
  const priorCheck=await dbGet('lastGuildCheck');
  if(!force&&priorCheck&&Date.now()-Number(priorCheck)<GUILD_CHECK_INTERVAL_MS)return{ok:true,reason:'check-throttled'};
  await dbPut('lastGuildCheck',Date.now());
  const [bundle,response]=await Promise.all([
    remoteTrustBundle(guild).catch(async error=>{const saved=await dbGet('relayedTrustBundle');if(saved)return saved;throw error}),
    boundedFetch(new Request(`${guild.origin}/api/civweave-release/current`,{cache:'no-store'}),NETWORK_TIMEOUT_MS)
  ]);
  if(response.status===404)return{ok:false,reason:'guild-has-no-release'};
  if(!response.ok)throw new Error(`Guild release relay returned ${response.status}.`);
  const manifest=await response.json();
  await verifyManifest(manifest,bundle);
  const active=await dbGet('activeRelease');
  if(active?.releaseId===manifest.releaseId&&active?.guildOrigin===guild.origin)return{ok:true,reason:'already-current',releaseId:manifest.releaseId};
  const installed=await installGuildRelease(guild,manifest);
  await notifyClients({type:'CIVWEAVE_GUILD_RELEASE_READY',...installed,guildOrigin:guild.origin});
  return{ok:true,reason:'installed',...installed};
}
async function notifyClients(message){
  try{for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))client.postMessage(message)}catch{}
}
async function activeGuildResponse(pathname,method,active){
  if(!active?.cacheName)return null;
  const response=await(await caches.open(active.cacheName)).match(cacheKey(pathname),{ignoreSearch:true});
  if(valid(response,pathname))return method==='HEAD'?head(response):response;
  return new Response('The active signed Guild release is incomplete for this runtime generation.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-release-generation':REVISION,'x-civweave-guild-release':String(active.releaseId||'')}});
}
async function network(request,pathname){
  try{
    const response=await boundedFetch(request,NETWORK_TIMEOUT_MS);
    if(!valid(response,pathname))return null;
    if(request.method==='GET')await(await caches.open(CACHE)).put(cacheKey(pathname),response.clone());
    return request.method==='HEAD'?head(response):response;
  }catch{return null}
}
async function freshCached(pathname,method){
  const response=await(await caches.open(CACHE)).match(cacheKey(pathname),{ignoreSearch:true});
  if(!valid(response,pathname))return null;
  return method==='HEAD'?head(response):response;
}
async function legacyFallback(pathname,method){
  const response=await caches.match(cacheKey(pathname),{ignoreSearch:true});
  if(!valid(response,pathname))return null;
  return method==='HEAD'?head(response):response;
}
async function responseFor(request,pathname){
  const guild=await guildConfig();
  if(guild){
    const active=await activeGuildRelease();
    if(active)return activeGuildResponse(pathname,request.method,active);
  }
  // A selected Guild does not become exclusive application transport until a complete signed release is installed.
  // This keeps legacy/partially-upgraded Guilds from pinning clients to incomplete shell generations.
  const live=await network(request,pathname);
  if(live)return live;
  const fresh=await freshCached(pathname,request.method);
  if(fresh)return fresh;
  const legacy=await legacyFallback(pathname,request.method);
  if(legacy)return legacy;
  return new Response(guild?'The selected Guild does not yet have a compatible signed Civweave release, and the current installed release is unavailable.':'Civweave runtime asset is unavailable offline on this device.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-release-generation':REVISION}});
}
async function warmOne(cache,pathname){
  try{
    const request=new Request(new URL(pathname,self.location.origin).href,{cache:'no-store'});
    const response=await boundedFetch(request,WARM_TIMEOUT_MS);
    if(!valid(response,pathname))return null;
    await cache.put(cacheKey(pathname),response.clone());
    return pathname;
  }catch{return null}
}
async function warm(){
  if(await guildConfig()){
    await checkGuildRelease({force:true}).catch(()=>null);
    return[];
  }
  const cache=await caches.open(CACHE),queue=[...WARM_PATHS],warmed=[];
  async function worker(){
    while(queue.length){
      const pathname=queue.shift();if(!pathname)continue;
      const result=await warmOne(cache,pathname);if(result)warmed.push(result);
    }
  }
  const count=Math.max(1,Math.min(WARM_CONCURRENCY,queue.length));
  await Promise.all(Array.from({length:count},()=>worker()));
  return warmed;
}
async function purgeStaleRuntimeEntries(){
  const names=await caches.keys();
  const active=await dbGet('activeRelease');
  for(const name of names){
    if(name===CACHE||name===active?.cacheName)continue;
    if(name.startsWith(CACHE_PREFIX)){await caches.delete(name);continue;}
    if(name.startsWith(GUILD_CACHE_PREFIX)){await caches.delete(name);continue;}
    const cache=await caches.open(name);
    const requests=await cache.keys();
    await Promise.all(requests.map(async request=>{
      let url;try{url=new URL(request.url)}catch{return}
      if(url.origin!==self.location.origin||!ownedRuntimePath(url.pathname))return;
      await cache.delete(request,{ignoreSearch:true});
    }));
  }
}
async function activationRepair(){
  await purgeStaleRuntimeEntries();
  if(await guildConfig())await checkGuildRelease({force:true}).catch(()=>null);
  await new Promise(resolve=>setTimeout(resolve,750));
  await purgeStaleRuntimeEntries();
  await self.clients.claim();
}
self.addEventListener('install',event=>event.waitUntil((async()=>{await warm().catch(()=>[]);await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil(activationRepair()));
self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='CIVWEAVE_GUILD_RELEASE_CONFIG')event.waitUntil((async()=>{const config=await setGuildConfig(data.selection||data);await checkGuildRelease({force:true}).catch(error=>notifyClients({type:'CIVWEAVE_GUILD_RELEASE_ERROR',error:String(error?.message||error)}));return config})());
  if(data.type==='CIVWEAVE_GUILD_RELEASE_CLEAR')event.waitUntil((async()=>{await dbDelete('guild').catch(()=>{});await dbDelete('activeRelease').catch(()=>{});guildCompatibility.clear();await notifyClients({type:'CIVWEAVE_GUILD_RELEASE_STATUS',result:{ok:true,reason:'release-source-cleared'}})})());
  if(data.type==='CIVWEAVE_RELEASE_TRUST_ANCHOR'&&data.explicit===true)event.waitUntil((async()=>{const anchor=await addAnchor(data.anchor||{});await notifyClients({type:'CIVWEAVE_RELEASE_TRUST_CHANGED',action:'added',keyId:anchor.keyId});await checkGuildRelease({force:true}).catch(()=>null)})());
  if(data.type==='CIVWEAVE_RELEASE_TRUST_REMOVE'&&data.explicit===true)event.waitUntil((async()=>{const removed=await removeAnchor(clean(data.keyId,180));await notifyClients({type:'CIVWEAVE_RELEASE_TRUST_CHANGED',action:'removed',keyId:clean(data.keyId,180),removed})})());
  if(data.type==='CIVWEAVE_GUILD_RELEASE_CHECK')event.waitUntil(checkGuildRelease({force:true}).then(result=>notifyClients({type:'CIVWEAVE_GUILD_RELEASE_STATUS',result})).catch(error=>notifyClients({type:'CIVWEAVE_GUILD_RELEASE_ERROR',error:String(error?.message||error)})));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!['GET','HEAD'].includes(request.method))return;
  let url;try{url=new URL(request.url)}catch{return}
  if(url.origin!==self.location.origin)return;
  const pathname=url.pathname;
  if(request.mode!=='navigate'&&!ownedRuntimePath(pathname))return;
  if(request.mode==='navigate'&&!(pathname==='/'||pathname==='/index.html'||OWNED_PREFIXES.some(prefix=>pathname.startsWith(prefix))))return;
  event.stopImmediatePropagation();
  if(request.mode==='navigate')event.waitUntil(checkGuildRelease().catch(()=>null));
  event.respondWith(responseFor(request,pathname));
});
self.CivweaveReleaseGenerationV1=Object.freeze({revision:REVISION,cache:CACHE,warmPaths:[...WARM_PATHS],networkTimeoutMs:NETWORK_TIMEOUT_MS,warmTimeoutMs:WARM_TIMEOUT_MS,warmConcurrency:WARM_CONCURRENCY,policy:'complete-signed-guild-release-is-exclusive-transport-legacy-or-incomplete-guilds-remain-on-current-origin-release-until-compatible-cutover'});
})();
