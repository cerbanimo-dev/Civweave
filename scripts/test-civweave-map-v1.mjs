import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Sha256Stream,sha256Hex} from '../public/app/shared/civweave-sha256-stream-v1.mjs';

const read=relative=>readFile(new URL(`../${relative}`,import.meta.url),'utf8');
const [storage,offline,ui,mesh,bridge,coverage,bootstrap,serviceWorker,stage,prepare,cloudflare,builder,installBuild,mobileBuilder,html,offlinePackageText,manifestText]=await Promise.all([
  read('public/app/civweave-map-storage-v1.js'),read('public/app/civweave-map-offline-v1.js'),read('public/app/civweave-map-ui-v1.js'),read('public/app/civweave-map-mesh-v276.js'),read('public/app/civweave-map-mesh-bridge-v276.js'),read('public/app/civweave-map-coverage-v277.js'),read('public/app/civweave-map-bootstrap-v1.js'),read('public/service-worker.js'),read('scripts/stage-maplibre-v275.mjs'),read('scripts/prepare-start-v131.mjs'),read('scripts/build-cloudflare-pages.mjs'),read('scripts/build-civweave-map-v1.mjs'),read('scripts/build-install-artifacts.sh'),read('scripts/build-mobile-install-kit.mjs'),read('public/app/federation-finder-map-v275.html'),read('public/app/offline-package-v208.json'),read('public/app/civweave-map-v1-manifest.json')
]);
const offlinePackage=JSON.parse(offlinePackageText),manifest=JSON.parse(manifestText);
const has=(text,pattern,message)=>assert.match(text,pattern,message);

test('streaming SHA-256 matches Node crypto across chunk boundaries',()=>{
  const vectors=[new Uint8Array(),new TextEncoder().encode('abc'),new TextEncoder().encode('Civweave Map v1')];
  for(const bytes of vectors){const expected=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(sha256Hex(bytes),expected)}
  const large=Buffer.alloc(2*1024*1024+333);for(let i=0;i<large.length;i++)large[i]=(i*31+7)&255;
  const stream=new Sha256Stream();for(let offset=0;offset<large.length;){const size=Math.min(1+((offset*17)%8191),large.length-offset);stream.update(large.subarray(offset,offset+size));offset+=size}
  assert.equal(stream.hex(),crypto.createHash('sha256').update(large).digest('hex'));
});

test('Map v1 classic runtimes parse',()=>{
  for(const [name,source] of Object.entries({storage,offline,ui,mesh,bridge,coverage,bootstrap,serviceWorker}))assert.doesNotThrow(()=>new vm.Script(source,{filename:name}));
});

test('PMTiles downloads are streamed, chunked, verified, and random-access readable',()=>{
  has(storage,/indexedDB\.open\(DB_NAME,DB_VERSION\)/,'Map packs should use IndexedDB');
  has(storage,/CHUNK_SIZE=1024\*1024/,'Map packs should be split into 1 MiB chunks');
  has(storage,/response\.body\?\.getReader/,'Downloads should prefer streaming response bodies');
  has(storage,/new Sha256Stream\(\)/,'Downloads should hash incrementally');
  has(storage,/getBytes\(packId,offset,length\)/,'Cached PMTiles should expose byte-range reads');
  has(storage,/getKey:\(\)=>sourceKey\(id\)/,'Cached PMTiles should expose a PMTiles Source key');
  has(storage,/async function getChunk\(packId,index\)/,'Each awaited chunk read should own a safe IndexedDB transaction');
  assert.equal((storage.match(/\.arrayBuffer\(\)/g)||[]).length,1,'Only the explicitly bounded legacy fallback may buffer a whole response');
  has(storage,/FALLBACK_BUFFER_LIMIT=16\*1024\*1024/,'Non-streaming fallback must stay tightly bounded');
});

test('cached PMTiles are wired into the live MapLibre basemap',()=>{
  has(offline,/new lib\.PMTiles\(source\)/,'Offline runtime should construct PMTiles from the custom chunk source');
  has(offline,/p\.add\(activeArchive\)/,'Custom archive should be registered with the PMTiles protocol');
  has(offline,/maplibregl\.addProtocol\('pmtiles',protocol\.tile\)/,'MapLibre should register the PMTiles protocol');
  has(offline,/pmtiles:\/\/\$\{source\.getKey\(\)\}/,'Offline style should address the registered cached archive');
  has(offline,/svc\.state\.map\.setStyle\(style\)/,'The live map should switch to the cached style');
  has(offline,/type:'raster'/,'Raster PMTiles should be supported');
  has(offline,/type:'vector'/,'Vector PMTiles should be supported');
  has(offline,/attribution/,'Offline sources should propagate attribution');
});

test('clean airplane-mode startup has a packaged no-CDN fallback',()=>{
  has(bootstrap,/civweave-graticule/,'Fallback should provide a geographic coordinate field');
  has(bootstrap,/navigator\.onLine===false/,'Fallback should activate in airplane mode');
  has(bootstrap,/map\.setStyle\(fallbackStyle\(\)\)/,'Fallback should make MapLibre style-ready without remote tiles');
  has(serviceWorker,/civweave-map-bootstrap-v1\.js/,'Bootstrap runtime must be installed with the PWA');
});

test('storage pressure has quota awareness, LRU eviction, pinning, and persistence controls',()=>{
  has(storage,/navigator\.storage\?\.estimate/,'Storage manager should inspect browser quota');
  has(storage,/reason:'lru-prune'/,'Storage manager should evict unpinned least-recently-used packs');
  has(storage,/setPinned/,'Storage manager should support pinned regions');
  has(ui,/navigator\.storage\.persist/,'UI should offer persistent browser storage');
  has(ui,/data-pack-remove/,'UI should allow downloaded regions to be removed');
});

test('coverage healing only reports renderable chunk-store packs as local coverage',()=>{
  has(coverage,/CivweaveMapStorageV1/,'Coverage runtime should read the Map v1 store');
  has(coverage,/row\.status==='ready'/,'Only completed packs should satisfy coverage');
  has(coverage,/pack\.format==='pmtiles'/,'Automatic coverage should target PMTiles v1 packs');
  has(coverage,/renderable offline/,'Healing status should reflect renderability, not only download completion');
  has(mesh,/store\.importResponse/,'Federated pulls should stream into Map v1 storage');
  assert.doesNotMatch(mesh,/response\.arrayBuffer\(\)/,'Federated pack pulls must not buffer the full archive');
});

test('public node locality has stale and expiry semantics',()=>{
  has(bridge,/NODE_STALE_MS=6\*60\*60\*1000/,'Node records should become visibly stale after six hours');
  has(bridge,/NODE_EXPIRES_MS=24\*60\*60\*1000/,'Node records should expire after twenty-four hours');
  has(bridge,/lastSeenAt:observed/,'Published node records should carry observation time');
  has(bridge,/expiresAt\}/,'Published node locality should carry mesh expiry');
  has(mesh,/_civweaveMeshExpiresAt/,'Received locality should preserve expiry metadata');
});

test('Map v1 exposes coverage, storage, basemap, attribution, and diagnostics UI',()=>{
  for(const id of ['coverageToggle','coverageStatus','basemapMode','mapStorageStatus','downloadedMapList','mapSelfTest'])has(ui,new RegExp(id),`UI should expose ${id}`);
  has(ui,/pack\.license/,'Downloaded pack licensing should be visible');
  has(ui,/pack\.attribution/,'Downloaded pack attribution should be visible');
  has(offline,/selfTest/,'Runtime should expose a launch self-check');
});

test('device package, mobile kit, and standalone package share one Map v1 asset contract',()=>{
  assert.equal(manifest.name,'Civweave Map');assert.equal(manifest.version,'1.0.0');assert.equal(manifest.offlineFirst,true);
  assert.match(offlinePackage.revision,/^canonical-background-campus-v241-systems-mesh-v251(?:-|$)/,'offline package must preserve the canonical campus + systems-mesh baseline while allowing newer additive launch contracts');
  for(const marker of ['cerbanimo-commerce-v1.1','economic-value-review-v1'])assert.ok(offlinePackage.revision.includes(marker),`offline package revision must retain additive contract ${marker}`);
  for(const asset of ['/app/civweave-map-storage-v1.js','/app/civweave-map-offline-v1.js','/app/civweave-map-ui-v1.js','/app/civweave-map-bootstrap-v1.js','/app/shared/civweave-sha256-stream-v1.mjs','/app/vendor/pmtiles-v4.4.1/pmtiles.js'])assert.ok(offlinePackage.assets.includes(asset),`${asset} should be in the offline package`);
  has(serviceWorker,/const MAP_CORE=\[/,'Service worker should define a Map v1 install boundary');
  has(mobileBuilder,/extractArray\(workerSource, 'MAP_CORE'\)/,'Mobile installer must hydrate the Map v1 service-worker boundary');
  has(mobileBuilder,/deviceCore = unique\(\[\.\.\.workerCore, \.\.\.workerMapCore\]\)/,'Mobile installer must combine system and map device cores');
  has(mobileBuilder,/mapPackage: 'Civweave Map v1'/,'Mobile release metadata should identify the map package');
  for(const asset of manifest.assets.filter(asset=>asset!=='/app/local-object-mesh-v146.js')){const escaped=asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(!asset.startsWith('/finder/'))has(serviceWorker,new RegExp(escaped),'Map v1 runtime asset should be device-installed')}
  has(serviceWorker,/pathname==='\/finder'/,'Finder should have an offline navigation fallback');
  has(builder,/Civweave-Map-v1\.zip/,'Standalone package builder should emit the named v1 archive');
  has(builder,/createZipArchive/,'Standalone package should use the portable ZIP writer');
});

test('all build lanes stage deterministic MapLibre and PMTiles before packaging',()=>{
  has(stage,/maplibre-gl@5\.13\.0/);has(stage,/pmtiles@4\.4\.1/);has(stage,/throw new Error\(`Required Civweave Map v1 runtime/,'Map stager should fail closed');
  has(prepare,/stage-maplibre-v275\.mjs/);has(prepare,/stage-federation-finder-data-v274\.mjs/);
  has(cloudflare,/mapRuntimeStage/);has(cloudflare,/mapPackageBuilder/);has(cloudflare,/Civweave Map v1 checksum/);
  has(installBuild,/build-civweave-map-v1\.mjs/);
});

test('privacy rail remains explicit in the launch package',()=>{
  has(html,/not saved or published to the mesh/,'Finder must state session-only location privacy');
  has(mesh,/delete properties\.preciseDeviceLocation/,'Mesh must strip precise-device markers');
  assert.equal(manifest.privacy.deviceLocationPublished,false);
  assert.doesNotMatch(bridge,/publishSelectedPublicNode\(\).*locate/i,'Locate Me must not publish node status');
});
