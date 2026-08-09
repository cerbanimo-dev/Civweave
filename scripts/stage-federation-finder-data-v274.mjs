#!/usr/bin/env node

import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,'..');
const PUBLIC=resolve(ROOT,'public');
const OUT=resolve(PUBLIC,'app/federation-finder-data/atlas-v274');
const OFFLINE=resolve(PUBLIC,'app/offline-package-v208.json');
const PIN='60e883d0e3c5145949d0dcf9c723e2a511ee0eb6';
const RAW=`https://raw.githubusercontent.com/simonlpaige/commonweave/${PIN}/data`;
const SOURCE={map:`${RAW}/map/orgs.geojson`,index:`${RAW}/search/index.json`,edges:`${RAW}/map/edges.json`,relationships:`${RAW}/relationships.csv`};
const FEATURE_CHUNKS=64,EDGE_CHUNKS=32,MAX_FILE=23*1024*1024;
const rel=p=>`/app/federation-finder-data/atlas-v274/${p}`;

function hash(value){let h=2166136261;for(const c of String(value||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function validPoint(feature){const c=feature?.geometry?.coordinates;return Array.isArray(c)&&Number.isFinite(Number(c[0]))&&Number.isFinite(Number(c[1]))}
function compactFeature(feature,index){if(!validPoint(feature))return null;const p=feature?.properties||{},id=String(p.id||feature?.id||`cw-${index}`);const keep=['id','n','name','label','f','framework_area','framework','cc','country_code','country','ci','city','st','state','region','m','model','type','src','source','t','tier','w','website','url','e','email','p','phone','cu','contact_url','contactUrl','d','description','address','tags'];const props={id};for(const key of keep)if(p[key]!=null&&p[key]!=='')props[key]=p[key];return{type:'Feature',id,geometry:{type:'Point',coordinates:[Number(feature.geometry.coordinates[0]),Number(feature.geometry.coordinates[1])]},properties:props}}
function edgeRows(raw){if(Array.isArray(raw))return raw;if(Array.isArray(raw?.edges))return raw.edges;if(Array.isArray(raw?.relationships))return raw.relationships;return[]}
async function fetchText(url,label){const response=await fetch(url,{headers:{'user-agent':'Civweave-Federation-Finder-Stager/1.0'}});if(!response.ok)throw new Error(`${label} fetch failed: HTTP ${response.status}`);return response.text()}
async function writeJson(path,value){const text=JSON.stringify(value);if(Buffer.byteLength(text)>MAX_FILE)throw new Error(`${path} exceeds the Cloudflare 24 MiB asset boundary`);await writeFile(path,text)}
async function generatedReady(){try{const manifest=JSON.parse(await readFile(resolve(OUT,'manifest.json'),'utf8'));if(manifest?.source?.commit!==PIN||manifest?.featureCount<1000)return null;for(const asset of [...(manifest.featureChunks||[]),...(manifest.edgeChunks||[]),manifest.searchIndex,manifest.relationships].filter(Boolean)){const path=resolve(PUBLIC,asset.replace(/^\//,''));if(!existsSync(path)||(await stat(path)).size<2)return null}return manifest}catch{return null}}
async function syncOffline(manifest){const pkg=JSON.parse(await readFile(OFFLINE,'utf8'));const prefix='/app/federation-finder-data/atlas-v274/';const generated=[rel('manifest.json'),...(manifest.featureChunks||[]),...(manifest.edgeChunks||[]),manifest.searchIndex,manifest.relationships].filter(Boolean);pkg.assets=[...new Set([...(pkg.assets||[]).filter(asset=>!String(asset).startsWith(prefix)),...generated])];if('count'in pkg)pkg.count=pkg.assets.length;await writeFile(OFFLINE,`${JSON.stringify(pkg,null,2)}\n`)}

await mkdir(OUT,{recursive:true});
let manifest=await generatedReady();
if(manifest){await syncOffline(manifest);console.log(JSON.stringify({ok:true,staged:false,cached:true,featureCount:manifest.featureCount,edgeCount:manifest.edgeCount,sourceCommit:PIN},null,2));process.exit(0)}

console.log(`Staging pinned Commonweave contact atlas ${PIN} for offline Federation Finder…`);
const [mapText,indexText,edgesText,relationships]=await Promise.all([
  fetchText(SOURCE.map,'organization map'),
  fetchText(SOURCE.index,'search index'),
  fetchText(SOURCE.edges,'network edges'),
  fetchText(SOURCE.relationships,'relationships'),
]);
const map=JSON.parse(mapText),searchIndex=JSON.parse(indexText),edgesRaw=JSON.parse(edgesText);
if(!Array.isArray(map?.features)||map.features.length<1000)throw new Error(`Pinned organization map is unexpectedly small (${map?.features?.length||0} records)`);
const featureBuckets=Array.from({length:FEATURE_CHUNKS},()=>[]);let featureCount=0;
for(let i=0;i<map.features.length;i++){const feature=compactFeature(map.features[i],i);if(!feature)continue;featureBuckets[hash(feature.id)%FEATURE_CHUNKS].push(feature);featureCount++}
const featureChunks=[];
for(let i=0;i<FEATURE_CHUNKS;i++){const name=`contacts-${String(i).padStart(2,'0')}.json`;await writeJson(resolve(OUT,name),{type:'FeatureCollection',features:featureBuckets[i]});featureChunks.push(rel(name))}
const rows=edgeRows(edgesRaw),edgeBuckets=Array.from({length:EDGE_CHUNKS},()=>[]);
for(let i=0;i<rows.length;i++){const row=rows[i],key=row?.source_id??row?.sourceId??row?.source??row?.from??row?.a??i;edgeBuckets[hash(key)%EDGE_CHUNKS].push(row)}
const edgeChunks=[];
for(let i=0;i<EDGE_CHUNKS;i++){const name=`edges-${String(i).padStart(2,'0')}.json`;await writeJson(resolve(OUT,name),{edges:edgeBuckets[i]});edgeChunks.push(rel(name))}
await writeJson(resolve(OUT,'search-index.json'),searchIndex);
await writeFile(resolve(OUT,'relationships.csv'),relationships);
manifest={schema:'civweave.federation-finder.offline-atlas/v1',source:{repository:'simonlpaige/commonweave',commit:PIN,urls:SOURCE},featureCount,edgeCount:rows.length,relationshipBytes:Buffer.byteLength(relationships),featureChunks,edgeChunks,searchIndex:rel('search-index.json'),relationships:rel('relationships.csv')};
await writeJson(resolve(OUT,'manifest.json'),manifest);
await syncOffline(manifest);
console.log(JSON.stringify({ok:true,staged:true,featureCount,edgeCount:rows.length,featureChunks:FEATURE_CHUNKS,edgeChunks:EDGE_CHUNKS,sourceCommit:PIN},null,2));
