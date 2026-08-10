#!/usr/bin/env node

import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,'..');
const ASSETS=[
  {path:'public/app/vendor/maplibre-v5.13.0/maplibre-gl.js',url:'https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.js',minBytes:500000},
  {path:'public/app/vendor/maplibre-v5.13.0/maplibre-gl.css',url:'https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.css',minBytes:20000},
  {path:'public/app/vendor/pmtiles-v4.4.1/pmtiles.js',url:'https://unpkg.com/pmtiles@4.4.1/dist/pmtiles.js',minBytes:50000}
];
async function valid(path,minBytes){if(!existsSync(path))return false;try{return(await readFile(path)).byteLength>=minBytes}catch{return false}}
async function fetchAsset(asset){
  const response=await fetch(asset.url,{headers:{'user-agent':'Civweave-Map-v1-Stager/1.0'}});if(!response.ok)throw new Error(`${asset.url} → HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.byteLength<asset.minBytes)throw new Error(`${asset.path} unexpectedly small (${bytes.byteLength} bytes)`);
  const output=resolve(ROOT,asset.path);await mkdir(dirname(output),{recursive:true});await writeFile(output,bytes);return bytes.byteLength;
}
const report=[];
for(const asset of ASSETS){const output=resolve(ROOT,asset.path);if(await valid(output,asset.minBytes)){report.push({asset:asset.path,staged:false,cached:true});continue}const bytes=await fetchAsset(asset);report.push({asset:asset.path,staged:true,bytes})}
for(const asset of ASSETS){if(!await valid(resolve(ROOT,asset.path),asset.minBytes))throw new Error(`Required Civweave Map v1 runtime is missing or invalid: ${asset.path}`)}
console.log(JSON.stringify({ok:true,package:'Civweave Map v1',maplibre:'5.13.0',pmtiles:'4.4.1',assets:report},null,2));
