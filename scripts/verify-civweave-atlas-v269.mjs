import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const htmlPath=path.join(root,'public/app/civweave-atlas-v269.html');
const jsPath=path.join(root,'public/app/civweave-atlas-v269.js');
const topbarPath=path.join(root,'public/app/working-campus-topbar-v243.js');

const [html,js,topbar]=await Promise.all([
  readFile(htmlPath,'utf8'),
  readFile(jsPath,'utf8'),
  readFile(topbarPath,'utf8')
]);

test('Civweave Atlas owns the map title and Commonweave receives data credit',()=>{
  assert.match(html,/<title>Civweave Atlas<\/title>/);
  assert.match(html,/<h1>Civweave Atlas<\/h1>/);
  assert.match(html,/Map data with thanks to Commonweave\./);
  assert.doesNotMatch(html,/Commonweave Atlas/);
});

test('atlas includes offline search, layers, dense points, zoom, location, and pairing affordances',()=>{
  for(const marker of ['atlasSearch','data-filter="federation"','data-filter="org"','data-filter="node"','data-filter="resource"','publicPointCanvas','zoomIn','zoomOut','locateButton','Thread Guide'])assert.ok(html.includes(marker),`missing ${marker}`);
  for(const marker of ['navigator.geolocation','civweave:atlas-pair-request','commonweave:atlas-data','civweave.atlas.paired.v1','renderPublicPoints','renderThreads','zoomBy','projectLonLat','nearestCommonweave'])assert.ok(js.includes(marker),`missing ${marker}`);
});

test('atlas hydrates and caches the canonical Commonweave public map snapshot',()=>{
  assert.match(js,/https:\/\/commonweave\.earth\/data\/map\/orgs\.geojson/);
  assert.match(js,/https:\/\/raw\.githubusercontent\.com\/simonlpaige\/commonweave\/master\/data\/map\/orgs\.geojson/);
  assert.match(js,/https:\/\/commonweave\.earth\/data\/map\/edges\.json/);
  assert.ok(js.includes("COMMONWEAVE_CACHE='civweave-atlas-commonweave-v1'"));
  assert.ok(js.includes("fetch(url,{mode:'cors',cache:'no-store',credentials:'omit'})"));
  assert.ok(js.includes('cache.put(url,response.clone())'));
  assert.ok(js.includes('COMMONWEAVE_REFRESH_MS=24*60*60*1000'));
  assert.ok(js.includes("raw?.type==='FeatureCollection'"));
});

test('Commonweave organizations map real coordinates and preserve useful public metadata',()=>{
  for(const marker of ['node?.n','node?.f','node?.m','node?.t','node?.cc','node?.ci','node?.w','node?.cu'])assert.ok(js.includes(marker),`missing Commonweave field ${marker}`);
  assert.ok(js.includes("modelType.toLowerCase()==='federation'?'federation'"));
  assert.ok(js.includes('projectLonLat(position.coords.longitude,position.coords.latitude)'));
  assert.ok(js.includes('Map data with thanks to Commonweave.')||html.includes('Map data with thanks to Commonweave.'));
});

test('Commonweave graph edges are deferred until an entry requests its threads',()=>{
  assert.ok(js.includes('async function loadCommonweaveEdges()'));
  assert.ok(js.includes('async function loadSelectedThreads(node)'));
  assert.ok(js.includes("node?.origin!=='commonweave'"));
  assert.ok(js.includes('slice(0,24)'));
});

test('working campus Atlas control opens the native atlas instead of localhost finder',()=>{
  assert.match(topbar,/ATLAS_ROUTE='\/app\/civweave-atlas-v269\.html'/);
  assert.match(topbar,/<span>Atlas<\/span>/);
  const openMap=topbar.slice(topbar.indexOf('function openMap()'),topbar.indexOf('function syncHeaderHeight'));
  assert.match(openMap,/openAtlas\(\)/);
  assert.doesNotMatch(openMap,/openFederationFinder/);
});

test('atlas JavaScript parses cleanly',()=>{
  execFileSync(process.execPath,['--check',jsPath],{stdio:'pipe'});
});
