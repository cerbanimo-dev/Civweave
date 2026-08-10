import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const js=await readFile(new URL('../public/app/civweave-map-service-v275.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/app/federation-finder-map-v275.html',import.meta.url),'utf8');
const route=await readFile(new URL('../public/finder/index.html',import.meta.url),'utf8');
const offline=JSON.parse(await readFile(new URL('../public/app/offline-package-v208.json',import.meta.url),'utf8'));
const prep=await readFile(new URL('./prepare-start-v131.mjs',import.meta.url),'utf8');

function has(text,pattern,message){assert.match(text,pattern,message)}

test('map service JavaScript parses',()=>{
  assert.doesNotThrow(()=>new vm.Script(js,{filename:'civweave-map-service-v275.js'}));
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

test('finder route and offline package point to v275',()=>{
  has(route,/federation-finder-map-v275\.html/);
  assert.ok(offline.assets.includes('/app/federation-finder-map-v275.html'));
  assert.ok(offline.assets.includes('/app/civweave-map-service-v275.js'));
  assert.ok(offline.assets.includes('/app/vendor/maplibre-v5.13.0/maplibre-gl.js'));
  has(prep,/stage-maplibre-v275\.mjs/,'startup preparation should vendor the renderer');
});
