import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const js=await readFile(new URL('../public/app/civweave-map-service-v275.js',import.meta.url),'utf8');
const mesh=await readFile(new URL('../public/app/civweave-map-mesh-v276.js',import.meta.url),'utf8');
const bridge=await readFile(new URL('../public/app/civweave-map-mesh-bridge-v276.js',import.meta.url),'utf8');
const objectMesh=await readFile(new URL('../public/app/local-object-mesh-v146.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/app/federation-finder-map-v275.html',import.meta.url),'utf8');
const route=await readFile(new URL('../public/finder/index.html',import.meta.url),'utf8');
const offline=JSON.parse(await readFile(new URL('../public/app/offline-package-v208.json',import.meta.url),'utf8'));
const prep=await readFile(new URL('./prepare-start-v131.mjs',import.meta.url),'utf8');

function has(text,pattern,message){assert.match(text,pattern,message)}

test('map runtime JavaScript parses',()=>{
  assert.doesNotThrow(()=>new vm.Script(js,{filename:'civweave-map-service-v275.js'}));
  assert.doesNotThrow(()=>new vm.Script(mesh,{filename:'civweave-map-mesh-v276.js'}));
  assert.doesNotThrow(()=>new vm.Script(bridge,{filename:'civweave-map-mesh-bridge-v276.js'}));
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

test('large map packs travel by URL and content hash rather than relay payload',()=>{
  has(mesh,/format\|\|'pmtiles'/,'PMTiles should be the default exchange format');
  has(mesh,/urls/,'pack adverts should carry reachable HTTP sources');
  has(mesh,/sha256/,'pack adverts should carry a content hash');
  has(mesh,/SHA-256 does not match its signed advertisement/,'downloaded packs should reject hash mismatch');
  has(mesh,/civweave-map-packs-v1/,'downloaded packs should have a dedicated local cache');
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
});

test('finder route and offline package carry v275/v276 map stack',()=>{
  has(route,/federation-finder-map-v275\.html/);
  assert.ok(offline.assets.includes('/app/federation-finder-map-v275.html'));
  assert.ok(offline.assets.includes('/app/civweave-map-service-v275.js'));
  assert.ok(offline.assets.includes('/app/civweave-map-mesh-v276.js'));
  assert.ok(offline.assets.includes('/app/civweave-map-mesh-bridge-v276.js'));
  assert.ok(offline.assets.includes('/app/vendor/maplibre-v5.13.0/maplibre-gl.js'));
  has(prep,/stage-maplibre-v275\.mjs/,'startup preparation should vendor the renderer');
});