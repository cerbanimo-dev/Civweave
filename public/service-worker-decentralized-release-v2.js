'use strict';
(()=>{
const REVISION='decentralized-guild-release-v2-20260917';
const LEGACY_CACHE='cw-live-runtime-release-generation-v3-20260917';
const GUILD_CACHE_PREFIX='cw-guild-release-v1-';
const DB='civweave-decentralized-release-v1';
const STORE='state';
const TRUST_SCHEMA='civweave.release-trust-bundle.v1';
const DELEGATION_SCHEMA='civweave.release-key-delegation.v1';
const REVOCATION_SCHEMA='civweave.release-key-revocation.v1';
const RELEASE_SCHEMA='civweave.guild-release-manifest.v1';
const PREFIXES=Object.freeze(['/app/','/extensions/','/finder/']);
const TEXT=/\.(?:html?|css|m?js|json|webmanifest|txt|md)$/i;
const TIMEOUT=4000;
const CHECK_MS=10*60*1000;
const enc=new TextEncoder();
const REQUIRED=Object.freeze([
'/index.html','/app/','/app/pwa-start-v436.html','/app/persistent-system-shell-v1.html','/app/persistent-system-shell-v1.js','/app/system-routes-v227.js','/app/themed-system-nav-v178.js','/app/five-system-direct-navigation-v1.js','/app/persistent-system-context-v1.js','/app/persistent-shell-actions-v1.js','/app/subsystem-avatar-state-v347.js','/app/platform-experience-v160.css','/app/working-campus-v440.html','/app/realm-console-v140.html','/app/realm-console-v140.css','/app/cerbanimo-quest-engine-v144.css','/app/shared/civweave-parity-runtime.js','/app/realm-console-v140.js','/app/cerbanimo-quest-engine-v144.js','/app/cerbanimo-quest-path-v266.js','/app/cerbanimo-proof-attachments-v165.js','/app/cerbanimo-video-task-contract-v1.mjs','/app/cw-reward-ledger-v2.js','/app/civweave-basic-value-v1.js','/app/cw-reward-receivers-v2.js','/app/civweave-basic-value-model-v1.js','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html','/app/cabinets/living-school/index.html','/finder/index.html','/app/hub-map-v1.html','/app/federation-finder-map-v275.html','/app/civweave-hub-map-v1.js','/app/civweave-guild-map-runtime-v2.js','/app/civweave-map-service-v275.js','/app/civweave-map-bootstrap-v1.js','/app/civweave-map-mesh-v276.js','/app/civweave-map-mesh-bridge-v276.js','/app/civweave-map-coverage-v277.js','/app/civweave-map-storage-v1.js','/app/civweave-map-offline-v1.js','/app/civweave-map-ui-v1.js'
]);
const clean=(v,n=4000)=>String(v??'').trim().slice(0,n);
const norm=v=>Array.isArray(v)?v.map(norm):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,norm(v[k])])):v;
const canonical=v=>JSON.stringify(norm(v));
const b64=bytes=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64=v=>{const raw=String(v||'').replace(/-/g,'+').replace(/_/g,'/'),s=atob(raw+'='.repeat((4-raw.length%4)%4));return Uint8Array.from(s,c=>c.charCodeAt(0))};
const digest=async v=>b64(await crypto.subtle.digest('SHA-256',typeof v==='string'?enc.encode(v):v));
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function get(key){const d=await db();try{return await new Promise((res,rej)=>{const r=d.transaction(STORE).objectStore(STORE).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}finally{d.close()}}
async function put(key,value){const d=await db();try{await new Promise((res,rej)=>{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).put(value,key);t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}finally{d.close()}return value}
const caps=v=>[...new Set((Array.isArray(v)?v:[]).map(x=>clean(x,30)).filter(x=>['release','delegate','revoke'].includes(x)))];
const active=r=>{const now=Date.now(),start=Date.parse(r?.notBefore||''),end=Date.parse(r?.expiresAt||'');return(!Number.isFinite(start)||start<=now)&&(!Number.isFinite(end)||end>now)};
async function keyId(jwk){return`p256:${(await digest(canonical(jwk))).slice(0,32)}`}
async function verify(record,jwk){if(!record?.signature)return false;const body={...record};delete body.signature;try{const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unb64(record.signature),enc.encode(canonical(body)))}catch{return false}}
async function anchors(){const rows=await get('anchors');return Array.isArray(rows)?rows:[]}
async function addAnchor(input){const jwk=input?.publicKey;if(!jwk||jwk.kty!=='EC'||jwk.crv!=='P-256')throw new Error('Release trust anchor must be a P-256 public JWK.');await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);const id=await keyId(jwk),permissions=caps(input.capabilities);if(input.keyId&&input.keyId!==id)throw new Error('Release trust anchor key id mismatch.');if(!permissions.length)throw new Error('Release trust anchor has no capabilities.');const row={schema:'civweave.local-release-trust-anchor.v1',keyId:id,publicKey:jwk,capabilities:permissions,label:clean(input.label||id,160),trustedAt:new Date().toISOString(),source:'explicit-local-import'};const rows=(await anchors()).filter(x=>x.keyId!==id);rows.push(row);await put('anchors',rows);return row}
async function removeAnchor(id){const rows=await anchors(),next=rows.filter(x=>x.keyId!==id);await put('anchors',next);return rows.length-next.length}
async function trust(bundle={}){
  const base=await anchors(),revoked=new Set();
  async function expand(blocked=new Set()){
    const map=new Map(base.filter(a=>!blocked.has(a.keyId)).map(a=>[a.keyId,{...a,capabilities:caps(a.capabilities)}]));
    for(let pass=0;pass<8;pass++){
      let changed=false;
      for(const d of Array.isArray(bundle.delegations)?bundle.delegations:[]){
        if(d?.schema!==DELEGATION_SCHEMA||!active(d)||blocked.has(d.issuerKeyId)||blocked.has(d.subjectKeyId)||map.has(d.subjectKeyId))continue;
        const issuer=map.get(d.issuerKeyId),permissions=caps(d.capabilities);
        if(!issuer?.capabilities.includes('delegate')||!permissions.length||permissions.some(c=>!issuer.capabilities.includes(c)))continue;
        if(await keyId(d.subjectPublicKey)!==d.subjectKeyId||!await verify(d,issuer.publicKey))continue;
        map.set(d.subjectKeyId,{keyId:d.subjectKeyId,publicKey:d.subjectPublicKey,capabilities:permissions,issuerKeyId:d.issuerKeyId});changed=true;
      }
      if(!changed)break;
    }
    return map;
  }
  const first=await expand();
  for(const r of Array.isArray(bundle.revocations)?bundle.revocations:[]){const issuer=first.get(r?.issuerKeyId);if(r?.schema===REVOCATION_SCHEMA&&active(r)&&issuer?.capabilities.includes('revoke')&&await verify(r,issuer.publicKey))revoked.add(r.revokedKeyId)}
  return{map:await expand(revoked),revoked};
}
function owned(path){if(path==='/'||path==='/index.html'||path==='/offline.html'||PREFIXES.includes(path))return true;return PREFIXES.some(p=>path.startsWith(p))&&TEXT.test(path)}
function assetPath(v){const path=new URL(String(v||''),self.location.origin).pathname;if(!owned(path))throw new Error(`Release asset outside runtime boundary: ${path}`);return path}
function requestFor(path){return new Request(new URL(path,self.location.origin).href)}
function valid(response,path){if(!response?.ok)return false;const type=String(response.headers.get('content-type')||'').toLowerCase();if(/\.html?$/i.test(path)||PREFIXES.includes(path))return type.includes('text/html')||!type;if(/\.(?:m?js|css)$/i.test(path))return !type.includes('text/html');return true}
function head(r){return new Response(null,{status:r.status,statusText:r.statusText,headers:r.headers})}
async function bounded(input,ms=TIMEOUT){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(new Request(input,{cache:'no-store',signal:c.signal}))}finally{clearTimeout(timer)}}
function safeGuild(v){const u=new URL(String(v||''));if(u.protocol!=='https:')throw new Error('Guild release origin must use HTTPS.');return u.origin}
async function setGuild(v){return put('guild',{schema:'civweave.guild-release-source.v1',origin:safeGuild(v.origin),nodeId:clean(v.nodeId,180),selectedAt:v.selectedAt||new Date().toISOString()})}
async function bundle(guild){try{const r=await bounded(`${guild.origin}/api/civweave-trust/bundle`);if(!r.ok)throw new Error(`Guild trust relay returned ${r.status}.`);const value=await r.json();if(value?.schema!==TRUST_SCHEMA)throw new Error('Unsupported Guild trust bundle.');const safe={schema:TRUST_SCHEMA,delegations:Array.isArray(value.delegations)?value.delegations:[],revocations:Array.isArray(value.revocations)?value.revocations:[]};await put('relayedTrustBundle',safe);return safe}catch(error){const saved=await get('relayedTrustBundle');if(saved)return saved;throw error}}
async function verifyManifest(manifest,remote){
  if(manifest?.schema!==RELEASE_SCHEMA||!manifest.releaseId||!manifest.signerKeyId||!Array.isArray(manifest.assets)||!active(manifest))throw new Error('Guild release manifest is invalid.');
  const {map,revoked}=await trust(remote),signer=map.get(manifest.signerKeyId);
  if(revoked.has(manifest.signerKeyId)||!signer?.capabilities.includes('release'))throw new Error('Guild release signer is not trusted by this device.');
  if(!await verify(manifest,signer.publicKey))throw new Error('Guild release signature was rejected.');
  const seen=new Set();for(const a of manifest.assets){const path=assetPath(a.path);if(seen.has(path)||!/^[A-Za-z0-9_-]{40,100}$/.test(clean(a.sha256,120)))throw new Error(`Guild release asset entry is invalid: ${path}`);seen.add(path)}
  for(const path of REQUIRED)if(!seen.has(path))throw new Error(`Guild release is missing required shell asset ${path}.`);
}
async function install(guild,manifest){
  const name=`${GUILD_CACHE_PREFIX}${(await digest(manifest.releaseId)).slice(0,24)}`,stage=`${name}-stage`;await caches.delete(stage);const staging=await caches.open(stage);
  try{
    for(const item of manifest.assets){const path=assetPath(item.path),u=new URL('/api/civweave-release/asset',guild.origin);u.searchParams.set('releaseId',manifest.releaseId);u.searchParams.set('path',path);const r=await bounded(u.href,12000);if(!r.ok)throw new Error(`Guild release asset ${path} returned ${r.status}.`);const bytes=new Uint8Array(await r.arrayBuffer());if(await digest(bytes)!==item.sha256)throw new Error(`Guild release asset hash mismatch for ${path}.`);const h=new Headers(r.headers);h.set('x-civweave-guild-release',manifest.releaseId);await staging.put(requestFor(path),new Response(bytes,{status:200,headers:h}))}
    await caches.delete(name);const final=await caches.open(name);for(const item of manifest.assets){const path=assetPath(item.path),r=await staging.match(requestFor(path),{ignoreSearch:true});if(!r)throw new Error(`Guild release staging cache lost ${path}.`);await final.put(requestFor(path),r)}
    await put('activeRelease',{releaseId:manifest.releaseId,cacheName:name,guildOrigin:guild.origin,signerKeyId:manifest.signerKeyId,activatedAt:new Date().toISOString()});for(const n of await caches.keys())if(n.startsWith(GUILD_CACHE_PREFIX)&&n!==name&&n!==stage)await caches.delete(n);return{ok:true,releaseId:manifest.releaseId,cacheName:name};
  }finally{await caches.delete(stage)}
}
async function check(force=false){const guild=await get('guild');if(!guild)return{ok:false,reason:'no-guild-selected'};const last=Number(await get('lastCheck')||0);if(!force&&Date.now()-last<CHECK_MS)return{ok:true,reason:'check-throttled'};await put('lastCheck',Date.now());const [remote,r]=await Promise.all([bundle(guild),bounded(`${guild.origin}/api/civweave-release/current`)]);if(r.status===404)return{ok:false,reason:'guild-has-no-release'};if(!r.ok)throw new Error(`Guild release relay returned ${r.status}.`);const manifest=await r.json();await verifyManifest(manifest,remote);const current=await get('activeRelease');if(current?.releaseId===manifest.releaseId&&current?.guildOrigin===guild.origin)return{ok:true,reason:'already-current',releaseId:manifest.releaseId};const result=await install(guild,manifest);await notify({type:'CIVWEAVE_GUILD_RELEASE_READY',...result,guildOrigin:guild.origin});return result}
async function notify(message){try{for(const c of await self.clients.matchAll({type:'window',includeUncontrolled:true}))c.postMessage(message)}catch{}}
async function localFallback(path,method){const r=await caches.match(requestFor(path),{ignoreSearch:true});if(!valid(r,path))return null;return method==='HEAD'?head(r):r}
async function responseFor(request,path){
  const guild=await get('guild');
  if(guild){const current=await get('activeRelease');if(current?.cacheName){const r=await(await caches.open(current.cacheName)).match(requestFor(path),{ignoreSearch:true});if(valid(r,path))return request.method==='HEAD'?head(r):r}const local=await localFallback(path,request.method);if(local)return local;return new Response('Verified Guild release asset unavailable on this device.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-release-policy':REVISION}})}
  try{const r=await bounded(request);if(valid(r,path)){if(request.method==='GET')await(await caches.open(LEGACY_CACHE)).put(requestFor(path),r.clone());return request.method==='HEAD'?head(r):r}}catch{}
  return await localFallback(path,request.method)||new Response('Civweave runtime asset unavailable offline.',{status:503});
}
async function purge(){const activeRelease=await get('activeRelease'),names=await caches.keys();for(const name of names){if(name===LEGACY_CACHE||name===activeRelease?.cacheName)continue;if(name.startsWith(GUILD_CACHE_PREFIX)){await caches.delete(name);continue}const cache=await caches.open(name);for(const req of await cache.keys()){let u;try{u=new URL(req.url)}catch{continue}if(u.origin===self.location.origin&&owned(u.pathname))await cache.delete(req,{ignoreSearch:true})}}}
self.addEventListener('install',e=>e.waitUntil((async()=>{if(await get('guild'))await check(true).catch(()=>null);await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{await purge();if(await get('guild'))await check(true).catch(()=>null);await self.clients.claim()})()));
self.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='CIVWEAVE_GUILD_RELEASE_CONFIG')e.waitUntil((async()=>{await setGuild(d.selection||d);await check(true).catch(error=>notify({type:'CIVWEAVE_GUILD_RELEASE_ERROR',error:String(error?.message||error)}))})());
  if(d.type==='CIVWEAVE_RELEASE_TRUST_ANCHOR'&&d.explicit===true)e.waitUntil((async()=>{const a=await addAnchor(d.anchor||{});await notify({type:'CIVWEAVE_RELEASE_TRUST_CHANGED',action:'added',keyId:a.keyId});await check(true).catch(()=>null)})());
  if(d.type==='CIVWEAVE_RELEASE_TRUST_REMOVE'&&d.explicit===true)e.waitUntil((async()=>{const n=await removeAnchor(clean(d.keyId,180));await notify({type:'CIVWEAVE_RELEASE_TRUST_CHANGED',action:'removed',keyId:clean(d.keyId,180),removed:n})})());
  if(d.type==='CIVWEAVE_GUILD_RELEASE_CHECK')e.waitUntil(check(true).then(result=>notify({type:'CIVWEAVE_GUILD_RELEASE_STATUS',result})).catch(error=>notify({type:'CIVWEAVE_GUILD_RELEASE_ERROR',error:String(error?.message||error)})));
});
self.addEventListener('fetch',e=>{const request=e.request;if(!['GET','HEAD'].includes(request.method))return;let u;try{u=new URL(request.url)}catch{return}if(u.origin!==self.location.origin)return;const path=u.pathname;if(request.mode!=='navigate'&&!owned(path))return;if(request.mode==='navigate'&&!(path==='/'||path==='/index.html'||PREFIXES.some(p=>path.startsWith(p))))return;e.stopImmediatePropagation();if(request.mode==='navigate')e.waitUntil(check(false).catch(()=>null));e.respondWith(responseFor(request,path))});
self.CivweaveDecentralizedReleaseV1=Object.freeze({revision:REVISION,requiredPaths:[...REQUIRED],policy:'selected-guild-is-release-transport-local-explicit-trust-anchors-delegated-release-keys-signed-revocations-no-central-key-or-release-fallback'});
})();
