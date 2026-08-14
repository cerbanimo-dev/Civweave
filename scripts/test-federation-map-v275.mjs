import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const js=await readFile(new URL('../public/app/civweave-map-service-v275.js',import.meta.url),'utf8');
const mesh=await readFile(new URL('../public/app/civweave-map-mesh-v276.js',import.meta.url),'utf8');
const bridge=await readFile(new URL('../public/app/civweave-map-mesh-bridge-v276.js',import.meta.url),'utf8');
const coverage=await readFile(new URL('../public/app/civweave-map-coverage-v277.js',import.meta.url),'utf8');
const storage=await readFile(new URL('../public/app/civweave-map-storage-v1.js',import.meta.url),'utf8');
const offlineRuntime=await readFile(new URL('../public/app/civweave-map-offline-v1.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('../public/app/civweave-map-bootstrap-v1.js',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/app/civweave-map-ui-v1.js',import.meta.url),'utf8');
const scoring=await import(new URL('../public/app/shared/civweave-map-coverage-scoring-v1.mjs',import.meta.url));
const objectMesh=await readFile(new URL('../public/app/local-object-mesh-v146.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/app/federation-finder-map-v275.html',import.meta.url),'utf8');
const route=await readFile(new URL('../public/finder/index.html',import.meta.url),'utf8');
const offline=JSON.parse(await readFile(new URL('../public/app/offline-package-v208.json',import.meta.url),'utf8'));
const prep=await readFile(new URL('./prepare-start-v131.mjs',import.meta.url),'utf8');

function has(text,pattern,message){assert.match(text,pattern,message)}

test('map runtime JavaScript parses',()=>{
  for(const [name,source] of Object.entries({js,mesh,bridge,coverage,storage,offlineRuntime,bootstrap,ui}))assert.doesNotThrow(()=>new vm.Script(source,{filename:name}));
});

test('finder uses real vector locality provider and MapLibre renderer',()=>{
  has(js,/tiles\.openfreemap\.org\/styles\/(liberty|dark|positron)/,'OpenFreeMap vector styles should be configured');
  has(html,/maplibre-v5\.13\.0\/maplibre-gl\.js/,'installed renderer should be preferred');
  has(html,/Commonweave Atlas/,'creative map skin should be exposed');
  has(html,/Parchment Fieldbook/,'alternate creative map skin should be exposed');
});

test('place search is explicit, cached, throttled, and provider-switchable',()=>{
  has(html,/autocomplete="off"/,'search must not use remote autocomplete');
  has(js,/CIVWEAVE_GEOCODER_ENDPOINT/,'geocoder endpoint should be replaceable');
  has(js,/nominatim\.openstreetmap\.org/,'manual bootstrap geocoder should be explicit');
  has(js,/1100/,'public geocoder calls should be throttled above one second');
  has(js,/GEOCODE_CACHE_KEY/,'place results should be cached');
});

test('federation contacts and node overlay survive basemap replacement',()=>{
  has(js,/atlas-v274\/manifest\.json/,'staged offline contact atlas should remain the primary contact dataset');
  has(js,/api\/finder-status/,'node discovery contract should remain present');
  has(js,/clusterRadius/,'contact overlays should cluster on the vector map');
});

test('WWW map exchange rides the signed federated object mesh',()=>{
  has(mesh,/civweave\.map-pack-advert\.v1/,'map packs should have a signed mesh object kind');
  has(mesh,/civweave\.map-locality-batch\.v1/,'locality batches should have a signed mesh object kind');
  has(mesh,/civweave\.map-region-need\.v1/,'region needs should be exchangeable');
  has(mesh,/consent:'federated'/,'map knowledge should use the federated consent rail');
  has(mesh,/mesh\.syncGateway\(base\)/,'map exchange should use the existing HTTP gateway transport');
  has(objectMesh,/fetch\(new URL\('\/api\/envelopes',base\)/,'the object mesh should POST envelopes over HTTP');
  has(objectMesh,/endpoint=new URL\('\/api\/envelopes',base\)/,'the object mesh should receive envelopes over HTTP');
  has(mesh,/addEventListener\('online'/,'WWW reconnection should trigger exchange');
});

test('large map packs travel by URL and content hash into renderable chunk storage',()=>{
  has(mesh,/format\|\|'pmtiles'/,'PMTiles should be the default exchange format');
  has(mesh,/urls/,'pack adverts should carry reachable HTTP sources');
  has(mesh,/sha256/,'pack adverts should carry a content hash');
  has(mesh,/store\.importResponse/,'pack pulls should use the Map v1 store');
  has(storage,/SHA-256 does not match its signed advertisement/,'downloaded packs should reject hash mismatch');
  has(storage,/civweave-map-v1/,'downloaded packs should have a dedicated IndexedDB namespace');
  has(storage,/CHUNK_SIZE=1024\*1024/,'downloaded packs should be chunked for low-memory random access');
});

test('session-only device location is not auto-published',()=>{
  has(mesh,/session-device-location-never-auto-published/,'map mesh should expose its privacy invariant');
  has(mesh,/delete properties\.preciseDeviceLocation/,'private location markers should be stripped from locality batches');
  has(html,/not saved or published to the mesh/,'Finder should tell the user that Locate Me remains session-only');
  assert.doesNotMatch(bridge,/publishSelectedPublicNode\(\).*locate/i,'Locate Me must not be the publication trigger');
});

test('Finder ingests received locality knowledge and republishes only public node status',()=>{
  has(bridge,/localityFeatures\(\)/,'received public localities should be pulled from the mesh');
  has(bridge,/service\.state\.features\.set/,'received localities should join the live Finder map');
  has(bridge,/public \/api\/finder-status/,'manual public node discovery should be eligible for federation');
  has(bridge,/civweave:map-knowledge-changed/,'newly received WWW knowledge should refresh the map live');
  has(bridge,/NODE_STALE_MS/,'node status should expose freshness semantics');
  has(bridge,/NODE_EXPIRES_MS/,'node status should expire rather than live forever');
});

test('coverage negotiator publishes bounded needs and heals from ranked peer packs',()=>{
  has(bridge,/civweave-map-coverage-v277\.js/,'the Finder bridge should load the coverage negotiator');
  has(coverage,/MIN_AUTO_ZOOM=5/,'automatic requests should stay local rather than requesting planet-scale packs');
  has(coverage,/publishRegionNeed/,'missing viewport coverage should publish a region need');
  has(coverage,/mesh\.sync\(\)/,'a new need should immediately exchange over the WWW when available');
  has(coverage,/rankCandidates/,'peer packs should be ranked before download');
  has(coverage,/mesh\.pullMapPack/,'the best eligible peer pack should be cached');
  has(coverage,/civweave:map-offline-coverage-ready/,'successful healing should emit a coverage-ready event');
  has(coverage,/failureBlocked/,'failed peer packs should use retry backoff');
  has(coverage,/saveData/,'Data Saver should suppress automatic heavy pulls');
  has(coverage,/CivweaveMapStorageV1/,'coverage should be satisfied only by the renderable v1 store');
});

test('coverage scoring prioritizes complete, verified, efficient packs',()=>{
  const need={bbox:[-76,43,-75,44],minZoom:8,maxZoom:8,formats:['pmtiles'],maxBytes:100*1024*1024};
  const good={packId:'good',format:'pmtiles',bbox:[-77,42,-74,45],minZoom:0,maxZoom:14,bytes:20*1024*1024,sha256:'a'.repeat(64),generatedAt:new Date().toISOString(),originFingerprint:'signed-peer'};
  const partial={packId:'partial',format:'pmtiles',bbox:[-75.4,43,-75,44],minZoom:0,maxZoom:14,bytes:8*1024*1024,sha256:'b'.repeat(64),generatedAt:new Date().toISOString(),originFingerprint:'signed-peer'};
  const unhashed={packId:'unhashed',format:'pmtiles',bbox:[-77,42,-74,45],minZoom:0,maxZoom:14,bytes:4*1024*1024,sha256:'',generatedAt:new Date().toISOString(),originFingerprint:'signed-peer'};
  const ranked=scoring.rankPacks(need,[partial,unhashed,good],{good:{trusted:true,latencyMs:120}});
  assert.equal(ranked[0].pack.packId,'good');assert.equal(ranked[0].eligible,true);assert.equal(ranked.find(row=>row.pack.packId==='partial').eligible,false);assert.equal(ranked.find(row=>row.pack.packId==='unhashed').eligible,false);assert.equal(scoring.coverageRatio(need.bbox,good.bbox),1);
});

test('coverage scoring uses size, provenance and observed latency as tie breakers',()=>{
  const need={bbox:[-76,43,-75,44],minZoom:8,maxZoom:8,formats:['pmtiles'],maxBytes:120*1024*1024};
  const base={format:'pmtiles',bbox:[-77,42,-74,45],minZoom:0,maxZoom:14,sha256:'c'.repeat(64),generatedAt:new Date().toISOString(),originFingerprint:'signed-peer'};
  const small={...base,packId:'small',bytes:12*1024*1024};const large={...base,packId:'large',bytes:90*1024*1024};
  const ranked=scoring.rankPacks(need,[large,small],{small:{trusted:true,latencyMs:80},large:{trusted:false,latencyMs:2200}});assert.equal(ranked[0].pack.packId,'small');assert.equal(scoring.cachedPackSatisfies(need,{...small,cachedAt:new Date().toISOString()}),true);
});

test('finder route and offline package carry the complete Map v1 stack',()=>{
  has(route,/\/app\/hub-map-v1\.html/,'Finder should redirect to the canonical Hub Map while retaining the full Map v1 offline stack.');
  for(const asset of ['/app/federation-finder-map-v275.html','/app/civweave-map-service-v275.js','/app/civweave-map-bootstrap-v1.js','/app/civweave-map-mesh-v276.js','/app/civweave-map-mesh-bridge-v276.js','/app/civweave-map-coverage-v277.js','/app/civweave-map-storage-v1.js','/app/civweave-map-offline-v1.js','/app/civweave-map-ui-v1.js','/app/shared/civweave-map-coverage-scoring-v1.mjs','/app/shared/civweave-sha256-stream-v1.mjs','/app/vendor/maplibre-v5.13.0/maplibre-gl.js','/app/vendor/pmtiles-v4.4.1/pmtiles.js'])assert.ok(offline.assets.includes(asset),`${asset} should ship offline`);
  assert.ok(String(offline.revision||'').startsWith('canonical-background-campus-v241-systems-mesh-v251'),'offline package must retain the canonical background-campus + systems-mesh revision prefix');
  has(prep,/stage-maplibre-v275\.mjs/,'startup preparation should vendor the renderer');
  has(prep,/stage-federation-finder-data-v274\.mjs/,'startup preparation should hydrate the pinned atlas');
  has(offlineRuntime,/new lib\.PMTiles\(source\)/,'downloaded PMTiles should actually render');
});
